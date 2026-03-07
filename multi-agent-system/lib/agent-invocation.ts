/**
 * Enhanced agent invocation system with role-based spawning,
 * hierarchical delegation, and shared context injection
 */

import { AgentRegistry } from './agent-registry';
import { AgentDefinitionLoader } from './agent-definition-loader';
import { MessageBus } from './message-bus';
import { SharedContextManager } from './shared-context';
import { AgentRole } from './agent-definition-schema';
import {
  EnhancedInvocationParams,
  AgentInvocationResult,
  AgentEscalation,
  AgentSpawnConfig,
  AgentSession,
} from './agent-invocation-types';
import { AgentMessage } from './types';

/**
 * Enhanced agent invocation manager
 */
export class AgentInvocationManager {
  private sessions: Map<string, AgentSession> = new Map();
  private nextAgentId = 1;
  private agentHierarchy: Map<string, string[]> = new Map(); // parentId -> childIds[]

  constructor(
    private registry: AgentRegistry,
    private definitionLoader: AgentDefinitionLoader,
    private messageBus: MessageBus,
    private sharedContext?: SharedContextManager
  ) {}

  /**
   * Invoke a sub-agent with enhanced capabilities
   */
  async invokeAgent(params: EnhancedInvocationParams): Promise<AgentInvocationResult> {
    // Load agent definition
    const definition = await this.definitionLoader.loadDefinition(params.role);
    if (!definition) {
      throw new Error(`Agent definition not found for role: ${params.role}`);
    }

    // Generate agent ID
    const agentId = `${params.role}-${this.nextAgentId++}`;

    // Create spawn configuration
    const spawnConfig: AgentSpawnConfig = {
      agentId,
      role: params.role,
      parentAgentId: params.parentAgentId,
      systemPromptPath: definition.systemPromptPath,
      capabilities: definition.capabilities,
      toolPermissions: definition.toolPermissions,
      fileAccessPatterns: definition.fileAccessPatterns,
      canCommunicateWith: params.canCommunicateWith || [],
      sharedContext: params.sharedContext || this.sharedContext,
    };

    // Spawn the agent
    const session = await this.spawnAgent(spawnConfig, params);

    // Set up timeout if specified
    if (params.timeout) {
      session.timeoutHandle = setTimeout(() => {
        this.handleTimeout(agentId);
      }, params.timeout);
    }

    // Register agent in registry
    this.registry.registerAgent({
      id: agentId,
      role: params.role,
      status: 'busy',
      capabilities: definition.capabilities,
      canRequestHelpFrom: definition.canRequestHelpFrom,
      workload: 1,
    });

    // Task 14.3: Track hierarchical relationship
    if (params.parentAgentId) {
      this.addToHierarchy(params.parentAgentId, agentId);
    }

    // Subscribe to messages for this agent
    this.messageBus.subscribe(agentId, async (message) => {
      await this.handleMessage(agentId, message);
    });

    // Send initial task message
    await this.messageBus.send({
      id: `msg-${Date.now()}`,
      from: params.parentAgentId || 'system',
      to: agentId,
      type: 'request',
      priority: 'high',
      payload: {
        action: 'execute-task',
        context: {
          prompt: params.prompt,
          ...params.context,
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    });

    // Wait for completion (in real implementation, this would be async)
    // For now, return a promise that resolves when the agent completes
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const currentSession = this.sessions.get(agentId);
        if (currentSession?.status === 'completed' || currentSession?.status === 'failed') {
          clearInterval(checkInterval);
          if (currentSession.timeoutHandle) {
            clearTimeout(currentSession.timeoutHandle);
          }

          const result: AgentInvocationResult = {
            agentId,
            role: params.role,
            success: currentSession.status === 'completed',
            error: currentSession.status === 'failed' ? 'Agent failed' : undefined,
            metrics: {
              timeSpent: Date.now() - currentSession.startedAt.getTime(),
              messagesExchanged:
                currentSession.metrics.messagesReceived + currentSession.metrics.messagesSent,
              escalations: currentSession.metrics.escalations,
            },
            completedAt: new Date(),
          };

          resolve(result);
        }
      }, 100);
    });
  }

  /**
   * Spawn an agent with the given configuration
   */
  private async spawnAgent(
    config: AgentSpawnConfig,
    params: EnhancedInvocationParams
  ): Promise<AgentSession> {
    const session: AgentSession = {
      agentId: config.agentId!,
      role: config.role,
      parentAgentId: config.parentAgentId,
      startedAt: new Date(),
      status: 'active',
      callbacks: {
        onMessage: params.onMessage,
        onComplete: params.onComplete,
        onEscalate: params.onEscalate,
      },
      metrics: {
        messagesReceived: 0,
        messagesSent: 0,
        escalations: 0,
      },
    };

    this.sessions.set(config.agentId!, session);

    // Task 14.4: Inject shared context if provided
    if (config.sharedContext) {
      await this.injectSharedContext(config.agentId!, config.role, config.sharedContext);
    }

    // In a real implementation, this would:
    // 1. Load the system prompt from config.systemPromptPath
    // 2. Inject shared context into the agent's context
    // 3. Configure tool permissions
    // 4. Set up communication channels
    // 5. Actually spawn the agent process/thread

    return session;
  }

  /**
   * Inject shared context into agent with permission enforcement
   * Task 14.4: Shared context injection
   */
  private async injectSharedContext(
    agentId: string,
    role: AgentRole,
    contextManager: SharedContextManager
  ): Promise<void> {
    // Get agent definition to check capabilities
    const definition = await this.definitionLoader.loadDefinition(role);
    if (!definition) {
      throw new Error(`Agent definition not found for role: ${role}`);
    }

    // Validate context access permissions based on role capabilities
    const canReadContext = definition.capabilities.includes('read-shared-context');
    const canWriteContext = definition.capabilities.includes('write-shared-context');
    const canManageWorkItems = definition.capabilities.includes('manage-work-items');
    const canManageFileLocks = definition.capabilities.includes('manage-file-locks');

    if (!canReadContext) {
      console.warn(
        `[AgentInvocation] Agent ${agentId} (${role}) does not have read-shared-context capability`
      );
      return;
    }

    // In a real implementation, this would:
    // 1. Create a context proxy that enforces permissions
    // 2. Inject the proxy into the agent's execution environment
    // 3. Log all context access for auditing
    // 4. Throw errors if agent attempts unauthorized operations

    // For now, we just validate that the agent has the necessary permissions
    console.log(
      `[AgentInvocation] Injected shared context for agent ${agentId} (${role}) with permissions:`,
      {
        canRead: canReadContext,
        canWrite: canWriteContext,
        canManageWorkItems,
        canManageFileLocks,
      }
    );
  }

  /**
   * Add agent to hierarchy
   * Task 14.3: Hierarchical delegation
   */
  private addToHierarchy(parentId: string, childId: string): void {
    const children = this.agentHierarchy.get(parentId) || [];
    children.push(childId);
    this.agentHierarchy.set(parentId, children);
  }

  /**
   * Get child agents of a parent
   * Task 14.3: Hierarchical delegation
   */
  getChildAgents(parentId: string): string[] {
    return this.agentHierarchy.get(parentId) || [];
  }

  /**
   * Get parent agent of a child
   * Task 14.3: Hierarchical delegation
   */
  getParentAgent(childId: string): string | undefined {
    const session = this.sessions.get(childId);
    return session?.parentAgentId;
  }

  /**
   * Get all agents in hierarchy tree
   * Task 14.3: Hierarchical delegation
   */
  getAgentHierarchy(rootId: string): { agentId: string; children: any[] }[] {
    const buildTree = (agentId: string): any => {
      const children = this.getChildAgents(agentId);
      return {
        agentId,
        role: this.sessions.get(agentId)?.role,
        children: children.map((childId) => buildTree(childId)),
      };
    };

    return [buildTree(rootId)];
  }

  /**
   * Handle incoming message for an agent
   */
  private async handleMessage(agentId: string, message: AgentMessage): Promise<void> {
    const session = this.sessions.get(agentId);
    if (!session) {
      return;
    }

    session.metrics.messagesReceived++;

    // Update last activity
    const agent = this.registry.getAgent(agentId);
    if (agent) {
      this.registry.updateStatus(agentId, agent.status);
    }

    // Handle different message types
    switch (message.type) {
      case 'escalation':
        await this.handleEscalation(agentId, message);
        break;

      case 'notification':
        if (message.payload.action === 'work-complete') {
          await this.handleCompletion(agentId, message);
        }
        break;

      case 'response':
        // Call onMessage callback if provided
        if (session.callbacks.onMessage) {
          await session.callbacks.onMessage(message);
        }
        break;
    }

    // Message is automatically acknowledged by MessageBus
  }

  /**
   * Handle escalation from an agent
   * Task 14.3: Route escalations to parent agent automatically
   */
  private async handleEscalation(agentId: string, message: AgentMessage): Promise<void> {
    const session = this.sessions.get(agentId);
    if (!session) {
      return;
    }

    session.metrics.escalations++;

    const escalation: AgentEscalation = {
      agentId,
      role: session.role,
      reason: (message.payload.context as any)?.issue || 'Unknown issue',
      context: {
        taskId: (message.payload.context as any)?.taskId,
        attemptedSolutions: (message.payload.context as any)?.attemptedSolutions || [],
        blockedSince: (message.payload.context as any)?.blockedSince || new Date(),
        impactedTasks: (message.payload.context as any)?.impactedTasks,
      },
      attemptedSolutions: (message.payload.context as any)?.attemptedSolutions || [],
      severity: message.priority === 'critical' ? 'critical' : 'high',
      timestamp: new Date(),
    };

    // Call onEscalate callback if provided
    if (session.callbacks.onEscalate) {
      await session.callbacks.onEscalate(escalation);
    }

    // Task 14.3: Route escalation to parent agent automatically
    if (session.parentAgentId) {
      console.log(
        `[AgentInvocation] Routing escalation from ${agentId} to parent ${session.parentAgentId}`
      );

      await this.messageBus.send({
        id: `msg-${Date.now()}`,
        from: agentId,
        to: session.parentAgentId,
        type: 'escalation',
        priority: 'critical',
        payload: {
          action: 'escalation',
          context: {
            escalation,
            originalMessage: message,
          },
        },
        timestamp: new Date(),
        acknowledged: false,
      });

      // Update agent status to blocked
      this.registry.updateStatus(agentId, 'blocked');
    } else {
      // No parent agent, log warning
      console.warn(
        `[AgentInvocation] Agent ${agentId} escalated but has no parent agent to route to`
      );
    }
  }

  /**
   * Handle work completion from an agent
   */
  private async handleCompletion(agentId: string, message: AgentMessage): Promise<void> {
    const session = this.sessions.get(agentId);
    if (!session) {
      return;
    }

    session.status = 'completed';

    const result: AgentInvocationResult = {
      agentId,
      role: session.role,
      success: true,
      result: message.payload.result,
      artifacts: (message.payload.context as any)?.artifacts || [],
      metrics: {
        timeSpent: Date.now() - session.startedAt.getTime(),
        messagesExchanged: session.metrics.messagesReceived + session.metrics.messagesSent,
        escalations: session.metrics.escalations,
      },
      completedAt: new Date(),
    };

    // Call onComplete callback if provided
    if (session.callbacks.onComplete) {
      await session.callbacks.onComplete(result);
    }

    // Update agent status
    this.registry.updateStatus(agentId, 'idle');

    // Task 14.3: Clean up hierarchy
    if (session.parentAgentId) {
      this.removeFromHierarchy(session.parentAgentId, agentId);
    }
  }

  /**
   * Remove agent from hierarchy
   * Task 14.3: Hierarchical delegation
   */
  private removeFromHierarchy(parentId: string, childId: string): void {
    const children = this.agentHierarchy.get(parentId);
    if (children) {
      const filtered = children.filter((id) => id !== childId);
      if (filtered.length > 0) {
        this.agentHierarchy.set(parentId, filtered);
      } else {
        this.agentHierarchy.delete(parentId);
      }
    }
  }

  /**
   * Handle agent timeout
   */
  private handleTimeout(agentId: string): void {
    const session = this.sessions.get(agentId);
    if (!session) {
      return;
    }

    session.status = 'failed';

    // Update agent status
    this.registry.updateStatus(agentId, 'offline');

    // Task 14.3: Clean up hierarchy
    if (session.parentAgentId) {
      this.removeFromHierarchy(session.parentAgentId, agentId);
    }

    // Notify via callback
    if (session.callbacks.onComplete) {
      const result: AgentInvocationResult = {
        agentId,
        role: session.role,
        success: false,
        error: 'Agent timed out',
        metrics: {
          timeSpent: Date.now() - session.startedAt.getTime(),
          messagesExchanged: session.metrics.messagesReceived + session.metrics.messagesSent,
          escalations: session.metrics.escalations,
        },
        completedAt: new Date(),
      };

      session.callbacks.onComplete(result);
    }
  }

  /**
   * Send a message from one agent to another
   */
  async sendMessage(from: string, to: string, message: Partial<AgentMessage>): Promise<void> {
    const session = this.sessions.get(from);
    if (session) {
      session.metrics.messagesSent++;
    }

    await this.messageBus.send({
      id: `msg-${Date.now()}`,
      from,
      to,
      type: message.type || 'request',
      priority: message.priority || 'normal',
      payload: message.payload || {},
      timestamp: new Date(),
      acknowledged: false,
      threadId: message.threadId,
      parentMessageId: message.parentMessageId,
    });
  }

  /**
   * Get active session for an agent
   */
  getSession(agentId: string): AgentSession | undefined {
    return this.sessions.get(agentId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Terminate an agent session
   */
  async terminateAgent(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId);
    if (!session) {
      return;
    }

    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    session.status = 'failed';
    this.registry.updateStatus(agentId, 'offline');

    // Task 14.3: Clean up hierarchy and terminate children
    if (session.parentAgentId) {
      this.removeFromHierarchy(session.parentAgentId, agentId);
    }

    // Terminate all child agents recursively
    const children = this.getChildAgents(agentId);
    for (const childId of children) {
      await this.terminateAgent(childId);
    }

    this.sessions.delete(agentId);
  }

  /**
   * Validate context access for an agent
   * Task 14.4: Enforce permissions based on role
   */
  async validateContextAccess(agentId: string, operation: 'read' | 'write'): Promise<boolean> {
    const session = this.sessions.get(agentId);
    if (!session) {
      return false;
    }

    const definition = await this.definitionLoader.loadDefinition(session.role);
    if (!definition) {
      return false;
    }

    if (operation === 'read') {
      return definition.capabilities.includes('read-shared-context');
    } else if (operation === 'write') {
      return definition.capabilities.includes('write-shared-context');
    }

    return false;
  }

  /**
   * Get hierarchy statistics
   * Task 14.3: Hierarchical delegation
   */
  getHierarchyStats(): {
    totalAgents: number;
    rootAgents: number;
    maxDepth: number;
    averageChildren: number;
  } {
    const allAgents = Array.from(this.sessions.keys());
    const rootAgents = allAgents.filter((id) => !this.getParentAgent(id));

    const calculateDepth = (agentId: string, depth: number = 0): number => {
      const children = this.getChildAgents(agentId);
      if (children.length === 0) {
        return depth;
      }
      return Math.max(...children.map((childId) => calculateDepth(childId, depth + 1)));
    };

    const maxDepth =
      rootAgents.length > 0 ? Math.max(...rootAgents.map((id) => calculateDepth(id))) : 0;

    const totalChildren = Array.from(this.agentHierarchy.values()).reduce(
      (sum, children) => sum + children.length,
      0
    );
    const averageChildren =
      this.agentHierarchy.size > 0 ? totalChildren / this.agentHierarchy.size : 0;

    return {
      totalAgents: allAgents.length,
      rootAgents: rootAgents.length,
      maxDepth,
      averageChildren,
    };
  }
}
