import { MessageBus } from './message-bus';
import { AgentRegistry } from './agent-registry';
import { SharedContextManager } from './shared-context';
import { WorkflowEngine } from './workflow-engine';
import { AgentRole } from './agent-definition-schema';
import { AgentMessage } from './types';

/**
 * Help Request Protocol
 * Handles routing help requests between agents based on canRequestHelpFrom permissions
 */
export class HelpRequestProtocol {
  private pendingRequests = new Map<
    string,
    {
      requestId: string;
      requesterId: string;
      helperId: string;
      timestamp: Date;
      acknowledged: boolean;
    }
  >();

  constructor(
    private messageBus: MessageBus,
    private agentRegistry: AgentRegistry
  ) {}

  /**
   * Send a help request from one agent to another
   */
  async requestHelp(
    requesterId: string,
    targetRole: AgentRole,
    problem: string,
    context: {
      currentTask?: string;
      attemptedSolutions?: string[];
      relevantFiles?: string[];
    },
    urgency: 'critical' | 'high' | 'normal' | 'low' = 'normal'
  ): Promise<{ success: boolean; helperId?: string; error?: string }> {
    // Verify requester exists
    const requester = this.agentRegistry.getAgent(requesterId);
    if (!requester) {
      return { success: false, error: `Agent ${requesterId} not found` };
    }

    // Check if requester can request help from target role
    if (!this.agentRegistry.canRequestHelpFrom(requesterId, targetRole)) {
      return {
        success: false,
        error: `Agent ${requester.role} cannot request help from ${targetRole}`,
      };
    }

    // Find an available agent with the target role
    const helpers = this.agentRegistry.getAgentsByRole(targetRole);
    const availableHelper = helpers.find((agent) => agent.status === 'idle');

    if (!availableHelper) {
      return {
        success: false,
        error: `No available agent with role ${targetRole}`,
      };
    }

    // Create help request message
    const requestId = `help-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const message: AgentMessage = {
      id: requestId,
      from: requesterId,
      to: availableHelper.id,
      type: 'request',
      priority: urgency,
      payload: {
        action: 'request-help',
        context: {
          problem,
          currentTask: context.currentTask,
          attemptedSolutions: context.attemptedSolutions || [],
          relevantFiles: context.relevantFiles || [],
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    // Track pending request
    this.pendingRequests.set(requestId, {
      requestId,
      requesterId,
      helperId: availableHelper.id,
      timestamp: new Date(),
      acknowledged: false,
    });

    // Send message
    await this.messageBus.send(message);

    // Set up acknowledgment timeout (30 seconds)
    setTimeout(() => {
      this.checkAcknowledgment(requestId);
    }, 30000);

    return { success: true, helperId: availableHelper.id };
  }

  /**
   * Acknowledge a help request
   */
  async acknowledgeHelpRequest(
    helperId: string,
    requestId: string,
    response: {
      canHelp: boolean;
      estimatedTime?: number;
      message?: string;
    }
  ): Promise<void> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Help request ${requestId} not found`);
    }

    if (request.helperId !== helperId) {
      throw new Error(`Agent ${helperId} is not the assigned helper for request ${requestId}`);
    }

    // Mark as acknowledged
    request.acknowledged = true;

    // Send acknowledgment message back to requester
    const ackMessage: AgentMessage = {
      id: `ack-${requestId}`,
      from: helperId,
      to: request.requesterId,
      type: 'response',
      priority: 'normal',
      inReplyTo: requestId,
      payload: {
        action: 'help-acknowledgment',
        context: response,
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    await this.messageBus.send(ackMessage);
  }

  /**
   * Check if a help request was acknowledged within timeout
   */
  private checkAcknowledgment(requestId: string): void {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      return;
    }

    if (!request.acknowledged) {
      console.warn(
        `Help request ${requestId} was not acknowledged within 30 seconds by agent ${request.helperId}`
      );
      // Could trigger automatic escalation here
    }
  }

  /**
   * Get pending help requests for an agent
   */
  getPendingRequests(agentId: string): Array<{
    requestId: string;
    requesterId: string;
    timestamp: Date;
    acknowledged: boolean;
  }> {
    const requests: Array<{
      requestId: string;
      requesterId: string;
      timestamp: Date;
      acknowledged: boolean;
    }> = [];

    for (const request of this.pendingRequests.values()) {
      if (request.helperId === agentId) {
        requests.push({
          requestId: request.requestId,
          requesterId: request.requesterId,
          timestamp: request.timestamp,
          acknowledged: request.acknowledged,
        });
      }
    }

    return requests;
  }

  /**
   * Clear all pending requests (for testing)
   */
  clear(): void {
    this.pendingRequests.clear();
  }
}

/**
 * Escalation Protocol
 * Handles escalating issues to tech lead or parent agent
 */
export class EscalationProtocol {
  private escalations = new Map<
    string,
    {
      escalationId: string;
      agentId: string;
      issue: string;
      timestamp: Date;
      blockedSince: Date;
      resolved: boolean;
    }
  >();

  constructor(
    private messageBus: MessageBus,
    private agentRegistry: AgentRegistry
  ) {}

  /**
   * Escalate an issue to tech lead
   */
  async escalateToTechLead(
    agentId: string,
    issue: string,
    context: {
      taskId?: string;
      conflictingFiles?: string[];
      attemptedSolutions?: string[];
      blockedSince?: Date;
      impactedTasks?: string[];
    },
    priority: 'critical' | 'high' | 'normal' = 'high'
  ): Promise<{ success: boolean; techLeadId?: string; error?: string }> {
    // Verify agent exists
    const agent = this.agentRegistry.getAgent(agentId);
    if (!agent) {
      return { success: false, error: `Agent ${agentId} not found` };
    }

    // Find an available tech lead
    const techLeads = this.agentRegistry.getAgentsByRole(AgentRole.TECH_LEAD);
    const availableTechLead = techLeads.find((tl) => tl.status !== 'offline');

    if (!availableTechLead) {
      return { success: false, error: 'No available tech lead' };
    }

    // Create escalation
    const escalationId = `escalation-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const escalation = {
      escalationId,
      agentId,
      issue,
      timestamp: new Date(),
      blockedSince: context.blockedSince || new Date(),
      resolved: false,
    };

    this.escalations.set(escalationId, escalation);

    // Create escalation message
    const message: AgentMessage = {
      id: escalationId,
      from: agentId,
      to: availableTechLead.id,
      type: 'escalation',
      priority,
      payload: {
        action: 'escalate-issue',
        context: {
          issue,
          taskId: context.taskId,
          conflictingFiles: context.conflictingFiles || [],
          attemptedSolutions: context.attemptedSolutions || [],
          blockedSince: context.blockedSince || new Date(),
          impactedTasks: context.impactedTasks || [],
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    // Send message
    await this.messageBus.send(message);

    // Set up acknowledgment timeout (30 seconds)
    setTimeout(() => {
      this.checkEscalationAcknowledgment(escalationId);
    }, 30000);

    return { success: true, techLeadId: availableTechLead.id };
  }

  /**
   * Escalate to parent agent after 5 minutes of being blocked
   */
  async escalateToParent(
    agentId: string,
    issue: string,
    context: {
      taskId?: string;
      blockedSince: Date;
      techLeadNotified: boolean;
      resolution?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    // Check if blocked for more than 5 minutes
    const blockedDuration = Date.now() - context.blockedSince.getTime();
    if (blockedDuration < 5 * 60 * 1000) {
      return {
        success: false,
        error: 'Must be blocked for at least 5 minutes before escalating to parent',
      };
    }

    // Create parent escalation message
    const escalationId = `parent-escalation-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const message: AgentMessage = {
      id: escalationId,
      from: agentId,
      to: 'parent-agent',
      type: 'escalation',
      priority: 'critical',
      payload: {
        action: 'escalate-to-parent',
        context: {
          issue,
          taskId: context.taskId,
          blockedSince: context.blockedSince,
          blockedDuration: Math.floor(blockedDuration / 1000), // in seconds
          techLeadNotified: context.techLeadNotified,
          resolution: context.resolution,
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    await this.messageBus.send(message);

    return { success: true };
  }

  /**
   * Resolve an escalation
   */
  resolveEscalation(escalationId: string, resolution: string): void {
    const escalation = this.escalations.get(escalationId);
    if (!escalation) {
      throw new Error(`Escalation ${escalationId} not found`);
    }

    escalation.resolved = true;

    // Could send resolution message back to agent here
  }

  /**
   * Check if escalation was acknowledged
   */
  private checkEscalationAcknowledgment(escalationId: string): void {
    const escalation = this.escalations.get(escalationId);
    if (!escalation) {
      return;
    }

    if (!escalation.resolved) {
      console.warn(
        `Escalation ${escalationId} from agent ${escalation.agentId} was not acknowledged within 30 seconds`
      );
    }
  }

  /**
   * Get all escalations for an agent
   */
  getEscalations(agentId: string): Array<{
    escalationId: string;
    issue: string;
    timestamp: Date;
    resolved: boolean;
  }> {
    const result: Array<{
      escalationId: string;
      issue: string;
      timestamp: Date;
      resolved: boolean;
    }> = [];

    for (const escalation of this.escalations.values()) {
      if (escalation.agentId === agentId) {
        result.push({
          escalationId: escalation.escalationId,
          issue: escalation.issue,
          timestamp: escalation.timestamp,
          resolved: escalation.resolved,
        });
      }
    }

    return result;
  }

  /**
   * Clear all escalations (for testing)
   */
  clear(): void {
    this.escalations.clear();
  }
}

/**
 * Work Completion Protocol
 * Handles work completion notifications with artifacts and metrics
 */
export class WorkCompletionProtocol {
  constructor(
    private messageBus: MessageBus,
    private agentRegistry: AgentRegistry,
    private sharedContext: SharedContextManager
  ) {}

  /**
   * Notify work completion
   */
  async notifyWorkComplete(
    agentId: string,
    taskId: string,
    artifacts: string[],
    metrics: {
      timeSpent: number; // seconds
      linesAdded?: number;
      linesDeleted?: number;
      testsAdded?: number;
    },
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    // Verify agent exists
    const agent = this.agentRegistry.getAgent(agentId);
    if (!agent) {
      return { success: false, error: `Agent ${agentId} not found` };
    }

    // Update work item in shared context
    const workItem = this.sharedContext.getWorkItem(taskId);
    if (!workItem) {
      return { success: false, error: `Work item ${taskId} not found` };
    }

    this.sharedContext.updateWorkItem(taskId, {
      status: 'complete',
      completedAt: new Date(),
      timeSpent: metrics.timeSpent,
      artifacts,
    });

    // Find tech lead to notify
    const techLeads = this.agentRegistry.getAgentsByRole(AgentRole.TECH_LEAD);
    const availableTechLead = techLeads.find((tl) => tl.status !== 'offline');

    if (!availableTechLead) {
      return { success: false, error: 'No available tech lead to notify' };
    }

    // Create completion notification
    const message: AgentMessage = {
      id: `completion-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      from: agentId,
      to: availableTechLead.id,
      type: 'notification',
      priority: 'normal',
      payload: {
        action: 'work-complete',
        context: {
          taskId,
          artifacts,
          metrics,
          notes,
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    await this.messageBus.send(message);

    // Update agent status
    this.agentRegistry.updateStatus(agentId, 'idle');

    return { success: true };
  }
}

/**
 * Automatic Notification System
 * Sends automatic notifications based on workflow events
 */
export class AutomaticNotificationSystem {
  constructor(
    private messageBus: MessageBus,
    private agentRegistry: AgentRegistry,
    private workflowEngine: WorkflowEngine
  ) {
    this.setupNotificationRules();
  }

  /**
   * Set up automatic notification rules
   */
  private setupNotificationRules(): void {
    // Notify Data Architect on schema change requests
    this.workflowEngine.registerRule({
      id: 'notify-data-architect-schema-change',
      trigger: 'schema-change-request',
      action: 'review-schema-change',
      target: AgentRole.DATA_ARCHITECT,
      payload: {},
      priority: 85,
    });

    // Notify DevOps on deployment-related events
    this.workflowEngine.registerRule({
      id: 'notify-devops-deployment',
      trigger: 'deployment-ready',
      action: 'prepare-deployment',
      target: AgentRole.DEVOPS,
      payload: {},
      priority: 80,
    });

    // Notify QA on feature completion
    this.workflowEngine.registerRule({
      id: 'notify-qa-feature-complete',
      trigger: 'feature-complete',
      action: 'test-feature',
      target: AgentRole.QA_ENGINEER,
      payload: {},
      priority: 80,
    });

    // Notify Tech Lead on critical events
    this.workflowEngine.registerRule({
      id: 'notify-tech-lead-critical',
      trigger: 'critical-issue',
      action: 'handle-critical-issue',
      target: AgentRole.TECH_LEAD,
      payload: {},
      priority: 95,
    });
  }

  /**
   * Send notification to specific agent role
   */
  async notifyRole(
    role: AgentRole,
    event: string,
    context: Record<string, unknown>,
    priority: 'critical' | 'high' | 'normal' | 'low' = 'normal'
  ): Promise<{ success: boolean; notifiedAgents: string[]; error?: string }> {
    // Find agents with the target role
    const agents = this.agentRegistry.getAgentsByRole(role);
    const availableAgents = agents.filter((agent) => agent.status !== 'offline');

    if (availableAgents.length === 0) {
      return {
        success: false,
        notifiedAgents: [],
        error: `No available agents with role ${role}`,
      };
    }

    const notifiedAgents: string[] = [];

    // Send notification to all available agents with this role
    for (const agent of availableAgents) {
      const message: AgentMessage = {
        id: `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        from: 'notification-system',
        to: agent.id,
        type: 'notification',
        priority,
        payload: {
          action: event,
          context,
        },
        timestamp: new Date(),
        acknowledged: false,
      };

      await this.messageBus.send(message);
      notifiedAgents.push(agent.id);
    }

    return { success: true, notifiedAgents };
  }

  /**
   * Broadcast notification to all agents
   */
  async broadcast(
    event: string,
    context: Record<string, unknown>,
    priority: 'critical' | 'high' | 'normal' | 'low' = 'normal'
  ): Promise<{ success: boolean; notifiedAgents: string[] }> {
    const allAgents = this.agentRegistry.getAllAgents();
    const availableAgents = allAgents.filter((agent) => agent.status !== 'offline');

    const notifiedAgents: string[] = [];

    for (const agent of availableAgents) {
      const message: AgentMessage = {
        id: `broadcast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        from: 'notification-system',
        to: agent.id,
        type: 'notification',
        priority,
        payload: {
          action: event,
          context,
        },
        timestamp: new Date(),
        acknowledged: false,
      };

      await this.messageBus.send(message);
      notifiedAgents.push(agent.id);
    }

    return { success: true, notifiedAgents };
  }
}

/**
 * Communication Protocols Manager
 * Unified interface for all communication protocols
 */
export class CommunicationProtocolsManager {
  public helpRequest: HelpRequestProtocol;
  public escalation: EscalationProtocol;
  public workCompletion: WorkCompletionProtocol;
  public notifications: AutomaticNotificationSystem;

  constructor(
    messageBus: MessageBus,
    agentRegistry: AgentRegistry,
    sharedContext: SharedContextManager,
    workflowEngine: WorkflowEngine
  ) {
    this.helpRequest = new HelpRequestProtocol(messageBus, agentRegistry);
    this.escalation = new EscalationProtocol(messageBus, agentRegistry);
    this.workCompletion = new WorkCompletionProtocol(messageBus, agentRegistry, sharedContext);
    this.notifications = new AutomaticNotificationSystem(messageBus, agentRegistry, workflowEngine);
  }

  /**
   * Clear all protocol state (for testing)
   */
  clear(): void {
    this.helpRequest.clear();
    this.escalation.clear();
  }
}
