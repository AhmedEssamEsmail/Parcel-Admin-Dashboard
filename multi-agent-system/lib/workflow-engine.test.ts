import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WorkflowEngine } from './workflow-engine';
import { MessageBus } from './message-bus';
import { AgentRegistry } from './agent-registry';
import { AgentRole } from './agent-definition-schema';
import { WorkflowRule, WorkflowEvent } from './workflow-types';
import { Agent } from './agent-registry';

describe('WorkflowEngine', () => {
  let workflowEngine: WorkflowEngine;
  let messageBus: MessageBus;
  let agentRegistry: AgentRegistry;

  beforeEach(async () => {
    messageBus = new MessageBus();
    agentRegistry = new AgentRegistry();
    await agentRegistry.initialize();
    workflowEngine = new WorkflowEngine(messageBus, agentRegistry);
  });

  afterEach(() => {
    messageBus.clear();
    workflowEngine.clearRules();
    workflowEngine.clearTasks();
  });

  describe('Rule Registration', () => {
    it('should register a workflow rule', () => {
      const rule: WorkflowRule = {
        id: 'test-rule',
        trigger: 'test-event',
        action: 'test-action',
        target: AgentRole.DEVELOPER,
        payload: { test: true },
        priority: 50,
      };

      workflowEngine.registerRule(rule);

      const rules = workflowEngine.getRules();
      expect(rules).toHaveLength(7); // 6 predefined + 1 new
      expect(rules.some((r) => r.id === 'test-rule')).toBe(true);
    });

    it('should register rules in priority order', () => {
      workflowEngine.clearRules();

      const lowPriorityRule: WorkflowRule = {
        id: 'low-priority',
        trigger: 'test',
        action: 'test',
        target: AgentRole.DEVELOPER,
        payload: {},
        priority: 10,
      };

      const highPriorityRule: WorkflowRule = {
        id: 'high-priority',
        trigger: 'test',
        action: 'test',
        target: AgentRole.DEVELOPER,
        payload: {},
        priority: 90,
      };

      const mediumPriorityRule: WorkflowRule = {
        id: 'medium-priority',
        trigger: 'test',
        action: 'test',
        target: AgentRole.DEVELOPER,
        payload: {},
        priority: 50,
      };

      workflowEngine.registerRule(lowPriorityRule);
      workflowEngine.registerRule(highPriorityRule);
      workflowEngine.registerRule(mediumPriorityRule);

      const rules = workflowEngine.getRules();
      expect(rules[0].id).toBe('high-priority');
      expect(rules[1].id).toBe('medium-priority');
      expect(rules[2].id).toBe('low-priority');
    });

    it('should have predefined rules registered', () => {
      const rules = workflowEngine.getRules();

      expect(rules.some((r) => r.id === 'feature-complete-to-qa')).toBe(true);
      expect(rules.some((r) => r.id === 'test-failure-to-bugfix')).toBe(true);
      expect(rules.some((r) => r.id === 'schema-change-to-architect')).toBe(true);
      expect(rules.some((r) => r.id === 'migration-complete-to-devops')).toBe(true);
      expect(rules.some((r) => r.id === 'quality-gate-failure-to-owner')).toBe(true);
      expect(rules.some((r) => r.id === 'task-blocked-to-tech-lead')).toBe(true);
    });
  });

  describe('Event Processing', () => {
    it('should process event and execute matching rule', async () => {
      // Register a QA agent
      const qaAgent: Agent = {
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests'],
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      agentRegistry.registerAgent(qaAgent);

      // Subscribe to messages
      const messageHandler = vi.fn();
      messageBus.subscribe('qa-1', messageHandler);

      // Create event
      const event: WorkflowEvent = {
        type: 'feature-complete',
        source: 'dev-1',
        data: {
          taskId: 'task-1',
          qualityGateResults: { passed: true },
        },
        timestamp: new Date(),
      };

      await workflowEngine.processEvent(event);

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageHandler).toHaveBeenCalled();
      const message = messageHandler.mock.calls[0][0];
      expect(message.payload.action).toBe('test-feature');
    });

    it('should not execute rule if condition fails', async () => {
      // Register a QA agent
      const qaAgent: Agent = {
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests'],
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      agentRegistry.registerAgent(qaAgent);

      const messageHandler = vi.fn();
      messageBus.subscribe('qa-1', messageHandler);

      // Create event with failing condition (quality gates not passed)
      const event: WorkflowEvent = {
        type: 'feature-complete',
        source: 'dev-1',
        data: {
          taskId: 'task-1',
          qualityGateResults: { passed: false },
        },
        timestamp: new Date(),
      };

      await workflowEngine.processEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should execute multiple matching rules in priority order', async () => {
      workflowEngine.clearRules();

      // Register two developers
      const dev1: Agent = {
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      agentRegistry.registerAgent(dev1);

      const executionOrder: string[] = [];

      const handler1 = vi.fn((msg) => {
        executionOrder.push(msg.payload.context.ruleId);
      });
      messageBus.subscribe('dev-1', handler1);

      // Register rules with different priorities
      workflowEngine.registerRule({
        id: 'low-priority-rule',
        trigger: 'test-event',
        action: 'action-1',
        target: AgentRole.DEVELOPER,
        payload: {},
        priority: 30,
      });

      workflowEngine.registerRule({
        id: 'high-priority-rule',
        trigger: 'test-event',
        action: 'action-2',
        target: AgentRole.DEVELOPER,
        payload: {},
        priority: 80,
      });

      const event: WorkflowEvent = {
        type: 'test-event',
        source: 'test',
        data: {},
        timestamp: new Date(),
      };

      await workflowEngine.processEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(executionOrder).toEqual(['high-priority-rule', 'low-priority-rule']);
    });

    it('should handle event with no matching rules', async () => {
      const event: WorkflowEvent = {
        type: 'unknown-event',
        source: 'test',
        data: {},
        timestamp: new Date(),
      };

      // Should not throw
      await expect(workflowEngine.processEvent(event)).resolves.not.toThrow();
    });

    it('should handle event when no agent is available', async () => {
      // No agents registered
      const event: WorkflowEvent = {
        type: 'feature-complete',
        source: 'dev-1',
        data: {
          qualityGateResults: { passed: true },
        },
        timestamp: new Date(),
      };

      // Should not throw, just log warning
      await expect(workflowEngine.processEvent(event)).resolves.not.toThrow();
    });
  });

  describe('Predefined Rules', () => {
    it('should trigger QA testing when feature is complete', async () => {
      const qaAgent: Agent = {
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests'],
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      agentRegistry.registerAgent(qaAgent);

      const messageHandler = vi.fn();
      messageBus.subscribe('qa-1', messageHandler);

      const event: WorkflowEvent = {
        type: 'feature-complete',
        source: 'dev-1',
        data: {
          taskId: 'task-1',
          files: ['app/feature.ts'],
          qualityGateResults: { passed: true },
        },
        timestamp: new Date(),
      };

      await workflowEngine.processEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageHandler).toHaveBeenCalled();
      const message = messageHandler.mock.calls[0][0];
      expect(message.payload.action).toBe('test-feature');
      expect(message.priority).toBe('high');
    });

    it('should assign bug fix to developer when test fails', async () => {
      const devAgent: Agent = {
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['fix-bugs'],
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      agentRegistry.registerAgent(devAgent);

      const messageHandler = vi.fn();
      messageBus.subscribe('dev-1', messageHandler);

      const event: WorkflowEvent = {
        type: 'test-failure',
        source: 'qa-1',
        data: {
          taskId: 'task-1',
          testResults: {
            passed: false,
            failures: ['Login test failed'],
          },
        },
        timestamp: new Date(),
      };

      await workflowEngine.processEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageHandler).toHaveBeenCalled();
      const message = messageHandler.mock.calls[0][0];
      expect(message.payload.action).toBe('fix-bug');
      expect(message.priority).toBe('critical');
    });

    it('should route schema change to data architect', async () => {
      const architectAgent: Agent = {
        id: 'architect-1',
        role: AgentRole.DATA_ARCHITECT,
        status: 'idle',
        capabilities: ['schema-design'],
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      agentRegistry.registerAgent(architectAgent);

      const messageHandler = vi.fn();
      messageBus.subscribe('architect-1', messageHandler);

      const event: WorkflowEvent = {
        type: 'schema-change-request',
        source: 'dev-1',
        data: {
          schemaChanges: {
            tables: ['users', 'sessions'],
          },
        },
        timestamp: new Date(),
      };

      await workflowEngine.processEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageHandler).toHaveBeenCalled();
      const message = messageHandler.mock.calls[0][0];
      expect(message.payload.action).toBe('review-schema-change');
    });

    it('should notify devops when migration is complete', async () => {
      const devopsAgent: Agent = {
        id: 'devops-1',
        role: AgentRole.DEVOPS,
        status: 'idle',
        capabilities: ['ci-cd'],
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      agentRegistry.registerAgent(devopsAgent);

      const messageHandler = vi.fn();
      messageBus.subscribe('devops-1', messageHandler);

      const event: WorkflowEvent = {
        type: 'migration-complete',
        source: 'architect-1',
        data: {
          schemaChanges: {
            migrations: ['001_add_users_table.sql'],
          },
        },
        timestamp: new Date(),
      };

      await workflowEngine.processEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageHandler).toHaveBeenCalled();
      const message = messageHandler.mock.calls[0][0];
      expect(message.payload.action).toBe('update-pipeline');
    });

    it('should reassign to developer when quality gate fails', async () => {
      const devAgent: Agent = {
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      agentRegistry.registerAgent(devAgent);

      const messageHandler = vi.fn();
      messageBus.subscribe('dev-1', messageHandler);

      const event: WorkflowEvent = {
        type: 'quality-gate-failure',
        source: 'quality-system',
        data: {
          taskId: 'task-1',
          qualityGateResults: {
            passed: false,
            failedGates: ['lint-check', 'type-check'],
          },
        },
        timestamp: new Date(),
      };

      await workflowEngine.processEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageHandler).toHaveBeenCalled();
      const message = messageHandler.mock.calls[0][0];
      expect(message.payload.action).toBe('fix-quality-issues');
    });

    it('should escalate to tech lead when task is blocked', async () => {
      const techLeadAgent: Agent = {
        id: 'tech-lead-1',
        role: AgentRole.TECH_LEAD,
        status: 'idle',
        capabilities: ['coordinate'],
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      agentRegistry.registerAgent(techLeadAgent);

      const messageHandler = vi.fn();
      messageBus.subscribe('tech-lead-1', messageHandler);

      const event: WorkflowEvent = {
        type: 'task-blocked',
        source: 'dev-1',
        data: {
          taskId: 'task-1',
          blocker: {
            reason: 'Cannot resolve merge conflict',
            attemptedSolutions: ['Auto-merge', 'Rebase'],
            duration: 400, // > 5 minutes (300 seconds)
          },
        },
        timestamp: new Date(),
      };

      await workflowEngine.processEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageHandler).toHaveBeenCalled();
      const message = messageHandler.mock.calls[0][0];
      expect(message.payload.action).toBe('resolve-blocker');
      expect(message.priority).toBe('critical');
    });

    it('should not escalate if task blocked for less than 5 minutes', async () => {
      const techLeadAgent: Agent = {
        id: 'tech-lead-1',
        role: AgentRole.TECH_LEAD,
        status: 'idle',
        capabilities: ['coordinate'],
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      agentRegistry.registerAgent(techLeadAgent);

      const messageHandler = vi.fn();
      messageBus.subscribe('tech-lead-1', messageHandler);

      const event: WorkflowEvent = {
        type: 'task-blocked',
        source: 'dev-1',
        data: {
          taskId: 'task-1',
          blocker: {
            reason: 'Waiting for response',
            duration: 200, // < 5 minutes
          },
        },
        timestamp: new Date(),
      };

      await workflowEngine.processEvent(event);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageHandler).not.toHaveBeenCalled();
    });
  });

  describe('Task Dependency Management', () => {
    it('should add task with no dependencies', () => {
      workflowEngine.addTask('task-1');

      const deps = workflowEngine.getDependencies('task-1');
      expect(deps).toHaveLength(0);
    });

    it('should add task with dependencies', () => {
      workflowEngine.addTask('task-1');
      workflowEngine.addTask('task-2', ['task-1']);

      const deps = workflowEngine.getDependencies('task-2');
      expect(deps).toHaveLength(1);
      expect(deps[0].taskId).toBe('task-1');
    });

    it('should update task status', () => {
      workflowEngine.addTask('task-1');
      workflowEngine.updateTaskStatus('task-1', 'in-progress', 'dev-1');

      const readyTasks = workflowEngine.getReadyTasks();
      expect(readyTasks).not.toContain('task-1'); // Not ready because it's in-progress
    });

    it('should check if task can execute when dependencies are complete', () => {
      workflowEngine.addTask('task-1');
      workflowEngine.addTask('task-2', ['task-1']);

      // Task-2 cannot execute yet
      expect(workflowEngine.canExecute('task-2')).toBe(false);

      // Complete task-1
      workflowEngine.updateTaskStatus('task-1', 'complete');

      // Now task-2 can execute
      expect(workflowEngine.canExecute('task-2')).toBe(true);
    });

    it('should check if task can execute with multiple dependencies', () => {
      workflowEngine.addTask('task-1');
      workflowEngine.addTask('task-2');
      workflowEngine.addTask('task-3', ['task-1', 'task-2']);

      expect(workflowEngine.canExecute('task-3')).toBe(false);

      workflowEngine.updateTaskStatus('task-1', 'complete');
      expect(workflowEngine.canExecute('task-3')).toBe(false);

      workflowEngine.updateTaskStatus('task-2', 'complete');
      expect(workflowEngine.canExecute('task-3')).toBe(true);
    });

    it('should get ready tasks', () => {
      workflowEngine.addTask('task-1');
      workflowEngine.addTask('task-2', ['task-1']);
      workflowEngine.addTask('task-3');

      const readyTasks = workflowEngine.getReadyTasks();
      expect(readyTasks).toContain('task-1');
      expect(readyTasks).toContain('task-3');
      expect(readyTasks).not.toContain('task-2');
    });

    it('should update ready tasks as dependencies complete', () => {
      workflowEngine.addTask('task-1');
      workflowEngine.addTask('task-2', ['task-1']);

      let readyTasks = workflowEngine.getReadyTasks();
      expect(readyTasks).toContain('task-1');
      expect(readyTasks).not.toContain('task-2');

      workflowEngine.updateTaskStatus('task-1', 'complete');

      readyTasks = workflowEngine.getReadyTasks();
      expect(readyTasks).not.toContain('task-1');
      expect(readyTasks).toContain('task-2');
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect simple circular dependency', () => {
      workflowEngine.addTask('task-1', ['task-2']);
      workflowEngine.addTask('task-2', ['task-1']);

      expect(workflowEngine.hasCircularDependency('task-1')).toBe(true);
      expect(workflowEngine.hasCircularDependency('task-2')).toBe(true);
    });

    it('should detect circular dependency in chain', () => {
      workflowEngine.addTask('task-1', ['task-3']);
      workflowEngine.addTask('task-2', ['task-1']);
      workflowEngine.addTask('task-3', ['task-2']);

      expect(workflowEngine.hasCircularDependency('task-1')).toBe(true);
      expect(workflowEngine.hasCircularDependency('task-2')).toBe(true);
      expect(workflowEngine.hasCircularDependency('task-3')).toBe(true);
    });

    it('should not detect circular dependency in valid DAG', () => {
      workflowEngine.addTask('task-1');
      workflowEngine.addTask('task-2', ['task-1']);
      workflowEngine.addTask('task-3', ['task-1']);
      workflowEngine.addTask('task-4', ['task-2', 'task-3']);

      expect(workflowEngine.hasCircularDependency('task-1')).toBe(false);
      expect(workflowEngine.hasCircularDependency('task-2')).toBe(false);
      expect(workflowEngine.hasCircularDependency('task-3')).toBe(false);
      expect(workflowEngine.hasCircularDependency('task-4')).toBe(false);
    });

    it('should prevent execution of tasks with circular dependencies', () => {
      workflowEngine.addTask('task-1', ['task-2']);
      workflowEngine.addTask('task-2', ['task-1']);

      expect(workflowEngine.canExecute('task-1')).toBe(false);
      expect(workflowEngine.canExecute('task-2')).toBe(false);
    });
  });

  describe('Critical Path', () => {
    it('should find critical path for single task', () => {
      workflowEngine.addTask('task-1');

      const criticalPath = workflowEngine.getCriticalPath('task-1');
      expect(criticalPath).toEqual(['task-1']);
    });

    it('should find critical path for linear dependencies', () => {
      workflowEngine.addTask('task-1');
      workflowEngine.addTask('task-2', ['task-1']);
      workflowEngine.addTask('task-3', ['task-2']);

      const criticalPath = workflowEngine.getCriticalPath('task-3');
      expect(criticalPath).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('should find longest path when multiple paths exist', () => {
      workflowEngine.addTask('task-1');
      workflowEngine.addTask('task-2');
      workflowEngine.addTask('task-3', ['task-1']);
      workflowEngine.addTask('task-4', ['task-1', 'task-2']);
      workflowEngine.addTask('task-5', ['task-3', 'task-4']);

      const criticalPath = workflowEngine.getCriticalPath('task-5');

      // Should include the longest path
      expect(criticalPath.length).toBeGreaterThanOrEqual(3);
      expect(criticalPath[criticalPath.length - 1]).toBe('task-5');
    });

    it('should find critical path in diamond dependency', () => {
      workflowEngine.addTask('task-1');
      workflowEngine.addTask('task-2', ['task-1']);
      workflowEngine.addTask('task-3', ['task-1']);
      workflowEngine.addTask('task-4', ['task-2', 'task-3']);

      const criticalPath = workflowEngine.getCriticalPath('task-4');

      expect(criticalPath).toHaveLength(3);
      expect(criticalPath[0]).toBe('task-1');
      expect(criticalPath[2]).toBe('task-4');
      // Middle element can be either task-2 or task-3
      expect(['task-2', 'task-3']).toContain(criticalPath[1]);
    });
  });

  describe('Clear Operations', () => {
    it('should clear all tasks', () => {
      workflowEngine.addTask('task-1');
      workflowEngine.addTask('task-2');

      workflowEngine.clearTasks();

      const readyTasks = workflowEngine.getReadyTasks();
      expect(readyTasks).toHaveLength(0);
    });

    it('should clear all rules', () => {
      const initialRuleCount = workflowEngine.getRules().length;
      expect(initialRuleCount).toBeGreaterThan(0);

      workflowEngine.clearRules();

      const rules = workflowEngine.getRules();
      expect(rules).toHaveLength(0);
    });
  });
});
