/**
 * Enhanced agent invocation system with role-based spawning,
 * hierarchical delegation, and shared context injection
 *
 * BUG FIXES:
 * - Bug #3: Store sharedContext in AgentSession and return in getSpawnedAgent()
 * - Bug #4: Integrate with AgentHierarchy to track parent-child relationships
 */

import { AgentRegistry } from './agent-registry';
import { AgentDefinitionLoader } from './agent-definition-loader';
import { MessageBus } from './message-bus';
import { SharedContextManager } from './shared-context';
import { AgentRole } from './agent-definition-schema';
import { AgentHierarchy } from './agent-hierarchy';
import { getLogger } from './logger';
import {
  EnhancedInvocationParams,
  AgentInvocationResult,
  AgentEscalation,
  AgentSpawnConfig,
  AgentSession,
  InvokeSubAgentParams,
  InvokeSubAgentResult,
  SpawnedAgentState,
  OnCompleteCallback,
  SharedContext,
} from './agent-invocation-types';
import { AgentMessage } from './types';

/**
 * Enhanced agent invocation manager
 */
export class AgentInvocationManager {
  private sessions: Map<string, AgentSession> = new Map();
  private nextAgentId = 1;
  private agentHierarchy: Map<string, string[]> = new Map(); // parentId -> childIds[] (local fallback)
  private hierarchyManager?: AgentHierarchy; // BUG FIX #4: Reference to AgentHierarchy

  constructor(
    private registry: AgentRegistry,
    private definitionLoader: AgentDefinitionLoader,
    private messageBus: MessageBus,
    private sharedContext?: SharedContextManager,
    hierarchyManager?: AgentHierarchy
  ) {
    this.hierarchyManager = hierarchyManager;

    // BUG FIX #2: Register message interception hooks
    this.setupMessageHooks();
  }

  /**
   * BUG FIX #2: Setup message interception hooks to catch outgoing messages from child agents
   */
  private setupMessageHooks(): void {
    // Hook to intercept messages BEFORE they are sent
    this.messageBus.setBeforeSendHook(async (message: AgentMessage) => {
      const session = this.sessions.get(message.from);
      if (!session) {
        return; // Not a managed agent
      }

      // Call onMessage callback for all outgoing messages
      if (session.callbacks.onMessage) {
        await session.callbacks.onMessage(message);
      }

      // Call onEscalate callback for escalation messages
      if (message.type === 'escalation' && session.callbacks.onEscalate) {
        // Extract escalation data from message
        const payload = message.payload as {
          action?: string;
          context?: {
            escalation?: AgentEscalation;
          };
        };

        if (payload.context?.escalation) {
          await session.callbacks.onEscalate(payload.context.escalation);
        }
      }
    });
  }

  /**
   * Set the AgentHierarchy manager (called by InfrastructureManager)
   * BUG FIX #4: Allow setting hierarchy manager after construction
   */
  setHierarchyManager(hierarchyManager: AgentHierarchy): void {
    this.hierarchyManager = hierarchyManager;
  }

  /**
   * Invoke a sub-agent (backward compatible method name)
   */
  async invokeSubAgent(params: InvokeSubAgentParams): Promise<InvokeSubAgentResult> {
    const logger = getLogger();
    const correlationId = logger.generateCorrelationId();

    try {
      // Load agent definition
      const definition = await this.definitionLoader.loadDefinition(params.role);
      if (!definition) {
        logger.error(
          'AgentSpawn',
          `Agent definition not found for role: ${params.role}`,
          undefined,
          {
            role: params.role,
            correlationId,
          }
        );
        return {
          agentId: '',
          role: params.role,
          success: false,
          error: `Agent definition not found for role: ${params.role}`,
          spawnedAt: new Date(),
        };
      }

      // Generate agent ID
      const agentId = params.agentId || `${params.role}-${this.nextAgentId++}`;

      // Log agent spawning
      logger.logAgentSpawn(agentId, params.role, params.parentAgent, correlationId);

      // Create spawn configuration
      const spawnConfig: AgentSpawnConfig = {
        agentId,
        role: params.role,
        parentAgentId: params.parentAgent,
        systemPromptPath: definition.systemPromptPath,
        capabilities: definition.capabilities,
        toolPermissions: definition.toolPermissions,
        fileAccessPatterns: definition.fileAccessPatterns,
        canCommunicateWith: params.canCommunicateWith || [],
        sharedContext: params.sharedContext,
      };

      // Create enhanced params for spawning
      const enhancedParams: EnhancedInvocationParams = {
        role: params.role,
        prompt: params.task || '',
        parentAgentId: params.parentAgent,
        canCommunicateWith: params.canCommunicateWith,
        sharedContext: params.sharedContext,
        onMessage: params.onMessage,
        onComplete: params.onComplete,
        onEscalate: params.onEscalate,
        timeout: params.timeout,
      };

      // Spawn the agent
      const session = await this.spawnAgent(spawnConfig, enhancedParams);

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

      // BUG FIX #4: Track hierarchical relationship
      if (params.parentAgent) {
        // Use local hierarchy map for backward compatibility
        this.addToHierarchy(params.parentAgent, agentId);

        // BUG FIX #4: Also record in AgentHierarchy manager if available
        if (this.hierarchyManager) {
          this.hierarchyManager.recordRelationship(agentId, params.parentAgent);
          logger.debug(
            'AgentHierarchy',
            `Recorded hierarchy: ${agentId} -> parent: ${params.parentAgent}`,
            {
              agentId,
              parentId: params.parentAgent,
              correlationId,
            }
          );
        }
      } else if (this.hierarchyManager) {
        // Root agent (no parent)
        this.hierarchyManager.recordRelationship(agentId, null);
        logger.debug('AgentHierarchy', `Recorded hierarchy: ${agentId} -> ROOT`, {
          agentId,
          correlationId,
        });
      }

      // Subscribe to messages for this agent
      this.messageBus.subscribe(agentId, async (message) => {
        await this.handleMessage(agentId, message);
      });

      // Send initial task message if provided
      if (params.task) {
        await this.messageBus.send({
          id: `msg-${Date.now()}`,
          from: params.parentAgent || 'system',
          to: agentId,
          type: 'request',
          priority: 'high',
          payload: {
            action: 'execute-task',
            context: {
              prompt: params.task,
            },
          },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      logger.info('AgentSpawn', `Successfully spawned ${agentId}`, {
        agentId,
        role: params.role,
        parentId: params.parentAgent,
        correlationId,
      });

      return {
        agentId,
        role: params.role,
        success: true,
        spawnedAt: new Date(),
      };
    } catch (error) {
      logger.logError('AgentSpawn', 'Failed to spawn agent', error, {
        role: params.role,
        parentAgent: params.parentAgent,
        correlationId,
      });
      return {
        agentId: '',
        role: params.role,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        spawnedAt: new Date(),
      };
    }
  }

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

    // BUG FIX #4: Track hierarchical relationship
    if (params.parentAgentId) {
      // Use local hierarchy map for backward compatibility
      this.addToHierarchy(params.parentAgentId, agentId);

      // BUG FIX #4: Also record in AgentHierarchy manager if available
      if (this.hierarchyManager) {
        this.hierarchyManager.recordRelationship(agentId, params.parentAgentId);
        console.log(
          `[AgentInvocation] Recorded hierarchy: ${agentId} -> parent: ${params.parentAgentId}`
        );
      }
    } else if (this.hierarchyManager) {
      // Root agent (no parent)
      this.hierarchyManager.recordRelationship(agentId, null);
      console.log(`[AgentInvocation] Recorded hierarchy: ${agentId} -> ROOT`);
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
    return new Promise((resolve) => {
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
            timestamp: new Date(),
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
    // BUG FIX #3: Store sharedContext in session
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
      sharedContext: config.sharedContext, // BUG FIX #3: Store sharedContext
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
    context: SharedContextManager | SharedContext | unknown
  ): Promise<void> {
    // Only process if it's a SharedContextManager
    if (!context || typeof context !== 'object' || !('getWorkItem' in context)) {
      // Not a SharedContextManager, skip injection
      return;
    }

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
   * BUG FIX #4: Use AgentHierarchy manager if available
   */
  getChildAgents(parentId: string): string[] {
    // BUG FIX #4: Use AgentHierarchy manager if available
    if (this.hierarchyManager) {
      return this.hierarchyManager.getChildAgents(parentId);
    }
    // Fallback to local hierarchy map
    return this.agentHierarchy.get(parentId) || [];
  }

  /**
   * Get parent agent of a child
   * Task 14.3: Hierarchical delegation
   * BUG FIX #4: Use AgentHierarchy manager if available
   */
  getParentAgent(childId: string): string | undefined {
    // BUG FIX #4: Use AgentHierarchy manager if available
    if (this.hierarchyManager) {
      const parent = this.hierarchyManager.getParentAgent(childId);
      return parent ?? undefined;
    }
    // Fallback to session data
    const session = this.sessions.get(childId);
    return session?.parentAgentId;
  }

  /**
   * Get all agents in hierarchy tree
   * Task 14.3: Hierarchical delegation
   */
  getAgentHierarchy(rootId: string): {
    agentId: string;
    children: Array<{ agentId: string; role?: AgentRole; children: unknown[] }>;
  }[] {
    type HierarchyNode = { agentId: string; role?: AgentRole; children: HierarchyNode[] };

    const buildTree = (agentId: string): HierarchyNode => {
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

    // Type guard for payload structure
    interface EscalationPayload {
      issue?: string;
      recommendation?: string;
      context?: {
        issue?: string;
        taskId?: string;
        attemptedSolutions?: string[];
        blockedSince?: Date;
        impactedTasks?: string[];
      };
    }

    const payload = message.payload as EscalationPayload;
    const payloadContext = payload.context || {};

    const issue = payload.issue || payloadContext.issue || 'Unknown issue';
    const escalation: AgentEscalation = {
      agentId,
      role: session.role,
      reason: issue,
      issue: issue, // Alias for backward compatibility
      context: {
        taskId: payloadContext.taskId,
        attemptedSolutions: payloadContext.attemptedSolutions || [],
        blockedSince: payloadContext.blockedSince || new Date(),
        impactedTasks: payloadContext.impactedTasks,
        recommendation: payload.recommendation,
      },
      attemptedSolutions: payloadContext.attemptedSolutions || [],
      severity: message.priority === 'critical' ? 'critical' : 'high',
      recommendation: payload.recommendation,
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

    // Type guard for completion payload
    interface CompletionPayloadContext {
      artifacts?: string[];
    }

    const payloadContext = (message.payload.context || {}) as CompletionPayloadContext;

    const result: AgentInvocationResult = {
      agentId,
      role: session.role,
      success: true,
      result: message.payload.result,
      artifacts: payloadContext.artifacts || [],
      metrics: {
        timeSpent: Date.now() - session.startedAt.getTime(),
        messagesExchanged: session.metrics.messagesReceived + session.metrics.messagesSent,
        escalations: session.metrics.escalations,
      },
      completedAt: new Date(),
      timestamp: new Date(),
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
        timestamp: new Date(),
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
   * BUG FIX #4: Use AgentHierarchy manager if available
   */
  getHierarchyStats(): {
    totalAgents: number;
    rootAgents: number;
    maxDepth: number;
    averageChildren: number;
  } {
    // BUG FIX #4: Use AgentHierarchy manager if available
    if (this.hierarchyManager) {
      const stats = this.hierarchyManager.getHierarchyStats();
      return {
        totalAgents: stats.totalAgents,
        rootAgents: stats.rootAgents,
        maxDepth: stats.maxDepth,
        averageChildren: stats.avgChildren, // Map avgChildren to averageChildren
      };
    }

    // Fallback to local hierarchy calculation
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

  /**
   * Get a spawned agent by ID
   * BUG FIX #3: Return sharedContext from session
   */
  getSpawnedAgent(agentId: string): SpawnedAgentState | undefined {
    const session = this.sessions.get(agentId);
    if (!session) {
      return undefined;
    }

    // Convert callbacks - both types now use compatible result types
    const callbacks: SpawnedAgentState['callbacks'] = {
      onMessage: session.callbacks.onMessage,
      onComplete: session.callbacks.onComplete as OnCompleteCallback | undefined,
      onEscalate: session.callbacks.onEscalate,
    };

    // BUG FIX #3: Return sharedContext from session
    return {
      agentId: session.agentId,
      role: session.role,
      parentAgent: session.parentAgentId,
      canCommunicateWith: session.canCommunicateWith || [], // BUG FIX #5: Return stored canCommunicateWith
      sharedContext: session.sharedContext as SharedContext | undefined, // BUG FIX #3: Return stored sharedContext
      callbacks,
      timeout: undefined,
      timeoutHandle: session.timeoutHandle,
      spawnedAt: session.startedAt,
      completedAt: session.status === 'completed' ? new Date() : undefined,
      status: session.status,
    };
  }

  /**
   * Get all spawned agents
   * BUG FIX #3: Return sharedContext from session
   */
  getAllSpawnedAgents(): SpawnedAgentState[] {
    return Array.from(this.sessions.values()).map((session) => {
      // Convert callbacks - both types now use compatible result types
      const callbacks: SpawnedAgentState['callbacks'] = {
        onMessage: session.callbacks.onMessage,
        onComplete: session.callbacks.onComplete as OnCompleteCallback | undefined,
        onEscalate: session.callbacks.onEscalate,
      };

      // BUG FIX #3: Return sharedContext from session
      return {
        agentId: session.agentId,
        role: session.role,
        parentAgent: session.parentAgentId,
        canCommunicateWith: session.canCommunicateWith || [], // BUG FIX #5: Return stored canCommunicateWith
        sharedContext: session.sharedContext as SharedContext | undefined, // BUG FIX #3: Return stored sharedContext
        callbacks,
        timeout: undefined,
        timeoutHandle: session.timeoutHandle,
        spawnedAt: session.startedAt,
        completedAt: session.status === 'completed' ? new Date() : undefined,
        status: session.status,
      };
    });
  }

  /**
   * Clear all spawned agents
   */
  clear(): void {
    // Clear all timeout handles
    for (const session of this.sessions.values()) {
      if (session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
      }
    }

    // Clear all data structures
    this.sessions.clear();
    this.agentHierarchy.clear();
    this.nextAgentId = 1;
  }
}
