import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageBus } from '@/multi-agent-system/lib/message-bus';
import { AgentRegistry } from '@/multi-agent-system/lib/agent-registry';
import { SharedContextManager } from '@/multi-agent-system/lib/shared-context';
import { QualityGatesSystem } from '@/multi-agent-system/lib/quality-gates';
import { TechLeadCoordinator } from '@/multi-agent-system/lib/tech-lead-coordinator';
import { AgentRole } from '@/multi-agent-system/lib/agent-definition-schema';
import type { AgentMessage } from '@/multi-agent-system/lib/types';
import type { WorkItem } from '@/multi-agent-system/lib/shared-context-types';
import type { QualityGate } from '@/multi-agent-system/lib/quality-gates-types';

/**
 * Integration Test: Task Assignment Workflow
 *
 * Tests the complete workflow:
 * 1. Tech Lead assigns task to Developer
 * 2. Developer completes work
 * 3. Quality gates run
 * 4. Tech Lead approves work
 */
describe('Integration: Task Assignment Workflow', () => {
  let messageBus: MessageBus;
  let registry: AgentRegistry;
  let sharedContext: SharedContextManager;
  let qualityGates: QualityGatesSystem;
  let techLead: TechLeadCoordinator;

  beforeEach(async () => {
    messageBus = new MessageBus();
    registry = new AgentRegistry();
    await registry.initialize();
    sharedContext = new SharedContextManager();
    qualityGates = new QualityGatesSystem();
    techLead = new TechLeadCoordinator(registry, messageBus, sharedContext);
  });

  afterEach(() => {
    messageBus.clear();
    registry.clear();
    sharedContext.clear();
    qualityGates.clear();
    techLead.cleanup();
  });

  it('should complete full task assignment workflow with passing quality gates', async () => {
    // Setup: Register a developer agent
    const developerId = 'dev-1';
    registry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    // Setup: Register quality gate for developers
    const testGate: QualityGate = {
      id: 'test-gate',
      name: 'Tests Pass',
      description: 'All tests must pass',
      requiredFor: [AgentRole.DEVELOPER],
      check: async (workItem: WorkItem) => {
        // Simulate test passing
        return workItem.artifacts.some((a) => a.type === 'test-results' && a.data.passed);
      },
      timeout: 5000,
      blocker: true,
    };
    qualityGates.registerGate(testGate);

    // Track messages received by developer
    const developerMessages: AgentMessage[] = [];

    // Subscribe BEFORE assigning tasks
    messageBus.subscribe(developerId, async (msg) => {
      developerMessages.push(msg);

      // Simulate developer completing work
      if (msg.payload.action === 'task-assignment') {
        const taskId = msg.payload.context.task.taskId;

        // Add test results artifact
        const workItem = sharedContext.getWorkItem(taskId);
        if (workItem) {
          sharedContext.addArtifact(workItem.id, {
            type: 'test-results',
            path: 'tests/feature.test.ts',
            data: { passed: true, coverage: 85 },
            createdAt: new Date(),
          });

          // Update work item status
          sharedContext.updateWorkItem(workItem.id, {
            status: 'review',
          });

          // Run quality gates and review work directly
          const report = await qualityGates.runGates(workItem, AgentRole.DEVELOPER);
          await techLead.reviewWork({
            workItem,
            agentId: developerId,
            qualityGateResults: report,
          });
        }
      }
    });

    // Wait for subscription to be fully registered
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Step 1: Tech Lead assigns task
    const assignedAgentId = await techLead.assignWork({
      taskId: 'task-1',
      title: 'Implement user authentication',
      description: 'Add login and registration functionality with proper validation',
      acceptanceCriteria: [
        'User can register with email and password',
        'User can login with credentials',
        'Code coverage >80%',
      ],
      requiredCapabilities: ['write-code'],
      priority: 'high',
      files: ['lib/auth.ts', 'lib/auth.spec.ts'],
    });

    // Wait for async message processing (including retry)
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Verify: Developer was assigned
    expect(assignedAgentId).toBe(developerId);

    // Verify: Developer received assignment message
    expect(developerMessages.length).toBeGreaterThanOrEqual(1);
    expect(developerMessages[0].payload.action).toBe('task-assignment');
    expect(developerMessages[0].payload.context.task.taskId).toBe('task-1');

    // Verify: Work item was created
    const workItem = sharedContext.getWorkItem('task-1');
    expect(workItem).toBeDefined();
    expect(workItem?.assignedTo).toBe(developerId);
    expect(workItem?.status).toBe('complete'); // Should be complete after review

    // Verify: Developer received approval
    const approvalMsg = developerMessages.find((m) => m.payload.action === 'work-approved');
    expect(approvalMsg).toBeDefined();

    // Verify: Agent status updated
    const agent = registry.getAgent(developerId);
    expect(agent?.status).toBe('idle'); // Back to idle after completion
    expect(agent?.workload).toBe(0); // Workload decreased
  });

  it('should handle quality gate failures and request changes', async () => {
    // Setup: Register a developer agent
    const developerId = 'dev-1';
    registry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    // Setup: Register quality gate that will fail
    const testGate: QualityGate = {
      id: 'test-gate',
      name: 'Tests Pass',
      description: 'All tests must pass',
      requiredFor: [AgentRole.DEVELOPER],
      check: async (workItem: WorkItem) => {
        // Simulate test failing
        return workItem.artifacts.some((a) => a.type === 'test-results' && a.data.passed);
      },
      timeout: 5000,
      blocker: true,
    };
    qualityGates.registerGate(testGate);

    // Track messages
    const developerMessages: AgentMessage[] = [];

    // Subscribe BEFORE assigning
    messageBus.subscribe(developerId, async (msg) => {
      developerMessages.push(msg);

      if (msg.payload.action === 'task-assignment') {
        const taskId = msg.payload.context.task.taskId;
        const workItem = sharedContext.getWorkItem(taskId);

        if (workItem) {
          // Add failing test results
          sharedContext.addArtifact(workItem.id, {
            type: 'test-results',
            path: 'tests/feature.test.ts',
            data: { passed: false, failures: 3 },
            createdAt: new Date(),
          });

          sharedContext.updateWorkItem(workItem.id, {
            status: 'review',
          });

          // Run quality gates and review work directly
          const report = await qualityGates.runGates(workItem, AgentRole.DEVELOPER);
          await techLead.reviewWork({
            workItem,
            agentId: developerId,
            qualityGateResults: report,
          });
        }
      }
    });

    // Wait for subscription to be fully registered
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assign task
    await techLead.assignWork({
      taskId: 'task-2',
      title: 'Fix bug in payment processing',
      description: 'Fix the payment validation logic and ensure proper error handling',
      acceptanceCriteria: ['Bug is fixed', 'All checks pass'],
      requiredCapabilities: ['write-code'],
      priority: 'critical',
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Verify: Developer received assignment and changes requested
    expect(developerMessages.length).toBeGreaterThanOrEqual(1);
    expect(developerMessages[0].payload.action).toBe('task-assignment');

    // Find the changes-requested message
    const changesMsg = developerMessages.find((m) => m.payload.action === 'changes-requested');
    expect(changesMsg).toBeDefined();
    expect(changesMsg?.payload.context.failedGates).toBeDefined();

    // Verify: Work item is back in progress
    const workItem = sharedContext.getWorkItem('task-2');
    expect(workItem?.status).toBe('in-progress');
  });

  it('should handle task assignment to QA engineer for testing', async () => {
    // Setup: Register QA engineer
    const qaId = 'qa-1';
    registry.registerAgent({
      id: qaId,
      role: AgentRole.QA_ENGINEER,
      status: 'idle',
      capabilities: ['write-tests', 'run-tests'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    // Setup: Quality gate for QA
    const coverageGate: QualityGate = {
      id: 'coverage-gate',
      name: 'Test Coverage',
      description: 'Coverage must be >= 60%',
      requiredFor: [AgentRole.QA_ENGINEER],
      check: async (workItem: WorkItem) => {
        const testArtifact = workItem.artifacts.find((a) => a.type === 'test-results');
        return testArtifact ? testArtifact.data.coverage >= 60 : false;
      },
      timeout: 5000,
      blocker: true,
    };
    qualityGates.registerGate(coverageGate);

    // Track messages
    const qaMessages: AgentMessage[] = [];

    // Subscribe BEFORE assigning
    messageBus.subscribe(qaId, async (msg) => {
      qaMessages.push(msg);

      if (msg.payload.action === 'task-assignment') {
        const taskId = msg.payload.context.task.taskId;
        const workItem = sharedContext.getWorkItem(taskId);

        if (workItem) {
          // QA adds test results with good coverage
          sharedContext.addArtifact(workItem.id, {
            type: 'test-results',
            path: 'tests/integration.test.ts',
            data: { passed: true, coverage: 75 },
            createdAt: new Date(),
          });

          sharedContext.updateWorkItem(workItem.id, {
            status: 'review',
          });

          // Run quality gates and review work directly
          const report = await qualityGates.runGates(workItem, AgentRole.QA_ENGINEER);
          await techLead.reviewWork({
            workItem,
            agentId: qaId,
            qualityGateResults: report,
          });
        }
      }
    });

    // Wait for subscription to be fully registered
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assign testing task
    const assignedAgentId = await techLead.assignWork({
      taskId: 'task-3',
      title: 'Write integration tests for API',
      description: 'Create comprehensive integration tests for the REST API endpoints',
      acceptanceCriteria: ['All endpoints tested', 'Coverage >= 60%'],
      requiredCapabilities: ['write-tests'],
      priority: 'normal',
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Verify: QA engineer was assigned
    expect(assignedAgentId).toBe(qaId);

    // Verify: QA received assignment and approval
    expect(qaMessages.length).toBeGreaterThanOrEqual(1);
    expect(qaMessages[0].payload.action).toBe('task-assignment');

    const approvalMsg = qaMessages.find((m) => m.payload.action === 'work-approved');
    expect(approvalMsg).toBeDefined();

    // Verify: Work item completed
    const workItem = sharedContext.getWorkItem('task-3');
    expect(workItem?.status).toBe('complete');
    expect(workItem?.artifacts).toHaveLength(1);
    expect(workItem?.artifacts[0].data.coverage).toBe(75);
  });

  it('should balance workload across multiple developers', async () => {
    // Setup: Register multiple developers
    const dev1Id = 'dev-1';
    const dev2Id = 'dev-2';

    registry.registerAgent({
      id: dev1Id,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    registry.registerAgent({
      id: dev2Id,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    // Assign multiple tasks
    const task1Agent = await techLead.assignWork({
      taskId: 'task-1',
      title: 'Task 1',
      description: 'Implement feature 1',
      acceptanceCriteria: ['Feature works'],
      requiredCapabilities: ['write-code'],
      priority: 'normal',
    });

    const task2Agent = await techLead.assignWork({
      taskId: 'task-2',
      title: 'Task 2',
      description: 'Implement feature 2',
      acceptanceCriteria: ['Feature works'],
      requiredCapabilities: ['write-code'],
      priority: 'normal',
    });

    const task3Agent = await techLead.assignWork({
      taskId: 'task-3',
      title: 'Task 3',
      description: 'Implement feature 3',
      acceptanceCriteria: ['Feature works'],
      requiredCapabilities: ['write-code'],
      priority: 'normal',
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: Tasks distributed across both developers
    const assignedAgents = [task1Agent, task2Agent, task3Agent];
    expect(assignedAgents).toContain(dev1Id);
    expect(assignedAgents).toContain(dev2Id);

    // Verify: Workload is balanced
    const dev1 = registry.getAgent(dev1Id);
    const dev2 = registry.getAgent(dev2Id);

    expect(dev1?.workload).toBeGreaterThan(0);
    expect(dev2?.workload).toBeGreaterThan(0);

    // Total workload should be 3
    expect((dev1?.workload || 0) + (dev2?.workload || 0)).toBe(3);

    // Check workload stats
    const stats = techLead.getWorkloadStats();
    expect(stats.totalAgents).toBe(2);
    expect(stats.totalWorkload).toBe(3);
    expect(stats.avgWorkload).toBe(1.5);
  });
});
