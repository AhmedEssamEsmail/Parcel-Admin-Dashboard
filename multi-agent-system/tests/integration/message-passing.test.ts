/**
 * Integration Tests: Message Passing Between Agents
 *
 * Tests the complete message passing workflow including:
 * - Sending messages between agents
 * - Message delivery via callbacks
 * - Message acknowledgment
 * - Priority ordering
 * - Permission enforcement
 *
 * These tests use real MessageBus and InfrastructureManager to verify
 * end-to-end message flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InfrastructureManager } from '../../lib/infrastructure-manager';
import { KiroIntegration } from '../../lib/kiro-integration';
import { AgentContext } from '../../lib/agent-context';

describe('Message Passing Between Agents', () => {
  let infrastructure: InfrastructureManager;
  let integration: KiroIntegration;

  beforeEach(() => {
    infrastructure = new InfrastructureManager();
    integration = new KiroIntegration(infrastructure);
  });

  afterEach(() => {
    infrastructure.cleanup();
  });

  describe('Agent A sends message to Agent B', () => {
    it('should queue message in MessageBus when sent', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'qa-engineer',
        capabilities: ['write-tests'],
        parentId: undefined,
      });

      // Act
      const messageId = await agentA.sendMessage({
        to: 'agent-b',
        type: 'task-assignment',
        content: { task: 'Test authentication' },
        priority: 'normal',
      });

      // Assert
      expect(messageId).toBeDefined();
      const messageBus = infrastructure.getMessageBus();
      const messages = messageBus.getMessagesForAgent('agent-b');
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].id).toBe(messageId);
    });

    it('should include correct sender and recipient in message', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'sender',
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      await integration.onAgentSpawn({
        agentId: 'recipient',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act
      await agentA.sendMessage({
        to: 'recipient',
        type: 'task-assignment',
        content: { task: 'Implement feature' },
        priority: 'high',
      });

      // Assert
      const messageBus = infrastructure.getMessageBus();
      const messages = messageBus.getMessagesForAgent('recipient');
      expect(messages[0].from).toBe('sender');
      expect(messages[0].to).toBe('recipient');
    });
  });

  describe('Agent B receives message via callback', () => {
    it('should invoke callback when message is delivered', async () => {
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

      const callback = vi.fn();
      const messageBus = infrastructure.getMessageBus();
      messageBus.subscribe('agent-b', callback);

      // Act
      await agentA.sendMessage({
        to: 'agent-b',
        type: 'task-assignment',
        content: { task: 'Test feature' },
        priority: 'normal',
      });

      // Trigger message delivery
      await messageBus.deliverMessages('agent-b');

      // Assert
      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'agent-a',
          to: 'agent-b',
          type: 'task-assignment',
        })
      );
    });

    it('should deliver message with correct content', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      const agentB = await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const expectedContent = {
        task: 'Implement authentication',
        deadline: '2024-01-15',
        priority: 'high',
      };

      let receivedMessage: any = null;
      const messageBus = infrastructure.getMessageBus();
      messageBus.subscribe('agent-b', (msg) => {
        receivedMessage = msg;
      });

      // Act
      await agentA.sendMessage({
        to: 'agent-b',
        type: 'task-assignment',
        content: expectedContent,
        priority: 'high',
      });

      await messageBus.deliverMessages('agent-b');

      // Assert
      expect(receivedMessage).not.toBeNull();
      expect(receivedMessage.content).toEqual(expectedContent);
    });

    it('should not deliver message to wrong recipient', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      await integration.onAgentSpawn({
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

      const callbackB = vi.fn();
      const callbackC = vi.fn();
      const messageBus = infrastructure.getMessageBus();
      messageBus.subscribe('agent-b', callbackB);
      messageBus.subscribe('agent-c', callbackC);

      // Act
      await agentA.sendMessage({
        to: 'agent-b',
        type: 'task-assignment',
        content: { task: 'Test feature' },
        priority: 'normal',
      });

      await messageBus.deliverMessages('agent-b');
      await messageBus.deliverMessages('agent-c');

      // Assert
      expect(callbackB).toHaveBeenCalled();
      expect(callbackC).not.toHaveBeenCalled();
    });
  });

  describe('Agent B acknowledges message', () => {
    it('should mark message as acknowledged when acknowledged', async () => {
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

      const messageBus = infrastructure.getMessageBus();
      let messageId: string = '';

      messageBus.subscribe('agent-b', async (msg) => {
        messageId = msg.id;
        await agentB.acknowledgeMessage(msg.id);
      });

      // Act
      await agentA.sendMessage({
        to: 'agent-b',
        type: 'task-assignment',
        content: { task: 'Test feature' },
        priority: 'normal',
      });

      await messageBus.deliverMessages('agent-b');

      // Assert
      const message = messageBus.getMessage(messageId);
      expect(message?.acknowledged).toBe(true);
    });

    it('should not redeliver acknowledged messages', async () => {
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

      const callback = vi.fn();
      const messageBus = infrastructure.getMessageBus();

      messageBus.subscribe('agent-b', async (msg) => {
        callback();
        await agentB.acknowledgeMessage(msg.id);
      });

      // Act
      await agentA.sendMessage({
        to: 'agent-b',
        type: 'task-assignment',
        content: { task: 'Test feature' },
        priority: 'normal',
      });

      await messageBus.deliverMessages('agent-b');
      await messageBus.deliverMessages('agent-b'); // Try to deliver again

      // Assert
      expect(callback).toHaveBeenCalledTimes(1); // Should only be called once
    });
  });

  describe('Priority ordering', () => {
    it('should deliver high priority messages before normal priority', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const deliveryOrder: string[] = [];
      const messageBus = infrastructure.getMessageBus();

      messageBus.subscribe('agent-b', (msg) => {
        deliveryOrder.push(msg.content.task);
      });

      // Act - Send normal priority first, then high priority
      await agentA.sendMessage({
        to: 'agent-b',
        type: 'task-assignment',
        content: { task: 'Normal task' },
        priority: 'normal',
      });

      await agentA.sendMessage({
        to: 'agent-b',
        type: 'task-assignment',
        content: { task: 'High priority task' },
        priority: 'high',
      });

      await messageBus.deliverMessages('agent-b');

      // Assert - High priority should be delivered first
      expect(deliveryOrder[0]).toBe('High priority task');
      expect(deliveryOrder[1]).toBe('Normal task');
    });

    it('should deliver critical messages before high priority', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      await integration.onAgentSpawn({
        agentId: 'agent-b',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      const deliveryOrder: string[] = [];
      const messageBus = infrastructure.getMessageBus();

      messageBus.subscribe('agent-b', (msg) => {
        deliveryOrder.push(msg.priority);
      });

      // Act
      await agentA.sendMessage({
        to: 'agent-b',
        type: 'task-assignment',
        content: { task: 'Task 1' },
        priority: 'normal',
      });

      await agentA.sendMessage({
        to: 'agent-b',
        type: 'task-assignment',
        content: { task: 'Task 2' },
        priority: 'high',
      });

      await agentA.sendMessage({
        to: 'agent-b',
        type: 'task-assignment',
        content: { task: 'Task 3' },
        priority: 'critical',
      });

      await messageBus.deliverMessages('agent-b');

      // Assert
      expect(deliveryOrder[0]).toBe('critical');
      expect(deliveryOrder[1]).toBe('high');
      expect(deliveryOrder[2]).toBe('normal');
    });
  });

  describe('Permission enforcement', () => {
    it('should reject message if sender cannot communicate with recipient', async () => {
      // Arrange
      const agentA = await integration.onAgentSpawn({
        agentId: 'agent-a',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      await integration.onAgentSpawn({
        agentId: 'agent-c',
        role: 'devops',
        capabilities: ['deploy'],
        parentId: undefined,
      });

      // Act & Assert
      // Developer should not be able to directly message DevOps
      // (assuming permission rules are configured)
      await expect(
        agentA.sendMessage({
          to: 'agent-c',
          type: 'task-assignment',
          content: { task: 'Deploy now' },
          priority: 'high',
        })
      ).rejects.toThrow();
    });

    it('should allow message if sender has permission', async () => {
      // Arrange
      const techLead = await integration.onAgentSpawn({
        agentId: 'tech-lead',
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      await integration.onAgentSpawn({
        agentId: 'developer',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: undefined,
      });

      // Act & Assert
      // Tech Lead should be able to message any agent
      await expect(
        techLead.sendMessage({
          to: 'developer',
          type: 'task-assignment',
          content: { task: 'Implement feature' },
          priority: 'normal',
        })
      ).resolves.toBeDefined();
    });

    it('should allow parent to message child', async () => {
      // Arrange
      const parent = await integration.onAgentSpawn({
        agentId: 'parent',
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      await integration.onAgentSpawn({
        agentId: 'child',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: 'parent',
      });

      // Act & Assert
      await expect(
        parent.sendMessage({
          to: 'child',
          type: 'task-assignment',
          content: { task: 'Implement feature' },
          priority: 'normal',
        })
      ).resolves.toBeDefined();
    });

    it('should allow child to message parent', async () => {
      // Arrange
      await integration.onAgentSpawn({
        agentId: 'parent',
        role: 'tech-lead',
        capabilities: ['coordinate'],
        parentId: undefined,
      });

      const child = await integration.onAgentSpawn({
        agentId: 'child',
        role: 'developer',
        capabilities: ['write-code'],
        parentId: 'parent',
      });

      // Act & Assert
      await expect(
        child.sendMessage({
          to: 'parent',
          type: 'status-update',
          content: { status: 'Task complete' },
          priority: 'normal',
        })
      ).resolves.toBeDefined();
    });
  });
});
