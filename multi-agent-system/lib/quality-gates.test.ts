import { describe, it, expect, beforeEach } from 'vitest';
import { QualityGatesSystem } from './quality-gates';
import { QualityGate, GateResult } from './quality-gates-types';
import { WorkItem } from './shared-context-types';
import { AgentRole } from './agent-definition-schema';

describe('QualityGatesSystem', () => {
  let system: QualityGatesSystem;

  beforeEach(() => {
    system = new QualityGatesSystem();
  });

  describe('registerGate', () => {
    it('should register a valid gate', () => {
      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'A test gate',
        check: async () => true,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate);

      const retrieved = system.getGate('test-gate');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-gate');
    });

    it('should throw error for duplicate gate ID', () => {
      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'A test gate',
        check: async () => true,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate);

      expect(() => system.registerGate(gate)).toThrow(
        "Gate with id 'test-gate' is already registered"
      );
    });

    it('should throw error for gate without id', () => {
      const gate = {
        id: '', // Empty id
        name: 'Test Gate',
        description: 'A test gate',
        check: async () => true,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      } as QualityGate;

      expect(() => system.registerGate(gate)).toThrow(
        'Gate must have id, name, and check function'
      );
    });

    it('should throw error for gate with invalid timeout', () => {
      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'A test gate',
        check: async () => true,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: -1,
      };

      expect(() => system.registerGate(gate)).toThrow('Gate timeout must be positive');
    });
  });

  describe('getGate', () => {
    it('should return undefined for non-existent gate', () => {
      const gate = system.getGate('non-existent');
      expect(gate).toBeUndefined();
    });

    it('should return registered gate', () => {
      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'A test gate',
        check: async () => true,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate);

      const retrieved = system.getGate('test-gate');
      expect(retrieved).toEqual(gate);
    });
  });

  describe('getAllGates', () => {
    it('should return empty array when no gates registered', () => {
      const gates = system.getAllGates();
      expect(gates).toEqual([]);
    });

    it('should return all registered gates', () => {
      const gate1: QualityGate = {
        id: 'gate-1',
        name: 'Gate 1',
        description: 'First gate',
        check: async () => true,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      const gate2: QualityGate = {
        id: 'gate-2',
        name: 'Gate 2',
        description: 'Second gate',
        check: async () => true,
        requiredFor: [AgentRole.QA_ENGINEER],
        blocker: false,
        timeout: 3000,
      };

      system.registerGate(gate1);
      system.registerGate(gate2);

      const gates = system.getAllGates();
      expect(gates).toHaveLength(2);
      expect(gates).toContainEqual(gate1);
      expect(gates).toContainEqual(gate2);
    });
  });

  describe('getGatesForRole', () => {
    beforeEach(() => {
      const devGate: QualityGate = {
        id: 'dev-gate',
        name: 'Dev Gate',
        description: 'For developers',
        check: async () => true,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      const qaGate: QualityGate = {
        id: 'qa-gate',
        name: 'QA Gate',
        description: 'For QA',
        check: async () => true,
        requiredFor: [AgentRole.QA_ENGINEER],
        blocker: true,
        timeout: 5000,
      };

      const sharedGate: QualityGate = {
        id: 'shared-gate',
        name: 'Shared Gate',
        description: 'For both',
        check: async () => true,
        requiredFor: [AgentRole.DEVELOPER, AgentRole.QA_ENGINEER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(devGate);
      system.registerGate(qaGate);
      system.registerGate(sharedGate);
    });

    it('should return gates for developer role', () => {
      const gates = system.getGatesForRole(AgentRole.DEVELOPER);
      expect(gates).toHaveLength(2);
      expect(gates.map((g) => g.id)).toContain('dev-gate');
      expect(gates.map((g) => g.id)).toContain('shared-gate');
    });

    it('should return gates for QA role', () => {
      const gates = system.getGatesForRole(AgentRole.QA_ENGINEER);
      expect(gates).toHaveLength(2);
      expect(gates.map((g) => g.id)).toContain('qa-gate');
      expect(gates.map((g) => g.id)).toContain('shared-gate');
    });

    it('should return empty array for role with no gates', () => {
      const gates = system.getGatesForRole(AgentRole.DEVOPS);
      expect(gates).toEqual([]);
    });
  });

  describe('runGates', () => {
    const mockWorkItem: WorkItem = {
      id: 'work-1',
      title: 'Test Work',
      assignedTo: 'dev-1',
      status: 'in-progress',
      dependencies: [],
      artifacts: [
        { type: 'file', data: 'file1.ts' },
        { type: 'file', data: 'file2.ts' },
      ],
      timeSpent: 0,
    };

    it('should pass when no gates are registered for role', async () => {
      const report = await system.runGates(mockWorkItem, AgentRole.DEVELOPER);

      expect(report.passed).toBe(true);
      expect(report.results).toHaveLength(0);
      expect(report.workItemId).toBe('work-1');
    });

    it('should pass when all gates pass', async () => {
      const gate1: QualityGate = {
        id: 'gate-1',
        name: 'Gate 1',
        description: 'First gate',
        check: async () => true,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      const gate2: QualityGate = {
        id: 'gate-2',
        name: 'Gate 2',
        description: 'Second gate',
        check: async () => true,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate1);
      system.registerGate(gate2);

      const report = await system.runGates(mockWorkItem, AgentRole.DEVELOPER);

      expect(report.passed).toBe(true);
      expect(report.results).toHaveLength(2);
      expect(report.results.every((r) => r.passed)).toBe(true);
    });

    it('should fail when any gate fails', async () => {
      const passingGate: QualityGate = {
        id: 'passing-gate',
        name: 'Passing Gate',
        description: 'This passes',
        check: async () => true,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      const failingGate: QualityGate = {
        id: 'failing-gate',
        name: 'Failing Gate',
        description: 'This fails',
        check: async () => false,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(passingGate);
      system.registerGate(failingGate);

      const report = await system.runGates(mockWorkItem, AgentRole.DEVELOPER);

      expect(report.passed).toBe(false);
      expect(report.results).toHaveLength(2);
      expect(report.results.find((r) => r.gateId === 'passing-gate')?.passed).toBe(true);
      expect(report.results.find((r) => r.gateId === 'failing-gate')?.passed).toBe(false);
    });

    it('should handle gate timeout', async () => {
      const slowGate: QualityGate = {
        id: 'slow-gate',
        name: 'Slow Gate',
        description: 'Takes too long',
        check: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return true;
        },
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 50, // Very short timeout
      };

      system.registerGate(slowGate);

      const report = await system.runGates(mockWorkItem, AgentRole.DEVELOPER);

      expect(report.passed).toBe(false);
      expect(report.results).toHaveLength(1);
      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].timedOut).toBe(true);
      expect(report.results[0].message).toContain('timed out');
    });

    it('should handle gate errors', async () => {
      const errorGate: QualityGate = {
        id: 'error-gate',
        name: 'Error Gate',
        description: 'Throws error',
        check: async () => {
          throw new Error('Gate check failed');
        },
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(errorGate);

      const report = await system.runGates(mockWorkItem, AgentRole.DEVELOPER);

      expect(report.passed).toBe(false);
      expect(report.results).toHaveLength(1);
      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].message).toContain('Gate check failed');
    });

    it('should run gates in parallel', async () => {
      const startTimes: number[] = [];

      const gate1: QualityGate = {
        id: 'gate-1',
        name: 'Gate 1',
        description: 'First gate',
        check: async () => {
          startTimes.push(Date.now());
          await new Promise((resolve) => setTimeout(resolve, 50));
          return true;
        },
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      const gate2: QualityGate = {
        id: 'gate-2',
        name: 'Gate 2',
        description: 'Second gate',
        check: async () => {
          startTimes.push(Date.now());
          await new Promise((resolve) => setTimeout(resolve, 50));
          return true;
        },
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate1);
      system.registerGate(gate2);

      await system.runGates(mockWorkItem, AgentRole.DEVELOPER);

      // If parallel, start times should be within 10ms of each other
      expect(Math.abs(startTimes[0] - startTimes[1])).toBeLessThan(10);
    });

    it('should include duration in results', async () => {
      const gate: QualityGate = {
        id: 'timed-gate',
        name: 'Timed Gate',
        description: 'Measures duration',
        check: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return true;
        },
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate);

      const report = await system.runGates(mockWorkItem, AgentRole.DEVELOPER);

      expect(report.results[0].duration).toBeGreaterThanOrEqual(50);
      expect(report.totalDuration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('override', () => {
    const mockWorkItem: WorkItem = {
      id: 'work-1',
      title: 'Test Work',
      assignedTo: 'dev-1',
      status: 'in-progress',
      dependencies: [],
      artifacts: [],
      timeSpent: 0,
    };

    const mockResult: GateResult = {
      gateId: 'test-gate',
      passed: false,
      message: 'Gate failed',
      executedAt: new Date(),
    };

    beforeEach(() => {
      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'A test gate',
        check: async () => false,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate);
    });

    it('should create override with valid reason', () => {
      system.override(
        mockWorkItem.id,
        'test-gate',
        'tech-lead-1',
        'Emergency fix needed',
        mockResult
      );

      const overrides = system.getOverrides(mockWorkItem.id);
      expect(overrides).toHaveLength(1);
      expect(overrides[0].gateId).toBe('test-gate');
      expect(overrides[0].approvedBy).toBe('tech-lead-1');
      expect(overrides[0].reason).toBe('Emergency fix needed');
    });

    it('should throw error for empty reason', () => {
      expect(() =>
        system.override(mockWorkItem.id, 'test-gate', 'tech-lead-1', '', mockResult)
      ).toThrow('Override reason is required');
    });

    it('should throw error for whitespace-only reason', () => {
      expect(() =>
        system.override(mockWorkItem.id, 'test-gate', 'tech-lead-1', '   ', mockResult)
      ).toThrow('Override reason is required');
    });

    it('should throw error for non-existent gate', () => {
      expect(() =>
        system.override(
          mockWorkItem.id,
          'non-existent-gate',
          'tech-lead-1',
          'Valid reason',
          mockResult
        )
      ).toThrow("Gate 'non-existent-gate' does not exist");
    });

    it('should allow multiple overrides for same work item', () => {
      const gate2: QualityGate = {
        id: 'test-gate-2',
        name: 'Test Gate 2',
        description: 'Another test gate',
        check: async () => false,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate2);

      const result2: GateResult = {
        gateId: 'test-gate-2',
        passed: false,
        message: 'Gate 2 failed',
        executedAt: new Date(),
      };

      system.override(mockWorkItem.id, 'test-gate', 'tech-lead-1', 'Reason 1', mockResult);

      system.override(mockWorkItem.id, 'test-gate-2', 'tech-lead-1', 'Reason 2', result2);

      const overrides = system.getOverrides(mockWorkItem.id);
      expect(overrides).toHaveLength(2);
    });

    it('should trim reason whitespace', () => {
      system.override(mockWorkItem.id, 'test-gate', 'tech-lead-1', '  Emergency fix  ', mockResult);

      const overrides = system.getOverrides(mockWorkItem.id);
      expect(overrides[0].reason).toBe('Emergency fix');
    });
  });

  describe('canApprove', () => {
    it('should return true when all gates pass', () => {
      const results: GateResult[] = [
        {
          gateId: 'gate-1',
          passed: true,
          message: 'Passed',
          executedAt: new Date(),
        },
        {
          gateId: 'gate-2',
          passed: true,
          message: 'Passed',
          executedAt: new Date(),
        },
      ];

      expect(system.canApprove('work-1', results)).toBe(true);
    });

    it('should return false when gates fail without overrides', () => {
      const results: GateResult[] = [
        {
          gateId: 'gate-1',
          passed: true,
          message: 'Passed',
          executedAt: new Date(),
        },
        {
          gateId: 'gate-2',
          passed: false,
          message: 'Failed',
          executedAt: new Date(),
        },
      ];

      expect(system.canApprove('work-1', results)).toBe(false);
    });

    it('should return true when failed gates have overrides', () => {
      const gate: QualityGate = {
        id: 'gate-2',
        name: 'Gate 2',
        description: 'Test gate',
        check: async () => false,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate);

      const results: GateResult[] = [
        {
          gateId: 'gate-1',
          passed: true,
          message: 'Passed',
          executedAt: new Date(),
        },
        {
          gateId: 'gate-2',
          passed: false,
          message: 'Failed',
          executedAt: new Date(),
        },
      ];

      system.override('work-1', 'gate-2', 'tech-lead-1', 'Valid reason', results[1]);

      expect(system.canApprove('work-1', results)).toBe(true);
    });
  });

  describe('getOverrides', () => {
    it('should return empty array for work item with no overrides', () => {
      const overrides = system.getOverrides('work-1');
      expect(overrides).toEqual([]);
    });

    it('should return overrides for work item', () => {
      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'A test gate',
        check: async () => false,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate);

      const result: GateResult = {
        gateId: 'test-gate',
        passed: false,
        message: 'Failed',
        executedAt: new Date(),
      };

      system.override('work-1', 'test-gate', 'tech-lead-1', 'Valid reason', result);

      const overrides = system.getOverrides('work-1');
      expect(overrides).toHaveLength(1);
      expect(overrides[0].workItemId).toBe('work-1');
    });
  });

  describe('clearOverrides', () => {
    it('should clear overrides for work item', () => {
      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'A test gate',
        check: async () => false,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate);

      const result: GateResult = {
        gateId: 'test-gate',
        passed: false,
        message: 'Failed',
        executedAt: new Date(),
      };

      system.override('work-1', 'test-gate', 'tech-lead-1', 'Valid reason', result);

      expect(system.getOverrides('work-1')).toHaveLength(1);

      system.clearOverrides('work-1');

      expect(system.getOverrides('work-1')).toEqual([]);
    });

    it('should not affect other work items', () => {
      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'A test gate',
        check: async () => false,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate);

      const result: GateResult = {
        gateId: 'test-gate',
        passed: false,
        message: 'Failed',
        executedAt: new Date(),
      };

      system.override('work-1', 'test-gate', 'tech-lead-1', 'Reason 1', result);
      system.override('work-2', 'test-gate', 'tech-lead-1', 'Reason 2', result);

      system.clearOverrides('work-1');

      expect(system.getOverrides('work-1')).toEqual([]);
      expect(system.getOverrides('work-2')).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should clear all gates and overrides', () => {
      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'A test gate',
        check: async () => false,
        requiredFor: [AgentRole.DEVELOPER],
        blocker: true,
        timeout: 5000,
      };

      system.registerGate(gate);

      const result: GateResult = {
        gateId: 'test-gate',
        passed: false,
        message: 'Failed',
        executedAt: new Date(),
      };

      system.override('work-1', 'test-gate', 'tech-lead-1', 'Valid reason', result);

      expect(system.getAllGates()).toHaveLength(1);
      expect(system.getOverrides('work-1')).toHaveLength(1);

      system.clear();

      expect(system.getAllGates()).toEqual([]);
      expect(system.getOverrides('work-1')).toEqual([]);
    });
  });
});
