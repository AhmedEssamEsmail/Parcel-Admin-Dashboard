/**
 * Error Recovery System
 *
 * Implements agent failure detection and recovery mechanisms:
 * - Heartbeat monitoring (every 30 seconds)
 * - Failure detection (3 missed heartbeats = offline)
 * - Work preservation and task reassignment
 * - Agent restart attempts
 *
 * Requirements: US-8.5, NFR-8, NFR-9
 */

import { AgentRegistry } from './agent-registry';
import { MessageBus } from './message-bus';
import { SharedContextManager } from './shared-context';
import { TechLeadCoordinator } from './tech-lead-coordinator';
import type { AgentMessage } from './types';

/**
 * Heartbeat configuration
 */
export interface HeartbeatConfig {
  /** Interval between heartbeats in milliseconds (default: 30 seconds) */
  interval: number;

  /** Number of missed heartbeats before marking agent offline (default: 3) */
  missedThreshold: number;

  /** Timeout for heartbeat response in milliseconds (default: 5 seconds) */
  timeout: number;
}

/**
 * Agent heartbeat record
 */
interface HeartbeatRecord {
  agentId: string;
  lastHeartbeat: Date;
  missedCount: number;
  isHealthy: boolean;
}

/**
 * Failure event
 */
export interface FailureEvent {
  agentId: string;
  detectedAt: Date;
  reason: string;
  missedHeartbeats: number;
  activeTask?: string;
}

/**
 * Recovery attempt
 */
interface RecoveryAttempt {
  agentId: string;
  attemptedAt: Date;
  strategy: 'reassign' | 'restart' | 'escalate';
  success: boolean;
  details?: string;
}

/**
 * Error Recovery System
 *
 * Monitors agent health and handles failures
 */
export class ErrorRecoverySystem {
  private registry: AgentRegistry;
  private messageBus: MessageBus;
  private sharedContext: SharedContextManager;
  private coordinator?: TechLeadCoordinator;

  private config: HeartbeatConfig;
  private heartbeats: Map<string, HeartbeatRecord>;
  private monitoringInterval?: NodeJS.Timeout;
  private failureEvents: FailureEvent[];
  private recoveryAttempts: RecoveryAttempt[];
  private isMonitoring: boolean;

  constructor(
    registry: AgentRegistry,
    messageBus: MessageBus,
    sharedContext: SharedContextManager,
    config?: Partial<HeartbeatConfig>
  ) {
    this.registry = registry;
    this.messageBus = messageBus;
    this.sharedContext = sharedContext;

    this.config = {
      interval: config?.interval ?? 30000, // 30 seconds
      missedThreshold: config?.missedThreshold ?? 3,
      timeout: config?.timeout ?? 5000, // 5 seconds
    };

    this.heartbeats = new Map();
    this.failureEvents = [];
    this.recoveryAttempts = [];
    this.isMonitoring = false;
  }

  /**
   * Set the tech lead coordinator for task reassignment
   */
  setCoordinator(coordinator: TechLeadCoordinator): void {
    this.coordinator = coordinator;
  }

  /**
   * Start monitoring agent health
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Initialize heartbeat records for all agents
    const agents = this.registry.getAllAgents();
    for (const agent of agents) {
      if (!this.heartbeats.has(agent.id)) {
        this.heartbeats.set(agent.id, {
          agentId: agent.id,
          lastHeartbeat: new Date(),
          missedCount: 0,
          isHealthy: true,
        });
      }
    }

    // Start periodic health checks
    this.monitoringInterval = setInterval(() => {
      this.checkAgentHealth();
    }, this.config.interval);

    console.log('[ErrorRecovery] Health monitoring started');
  }

  /**
   * Stop monitoring agent health
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;
    console.log('[ErrorRecovery] Health monitoring stopped');
  }

  /**
   * Record a heartbeat from an agent
   */
  recordHeartbeat(agentId: string): void {
    const record = this.heartbeats.get(agentId);

    if (record) {
      record.lastHeartbeat = new Date();
      record.missedCount = 0;
      record.isHealthy = true;
    } else {
      // New agent
      this.heartbeats.set(agentId, {
        agentId,
        lastHeartbeat: new Date(),
        missedCount: 0,
        isHealthy: true,
      });
    }

    // Update agent's last activity
    const agent = this.registry.getAgent(agentId);
    if (agent && agent.status === 'offline') {
      // Agent came back online
      this.registry.updateStatus(agentId, 'idle');
      console.log(`[ErrorRecovery] Agent ${agentId} recovered`);
    }
  }

  /**
   * Check health of all agents
   */
  private async checkAgentHealth(): Promise<void> {
    const now = new Date();
    const agents = this.registry.getAllAgents();

    for (const agent of agents) {
      // Skip offline agents (already handled)
      if (agent.status === 'offline') {
        continue;
      }

      const record = this.heartbeats.get(agent.id);
      if (!record) {
        // Initialize record for new agent
        this.heartbeats.set(agent.id, {
          agentId: agent.id,
          lastHeartbeat: now,
          missedCount: 0,
          isHealthy: true,
        });
        continue;
      }

      // Check if heartbeat is overdue
      const timeSinceLastHeartbeat = now.getTime() - record.lastHeartbeat.getTime();
      const isOverdue = timeSinceLastHeartbeat > this.config.interval + this.config.timeout;

      if (isOverdue) {
        record.missedCount++;
        console.warn(
          `[ErrorRecovery] Agent ${agent.id} missed heartbeat (${record.missedCount}/${this.config.missedThreshold})`
        );

        // Check if threshold exceeded
        if (record.missedCount >= this.config.missedThreshold) {
          record.isHealthy = false;
          await this.handleAgentFailure(agent.id, record.missedCount);
        }
      }
    }
  }

  /**
   * Handle agent failure
   */
  private async handleAgentFailure(agentId: string, missedHeartbeats: number): Promise<void> {
    const agent = this.registry.getAgent(agentId);
    if (!agent) {
      return;
    }

    // Create failure event
    const failureEvent: FailureEvent = {
      agentId,
      detectedAt: new Date(),
      reason: `Missed ${missedHeartbeats} heartbeats`,
      missedHeartbeats,
      activeTask: agent.currentTask,
    };

    this.failureEvents.push(failureEvent);

    console.error(`[ErrorRecovery] Agent ${agentId} failed: ${failureEvent.reason}`);

    // Mark agent as offline
    this.registry.updateStatus(agentId, 'offline');

    // Notify tech lead
    await this.notifyTechLead(failureEvent);

    // Attempt recovery
    await this.recoverFromFailure(failureEvent);
  }

  /**
   * Notify tech lead of agent failure
   */
  private async notifyTechLead(failure: FailureEvent): Promise<void> {
    const message: AgentMessage = {
      id: `failure-${failure.agentId}-${Date.now()}`,
      from: 'error-recovery-system',
      to: 'tech-lead',
      type: 'notification',
      priority: 'critical',
      payload: {
        action: 'agent-failure',
        context: failure,
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    await this.messageBus.send(message);
  }

  /**
   * Recover from agent failure
   */
  private async recoverFromFailure(failure: FailureEvent): Promise<void> {
    // Strategy 1: Preserve work in progress
    await this.preserveWorkInProgress(failure.agentId);

    // Strategy 2: Reassign active tasks
    const reassigned = await this.reassignActiveTasks(failure.agentId);

    if (reassigned) {
      this.recordRecoveryAttempt(failure.agentId, 'reassign', true, 'Tasks reassigned');
    } else {
      this.recordRecoveryAttempt(
        failure.agentId,
        'reassign',
        false,
        'No available agents for reassignment'
      );
    }

    // Strategy 3: Attempt agent restart (simulated)
    const restarted = await this.attemptAgentRestart(failure.agentId);

    if (restarted) {
      this.recordRecoveryAttempt(failure.agentId, 'restart', true, 'Agent restarted successfully');
    } else {
      this.recordRecoveryAttempt(failure.agentId, 'restart', false, 'Restart failed');

      // Strategy 4: Escalate to parent if restart fails
      await this.escalateToParent(failure);
      this.recordRecoveryAttempt(failure.agentId, 'escalate', true, 'Escalated to parent agent');
    }
  }

  /**
   * Preserve work in progress for failed agent
   */
  private async preserveWorkInProgress(agentId: string): Promise<void> {
    // Get all work items assigned to this agent
    const workItems = this.sharedContext.getWorkItemsByAgent(agentId);

    for (const workItem of workItems) {
      if (workItem.status === 'in-progress') {
        // Add note about failure
        const note = `Work preserved after agent ${agentId} failure at ${new Date().toISOString()}`;
        const updatedArtifacts = [...workItem.artifacts, { type: 'recovery-note', data: note }];

        this.sharedContext.updateWorkItem(workItem.id, {
          artifacts: updatedArtifacts,
        });

        console.log(`[ErrorRecovery] Preserved work for ${workItem.id}`);
      }
    }

    // Release all file locks held by this agent
    const locks = this.sharedContext.getAgentLocks(agentId);
    for (const lock of locks) {
      this.sharedContext.releaseFileLock(agentId, lock.filePath);
      console.log(`[ErrorRecovery] Released lock on ${lock.filePath}`);
    }
  }

  /**
   * Reassign active tasks to other agents
   */
  private async reassignActiveTasks(agentId: string): Promise<boolean> {
    if (!this.coordinator) {
      console.warn('[ErrorRecovery] No coordinator available for task reassignment');
      return false;
    }

    const workItems = this.sharedContext.getWorkItemsByAgent(agentId);
    const activeTasks = workItems.filter((item) => item.status === 'in-progress');

    if (activeTasks.length === 0) {
      return true; // No tasks to reassign
    }

    const allReassigned = true;

    for (const task of activeTasks) {
      // Mark task as blocked for reassignment (valid transition from in-progress)
      this.sharedContext.updateWorkItem(task.id, {
        status: 'blocked',
      });

      // Notify tech lead to reassign
      const message: AgentMessage = {
        id: `reassign-request-${task.id}`,
        from: 'error-recovery-system',
        to: 'tech-lead',
        type: 'request',
        priority: 'high',
        payload: {
          action: 'reassign-task',
          context: {
            taskId: task.id,
            reason: `Agent ${agentId} failed`,
            originalAgent: agentId,
          },
        },
        timestamp: new Date(),
        acknowledged: false,
      };

      await this.messageBus.send(message);
      console.log(`[ErrorRecovery] Requested reassignment of task ${task.id}`);
    }

    return allReassigned;
  }

  /**
   * Attempt to restart a failed agent
   */
  private async attemptAgentRestart(agentId: string): Promise<boolean> {
    // In a real implementation, this would:
    // 1. Spawn a new agent process
    // 2. Restore agent state
    // 3. Verify agent is responsive

    // For now, we simulate a restart attempt
    console.log(`[ErrorRecovery] Attempting to restart agent ${agentId}...`);

    // Simulate restart delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate 30% success rate for testing
    const success = Math.random() > 0.7;

    if (success) {
      // Reset heartbeat record
      const record = this.heartbeats.get(agentId);
      if (record) {
        record.lastHeartbeat = new Date();
        record.missedCount = 0;
        record.isHealthy = true;
      }

      // Update agent status
      this.registry.updateStatus(agentId, 'idle');
      console.log(`[ErrorRecovery] Agent ${agentId} restarted successfully`);
    } else {
      console.error(`[ErrorRecovery] Failed to restart agent ${agentId}`);
    }

    return success;
  }

  /**
   * Escalate to parent agent
   */
  private async escalateToParent(failure: FailureEvent): Promise<void> {
    const message: AgentMessage = {
      id: `parent-escalation-${failure.agentId}`,
      from: 'error-recovery-system',
      to: 'parent-agent',
      type: 'escalation',
      priority: 'critical',
      payload: {
        action: 'agent-failure-escalation',
        context: {
          failure,
          recoveryAttempts: this.recoveryAttempts.filter((a) => a.agentId === failure.agentId),
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    await this.messageBus.send(message);
    console.error(`[ErrorRecovery] Escalated agent ${failure.agentId} failure to parent`);
  }

  /**
   * Record a recovery attempt
   */
  private recordRecoveryAttempt(
    agentId: string,
    strategy: RecoveryAttempt['strategy'],
    success: boolean,
    details?: string
  ): void {
    const attempt: RecoveryAttempt = {
      agentId,
      attemptedAt: new Date(),
      strategy,
      success,
      details,
    };

    this.recoveryAttempts.push(attempt);
  }

  /**
   * Get failure events
   */
  getFailureEvents(agentId?: string): FailureEvent[] {
    if (agentId) {
      return this.failureEvents.filter((e) => e.agentId === agentId);
    }
    return [...this.failureEvents];
  }

  /**
   * Get recovery attempts
   */
  getRecoveryAttempts(agentId?: string): RecoveryAttempt[] {
    if (agentId) {
      return this.recoveryAttempts.filter((a) => a.agentId === agentId);
    }
    return [...this.recoveryAttempts];
  }

  /**
   * Get agent health status
   */
  getAgentHealth(agentId: string): HeartbeatRecord | undefined {
    return this.heartbeats.get(agentId);
  }

  /**
   * Get all agent health statuses
   */
  getAllAgentHealth(): HeartbeatRecord[] {
    return Array.from(this.heartbeats.values());
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.stopMonitoring();
    this.heartbeats.clear();
    this.failureEvents = [];
    this.recoveryAttempts = [];
  }
}
