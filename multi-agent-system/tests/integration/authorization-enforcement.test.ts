/**
 * Integration Test: Authorization Enforcement
 * Task 16.3: Test security and authorization
 *
 * Tests:
 * - Unauthorized actions are blocked
 * - Denials are logged in audit log
 * - Capability-based permissions work correctly
 * - Role-based access control is enforced
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentRegistry } from '@/multi-agent-system/lib/agent-registry';
import { AgentRole } from '@/multi-agent-system/lib/agent-definition-schema';

describe('Authorization Enforcement Integration Tests', () => {
  let registry: AgentRegistry;

  beforeEach(async () => {
    registry = new AgentRegistry();
    await registry.initialize();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Developer Authorization', () => {
    it('should block developer from modifying schema directly', () => {
      // Arrange: Register developer
      const developerId = 'developer-1';
      registry.registerAgent({
        id: developerId,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code', 'write-tests', 'fix-bugs'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD, AgentRole.DATA_ARCHITECT],
        workload: 0,
      });

      // Act: Attempt to modify schema
      const canModifySchema = registry.canPerformAction(developerId, 'modify-schema');

      // Assert: Action should be blocked
      expect(canModifySchema).toBe(false);

      // Verify denial was logged
      const denials = registry.getUnauthorizedAttempts(developerId);
      expect(denials.length).toBeGreaterThan(0);
      expect(denials[0].action).toBe('modify-schema');
      expect(denials[0].agentId).toBe(developerId);
    });

    it('should block developer from deploying', () => {
      // Arrange
      const developerId = 'developer-1';
      registry.registerAgent({
        id: developerId,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code', 'write-tests'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      const canDeploy = registry.canPerformAction(developerId, 'deploy');

      // Assert
      expect(canDeploy).toBe(false);

      const denials = registry.getUnauthorizedAttempts(developerId);
      expect(denials.some((d) => d.action === 'deploy')).toBe(true);
    });

    it('should allow developer to write code', () => {
      // Arrange
      const developerId = 'developer-1';
      registry.registerAgent({
        id: developerId,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code', 'write-tests', 'fix-bugs'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      const canWriteCode = registry.canPerformAction(developerId, 'write-code');

      // Assert
      expect(canWriteCode).toBe(true);
    });
  });

  describe('QA Engineer Authorization', () => {
    it('should block QA engineer from deploying', () => {
      // Arrange
      const qaId = 'qa-engineer-1';
      registry.registerAgent({
        id: qaId,
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests', 'run-tests', 'report-bugs', 'verify-fixes'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      const canDeploy = registry.canPerformAction(qaId, 'deploy');

      // Assert
      expect(canDeploy).toBe(false);

      const denials = registry.getUnauthorizedAttempts(qaId);
      expect(denials.some((d) => d.action === 'deploy')).toBe(true);
    });

    it('should block QA engineer from writing production code', () => {
      // Arrange
      const qaId = 'qa-engineer-1';
      registry.registerAgent({
        id: qaId,
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests', 'run-tests'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      const canWriteCode = registry.canPerformAction(qaId, 'write-code');

      // Assert
      expect(canWriteCode).toBe(false);

      const denials = registry.getUnauthorizedAttempts(qaId);
      expect(denials.some((d) => d.action === 'write-code')).toBe(true);
    });

    it('should allow QA engineer to write tests', () => {
      // Arrange
      const qaId = 'qa-engineer-1';
      registry.registerAgent({
        id: qaId,
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests', 'run-tests', 'report-bugs'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      const canWriteTests = registry.canPerformAction(qaId, 'write-tests');

      // Assert
      expect(canWriteTests).toBe(true);
    });
  });

  describe('DevOps Authorization', () => {
    it('should block DevOps from writing code', () => {
      // Arrange
      const devopsId = 'devops-1';
      registry.registerAgent({
        id: devopsId,
        role: AgentRole.DEVOPS,
        status: 'idle',
        capabilities: ['deploy', 'manage-infrastructure', 'monitor', 'configure-ci-cd'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      const canWriteCode = registry.canPerformAction(devopsId, 'write-code');

      // Assert
      expect(canWriteCode).toBe(false);

      const denials = registry.getUnauthorizedAttempts(devopsId);
      expect(denials.some((d) => d.action === 'write-code')).toBe(true);
    });

    it('should allow DevOps to deploy', () => {
      // Arrange
      const devopsId = 'devops-1';
      registry.registerAgent({
        id: devopsId,
        role: AgentRole.DEVOPS,
        status: 'idle',
        capabilities: ['deploy', 'manage-infrastructure'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      const canDeploy = registry.canPerformAction(devopsId, 'deploy');

      // Assert
      expect(canDeploy).toBe(true);
    });
  });

  describe('Data Architect Authorization', () => {
    it('should allow data architect to modify schema', () => {
      // Arrange
      const architectId = 'data-architect-1';
      registry.registerAgent({
        id: architectId,
        role: AgentRole.DATA_ARCHITECT,
        status: 'idle',
        capabilities: ['design-schema', 'create-migrations', 'optimize-queries', 'modify-schema'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      const canModifySchema = registry.canPerformAction(architectId, 'modify-schema');

      // Assert
      expect(canModifySchema).toBe(true);
    });

    it('should block data architect from deploying', () => {
      // Arrange
      const architectId = 'data-architect-1';
      registry.registerAgent({
        id: architectId,
        role: AgentRole.DATA_ARCHITECT,
        status: 'idle',
        capabilities: ['design-schema', 'create-migrations'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      const canDeploy = registry.canPerformAction(architectId, 'deploy');

      // Assert
      expect(canDeploy).toBe(false);

      const denials = registry.getUnauthorizedAttempts(architectId);
      expect(denials.some((d) => d.action === 'deploy')).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    it('should log all unauthorized attempts with timestamp', () => {
      // Arrange
      const developerId = 'developer-1';
      registry.registerAgent({
        id: developerId,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act: Attempt multiple unauthorized actions
      registry.canPerformAction(developerId, 'deploy');
      registry.canPerformAction(developerId, 'modify-schema');
      registry.canPerformAction(developerId, 'manage-infrastructure');

      // Assert: All attempts should be logged
      const denials = registry.getUnauthorizedAttempts(developerId);
      expect(denials.length).toBe(3);

      // Verify each denial has required fields
      denials.forEach((denial) => {
        expect(denial.agentId).toBe(developerId);
        expect(denial.action).toBeDefined();
        expect(denial.timestamp).toBeInstanceOf(Date);
        expect(denial.reason).toBeDefined();
      });
    });

    it('should include agent role in denial reason', () => {
      // Arrange
      const qaId = 'qa-engineer-1';
      registry.registerAgent({
        id: qaId,
        role: AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: ['write-tests'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      registry.canPerformAction(qaId, 'deploy');

      // Assert
      const denials = registry.getUnauthorizedAttempts(qaId);
      expect(denials[0].reason).toContain('qa-engineer');
      expect(denials[0].reason).toContain('deploy');
    });

    it('should track denials per agent separately', () => {
      // Arrange
      const dev1Id = 'developer-1';
      const dev2Id = 'developer-2';

      registry.registerAgent({
        id: dev1Id,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      registry.registerAgent({
        id: dev2Id,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      registry.canPerformAction(dev1Id, 'deploy');
      registry.canPerformAction(dev1Id, 'deploy');
      registry.canPerformAction(dev2Id, 'deploy');

      // Assert
      const dev1Denials = registry.getUnauthorizedAttempts(dev1Id);
      const dev2Denials = registry.getUnauthorizedAttempts(dev2Id);

      expect(dev1Denials.length).toBe(2);
      expect(dev2Denials.length).toBe(1);
    });
  });

  describe('Capability-Based Permissions', () => {
    it('should enforce fine-grained capability checks', () => {
      // Arrange: Developer with limited capabilities
      const juniorDevId = 'junior-dev-1';
      registry.registerAgent({
        id: juniorDevId,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'], // No test writing capability
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act
      const canWriteCode = registry.canPerformAction(juniorDevId, 'write-code');
      const canWriteTests = registry.canPerformAction(juniorDevId, 'write-tests');

      // Assert
      expect(canWriteCode).toBe(true);
      expect(canWriteTests).toBe(false);
    });

    it('should allow agents with multiple capabilities', () => {
      // Arrange: Senior developer with many capabilities
      const seniorDevId = 'senior-dev-1';
      registry.registerAgent({
        id: seniorDevId,
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code', 'write-tests', 'fix-bugs', 'review-code', 'refactor'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act & Assert
      expect(registry.canPerformAction(seniorDevId, 'write-code')).toBe(true);
      expect(registry.canPerformAction(seniorDevId, 'write-tests')).toBe(true);
      expect(registry.canPerformAction(seniorDevId, 'fix-bugs')).toBe(true);
      expect(registry.canPerformAction(seniorDevId, 'review-code')).toBe(true);
      expect(registry.canPerformAction(seniorDevId, 'refactor')).toBe(true);
    });
  });

  describe('Cross-Role Authorization', () => {
    it('should verify tech lead can perform coordination actions', () => {
      // Arrange
      const techLeadId = 'tech-lead-1';
      registry.registerAgent({
        id: techLeadId,
        role: AgentRole.TECH_LEAD,
        status: 'idle',
        capabilities: ['assign-tasks', 'review-work', 'make-decisions', 'resolve-conflicts'],
        canRequestHelpFrom: [],
        workload: 0,
      });

      // Act & Assert
      expect(registry.canPerformAction(techLeadId, 'assign-tasks')).toBe(true);
      expect(registry.canPerformAction(techLeadId, 'review-work')).toBe(true);
      expect(registry.canPerformAction(techLeadId, 'make-decisions')).toBe(true);
    });

    it('should verify security engineer has security capabilities', () => {
      // Arrange
      const securityId = 'security-engineer-1';
      registry.registerAgent({
        id: securityId,
        role: AgentRole.SECURITY_ENGINEER,
        status: 'idle',
        capabilities: ['security-audit', 'vulnerability-scan', 'review-security'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      // Act & Assert
      expect(registry.canPerformAction(securityId, 'security-audit')).toBe(true);
      expect(registry.canPerformAction(securityId, 'vulnerability-scan')).toBe(true);
      expect(registry.canPerformAction(securityId, 'write-code')).toBe(false);
    });
  });
});
