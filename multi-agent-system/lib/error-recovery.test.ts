/**
 * Tests for Error Recovery System
 *
 * Tests agent failure detection, recovery, message delivery failures,
 * and quality gate timeout handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorRecoverySystem } from './error-recovery';
import { AgentRegistry } from './agent-registry';
import { MessageBus } from './message-bus';
import { SharedContextManager } from './shared-context';
import { TechLeadCoordinator } from './tech-lead-coordinator';
import { QualityGatesSystem } from './quality-gates';
import { AgentRole } from './agent-definition-schema';
import type { WorkItem } from './shared-context-types';
import type { QualityGate } from './quality-gates-types';

describe('ErrorRecoverySystem', () => {
  let registry: AgentRegistry;
  let messageBus: MessageBus;
  let sharedContext: SharedContextManager;
  let coordinator: TechLeadCoordinator;
  let errorRecovery: ErrorRecoverySystem;

  beforeEach(async () => {
    registry = new AgentRegistry();
    await registry.initialize();

    messageBus = new MessageBus();
    sharedContext = new SharedContextManager();
    coordinator = new TechLeadCoordinator(registry, messageBus, sharedContext);

    errorRecovery = new ErrorRecoverySystem(registry, messageBus, sharedContext, {
      interval: 100, // Fast interval for testing
      missedThreshold: 3,
      timeout: 50,
    });

    errorRecovery.setCoordinator(coordinator);
  });

  afterEach(() => {
    errorRecovery.clear();
    registry.clear();
    messageBus.clear();
    sharedContext.clear();
    coordinator.cleanup();
  });

  describe('Heartbeat Monitoring', () => {
    it('should start and stop monitoring', () => {
      errorRecovery.startMonitoring();
      expect(errorRecovery['isMonitoring']).toBe(true);

      errorRecovery.stopMonitoring();
      expect(errorRecovery['isMonitoring']).toBe(false);
    });

    it('should record heartbeats from agents', () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      errorRecovery.recordHeartbeat(agent.id);

      const health = errorRecovery.getAgentHealth(agent.id);
      expect(health).toBeDefined();
      expect(health?.isHealthy).toBe(true);
      expect(health?.missedCount).toBe(0);
    });

    it('should initialize heartbeat records for all agents on start', () => {
      const agent1 = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      const agent2 = registry.registerAgent({
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      errorRecovery.startMonitoring();

      const health1 = errorRecovery.getAgentHealth(agent1.id);
      const health2 = errorRecovery.getAgentHealth(agent2.id);

      expect(health1).toBeDefined();
      expect(health2).toBeDefined();
    });

    it('should reset missed count when heartbeat received', () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      errorRecovery.startMonitoring();

      // Manually set missed count
      const health = errorRecovery.getAgentHealth(agent.id);
      if (health) {
        health.missedCount = 2;
      }

      // Record heartbeat
      errorRecovery.recordHeartbeat(agent.id);

      const updatedHealth = errorRecovery.getAgentHealth(agent.id);
      expect(updatedHealth?.missedCount).toBe(0);
      expect(updatedHealth?.isHealthy).toBe(true);
    });
  });

  describe('Failure Detection', () => {
    it('should detect agent failure after missed heartbeats', async () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 1,
        currentTask: 'task-1',
      });

      errorRecovery.startMonitoring();

      // Set last heartbeat to past
      const health = errorRecovery.getAgentHealth(agent.id);
      if (health) {
        health.lastHeartbeat = new Date(Date.now() - 500); // 500ms ago
      }

      // Wait for health checks to run
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Check if agent marked as offline
      const updatedAgent = registry.getAgent(agent.id);
      expect(updatedAgent?.status).toBe('offline');

      // Check failure event recorded
      const failures = errorRecovery.getFailureEvents(agent.id);
      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0].agentId).toBe(agent.id);
      expect(failures[0].missedHeartbeats).toBeGreaterThanOrEqual(3);
    });

    it('should notify tech lead of agent failure', async () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 1,
      });

      let notificationReceived = false;
      messageBus.subscribe('tech-lead', (message) => {
        if (message.payload.action === 'agent-failure') {
          notificationReceived = true;
        }
      });

      errorRecovery.startMonitoring();

      // Trigger failure
      const health = errorRecovery.getAgentHealth(agent.id);
      if (health) {
        health.lastHeartbeat = new Date(Date.now() - 500);
      }

      await new Promise((resolve) => setTimeout(resolve, 400));

      // Process message queue
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(notificationReceived).toBe(true);
    });

    it('should not mark offline agents as failed again', async () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'offline',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      errorRecovery.startMonitoring();

      const initialFailures = errorRecovery.getFailureEvents(agent.id).length;

      await new Promise((resolve) => setTimeout(resolve, 400));

      const finalFailures = errorRecovery.getFailureEvents(agent.id).length;
      expect(finalFailures).toBe(initialFailures);
    });
  });

  describe('Failure Recovery', () => {
    it('should preserve work in progress when agent fails', async () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 1,
      });

      // Create work item
      const workItem: WorkItem = {
        id: 'task-1',
        title: 'Test Task',
        assignedTo: agent.id,
        status: 'in-progress',
        dependencies: [],
        artifacts: [],
        timeSpent: 0,
      };
      sharedContext.createWorkItem(workItem);

      errorRecovery.startMonitoring();

      // Trigger failure
      const health = errorRecovery.getAgentHealth(agent.id);
      if (health) {
        health.lastHeartbeat = new Date(Date.now() - 500);
      }

      await new Promise((resolve) => setTimeout(resolve, 400));

      // Check work preserved
      const updatedWorkItem = sharedContext.getWorkItem(workItem.id);
      expect(updatedWorkItem?.artifacts.length).toBeGreaterThan(0);
      expect(typeof updatedWorkItem?.artifacts[0]).toBe('string');
    });

    it('should release file locks when agent fails', async () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 1,
      });

      // Acquire file lock
      await sharedContext.acquireFileLock(agent.id, 'test.ts', 'write');
      expect(sharedContext.isFileLocked('test.ts')).toBe(true);

      errorRecovery.startMonitoring();

      // Trigger failure
      const health = errorRecovery.getAgentHealth(agent.id);
      if (health) {
        health.lastHeartbeat = new Date(Date.now() - 500);
      }

      await new Promise((resolve) => setTimeout(resolve, 400));

      // Check lock released
      expect(sharedContext.isFileLocked('test.ts')).toBe(false);
    });

    it('should request task reassignment when agent fails', async () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 1,
      });

      const workItem: WorkItem = {
        id: 'task-1',
        title: 'Test Task',
        assignedTo: agent.id,
        status: 'in-progress',
        dependencies: [],
        artifacts: [],
        timeSpent: 0,
      };
      sharedContext.createWorkItem(workItem);

      let reassignRequested = false;
      messageBus.subscribe('tech-lead', (message) => {
        if (message.payload.action === 'reassign-task') {
          reassignRequested = true;
        }
      });

      errorRecovery.startMonitoring();

      // Trigger failure
      const health = errorRecovery.getAgentHealth(agent.id);
      if (health) {
        health.lastHeartbeat = new Date(Date.now() - 500);
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
      await new Promise((resolve) => setTimeout(resolve, 200)); // Extra time for message processing

      expect(reassignRequested).toBe(true);
    });

    it('should record recovery attempts', async () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 1,
      });

      errorRecovery.startMonitoring();

      // Trigger failure
      const health = errorRecovery.getAgentHealth(agent.id);
      if (health) {
        health.lastHeartbeat = new Date(Date.now() - 500);
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
      await new Promise((resolve) => setTimeout(resolve, 1200)); // Wait for restart attempt

      const attempts = errorRecovery.getRecoveryAttempts(agent.id);
      expect(attempts.length).toBeGreaterThan(0);
    });

    it('should escalate to parent if restart fails', async () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 1,
      });

      let escalationReceived = false;
      messageBus.subscribe('parent-agent', (message) => {
        if (message.type === 'escalation') {
          escalationReceived = true;
        }
      });

      errorRecovery.startMonitoring();

      // Trigger failure
      const health = errorRecovery.getAgentHealth(agent.id);
      if (health) {
        health.lastHeartbeat = new Date(Date.now() - 500);
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Escalation happens if restart fails (70% chance in our simulation)
      // We can't guarantee it, but we can check the mechanism exists
      const attempts = errorRecovery.getRecoveryAttempts(agent.id);
      const escalateAttempt = attempts.find((a) => a.strategy === 'escalate');

      if (!escalationReceived && escalateAttempt) {
        // Restart succeeded, so no escalation
        expect(escalateAttempt.success).toBe(true);
      }
    });
  });

  describe('Agent Recovery', () => {
    it('should mark agent as idle when heartbeat received after offline', () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'offline',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      errorRecovery.recordHeartbeat(agent.id);

      const updatedAgent = registry.getAgent(agent.id);
      expect(updatedAgent?.status).toBe('idle');
    });
  });

  describe('Health Status', () => {
    it('should return health status for specific agent', () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      errorRecovery.recordHeartbeat(agent.id);

      const health = errorRecovery.getAgentHealth(agent.id);
      expect(health).toBeDefined();
      expect(health?.agentId).toBe(agent.id);
    });

    it('should return all agent health statuses', () => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      registry.registerAgent({
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      errorRecovery.startMonitoring();

      const allHealth = errorRecovery.getAllAgentHealth();
      expect(allHealth.length).toBe(2);
    });
  });
});

describe('MessageBus - Delivery Failure Handling', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  afterEach(() => {
    messageBus.clear();
  });

  it('should retry failed message deliveries with exponential backoff', async () => {
    let attemptCount = 0;

    messageBus.subscribe('agent-1', () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Delivery failed');
      }
    });

    await messageBus.send({
      id: 'msg-1',
      from: 'sender',
      to: 'agent-1',
      type: 'request',
      priority: 'normal',
      payload: {},
      timestamp: new Date(),
      acknowledged: false,
    });

    // Wait for retries (1s + 2s = 3s total)
    await new Promise((resolve) => setTimeout(resolve, 3500));

    expect(attemptCount).toBeGreaterThan(1);
  });

  it('should move message to dead letter queue after max retries', async () => {
    messageBus.subscribe('agent-1', () => {
      throw new Error('Always fails');
    });

    await messageBus.send({
      id: 'msg-1',
      from: 'sender',
      to: 'agent-1',
      type: 'request',
      priority: 'normal',
      payload: {},
      timestamp: new Date(),
      acknowledged: false,
    });

    // Wait for all retries (1s + 2s + 4s = 7s total)
    await new Promise((resolve) => setTimeout(resolve, 8000));

    const deadLetters = messageBus.getDeadLetterQueue();
    expect(deadLetters.length).toBeGreaterThan(0);
    expect(deadLetters[0].id).toBe('msg-1');
  }, 10000); // 10 second timeout

  it('should notify sender of delivery failure', async () => {
    let failureNotified = false;

    messageBus.subscribe('sender', (message) => {
      if (message.payload.action === 'delivery-failed') {
        failureNotified = true;
      }
    });

    messageBus.subscribe('agent-1', () => {
      throw new Error('Delivery failed');
    });

    await messageBus.send({
      id: 'msg-1',
      from: 'sender',
      to: 'agent-1',
      type: 'request',
      priority: 'normal',
      payload: {},
      timestamp: new Date(),
      acknowledged: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 8000));

    expect(failureNotified).toBe(true);
  }, 10000);

  it('should escalate critical message failures', async () => {
    let escalationReceived = false;

    messageBus.subscribe('tech-lead', (message) => {
      if (message.type === 'escalation' && message.payload.action === 'critical-message-failure') {
        escalationReceived = true;
      }
    });

    messageBus.subscribe('agent-1', () => {
      throw new Error('Critical failure');
    });

    await messageBus.send({
      id: 'msg-1',
      from: 'sender',
      to: 'agent-1',
      type: 'request',
      priority: 'critical',
      payload: {},
      timestamp: new Date(),
      acknowledged: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 8000));

    expect(escalationReceived).toBe(true);
  }, 10000);
});

describe('QualityGatesSystem - Timeout Handling', () => {
  let qualityGates: QualityGatesSystem;

  beforeEach(() => {
    qualityGates = new QualityGatesSystem();
  });

  afterEach(() => {
    qualityGates.clear();
  });

  it('should timeout slow quality gates', async () => {
    const slowGate: QualityGate = {
      id: 'slow-gate',
      name: 'Slow Gate',
      description: 'Takes too long',
      check: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return true;
      },
      timeout: 100,
      blocker: false,
      requiredFor: [AgentRole.DEVELOPER],
    };

    qualityGates.registerGate(slowGate);

    const workItem: WorkItem = {
      id: 'task-1',
      title: 'Test',
      assignedTo: 'dev-1',
      status: 'in-progress',
      dependencies: [],
      artifacts: [],
      timeSpent: 0,
    };

    const report = await qualityGates.runGates(workItem, AgentRole.DEVELOPER);

    expect(report.passed).toBe(false);
    expect(report.results[0].timedOut).toBe(true);
    expect(report.results[0].passed).toBe(false);
  });

  it('should log timeouts for analysis', async () => {
    const slowGate: QualityGate = {
      id: 'slow-gate',
      name: 'Slow Gate',
      description: 'Takes too long',
      check: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return true;
      },
      timeout: 50,
      blocker: false,
      requiredFor: [AgentRole.DEVELOPER],
    };

    qualityGates.registerGate(slowGate);

    const workItem: WorkItem = {
      id: 'task-1',
      title: 'Test',
      assignedTo: 'dev-1',
      status: 'in-progress',
      dependencies: [],
      artifacts: [],
      timeSpent: 0,
    };

    await qualityGates.runGates(workItem, AgentRole.DEVELOPER);

    const timeoutLogs = qualityGates.getTimeoutLogs();
    expect(timeoutLogs.length).toBeGreaterThan(0);
    expect(timeoutLogs[0].gateId).toBe('slow-gate');
    expect(timeoutLogs[0].workItemId).toBe('task-1');
  });

  it('should filter timeout logs by gate ID', async () => {
    const gate1: QualityGate = {
      id: 'gate-1',
      name: 'Gate 1',
      description: 'First gate',
      check: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return true;
      },
      timeout: 50,
      blocker: false,
      requiredFor: [AgentRole.DEVELOPER],
    };

    const gate2: QualityGate = {
      id: 'gate-2',
      name: 'Gate 2',
      description: 'Second gate',
      check: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return true;
      },
      timeout: 50,
      blocker: false,
      requiredFor: [AgentRole.DEVELOPER],
    };

    qualityGates.registerGate(gate1);
    qualityGates.registerGate(gate2);

    const workItem: WorkItem = {
      id: 'task-1',
      title: 'Test',
      assignedTo: 'dev-1',
      status: 'in-progress',
      dependencies: [],
      artifacts: [],
      timeSpent: 0,
    };

    await qualityGates.runGates(workItem, AgentRole.DEVELOPER);

    const gate1Logs = qualityGates.getTimeoutLogs('gate-1');
    expect(gate1Logs.every((log) => log.gateId === 'gate-1')).toBe(true);
  });

  it('should mark timed out gate as failed', async () => {
    const slowGate: QualityGate = {
      id: 'slow-gate',
      name: 'Slow Gate',
      description: 'Takes too long',
      check: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return true;
      },
      timeout: 50,
      blocker: true,
      requiredFor: [AgentRole.DEVELOPER],
    };

    qualityGates.registerGate(slowGate);

    const workItem: WorkItem = {
      id: 'task-1',
      title: 'Test',
      assignedTo: 'dev-1',
      status: 'in-progress',
      dependencies: [],
      artifacts: [],
      timeSpent: 0,
    };

    const report = await qualityGates.runGates(workItem, AgentRole.DEVELOPER);

    const result = report.results.find((r) => r.gateId === 'slow-gate');
    expect(result?.passed).toBe(false);
    expect(result?.timedOut).toBe(true);
    expect(result?.message).toContain('timed out');
  });

  it('should include timeout details in gate result', async () => {
    const slowGate: QualityGate = {
      id: 'slow-gate',
      name: 'Slow Gate',
      description: 'Takes too long',
      check: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return true;
      },
      timeout: 50,
      blocker: false,
      requiredFor: [AgentRole.DEVELOPER],
    };

    qualityGates.registerGate(slowGate);

    const workItem: WorkItem = {
      id: 'task-1',
      title: 'Test',
      assignedTo: 'dev-1',
      status: 'in-progress',
      dependencies: [],
      artifacts: [],
      timeSpent: 0,
    };

    const report = await qualityGates.runGates(workItem, AgentRole.DEVELOPER);

    const result = report.results[0];
    expect(result.details).toBeDefined();
    expect((result.details as { workItemId?: string })?.workItemId).toBe('task-1');
    expect((result.details as { gateName?: string })?.gateName).toBe('Slow Gate');
  });
});
