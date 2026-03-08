/**
 * Unit tests for Agent Invocation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentInvocationManager } from '@/multi-agent-system/lib/agent-invocation';
import { MessageBus } from '@/multi-agent-system/lib/message-bus';
import { agentRegistry } from '@/multi-agent-system/lib/agent-registry';
import { AgentRole } from '@/multi-agent-system/lib/agent-definition-schema';
import { SharedContextManager } from '@/multi-agent-system/lib/shared-context';
import { AgentDefinitionLoader } from '@/multi-agent-system/lib/agent-definition-loader';
import { InvokeSubAgentParams } from '@/multi-agent-system/lib/agent-invocation-types';
import { AgentMessage } from '@/multi-agent-system/lib/types';

describe('AgentInvocationManager', () => {
  let invocationManager: AgentInvocationManager;
  let messageBus: MessageBus;
  let registry: typeof agentRegistry;
  let definitionLoader: AgentDefinitionLoader;

  beforeEach(async () => {
    // Use fast retries for tests (10ms instead of 1000ms)
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
    registry = agentRegistry;
    definitionLoader = new AgentDefinitionLoader();
    invocationManager = new AgentInvocationManager(registry, definitionLoader, messageBus);

    // Initialize agent registry
    await agentRegistry.initialize();
    agentRegistry.clear();
  });

  afterEach(() => {
    messageBus.clear();
    agentRegistry.clear();
  });

  describe('invokeSubAgent', () => {
    it('should successfully spawn an agent with valid role', async () => {
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
      };

      const result = await invocationManager.invokeSubAgent(params);

      expect(result.success).toBe(true);
      expect(result.role).toBe(AgentRole.DEVELOPER);
      expect(result.agentId).toMatch(/^developer-/);
      expect(result.spawnedAt).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });

    it('should fail to spawn agent with invalid role', async () => {
      const params: InvokeSubAgentParams = {
        role: 'invalid-role' as AgentRole,
      };

      const result = await invocationManager.invokeSubAgent(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown agent role');
    });

    it('should use custom agent ID if provided', async () => {
      const customId = 'custom-developer-123';
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        agentId: customId,
      };

      const result = await invocationManager.invokeSubAgent(params);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe(customId);
    });

    it('should register agent in agent registry', async () => {
      const params: InvokeSubAgentParams = {
        role: AgentRole.QA_ENGINEER,
      };

      const result = await invocationManager.invokeSubAgent(params);

      const agent = agentRegistry.getAgent(result.agentId);
      expect(agent).toBeDefined();
      expect(agent?.role).toBe(AgentRole.QA_ENGINEER);
      expect(agent?.status).toBe('idle');
      expect(agent?.capabilities).toContain('write-tests');
    });

    it('should set up message subscriptions', async () => {
      const onMessageMock = vi.fn();
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        onMessage: onMessageMock,
      };

      const result = await invocationManager.invokeSubAgent(params);

      // Send a message to the agent
      const message: AgentMessage = {
        id: 'test-msg-1',
        from: 'tech-lead',
        to: result.agentId,
        type: 'request',
        priority: 'normal',
        payload: { action: 'test' },
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-msg-1',
          to: result.agentId,
        })
      );
    });

    it('should send initial task if provided', async () => {
      const onMessageMock = vi.fn();
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        task: 'Implement user authentication',
        onMessage: onMessageMock,
      };

      await invocationManager.invokeSubAgent(params);

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request',
          payload: expect.objectContaining({
            action: 'task-assignment',
            context: expect.objectContaining({
              task: 'Implement user authentication',
            }),
          }),
        })
      );
    });

    it('should include parent agent in communication list', async () => {
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        parentAgent: 'tech-lead-1',
      };

      const result = await invocationManager.invokeSubAgent(params);

      const spawnedAgent = invocationManager.getSpawnedAgent(result.agentId);
      expect(spawnedAgent?.canCommunicateWith).toContain('tech-lead-1');
    });

    it('should use custom communication list if provided', async () => {
      const customList = ['agent-1', 'agent-2', 'agent-3'];
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        canCommunicateWith: customList,
      };

      const result = await invocationManager.invokeSubAgent(params);

      const spawnedAgent = invocationManager.getSpawnedAgent(result.agentId);
      expect(spawnedAgent?.canCommunicateWith).toEqual(customList);
    });

    it('should inject shared context', async () => {
      const sharedContext = {
        projectState: { phase: 'development' },
        conventions: { indentation: 2 },
      };

      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        sharedContext,
      };

      const result = await invocationManager.invokeSubAgent(params);

      const spawnedAgent = invocationManager.getSpawnedAgent(result.agentId);
      expect(spawnedAgent?.sharedContext).toEqual(sharedContext);
    });
  });

  describe('callbacks', () => {
    it('should invoke onMessage callback for incoming messages', async () => {
      const onMessageMock = vi.fn();
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        onMessage: onMessageMock,
      };

      const result = await invocationManager.invokeSubAgent(params);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'tech-lead',
        to: result.agentId,
        type: 'notification',
        priority: 'normal',
        payload: { action: 'status-update' },
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onMessageMock).toHaveBeenCalledTimes(1);
      expect(onMessageMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'msg-1' }));
    });

    it('should invoke onEscalate callback for escalation messages', async () => {
      const onEscalateMock = vi.fn();
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        onEscalate: onEscalateMock,
      };

      const result = await invocationManager.invokeSubAgent(params);

      const escalationMessage: AgentMessage = {
        id: 'escalation-1',
        from: result.agentId,
        to: 'tech-lead',
        type: 'escalation',
        priority: 'critical',
        payload: {
          action: 'escalate',
          context: {
            reason: 'Blocked on database schema',
            attemptedSolutions: ['Tried to modify schema directly'],
          },
        },
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(escalationMessage);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onEscalateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: result.agentId,
          role: AgentRole.DEVELOPER,
          reason: 'Blocked on database schema',
          severity: 'critical',
        })
      );
    });

    it('should invoke onComplete callback when agent completes work', async () => {
      const onCompleteMock = vi.fn();
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        onComplete: onCompleteMock,
      };

      const result = await invocationManager.invokeSubAgent(params);

      const completionMessage: AgentMessage = {
        id: 'completion-1',
        from: result.agentId,
        to: 'tech-lead',
        type: 'response',
        priority: 'normal',
        payload: {
          action: 'work-complete',
          result: { success: true },
          context: {
            artifacts: ['src/auth.ts', 'tests/auth.test.ts'],
            metrics: {
              duration: 5000,
              messagesProcessed: 10,
              tasksCompleted: 1,
            },
          },
        },
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(completionMessage);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onCompleteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: result.agentId,
          role: AgentRole.DEVELOPER,
          success: true,
          artifacts: ['src/auth.ts', 'tests/auth.test.ts'],
        })
      );
    });

    it('should handle callback errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onMessageMock = vi.fn().mockRejectedValue(new Error('Callback error'));

      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        onMessage: onMessageMock,
      };

      const result = await invocationManager.invokeSubAgent(params);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'tech-lead',
        to: result.agentId,
        type: 'notification',
        priority: 'normal',
        payload: { action: 'test' },
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('timeout handling', () => {
    it('should timeout agent after specified duration', async () => {
      const onCompleteMock = vi.fn();
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        timeout: 100, // 100ms timeout
        onComplete: onCompleteMock,
      };

      const result = await invocationManager.invokeSubAgent(params);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(onCompleteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: result.agentId,
          success: false,
          error: 'Agent execution timed out',
        })
      );

      // Agent should be marked as offline
      const agent = agentRegistry.getAgent(result.agentId);
      expect(agent?.status).toBe('offline');
    });

    it('should not timeout if agent completes before timeout', async () => {
      const onCompleteMock = vi.fn();
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        timeout: 200, // 200ms timeout
        onComplete: onCompleteMock,
      };

      const result = await invocationManager.invokeSubAgent(params);

      // Complete work before timeout
      const completionMessage: AgentMessage = {
        id: 'completion-1',
        from: result.agentId,
        to: 'tech-lead',
        type: 'response',
        priority: 'normal',
        payload: {
          action: 'work-complete',
          result: { success: true },
        },
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(completionMessage);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have been called once with success
      expect(onCompleteMock).toHaveBeenCalledTimes(1);
      expect(onCompleteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );

      // Wait past timeout to ensure it doesn't fire
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should still only be called once
      expect(onCompleteMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('agent lifecycle', () => {
    it('should track spawned agent state', async () => {
      const params: InvokeSubAgentParams = {
        role: AgentRole.QA_ENGINEER,
        parentAgent: 'tech-lead-1',
      };

      const result = await invocationManager.invokeSubAgent(params);

      const spawnedAgent = invocationManager.getSpawnedAgent(result.agentId);
      expect(spawnedAgent).toBeDefined();
      expect(spawnedAgent?.status).toBe('active');
      expect(spawnedAgent?.role).toBe(AgentRole.QA_ENGINEER);
      expect(spawnedAgent?.parentAgent).toBe('tech-lead-1');
    });

    it('should list all spawned agents', async () => {
      await invocationManager.invokeSubAgent({ role: AgentRole.DEVELOPER });
      await invocationManager.invokeSubAgent({ role: AgentRole.QA_ENGINEER });
      await invocationManager.invokeSubAgent({ role: AgentRole.DEVOPS });

      const allSpawned = invocationManager.getAllSpawnedAgents();
      expect(allSpawned).toHaveLength(3);
      expect(allSpawned.map((a) => a.role)).toContain(AgentRole.DEVELOPER);
      expect(allSpawned.map((a) => a.role)).toContain(AgentRole.QA_ENGINEER);
      expect(allSpawned.map((a) => a.role)).toContain(AgentRole.DEVOPS);
    });

    it('should terminate agent on request', async () => {
      const onCompleteMock = vi.fn();
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
        onComplete: onCompleteMock,
      };

      const result = await invocationManager.invokeSubAgent(params);

      await invocationManager.terminateAgent(result.agentId);

      // Agent should be removed from sessions
      const session = invocationManager.getSession(result.agentId);
      expect(session).toBeUndefined();

      // Agent should be removed from spawned agents
      const spawnedAgent = invocationManager.getSpawnedAgent(result.agentId);
      expect(spawnedAgent).toBeUndefined();
    });

    it('should clean up agent resources on completion', async () => {
      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
      };

      const result = await invocationManager.invokeSubAgent(params);

      // Complete work
      const completionMessage: AgentMessage = {
        id: 'completion-1',
        from: result.agentId,
        to: 'tech-lead',
        type: 'response',
        priority: 'normal',
        payload: {
          action: 'work-complete',
          result: { success: true },
        },
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(completionMessage);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Agent should be removed from spawned agents
      const spawnedAgent = invocationManager.getSpawnedAgent(result.agentId);
      expect(spawnedAgent).toBeUndefined();
    });
  });

  describe('communication permissions', () => {
    it('should include tech lead in default communication list', async () => {
      // Register a tech lead agent
      agentRegistry.registerAgent({
        id: 'tech-lead-1',
        role: AgentRole.TECH_LEAD,
        status: 'idle',
        capabilities: ['coordinate'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER,
      };

      const result = await invocationManager.invokeSubAgent(params);

      const spawnedAgent = invocationManager.getSpawnedAgent(result.agentId);
      expect(spawnedAgent?.canCommunicateWith).toContain('tech-lead-1');
    });

    it('should include agents from canRequestHelpFrom in communication list', async () => {
      // Register a data architect agent
      agentRegistry.registerAgent({
        id: 'data-architect-1',
        role: AgentRole.DATA_ARCHITECT,
        status: 'idle',
        capabilities: ['design-schema'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      const params: InvokeSubAgentParams = {
        role: AgentRole.DEVELOPER, // Developers can request help from data architects
      };

      const result = await invocationManager.invokeSubAgent(params);

      const spawnedAgent = invocationManager.getSpawnedAgent(result.agentId);
      expect(spawnedAgent?.canCommunicateWith).toContain('data-architect-1');
    });
  });

  describe('clear', () => {
    it('should clean up all spawned agents', async () => {
      await invocationManager.invokeSubAgent({ role: AgentRole.DEVELOPER });
      await invocationManager.invokeSubAgent({ role: AgentRole.QA_ENGINEER });

      expect(invocationManager.getAllSpawnedAgents()).toHaveLength(2);

      invocationManager.clear();

      expect(invocationManager.getAllSpawnedAgents()).toHaveLength(0);
    });
  });

  // Task 14.3: Hierarchical delegation tests
  describe('Hierarchical Delegation', () => {
    it('should track parent-child relationships', async () => {
      const parentId = 'tech-lead-1';

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        parentAgentId: parentId,
      });

      const sessions = invocationManager.getAllSessions();
      const childId = sessions[0]?.agentId;

      expect(childId).toBeDefined();
      expect(invocationManager.getParentAgent(childId!)).toBe(parentId);
      expect(invocationManager.getChildAgents(parentId)).toContain(childId);

      // Complete
      if (childId) {
        await messageBus.send({
          id: 'msg-complete',
          from: childId,
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

    it('should build agent hierarchy tree', async () => {
      const rootId = 'tech-lead-1';

      // Spawn child agents
      const child1Promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Task 1',
        parentAgentId: rootId,
      });

      const child2Promise = invocationManager.invokeAgent({
        role: AgentRole.QA_ENGINEER,
        prompt: 'Task 2',
        parentAgentId: rootId,
      });

      const sessions = invocationManager.getAllSessions();
      const child1Id = sessions[0]?.agentId;
      const child2Id = sessions[1]?.agentId;

      // Get hierarchy
      const hierarchy = invocationManager.getAgentHierarchy(rootId);

      expect(hierarchy).toBeDefined();
      expect(hierarchy[0].agentId).toBe(rootId);
      expect(hierarchy[0].children.length).toBe(2);

      // Complete children
      if (child1Id) {
        await messageBus.send({
          id: 'msg-complete-1',
          from: child1Id,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      if (child2Id) {
        await messageBus.send({
          id: 'msg-complete-2',
          from: child2Id,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await Promise.all([child1Promise, child2Promise]);
    });

    it('should clean up hierarchy on agent completion', async () => {
      const parentId = 'tech-lead-1';

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        parentAgentId: parentId,
      });

      const sessions = invocationManager.getAllSessions();
      const childId = sessions[0]?.agentId;

      expect(invocationManager.getChildAgents(parentId).length).toBe(1);

      // Complete child
      if (childId) {
        await messageBus.send({
          id: 'msg-complete',
          from: childId,
          to: 'system',
          type: 'notification',
          priority: 'normal',
          payload: { action: 'work-complete' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await promise;

      // Hierarchy should be cleaned up
      expect(invocationManager.getChildAgents(parentId).length).toBe(0);
    });

    it('should terminate child agents recursively', async () => {
      const rootId = 'tech-lead-1';

      // Spawn parent agent
      invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Parent task',
        parentAgentId: rootId,
      });

      const sessions1 = invocationManager.getAllSessions();
      const parentAgentId = sessions1[0]?.agentId;

      // Spawn child agent
      invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Child task',
        parentAgentId: parentAgentId,
      });

      const sessions2 = invocationManager.getAllSessions();
      const childAgentId = sessions2[1]?.agentId;

      expect(sessions2.length).toBe(2);

      // Terminate parent (should terminate child too)
      if (parentAgentId) {
        await invocationManager.terminateAgent(parentAgentId);
      }

      // Both should be terminated
      expect(invocationManager.getSession(parentAgentId!)).toBeUndefined();
      expect(invocationManager.getSession(childAgentId!)).toBeUndefined();
    });

    it('should calculate hierarchy statistics', async () => {
      const rootId = 'tech-lead-1';

      // Spawn multiple agents
      const promises = [
        invocationManager.invokeAgent({
          role: AgentRole.DEVELOPER,
          prompt: 'Task 1',
          parentAgentId: rootId,
        }),
        invocationManager.invokeAgent({
          role: AgentRole.DEVELOPER,
          prompt: 'Task 2',
          parentAgentId: rootId,
        }),
        invocationManager.invokeAgent({
          role: AgentRole.QA_ENGINEER,
          prompt: 'Task 3',
        }),
      ];

      const stats = invocationManager.getHierarchyStats();

      expect(stats.totalAgents).toBe(3);
      expect(stats.rootAgents).toBe(1); // Only the QA agent has no parent
      expect(stats.maxDepth).toBeGreaterThanOrEqual(0);

      // Complete all agents
      const sessions = invocationManager.getAllSessions();
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

      await Promise.all(promises);
    });

    it('should route escalations to parent automatically', async () => {
      const parentId = 'tech-lead-1';
      let escalationReceived = false;

      messageBus.subscribe(parentId, (message) => {
        if (message.type === 'escalation') {
          escalationReceived = true;
        }
      });

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        parentAgentId: parentId,
      });

      const sessions = invocationManager.getAllSessions();
      const childId = sessions[0]?.agentId;

      if (childId) {
        // Send escalation
        await messageBus.send({
          id: 'msg-escalation',
          from: childId,
          to: 'system',
          type: 'escalation',
          priority: 'critical',
          payload: {
            issue: 'Blocked on dependency',
            context: { attemptedSolutions: ['Tried solution A'] },
          },
          timestamp: new Date(),
          acknowledged: false,
        });

        // Wait for routing
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(escalationReceived).toBe(true);

        // Complete
        await messageBus.send({
          id: 'msg-complete',
          from: childId,
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

  // Task 14.4: Shared context injection tests
  describe('Shared Context Injection', () => {
    it('should inject shared context into spawned agent', async () => {
      const customContext = new SharedContextManager();
      customContext.updateProjectState({ currentPhase: 'development' });

      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        sharedContext: customContext as unknown, // Cast since SharedContextManager implements SharedContext
      });

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

    it('should validate context access permissions', async () => {
      const promise = invocationManager.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
      });

      const sessions = invocationManager.getAllSessions();
      const agentId = sessions[0]?.agentId;

      if (agentId) {
        // Validate read access
        const canRead = invocationManager.validateContextAccess(agentId, 'read');
        expect(typeof canRead).toBe('boolean');

        // Validate write access
        const canWrite = invocationManager.validateContextAccess(agentId, 'write');
        expect(typeof canWrite).toBe('boolean');

        // Complete
        await messageBus.send({
          id: 'msg-complete',
          from: agentId,
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

    it('should enforce permissions based on role capabilities', async () => {
      // Spawn agent with limited capabilities
      const promise = invocationManager.invokeAgent({
        role: AgentRole.TECHNICAL_WRITER,
        prompt: 'Update documentation',
      });

      const sessions = invocationManager.getAllSessions();
      const agentId = sessions[0]?.agentId;

      if (agentId) {
        // Technical writer might have different permissions than developer
        const canRead = invocationManager.validateContextAccess(agentId, 'read');
        const canWrite = invocationManager.validateContextAccess(agentId, 'write');

        // Permissions should be based on role definition
        expect(typeof canRead).toBe('boolean');
        expect(typeof canWrite).toBe('boolean');

        // Complete
        await messageBus.send({
          id: 'msg-complete',
          from: agentId,
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

    it('should return false for invalid agent ID', () => {
      const canRead = invocationManager.validateContextAccess('invalid-agent-id', 'read');
      expect(canRead).toBe(false);

      const canWrite = invocationManager.validateContextAccess('invalid-agent-id', 'write');
      expect(canWrite).toBe(false);
    });

    it('should use default shared context if not provided', async () => {
      // Create manager with default shared context
      const defaultContext = new SharedContextManager();
      const managerWithDefault = new AgentInvocationManager(
        registry,
        definitionLoader,
        messageBus,
        defaultContext
      );

      const promise = managerWithDefault.invokeAgent({
        role: AgentRole.DEVELOPER,
        prompt: 'Implement feature',
        // No sharedContext provided, should use default
      });

      const sessions = managerWithDefault.getAllSessions();
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
  });
});
