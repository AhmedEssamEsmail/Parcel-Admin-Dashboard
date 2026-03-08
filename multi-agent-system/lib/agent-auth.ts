/**
 * Agent Authentication and Authorization
 *
 * Implements JWT-based authentication for agents and role-based authorization.
 * Each agent receives a JWT token on spawn containing their identity, role, and capabilities.
 */

import crypto from 'crypto';
import { AgentRole } from './agent-definition-schema';
import type { Agent } from './agent-registry';

/**
 * JWT token payload for agent authentication
 */
export interface AgentTokenPayload {
  agentId: string;
  role: AgentRole;
  capabilities: string[];
  iat: number; // Issued at (Unix timestamp)
  exp: number; // Expiration (Unix timestamp)
}

/**
 * Permission matrix defining which actions each role can perform
 */
export const PERMISSION_MATRIX: Record<AgentRole, string[]> = {
  [AgentRole.TECH_LEAD]: [
    'assign-tasks',
    'approve-work',
    'resolve-conflicts',
    'make-decisions',
    'override-quality-gates',
    'reassign-tasks',
    'escalate-to-parent',
    'read-all-context',
    'write-all-context',
  ],
  [AgentRole.DEVELOPER]: [
    'write-code',
    'fix-bugs',
    'implement-features',
    'write-unit-tests',
    'request-help',
    'read-assigned-context',
    'write-assigned-context',
  ],
  [AgentRole.QA_ENGINEER]: [
    'write-tests',
    'run-tests',
    'report-bugs',
    'verify-fixes',
    'request-help',
    'read-test-context',
    'write-test-results',
  ],
  [AgentRole.DEVOPS]: [
    'manage-ci-cd',
    'deploy',
    'manage-infrastructure',
    'request-help',
    'read-infra-context',
    'write-infra-context',
  ],
  [AgentRole.DATA_ARCHITECT]: [
    'design-schema',
    'create-migrations',
    'optimize-queries',
    'request-help',
    'read-db-context',
    'write-db-context',
  ],
  [AgentRole.UX_UI_DESIGNER]: [
    'design-ui',
    'ensure-accessibility',
    'create-design-system',
    'request-help',
    'read-design-context',
    'write-design-context',
  ],
  [AgentRole.SECURITY_ENGINEER]: [
    'security-audit',
    'vulnerability-scan',
    'review-code-security',
    'request-help',
    'read-all-context',
    'write-security-context',
  ],
  [AgentRole.TECHNICAL_WRITER]: [
    'write-documentation',
    'create-api-docs',
    'request-help',
    'read-doc-context',
    'write-doc-context',
  ],
  [AgentRole.PERFORMANCE_ENGINEER]: [
    'performance-test',
    'profile-performance',
    'optimize-code',
    'request-help',
    'read-perf-context',
    'write-perf-context',
  ],
};

/**
 * Authorization denial log entry
 */
export interface AuthorizationDenial {
  agentId: string;
  role: AgentRole;
  action: string;
  timestamp: Date;
  reason: string;
}

/**
 * Agent Authentication System
 *
 * Manages JWT token generation, validation, and role-based authorization.
 */
export class AgentAuth {
  private readonly TOKEN_EXPIRATION_HOURS = 24;
  private readonly SECRET_KEY = this.generateSecretKey();
  private denials: AuthorizationDenial[] = [];
  private silentMode = false;

  /**
   * Enable or disable silent mode (suppresses console warnings)
   * Useful for testing to reduce noise
   */
  setSilentMode(silent: boolean): void {
    this.silentMode = silent;
  }

  /**
   * Generate a secret key for JWT signing
   * In production, this should be loaded from environment variables
   */
  private generateSecretKey(): string {
    // For now, use a static key. In production, use process.env.JWT_SECRET
    return 'multi-agent-orchestration-secret-key-' + Date.now();
  }

  /**
   * Generate a JWT token for an agent
   */
  generateToken(agent: Agent): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.TOKEN_EXPIRATION_HOURS * 3600;

    const payload: AgentTokenPayload = {
      agentId: agent.id,
      role: agent.role,
      capabilities: agent.capabilities,
      iat: now,
      exp,
    };

    // Simple JWT implementation (header.payload.signature)
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Validate a JWT token and return the payload
   */
  validateToken(token: string): AgentTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [encodedHeader, encodedPayload, signature] = parts;

      // Verify signature
      const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);
      if (signature !== expectedSignature) {
        return null;
      }

      // Decode payload
      const payload = JSON.parse(this.base64UrlDecode(encodedPayload)) as AgentTokenPayload;

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Check if an agent is authorized to perform an action
   */
  isAuthorized(agentId: string, role: AgentRole, action: string): boolean {
    const allowedActions = PERMISSION_MATRIX[role] || [];
    const authorized = allowedActions.includes(action);

    if (!authorized) {
      this.logDenial(agentId, role, action, `Role ${role} not authorized for action: ${action}`);
    }

    return authorized;
  }

  /**
   * Check if an agent token is authorized to perform an action
   */
  isTokenAuthorized(token: string, action: string): boolean {
    const payload = this.validateToken(token);
    if (!payload) {
      return false;
    }

    return this.isAuthorized(payload.agentId, payload.role, action);
  }

  /**
   * Get all permissions for a role
   */
  getRolePermissions(role: AgentRole): string[] {
    return PERMISSION_MATRIX[role] || [];
  }

  /**
   * Check if a role has a specific permission
   */
  roleHasPermission(role: AgentRole, action: string): boolean {
    const permissions = this.getRolePermissions(role);
    return permissions.includes(action);
  }

  /**
   * Log an authorization denial
   */
  private logDenial(agentId: string, role: AgentRole, action: string, reason: string): void {
    const denial: AuthorizationDenial = {
      agentId,
      role,
      action,
      timestamp: new Date(),
      reason,
    };

    this.denials.push(denial);

    // Log to console for visibility (unless in silent mode)
    if (!this.silentMode) {
      console.warn(
        `[AgentAuth] Authorization denied: Agent ${agentId} (${role}) attempted ${action}. Reason: ${reason}`
      );
    }

    // Keep only last 1000 denials to prevent memory issues
    if (this.denials.length > 1000) {
      this.denials = this.denials.slice(-1000);
    }
  }

  /**
   * Get authorization denials (for auditing)
   */
  getDenials(agentId?: string): AuthorizationDenial[] {
    if (agentId) {
      return this.denials.filter((denial) => denial.agentId === agentId);
    }
    return [...this.denials];
  }

  /**
   * Clear all denials (for testing)
   */
  clearDenials(): void {
    this.denials = [];
  }

  /**
   * Base64 URL encode
   */
  private base64UrlEncode(str: string): string {
    const base64 = Buffer.from(str).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Base64 URL decode
   */
  private base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf-8');
  }

  /**
   * Sign a message using HMAC-SHA256
   */
  private sign(message: string): string {
    const hmac = crypto.createHmac('sha256', this.SECRET_KEY);
    hmac.update(message);
    const signature = hmac.digest('base64');
    return signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Refresh a token (generate new token with updated expiration)
   */
  refreshToken(token: string): string | null {
    const payload = this.validateToken(token);
    if (!payload) {
      return null;
    }

    // Create new token with same agent info but new expiration
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.TOKEN_EXPIRATION_HOURS * 3600;

    const newPayload: AgentTokenPayload = {
      ...payload,
      iat: now,
      exp,
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(newPayload));
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    const payload = this.validateToken(token);
    if (!payload) {
      return null;
    }
    return new Date(payload.exp * 1000);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const payload = this.validateToken(token);
    if (!payload) {
      return true;
    }
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }
}

// Export singleton instance
export const agentAuth = new AgentAuth();
