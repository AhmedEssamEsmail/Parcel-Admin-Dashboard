import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { QualityGatesSystem } from '@/multi-agent-system/lib/quality-gates';
import { QualityGate, GateResult } from '@/multi-agent-system/lib/quality-gates-types';
import { WorkItem } from '@/multi-agent-system/lib/shared-context-types';
import { AgentRole } from '@/multi-agent-system/lib/agent-definition-schema';
import { writeFileSync, unlinkSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

describe('QualityGatesSystem - Optimizations', () => {
  let system: QualityGatesSystem;
  const testDir = join(process.cwd(), 'test-temp-gates');

  beforeEach(() => {
    system = new QualityGatesSystem(5);

    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    system.clear();

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Result Caching', () => {
    it('should cache gate results for 1 minute', async () => {
      const testFile = join(testDir, 'test1.ts');
      writeFileSync(testFile, 'const x = 1;');

      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: vi.fn().mockResolvedValue(true),
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      // First run - should execute gate
      const result1 = await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(result1.passed).toBe(true);
      expect(gate.check).toHaveBeenCalledTimes(1);

      // Second run - should use cache
      const result2 = await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(result2.passed).toBe(true);
      expect(result2.results[0].message).toContain('(cached)');
      expect(gate.check).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should invalidate cache when files change', async () => {
      const testFile = join(testDir, 'test2.ts');
      writeFileSync(testFile, 'const x = 1;');

      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: vi.fn().mockResolvedValue(true),
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      // First run
      await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(gate.check).toHaveBeenCalledTimes(1);

      // Modify file
      writeFileSync(testFile, 'const x = 2;');

      // Second run - should re-execute because file changed
      await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(gate.check).toHaveBeenCalledTimes(2);
    });

    it('should expire cache after 1 minute', async () => {
      vi.useFakeTimers();

      const testFile = join(testDir, 'test3.ts');
      writeFileSync(testFile, 'const x = 1;');

      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: vi.fn().mockResolvedValue(true),
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      // First run
      await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(gate.check).toHaveBeenCalledTimes(1);

      // Advance time by 61 seconds (past TTL)
      vi.advanceTimersByTime(61 * 1000);

      // Second run - should re-execute because cache expired
      await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(gate.check).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should not cache failed gate results', async () => {
      const testFile = join(testDir, 'test4.ts');
      writeFileSync(testFile, 'const x = 1;');

      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: vi.fn().mockResolvedValue(false),
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      // First run - fails
      await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(gate.check).toHaveBeenCalledTimes(1);

      // Second run - should re-execute (failures not cached)
      await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(gate.check).toHaveBeenCalledTimes(2);
    });

    it('should track cache statistics', async () => {
      const testFile = join(testDir, 'test5.ts');
      writeFileSync(testFile, 'const x = 1;');

      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: vi.fn().mockResolvedValue(true),
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      // First run - cache miss
      await system.runGates(workItem, AgentRole.DEVELOPER);

      // Second run - cache hit
      await system.runGates(workItem, AgentRole.DEVELOPER);

      const stats = system.getCacheStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.cacheHits).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('Resource Limits', () => {
    it('should limit concurrent gate execution to 5', async () => {
      const testFile = join(testDir, 'test6.ts');
      writeFileSync(testFile, 'const x = 1;');

      let concurrentCount = 0;
      let maxConcurrent = 0;

      // Create 10 gates that track concurrency
      for (let i = 0; i < 10; i++) {
        const gate: QualityGate = {
          id: `gate-${i}`,
          name: `Gate ${i}`,
          description: 'Test',
          check: async () => {
            concurrentCount++;
            maxConcurrent = Math.max(maxConcurrent, concurrentCount);
            await new Promise((resolve) => setTimeout(resolve, 100));
            concurrentCount--;
            return true;
          },
          requiredFor: [AgentRole.DEVELOPER],
          blocker: false,
          timeout: 5000,
        };
        system.registerGate(gate);
      }

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      await system.runGates(workItem, AgentRole.DEVELOPER);

      // Should never exceed 5 concurrent gates
      expect(maxConcurrent).toBeLessThanOrEqual(5);
      expect(maxConcurrent).toBeGreaterThan(0);
    });

    it('should track semaphore statistics', async () => {
      const stats = system.getSemaphoreStats();
      expect(stats.max).toBe(5);
      expect(stats.current).toBe(0);
      expect(stats.queueLength).toBe(0);
    });

    it('should allow custom max concurrent gates', () => {
      const customSystem = new QualityGatesSystem(3);
      const stats = customSystem.getSemaphoreStats();
      expect(stats.max).toBe(3);
    });
  });

  describe('File Change Detection', () => {
    it('should compute file hashes correctly', async () => {
      const testFile = join(testDir, 'test7.ts');
      writeFileSync(testFile, 'const x = 1;');

      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: vi.fn().mockResolvedValue(true),
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      // Run gates to compute hashes
      await system.runGates(workItem, AgentRole.DEVELOPER);

      // Verify cache was used (indirectly proves hashing worked)
      await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(gate.check).toHaveBeenCalledTimes(1);
    });

    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = join(testDir, 'does-not-exist.ts');

      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: vi.fn().mockResolvedValue(true),
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [nonExistentFile],
        timeSpent: 0,
      };

      // Should not throw error
      const result = await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(result.passed).toBe(true);
    });

    it('should handle empty artifact list', async () => {
      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: vi.fn().mockResolvedValue(true),
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [],
        timeSpent: 0,
      };

      const result = await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(result.passed).toBe(true);
    });
  });

  describe('Parallel Execution', () => {
    it('should run gates in parallel', async () => {
      const testFile = join(testDir, 'test8.ts');
      writeFileSync(testFile, 'const x = 1;');

      const executionOrder: number[] = [];

      // Create 3 gates with different delays
      for (let i = 0; i < 3; i++) {
        const gate: QualityGate = {
          id: `gate-${i}`,
          name: `Gate ${i}`,
          description: 'Test',
          check: async () => {
            await new Promise((resolve) => setTimeout(resolve, (3 - i) * 50));
            executionOrder.push(i);
            return true;
          },
          requiredFor: [AgentRole.DEVELOPER],
          blocker: false,
          timeout: 5000,
        };
        system.registerGate(gate);
      }

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      const startTime = Date.now();
      await system.runGates(workItem, AgentRole.DEVELOPER);
      const duration = Date.now() - startTime;

      // If parallel, should complete in ~150ms (longest gate)
      // If sequential, would take ~300ms (sum of all gates)
      expect(duration).toBeLessThan(250);

      // Gates should complete in reverse order (2, 1, 0) due to delays
      expect(executionOrder).toEqual([2, 1, 0]);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      const testFile = join(testDir, 'test9.ts');
      writeFileSync(testFile, 'const x = 1;');

      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: vi.fn().mockResolvedValue(true),
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      // Run to populate cache
      await system.runGates(workItem, AgentRole.DEVELOPER);

      // Clear cache
      system.clearCache();

      // Run again - should re-execute
      await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(gate.check).toHaveBeenCalledTimes(2);
    });

    it('should clear file hashes', async () => {
      const testFile = join(testDir, 'test10.ts');
      writeFileSync(testFile, 'const x = 1;');

      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: vi.fn().mockResolvedValue(true),
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      // Run to compute hashes
      await system.runGates(workItem, AgentRole.DEVELOPER);

      // Clear file hashes
      system.clearFileHashes();

      // Run again - should recompute hashes but still use cache
      await system.runGates(workItem, AgentRole.DEVELOPER);
      expect(gate.check).toHaveBeenCalledTimes(1); // Still cached
    });

    it('should clear all data', () => {
      system.clearCache();
      system.clearFileHashes();

      const stats = system.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.cacheHits).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should achieve >= 70% cache hit rate on repeated runs', async () => {
      const testFile = join(testDir, 'test11.ts');
      writeFileSync(testFile, 'const x = 1;');

      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: vi.fn().mockResolvedValue(true),
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      // Run 10 times
      for (let i = 0; i < 10; i++) {
        await system.runGates(workItem, AgentRole.DEVELOPER);
      }

      const stats = system.getCacheStats();
      expect(stats.hitRate).toBeGreaterThanOrEqual(0.7); // >= 70%
    });

    it('should reduce execution time with caching', async () => {
      const testFile = join(testDir, 'test12.ts');
      writeFileSync(testFile, 'const x = 1;');

      const gate: QualityGate = {
        id: 'test-gate',
        name: 'Test Gate',
        description: 'Test',
        check: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return true;
        },
        requiredFor: [AgentRole.DEVELOPER],
        blocker: false,
        timeout: 5000,
      };

      system.registerGate(gate);

      const workItem: WorkItem = {
        id: 'work-1',
        title: 'Test',
        assignedTo: 'dev-1',
        status: 'in-progress',
        dependencies: [],
        artifacts: [testFile],
        timeSpent: 0,
      };

      // First run - no cache
      const start1 = Date.now();
      await system.runGates(workItem, AgentRole.DEVELOPER);
      const duration1 = Date.now() - start1;

      // Second run - with cache
      const start2 = Date.now();
      await system.runGates(workItem, AgentRole.DEVELOPER);
      const duration2 = Date.now() - start2;

      // Cached run should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.5); // At least 50% faster
    });
  });
});
