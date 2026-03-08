/**
 * Integration Tests: Shared Context and File Locking
 *
 * Tests the shared state management and file locking mechanisms:
 * - Multiple agents accessing shared project state
 * - Concurrent state updates and merging
 * - File lock acquisition and release
 * - Lock blocking and timeout behavior
 * - Automatic lock cleanup on session end
 *
 * These tests use real InfrastructureManager to verify
 * end-to-end state management and locking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InfrastructureManager } from '../../lib/infrastructure-manager';
import { KiroIntegration } from '../../lib/kiro-integration';
import { AgentContext } from '../../lib/agent-context';

describe('Shared Context and File Locking', () => {
  let infrastructure: InfrastructureManager;
  let integration: KiroIntegration;

  beforeEach(() => {
    infrastructure = new InfrastructureManager();
    integration = new KiroIntegration(infrastructure);
  });

  afterEach(() => {
    infrastructure.cleanup();
  });

  describe('Multiple agents access shared state', () => {
    it("should allow Agent B to read Agent A's state updates", async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'qa-engineer',
        capabilities: ['write-tests'],
        parentId: undefined,
      });

      // Act - Agent A updates state
      await agentA.updateProjectState({
        featureStatus: {
          authentication: 'implemented',
        },
      });

      // Agent B reads state
      const state = await agentB.getProjectState();

      // Assert
      expect(state.featureStatus).toBeDefined();
      expect(state.featureStatus.authentication).toBe('implemented');
    });

    it('should maintain state consistency across multiple reads', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'qa-engineer',
        capabilities: ['write-tests'],
        parentId: undefined,
      });

      const agentC = await integration.onAgentSpawn({
        agentId: 'agent-c',
        role: 'devops',
        capabilities: ['deploy'],
        parentId: undefined,
      });

      // Act
      await agentA.updateProjectState({
        version: '1.0.0',
        buildNumber: 42,
      });

      const stateB = await agentB.getProjectState();
      const stateC = await agentC.getProjectState();

      // Assert
      expect(stateB.version).toBe('1.0.0');
      expect(stateB.buildNumber).toBe(42);
      expect(stateC.version).toBe('1.0.0');
      expect(stateC.buildNumber).toBe(42);
    });

    it('should reflect latest updates from any agent', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      await agentA.updateProjectState({ step: 1 });
      let state = await agentB.getProjectState();
      expect(state.step).toBe(1);

      await agentB.updateProjectState({ step: 2 });
      state = await agentA.getProjectState();
      expect(state.step).toBe(2);

      await agentA.updateProjectState({ step: 3 });
      state = await agentB.getProjectState();

      // Assert
      expect(state.step).toBe(3);
    });
  });

  describe('Concurrent state updates merge correctly', () => {
    it('should preserve both updates when agents update different fields', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act - Both agents update different fields
      await agentA.updateProjectState({
        authentication: 'complete',
      });

      await agentB.updateProjectState({
        database: 'migrated',
      });

      // Assert
      const state = await agentA.getProjectState();
      expect(state.authentication).toBe('complete');
      expect(state.database).toBe('migrated');
    });

    it('should handle nested object updates correctly', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      await agentA.updateProjectState({
        features: {
          auth: { status: 'complete', tests: 10 },
        },
      });

      await agentB.updateProjectState({
        features: {
          payment: { status: 'in-progress', tests: 5 },
        },
      });

      // Assert
      const state = await agentA.getProjectState();
      expect(state.features.auth).toBeDefined();
      expect(state.features.payment).toBeDefined();
      expect(state.features.auth.status).toBe('complete');
      expect(state.features.payment.status).toBe('in-progress');
    });

    it('should use last-write-wins for same field updates', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act - Both update same field
      await agentA.updateProjectState({ status: 'building' });
      await agentB.updateProjectState({ status: 'testing' });

      // Assert - Last write wins
      const state = await agentA.getProjectState();
      expect(state.status).toBe('testing');
    });
  });

  describe('Agent acquires file lock before editing', () => {
    it('should grant write lock when file is unlocked', async () => {
      // Arrange
      const agent = await integration.onAgentSpawn({
        agentId: 'dev-agent',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      const lockAcquired = await agent.acquireFileLock('src/auth.ts', 'write');

      // Assert
      expect(lockAcquired).toBe(true);
    });

    it('should grant read lock when file has no write lock', async () => {
      // Arrange
      const agent = await integration.onAgentSpawn({
        agentId: 'qa-agent',
        role: 'qa-engineer',
        capabilities: ['write-tests'],
        parentId: undefined,
      });

      // Act
      const lockAcquired = await agent.acquireFileLock('src/auth.ts', 'read');

      // Assert
      expect(lockAcquired).toBe(true);
    });

    it('should allow multiple read locks on same file', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'qa-engineer',
        capabilities: ['write-tests'],
        parentId: undefined,
      });

      // Act
      const lockA = await agentA.acquireFileLock('src/utils.ts', 'read');
      const lockB = await agentB.acquireFileLock('src/utils.ts', 'read');

      // Assert
      expect(lockA).toBe(true);
      expect(lockB).toBe(true);
    });

    it('should track which agent holds the lock', async () => {
      // Arrange
      const agent = await integration.onAgentSpawn({
        agentId: 'dev-agent',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      await agent.acquireFileLock('src/auth.ts', 'write');

      // Assert
      const lockManager = infrastructure.getFileLockManager();
      const lockInfo = lockManager.getLockInfo('src/auth.ts');
      expect(lockInfo).toBeDefined();
      expect(lockInfo?.holders).toContain('dev-agent');
    });
  });

  describe('Other agents blocked until lock released', () => {
    it('should block Agent B when Agent A holds write lock', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      await agentA.acquireFileLock('src/auth.ts', 'write');
      const lockB = await agentB.acquireFileLock('src/auth.ts', 'write', {
        timeout: 100,
      });

      // Assert
      expect(lockB).toBe(false); // Should timeout
    });

    it('should block write lock when read locks exist', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'qa-engineer',
        capabilities: ['write-tests'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      await agentA.acquireFileLock('src/auth.ts', 'read');
      const lockB = await agentB.acquireFileLock('src/auth.ts', 'write', {
        timeout: 100,
      });

      // Assert
      expect(lockB).toBe(false); // Should timeout
    });

    it('should grant lock to Agent B after Agent A releases', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      await agentA.acquireFileLock('src/auth.ts', 'write');
      await agentA.releaseFileLock('src/auth.ts');
      const lockB = await agentB.acquireFileLock('src/auth.ts', 'write');

      // Assert
      expect(lockB).toBe(true);
    });

    it('should queue lock requests and grant in order', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentC = await integration.onAgentSpawn({
        agentId: 'agent-c',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      await agentA.acquireFileLock('src/auth.ts', 'write');

      // B and C try to acquire (will be queued)
      const lockBPromise = agentB.acquireFileLock('src/auth.ts', 'write', {
        timeout: 5000,
      });
      const lockCPromise = agentC.acquireFileLock('src/auth.ts', 'write', {
        timeout: 5000,
      });

      // Release A's lock
      await agentA.releaseFileLock('src/auth.ts');

      // Wait for B to get lock
      const lockB = await lockBPromise;
      expect(lockB).toBe(true);

      // Release B's lock
      await agentB.releaseFileLock('src/auth.ts');

      // C should now get lock
      const lockC = await lockCPromise;
      expect(lockC).toBe(true);
    });
  });

  describe('Locks automatically released on session end', () => {
    it('should release all locks when agent session ends', async () => {
      // Arrange
      const agent = await integration.onAgentSpawn({
        agentId: 'temp-agent',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act - Acquire multiple locks
      await agent.acquireFileLock('src/auth.ts', 'write');
      await agent.acquireFileLock('src/utils.ts', 'write');
      await agent.acquireFileLock('src/config.ts', 'read');

      // End session
      const sessionManager = infrastructure.getSessionManager();
      await sessionManager.endSession('temp-agent');

      // Assert - All locks should be released
      const lockManager = infrastructure.getFileLockManager();
      expect(lockManager.getLockInfo('src/auth.ts')).toBeUndefined();
      expect(lockManager.getLockInfo('src/utils.ts')).toBeUndefined();
      expect(lockManager.getLockInfo('src/config.ts')).toBeUndefined();
    });

    it('should allow other agents to acquire locks after session end', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      await agentA.acquireFileLock('src/auth.ts', 'write');

      // End Agent A's session
      const sessionManager = infrastructure.getSessionManager();
      await sessionManager.endSession('agent-a');

      // Agent B should now be able to acquire lock
      const lockB = await agentB.acquireFileLock('src/auth.ts', 'write');

      // Assert
      expect(lockB).toBe(true);
    });

    it('should clean up locks for all child agents when parent ends', async () => {
      // Arrange
      const parent = await integration.onAgentSpawn({
        agentId: 'parent',
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      const child1 = await integration.onAgentSpawn({
        agentId: 'child-1',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: 'parent',
      });

      const child2 = await integration.onAgentSpawn({
        agentId: 'child-2',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: 'parent',
      });

      // Act - Children acquire locks
      await child1.acquireFileLock('src/file1.ts', 'write');
      await child2.acquireFileLock('src/file2.ts', 'write');

      // End parent session (should cascade to children)
      const sessionManager = infrastructure.getSessionManager();
      await sessionManager.endSession('parent');

      // Assert - All locks should be released
      const lockManager = infrastructure.getFileLockManager();
      expect(lockManager.getLockInfo('src/file1.ts')).toBeUndefined();
      expect(lockManager.getLockInfo('src/file2.ts')).toBeUndefined();
    });

    it('should handle cleanup even with many locks', async () => {
      // Arrange
      const agent = await integration.onAgentSpawn({
        agentId: 'busy-agent',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act - Acquire many locks
      const files = Array.from({ length: 50 }, (_, i) => `src/file${i}.ts`);
      for (const file of files) {
        await agent.acquireFileLock(file, 'write');
      }

      // End session
      const sessionManager = infrastructure.getSessionManager();
      await sessionManager.endSession('busy-agent');

      // Assert - All locks released
      const lockManager = infrastructure.getFileLockManager();
      for (const file of files) {
        expect(lockManager.getLockInfo(file)).toBeUndefined();
      }
    });
  });
});
