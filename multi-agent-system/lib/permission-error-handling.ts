/**
 * Enhanced Error Handling for Permission Violations
 *
 * Provides clear error messages and audit logging for unauthorized actions.
 */

import type { AgentRole } from './agent-definition-schema';

/**
 * Format permission violation error
 */
export function formatPermissionViolationError(
  agentId: string,
  role: AgentRole,
  action: string,
  reason: string
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  return {
    message: `Permission denied: Agent ${agentId} cannot perform action '${action}'`,
    context: {
      agentId,
      role,
      action,
      reason,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      'Review agent role capabilities',
      'Request help from an agent with required capability',
      'Escalate to Tech Lead if action is necessary',
      'Check if action name is correct',
    ],
  };
}

/**
 * Format communication permission violation
 */
export function formatCommunicationViolationError(
  senderId: string,
  senderRole: AgentRole,
  recipientId: string,
  recipientRole: AgentRole
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  return {
    message: `Communication denied: Agent ${senderId} cannot send messages to ${recipientId}`,
    context: {
      senderId,
      senderRole,
      recipientId,
      recipientRole,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      'Use escalation to communicate with Tech Lead',
      'Request help from allowed agents',
      'Review communication permissions in agent definition',
      'Check if recipient ID is correct',
    ],
  };
}

/**
 * Format file access permission violation
 */
export function formatFileAccessViolationError(
  agentId: string,
  role: AgentRole,
  filePath: string,
  accessType: 'read' | 'write'
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  return {
    message: `File access denied: Agent ${agentId} cannot ${accessType} file ${filePath}`,
    context: {
      agentId,
      role,
      filePath,
      accessType,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      'Review agent file access patterns',
      'Request help from agent with file access capability',
      'Check if file path is correct',
      'Verify file exists and is accessible',
    ],
  };
}

/**
 * Log permission violation with audit trail
 */
export function logPermissionViolation(
  agentId: string,
  role: AgentRole,
  action: string,
  reason: string
): void {
  const errorInfo = formatPermissionViolationError(agentId, role, action, reason);

  console.warn('[PermissionCheck] Permission violation detected:', {
    ...errorInfo.context,
    suggestedActions: errorInfo.suggestedActions,
    severity: 'warning',
    auditLog: true,
  });
}

/**
 * Log communication permission violation
 */
export function logCommunicationViolation(
  senderId: string,
  senderRole: AgentRole,
  recipientId: string,
  recipientRole: AgentRole
): void {
  const errorInfo = formatCommunicationViolationError(
    senderId,
    senderRole,
    recipientId,
    recipientRole
  );

  console.warn('[PermissionCheck] Communication violation detected:', {
    ...errorInfo.context,
    suggestedActions: errorInfo.suggestedActions,
    severity: 'warning',
    auditLog: true,
  });
}

/**
 * Log file access permission violation
 */
export function logFileAccessViolation(
  agentId: string,
  role: AgentRole,
  filePath: string,
  accessType: 'read' | 'write'
): void {
  const errorInfo = formatFileAccessViolationError(agentId, role, filePath, accessType);

  console.warn('[PermissionCheck] File access violation detected:', {
    ...errorInfo.context,
    suggestedActions: errorInfo.suggestedActions,
    severity: 'warning',
    auditLog: true,
  });
}

/**
 * Create permission violation audit log entry
 */
export interface PermissionViolationAuditEntry {
  timestamp: Date;
  agentId: string;
  role: AgentRole;
  violationType: 'action' | 'communication' | 'file-access';
  details: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Create audit entry for permission violation
 */
export function createPermissionViolationAuditEntry(
  agentId: string,
  role: AgentRole,
  violationType: 'action' | 'communication' | 'file-access',
  details: Record<string, unknown>,
  severity: 'low' | 'medium' | 'high' = 'medium'
): PermissionViolationAuditEntry {
  return {
    timestamp: new Date(),
    agentId,
    role,
    violationType,
    details,
    severity,
  };
}

/**
 * Analyze permission violation patterns
 */
export function analyzeViolationPatterns(violations: PermissionViolationAuditEntry[]): {
  totalViolations: number;
  byAgent: Record<string, number>;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  repeatedViolators: string[];
} {
  const byAgent: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const violation of violations) {
    byAgent[violation.agentId] = (byAgent[violation.agentId] || 0) + 1;
    byType[violation.violationType] = (byType[violation.violationType] || 0) + 1;
    bySeverity[violation.severity] = (bySeverity[violation.severity] || 0) + 1;
  }

  // Find agents with >5 violations
  const repeatedViolators = Object.entries(byAgent)
    .filter(([, count]) => count > 5)
    .map(([agentId]) => agentId);

  return {
    totalViolations: violations.length,
    byAgent,
    byType,
    bySeverity,
    repeatedViolators,
  };
}
