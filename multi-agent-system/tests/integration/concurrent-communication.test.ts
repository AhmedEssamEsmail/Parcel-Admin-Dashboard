/**
 * Integration test for concurrent agent communication
 *
 * Tests real-time message passing between multiple agents running concurrently
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConcurrentAgentCoordinator } from '../../lib/concurrent-agent-coordinator';
import { AgentInvocationManager } from '../../lib/agent-invocation';
import { MessageBus } from '../../lib/message-bus';
import { AgentRegistry } from '../../lib/agent-registry';
import { AgentDefinitionLoader } from '../../lib/agent-definition-loader';
import { AgentRole } from '../../lib/agent-definition-schema';
import { AgentMessage } from '../../lib/types';
import { AgentInvocationResult } from '../../lib/agent-invocation-types';

describe('Concurrent Agent Communication', () => {
  let coordinator: ConcurrentAgentCoordinator;
  let invocationManager: AgentInvocationManager;
  let messageBus: MessageBus;
  let registry: AgentRegistry;
  let definitionLoader: AgentDefinitionLoader;

  beforeEach(() => {
    messageBus = new MessageBus();
    registry = new AgentRegistry();
    definitionLoader = new AgentDefinitionLoader();
    invocationManager = new AgentInvocationManager(registry, definitionLoader, messageBus);
    coordinator = new ConcurrentAgentCoordinator(invocationManager, messageBus, registry);
  });

  afterEach(async () => {
    await coordinator.cleanup();
  });

  describe('startConcurrentSession', () => {
    it('should spawn multiple agents concurrently', async () => {
      const messages: Array<{ agentId: string; message: AgentMessage }> = [];
      const completions: Array<{ agentId: string; result: AgentInvocationResult }> = [];

      const sessionId = await coordinator.startConcurrentSession({
        sessionId: 'test-session-1',
        coordinatorId: 'tech-lead-1',
        agents: [
          {
            agentId: 'developer-1',
            role: AgentRole.DEVELOPER,
            task: 'Implement authentication',
          },
          {
            agentId: 'security-1',
            role: AgentRole.SECURITY_ENGINEER,
            task: 'Review security',
          },
          {
            agentId: 'qa-1',
            role: AgentRole.QA_ENGINEER,
            task: 'Test implementation',
          },
        ],
        onMessage: async (agentId, message) => {
          messages.push({ agentId, message });
        },
        onAgentComplete: async (agentId, result) => {
          completions.push({ agentId, result });
        },
      });

      expect(sessionId).toBe('test-session-1');

      const status = coordinator.getSessionStatus(sessionId);
      expect(status).toBeDefined();
      expect(status?.activeAgents).toHaveLength(3);
      expect(status?.activeAgents).toContain('developer-1');
      expect(status?.activeAgents).toContain('security-1');
      expect(status?.activeAgents).toContain('qa-1');
    });

    it('should enable real-time message passing between agents', async () => {
      const messages: AgentMessage[] = [];

      const sessionId = await coordinator.startConcurrentSession({
        sessionId: 'test-session-2',
        coordinatorId: 'tech-lead-1',
        agents: [
          {
            agentId: 'developer-1',
            role: AgentRole.DEVELOPER,
            task: 'Implement feature',
            canCommunicateWith: ['security-1', 'performance-1'],
          },
          {
            agentId: 'security-1',
            role: AgentRole.SECURITY_ENGINEER,
            task: 'Review security',
            canCommunicateWith: ['developer-1', 'performance-1'],
          },
          {
            agentId: 'performance-1',
            role: AgentRole.PERFORMANCE_ENGINEER,
            task: 'Benchmark performance',
            canCommunicateWith: ['developer-1', 'security-1'],
          },
        ],
        onMessage: async (agentId, message) => {
          messages.push(message);
        },
      });

      // Simulate message exchange
      await coordinator.sendMessageToAgent(sessionId, 'developer-1', 'security-1', {
        type: 'request',
        payload: {
          action: 'review-code',
          context: { file: 'auth.ts' },
        },
      });

      await coordinator.sendMessageToAgent(sessionId, 'security-1', 'developer-1', {
        type: 'response',
        payload: {
          action: 'review-complete',
          context: { issues: ['SQL injection risk'] },
        },
      });

      await coordinator.sendMessageToAgent(sessionId, 'developer-1', 'performance-1', {
        type: 'request',
        payload: {
          action: 'benchmark-query',
          context: { query: 'SELECT * FROM users' },
        },
      });

      // Wait a bit for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages.length).toBeGreaterThanOrEqual(3);

      // Verify message flow
      const devToSecurity = messages.find((m) => m.from === 'developer-1' && m.to === 'security-1');
      expect(devToSecurity).toBeDefined();
      expect(devToSecurity?.payload.action).toBe('review-code');

      const securityToDev = messages.find((m) => m.from === 'security-1' && m.to === 'developer-1');
      expect(securityToDev).toBeDefined();
      expect(securityToDev?.payload.action).toBe('review-complete');

      const devToPerformance = messages.find(
        (m) => m.from === 'developer-1' && m.to === 'performance-1'
      );
      expect(devToPerformance).toBeDefined();
      expect(devToPerformance?.payload.action).toBe('benchmark-query');
    });

    it('should support broadcast messages to all agents', async () => {
      const messages: AgentMessage[] = [];

      const sessionId = await coordinator.startConcurrentSession({
        sessionId: 'test-session-3',
        coordinatorId: 'tech-lead-1',
        agents: [
          {
            agentId: 'developer-1',
            role: AgentRole.DEVELOPER,
            task: 'Task 1',
          },
          {
            agentId: 'developer-2',
            role: AgentRole.DEVELOPER,
            task: 'Task 2',
          },
          {
            agentId: 'developer-3',
            role: AgentRole.DEVELOPER,
            task: 'Task 3',
          },
        ],
        onMessage: async (agentId, message) => {
          messages.push(message);
        },
      });

      // Broadcast message from tech lead to all developers
      await coordinator.broadcastMessage(sessionId, 'tech-lead-1', {
        type: 'notification',
        payload: {
          action: 'priority-change',
          context: { priority: 'high' },
        },
      });

      // Wait for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have 3 messages (one to each developer)
      const broadcasts = messages.filter(
        (m) => m.from === 'tech-lead-1' && m.payload.action === 'priority-change'
      );
      expect(broadcasts.length).toBe(3);

      const recipients = broadcasts.map((m) => m.to);
      expect(recipients).toContain('developer-1');
      expect(recipients).toContain('developer-2');
      expect(recipients).toContain('developer-3');
    });

    it('should track message count across all agents', async () => {
      const sessionId = await coordinator.startConcurrentSession({
        sessionId: 'test-session-4',
        coordinatorId: 'tech-lead-1',
        agents: [
          {
            agentId: 'developer-1',
            role: AgentRole.DEVELOPER,
            task: 'Task 1',
          },
          {
            agentId: 'developer-2',
            role: AgentRole.DEVELOPER,
            task: 'Task 2',
          },
        ],
      });

      // Send multiple messages
      await coordinator.sendMessageToAgent(sessionId, 'developer-1', 'developer-2', {
        type: 'request',
        payload: { action: 'help' },
      });

      await coordinator.sendMessageToAgent(sessionId, 'developer-2', 'developer-1', {
        type: 'response',
        payload: { action: 'help-response' },
      });

      await coordinator.sendMessageToAgent(sessionId, 'developer-1', 'developer-2', {
        type: 'notification',
        payload: { action: 'thanks' },
      });

      // Wait for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = coordinator.getSessionStatus(sessionId);
      expect(status?.messageCount).toBeGreaterThanOrEqual(3);
    });

    it('should handle agent completion and update status', async () => {
      const completions: string[] = [];

      const sessionId = await coordinator.startConcurrentSession({
        sessionId: 'test-session-5',
        coordinatorId: 'tech-lead-1',
        agents: [
          {
            agentId: 'developer-1',
            role: AgentRole.DEVELOPER,
            task: 'Quick task',
          },
        ],
        onAgentComplete: async (agentId, result) => {
          completions.push(agentId);
        },
      });

      // Simulate agent completion
      await messageBus.send({
        id: 'msg-complete-1',
        from: 'developer-1',
        to: 'tech-lead-1',
        type: 'notification',
        priority: 'normal',
        payload: {
          action: 'work-complete',
          result: { success: true },
        },
        timestamp: new Date(),
        acknowledged: false,
      });

      // Wait for completion to be processed
      await new Promise((resolve) => setTimeout(resolve, 200));

      const status = coordinator.getSessionStatus(sessionId);
      expect(status?.completedAgents).toContain('developer-1');
      expect(status?.activeAgents).not.toContain('developer-1');
      expect(completions).toContain('developer-1');
    });

    it('should call onAllComplete when all agents finish', async () => {
      let allCompleteResults: Map<string, AgentInvocationResult> | undefined;

      const sessionId = await coordinator.startConcurrentSession({
        sessionId: 'test-session-6',
        coordinatorId: 'tech-lead-1',
        agents: [
          {
            agentId: 'developer-1',
            role: AgentRole.DEVELOPER,
            task: 'Task 1',
          },
          {
            agentId: 'developer-2',
            role: AgentRole.DEVELOPER,
            task: 'Task 2',
          },
        ],
        onAllComplete: async (results) => {
          allCompleteResults = results;
        },
      });

      // Complete both agents
      await messageBus.send({
        id: 'msg-complete-1',
        from: 'developer-1',
        to: 'tech-lead-1',
        type: 'notification',
        priority: 'normal',
        payload: {
          action: 'work-complete',
          result: { success: true },
        },
        timestamp: new Date(),
        acknowledged: false,
      });

      await messageBus.send({
        id: 'msg-complete-2',
        from: 'developer-2',
        to: 'tech-lead-1',
        type: 'notification',
        priority: 'normal',
        payload: {
          action: 'work-complete',
          result: { success: true },
        },
        timestamp: new Date(),
        acknowledged: false,
      });

      // Wait for all completions to be processed
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(allCompleteResults).toBeDefined();
      expect(allCompleteResults?.size).toBe(2);
      expect(allCompleteResults?.has('developer-1')).toBe(true);
      expect(allCompleteResults?.has('developer-2')).toBe(true);

      const status = coordinator.getSessionStatus(sessionId);
      expect(status?.status).toBe('completed');
    });

    it('should handle session timeout', async () => {
      const sessionId = await coordinator.startConcurrentSession({
        sessionId: 'test-session-7',
        coordinatorId: 'tech-lead-1',
        agents: [
          {
            agentId: 'developer-1',
            role: AgentRole.DEVELOPER,
            task: 'Long running task',
          },
        ],
        timeout: 100, // 100ms timeout
      });

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 200));

      const status = coordinator.getSessionStatus(sessionId);
      expect(status?.status).toBe('timeout');
      expect(status?.failedAgents).toContain('developer-1');
      expect(status?.activeAgents).toHaveLength(0);
    });
  });

  describe('waitForSession', () => {
    it('should wait for session to complete', async () => {
      const sessionId = await coordinator.startConcurrentSession({
        sessionId: 'test-session-8',
        coordinatorId: 'tech-lead-1',
        agents: [
          {
            agentId: 'developer-1',
            role: AgentRole.DEVELOPER,
            task: 'Task 1',
          },
        ],
      });

      // Complete agent after a delay
      setTimeout(async () => {
        await messageBus.send({
          id: 'msg-complete-1',
          from: 'developer-1',
          to: 'tech-lead-1',
          type: 'notification',
          priority: 'normal',
          payload: {
            action: 'work-complete',
            result: { success: true },
          },
          timestamp: new Date(),
          acknowledged: false,
        });
      }, 100);

      const results = await coordinator.waitForSession(sessionId);

      expect(results.size).toBe(1);
      expect(results.has('developer-1')).toBe(true);
    });
  });

  describe('terminateSession', () => {
    it('should terminate all agents in session', async () => {
      const sessionId = await coordinator.startConcurrentSession({
        sessionId: 'test-session-9',
        coordinatorId: 'tech-lead-1',
        agents: [
          {
            agentId: 'developer-1',
            role: AgentRole.DEVELOPER,
            task: 'Task 1',
          },
          {
            agentId: 'developer-2',
            role: AgentRole.DEVELOPER,
            task: 'Task 2',
          },
        ],
      });

      await coordinator.terminateSession(sessionId);

      const status = coordinator.getSessionStatus(sessionId);
      expect(status).toBeUndefined();
    });
  });

  describe('Real-world scenario: Query Optimization Collaboration', () => {
    it('should enable 3 agents to collaborate on query optimization', async () => {
      const messageLog: Array<{
        round: number;
        from: string;
        to: string;
        action: string;
        content: string;
      }> = [];

      const sessionId = await coordinator.startConcurrentSession({
        sessionId: 'query-optimization',
        coordinatorId: 'tech-lead-1',
        agents: [
          {
            agentId: 'developer-1',
            role: AgentRole.DEVELOPER,
            task: 'Optimize database query',
            canCommunicateWith: ['security-1', 'performance-1'],
          },
          {
            agentId: 'security-1',
            role: AgentRole.SECURITY_ENGINEER,
            task: 'Review query security',
            canCommunicateWith: ['developer-1', 'performance-1'],
          },
          {
            agentId: 'performance-1',
            role: AgentRole.PERFORMANCE_ENGINEER,
            task: 'Benchmark query performance',
            canCommunicateWith: ['developer-1', 'security-1'],
          },
        ],
        onMessage: async (agentId, message) => {
          if (message.payload.round) {
            messageLog.push({
              round: message.payload.round as number,
              from: message.from,
              to: message.to,
              action: message.payload.action as string,
              content: message.payload.content as string,
            });
          }
        },
      });

      // Round 1: Initial proposals
      await coordinator.sendMessageToAgent(sessionId, 'developer-1', 'security-1', {
        type: 'request',
        payload: {
          round: 1,
          action: 'propose-optimization',
          content: 'Use parameterized query instead of string interpolation',
        },
      });

      await coordinator.sendMessageToAgent(sessionId, 'security-1', 'developer-1', {
        type: 'response',
        payload: {
          round: 1,
          action: 'security-review',
          content: 'Good! Also add input validation and rate limiting',
        },
      });

      await coordinator.sendMessageToAgent(sessionId, 'performance-1', 'developer-1', {
        type: 'response',
        payload: {
          round: 1,
          action: 'performance-analysis',
          content: 'Need covering index for 99% performance improvement',
        },
      });

      // Round 2: Feedback exchange
      await coordinator.sendMessageToAgent(sessionId, 'developer-1', 'security-1', {
        type: 'request',
        payload: {
          round: 2,
          action: 'address-feedback',
          content: 'Added validation and rate limiting. Is 10 req/min sufficient?',
        },
      });

      await coordinator.sendMessageToAgent(sessionId, 'developer-1', 'performance-1', {
        type: 'request',
        payload: {
          round: 2,
          action: 'ask-index-type',
          content: 'Should I use covering index or regular composite index?',
        },
      });

      await coordinator.sendMessageToAgent(sessionId, 'security-1', 'developer-1', {
        type: 'response',
        payload: {
          round: 2,
          action: 'confirm-rate-limit',
          content: '10 req/min is good. Add audit logging too.',
        },
      });

      await coordinator.sendMessageToAgent(sessionId, 'performance-1', 'developer-1', {
        type: 'response',
        payload: {
          round: 2,
          action: 'recommend-covering-index',
          content: 'Use covering index - 47% faster than composite',
        },
      });

      // Round 3: Final consensus
      await coordinator.sendMessageToAgent(sessionId, 'developer-1', 'security-1', {
        type: 'notification',
        payload: {
          round: 3,
          action: 'final-implementation',
          content: 'Implemented all feedback. Ready for approval.',
        },
      });

      await coordinator.sendMessageToAgent(sessionId, 'developer-1', 'performance-1', {
        type: 'notification',
        payload: {
          round: 3,
          action: 'final-implementation',
          content: 'Implemented covering index. Ready for approval.',
        },
      });

      await coordinator.sendMessageToAgent(sessionId, 'security-1', 'developer-1', {
        type: 'response',
        payload: {
          round: 3,
          action: 'approve',
          content: 'Security approved! Score: 10/10',
        },
      });

      await coordinator.sendMessageToAgent(sessionId, 'performance-1', 'developer-1', {
        type: 'response',
        payload: {
          round: 3,
          action: 'approve',
          content: 'Performance approved! 99.7% improvement achieved',
        },
      });

      // Wait for all messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify message exchange
      expect(messageLog.length).toBeGreaterThanOrEqual(10);

      // Verify round 1 messages
      const round1Messages = messageLog.filter((m) => m.round === 1);
      expect(round1Messages.length).toBeGreaterThanOrEqual(3);

      // Verify round 2 messages
      const round2Messages = messageLog.filter((m) => m.round === 2);
      expect(round2Messages.length).toBeGreaterThanOrEqual(4);

      // Verify round 3 messages
      const round3Messages = messageLog.filter((m) => m.round === 3);
      expect(round3Messages.length).toBeGreaterThanOrEqual(4);

      // Verify cross-agent communication
      const devToSecurity = messageLog.filter(
        (m) => m.from === 'developer-1' && m.to === 'security-1'
      );
      expect(devToSecurity.length).toBeGreaterThanOrEqual(2);

      const devToPerformance = messageLog.filter(
        (m) => m.from === 'developer-1' && m.to === 'performance-1'
      );
      expect(devToPerformance.length).toBeGreaterThanOrEqual(2);

      const securityToDev = messageLog.filter(
        (m) => m.from === 'security-1' && m.to === 'developer-1'
      );
      expect(securityToDev.length).toBeGreaterThanOrEqual(2);

      const performanceToDev = messageLog.filter(
        (m) => m.from === 'performance-1' && m.to === 'developer-1'
      );
      expect(performanceToDev.length).toBeGreaterThanOrEqual(2);

      const status = coordinator.getSessionStatus(sessionId);
      expect(status?.messageCount).toBeGreaterThanOrEqual(10);
    });
  });
});
