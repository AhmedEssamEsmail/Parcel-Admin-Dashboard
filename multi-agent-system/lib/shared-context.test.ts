import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SharedContextManager } from './shared-context';
import type { WorkItem, Decision, KnowledgeItem } from './shared-context-types';

describe('SharedContextManager', () => {
  let manager: SharedContextManager;

  beforeEach(() => {
    manager = new SharedContextManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager.clear();
    vi.useRealTimers();
  });

  // ============================================================================
  // Project State Management Tests (Task 3.2)
  // ============================================================================

  describe('Project State Management', () => {
    it('should initialize with default state', () => {
      const state = manager.getProjectState();

      expect(state.currentPhase).toBe('initializing');
      expect(state.completedTasks).toEqual([]);
      expect(state.activeTasks.size).toBe(0);
      expect(state.blockedTasks).toEqual([]);
      expect(state.version).toBe(0);
      expect(state.lastUpdated).toBeInstanceOf(Date);
    });

    it('should update project state and increment version', () => {
      const initialVersion = manager.getProjectState().version;

      manager.updateProjectState({
        currentPhase: 'executing',
      });

      const state = manager.getProjectState();
      expect(state.currentPhase).toBe('executing');
      expect(state.version).toBe(initialVersion + 1);
    });

    it('should return a copy of state to prevent external mutations', () => {
      const state1 = manager.getProjectState();
      state1.currentPhase = 'modified';

      const state2 = manager.getProjectState();
      expect(state2.currentPhase).toBe('initializing');
    });

    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);

      manager.updateProjectState({ currentPhase: 'executing' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ currentPhase: 'executing' }));
    });

    it('should handle multiple state change listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.onStateChange(listener1);
      manager.onStateChange(listener2);

      manager.updateProjectState({ currentPhase: 'executing' });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      manager.onStateChange(errorListener);
      manager.onStateChange(goodListener);

      expect(() => {
        manager.updateProjectState({ currentPhase: 'executing' });
      }).not.toThrow();

      expect(goodListener).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // File Locking Tests (Task 3.3)
  // ============================================================================

  describe('File Locking System', () => {
    it('should acquire a write lock on an unlocked file', async () => {
      const result = await manager.acquireFileLock('agent1', 'file.ts', 'write');
      expect(result).toBe(true);
      expect(manager.isFileLocked('file.ts')).toBe(true);
    });

    it('should fail to acquire write lock on already locked file', async () => {
      await manager.acquireFileLock('agent1', 'file.ts', 'write');
      const result = await manager.acquireFileLock('agent2', 'file.ts', 'write');
      expect(result).toBe(false);
    });

    it('should allow multiple read locks on same file', async () => {
      const result1 = await manager.acquireFileLock('agent1', 'file.ts', 'read');
      const result2 = await manager.acquireFileLock('agent2', 'file.ts', 'read');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should not allow write lock when read lock exists', async () => {
      await manager.acquireFileLock('agent1', 'file.ts', 'read');
      const result = await manager.acquireFileLock('agent2', 'file.ts', 'write');
      expect(result).toBe(false);
    });

    it('should release a file lock', async () => {
      await manager.acquireFileLock('agent1', 'file.ts', 'write');
      manager.releaseFileLock('agent1', 'file.ts');

      expect(manager.isFileLocked('file.ts')).toBe(false);
    });

    it('should not release lock held by different agent', async () => {
      await manager.acquireFileLock('agent1', 'file.ts', 'write');
      manager.releaseFileLock('agent2', 'file.ts');

      expect(manager.isFileLocked('file.ts')).toBe(true);
    });

    it('should expire locks after timeout', async () => {
      const timeoutMs = 1000;
      await manager.acquireFileLock('agent1', 'file.ts', 'write', timeoutMs);

      expect(manager.isFileLocked('file.ts')).toBe(true);

      // Advance time past expiration
      vi.advanceTimersByTime(timeoutMs + 1);

      expect(manager.isFileLocked('file.ts')).toBe(false);
    });

    it('should allow acquiring expired lock', async () => {
      const timeoutMs = 1000;
      await manager.acquireFileLock('agent1', 'file.ts', 'write', timeoutMs);

      // Advance time past expiration
      vi.advanceTimersByTime(timeoutMs + 1);

      const result = await manager.acquireFileLock('agent2', 'file.ts', 'write');
      expect(result).toBe(true);
    });

    it('should renew a file lock', async () => {
      await manager.acquireFileLock('agent1', 'file.ts', 'write', 1000);

      const renewed = manager.renewFileLock('agent1', 'file.ts', 2000);
      expect(renewed).toBe(true);

      // Advance past original expiration
      vi.advanceTimersByTime(1500);
      expect(manager.isFileLocked('file.ts')).toBe(true);

      // Advance past renewed expiration
      vi.advanceTimersByTime(1000);
      expect(manager.isFileLocked('file.ts')).toBe(false);
    });

    it('should not renew lock held by different agent', async () => {
      await manager.acquireFileLock('agent1', 'file.ts', 'write');
      const renewed = manager.renewFileLock('agent2', 'file.ts');
      expect(renewed).toBe(false);
    });

    it('should get all locks held by an agent', async () => {
      await manager.acquireFileLock('agent1', 'file1.ts', 'write');
      await manager.acquireFileLock('agent1', 'file2.ts', 'write');
      await manager.acquireFileLock('agent2', 'file3.ts', 'write');

      const locks = manager.getAgentLocks('agent1');
      expect(locks).toHaveLength(2);
      expect(locks.map((l) => l.filePath)).toContain('file1.ts');
      expect(locks.map((l) => l.filePath)).toContain('file2.ts');
    });

    it('should clean up expired locks periodically', async () => {
      await manager.acquireFileLock('agent1', 'file1.ts', 'write', 1000);
      await manager.acquireFileLock('agent2', 'file2.ts', 'write', 35000);

      // Advance past first lock expiration but not second
      vi.advanceTimersByTime(1500);

      // Trigger periodic cleanup (runs every 30 seconds)
      vi.advanceTimersByTime(30000);

      expect(manager.isFileLocked('file1.ts')).toBe(false);
      expect(manager.isFileLocked('file2.ts')).toBe(true);
    });
  });

  // ============================================================================
  // Work Item Tracking Tests (Task 3.4)
  // ============================================================================

  describe('Work Item Tracking', () => {
    const createTestWorkItem = (overrides?: Partial<WorkItem>): WorkItem => ({
      id: 'task-1',
      title: 'Test Task',
      assignedTo: 'agent1',
      status: 'pending',
      dependencies: [],
      artifacts: [],
      timeSpent: 0,
      ...overrides,
    });

    it('should create a new work item', () => {
      const workItem = createTestWorkItem();
      manager.createWorkItem(workItem);

      const retrieved = manager.getWorkItem('task-1');
      expect(retrieved).toEqual(workItem);
    });

    it('should throw error when creating duplicate work item', () => {
      const workItem = createTestWorkItem();
      manager.createWorkItem(workItem);

      expect(() => {
        manager.createWorkItem(workItem);
      }).toThrow('Work item task-1 already exists');
    });

    it('should update work item', () => {
      const workItem = createTestWorkItem();
      manager.createWorkItem(workItem);

      manager.updateWorkItem('task-1', { status: 'in-progress' });

      const updated = manager.getWorkItem('task-1');
      expect(updated?.status).toBe('in-progress');
    });

    it('should throw error when updating non-existent work item', () => {
      expect(() => {
        manager.updateWorkItem('non-existent', { status: 'in-progress' });
      }).toThrow('Work item non-existent not found');
    });

    it('should set startedAt when transitioning to in-progress', () => {
      const workItem = createTestWorkItem();
      manager.createWorkItem(workItem);

      manager.updateWorkItem('task-1', { status: 'in-progress' });

      const updated = manager.getWorkItem('task-1');
      expect(updated?.startedAt).toBeInstanceOf(Date);
    });

    it('should set completedAt when transitioning to complete', () => {
      const workItem = createTestWorkItem({ status: 'in-progress' });
      manager.createWorkItem(workItem);

      manager.updateWorkItem('task-1', { status: 'review' });
      manager.updateWorkItem('task-1', { status: 'complete' });

      const updated = manager.getWorkItem('task-1');
      expect(updated?.completedAt).toBeInstanceOf(Date);
    });

    it('should validate state transitions', () => {
      const workItem = createTestWorkItem();
      manager.createWorkItem(workItem);

      // Valid transition: pending -> in-progress
      expect(() => {
        manager.updateWorkItem('task-1', { status: 'in-progress' });
      }).not.toThrow();

      // Invalid transition: in-progress -> complete (must go through review)
      expect(() => {
        manager.updateWorkItem('task-1', { status: 'complete' });
      }).toThrow('Invalid state transition');
    });

    it('should update project state when work item completes', () => {
      const workItem = createTestWorkItem({ status: 'in-progress' });
      manager.createWorkItem(workItem);

      manager.updateWorkItem('task-1', { status: 'review' });
      manager.updateWorkItem('task-1', { status: 'complete' });

      const state = manager.getProjectState();
      expect(state.completedTasks).toContain('task-1');
      expect(state.activeTasks.has('task-1')).toBe(false);
    });

    it('should update project state when work item is blocked', () => {
      const workItem = createTestWorkItem({ status: 'in-progress' });
      manager.createWorkItem(workItem);

      manager.updateWorkItem('task-1', { status: 'blocked' });

      const state = manager.getProjectState();
      expect(state.blockedTasks).toContain('task-1');
    });

    it('should remove from blocked when work item resumes', () => {
      const workItem = createTestWorkItem({ status: 'in-progress' });
      manager.createWorkItem(workItem);

      manager.updateWorkItem('task-1', { status: 'blocked' });
      manager.updateWorkItem('task-1', { status: 'in-progress' });

      const state = manager.getProjectState();
      expect(state.blockedTasks).not.toContain('task-1');
    });

    it('should get all work items', () => {
      manager.createWorkItem(createTestWorkItem({ id: 'task-1' }));
      manager.createWorkItem(createTestWorkItem({ id: 'task-2' }));

      const items = manager.getAllWorkItems();
      expect(items).toHaveLength(2);
    });

    it('should get work items by status', () => {
      manager.createWorkItem(createTestWorkItem({ id: 'task-1', status: 'pending' }));
      manager.createWorkItem(createTestWorkItem({ id: 'task-2', status: 'in-progress' }));
      manager.createWorkItem(createTestWorkItem({ id: 'task-3', status: 'pending' }));

      const pending = manager.getWorkItemsByStatus('pending');
      expect(pending).toHaveLength(2);
      expect(pending.map((i) => i.id)).toContain('task-1');
      expect(pending.map((i) => i.id)).toContain('task-3');
    });

    it('should get work items by agent', () => {
      manager.createWorkItem(createTestWorkItem({ id: 'task-1', assignedTo: 'agent1' }));
      manager.createWorkItem(createTestWorkItem({ id: 'task-2', assignedTo: 'agent2' }));
      manager.createWorkItem(createTestWorkItem({ id: 'task-3', assignedTo: 'agent1' }));

      const agent1Items = manager.getWorkItemsByAgent('agent1');
      expect(agent1Items).toHaveLength(2);
      expect(agent1Items.map((i) => i.id)).toContain('task-1');
      expect(agent1Items.map((i) => i.id)).toContain('task-3');
    });
  });

  // ============================================================================
  // Knowledge Base Tests (Task 3.5)
  // ============================================================================

  describe('Knowledge Base', () => {
    const createTestDecision = (overrides?: Partial<Decision>): Decision => ({
      id: 'decision-1',
      title: 'Use TypeScript',
      context: 'Need type safety for large codebase',
      options: ['TypeScript', 'JavaScript', 'Flow'],
      chosen: 'TypeScript',
      rationale: 'Better tooling and type safety',
      madeBy: 'tech-lead',
      madeAt: new Date(),
      tags: ['language', 'architecture'],
      ...overrides,
    });

    it('should add a decision to knowledge base', () => {
      const decision = createTestDecision();
      manager.addDecision(decision);

      const decisions = manager.getAllDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0]).toEqual(decision);
    });

    it('should add decision as knowledge item', () => {
      const decision = createTestDecision();
      manager.addDecision(decision);

      const results = manager.queryKnowledgeBase('TypeScript');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('decision');
      expect(results[0].title).toBe('Use TypeScript');
    });

    it('should add knowledge items', () => {
      const item: KnowledgeItem = {
        type: 'pattern',
        title: 'Repository Pattern',
        content: 'Use repository pattern for data access',
        tags: ['pattern', 'database'],
        createdAt: new Date(),
      };

      manager.addKnowledgeItem(item);

      const results = manager.queryKnowledgeBase('repository');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Repository Pattern');
    });

    it('should query knowledge base by title', () => {
      manager.addKnowledgeItem({
        type: 'pattern',
        title: 'Singleton Pattern',
        content: 'Use singleton for shared state',
        tags: ['pattern'],
        createdAt: new Date(),
      });

      const results = manager.queryKnowledgeBase('singleton');
      expect(results).toHaveLength(1);
    });

    it('should query knowledge base by content', () => {
      manager.addKnowledgeItem({
        type: 'convention',
        title: 'Naming Convention',
        content: 'Use camelCase for variables',
        tags: ['style'],
        createdAt: new Date(),
      });

      const results = manager.queryKnowledgeBase('camelCase');
      expect(results).toHaveLength(1);
    });

    it('should query knowledge base by tags', () => {
      manager.addKnowledgeItem({
        type: 'anti-pattern',
        title: 'God Object',
        content: 'Avoid creating objects that know too much',
        tags: ['anti-pattern', 'architecture'],
        createdAt: new Date(),
      });

      const results = manager.queryKnowledgeBase('architecture');
      expect(results).toHaveLength(1);
    });

    it('should return multiple matching results', () => {
      manager.addKnowledgeItem({
        type: 'pattern',
        title: 'Factory Pattern',
        content: 'Use factory for object creation',
        tags: ['pattern'],
        createdAt: new Date(),
      });

      manager.addKnowledgeItem({
        type: 'pattern',
        title: 'Builder Pattern',
        content: 'Use builder for complex objects',
        tags: ['pattern'],
        createdAt: new Date(),
      });

      const results = manager.queryKnowledgeBase('pattern');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should get decisions by tag', () => {
      manager.addDecision(createTestDecision({ id: 'dec-1', tags: ['architecture'] }));
      manager.addDecision(createTestDecision({ id: 'dec-2', tags: ['database'] }));
      manager.addDecision(createTestDecision({ id: 'dec-3', tags: ['architecture'] }));

      const archDecisions = manager.getDecisionsByTag('architecture');
      expect(archDecisions).toHaveLength(2);
    });

    it('should warn about contradictory decisions', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const decision1 = createTestDecision({
        id: 'dec-1',
        context: 'Need database for user data',
        chosen: 'PostgreSQL',
        tags: ['database'],
      });

      const decision2 = createTestDecision({
        id: 'dec-2',
        context: 'Need database for user information',
        chosen: 'MongoDB',
        tags: ['database'],
      });

      manager.addDecision(decision1);
      manager.addDecision(decision2);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('contradict');

      consoleSpy.mockRestore();
    });

    it('should handle case-insensitive queries', () => {
      manager.addKnowledgeItem({
        type: 'pattern',
        title: 'Observer Pattern',
        content: 'Use observer for event handling',
        tags: ['pattern'],
        createdAt: new Date(),
      });

      const results1 = manager.queryKnowledgeBase('OBSERVER');
      const results2 = manager.queryKnowledgeBase('observer');

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
    });
  });

  // ============================================================================
  // Concurrent Access Tests
  // ============================================================================

  describe('Concurrent Access', () => {
    it('should handle concurrent state updates', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);

      manager.updateProjectState({ currentPhase: 'phase1' });
      manager.updateProjectState({ currentPhase: 'phase2' });
      manager.updateProjectState({ currentPhase: 'phase3' });

      expect(listener).toHaveBeenCalledTimes(3);

      const state = manager.getProjectState();
      expect(state.currentPhase).toBe('phase3');
      expect(state.version).toBe(3);
    });

    it('should handle concurrent lock requests', async () => {
      const results = await Promise.all([
        manager.acquireFileLock('agent1', 'file.ts', 'write'),
        manager.acquireFileLock('agent2', 'file.ts', 'write'),
        manager.acquireFileLock('agent3', 'file.ts', 'write'),
      ]);

      // Only one should succeed
      const successCount = results.filter((r) => r === true).length;
      expect(successCount).toBe(1);
    });

    it('should handle concurrent work item updates', () => {
      const workItem: WorkItem = {
        id: 'task-1',
        title: 'Test',
        assignedTo: 'agent1',
        status: 'pending',
        dependencies: [],
        artifacts: [],
        timeSpent: 0,
      };

      manager.createWorkItem(workItem);

      manager.updateWorkItem('task-1', { status: 'in-progress' });
      manager.updateWorkItem('task-1', { timeSpent: 100 });
      manager.updateWorkItem('task-1', { artifacts: ['file1.ts'] });

      const updated = manager.getWorkItem('task-1');
      expect(updated?.status).toBe('in-progress');
      expect(updated?.timeSpent).toBe(100);
      expect(updated?.artifacts).toContain('file1.ts');
    });
  });

  // ============================================================================
  // Clear/Reset Tests
  // ============================================================================

  describe('Clear', () => {
    it('should clear all data', async () => {
      // Add some data
      manager.updateProjectState({ currentPhase: 'executing' });
      await manager.acquireFileLock('agent1', 'file.ts', 'write');
      manager.createWorkItem({
        id: 'task-1',
        title: 'Test',
        assignedTo: 'agent1',
        status: 'pending',
        dependencies: [],
        artifacts: [],
        timeSpent: 0,
      });
      manager.addDecision({
        id: 'dec-1',
        title: 'Test Decision',
        context: 'Test',
        options: ['A', 'B'],
        chosen: 'A',
        rationale: 'Test',
        madeBy: 'agent1',
        madeAt: new Date(),
        tags: [],
      });

      // Clear
      manager.clear();

      // Verify everything is reset
      const state = manager.getProjectState();
      expect(state.currentPhase).toBe('initializing');
      expect(state.version).toBe(0);
      expect(manager.isFileLocked('file.ts')).toBe(false);
      expect(manager.getWorkItem('task-1')).toBeUndefined();
      expect(manager.getAllDecisions()).toHaveLength(0);
      expect(manager.queryKnowledgeBase('test')).toHaveLength(0);
    });
  });
});
