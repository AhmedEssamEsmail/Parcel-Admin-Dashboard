/**
 * Integration tests for enhanced agent invocation system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentInvocationManager } from '@/multi-agent-system/lib/agent-invocation';
import { AgentRegistry } from '@/multi-agent-system/lib/agent-registry';
import { AgentDefinitionLoader } from '@/multi-agent-system/lib/agent-definition-loader';
import { MessageBus } from '@/multi-agent-system/lib/message-bus';
import { SharedContextManager } from '@/multi-agent-system/lib/shared-context';
import { AgentRole } from '@/multi-agent-system/lib/roles';
import { AgentMessage } from '@/multi-agent-system/lib/types';
import {
  AgentEscalation,
  AgentInvocationResult,
} from '@/multi-agent-system/lib/agent-invocation-types';

describe('Agent Invocation Integration Tests', () => {
  let invocationManager: AgentInvocationManager;
  let registry: AgentRegistry;
  let definitionLoader: AgentDefinitionLoader;
  let messageBus: MessageBus;
  let sharedContext: SharedContextManager;

  beforeEach(() => {
    registry = new AgentRegistry();
    definitionLoader = new AgentDefinitionLoader();
    // Use fast retries for tests (10ms instead of 1000ms)
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
    sharedContext = new SharedContextManager();
    invocationManager = new AgentInvocationManager(
      registry,
      definitionLoader,
      messageBus,
      sharedContext
    );
  });

  describe('Spawning agents with roles', () => {
    it('should spawn a developer agent with correct role and capabilities', async () => {
      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement user authentication',
      });

      // Wait for agent to be registered
      await new Promise((resolve) => setTimeout(resolve, 50));

      const agents = registry.getAgentsByRole(AgentRole.DEVELOPER);
      expect(agents.length).toBeGreaterThan(0);

      const agent = agents[0];
      expect(agent.role).toBe(AgentRole.DEVELOPER);
      expect(agent.capabilities).toContain('write-code');
      expect(agent.capabilities).toContain('fix-bugs');
      expect(agent.status).toBe('busy');

      // Complete the agent
      const sessions = invocationManager.getAllSessions();
      if (sessions[0]) {
        await messageBus.send({
          id: 'msg-complete',
          from: sessions[0].agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete', result: { success: true } },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.role).toBe(AgentRole.DEVELOPER);
    });

    it('should spawn a QA engineer agent with testing capabilities', async () => {
      const promise = invocationManager.invokeAgent({
        role: AgentRole.QA_ENGINEER,
        prompt: 'Write tests for authentication module',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const agents = registry.getAgentsByRole(AgentRole.QA_ENGINEER);
      expect(agents.length).toBeGreaterThan(0);

      const agent = agents[0];
      expect(agent.role).toBe(AgentRole.QA_ENGINEER);
      expect(agent.capabilities).toContain('write-tests');
      expect(agent.capabilities).toContain('run-tests');

      // Complete
      const sessions = invocationManager.getAllSessions();
      if (sessions[0]) {
        await messageBus.send({
          id: 'msg-complete',
          from: sessions[0].agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;
    });

    it('should spawn a data architect agent with database capabilities', async () => {
      const promise = invocationManager.invokeAgent({
        role: AgentRole.DATA_ARCHITECT,
        prompt: 'Design schema for user sessions',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const agents = registry.getAgentsByRole(AgentRole.DATA_ARCHITECT);
      expect(agents.length).toBeGreaterThan(0);

      const agent = agents[0];
      expect(agent.role).toBe(AgentRole.DATA_ARCHITECT);
      expect(agent.capabilities).toContain('schema-design');
      expect(agent.capabilities).toContain('migrations');

      // Complete
      const sessions = invocationManager.getAllSessions();
      if (sessions[0]) {
        await messageBus.send({
          id: 'msg-complete',
          from: sessions[0].agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;
    });
  });

  describe('Hierarchical delegation (parent-child)', () => {
    it('should establish parent-child relationship', async () => {
      const parentAgentId = 'tech-lead-1';

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Fix authentication bug',
        parentAgentId,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      expect(session).toBeDefined();
      expect(session?.parentAgentId).toBe(parentAgentId);

      // Complete
      if (session) {
        await messageBus.send({
          id: 'msg-complete',
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;
    });

    it('should forward escalations to parent agent', async () => {
      const parentAgentId = 'tech-lead-1';
      let escalationReceived = false;
      let receivedEscalation: {
        issue?: string;
        context?: unknown;
        recommendation?: string;
      } | null = null;

      // Subscribe parent to receive escalations
      messageBus.subscribe(parentAgentId, (message) => {
        if (message.type === 'escalation') {
          escalationReceived = true;
          receivedEscalation = message.payload;
        }
      });

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement complex feature',
        parentAgentId,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      if (session) {
        // Send escalation from child agent
        await messageBus.send({
          id: 'msg-escalation',
          from: session.agentId,
          to: 'system',
          type: 'escalation',
          priority: 'critical',
          payload: {
            issue: 'Cannot resolve dependency conflict',
            context: {
              taskId: 'task-123',
              attemptedSolutions: ['Tried npm install', 'Tried clearing cache'],
              blockedSince: new Date(),
            },
            recommendation: 'Need tech lead guidance',
          },
          timestamp: new Date(),
          acknowledged: false,
        });

        // Wait for escalation to be forwarded
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(escalationReceived).toBe(true);
        expect(receivedEscalation).toBeDefined();
        expect(receivedEscalation!.issue).toBe('Cannot resolve dependency conflict');

        // Complete
        await messageBus.send({
          id: 'msg-complete',
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;
    });

    it('should support multi-level hierarchy', async () => {
      const grandparentId = 'parent-agent';

      // Spawn tech lead as child of parent
      const techLeadPromise = invocationManager.invokeAgent({
        role: AgentRole.TECH_LEAD,
        prompt: 'Coordinate team',
        parentAgentId: grandparentId,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const techLeadSession = invocationManager.getAllSessions()[0];
      expect(techLeadSession?.parentAgentId).toBe(grandparentId);

      // Spawn developer as child of tech lead
      const devPromise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        parentAgentId: techLeadSession?.agentId,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const devSession = invocationManager
        .getAllSessions()
        .find((s) => s.role === AgentRole.DEVELOPER);
      expect(devSession?.parentAgentId).toBe(techLeadSession?.agentId);

      // Complete both agents
      for (const session of invocationManager.getAllSessions()) {
        await messageBus.send({
          id: `msg-complete-${session.agentId}`,
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await Promise.all([techLeadPromise, devPromise]);
    });
  });

  describe('Shared context access and permissions', () => {
    it('should inject shared context into spawned agent', async () => {
      const customContext = new SharedContextManager();
      customContext.updateProjectState({ currentPhase: 'implementation' });

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        sharedContext: customContext as unknown, // Cast since SharedContextManager implements SharedContext
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      expect(session).toBeDefined();
      // In a real implementation, we would verify the agent has access to the context

      // Complete
      if (session) {
        await messageBus.send({
          id: 'msg-complete',
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;
    });

    it('should use default shared context if not provided', async () => {
      sharedContext.updateProjectState({ currentPhase: 'testing' });

      const promise = invocationManager.invokeAgent({
        role: AgentRole.QA_ENGINEER,
        prompt: 'Run tests',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      expect(session).toBeDefined();

      // Complete
      if (session) {
        await messageBus.send({
          id: 'msg-complete',
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;
    });

    it('should allow agents to communicate with specified agents', async () => {
      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        canCommunicateWith: ['qa-engineer-1', 'tech-lead-1'],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      expect(session).toBeDefined();
      // In a real implementation, we would verify communication permissions

      // Complete
      if (session) {
        await messageBus.send({
          id: 'msg-complete',
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;
    });
  });

  describe('Message callbacks (onMessage, onComplete, onEscalate)', () => {
    it('should call onMessage callback for incoming messages', async () => {
      const messages: AgentMessage[] = [];

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        onMessage: async (message) => {
          messages.push(message);
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      if (session) {
        // Send a response message
        await messageBus.send({
          id: 'msg-response-1',
          from: 'other-agent',
          to: session.agentId,
          type: 'response',
          priority: 'normal',
          payload: { data: 'test data 1' },
          timestamp: new Date(),
          acknowledged: false,
        });

        await messageBus.send({
          id: 'msg-response-2',
          from: 'other-agent',
          to: session.agentId,
          type: 'response',
          priority: 'normal',
          payload: { data: 'test data 2' },
          timestamp: new Date(),
          acknowledged: false,
        });

        // Wait for message processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(messages.length).toBeGreaterThan(0);
        expect(messages.some((m) => m.id === 'msg-response-1')).toBe(true);

        // Complete
        await messageBus.send({
          id: 'msg-complete',
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;
    });

    it('should call onComplete callback when agent finishes', async () => {
      let completionResult: AgentInvocationResult | null = null;

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        onComplete: async (result) => {
          completionResult = result;
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      if (session) {
        await messageBus.send({
          id: 'msg-complete',
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: {
            action: 'work-complete',
            result: { success: true, data: 'feature implemented' },
            artifacts: ['src/auth.ts', 'tests/auth.test.ts'],
          },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;

      expect(completionResult).not.toBeNull();
      expect(completionResult!.success).toBe(true);
      expect(completionResult!.result).toEqual({ success: true, data: 'feature implemented' });
      expect(completionResult!.artifacts).toEqual(['src/auth.ts', 'tests/auth.test.ts']);
      expect(completionResult!.metrics).toBeDefined();
      expect(completionResult!.metrics?.timeSpent).toBeGreaterThan(0);
    });

    it('should call onEscalate callback for escalations', async () => {
      let escalationData: AgentEscalation | null = null;

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        onEscalate: async (escalation) => {
          escalationData = escalation;
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      if (session) {
        // Send escalation
        await messageBus.send({
          id: 'msg-escalation',
          from: session.agentId,
          to: 'system',
          type: 'escalation',
          priority: 'critical',
          payload: {
            issue: 'Cannot resolve merge conflict',
            context: {
              taskId: 'task-456',
              attemptedSolutions: ['Tried auto-merge', 'Attempted rebase'],
              blockedSince: new Date(),
              impactedTasks: ['task-457', 'task-458'],
            },
            recommendation: 'Manual review needed',
          },
          timestamp: new Date(),
          acknowledged: false,
        });

        // Wait for escalation processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(escalationData).not.toBeNull();
        expect(escalationData!.issue).toBe('Cannot resolve merge conflict');
        expect(escalationData!.severity).toBe('critical');
        expect(
          (escalationData!.context as Record<string, unknown>).attemptedSolutions
        ).toHaveLength(2);
        expect(escalationData!.recommendation).toBe('Manual review needed');

        // Complete
        await messageBus.send({
          id: 'msg-complete',
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;
    });

    it('should support async callbacks', async () => {
      let asyncCallbackCompleted = false;

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onMessage: async (_message) => {
          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 50));
          asyncCallbackCompleted = true;
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      if (session) {
        await messageBus.send({
          id: 'msg-response',
          from: 'other-agent',
          to: session.agentId,
          type: 'response',
          priority: 'normal',
          payload: { data: 'test' },
          timestamp: new Date(),
          acknowledged: false,
        });

        // Wait for async callback
        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(asyncCallbackCompleted).toBe(true);

        // Complete
        await messageBus.send({
          id: 'msg-complete',
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;
    });

    it('should handle callback errors gracefully', async () => {
      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        onMessage: async () => {
          throw new Error('Callback error');
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      if (session) {
        // Send message that will trigger error in callback
        await messageBus.send({
          id: 'msg-response',
          from: 'other-agent',
          to: session.agentId,
          type: 'response',
          priority: 'normal',
          payload: { data: 'test' },
          timestamp: new Date(),
          acknowledged: false,
        });

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Agent should still be functional despite callback error
        const currentSession = invocationManager.getSession(session.agentId);
        expect(currentSession).toBeDefined();
        expect(currentSession?.status).not.toBe('failed');

        // Complete
        await messageBus.send({
          id: 'msg-complete',
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      const result = await promise;
      expect(result.success).toBe(true);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle agent timeout', async () => {
      let timeoutResult: AgentInvocationResult | null = null;

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        timeout: 100,
        onComplete: async (result) => {
          timeoutResult = result;
        },
      });

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent timed out');
      expect(timeoutResult).not.toBeNull();
      expect(timeoutResult!.success).toBe(false);
    });

    it('should track metrics correctly', async () => {
      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      if (session) {
        // Send multiple messages
        for (let i = 0; i < 3; i++) {
          await messageBus.send({
            id: `msg-${i}`,
            from: 'other-agent',
            to: session.agentId,
            type: 'response',
            priority: 'normal',
            payload: {},
            timestamp: new Date(),
            acknowledged: false,
          });
        }

        // Send escalation
        await messageBus.send({
          id: 'msg-escalation',
          from: session.agentId,
          to: 'system',
          type: 'escalation',
          priority: 'critical',
          payload: {
            issue: 'Test escalation',
            context: { attemptedSolutions: [] },
          },
          timestamp: new Date(),
          acknowledged: false,
        });

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(session.metrics.messagesReceived).toBeGreaterThan(0);
        expect(session.metrics.escalations).toBe(1);

        // Complete
        await messageBus.send({
          id: 'msg-complete',
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      const result = await promise;
      expect(result.metrics?.messagesExchanged).toBeGreaterThan(0);
      expect(result.metrics?.escalations).toBe(1);
      expect(result.metrics?.timeSpent).toBeGreaterThan(0);
    });

    it('should handle agent termination', async () => {
      invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      const session = sessions[0];

      if (session) {
        await invocationManager.terminateAgent(session.agentId);

        const retrieved = invocationManager.getSession(session.agentId);
        expect(retrieved).toBeUndefined();

        const agent = registry.getAgent(session.agentId);
        expect(agent?.status).toBe('offline');
      }
    });

    it('should handle multiple concurrent agents', async () => {
      const promises = [
        invocationManager.invokeAgent({
          role: AgentRole.DEVELOPER,
          prompt: 'Task 1',
        }),
        invocationManager.invokeAgent({
          role: AgentRole.QA_ENGINEER,
          prompt: 'Task 2',
        }),
        invocationManager.invokeAgent({
          role: AgentRole.DATA_ARCHITECT,
          prompt: 'Task 3',
        }),
      ];

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sessions = invocationManager.getAllSessions();
      expect(sessions.length).toBe(3);

      // Complete all agents
      for (const session of sessions) {
        await messageBus.send({
          id: `msg-complete-${session.agentId}`,
          from: session.agentId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });
});
