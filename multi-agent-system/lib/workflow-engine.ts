import { MessageBus } from './message-bus';
import { AgentRegistry } from './agent-registry';
import { AgentRole } from './agent-definition-schema';
import {
  WorkflowRule,
  WorkflowEvent,
  WorkflowEventData,
  TaskDependency,
  DependencyGraph,
} from './workflow-types';
import { AgentMessage } from './types';

/**
 * Workflow Engine
 * Manages automated work routing based on predefined rules and task dependencies
 */
export class WorkflowEngine {
  private rules: WorkflowRule[] = [];
  private dependencyGraph: DependencyGraph = {
    tasks: new Map(),
    adjacencyList: new Map(),
  };

  constructor(
    private messageBus: MessageBus,
    private agentRegistry: AgentRegistry
  ) {
    this.registerPredefinedRules();
  }

  /**
   * Register a workflow rule
   */
  registerRule(rule: WorkflowRule): void {
    // Insert rule in priority order (higher priority first)
    const insertIndex = this.rules.findIndex((r) => r.priority < rule.priority);

    if (insertIndex === -1) {
      this.rules.push(rule);
    } else {
      this.rules.splice(insertIndex, 0, rule);
    }
  }

  /**
   * Process a workflow event and execute matching rules
   */
  async processEvent(event: WorkflowEvent): Promise<void> {
    // Find all rules that match this event type
    const matchingRules = this.rules.filter((rule) => rule.trigger === event.type);

    // Execute rules in priority order
    for (const rule of matchingRules) {
      // Check condition if present
      if (rule.condition && !rule.condition(event.data)) {
        continue;
      }

      // Execute the rule action
      await this.executeRuleAction(rule, event);
    }
  }

  /**
   * Execute a rule's action
   */
  private async executeRuleAction(rule: WorkflowRule, event: WorkflowEvent): Promise<void> {
    // Find an available agent with the target role
    const agents = this.agentRegistry.getAgentsByRole(rule.target);
    const availableAgent = agents.find((agent) => agent.status === 'idle');

    if (!availableAgent) {
      // No available agent, log warning
      console.warn(`No available agent with role ${rule.target} for rule ${rule.id}`);
      return;
    }

    // Create and send message to the target agent
    const message: AgentMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      from: 'workflow-engine',
      to: availableAgent.id,
      type: 'request',
      priority: this.mapRulePriorityToMessagePriority(rule.priority),
      payload: {
        action: rule.action,
        context: {
          event,
          ruleId: rule.id,
          payload: rule.payload,
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    await this.messageBus.send(message);
  }

  /**
   * Map rule priority to message priority
   */
  private mapRulePriorityToMessagePriority(
    rulePriority: number
  ): 'critical' | 'high' | 'normal' | 'low' {
    if (rulePriority >= 90) return 'critical';
    if (rulePriority >= 70) return 'high';
    if (rulePriority >= 40) return 'normal';
    return 'low';
  }

  /**
   * Add a task to the dependency graph
   */
  addTask(taskId: string, dependsOn: string[] = []): void {
    const task: TaskDependency = {
      taskId,
      dependsOn,
      status: 'pending',
    };

    this.dependencyGraph.tasks.set(taskId, task);
    this.dependencyGraph.adjacencyList.set(taskId, dependsOn);
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: TaskDependency['status'], assignedTo?: string): void {
    const task = this.dependencyGraph.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (assignedTo !== undefined) {
        task.assignedTo = assignedTo;
      }
    }
  }

  /**
   * Get dependencies for a task
   */
  getDependencies(taskId: string): TaskDependency[] {
    const dependencyIds = this.dependencyGraph.adjacencyList.get(taskId) || [];
    return dependencyIds
      .map((id) => this.dependencyGraph.tasks.get(id))
      .filter((task): task is TaskDependency => task !== undefined);
  }

  /**
   * Check if a task can be executed (all dependencies complete)
   */
  canExecute(taskId: string): boolean {
    const dependencies = this.getDependencies(taskId);

    // Check for circular dependencies
    if (this.hasCircularDependency(taskId)) {
      return false;
    }

    // All dependencies must be complete
    return dependencies.every((dep) => dep.status === 'complete');
  }

  /**
   * Detect circular dependencies starting from a task
   */
  hasCircularDependency(taskId: string): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    return this.detectCycle(taskId, visited, recursionStack);
  }

  /**
   * DFS-based cycle detection
   */
  private detectCycle(taskId: string, visited: Set<string>, recursionStack: Set<string>): boolean {
    // Mark current node as visited and add to recursion stack
    visited.add(taskId);
    recursionStack.add(taskId);

    // Get dependencies
    const dependencies = this.dependencyGraph.adjacencyList.get(taskId) || [];

    // Check all dependencies
    for (const depId of dependencies) {
      // If not visited, recurse
      if (!visited.has(depId)) {
        if (this.detectCycle(depId, visited, recursionStack)) {
          return true;
        }
      }
      // If in recursion stack, we found a cycle
      else if (recursionStack.has(depId)) {
        return true;
      }
    }

    // Remove from recursion stack before returning
    recursionStack.delete(taskId);
    return false;
  }

  /**
   * Get the critical path (longest path through dependencies)
   */
  getCriticalPath(taskId: string): string[] {
    const memo = new Map<string, string[]>();
    return this.findLongestPath(taskId, memo);
  }

  /**
   * Find longest path using memoization
   */
  private findLongestPath(taskId: string, memo: Map<string, string[]>): string[] {
    // Check memo
    if (memo.has(taskId)) {
      return memo.get(taskId)!;
    }

    const dependencies = this.dependencyGraph.adjacencyList.get(taskId) || [];

    // Base case: no dependencies
    if (dependencies.length === 0) {
      const path = [taskId];
      memo.set(taskId, path);
      return path;
    }

    // Find longest path among dependencies
    let longestPath: string[] = [];
    for (const depId of dependencies) {
      const depPath = this.findLongestPath(depId, memo);
      if (depPath.length > longestPath.length) {
        longestPath = depPath;
      }
    }

    // Add current task to path
    const path = [...longestPath, taskId];
    memo.set(taskId, path);
    return path;
  }

  /**
   * Get all tasks that are ready to execute
   */
  getReadyTasks(): string[] {
    const readyTasks: string[] = [];

    for (const [taskId, task] of this.dependencyGraph.tasks) {
      if (task.status === 'pending' && this.canExecute(taskId)) {
        readyTasks.push(taskId);
      }
    }

    return readyTasks;
  }

  /**
   * Clear all tasks from dependency graph
   */
  clearTasks(): void {
    this.dependencyGraph.tasks.clear();
    this.dependencyGraph.adjacencyList.clear();
  }

  /**
   * Register predefined workflow rules
   */
  private registerPredefinedRules(): void {
    // Rule 1: Feature Complete → QA Testing
    this.registerRule({
      id: 'feature-complete-to-qa',
      trigger: 'feature-complete',
      action: 'test-feature',
      target: AgentRole.QA_ENGINEER,
      payload: {},
      priority: 80,
      condition: (data: WorkflowEventData) => {
        // Only trigger if quality gates passed
        return data.qualityGateResults?.passed === true;
      },
    });

    // Rule 2: Test Failure → Bug Fix
    this.registerRule({
      id: 'test-failure-to-bugfix',
      trigger: 'test-failure',
      action: 'fix-bug',
      target: AgentRole.DEVELOPER,
      payload: {},
      priority: 90,
    });

    // Rule 3: Schema Change Request → Data Architect Review
    this.registerRule({
      id: 'schema-change-to-architect',
      trigger: 'schema-change-request',
      action: 'review-schema-change',
      target: AgentRole.DATA_ARCHITECT,
      payload: {},
      priority: 85,
    });

    // Rule 4: Migration Complete → DevOps Pipeline Update
    this.registerRule({
      id: 'migration-complete-to-devops',
      trigger: 'migration-complete',
      action: 'update-pipeline',
      target: AgentRole.DEVOPS,
      payload: {},
      priority: 75,
    });

    // Rule 5: Quality Gate Failure → Reassign to Owner
    this.registerRule({
      id: 'quality-gate-failure-to-owner',
      trigger: 'quality-gate-failure',
      action: 'fix-quality-issues',
      target: AgentRole.DEVELOPER,
      payload: {},
      priority: 85,
    });

    // Rule 6: Task Blocked → Tech Lead Escalation
    this.registerRule({
      id: 'task-blocked-to-tech-lead',
      trigger: 'task-blocked',
      action: 'resolve-blocker',
      target: AgentRole.TECH_LEAD,
      payload: {},
      priority: 95,
      condition: (data: WorkflowEventData) => {
        // Only escalate if blocked for more than 5 minutes
        return (data.blocker?.duration || 0) > 300;
      },
    });
  }

  /**
   * Get all registered rules
   */
  getRules(): WorkflowRule[] {
    return [...this.rules];
  }

  /**
   * Clear all rules (for testing)
   */
  clearRules(): void {
    this.rules = [];
  }
}
