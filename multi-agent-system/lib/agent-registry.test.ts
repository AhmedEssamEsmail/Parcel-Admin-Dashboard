import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from './agent-registry';
import { AgentRole } from './agent-definition-schema';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(async () => {
    registry = new AgentRegistry();
    await registry.initialize();
    registry.clear();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newRegistry = new AgentRegistry();
      await expect(newRegistry.initialize()).resolves.not.toThrow();
    });

    it('should throw error if not initialized', () => {
      const newRegistry = new AgentRegistry();
      expect(() => newRegistry.getAgent('test')).toThrow('AgentRegistry not initialized');
    });

    it('should allow multiple initialize calls', async () => {
      await registry.initialize();
      await expect(registry.initialize()).resolves.not.toThrow();
    });
  });

  describe('registerAgent', () => {
    it('should register a new agent', () => {
      const agent = registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code', 'fix-bugs'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      expect(agent.id).toBe('dev-1');
      expect(agent.role).toBe(AgentRole.DEVELOPER);
      expect(agent.status).toBe('idle');
      expect(agent.createdAt).toBeInstanceOf(Date);
      expect(agent.lastActivity).toBeInstanceOf(Date);
    });

    it('should throw error for duplicate agent ID', () => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      expect(() =>
        registry.registerAgent({
          id: 'dev-1',
          role: AgentRole.DEVELOPER,
          status: 'idle',
          capabilities: ['write-code'],
          canRequestHelpFrom: [],
          workload: 0,
        })
      ).toThrow('Agent with id dev-1 already registered');
    });

    it('should throw error for unknown role', () => {
      expect(() =>
        registry.registerAgent({
          id: 'unknown-1',
          role: 'unknown-role' as AgentRole,
          status: 'idle',
          capabilities: [],
          canRequestHelpFrom: [],
          workload: 0,
        })
      ).toThrow('Unknown agent role');
    });
  });

  describe('getAgent', () => {
    it('should return agent by ID', () => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      const agent = registry.getAgent('dev-1');
      expect(agent).toBeDefined();
      expect(agent?.id).toBe('dev-1');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = registry.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('getAgentsByRole', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 1,
      });
      registry.registerAgent({
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests'],
        canRequestHelpFrom: [],
        workload: 0,
      });
    });

    it('should return all agents with specific role', () => {
      const developers = registry.getAgentsByRole(AgentRole.DEVELOPER);
      expect(developers).toHaveLength(2);
      expect(developers.every((a) => a.role === AgentRole.DEVELOPER)).toBe(true);
    });

    it('should return empty array for role with no agents', () => {
      const devops = registry.getAgentsByRole(AgentRole.DEVOPS);
      expect(devops).toHaveLength(0);
    });
  });

  describe('getDefinition', () => {
    it('should return agent definition for valid role', () => {
      const definition = registry.getDefinition(AgentRole.DEVELOPER);
      expect(definition).toBeDefined();
      expect(definition?.role).toBe(AgentRole.DEVELOPER);
      expect(definition?.capabilities).toContain('write-code');
    });

    it('should return definition for all roles', () => {
      for (const role of Object.values(AgentRole)) {
        const definition = registry.getDefinition(role);
        expect(definition).toBeDefined();
        expect(definition?.role).toBe(role);
      }
    });
  });

  describe('updateStatus', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
    });

    it('should update agent status', () => {
      registry.updateStatus('dev-1', 'busy', 'task-123');
      const agent = registry.getAgent('dev-1');
      expect(agent?.status).toBe('busy');
      expect(agent?.currentTask).toBe('task-123');
    });

    it('should update lastActivity timestamp', async () => {
      const agent = registry.getAgent('dev-1');
      const oldTimestamp = agent?.lastActivity;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      registry.updateStatus('dev-1', 'busy');
      const updatedAgent = registry.getAgent('dev-1');
      expect(updatedAgent?.lastActivity.getTime()).toBeGreaterThan(oldTimestamp?.getTime() || 0);
    });

    it('should clear currentTask when status becomes idle', () => {
      registry.updateStatus('dev-1', 'busy', 'task-123');
      registry.updateStatus('dev-1', 'idle');

      const agent = registry.getAgent('dev-1');
      expect(agent?.status).toBe('idle');
      expect(agent?.currentTask).toBeUndefined();
      expect(agent?.workload).toBe(0);
    });

    it('should throw error for non-existent agent', () => {
      expect(() => registry.updateStatus('non-existent', 'busy')).toThrow(
        'Agent non-existent not found'
      );
    });
  });

  describe('updateWorkload', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
    });

    it('should update agent workload', () => {
      registry.updateWorkload('dev-1', 5);
      const agent = registry.getAgent('dev-1');
      expect(agent?.workload).toBe(5);
    });

    it('should throw error for non-existent agent', () => {
      expect(() => registry.updateWorkload('non-existent', 5)).toThrow(
        'Agent non-existent not found'
      );
    });
  });

  describe('canPerformAction', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code', 'fix-bugs', 'write-unit-tests'],
        canRequestHelpFrom: [],
        workload: 0,
      });
    });

    it('should return true for allowed action', () => {
      expect(registry.canPerformAction('dev-1', 'write-code')).toBe(true);
      expect(registry.canPerformAction('dev-1', 'fix-bugs')).toBe(true);
    });

    it('should return false for disallowed action', () => {
      expect(registry.canPerformAction('dev-1', 'deploy')).toBe(false);
      expect(registry.canPerformAction('dev-1', 'create-migration')).toBe(false);
    });

    it('should return false for non-existent agent', () => {
      expect(registry.canPerformAction('non-existent', 'write-code')).toBe(false);
    });

    it('should log unauthorized attempts', () => {
      registry.canPerformAction('dev-1', 'deploy');
      const attempts = registry.getUnauthorizedAttempts('dev-1');
      expect(attempts.length).toBeGreaterThan(0);
      expect(attempts[0].action).toBe('deploy');
    });
  });

  describe('canRequestHelpFrom', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD, AgentRole.DATA_ARCHITECT],
        workload: 0,
      });
    });

    it('should return true for allowed help request', () => {
      expect(registry.canRequestHelpFrom('dev-1', AgentRole.TECH_LEAD)).toBe(true);
      expect(registry.canRequestHelpFrom('dev-1', AgentRole.DATA_ARCHITECT)).toBe(true);
    });

    it('should return false for disallowed help request', () => {
      expect(registry.canRequestHelpFrom('dev-1', AgentRole.QA_ENGINEER)).toBe(false);
    });

    it('should return false for non-existent agent', () => {
      expect(registry.canRequestHelpFrom('non-existent', AgentRole.TECH_LEAD)).toBe(false);
    });
  });

  describe('getUnauthorizedAttempts', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
    });

    it('should return all unauthorized attempts', () => {
      registry.canPerformAction('dev-1', 'deploy');
      registry.canPerformAction('dev-2', 'create-migration');

      const attempts = registry.getUnauthorizedAttempts();
      expect(attempts.length).toBe(2);
    });

    it('should return unauthorized attempts for specific agent', () => {
      registry.canPerformAction('dev-1', 'deploy');
      registry.canPerformAction('dev-2', 'create-migration');

      const dev1Attempts = registry.getUnauthorizedAttempts('dev-1');
      expect(dev1Attempts.length).toBe(1);
      expect(dev1Attempts[0].agentId).toBe('dev-1');
    });
  });

  describe('unregisterAgent', () => {
    it('should remove agent from registry', () => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      expect(registry.unregisterAgent('dev-1')).toBe(true);
      expect(registry.getAgent('dev-1')).toBeUndefined();
    });

    it('should return false for non-existent agent', () => {
      expect(registry.unregisterAgent('non-existent')).toBe(false);
    });
  });

  describe('getAgentsByStatus', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 1,
      });
      registry.registerAgent({
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests'],
        canRequestHelpFrom: [],
        workload: 0,
      });
    });

    it('should return agents with specific status', () => {
      const idleAgents = registry.getAgentsByStatus('idle');
      expect(idleAgents).toHaveLength(2);
      expect(idleAgents.every((a) => a.status === 'idle')).toBe(true);
    });

    it('should return empty array for status with no agents', () => {
      const blockedAgents = registry.getAgentsByStatus('blocked');
      expect(blockedAgents).toHaveLength(0);
    });
  });

  describe('getIdleAgentsByRole', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 1,
      });
      registry.registerAgent({
        id: 'dev-3',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
    });

    it('should return only idle agents with specific role', () => {
      const idleDevelopers = registry.getIdleAgentsByRole(AgentRole.DEVELOPER);
      expect(idleDevelopers).toHaveLength(2);
      expect(
        idleDevelopers.every((a) => a.role === AgentRole.DEVELOPER && a.status === 'idle')
      ).toBe(true);
    });
  });

  describe('getLeastBusyAgent', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 5,
      });
      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 2,
      });
      registry.registerAgent({
        id: 'dev-3',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
    });

    it('should return agent with lowest workload', () => {
      const leastBusy = registry.getLeastBusyAgent(AgentRole.DEVELOPER);
      expect(leastBusy?.id).toBe('dev-3');
      expect(leastBusy?.workload).toBe(0);
    });

    it('should exclude offline agents', () => {
      registry.updateStatus('dev-3', 'offline');
      const leastBusy = registry.getLeastBusyAgent(AgentRole.DEVELOPER);
      expect(leastBusy?.id).toBe('dev-2');
      expect(leastBusy?.workload).toBe(2);
    });

    it('should return undefined for role with no agents', () => {
      const leastBusy = registry.getLeastBusyAgent(AgentRole.DEVOPS);
      expect(leastBusy).toBeUndefined();
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
      registry.registerAgent({
        id: 'dev-2',
        role: AgentRole.DEVELOPER,
        status: 'busy',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 1,
      });
      registry.registerAgent({
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests'],
        canRequestHelpFrom: [],
        workload: 0,
      });
    });

    it('should return correct statistics', () => {
      const stats = registry.getStats();
      expect(stats.totalAgents).toBe(3);
      expect(stats.byRole[AgentRole.DEVELOPER]).toBe(2);
      expect(stats.byRole[AgentRole.QA_ENGINEER]).toBe(1);
      expect(stats.byStatus.idle).toBe(2);
      expect(stats.byStatus.busy).toBe(1);
    });
  });

  describe('getAllAgents', () => {
    it('should return all registered agents', () => {
      registry.registerAgent({
        id: 'dev-1',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [],
        workload: 0,
      });
      registry.registerAgent({
        id: 'qa-1',
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      const allAgents = registry.getAllAgents();
      expect(allAgents).toHaveLength(2);
    });

    it('should return empty array when no agents registered', () => {
      const allAgents = registry.getAllAgents();
      expect(allAgents).toHaveLength(0);
    });
  });
});
