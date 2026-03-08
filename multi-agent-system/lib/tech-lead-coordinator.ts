/**
 * Tech Lead Coordinator
 *
 * Implements the core coordination logic for the Tech Lead agent:
 * - Task analysis and agent selection
 * - Task assignment protocol
 * - Escalation handling
 * - Work review and approval
 * - Workload balancing
 *
 * Requirements: US-3.1, US-7.1, US-7.2, US-8.4
 */

import { AgentRegistry } from './agent-registry';
import { MessageBus } from './message-bus';
import { SharedContextManager } from './shared-context';
import { AgentRole } from './agent-definition-schema';
import type { AgentMessage } from './types';
import type { WorkItem } from './shared-context-types';
import type { QualityGateReport } from './quality-gates-types';

/**
 * Task assignment request
 */
export interface TaskAssignment {
  /** Unique task ID */
  taskId: string;

  /** Task title */
  title: string;

  /** Detailed description */
  description: string;

  /** Acceptance criteria */
  acceptanceCriteria: string[];

  /** Required capabilities */
  requiredCapabilities: string[];

  /** Priority level */
  priority: 'critical' | 'high' | 'normal' | 'low';

  /** Files involved */
  files?: string[];

  /** Dependencies (task IDs that must complete first) */
  dependencies?: string[];

  /** Estimated complexity (1-10) */
  complexity?: number;

  /** Deadline if applicable */
  deadline?: Date;
}

/**
 * Escalation request from an agent
 */
export interface EscalationRequest {
  /** Agent requesting escalation */
  agentId: string;

  /** Task being worked on */
  taskId: string;

  /** Reason for escalation */
  reason: string;

  /** What the agent has tried */
  attemptedSolutions: string[];

  /** How long agent has been blocked (milliseconds) */
  blockedDuration: number;

  /** Severity level */
  severity: 'critical' | 'high' | 'normal';

  /** Additional context */
  context?: unknown;
}

/**
 * Work review request
 */
export interface WorkReview {
  /** Work item to review */
  workItem: WorkItem;

  /** Agent who completed the work */
  agentId: string;

  /** Quality gate results */
  qualityGateResults?: QualityGateReport;
}

/**
 * Agent selection criteria
 */
interface AgentSelectionCriteria {
  /** Required role */
  role: AgentRole;

  /** Required capabilities */
  capabilities: string[];

  /** Prefer agents with lower workload */
  balanceWorkload: boolean;

  /** Only consider idle agents */
  idleOnly: boolean;
}

/**
 * Tech Lead Coordinator
 *
 * Orchestrates multi-agent collaboration by:
 * - Analyzing tasks and selecting appropriate agents
 * - Assigning work with clear acceptance criteria
 * - Handling escalations and blockers
 * - Reviewing completed work
 * - Balancing workload across agents
 */
export class TechLeadCoordinator {
  private registry: AgentRegistry;
  private messageBus: MessageBus;
  private sharedContext: SharedContextManager;
  private assignmentTimeouts: Map<string, NodeJS.Timeout>;
  private escalationAttempts: Map<string, number>;

  constructor(
    registry: AgentRegistry,
    messageBus: MessageBus,
    sharedContext: SharedContextManager
  ) {
    this.registry = registry;
    this.messageBus = messageBus;
    this.sharedContext = sharedContext;
    this.assignmentTimeouts = new Map();
    this.escalationAttempts = new Map();
  }

  /**
   * Analyze a task and determine which agent should handle it
   */
  analyzeTask(task: TaskAssignment): AgentRole {
    // Map task characteristics to agent roles
    const keywords = task.description.toLowerCase();

    // Performance → Performance Engineer (check before database)
    if (
      keywords.includes('performance') ||
      keywords.includes('optimization') ||
      keywords.includes('profiling') ||
      keywords.includes('load test')
    ) {
      return AgentRole.PERFORMANCE_ENGINEER;
    }

    // Database/schema changes → Data Architect
    if (
      keywords.includes('database') ||
      keywords.includes('schema') ||
      keywords.includes('migration') ||
      keywords.includes('query')
    ) {
      return AgentRole.DATA_ARCHITECT;
    }

    // Testing → QA Engineer
    if (
      keywords.includes('test') ||
      keywords.includes('qa') ||
      keywords.includes('verify') ||
      task.requiredCapabilities.includes('write-tests')
    ) {
      return AgentRole.QA_ENGINEER;
    }

    // Deployment/CI/CD → DevOps
    if (
      keywords.includes('deploy') ||
      keywords.includes('ci/cd') ||
      keywords.includes('pipeline') ||
      keywords.includes('infrastructure')
    ) {
      return AgentRole.DEVOPS;
    }

    // Security → Security Engineer
    if (
      keywords.includes('security') ||
      keywords.includes('vulnerability') ||
      keywords.includes('audit') ||
      keywords.includes('penetration')
    ) {
      return AgentRole.SECURITY_ENGINEER;
    }

    // UI/UX → UX/UI Designer
    if (
      keywords.includes('design') ||
      keywords.includes('ui') ||
      keywords.includes('ux') ||
      keywords.includes('component') ||
      keywords.includes('accessibility')
    ) {
      return AgentRole.UX_UI_DESIGNER;
    }

    // Documentation → Technical Writer
    if (
      keywords.includes('documentation') ||
      keywords.includes('docs') ||
      keywords.includes('guide') ||
      keywords.includes('tutorial')
    ) {
      return AgentRole.TECHNICAL_WRITER;
    }

    // Default to Developer for code implementation
    return AgentRole.DEVELOPER;
  }

  /**
   * Select the best agent for a task based on role, capabilities, and workload
   */
  selectAgent(criteria: AgentSelectionCriteria): string | null {
    // Get agents with the required role
    let candidates = this.registry.getAgentsByRole(criteria.role);

    // Filter by status if needed
    if (criteria.idleOnly) {
      candidates = candidates.filter((a) => a.status === 'idle');
    }

    // Filter by capabilities
    if (criteria.capabilities.length > 0) {
      candidates = candidates.filter((agent) =>
        criteria.capabilities.every((cap) => agent.capabilities.includes(cap))
      );
    }

    if (candidates.length === 0) {
      return null;
    }

    // If workload balancing is enabled, select least busy agent
    if (criteria.balanceWorkload) {
      candidates.sort((a, b) => a.workload - b.workload);
    }

    return candidates[0].id;
  }

  /**
   * Assign a task to an agent
   *
   * Returns the assigned agent ID or null if no suitable agent found
   */
  async assignWork(task: TaskAssignment): Promise<string | null> {
    // Analyze task to determine required role
    const requiredRole = this.analyzeTask(task);

    // Select best agent
    const agentId = this.selectAgent({
      role: requiredRole,
      capabilities: task.requiredCapabilities,
      balanceWorkload: true,
      idleOnly: false, // Can assign to busy agents if needed
    });

    if (!agentId) {
      console.warn(`No suitable agent found for task ${task.taskId}`);
      return null;
    }

    // Create work item in shared context
    const workItem: WorkItem = {
      id: task.taskId,
      title: task.title,
      assignedTo: agentId,
      status: 'in-progress',
      dependencies: [],
      artifacts: [],
      timeSpent: 0,
    };

    this.sharedContext.createWorkItem(workItem);

    // Send assignment message
    const message: AgentMessage = {
      id: `assign-${task.taskId}`,
      from: 'tech-lead',
      to: agentId,
      type: 'request',
      priority: task.priority,
      payload: {
        action: 'task-assignment',
        context: {
          task,
          acceptanceCriteria: task.acceptanceCriteria,
          files: task.files,
          dependencies: task.dependencies,
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    await this.messageBus.send(message);

    // Set acknowledgment timeout (10 seconds)
    const timeout = setTimeout(() => {
      if (!message.acknowledged) {
        console.warn(`Agent ${agentId} did not acknowledge task ${task.taskId} within 10 seconds`);
        // Could reassign or escalate here
      }
    }, 10000);

    this.assignmentTimeouts.set(task.taskId, timeout);

    // Update agent status and workload
    this.registry.updateStatus(agentId, 'busy', task.title);
    const agent = this.registry.getAgent(agentId);
    if (agent) {
      this.registry.updateWorkload(agentId, agent.workload + 1);
    }

    return agentId;
  }

  /**
   * Handle an escalation from an agent
   *
   * Attempts to resolve the issue or reassign the task
   * Escalates to parent agent if unable to resolve after 5 minutes
   */
  async handleEscalation(escalation: EscalationRequest): Promise<void> {
    const { agentId, taskId, reason, severity } = escalation;

    // Track escalation attempts
    const attempts = (this.escalationAttempts.get(taskId) || 0) + 1;
    this.escalationAttempts.set(taskId, attempts);

    console.log(`Escalation received from ${agentId} for task ${taskId}: ${reason}`);

    // Get work item
    const workItem = this.sharedContext.getWorkItem(taskId);
    if (!workItem) {
      console.error(`Work item ${taskId} not found`);
      return;
    }

    // Update work item status if not already blocked
    if (workItem.status !== 'blocked') {
      this.sharedContext.updateWorkItem(workItem.id, {
        status: 'blocked',
      });
    }

    // Analyze escalation and attempt resolution
    let resolved = false;

    // Strategy 1: Provide guidance based on reason
    if (reason.includes('unclear requirements')) {
      // Send clarification
      await this.sendGuidance(agentId, taskId, {
        type: 'clarification',
        message: 'Review acceptance criteria and ask specific questions',
      });
      resolved = true;
    } else if (reason.includes('missing capability')) {
      // Reassign to agent with required capability
      resolved = await this.reassignTask(taskId, agentId);
    } else if (reason.includes('dependency')) {
      // Check if dependency is complete
      // For now, just acknowledge
      await this.sendGuidance(agentId, taskId, {
        type: 'dependency',
        message: 'Waiting for dependency to complete',
      });
      resolved = true;
    }

    // Strategy 2: If blocked for >5 minutes or critical, escalate to parent
    if (!resolved && (escalation.blockedDuration > 5 * 60 * 1000 || severity === 'critical')) {
      await this.escalateToParent(escalation);
    }

    // Strategy 3: Offer to reassign if multiple attempts failed
    if (!resolved && attempts >= 3) {
      await this.reassignTask(taskId, agentId);
    }
  }

  /**
   * Send guidance to an agent
   */
  private async sendGuidance(
    agentId: string,
    taskId: string,
    guidance: { type: string; message: string }
  ): Promise<void> {
    const message: AgentMessage = {
      id: `guidance-${taskId}-${Date.now()}`,
      from: 'tech-lead',
      to: agentId,
      type: 'response',
      priority: 'high',
      payload: {
        action: 'guidance',
        context: guidance,
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    await this.messageBus.send(message);
  }

  /**
   * Reassign a task to a different agent
   */
  private async reassignTask(taskId: string, currentAgentId: string): Promise<boolean> {
    const workItem = this.sharedContext.getWorkItem(taskId);
    if (!workItem) {
      return false;
    }

    // Find a different agent with required capabilities
    const currentAgent = this.registry.getAgent(currentAgentId);
    if (!currentAgent) {
      return false;
    }

    // Try to find another agent with same role but different ID
    const candidates = this.registry
      .getAgentsByRole(currentAgent.role)
      .filter((a) => a.id !== currentAgentId);

    if (candidates.length === 0) {
      console.warn(`No alternative agent found for task ${taskId}`);
      return false;
    }

    // Select least busy candidate
    candidates.sort((a, b) => a.workload - b.workload);
    const newAgentId = candidates[0].id;

    // Update work item
    this.sharedContext.updateWorkItem(workItem.id, {
      assignedTo: newAgentId,
      status: 'in-progress',
    });

    // Notify both agents
    await this.messageBus.send({
      id: `reassign-from-${taskId}`,
      from: 'tech-lead',
      to: currentAgentId,
      type: 'notification',
      priority: 'high',
      payload: {
        action: 'task-reassigned',
        context: { taskId, reason: 'Reassigned to another agent' },
      },
      timestamp: new Date(),
      acknowledged: false,
    });

    await this.messageBus.send({
      id: `reassign-to-${taskId}`,
      from: 'tech-lead',
      to: newAgentId,
      type: 'request',
      priority: 'high',
      payload: {
        action: 'task-assignment',
        context: { workItem },
      },
      timestamp: new Date(),
      acknowledged: false,
    });

    // Update agent workloads
    if (currentAgent) {
      this.registry.updateWorkload(currentAgentId, currentAgent.workload - 1);
      this.registry.updateStatus(currentAgentId, 'idle');
    }

    const newAgent = this.registry.getAgent(newAgentId);
    if (newAgent) {
      this.registry.updateWorkload(newAgentId, newAgent.workload + 1);
      this.registry.updateStatus(newAgentId, 'busy', workItem.title);
    }

    console.log(`Task ${taskId} reassigned from ${currentAgentId} to ${newAgentId}`);
    return true;
  }

  /**
   * Escalate to parent agent (user)
   */
  private async escalateToParent(escalation: EscalationRequest): Promise<void> {
    console.error(`ESCALATION TO PARENT: Task ${escalation.taskId} - ${escalation.reason}`);

    // In a real implementation, this would notify the parent agent
    // For now, we log it
    const message: AgentMessage = {
      id: `parent-escalation-${escalation.taskId}`,
      from: 'tech-lead',
      to: 'parent-agent',
      type: 'escalation',
      priority: 'critical',
      payload: {
        action: 'escalation',
        context: escalation,
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    await this.messageBus.send(message);
  }

  /**
   * Review completed work
   *
   * Checks quality gates and approves or requests changes
   */
  async reviewWork(review: WorkReview): Promise<boolean> {
    const { workItem, agentId, qualityGateResults } = review;

    // Check if quality gates passed
    if (qualityGateResults && !qualityGateResults.passed) {
      // Quality gates failed - request changes
      await this.requestChanges(agentId, workItem, qualityGateResults);
      return false;
    }

    // Approve work - transition through review state if needed
    if (workItem.status === 'in-progress') {
      this.sharedContext.updateWorkItem(workItem.id, {
        status: 'review',
      });
    }

    if (workItem.status !== 'complete') {
      this.sharedContext.updateWorkItem(workItem.id, {
        status: 'complete',
      });
    }

    // Notify agent of approval
    await this.messageBus.send({
      id: `approval-${workItem.id}`,
      from: 'tech-lead',
      to: agentId,
      type: 'response',
      priority: 'normal',
      payload: {
        action: 'work-approved',
        context: { workItemId: workItem.id },
      },
      timestamp: new Date(),
      acknowledged: false,
    });

    // Update agent status
    const agent = this.registry.getAgent(agentId);
    if (agent) {
      this.registry.updateWorkload(agentId, Math.max(0, agent.workload - 1));
      if (agent.workload <= 1) {
        this.registry.updateStatus(agentId, 'idle');
      }
    }

    // Trigger next workflow step (would integrate with workflow engine)
    console.log(`Work approved for ${workItem.id}`);

    return true;
  }

  /**
   * Request changes from an agent
   */
  private async requestChanges(
    agentId: string,
    workItem: WorkItem,
    qualityGateResults: QualityGateReport
  ): Promise<void> {
    if (workItem.status !== 'in-progress') {
      this.sharedContext.updateWorkItem(workItem.id, {
        status: 'in-progress',
      });
    }

    const failedGates = qualityGateResults.results.filter((r) => !r.passed).map((r) => r.message);

    await this.messageBus.send({
      id: `changes-requested-${workItem.id}`,
      from: 'tech-lead',
      to: agentId,
      type: 'request',
      priority: 'high',
      payload: {
        action: 'changes-requested',
        context: {
          workItemId: workItem.id,
          failedGates,
          details: qualityGateResults,
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    });

    console.log(`Changes requested for ${workItem.id}: ${failedGates.join(', ')}`);
  }

  /**
   * Balance workload across agents
   *
   * Identifies overloaded agents and redistributes tasks
   */
  async balanceWorkload(role?: AgentRole): Promise<void> {
    const agents = role ? this.registry.getAgentsByRole(role) : this.registry.getAllAgents();

    if (agents.length < 2) {
      return; // Nothing to balance
    }

    // Calculate average workload
    const totalWorkload = agents.reduce((sum, a) => sum + a.workload, 0);
    const avgWorkload = totalWorkload / agents.length;

    // Find overloaded agents (>3 tasks or >150% of average)
    const overloaded = agents.filter((a) => a.workload > 3 || a.workload > avgWorkload * 1.5);

    // Find underutilized agents
    const underutilized = agents.filter(
      (a) => a.workload < avgWorkload * 0.5 && a.status === 'idle'
    );

    if (overloaded.length === 0 || underutilized.length === 0) {
      return; // No rebalancing needed
    }

    console.log(
      `Balancing workload: ${overloaded.length} overloaded, ${underutilized.length} underutilized`
    );

    // Redistribute tasks (simplified - in real implementation would be more sophisticated)
    for (const agent of overloaded) {
      if (agent.workload > 3) {
        console.log(`Agent ${agent.id} is overloaded with ${agent.workload} tasks`);
        // In real implementation, would reassign some tasks
      }
    }
  }

  /**
   * Get workload statistics
   */
  getWorkloadStats(): {
    totalAgents: number;
    totalWorkload: number;
    avgWorkload: number;
    maxWorkload: number;
    overloadedAgents: number;
  } {
    const agents = this.registry.getAllAgents();
    const totalWorkload = agents.reduce((sum, a) => sum + a.workload, 0);
    const maxWorkload = Math.max(...agents.map((a) => a.workload), 0);
    const overloadedAgents = agents.filter((a) => a.workload > 3).length;

    return {
      totalAgents: agents.length,
      totalWorkload,
      avgWorkload: agents.length > 0 ? totalWorkload / agents.length : 0,
      maxWorkload,
      overloadedAgents,
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Clear all timeouts
    for (const timeout of this.assignmentTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.assignmentTimeouts.clear();
    this.escalationAttempts.clear();
  }
}
