import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageBus } from '@/multi-agent-system/lib/message-bus';
import { AgentRegistry } from '@/multi-agent-system/lib/agent-registry';
import { SharedContextManager } from '@/multi-agent-system/lib/shared-context';
import { QualityGatesSystem } from '@/multi-agent-system/lib/quality-gates';
import { WorkflowEngine } from '@/multi-agent-system/lib/workflow-engine';
import { AgentRole } from '@/multi-agent-system/lib/agent-definition-schema';
import type { AgentMessage } from '@/multi-agent-system/lib/types';
import type { WorkflowEvent } from '@/multi-agent-system/lib/workflow-types';

/**
 * Integration Test: Workflow Automation
 *
 * Tests automated workflows:
 * 1. Feature Complete → QA Testing
 * 2. Test Failure → Bug Fix
 * 3. Quality Gate Failure → Developer Fix
 */
describe('Integration: Workflow Automation', () => {
  let messageBus: MessageBus;
  let registry: AgentRegistry;
  let sharedContext: SharedContextManager;
  let qualityGates: QualityGatesSystem;
  let workflowEngine: WorkflowEngine;

  beforeEach(async () => {
    // Use fast retries for tests (10ms instead of 1000ms)
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
    registry = new AgentRegistry();
    await registry.initialize();
    sharedContext = new SharedContextManager();
    qualityGates = new QualityGatesSystem();
    workflowEngine = new WorkflowEngine(messageBus, registry);
  });

  afterEach(() => {
    messageBus.clear();
    registry.clear();
    sharedContext.clear();
    qualityGates.clear();
    workflowEngine.clearRules();
    workflowEngine.clearTasks();
  });

  it('should automatically route feature to QA after completion with passing quality gates', async () => {
    // Setup: Register developer and QA engineer
    const developerId = 'dev-1';
    const qaId = 'qa-1';

    registry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    registry.registerAgent({
      id: qaId,
      role: AgentRole.QA_ENGINEER,
      status: 'idle',
      capabilities: ['write-tests', 'run-tests'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    // Track messages to QA engineer
    const qaMessages: AgentMessage[] = [];
    messageBus.subscribe(qaId, async (msg) => {
      qaMessages.push(msg);
    });

    // Trigger workflow: Feature complete with passing quality gates
    const event: WorkflowEvent = {
      type: 'feature-complete',
      data: {
        workItemId: 'work-1',
        agentId: developerId,
        qualityGateResults: {
          workItemId: 'work-1',
          passed: true,
          results: [],
          overrides: [],
          generatedAt: new Date(),
          totalDuration: 100,
        },
      },
      timestamp: new Date(),
    };

    await workflowEngine.processEvent(event);

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: QA engineer received test-feature request
    expect(qaMessages).toHaveLength(1);
    expect(qaMessages[0].payload.action).toBe('test-feature');
    const context101 = qaMessages[0].payload.context as { event?: { type?: string } };
    expect(context101?.event?.type).toBe('feature-complete');
    expect(qaMessages[0].priority).toBe('high'); // Priority 80 maps to high
  });

  it('should not route to QA if quality gates failed', async () => {
    // Setup: Register QA engineer
    const qaId = 'qa-1';
    registry.registerAgent({
      id: qaId,
      role: AgentRole.QA_ENGINEER,
      status: 'idle',
      capabilities: ['write-tests'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    const qaMessages: AgentMessage[] = [];
    messageBus.subscribe(qaId, async (msg) => {
      qaMessages.push(msg);
    });

    // Trigger workflow: Feature complete but quality gates failed
    const event: WorkflowEvent = {
      type: 'feature-complete',
      data: {
        workItemId: 'work-1',
        agentId: 'dev-1',
        qualityGateResults: {
          workItemId: 'work-1',
          passed: false, // Failed
          results: [],
          overrides: [],
          generatedAt: new Date(),
          totalDuration: 100,
        },
      },
      timestamp: new Date(),
    };

    await workflowEngine.processEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: QA engineer did NOT receive message (condition not met)
    expect(qaMessages).toHaveLength(0);
  });

  it('should automatically assign bug fix to developer on test failure', async () => {
    // Setup: Register developer
    const developerId = 'dev-1';
    registry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code', 'fix-bugs'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    const developerMessages: AgentMessage[] = [];
    messageBus.subscribe(developerId, async (msg) => {
      developerMessages.push(msg);
    });

    // Trigger workflow: Test failure
    const event: WorkflowEvent = {
      type: 'test-failure',
      data: {
        workItemId: 'work-1',
        agentId: 'qa-1',
        testResults: {
          passed: false,
          failures: [
            { test: 'login test', error: 'Expected 200, got 401' },
            { test: 'registration test', error: 'Validation failed' },
          ],
        },
      },
      timestamp: new Date(),
    };

    await workflowEngine.processEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: Developer received fix-bug request
    expect(developerMessages).toHaveLength(1);
    expect(developerMessages[0].payload.action).toBe('fix-bug');
    expect(developerMessages[0].priority).toBe('critical'); // Priority 90 maps to critical
    const context188 = developerMessages[0].payload.context as {
      event?: { data?: { testResults?: unknown } };
    };
    expect(context188?.event?.data?.testResults).toBeDefined();
  });

  it('should handle complete feature → QA → bug fix → retest workflow', async () => {
    // Setup: Register developer and QA engineer
    const developerId = 'dev-1';
    const qaId = 'qa-1';

    registry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code', 'fix-bugs'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    registry.registerAgent({
      id: qaId,
      role: AgentRole.QA_ENGINEER,
      status: 'idle',
      capabilities: ['write-tests', 'run-tests'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    const developerMessages: AgentMessage[] = [];
    const qaMessages: AgentMessage[] = [];

    messageBus.subscribe(developerId, async (msg) => {
      developerMessages.push(msg);
    });

    messageBus.subscribe(qaId, async (msg) => {
      qaMessages.push(msg);
    });

    // Step 1: Feature complete → QA testing
    const featureCompleteEvent: WorkflowEvent = {
      type: 'feature-complete',
      data: {
        workItemId: 'work-1',
        agentId: developerId,
        qualityGateResults: {
          workItemId: 'work-1',
          passed: true,
          results: [],
          overrides: [],
          generatedAt: new Date(),
          totalDuration: 100,
        },
      },
      timestamp: new Date(),
    };

    await workflowEngine.processEvent(featureCompleteEvent);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: QA received test request
    expect(qaMessages).toHaveLength(1);
    expect(qaMessages[0].payload.action).toBe('test-feature');

    // Step 2: Test failure → Bug fix
    const testFailureEvent: WorkflowEvent = {
      type: 'test-failure',
      data: {
        workItemId: 'work-1',
        agentId: qaId,
        testResults: {
          passed: false,
          failures: [{ test: 'integration test', error: 'API returned 500' }],
        },
      },
      timestamp: new Date(),
    };

    await workflowEngine.processEvent(testFailureEvent);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: Developer received bug fix request
    expect(developerMessages).toHaveLength(1);
    expect(developerMessages[0].payload.action).toBe('fix-bug');

    // Step 3: Bug fixed → QA retesting
    const bugFixedEvent: WorkflowEvent = {
      type: 'feature-complete',
      data: {
        workItemId: 'work-1',
        agentId: developerId,
        qualityGateResults: {
          workItemId: 'work-1',
          passed: true,
          results: [],
          overrides: [],
          generatedAt: new Date(),
          totalDuration: 100,
        },
      },
      timestamp: new Date(),
    };

    await workflowEngine.processEvent(bugFixedEvent);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: QA received retest request
    expect(qaMessages).toHaveLength(2);
    expect(qaMessages[1].payload.action).toBe('test-feature');

    // Verify: Complete workflow executed
    expect(developerMessages).toHaveLength(1); // Bug fix request
    expect(qaMessages).toHaveLength(2); // Initial test + retest
  });

  it('should route quality gate failures back to developer', async () => {
    // Setup: Register developer
    const developerId = 'dev-1';
    registry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    const developerMessages: AgentMessage[] = [];
    messageBus.subscribe(developerId, async (msg) => {
      developerMessages.push(msg);
    });

    // Trigger workflow: Quality gate failure
    const event: WorkflowEvent = {
      type: 'quality-gate-failure',
      data: {
        workItemId: 'work-1',
        agentId: developerId,
        qualityGateResults: {
          workItemId: 'work-1',
          passed: false,
          results: [
            {
              gateId: 'test-gate',
              passed: false,
              message: 'Tests failed',
              executedAt: new Date(),
              duration: 100,
              timedOut: false,
            },
          ],
          overrides: [],
          generatedAt: new Date(),
          totalDuration: 100,
        },
      },
      timestamp: new Date(),
    };

    await workflowEngine.processEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: Developer received fix request
    expect(developerMessages).toHaveLength(1);
    expect(developerMessages[0].payload.action).toBe('fix-quality-issues');
    expect(developerMessages[0].priority).toBe('high'); // Priority 85 maps to high
  });

  it('should escalate blocked tasks to tech lead after 5 minutes', async () => {
    // Setup: Register tech lead
    const techLeadId = 'tech-lead-1';
    registry.registerAgent({
      id: techLeadId,
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: ['coordinate', 'resolve-blockers'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    const techLeadMessages: AgentMessage[] = [];
    messageBus.subscribe(techLeadId, async (msg) => {
      techLeadMessages.push(msg);
    });

    // Trigger workflow: Task blocked for >5 minutes
    const event: WorkflowEvent = {
      type: 'task-blocked',
      data: {
        workItemId: 'work-1',
        agentId: 'dev-1',
        blocker: {
          reason: 'Unclear requirements',
          duration: 400, // 400 seconds = 6.67 minutes
        },
      },
      timestamp: new Date(),
    };

    await workflowEngine.processEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: Tech lead received escalation
    expect(techLeadMessages).toHaveLength(1);
    expect(techLeadMessages[0].payload.action).toBe('resolve-blocker');
    expect(techLeadMessages[0].priority).toBe('critical'); // Priority 95 maps to critical
  });

  it('should not escalate blocked tasks under 5 minutes', async () => {
    // Setup: Register tech lead
    const techLeadId = 'tech-lead-1';
    registry.registerAgent({
      id: techLeadId,
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: ['coordinate'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    const techLeadMessages: AgentMessage[] = [];
    messageBus.subscribe(techLeadId, async (msg) => {
      techLeadMessages.push(msg);
    });

    // Trigger workflow: Task blocked for <5 minutes
    const event: WorkflowEvent = {
      type: 'task-blocked',
      data: {
        workItemId: 'work-1',
        agentId: 'dev-1',
        blocker: {
          reason: 'Waiting for dependency',
          duration: 200, // 200 seconds = 3.33 minutes
        },
      },
      timestamp: new Date(),
    };

    await workflowEngine.processEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: Tech lead did NOT receive escalation (condition not met)
    expect(techLeadMessages).toHaveLength(0);
  });

  it('should route schema changes to data architect', async () => {
    // Setup: Register data architect
    const architectId = 'architect-1';
    registry.registerAgent({
      id: architectId,
      role: AgentRole.DATA_ARCHITECT,
      status: 'idle',
      capabilities: ['design-schema', 'create-migrations'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    const architectMessages: AgentMessage[] = [];
    messageBus.subscribe(architectId, async (msg) => {
      architectMessages.push(msg);
    });

    // Trigger workflow: Schema change request
    const event: WorkflowEvent = {
      type: 'schema-change-request',
      data: {
        workItemId: 'work-1',
        agentId: 'dev-1',
        schemaChange: {
          table: 'users',
          changes: ['Add email_verified column', 'Add index on email'],
        },
      },
      timestamp: new Date(),
    };

    await workflowEngine.processEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: Data architect received review request
    expect(architectMessages).toHaveLength(1);
    expect(architectMessages[0].payload.action).toBe('review-schema-change');
    expect(architectMessages[0].priority).toBe('high'); // Priority 85 maps to high
  });

  it('should route migration completion to DevOps', async () => {
    // Setup: Register DevOps
    const devopsId = 'devops-1';
    registry.registerAgent({
      id: devopsId,
      role: AgentRole.DEVOPS,
      status: 'idle',
      capabilities: ['deploy', 'manage-pipeline'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    const devopsMessages: AgentMessage[] = [];
    messageBus.subscribe(devopsId, async (msg) => {
      devopsMessages.push(msg);
    });

    // Trigger workflow: Migration complete
    const event: WorkflowEvent = {
      type: 'migration-complete',
      data: {
        workItemId: 'work-1',
        agentId: 'architect-1',
        migration: {
          id: '20240101_add_users_table',
          status: 'applied',
        },
      },
      timestamp: new Date(),
    };

    await workflowEngine.processEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: DevOps received pipeline update request
    expect(devopsMessages).toHaveLength(1);
    expect(devopsMessages[0].payload.action).toBe('update-pipeline');
    expect(devopsMessages[0].priority).toBe('high'); // Priority 75 maps to high
  });

  it('should handle multiple concurrent workflow events', async () => {
    // Setup: Register multiple agents
    registry.registerAgent({
      id: 'dev-1',
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    registry.registerAgent({
      id: 'qa-1',
      role: AgentRole.QA_ENGINEER,
      status: 'idle',
      capabilities: ['write-tests'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    registry.registerAgent({
      id: 'architect-1',
      role: AgentRole.DATA_ARCHITECT,
      status: 'idle',
      capabilities: ['design-schema'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    const allMessages: AgentMessage[] = [];
    messageBus.subscribe('dev-1', async (msg) => {
      allMessages.push(msg);
    });
    messageBus.subscribe('qa-1', async (msg) => {
      allMessages.push(msg);
    });
    messageBus.subscribe('architect-1', async (msg) => {
      allMessages.push(msg);
    });

    // Trigger multiple events concurrently
    const events: WorkflowEvent[] = [
      {
        type: 'test-failure',
        data: { workItemId: 'work-1', agentId: 'qa-1' },
        timestamp: new Date(),
      },
      {
        type: 'feature-complete',
        data: {
          workItemId: 'work-2',
          agentId: 'dev-1',
          qualityGateResults: {
            workItemId: 'work-2',
            passed: true,
            results: [],
            overrides: [],
            generatedAt: new Date(),
            totalDuration: 100,
          },
        },
        timestamp: new Date(),
      },
      {
        type: 'schema-change-request',
        data: { workItemId: 'work-3', agentId: 'dev-1' },
        timestamp: new Date(),
      },
    ];

    await Promise.all(events.map((e) => workflowEngine.processEvent(e)));
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify: All events processed and routed correctly
    expect(allMessages.length).toBeGreaterThanOrEqual(3);

    const actions = allMessages.map((m) => m.payload.action);
    expect(actions).toContain('fix-bug'); // test-failure → developer
    expect(actions).toContain('test-feature'); // feature-complete → QA
    expect(actions).toContain('review-schema-change'); // schema-change → architect
  });
});
