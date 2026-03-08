/**
 * Integration Test: Agent Registration and Lifecycle
 * Tests agent lifecycle management, status updates, and capability checks
 * Requirements: US-2.1, US-2.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentRegistry } from '@/multi-agent-system/lib/agent-registry';
import { MessageBus } from '@/multi-agent-system/lib/message-bus';
import { AgentRole } from '@/multi-agent-system/lib/agent-definition-schema';
import type { AgentMessage } from '@/multi-agent-system/lib/types';

describe('Integration: Agent Registration and Lifecycle', () => {
  let registry: AgentRegistry;
  let messageBus: MessageBus;

  beforeEach(async () => {
    registry = new AgentRegistry();
    await registry.initialize();
    // Use fast retries for tests (10ms instead of 1000ms)
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
  });

  afterEach(() => {
    registry.clear();
    messageBus.clear();
  });

  describe('Multi-agent registration', () => {
    it('should register multiple agents with different roles', () => {
      // Arrange & Act
      const agents = [
        {
          id: 'tech-lead-1',
          role: AgentRole.TECH_LEAD,
          status: 'idle' as const,
          capabilities: ['assign-tasks', 'review-code'],
          canRequestHelpFrom: [],
          workload: 0,
        },
        {
          id: 'dev-1',
          role: AgentRole.DEVELOPER,
          status: 'idle' as const,
          capabilities: ['write-code', 'write-tests'],
          canRequestHelpFrom: [AgentRole.TECH_LEAD],
          workload: 0,
        },
        {
          id: 'qa-1',
          role: AgentRole.QA_ENGINEER,
          status: 'idle' as const,
          capabilities: ['write-tests', 'run-tests'],
          canRequestHelpFrom: [AgentRole.TECH_LEAD],
          workload: 0,
        },
      ];

      for (const agent of agents) {
        registry.registerAgent(agent);
      }

      // Assert
      expect(registry.getAllAgents()).toHaveLength(3);

      for (const agent of agents) {
        const registered = registry.getAgent(agent.id);
        expect(registered).toBeDefined();
        expect(registered?.role).toBe(agent.role);
      }
    });

    it('should query agents by role', () => {
      // Arrange
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      registry.registerAgent({
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      // Act
      const developers = registry.getAgentsByRole(AgentRole.DEVELOPER);
      const qaEngineers = registry.getAgentsByRole(AgentRole.QA_ENGINEER);

      // Assert
      expect(developers).toHaveLength(2);
      expect(qaEngineers).toHaveLength(1);
    });

    it('should query agents by status', () => {
      // Arrange
      registry.registerAgent({
        id: 'agent-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      registry.registerAgent({
        id: 'agent-2',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      // Act
      const idleAgents = registry.getAgentsByStatus('idle');
      const busyAgents = registry.getAgentsByStatus('busy');

      // Assert
      expect(idleAgents).toHaveLength(1);
      expect(busyAgents).toHaveLength(1);
    });
  });

  describe('Agent status lifecycle', () => {
    it('should update agent status through lifecycle states', () => {
      // Arrange
      const agentId = 'lifecycle-agent';
      registry.registerAgent({
        id: agentId,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      // Act & Assert: Transition through states
      registry.updateStatus(agentId, 'busy', 'implementing feature');
      let agent = registry.getAgent(agentId);
      expect(agent?.status).toBe('busy');
      expect(agent?.currentTask).toBe('implementing feature');

      registry.updateStatus(agentId, 'idle');
      agent = registry.getAgent(agentId);
      expect(agent?.status).toBe('idle');
      expect(agent?.currentTask).toBeUndefined();
    });

    it('should update agent workload', () => {
      // Arrange
      const agentId = 'workload-agent';
      registry.registerAgent({
        id: agentId,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      // Act
      registry.updateWorkload(agentId, 5);

      // Assert
      const agent = registry.getAgent(agentId);
      expect(agent?.workload).toBe(5);
    });
  });

  describe('Capability checks', () => {
    it('should verify agent capabilities for task assignment', () => {
      // Arrange
      registry.registerAgent({
        id: 'full-stack-dev',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code', 'write-tests', 'review-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      registry.registerAgent({
        id: 'junior-dev',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      // Act & Assert
      expect(registry.canPerformAction('full-stack-dev', 'write-code')).toBe(true);
      expect(registry.canPerformAction('full-stack-dev', 'review-code')).toBe(true);
      expect(registry.canPerformAction('full-stack-dev', 'deploy')).toBe(false);

      expect(registry.canPerformAction('junior-dev', 'write-code')).toBe(true);
      expect(registry.canPerformAction('junior-dev', 'review-code')).toBe(false);
    });

    it('should check if agent can request help from specific role', () => {
      // Arrange
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: [],
        canRequestHelpFrom: [AgentRole.TECH_LEAD, AgentRole.QA_ENGINEER],
        workload: 0,
      });

      // Act & Assert
      expect(registry.canRequestHelpFrom('dev-1', AgentRole.TECH_LEAD)).toBe(true);
      expect(registry.canRequestHelpFrom('dev-1', AgentRole.QA_ENGINEER)).toBe(true);
      expect(registry.canRequestHelpFrom('dev-1', AgentRole.DEVOPS)).toBe(false);
    });
  });

  describe('Agent coordination workflow', () => {
    it('should coordinate task assignment based on capabilities and status', async () => {
      // Arrange
      const techLeadId = 'tech-lead-1';
      const devId = 'dev-1';
      const qaId = 'qa-1';

      registry.registerAgent({
        id: techLeadId,
        role: AgentRole.TECH_LEAD,
        status: 'idle',
        capabilities: ['assign-tasks'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      registry.registerAgent({
        id: devId,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      registry.registerAgent({
        id: qaId,
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      const messages: AgentMessage[] = [];

      messageBus.subscribe(devId, async (msg) => {
        messages.push(msg);
        if (msg.payload.action === 'implement-feature') {
          registry.updateStatus(
            devId,
            'busy',
            (msg.payload as Record<string, unknown>).feature as string
          );
        }
      });

      messageBus.subscribe(qaId, async (msg) => {
        messages.push(msg);
      });

      // Act: Find idle developer and assign task
      const idleDevs = registry.getIdleAgentsByRole(AgentRole.DEVELOPER);
      expect(idleDevs).toHaveLength(1);

      const devTask: AgentMessage = {
        id: 'task-1',
        from: techLeadId,
        to: devId,
        type: 'request',
        payload: { action: 'implement-feature', feature: 'user-auth' },
        timestamp: new Date(),
        priority: 'normal',
        acknowledged: false,
      };

      await messageBus.send(devTask);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert: Developer is now busy
      const dev = registry.getAgent(devId);
      expect(dev?.status).toBe('busy');
      expect(dev?.currentTask).toBe('user-auth');

      // No more idle developers
      const stillIdleDevs = registry.getIdleAgentsByRole(AgentRole.DEVELOPER);
      expect(stillIdleDevs).toHaveLength(0);

      // Messages were delivered
      expect(messages).toHaveLength(1);
    });

    it('should find least busy agent for task assignment', () => {
      // Arrange
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 5,
      });

      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 2,
      });

      registry.registerAgent({
        id: 'dev-3',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 8,
      });

      // Act
      const leastBusy = registry.getLeastBusyAgent(AgentRole.DEVELOPER);

      // Assert
      expect(leastBusy?.id).toBe('dev-2');
      expect(leastBusy?.workload).toBe(2);
    });
  });

  describe('Agent deregistration', () => {
    it('should unregister agent', () => {
      // Arrange
      const agentId = 'temp-agent';
      registry.registerAgent({
        id: agentId,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      expect(registry.getAgent(agentId)).toBeDefined();

      // Act
      const result = registry.unregisterAgent(agentId);

      // Assert
      expect(result).toBe(true);
      expect(registry.getAgent(agentId)).toBeUndefined();
    });
  });

  describe('Registry statistics', () => {
    it('should provide registry statistics', () => {
      // Arrange
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      registry.registerAgent({
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: [],
        canRequestHelpFrom: [],
        workload: 0,
      });

      // Act
      const stats = registry.getStats();

      // Assert
      expect(stats.totalAgents).toBe(3);
      expect(stats.byRole[AgentRole.DEVELOPER]).toBe(2);
      expect(stats.byRole[AgentRole.QA_ENGINEER]).toBe(1);
      expect(stats.byStatus.idle).toBe(2);
      expect(stats.byStatus.busy).toBe(1);
    });
  });
});
