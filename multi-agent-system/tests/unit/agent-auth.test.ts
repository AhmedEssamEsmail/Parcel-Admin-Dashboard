/**
 * Unit tests for Agent Authentication and Authorization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentAuth, PERMISSION_MATRIX } from '@/multi-agent-system/lib/agent-auth';
import { AgentRole } from '@/multi-agent-system/lib/agent-definition-schema';
import type { Agent } from '@/multi-agent-system/lib/agent-registry';

describe('AgentAuth', () => {
  let agentAuth: AgentAuth;

  beforeEach(() => {
    agentAuth = new AgentAuth();
    agentAuth.setSilentMode(true); // Suppress console warnings during tests
    agentAuth.clearDenials();
  });

  describe('Token Generation', () => {
    it('should generate a valid JWT token for an agent', () => {
      const agent: Agent = {
        id: 'agent-1',
        role: AgentRole.DEVELOPER,
        capabilities: ['write-code', 'fix-bugs'],
        status: 'idle',
        currentTask: undefined,
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      const token = agentAuth.generateToken(agent);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should include agent information in token payload', () => {
      const agent: Agent = {
        id: 'agent-2',
        role: AgentRole.QA_ENGINEER,
        capabilities: ['write-tests', 'run-tests'],
        status: 'idle',
        currentTask: undefined,
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      const token = agentAuth.generateToken(agent);
      const payload = agentAuth.validateToken(token);

      expect(payload).toBeDefined();
      expect(payload?.agentId).toBe('agent-2');
      expect(payload?.role).toBe(AgentRole.QA_ENGINEER);
      expect(payload?.capabilities).toEqual(['write-tests', 'run-tests']);
    });

    it('should set token expiration to 24 hours', () => {
      const agent: Agent = {
        id: 'agent-3',
        role: AgentRole.TECH_LEAD,
        capabilities: ['assign-tasks'],
        status: 'idle',
        currentTask: undefined,
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      const token = agentAuth.generateToken(agent);
      const payload = agentAuth.validateToken(token);

      expect(payload).toBeDefined();
      expect(payload?.exp).toBeDefined();
      expect(payload?.iat).toBeDefined();

      const expirationTime = payload!.exp - payload!.iat;
      expect(expirationTime).toBe(24 * 3600); // 24 hours in seconds
    });
  });

  describe('Token Validation', () => {
    it('should validate a valid token', () => {
      const agent: Agent = {
        id: 'agent-4',
        role: AgentRole.DEVOPS,
        capabilities: ['deploy'],
        status: 'idle',
        currentTask: undefined,
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      const token = agentAuth.generateToken(agent);
      const payload = agentAuth.validateToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.agentId).toBe('agent-4');
    });

    it('should reject token with invalid signature', () => {
      const agent: Agent = {
        id: 'agent-5',
        role: AgentRole.DEVELOPER,
        capabilities: ['write-code'],
        status: 'idle',
        currentTask: undefined,
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      const token = agentAuth.generateToken(agent);
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;

      const payload = agentAuth.validateToken(tamperedToken);
      expect(payload).toBeNull();
    });

    it('should reject malformed token', () => {
      const payload = agentAuth.validateToken('not.a.valid.token.format');
      expect(payload).toBeNull();
    });

    it('should reject token with invalid format', () => {
      const payload = agentAuth.validateToken('invalid-token');
      expect(payload).toBeNull();
    });
  });

  describe('Authorization', () => {
    it('should authorize tech lead to assign tasks', () => {
      const authorized = agentAuth.isAuthorized('tech-lead-1', AgentRole.TECH_LEAD, 'assign-tasks');
      expect(authorized).toBe(true);
    });

    it('should authorize developer to write code', () => {
      const authorized = agentAuth.isAuthorized('dev-1', AgentRole.DEVELOPER, 'write-code');
      expect(authorized).toBe(true);
    });

    it('should deny developer from assigning tasks', () => {
      const authorized = agentAuth.isAuthorized('dev-1', AgentRole.DEVELOPER, 'assign-tasks');
      expect(authorized).toBe(false);
    });

    it('should deny QA engineer from deploying', () => {
      const authorized = agentAuth.isAuthorized('qa-1', AgentRole.QA_ENGINEER, 'deploy');
      expect(authorized).toBe(false);
    });

    it('should authorize DevOps to deploy', () => {
      const authorized = agentAuth.isAuthorized('devops-1', AgentRole.DEVOPS, 'deploy');
      expect(authorized).toBe(true);
    });

    it('should authorize security engineer to perform security audit', () => {
      const authorized = agentAuth.isAuthorized(
        'sec-1',
        AgentRole.SECURITY_ENGINEER,
        'security-audit'
      );
      expect(authorized).toBe(true);
    });

    it('should deny developer from performing security audit', () => {
      const authorized = agentAuth.isAuthorized('dev-1', AgentRole.DEVELOPER, 'security-audit');
      expect(authorized).toBe(false);
    });
  });

  describe('Token-based Authorization', () => {
    it('should authorize action with valid token', () => {
      const agent: Agent = {
        id: 'agent-6',
        role: AgentRole.TECH_LEAD,
        capabilities: ['assign-tasks'],
        status: 'idle',
        currentTask: undefined,
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      const token = agentAuth.generateToken(agent);
      const authorized = agentAuth.isTokenAuthorized(token, 'assign-tasks');

      expect(authorized).toBe(true);
    });

    it('should deny action with invalid token', () => {
      const authorized = agentAuth.isTokenAuthorized('invalid-token', 'assign-tasks');
      expect(authorized).toBe(false);
    });

    it('should deny unauthorized action with valid token', () => {
      const agent: Agent = {
        id: 'agent-7',
        role: AgentRole.DEVELOPER,
        capabilities: ['write-code'],
        status: 'idle',
        currentTask: undefined,
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      const token = agentAuth.generateToken(agent);
      const authorized = agentAuth.isTokenAuthorized(token, 'deploy');

      expect(authorized).toBe(false);
    });
  });

  describe('Permission Matrix', () => {
    it('should have permissions defined for all roles', () => {
      const roles = Object.values(AgentRole);
      for (const role of roles) {
        expect(PERMISSION_MATRIX[role]).toBeDefined();
        expect(Array.isArray(PERMISSION_MATRIX[role])).toBe(true);
        expect(PERMISSION_MATRIX[role].length).toBeGreaterThan(0);
      }
    });

    it('should return correct permissions for tech lead', () => {
      const permissions = agentAuth.getRolePermissions(AgentRole.TECH_LEAD);
      expect(permissions).toContain('assign-tasks');
      expect(permissions).toContain('approve-work');
      expect(permissions).toContain('resolve-conflicts');
      expect(permissions).toContain('override-quality-gates');
    });

    it('should return correct permissions for developer', () => {
      const permissions = agentAuth.getRolePermissions(AgentRole.DEVELOPER);
      expect(permissions).toContain('write-code');
      expect(permissions).toContain('fix-bugs');
      expect(permissions).toContain('implement-features');
      expect(permissions).not.toContain('deploy');
    });

    it('should check if role has specific permission', () => {
      expect(agentAuth.roleHasPermission(AgentRole.DEVOPS, 'deploy')).toBe(true);
      expect(agentAuth.roleHasPermission(AgentRole.DEVELOPER, 'deploy')).toBe(false);
    });
  });

  describe('Authorization Denials', () => {
    it('should log authorization denial', () => {
      agentAuth.isAuthorized('dev-1', AgentRole.DEVELOPER, 'deploy');

      const denials = agentAuth.getDenials();
      expect(denials.length).toBe(1);
      expect(denials[0].agentId).toBe('dev-1');
      expect(denials[0].role).toBe(AgentRole.DEVELOPER);
      expect(denials[0].action).toBe('deploy');
    });

    it('should retrieve denials for specific agent', () => {
      agentAuth.isAuthorized('dev-1', AgentRole.DEVELOPER, 'deploy');
      agentAuth.isAuthorized('dev-2', AgentRole.DEVELOPER, 'assign-tasks');

      const denials = agentAuth.getDenials('dev-1');
      expect(denials.length).toBe(1);
      expect(denials[0].agentId).toBe('dev-1');
    });

    it('should not log denial for authorized action', () => {
      agentAuth.isAuthorized('dev-1', AgentRole.DEVELOPER, 'write-code');

      const denials = agentAuth.getDenials();
      expect(denials.length).toBe(0);
    });

    it('should clear denials', () => {
      agentAuth.isAuthorized('dev-1', AgentRole.DEVELOPER, 'deploy');
      expect(agentAuth.getDenials().length).toBe(1);

      agentAuth.clearDenials();
      expect(agentAuth.getDenials().length).toBe(0);
    });

    it('should limit denials to 1000 entries', () => {
      // Generate 1100 denials
      for (let i = 0; i < 1100; i++) {
        agentAuth.isAuthorized(`dev-${i}`, AgentRole.DEVELOPER, 'deploy');
      }

      const denials = agentAuth.getDenials();
      expect(denials.length).toBe(1000);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh a valid token', () => {
      const agent: Agent = {
        id: 'agent-8',
        role: AgentRole.DEVELOPER,
        capabilities: ['write-code'],
        status: 'idle',
        currentTask: undefined,
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      const token = agentAuth.generateToken(agent);
      const refreshedToken = agentAuth.refreshToken(token);

      expect(refreshedToken).not.toBeNull();
      expect(refreshedToken).not.toBe(token);

      const payload = agentAuth.validateToken(refreshedToken!);
      expect(payload?.agentId).toBe('agent-8');
    });

    it('should not refresh invalid token', () => {
      const refreshedToken = agentAuth.refreshToken('invalid-token');
      expect(refreshedToken).toBeNull();
    });
  });

  describe('Token Expiration', () => {
    it('should get token expiration time', () => {
      const agent: Agent = {
        id: 'agent-9',
        role: AgentRole.DEVELOPER,
        capabilities: ['write-code'],
        status: 'idle',
        currentTask: undefined,
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      const token = agentAuth.generateToken(agent);
      const expiration = agentAuth.getTokenExpiration(token);

      expect(expiration).not.toBeNull();
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid token expiration', () => {
      const expiration = agentAuth.getTokenExpiration('invalid-token');
      expect(expiration).toBeNull();
    });

    it('should check if token is expired', () => {
      const agent: Agent = {
        id: 'agent-10',
        role: AgentRole.DEVELOPER,
        capabilities: ['write-code'],
        status: 'idle',
        currentTask: undefined,
        canRequestHelpFrom: [],
        workload: 0,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      const token = agentAuth.generateToken(agent);
      const isExpired = agentAuth.isTokenExpired(token);

      expect(isExpired).toBe(false);
    });

    it('should return true for invalid token', () => {
      const isExpired = agentAuth.isTokenExpired('invalid-token');
      expect(isExpired).toBe(true);
    });
  });
});
