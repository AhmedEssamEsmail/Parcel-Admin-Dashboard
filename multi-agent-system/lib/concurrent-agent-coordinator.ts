/**
 * Concurrent Agent Coordinator
 *
 * Enables true concurrent multi-agent communication by managing multiple
 * agent sessions simultaneously and facilitating real-time message passing.
 *
 * This coordinator allows:
 * - Spawning multiple agents concurrently (non-blocking)
 * - Real-time message passing between active agents
 * - Monitoring and coordinating agent collaboration
 * - Collecting results from all agents when complete
 */

import { AgentInvocationManager } from './agent-invocation';
import { MessageBus } from './message-bus';
import { AgentRegistry } from './agent-registry';
import { AgentRole } from './agent-definition-schema';
import { getLogger } from './logger';
import { AgentMessage } from './types';
import { InvokeSubAgentParams, AgentInvocationResult } from './agent-invocation-types';

/**
 * Configuration for concurrent agent session
 */
export interface ConcurrentSessionConfig {
  sessionId: string;
  coordinatorId: string;
  agents: Array<{
    agentId: string;
    role: AgentRole;
    task: string;
    canCommunicateWith?: string[];
  }>;
  timeout?: number;
  onMessage?: (agentId: string, message: AgentMessage) => void | Promise<void>;
  onAgentComplete?: (agentId: string, result: AgentInvocationResult) => void | Promise<void>;
  onAllComplete?: (results: Map<string, AgentInvocationResult>) => void | Promise<void>;
}

/**
 * Status of a concurrent agent session
 */
export interface ConcurrentSessionStatus {
  sessionId: string;
  coordinatorId: string;
  startedAt: Date;
  status: 'active' | 'completed' | 'failed' | 'timeout';
  activeAgents: string[];
  completedAgents: string[];
  failedAgents: string[];
  messageCount: number;
  results: Map<string, AgentInvocationResult>;
}

/**
 * Active concurrent session
 */
interface ActiveSession {
  config: ConcurrentSessionConfig;
  status: ConcurrentSessionStatus;
  agentPromises: Map<string, Promise<AgentInvocationResult>>;
  messageSubscriptions: Map<string, () => void>;
  timeoutHandle?: NodeJS.Timeout;
}

/**
 * Concurrent Agent Coordinator
 *
 * Manages multiple agents running concurrently with real-time message passing
 */
export class ConcurrentAgentCoordinator {
  private sessions: Map<string, ActiveSession> = new Map();
  private logger = getLogger();

  constructor(
    private invocationManager: AgentInvocationManager,
    private messageBus: MessageBus,
    private registry: AgentRegistry
  ) {}

  /**
   * Start a concurrent agent session
   *
   * Spawns multiple agents simultaneously and enables real-time communication
   * between them. Returns immediately without waiting for agents to complete.
   *
   * @param config - Session configuration
   * @returns Session ID for monitoring
   */
  async startConcurrentSession(config: ConcurrentSessionConfig): Promise<string> {
    const correlationId = this.logger.generateCorrelationId();

    this.logger.info('ConcurrentSession', `Starting concurrent session ${config.sessionId}`, {
      sessionId: config.sessionId,
      agentCount: config.agents.length,
      correlationId,
    });

    // Initialize session status
    const status: ConcurrentSessionStatus = {
      sessionId: config.sessionId,
      coordinatorId: config.coordinatorId,
      startedAt: new Date(),
      status: 'active',
      activeAgents: config.agents.map((a) => a.agentId),
      completedAgents: [],
      failedAgents: [],
      messageCount: 0,
      results: new Map(),
    };

    const session: ActiveSession = {
      config,
      status,
      agentPromises: new Map(),
      messageSubscriptions: new Map(),
    };

    this.sessions.set(config.sessionId, session);

    // Set up message interception for all agents in this session
    this.setupMessageInterception(session);

    // Spawn all agents concurrently (non-blocking)
    const spawnPromises = config.agents.map((agentConfig) =>
      this.spawnAgentAsync(session, agentConfig, correlationId)
    );

    // Wait for all agents to be spawned (but not completed)
    await Promise.all(spawnPromises);

    // Set up session timeout if specified
    if (config.timeout) {
      session.timeoutHandle = setTimeout(() => {
        this.handleSessionTimeout(config.sessionId);
      }, config.timeout);
    }

    this.logger.info('ConcurrentSession', `All agents spawned for session ${config.sessionId}`, {
      sessionId: config.sessionId,
      agentIds: config.agents.map((a) => a.agentId),
      correlationId,
    });

    return config.sessionId;
  }

  /**
   * Spawn a single agent asynchronously
   */
  private async spawnAgentAsync(
    session: ActiveSession,
    agentConfig: ConcurrentSessionConfig['agents'][0],
    correlationId: string
  ): Promise<void> {
    const { agentId, role, task, canCommunicateWith } = agentConfig;

    this.logger.debug('ConcurrentSession', `Spawning agent ${agentId}`, {
      sessionId: session.config.sessionId,
      agentId,
      role,
      correlationId,
    });

    // Build communication list (all agents in session + coordinator)
    const allAgentIds = session.config.agents.map((a) => a.agentId);
    const communicationList = canCommunicateWith || allAgentIds.filter((id) => id !== agentId);
    communicationList.push(session.config.coordinatorId);

    // Create spawn parameters
    const params: InvokeSubAgentParams = {
      agentId,
      role,
      task,
      parentAgent: session.config.coordinatorId,
      canCommunicateWith: communicationList,
      onMessage: async (message) => {
        await this.handleAgentMessage(session, agentId, message);
      },
      onComplete: async (result) => {
        await this.handleAgentComplete(session, agentId, result);
      },
      onEscalate: async (escalation) => {
        this.logger.warn('ConcurrentSession', `Agent ${agentId} escalated`, {
          sessionId: session.config.sessionId,
          agentId,
          reason: escalation.reason,
          correlationId,
        });
      },
    };

    // Invoke agent (this returns immediately after spawning)
    const spawnResult = await this.invocationManager.invokeSubAgent(params);

    if (!spawnResult.success) {
      this.logger.error('ConcurrentSession', `Failed to spawn agent ${agentId}`, undefined, {
        sessionId: session.config.sessionId,
        agentId,
        error: spawnResult.error,
        correlationId,
      });

      // Mark agent as failed
      session.status.activeAgents = session.status.activeAgents.filter((id) => id !== agentId);
      session.status.failedAgents.push(agentId);

      throw new Error(`Failed to spawn agent ${agentId}: ${spawnResult.error}`);
    }

    this.logger.debug('ConcurrentSession', `Agent ${agentId} spawned successfully`, {
      sessionId: session.config.sessionId,
      agentId,
      correlationId,
    });
  }

  /**
   * Set up message interception for all agents in session
   */
  private setupMessageInterception(session: ActiveSession): void {
    const agentIds = session.config.agents.map((a) => a.agentId);

    agentIds.forEach((agentId) => {
      // Subscribe to messages for this agent
      const unsubscribe = this.messageBus.subscribe(agentId, async (message) => {
        session.status.messageCount++;

        this.logger.debug('ConcurrentSession', `Message intercepted`, {
          sessionId: session.config.sessionId,
          from: message.from,
          to: message.to,
          type: message.type,
        });

        // Call session-level message callback if provided
        if (session.config.onMessage) {
          await session.config.onMessage(agentId, message);
        }
      });

      session.messageSubscriptions.set(agentId, unsubscribe);
    });
  }

  /**
   * Handle message from an agent
   */
  private async handleAgentMessage(
    session: ActiveSession,
    agentId: string,
    message: AgentMessage
  ): Promise<void> {
    session.status.messageCount++;

    this.logger.debug('ConcurrentSession', `Agent message`, {
      sessionId: session.config.sessionId,
      agentId,
      messageType: message.type,
      from: message.from,
      to: message.to,
    });

    // Call session-level message callback if provided
    if (session.config.onMessage) {
      await session.config.onMessage(agentId, message);
    }
  }

  /**
   * Handle agent completion
   */
  private async handleAgentComplete(
    session: ActiveSession,
    agentId: string,
    result: AgentInvocationResult
  ): Promise<void> {
    this.logger.info('ConcurrentSession', `Agent completed`, {
      sessionId: session.config.sessionId,
      agentId,
      success: result.success,
    });

    // Update session status
    session.status.activeAgents = session.status.activeAgents.filter((id) => id !== agentId);

    if (result.success) {
      session.status.completedAgents.push(agentId);
    } else {
      session.status.failedAgents.push(agentId);
    }

    session.status.results.set(agentId, result);

    // Call agent-level completion callback
    if (session.config.onAgentComplete) {
      await session.config.onAgentComplete(agentId, result);
    }

    // Check if all agents are complete
    if (session.status.activeAgents.length === 0) {
      await this.completeSession(session.config.sessionId);
    }
  }

  /**
   * Complete a session
   */
  private async completeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.logger.info('ConcurrentSession', `Session completed`, {
      sessionId,
      completedAgents: session.status.completedAgents.length,
      failedAgents: session.status.failedAgents.length,
      messageCount: session.status.messageCount,
    });

    // Clear timeout if set
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    // Unsubscribe from all messages
    session.messageSubscriptions.forEach((unsubscribe) => unsubscribe());
    session.messageSubscriptions.clear();

    // Update status
    session.status.status = session.status.failedAgents.length > 0 ? 'failed' : 'completed';

    // Call session-level completion callback
    if (session.config.onAllComplete) {
      await session.config.onAllComplete(session.status.results);
    }
  }

  /**
   * Handle session timeout
   */
  private handleSessionTimeout(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.logger.warn('ConcurrentSession', `Session timed out`, {
      sessionId,
      activeAgents: session.status.activeAgents,
    });

    // Mark all active agents as failed
    session.status.failedAgents.push(...session.status.activeAgents);
    session.status.activeAgents = [];
    session.status.status = 'timeout';

    // Terminate all active agents
    session.status.failedAgents.forEach((agentId) => {
      this.invocationManager.terminateAgent(agentId).catch((error) => {
        this.logger.error('ConcurrentSession', `Failed to terminate agent ${agentId}`, error);
      });
    });

    // Unsubscribe from all messages
    session.messageSubscriptions.forEach((unsubscribe) => unsubscribe());
    session.messageSubscriptions.clear();
  }

  /**
   * Send a message to an agent in a session
   */
  async sendMessageToAgent(
    sessionId: string,
    fromAgentId: string,
    toAgentId: string,
    message: Partial<AgentMessage>
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    await this.invocationManager.sendMessage(fromAgentId, toAgentId, message);
  }

  /**
   * Broadcast a message to all agents in a session
   */
  async broadcastMessage(
    sessionId: string,
    fromAgentId: string,
    message: Partial<AgentMessage>
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const agentIds = session.config.agents.map((a) => a.agentId).filter((id) => id !== fromAgentId);

    await Promise.all(
      agentIds.map((toAgentId) =>
        this.invocationManager.sendMessage(fromAgentId, toAgentId, message)
      )
    );
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): ConcurrentSessionStatus | undefined {
    const session = this.sessions.get(sessionId);
    return session?.status;
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): ConcurrentSessionStatus[] {
    return Array.from(this.sessions.values()).map((session) => session.status);
  }

  /**
   * Wait for session to complete
   */
  async waitForSession(sessionId: string): Promise<Map<string, AgentInvocationResult>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Poll until session is complete
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const currentSession = this.sessions.get(sessionId);
        if (!currentSession) {
          clearInterval(checkInterval);
          reject(new Error(`Session ${sessionId} was terminated`));
          return;
        }

        if (currentSession.status.status !== 'active') {
          clearInterval(checkInterval);

          if (currentSession.status.status === 'completed') {
            resolve(currentSession.status.results);
          } else {
            reject(new Error(`Session ${sessionId} ${currentSession.status.status}`));
          }
        }
      }, 100);
    });
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.logger.info('ConcurrentSession', `Terminating session ${sessionId}`);

    // Clear timeout
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    // Terminate all active agents
    await Promise.all(
      session.status.activeAgents.map((agentId) => this.invocationManager.terminateAgent(agentId))
    );

    // Unsubscribe from all messages
    session.messageSubscriptions.forEach((unsubscribe) => unsubscribe());
    session.messageSubscriptions.clear();

    // Update status
    session.status.status = 'failed';
    session.status.failedAgents.push(...session.status.activeAgents);
    session.status.activeAgents = [];

    // Remove session
    this.sessions.delete(sessionId);
  }

  /**
   * Clean up all sessions
   */
  async cleanup(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map((id) => this.terminateSession(id)));
  }
}
