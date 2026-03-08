/**
 * Integration Tests: Agent Spawning with Context Injection
 *
 * Tests the complete agent spawning workflow including:
 * - AgentContext injection via KiroIntegration.onAgentSpawn()
 * - Infrastructure API access (sendMessage, acquireFileLock, etc.)
 * - Agent registration in AgentRegistry
 * - Parent-child relationship tracking
 *
 * These tests use real InfrastructureManager (not mocks) to verify
 * end-to-end integration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InfrastructureManager } from '../../lib/infrastructure-manager';
import { KiroIntegration } from '../../lib/kiro-integration';
import { AgentContext } from '../../lib/agent-context';

describe('Agent Spawning with Context Injection', () => {
  let infrastructure: InfrastructureManager;
  let integration: KiroIntegration;

  beforeEach(() => {
    // Initialize real infrastructure for integration testing
    infrastructure = new InfrastructureManager();
    integration = new KiroIntegration(infrastructure);
  });

  afterEach(() => {
    // Clean up all sessions and state
    infrastructure.cleanup();
  });

  describe('Agent spawn with AgentContext injection', () => {
    it('should spawn agent via KiroIntegration.onAgentSpawn()', async () => {
      // Arrange
      const agentId = 'test-agent-1';
      const role = 'developer';
      const capabilities = ['write-code', 'run-tests'];

      // Act
      const context = await integration.onAgentSpawn({
        agentId,
        role,
        capabilities,
        parentId: undefined,
      });

      // Assert
      expect(context).toBeInstanceOf(AgentContext);
      expect(context.agentId).toBe(agentId);
      expect(context.role).toBe(role);
    });

    it('should create AgentContext with correct agentId and role', async () => {
      // Arrange
      const agentId = 'qa-engineer-1';
      const role = 'qa-engineer';

      // Act
      const context = await integration.onAgentSpawn({
        agentId,
        role,
        capabilities: ['write-tests', 'run-tests'],
        parentId: undefined,
      });

      // Assert
      expect(context.agentId).toBe(agentId);
      expect(context.role).toBe(role);
      expect(context.getAgentId()).toBe(agentId);
      expect(context.getRole()).toBe(role);
    });

    it('should inject AgentContext with all required methods', async () => {
      // Arrange
      const agentId = 'test-agent-2';

      // Act
      const context = await integration.onAgentSpawn({
        agentId,
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Assert - Verify all infrastructure API methods are available
      expect(typeof context.sendMessage).toBe('function');
      expect(typeof context.acquireFileLock).toBe('function');
      expect(typeof context.releaseFileLock).toBe('function');
      expect(typeof context.getProjectState).toBe('function');
      expect(typeof context.updateProjectState).toBe('function');
      expect(typeof context.getAgentsByRole).toBe('function');
      expect(typeof context.getAgentStatus).toBe('function');
      expect(typeof context.logAuditEvent).toBe('function');
    });
  });

  describe('Agent can access infrastructure APIs', () => {
    it('should allow agent to call sendMessage()', async () => {
      // Arrange
      const sender = await integration.onAgentSpawn({
        agentId: 'sender-agent',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const receiver = await integration.onAgentSpawn({
        agentId: 'receiver-agent',
        role: 'qa-engineer',
        capabilities: ['write-tests'],
        parentId: undefined,
      });

      // Act
      const messageId = await sender.sendMessage({
        to: 'receiver-agent',
        type: 'task-assignment',
        content: { task: 'Test feature X' },
        priority: 'normal',
      });

      // Assert
      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');
    });

    it('should allow agent to call acquireFileLock()', async () => {
      // Arrange
      const agent = await integration.onAgentSpawn({
        agentId: 'dev-agent',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      const lockAcquired = await agent.acquireFileLock('src/test-file.ts', 'write');

      // Assert
      expect(lockAcquired).toBe(true);
    });

    it('should allow agent to call getProjectState()', async () => {
      // Arrange
      const agent = await integration.onAgentSpawn({
        agentId: 'test-agent',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      const state = await agent.getProjectState();

      // Assert
      expect(state).toBeDefined();
      expect(typeof state).toBe('object');
    });

    it('should allow agent to call getAgentsByRole()', async () => {
      // Arrange
      await integration.onAgentSpawn({
        agentId: 'dev-1',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const queryAgent = await integration.onAgentSpawn({
        agentId: 'tech-lead',
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      // Act
      const developers = await queryAgent.getAgentsByRole('developer');

      // Assert
      expect(developers).toBeDefined();
      expect(Array.isArray(developers)).toBe(true);
      expect(developers.length).toBeGreaterThan(0);
      expect(developers[0].role).toBe('developer');
    });
  });

  describe('Agent registered in AgentRegistry', () => {
    it('should register agent in registry after spawn', async () => {
      // Arrange
      const agentId = 'registered-agent';

      // Act
      await integration.onAgentSpawn({
        agentId,
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Assert
      const registry = infrastructure.getAgentRegistry();
      const agent = registry.getAgent(agentId);
      expect(agent).toBeDefined();
      expect(agent?.id).toBe(agentId);
    });

    it('should register agent with correct role and capabilities', async () => {
      // Arrange
      const agentId = 'qa-agent';
      const role = 'qa-engineer';
      const capabilities = ['write-tests', 'run-tests', 'report-bugs'];

      // Act
      await integration.onAgentSpawn({
        agentId,
        role,
        capabilities,
        parentId: undefined,
      });

      // Assert
      const registry = infrastructure.getAgentRegistry();
      const agent = registry.getAgent(agentId);
      expect(agent?.role).toBe(role);
      expect(agent?.capabilities).toEqual(capabilities);
    });

    it('should set agent status to idle after spawn', async () => {
      // Arrange
      const agentId = 'idle-agent';

      // Act
      const context = await integration.onAgentSpawn({
        agentId,
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Assert
      const status = await context.getAgentStatus(agentId);
      expect(status).toBe('idle');
    });
  });

  describe('Parent-child relationship recorded', () => {
    it('should record parent-child relationship when spawning child', async () => {
      // Arrange
      const parentId = 'tech-lead-agent';
      const childId = 'developer-agent';

      // Act - Spawn parent
      await integration.onAgentSpawn({
        agentId: parentId,
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      // Act - Spawn child with parentId
      await integration.onAgentSpawn({
        agentId: childId,
        role: 'developer',
        capabilities: ['write-code'],
        parentId: parentId,
      });

      // Assert
      const hierarchy = infrastructure.getAgentHierarchy();
      const children = hierarchy.getChildAgents(parentId);
      expect(children).toContain(childId);
    });

    it('should return correct parent via getParentAgent()', async () => {
      // Arrange
      const parentId = 'parent-agent';
      const childId = 'child-agent';

      // Act
      await integration.onAgentSpawn({
        agentId: parentId,
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      await integration.onAgentSpawn({
        agentId: childId,
        role: 'developer',
        capabilities: ['write-code'],
        parentId: parentId,
      });

      // Assert
      const hierarchy = infrastructure.getAgentHierarchy();
      const parent = hierarchy.getParentAgent(childId);
      expect(parent).toBe(parentId);
    });

    it('should support multiple children for one parent', async () => {
      // Arrange
      const parentId = 'tech-lead';
      const child1Id = 'dev-1';
      const child2Id = 'dev-2';
      const child3Id = 'qa-1';

      // Act
      await integration.onAgentSpawn({
        agentId: parentId,
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      await integration.onAgentSpawn({
        agentId: child1Id,
        role: 'developer',
        capabilities: ['write-code'],
        parentId: parentId,
      });

      await integration.onAgentSpawn({
        agentId: child2Id,
        role: 'developer',
        capabilities: ['write-code'],
        parentId: parentId,
      });

      await integration.onAgentSpawn({
        agentId: child3Id,
        role: 'qa-engineer',
        capabilities: ['write-tests'],
        parentId: parentId,
      });

      // Assert
      const hierarchy = infrastructure.getAgentHierarchy();
      const children = hierarchy.getChildAgents(parentId);
      expect(children).toHaveLength(3);
      expect(children).toContain(child1Id);
      expect(children).toContain(child2Id);
      expect(children).toContain(child3Id);
    });

    it('should return undefined parent for root agents', async () => {
      // Arrange
      const rootId = 'root-agent';

      // Act
      await integration.onAgentSpawn({
        agentId: rootId,
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      // Assert
      const hierarchy = infrastructure.getAgentHierarchy();
      const parent = hierarchy.getParentAgent(rootId);
      expect(parent).toBeUndefined();
    });
  });
});
