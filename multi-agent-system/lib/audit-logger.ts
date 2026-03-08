/**
 * Audit Logger - Stub Implementation
 *
 * This is a minimal stub implementation to resolve import errors.
 * Full implementation is pending (see Task 15.3 in multi-agent-orchestration spec).
 */

import type { AgentRole } from './agent-definition-schema';
import type { AgentMessage } from './types';
import type { AuthorizationDenial } from './agent-auth';

/**
 * Audit event types
 */
export enum AuditEventType {
  // Agent lifecycle
  AGENT_SPAWNED = 'agent_spawned',
  AGENT_TERMINATED = 'agent_terminated',

  // Messages
  MESSAGE_SENT = 'message_sent',
  MESSAGE_RECEIVED = 'message_received',
  MESSAGE_FAILED = 'message_failed',

  // File operations
  FILE_CREATED = 'file_created',
  FILE_MODIFIED = 'file_modified',
  FILE_DELETED = 'file_deleted',
  FILE_READ = 'file_read',

  // Authentication
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  TOKEN_GENERATED = 'token_generated',
  TOKEN_REFRESHED = 'token_refreshed',

  // Authorization
  PERMISSION_DENIED = 'permission_denied',

  // Quality gates
  QUALITY_GATE_PASSED = 'quality_gate_passed',
  QUALITY_GATE_FAILED = 'quality_gate_failed',

  // Escalations
  ESCALATION_CREATED = 'escalation_created',
  ESCALATION_RESOLVED = 'escalation_resolved',

  // Conflicts
  CONFLICT_DETECTED = 'conflict_detected',
  CONFLICT_RESOLVED = 'conflict_resolved',

  // Generic
  ACTION_PERFORMED = 'action_performed',
}

/**
 * Audit severity levels
 */
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  agentId: string;
  role: AgentRole;
  agentRole: AgentRole; // Alias for role (for test compatibility)
  action: string;
  details: Record<string, unknown>;
}

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  enableConsoleOutput?: boolean;
  redactPII?: boolean;
  maxEntries?: number;
}

/**
 * Audit Logger - Stub Implementation
 *
 * TODO: Implement full audit logging functionality
 */
export class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private config: Required<AuditLoggerConfig>;
  private logIdCounter = 0;

  constructor(config: AuditLoggerConfig = {}) {
    this.config = {
      enableConsoleOutput: config.enableConsoleOutput ?? true,
      redactPII: config.redactPII ?? true,
      maxEntries: config.maxEntries ?? 10000,
    };
  }

  /**
   * Log a generic audit event
   */
  log(
    eventType: AuditEventType,
    severity: AuditSeverity,
    agentId: string,
    role: AgentRole,
    action: string,
    details: Record<string, unknown> = {}
  ): void {
    const entry: AuditLogEntry = {
      id: `log-${++this.logIdCounter}`,
      timestamp: new Date(),
      eventType,
      severity,
      agentId,
      role,
      agentRole: role, // Set both for compatibility
      action,
      details: this.config.redactPII ? this.redactPII(details) : details,
    };

    this.logs.push(entry);

    // Enforce max entries
    if (this.logs.length > this.config.maxEntries) {
      this.logs.shift();
    }

    if (this.config.enableConsoleOutput) {
      console.log(`[AUDIT] ${eventType}: ${agentId} - ${action}`);
    }
  }

  /**
   * Log agent spawned
   */
  logAgentSpawned(agentId: string, role: AgentRole, capabilities: string[]): void {
    this.log(AuditEventType.AGENT_SPAWNED, AuditSeverity.INFO, agentId, role, 'spawn', {
      capabilities,
    });
  }

  /**
   * Log agent terminated
   */
  logAgentTerminated(agentId: string, role: AgentRole, reason: string): void {
    this.log(AuditEventType.AGENT_TERMINATED, AuditSeverity.INFO, agentId, role, 'terminate', {
      reason,
    });
  }

  /**
   * Log message sent
   */
  logMessageSent(message: AgentMessage, role: AgentRole): void {
    this.log(AuditEventType.MESSAGE_SENT, AuditSeverity.INFO, message.from, role, 'send-message', {
      messageId: message.id,
      to: message.to,
      type: message.type,
      priority: message.priority,
    });
  }

  /**
   * Log message received
   */
  logMessageReceived(message: AgentMessage, role: AgentRole): void {
    this.log(
      AuditEventType.MESSAGE_RECEIVED,
      AuditSeverity.INFO,
      message.to,
      role,
      'receive-message',
      {
        messageId: message.id,
        from: message.from,
        type: message.type,
      }
    );
  }

  /**
   * Log message failed
   */
  logMessageFailed(message: AgentMessage, role: AgentRole, error: string): void {
    this.log(
      AuditEventType.MESSAGE_FAILED,
      AuditSeverity.ERROR,
      message.from,
      role,
      'message-failed',
      {
        messageId: message.id,
        to: message.to,
        error,
        retryCount: message.retryCount,
      }
    );
  }

  /**
   * Log file operation
   */
  logFileOperation(
    agentId: string,
    role: AgentRole,
    operation: 'create' | 'modify' | 'delete' | 'read',
    filePath: string,
    success: boolean,
    error?: string
  ): void {
    const eventTypeMap = {
      create: AuditEventType.FILE_CREATED,
      modify: AuditEventType.FILE_MODIFIED,
      delete: AuditEventType.FILE_DELETED,
      read: AuditEventType.FILE_READ,
    };

    this.log(
      eventTypeMap[operation],
      success ? AuditSeverity.INFO : AuditSeverity.ERROR,
      agentId,
      role,
      `file-${operation}`,
      {
        filePath,
        success,
        ...(error && { error }),
      }
    );
  }

  /**
   * Log authentication
   */
  logAuthentication(agentId: string, role: AgentRole, success: boolean, reason?: string): void {
    this.log(
      success ? AuditEventType.AUTHENTICATION_SUCCESS : AuditEventType.AUTHENTICATION_FAILURE,
      success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      agentId,
      role,
      'authenticate',
      {
        success,
        ...(reason && { reason }),
      }
    );
  }

  /**
   * Log token generated
   */
  logTokenGenerated(agentId: string, role: AgentRole, expiresAt: Date): void {
    this.log(AuditEventType.TOKEN_GENERATED, AuditSeverity.INFO, agentId, role, 'generate-token', {
      expiresAt: expiresAt.toISOString(),
    });
  }

  /**
   * Log token refreshed
   */
  logTokenRefreshed(agentId: string, role: AgentRole, newExpiresAt: Date): void {
    this.log(AuditEventType.TOKEN_REFRESHED, AuditSeverity.INFO, agentId, role, 'refresh-token', {
      newExpiresAt: newExpiresAt.toISOString(),
    });
  }

  /**
   * Log permission denied
   */
  logPermissionDenied(denial: AuthorizationDenial): void {
    this.log(
      AuditEventType.PERMISSION_DENIED,
      AuditSeverity.WARNING,
      denial.agentId,
      denial.role,
      denial.action,
      {
        reason: denial.reason,
      }
    );
  }

  /**
   * Log quality gate
   */
  logQualityGate(
    agentId: string,
    role: AgentRole,
    gateName: string,
    passed: boolean,
    details: Record<string, unknown> = {}
  ): void {
    this.log(
      passed ? AuditEventType.QUALITY_GATE_PASSED : AuditEventType.QUALITY_GATE_FAILED,
      passed ? AuditSeverity.INFO : AuditSeverity.WARNING,
      agentId,
      role,
      `quality-gate-${gateName}`,
      {
        gateName,
        passed,
        ...details,
      }
    );
  }

  /**
   * Log escalation
   */
  logEscalation(
    agentId: string,
    role: AgentRole,
    status: 'created' | 'resolved',
    details: Record<string, unknown> = {}
  ): void {
    this.log(
      status === 'created' ? AuditEventType.ESCALATION_CREATED : AuditEventType.ESCALATION_RESOLVED,
      status === 'created' ? AuditSeverity.WARNING : AuditSeverity.INFO,
      agentId,
      role,
      `escalation-${status}`,
      details
    );
  }

  /**
   * Log conflict
   */
  logConflict(
    agentId: string,
    role: AgentRole,
    status: 'detected' | 'resolved',
    details: Record<string, unknown> = {}
  ): void {
    this.log(
      status === 'detected' ? AuditEventType.CONFLICT_DETECTED : AuditEventType.CONFLICT_RESOLVED,
      status === 'detected' ? AuditSeverity.WARNING : AuditSeverity.INFO,
      agentId,
      role,
      `conflict-${status}`,
      details
    );
  }

  /**
   * Get all logs
   */
  getAllLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.logIdCounter = 0;
  }

  /**
   * Redact PII from data
   */
  private redactPII(data: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      // Redact sensitive field names
      if (['password', 'apiKey', 'token', 'secret', 'credential'].includes(key)) {
        redacted[key] = '[REDACTED]';
        continue;
      }

      // Redact nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        redacted[key] = this.redactPII(value as Record<string, unknown>);
        continue;
      }

      // Redact strings with PII patterns
      if (typeof value === 'string') {
        let redactedValue = value;

        // Email
        redactedValue = redactedValue.replace(
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          '[EMAIL_REDACTED]'
        );

        // Phone numbers (various formats)
        redactedValue = redactedValue.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');

        // SSN
        redactedValue = redactedValue.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');

        // Credit card (simple pattern)
        redactedValue = redactedValue.replace(
          /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
          '[CC_REDACTED]'
        );

        redacted[key] = redactedValue;
        continue;
      }

      // Keep other values as-is
      redacted[key] = value;
    }

    return redacted;
  }

  /**
   * Query logs with filters
   */
  query(filters: {
    agentId?: string;
    agentRole?: AgentRole;
    eventType?: AuditEventType;
    severity?: AuditSeverity;
  }): AuditLogEntry[] {
    return this.logs.filter((log) => {
      if (filters.agentId && log.agentId !== filters.agentId) return false;
      if (filters.agentRole && log.role !== filters.agentRole) return false;
      if (filters.eventType && log.eventType !== filters.eventType) return false;
      if (filters.severity && log.severity !== filters.severity) return false;
      return true;
    });
  }

  /**
   * Get logs by agent ID
   */
  getLogsByAgent(agentId: string): AuditLogEntry[] {
    return this.logs.filter((log) => log.agentId === agentId);
  }

  /**
   * Get logs by event type
   */
  getLogsByEventType(eventType: AuditEventType): AuditLogEntry[] {
    return this.logs.filter((log) => log.eventType === eventType);
  }

  /**
   * Get logs by severity
   */
  getLogsBySeverity(severity: AuditSeverity): AuditLogEntry[] {
    return this.logs.filter((log) => log.severity === severity);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(count: number): AuditLogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get log statistics
   */
  getStatistics(): {
    totalLogs: number;
    byEventType: Record<string, number>;
    bySeverity: Record<string, number>;
    byAgent: Record<string, number>;
  } {
    const stats = {
      totalLogs: this.logs.length,
      byEventType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      byAgent: {} as Record<string, number>,
    };

    for (const log of this.logs) {
      // Count by event type
      stats.byEventType[log.eventType] = (stats.byEventType[log.eventType] || 0) + 1;

      // Count by severity
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;

      // Count by agent
      stats.byAgent[log.agentId] = (stats.byAgent[log.agentId] || 0) + 1;
    }

    return stats;
  }
}
