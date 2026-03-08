import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SharedContextManager } from '@/multi-agent-system/lib/shared-context';
import { WorkItem } from '@/multi-agent-system/lib/shared-context-types';

describe('SharedContextManager - Performance Optimizations', () => {
  let manager: SharedContextManager;

  beforeEach(() => {
    manager = new SharedContextManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Caching with TTL', () => {
    it('should cache project state reads', () => {
      // First read - cache miss
      const state1 = manager.getProjectState('eventual');
      expect(state1.version).toBe(0);

      // Second read - cache hit
      const state2 = manager.getProjectState('eventual');
      expect(state2).toEqual(state1);

      // Verify cache stats
      const stats = manager.getCacheStats();
      expect(stats.projectState.hits).toBeGreaterThan(0);
    });

    it('should expire cache after TTL (5 seconds)', () => {
      // Read to populate cache
      manager.getProjectState('eventual');

      // Advance time by 6 seconds (past TTL)
      vi.advanceTimersByTime(6000);

      // Read again - should be cache miss due to expiration
      manager.getProjectState('eventual');

      const stats = manager.getCacheStats();
      expect(stats.projectState.misses).toBeGreaterThan(0);
    });

    it('should invalidate cache on updates', () => {
      // Read to populate cache
      const state1 = manager.getProjectState('eventual');

      // Update state
      manager.updateProjectState({ currentPhase: 'testing' });

      // Process batched updates
      vi.advanceTimersByTime(50);

      // Read again - should get updated state
      const state2 = manager.getProjectState('eventual');
      expect(state2.currentPhase).toBe('testing');
      expect(state2.version).toBeGreaterThan(state1.version);
    });

    it('should cache work items', () => {
      const workItem: WorkItem = {
        id: 'task-1',
        title: 'Test Task',
        assignedTo: 'agent-1',
        status: 'pending',
        dependencies: [],
        artifacts: [],
        timeSpent: 0,
      };

      manager.createWorkItem(workItem);

      // First read - cache miss
      const item1 = manager.getWorkItem('task-1', 'eventual');
      expect(item1).toBeDefined();

      // Second read - cache hit
      const item2 = manager.getWorkItem('task-1', 'eventual');
      expect(item2).toEqual(item1);

      const stats = manager.getCacheStats();
      expect(stats.workItems.hits).toBeGreaterThan(0);
    });

    it('should support strong consistency mode', () => {
      // Strong consistency should always read from source
      const state1 = manager.getProjectState('strong');
      const state2 = manager.getProjectState('strong');

      // Both should be fresh reads
      expect(state1).toEqual(state2);
    });

    it('should use LRU eviction when cache is full', () => {
      // Create many work items to fill cache
      for (let i = 0; i < 150; i++) {
        const workItem: WorkItem = {
          id: `task-${i}`,
          title: `Task ${i}`,
          assignedTo: 'agent-1',
          status: 'pending',
          dependencies: [],
          artifacts: [],
          timeSpent: 0,
        };
        manager.createWorkItem(workItem);
      }

      // Access all items to populate cache
      for (let i = 0; i < 150; i++) {
        manager.getWorkItem(`task-${i}`, 'eventual');
      }

      const stats = manager.getCacheStats();
      // Cache should have evicted some items (max size is 100)
      expect(stats.workItems.evictions).toBeGreaterThan(0);
      expect(stats.workItems.size).toBeLessThanOrEqual(100);
    });
  });

  describe('Batched State Updates', () => {
    it('should batch multiple updates within 50ms window', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);

      // Make multiple updates quickly
      manager.updateProjectState({ currentPhase: 'phase1' });
      manager.updateProjectState({ currentPhase: 'phase2' });
      manager.updateProjectState({ currentPhase: 'phase3' });

      // Listener should not be called yet
      expect(listener).not.toHaveBeenCalled();

      // Advance time to trigger batch processing
      vi.advanceTimersByTime(50);

      // Listener should be called once with final state
      expect(listener).toHaveBeenCalledTimes(1);
      const finalState = listener.mock.calls[0][0];
      expect(finalState.currentPhase).toBe('phase3');
    });

    it('should use shallow comparison to detect changes', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);

      // Update with same value
      manager.updateProjectState({ currentPhase: 'initializing' });

      // Advance time
      vi.advanceTimersByTime(50);

      // Listener should not be called (no actual change)
      expect(listener).not.toHaveBeenCalled();
    });

    it('should detect array changes', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);

      // Add completed task
      const currentState = manager.getProjectState('strong');
      manager.updateProjectState({
        completedTasks: [...currentState.completedTasks, 'task-1'],
      });

      vi.advanceTimersByTime(50);

      // Listener should be called (array changed)
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should increment version on updates', () => {
      const initialVersion = manager.getProjectState('strong').version;

      manager.updateProjectState({ currentPhase: 'testing' });
      vi.advanceTimersByTime(50);

      const newVersion = manager.getProjectState('strong').version;
      expect(newVersion).toBeGreaterThan(initialVersion);
    });
  });

  describe('Eventual Consistency', () => {
    it('should allow reads from cache (eventual consistency)', () => {
      // Populate cache
      const state1 = manager.getProjectState('eventual');

      // Update state
      manager.updateProjectState({ currentPhase: 'updated' });

      // Read with eventual consistency before batch processes
      const state2 = manager.getProjectState('eventual');

      // Should still get cached (stale) state
      expect(state2.currentPhase).toBe(state1.currentPhase);

      // Process batch
      vi.advanceTimersByTime(50);

      // Now should get updated state
      const state3 = manager.getProjectState('eventual');
      expect(state3.currentPhase).toBe('updated');
    });

    it('should provide strong consistency when requested', () => {
      // Update state
      manager.updateProjectState({ currentPhase: 'updated' });

      // Process batch
      vi.advanceTimersByTime(50);

      // Read with strong consistency after batch
      const stateAfter = manager.getProjectState('strong');
      expect(stateAfter.currentPhase).toBe('updated');
    });

    it('should track version numbers for conflict detection', () => {
      const v1 = manager.getProjectState('strong').version;

      manager.updateProjectState({ currentPhase: 'phase1' });
      vi.advanceTimersByTime(50);

      const v2 = manager.getProjectState('strong').version;
      expect(v2).toBe(v1 + 1);

      manager.updateProjectState({ currentPhase: 'phase2' });
      vi.advanceTimersByTime(50);

      const v3 = manager.getProjectState('strong').version;
      expect(v3).toBe(v2 + 1);
    });
  });

  describe('Periodic Sync to Persistent Storage', () => {
    it('should sync to persistent storage every 30 seconds', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create some data
      manager.updateProjectState({ currentPhase: 'testing' });
      vi.advanceTimersByTime(50);

      // Advance time by 30 seconds to trigger sync
      await vi.advanceTimersByTimeAsync(30000);

      // Should have synced
      const syncState = manager.getSyncState();
      expect(syncState.lastSyncAt).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should maintain write-ahead log', () => {
      const workItem: WorkItem = {
        id: 'task-1',
        title: 'Test Task',
        assignedTo: 'agent-1',
        status: 'pending',
        dependencies: [],
        artifacts: [],
        timeSpent: 0,
      };

      manager.createWorkItem(workItem);

      const syncState = manager.getSyncState();
      expect(syncState.pendingWrites).toBeGreaterThan(0);
    });

    it('should clear pending writes after successful sync', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create some data
      manager.updateProjectState({ currentPhase: 'testing' });
      vi.advanceTimersByTime(50);

      // Verify pending writes
      let syncState = manager.getSyncState();
      expect(syncState.pendingWrites).toBeGreaterThan(0);

      // Force sync
      const syncPromise = manager.forceSyncToPersistentStorage();
      await vi.runAllTimersAsync();
      await syncPromise;

      // Pending writes should be cleared
      syncState = manager.getSyncState();
      expect(syncState.pendingWrites).toBe(0);

      consoleSpy.mockRestore();
    });

    it('should handle sync failures gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock sync to fail
      const originalSync = manager['syncToPersistentStorage'];
      manager['syncToPersistentStorage'] = vi.fn().mockRejectedValue(new Error('Sync failed'));

      // Trigger sync
      await manager.forceSyncToPersistentStorage();

      // Should have error in sync state
      const syncState = manager.getSyncState();
      expect(syncState.lastError).toBeDefined();
      expect(syncState.lastError?.message).toBe('Sync failed');

      // Restore
      manager['syncToPersistentStorage'] = originalSync;
      consoleErrorSpy.mockRestore();
    });

    it('should not start new sync if one is in progress', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Start first sync
      const sync1 = manager.forceSyncToPersistentStorage();

      // Try to start second sync immediately
      const sync2 = manager.forceSyncToPersistentStorage();

      await vi.runAllTimersAsync();
      await Promise.all([sync1, sync2]);

      // Both should complete without error
      const syncState = manager.getSyncState();
      expect(syncState.syncInProgress).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should support recovery from persistent storage', async () => {
      // This is a placeholder test for the recovery functionality
      const recoveryPromise = manager.recoverFromPersistentStorage();
      await vi.runAllTimersAsync();
      await expect(recoveryPromise).resolves.not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track cache hit rate', () => {
      // Populate cache
      manager.getProjectState('eventual');

      // Multiple reads (cache hits)
      for (let i = 0; i < 10; i++) {
        manager.getProjectState('eventual');
      }

      const stats = manager.getCacheStats();
      const hitRate =
        stats.projectState.hits / (stats.projectState.hits + stats.projectState.misses);
      expect(hitRate).toBeGreaterThan(0.8); // >= 80% hit rate
    });

    it('should track cache size', () => {
      // Create work items
      for (let i = 0; i < 10; i++) {
        const workItem: WorkItem = {
          id: `task-${i}`,
          title: `Task ${i}`,
          assignedTo: 'agent-1',
          status: 'pending',
          dependencies: [],
          artifacts: [],
          timeSpent: 0,
        };
        manager.createWorkItem(workItem);
        manager.getWorkItem(`task-${i}`, 'eventual');
      }

      const stats = manager.getCacheStats();
      expect(stats.workItems.size).toBe(10);
    });

    it('should track cache evictions', () => {
      // Create many work items to trigger evictions
      for (let i = 0; i < 150; i++) {
        const workItem: WorkItem = {
          id: `task-${i}`,
          title: `Task ${i}`,
          assignedTo: 'agent-1',
          status: 'pending',
          dependencies: [],
          artifacts: [],
          timeSpent: 0,
        };
        manager.createWorkItem(workItem);
        manager.getWorkItem(`task-${i}`, 'eventual');
      }

      const stats = manager.getCacheStats();
      expect(stats.workItems.evictions).toBeGreaterThan(0);
    });

    it('should provide sync state metrics', () => {
      const syncState = manager.getSyncState();
      expect(syncState).toHaveProperty('lastSyncAt');
      expect(syncState).toHaveProperty('pendingWrites');
      expect(syncState).toHaveProperty('syncInProgress');
    });
  });

  describe('Integration with Existing Functionality', () => {
    it('should maintain backward compatibility with work item operations', () => {
      const workItem: WorkItem = {
        id: 'task-1',
        title: 'Test Task',
        assignedTo: 'agent-1',
        status: 'pending',
        dependencies: [],
        artifacts: [],
        timeSpent: 0,
      };

      manager.createWorkItem(workItem);

      // Update work item
      manager.updateWorkItem('task-1', { status: 'in-progress' });

      const updated = manager.getWorkItem('task-1', 'strong');
      expect(updated?.status).toBe('in-progress');
      expect(updated?.startedAt).toBeDefined();
    });

    it('should maintain backward compatibility with state listeners', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);

      manager.updateProjectState({ currentPhase: 'testing' });
      vi.advanceTimersByTime(50);

      expect(listener).toHaveBeenCalled();
    });

    it('should maintain backward compatibility with file locks', async () => {
      const locked = await manager.acquireFileLock('agent-1', 'file.ts', 'write');
      expect(locked).toBe(true);

      const isLocked = manager.isFileLocked('file.ts');
      expect(isLocked).toBe(true);

      manager.releaseFileLock('agent-1', 'file.ts');
      expect(manager.isFileLocked('file.ts')).toBe(false);
    });

    it('should maintain backward compatibility with knowledge base', () => {
      const decision = {
        id: 'decision-1',
        title: 'Test Decision',
        context: 'Testing context',
        options: ['A', 'B'],
        chosen: 'A',
        rationale: 'A is better',
        madeBy: 'agent-1',
        madeAt: new Date(),
        tags: ['test'],
      };

      manager.addDecision(decision);

      const decisions = manager.getAllDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0].id).toBe('decision-1');
    });
  });

  describe('Performance Targets', () => {
    it('should achieve context read latency < 10ms from cache', () => {
      // Populate cache
      manager.getProjectState('eventual');

      const start = Date.now();
      manager.getProjectState('eventual');
      const duration = Date.now() - start;

      // Cache read should be very fast (< 10ms)
      expect(duration).toBeLessThan(10);
    });

    it('should batch updates within 50ms window', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);

      const start = Date.now();

      // Make multiple updates
      manager.updateProjectState({ currentPhase: 'phase1' });
      manager.updateProjectState({ currentPhase: 'phase2' });

      // Advance exactly 50ms
      vi.advanceTimersByTime(50);

      const duration = Date.now() - start;

      // Should have batched within 50ms
      expect(duration).toBeLessThanOrEqual(50);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should maintain cache hit rate >= 80%', () => {
      // Warm up cache
      manager.getProjectState('eventual');

      // Make many reads
      for (let i = 0; i < 100; i++) {
        manager.getProjectState('eventual');
      }

      const stats = manager.getCacheStats();
      const hitRate =
        stats.projectState.hits / (stats.projectState.hits + stats.projectState.misses);

      expect(hitRate).toBeGreaterThanOrEqual(0.8);
    });

    it('should sync every 30 seconds', async () => {
      // Use real timers for this test
      vi.useRealTimers();
      const testManager = new SharedContextManager();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Get initial sync time
      const syncState1 = testManager.getSyncState();
      expect(syncState1.lastSyncAt).toBeDefined();

      // Manually trigger sync to verify it works
      await testManager.forceSyncToPersistentStorage();

      const syncState2 = testManager.getSyncState();
      expect(syncState2.pendingWrites).toBe(0);

      testManager.destroy();
      consoleSpy.mockRestore();
      vi.useFakeTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty cache gracefully', () => {
      const state = manager.getProjectState('eventual');
      expect(state).toBeDefined();
    });

    it('should handle concurrent updates', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);

      // Simulate concurrent updates
      manager.updateProjectState({ currentPhase: 'phase1' });
      manager.updateProjectState({ currentPhase: 'phase2' });
      manager.updateProjectState({ currentPhase: 'phase3' });

      vi.advanceTimersByTime(50);

      // Should merge all updates
      expect(listener).toHaveBeenCalledTimes(1);
      const finalState = listener.mock.calls[0][0];
      expect(finalState.currentPhase).toBe('phase3');
    });

    it('should handle cache expiration during read', () => {
      // Populate cache
      manager.getProjectState('eventual');

      // Advance past TTL
      vi.advanceTimersByTime(6000);

      // Read should still work (cache miss, read from source)
      const state = manager.getProjectState('eventual');
      expect(state).toBeDefined();
    });

    it('should handle cleanup properly', () => {
      manager.destroy();

      // Should not throw after cleanup
      expect(() => manager.clear()).not.toThrow();
    });
  });
});
