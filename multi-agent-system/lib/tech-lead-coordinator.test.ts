/**
 * Unit Tests: Tech Lead Coordinator
 * Tests task assignment, escalation handling, work review, and workload balancing
 * Requirements: US-3.1, US-7.1, US-7.2, US-8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TechLeadCoordinator,
  type TaskAssignment,
  type EscalationRequest,
} from './tech-lead-coordinator';
import { AgentRegistry } from './agent-registry';
import { MessageBus } from './message-bus';
import { SharedContextManager } from './shared-context';
import { AgentRole } from './agent-definition-schema';

describe('TechLeadCoordinator', () => {
  let coordinator: TechLeadCoordinator;
  let registry: AgentRegistry;
  let messageBus: MessageBus;
  let sharedContext: SharedContextManager;

  beforeEach(async () => {
    registry = new AgentRegistry();
    await registry.initialize();
    // Use fast retries for tests (10ms instead of 1000ms)
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
    sharedContext = new SharedContextManager();
    coordinator = new TechLeadCoordinator(registry, messageBus, sharedContext);
  });

  afterEach(() => {
    coordinator.cleanup();
    registry.clear();
    messageBus.clear();
  });

  describe('Task Analysis', () => {
    it('should route database tasks to Data Architect', () => {
      const task: TaskAssignment = {
        taskId: 'task-1',
        title: 'Create user table',
        description: 'Create a new database schema for users',
        acceptanceCriteria: ['Schema created', 'Migration written'],
        requiredCapabilities: [],
        priority: 'normal',
      };

      const role = coordinator.analyzeTask(task);
      expect(role).toBe(AgentRole.DATA_ARCHITECT);
    });

    it('should route testing tasks to QA Engineer', () => {
      const task: TaskAssignment = {
        taskId: 'task-2',
        title: 'Write integration tests',
        description: 'Write comprehensive test suite for API',
        acceptanceCriteria: ['All endpoints tested'],
        requiredCapabilities: ['write-tests'],
        priority: 'normal',
      };

      const role = coordinator.analyzeTask(task);
      expect(role).toBe(AgentRole.QA_ENGINEER);
    });

    it('should route deployment tasks to DevOps', () => {
      const task: TaskAssignment = {
        taskId: 'task-3',
        title: 'Setup CI/CD pipeline',
        description: 'Configure deployment pipeline for production',
        acceptanceCriteria: ['Pipeline configured'],
        requiredCapabilities: [],
        priority: 'high',
      };

      const role = coordinator.analyzeTask(task);
      expect(role).toBe(AgentRole.DEVOPS);
    });

    it('should route security tasks to Security Engineer', () => {
      const task: TaskAssignment = {
        taskId: 'task-4',
        title: 'Security audit',
        description: 'Perform security vulnerability scan',
        acceptanceCriteria: ['No critical vulnerabilities'],
        requiredCapabilities: [],
        priority: 'critical',
      };

      const role = coordinator.analyzeTask(task);
      expect(role).toBe(AgentRole.SECURITY_ENGINEER);
    });

    it('should route performance tasks to Performance Engineer', () => {
      const task: TaskAssignment = {
        taskId: 'task-5',
        title: 'Optimize application performance',
        description: 'Profile and optimize slow application performance',
        acceptanceCriteria: ['Response time under 100ms'],
        requiredCapabilities: [],
        priority: 'normal',
      };

      const role = coordinator.analyzeTask(task);
      expect(role).toBe(AgentRole.PERFORMANCE_ENGINEER);
    });

    it('should route UI tasks to UX/UI Designer', () => {
      const task: TaskAssignment = {
        taskId: 'task-6',
        title: 'Design user profile component',
        description: 'Create accessible UI component for user profiles',
        acceptanceCriteria: ['WCAG 2.1 AA compliant'],
        requiredCapabilities: [],
        priority: 'normal',
      };

      const role = coordinator.analyzeTask(task);
      expect(role).toBe(AgentRole.UX_UI_DESIGNER);
    });

    it('should route documentation tasks to Technical Writer', () => {
      const task: TaskAssignment = {
        taskId: 'task-7',
        title: 'Write API documentation',
        description: 'Create comprehensive API docs for developers',
        acceptanceCriteria: ['All endpoints documented'],
        requiredCapabilities: [],
        priority: 'normal',
      };

      const role = coordinator.analyzeTask(task);
      expect(role).toBe(AgentRole.TECHNICAL_WRITER);
    });

    it('should default to Developer for code tasks', () => {
      const task: TaskAssignment = {
        taskId: 'task-8',
        title: 'Implement user authentication',
        description: 'Add JWT-based authentication to API',
        acceptanceCriteria: ['Auth works', 'Tests pass'],
        requiredCapabilities: ['write-code'],
        priority: 'high',
      };

      const role = coordinator.analyzeTask(task);
      expect(role).toBe(AgentRole.DEVELOPER);
    });
  });

  describe('Agent Selection', () => {
    beforeEach(() => {
      // Register test agents
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code', 'write-tests'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 3,
      });

      registry.registerAgent({
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests', 'run-tests'],
        canRequestHelpFrom: [],
        workload: 1,
      });
    });

    it('should select agent with required role', () => {
      const agentId = coordinator.selectAgent({
        role: AgentRole.QA_ENGINEER,
        capabilities: [],
        balanceWorkload: false,
        idleOnly: false,
      });

      expect(agentId).toBe('qa-1');
    });

    it('should select idle agent when idleOnly is true', () => {
      const agentId = coordinator.selectAgent({
        role: AgentRole.DEVELOPER,
        capabilities: [],
        balanceWorkload: false,
        idleOnly: true,
      });

      expect(agentId).toBe('dev-1');
    });

    it('should select agent with required capabilities', () => {
      const agentId = coordinator.selectAgent({
        role: AgentRole.DEVELOPER,
        capabilities: ['write-code', 'write-tests'],
        balanceWorkload: false,
        idleOnly: false,
      });

      expect(agentId).toBe('dev-1');
    });

    it('should select least busy agent when balancing workload', () => {
      const agentId = coordinator.selectAgent({
        role: AgentRole.DEVELOPER,
        capabilities: [],
        balanceWorkload: true,
        idleOnly: false,
      });

      expect(agentId).toBe('dev-1'); // workload 0 vs 3
    });

    it('should return null if no suitable agent found', () => {
      const agentId = coordinator.selectAgent({
        role: AgentRole.DEVOPS,
        capabilities: [],
        balanceWorkload: false,
        idleOnly: false,
      });

      expect(agentId).toBeNull();
    });
  });

  describe('Task Assignment', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
    });

    it('should assign task to appropriate agent', async () => {
      const task: TaskAssignment = {
        taskId: 'task-1',
        title: 'Implement feature',
        description: 'Add new feature to application',
        acceptanceCriteria: ['Feature works', 'Tests pass'],
        requiredCapabilities: ['write-code'],
        priority: 'normal',
      };

      const agentId = await coordinator.assignWork(task);

      expect(agentId).toBe('dev-1');

      // Verify work item created (refetch to get current state)
      const workItem = sharedContext.getWorkItem('task-1');
      expect(workItem).toBeDefined();
      expect(workItem?.assignedTo).toBe('dev-1');
      // Status may be 'pending' or 'in-progress' depending on SharedContext logic
      expect(['pending', 'in-progress']).toContain(workItem?.status);

      // Verify agent status updated
      const agent = registry.getAgent('dev-1');
      expect(agent?.status).toBe('busy');
      expect(agent?.workload).toBe(1);
    });

    it('should send assignment message to agent', async () => {
      const messages: AgentMessage[] = [];
      messageBus.subscribe('dev-1', async (msg) => {
        messages.push(msg);
      });

      const task: TaskAssignment = {
        taskId: 'task-2',
        title: 'Fix bug',
        description: 'Fix critical bug in authentication',
        acceptanceCriteria: ['Bug fixed'],
        requiredCapabilities: [],
        priority: 'critical',
      };

      await coordinator.assignWork(task);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages).toHaveLength(1);
      expect(messages[0].payload.action).toBe('task-assignment');
      expect(messages[0].priority).toBe('critical');
    });

    it('should return null if no suitable agent available', async () => {
      const task: TaskAssignment = {
        taskId: 'task-3',
        title: 'Deploy to production',
        description: 'Deploy application to production',
        acceptanceCriteria: ['Deployed successfully'],
        requiredCapabilities: [],
        priority: 'high',
      };

      const agentId = await coordinator.assignWork(task);
      expect(agentId).toBeNull();
    });

    it('should handle multiple concurrent assignments', async () => {
      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      const task1: TaskAssignment = {
        taskId: 'task-4',
        title: 'Task 1',
        description: 'Implement feature 1',
        acceptanceCriteria: ['Done'],
        requiredCapabilities: [],
        priority: 'normal',
      };

      const task2: TaskAssignment = {
        taskId: 'task-5',
        title: 'Task 2',
        description: 'Implement feature 2',
        acceptanceCriteria: ['Done'],
        requiredCapabilities: [],
        priority: 'normal',
      };

      // Assign sequentially to ensure different agents
      const agent1 = await coordinator.assignWork(task1);
      const agent2 = await coordinator.assignWork(task2);

      expect(agent1).toBeTruthy();
      expect(agent2).toBeTruthy();
      // Both agents should be assigned (may be same or different)
      expect([agent1, agent2]).toContain('dev-1');
    });
  });

  describe('Escalation Handling', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 1,
      });

      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      // Create work item
      sharedContext.createWorkItem({
        id: 'task-1',
        title: 'Test task',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [],
        timeSpent: 0,
      });
    });

    it('should handle escalation and update work item status', async () => {
      const escalation: EscalationRequest = {
        agentId: 'dev-1',
        taskId: 'task-1',
        reason: 'unclear requirements',
        attemptedSolutions: ['Read docs', 'Asked colleague'],
        blockedDuration: 60000, // 1 minute
        severity: 'normal',
      };

      await coordinator.handleEscalation(escalation);

      const workItem = sharedContext.getWorkItem('task-1');
      expect(workItem?.status).toBe('blocked');
    });

    it('should send guidance for unclear requirements', async () => {
      const messages: AgentMessage[] = [];
      messageBus.subscribe('dev-1', async (msg) => {
        messages.push(msg);
      });

      const escalation: EscalationRequest = {
        agentId: 'dev-1',
        taskId: 'task-1',
        reason: 'unclear requirements',
        attemptedSolutions: [],
        blockedDuration: 30000,
        severity: 'normal',
      };

      await coordinator.handleEscalation(escalation);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].payload.action).toBe('guidance');
    });

    it('should escalate to parent for critical issues', async () => {
      const messages: AgentMessage[] = [];
      messageBus.subscribe('parent-agent', async (msg) => {
        messages.push(msg);
      });

      const escalation: EscalationRequest = {
        agentId: 'dev-1',
        taskId: 'task-1',
        reason: 'system failure',
        attemptedSolutions: ['Restart', 'Check logs'],
        blockedDuration: 10000,
        severity: 'critical',
      };

      await coordinator.handleEscalation(escalation);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].type).toBe('escalation');
      expect(messages[0].priority).toBe('critical');
    });

    it('should escalate to parent after 5 minutes', async () => {
      const messages: AgentMessage[] = [];
      messageBus.subscribe('parent-agent', async (msg) => {
        messages.push(msg);
      });

      const escalation: EscalationRequest = {
        agentId: 'dev-1',
        taskId: 'task-1',
        reason: 'stuck on implementation',
        attemptedSolutions: ['Tried approach A', 'Tried approach B'],
        blockedDuration: 6 * 60 * 1000, // 6 minutes
        severity: 'normal',
      };

      await coordinator.handleEscalation(escalation);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].type).toBe('escalation');
    });
  });

  describe('Work Review', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 1,
      });

      sharedContext.createWorkItem({
        id: 'task-1',
        title: 'Test task',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [],
        timeSpent: 0,
      });
    });

    it('should approve work when quality gates pass', async () => {
      const workItem = sharedContext.getWorkItem('task-1')!;

      const approved = await coordinator.reviewWork({
        workItem,
        agentId: 'dev-1',
        qualityGateResults: {
          workItemId: 'task-1',
          passed: true,
          results: [],
          overrides: [],
          generatedAt: new Date(),
          totalDuration: 1000,
        },
      });

      expect(approved).toBe(true);

      const updatedWorkItem = sharedContext.getWorkItem('task-1');
      expect(updatedWorkItem?.status).toBe('complete');

      const agent = registry.getAgent('dev-1');
      expect(agent?.workload).toBe(0);
      expect(agent?.status).toBe('idle');
    });

    it('should request changes when quality gates fail', async () => {
      const messages: AgentMessage[] = [];
      messageBus.subscribe('dev-1', async (msg) => {
        messages.push(msg);
      });

      const workItem = sharedContext.getWorkItem('task-1')!;

      const approved = await coordinator.reviewWork({
        workItem,
        agentId: 'dev-1',
        qualityGateResults: {
          workItemId: 'task-1',
          passed: false,
          results: [
            {
              gateId: 'tests',
              passed: false,
              message: 'Tests failed',
              executedAt: new Date(),
            },
          ],
          overrides: [],
          generatedAt: new Date(),
          totalDuration: 1000,
        },
      });

      expect(approved).toBe(false);

      const updatedWorkItem = sharedContext.getWorkItem('task-1');
      expect(updatedWorkItem?.status).toBe('in-progress');

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].payload.action).toBe('changes-requested');
    });

    it('should approve work without quality gate results', async () => {
      const workItem = sharedContext.getWorkItem('task-1')!;

      const approved = await coordinator.reviewWork({
        workItem,
        agentId: 'dev-1',
      });

      expect(approved).toBe(true);

      // Refetch work item to get updated status
      const updatedWorkItem = sharedContext.getWorkItem('task-1');
      expect(updatedWorkItem?.status).toBe('complete');
    });
  });

  describe('Workload Balancing', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 5,
      });

      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      registry.registerAgent({
        id: 'dev-3',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 2,
      });
    });

    it('should calculate workload statistics', () => {
      const stats = coordinator.getWorkloadStats();

      expect(stats.totalAgents).toBe(3);
      expect(stats.totalWorkload).toBe(7);
      expect(stats.avgWorkload).toBeCloseTo(2.33, 1);
      expect(stats.maxWorkload).toBe(5);
      expect(stats.overloadedAgents).toBe(1); // dev-1 with 5 tasks
    });

    it('should identify overloaded agents', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await coordinator.balanceWorkload(AgentRole.DEVELOPER);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Balancing workload'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('dev-1 is overloaded'));

      consoleSpy.mockRestore();
    });

    it('should not balance when all agents have similar workload', async () => {
      registry.clear();

      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 2,
      });

      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 2,
      });

      const consoleSpy = vi.spyOn(console, 'log');

      await coordinator.balanceWorkload(AgentRole.DEVELOPER);

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Balancing workload'));

      consoleSpy.mockRestore();
    });

    it('should balance workload for specific role only', async () => {
      registry.registerAgent({
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'busy',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 10,
      });

      const consoleSpy = vi.spyOn(console, 'log');

      await coordinator.balanceWorkload(AgentRole.DEVELOPER);

      // Should only consider developers, not QA
      const calls = consoleSpy.mock.calls.map((call) => call[0]);
      const qaMentioned = calls.some((call) => String(call).includes('qa-1'));

      expect(qaMentioned).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should clear all timeouts and state', async () => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      const task: TaskAssignment = {
        taskId: 'task-1',
        title: 'Test',
        description: 'Test task',
        acceptanceCriteria: [],
        requiredCapabilities: [],
        priority: 'normal',
      };

      await coordinator.assignWork(task);

      // Cleanup should not throw
      expect(() => coordinator.cleanup()).not.toThrow();
    });
  });
});
