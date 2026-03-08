/**
 * Enhanced Error Handling for Session Management
 *
 * Provides crash detection, cleanup, and notification for agent sessions.
 */

import type { SessionMetadata } from './session-manager';

/**
 * Format agent timeout error
 */
export function formatAgentTimeoutError(
  agentId: string,
  metadata: SessionMetadata,
  sessionDuration: number
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  return {
    message: `Agent ${agentId} timed out`,
    context: {
      agentId,
      role: metadata.role,
      parentAgentId: metadata.parentAgentId,
      startTime: metadata.startTime.toISOString(),
      timeoutMs: metadata.timeoutMs,
      sessionDuration: `${Math.round(sessionDuration / 1000)}s`,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      'Review agent task complexity - may need more time',
      'Increase timeout for this agent role',
      'Check if agent is blocked on external dependencies',
      'Review agent logs for stuck operations',
      'Consider breaking task into smaller subtasks',
    ],
  };
}

/**
 * Format agent crash error
 */
export function formatAgentCrashError(
  agentId: string,
  metadata: SessionMetadata,
  error: unknown,
  sessionDuration: number
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return {
    message: `Agent ${agentId} crashed`,
    context: {
      agentId,
      role: metadata.role,
      parentAgentId: metadata.parentAgentId,
      startTime: metadata.startTime.toISOString(),
      sessionDuration: `${Math.round(sessionDuration / 1000)}s`,
      error: errorMessage,
      errorStack,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      'Review error message and stack trace',
      'Check agent implementation for bugs',
      'Verify input data is valid',
      'Review agent logs for additional context',
      'Reassign task to another agent',
      'Escalate to Tech Lead if issue persists',
    ],
  };
}

/**
 * Format session cleanup error
 */
export function formatSessionCleanupError(
  agentId: string,
  error: unknown,
  cleanupSteps: string[]
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return {
    message: `Session cleanup failed for agent ${agentId}`,
    context: {
      agentId,
      error: errorMessage,
      errorStack,
      attemptedCleanupSteps: cleanupSteps,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      'Manually release file locks held by this agent',
      'Manually update agent status in registry',
      'Check for orphaned resources',
      'Review cleanup implementation for bugs',
      'Monitor for resource leaks',
    ],
  };
}

/**
 * Log agent timeout
 */
export function logAgentTimeout(
  agentId: string,
  metadata: SessionMetadata,
  sessionDuration: number
): void {
  const errorInfo = formatAgentTimeoutError(agentId, metadata, sessionDuration);

  console.error('[SessionManager] Agent timed out:', {
    ...errorInfo.context,
    suggestedActions: errorInfo.suggestedActions,
  });
}

/**
 * Log agent crash with cleanup notification
 */
export function logAgentCrash(
  agentId: string,
  metadata: SessionMetadata,
  error: unknown,
  sessionDuration: number,
  cleanupPerformed: boolean
): void {
  const errorInfo = formatAgentCrashError(agentId, metadata, error, sessionDuration);

  console.error('[SessionManager] Agent crashed:', {
    ...errorInfo.context,
    cleanupPerformed,
    suggestedActions: errorInfo.suggestedActions,
  });
}

/**
 * Log session cleanup error
 */
export function logSessionCleanupError(
  agentId: string,
  error: unknown,
  cleanupSteps: string[]
): void {
  const errorInfo = formatSessionCleanupError(agentId, error, cleanupSteps);

  console.error('[SessionManager] Session cleanup failed:', {
    ...errorInfo.context,
    suggestedActions: errorInfo.suggestedActions,
  });
}

/**
 * Create parent notification for agent crash
 */
export function createAgentCrashNotification(
  agentId: string,
  parentAgentId: string,
  metadata: SessionMetadata,
  error: unknown
): {
  type: 'agent-crash';
  agentId: string;
  role: string;
  error: string;
  errorStack?: string;
  sessionDuration: number;
  timestamp: string;
  suggestedActions: string[];
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const sessionDuration = Date.now() - metadata.startTime.getTime();

  return {
    type: 'agent-crash',
    agentId,
    role: metadata.role,
    error: errorMessage,
    errorStack,
    sessionDuration,
    timestamp: new Date().toISOString(),
    suggestedActions: [
      'Review crash details and error message',
      'Reassign task to another agent',
      'Check if task needs to be broken down',
      'Review agent implementation if crashes persist',
    ],
  };
}

/**
 * Detect potential agent crash (no activity for extended period)
 */
export function detectPotentialCrash(
  lastActivity: Date,
  thresholdMs: number = 5 * 60 * 1000 // 5 minutes
): boolean {
  const timeSinceActivity = Date.now() - lastActivity.getTime();
  return timeSinceActivity > thresholdMs;
}

/**
 * Format potential crash warning
 */
export function formatPotentialCrashWarning(
  agentId: string,
  role: string,
  lastActivity: Date,
  timeSinceActivity: number
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  return {
    message: `Agent ${agentId} may have crashed - no activity for ${Math.round(timeSinceActivity / 1000)}s`,
    context: {
      agentId,
      role,
      lastActivity: lastActivity.toISOString(),
      timeSinceActivity: `${Math.round(timeSinceActivity / 1000)}s`,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      'Check agent status and logs',
      'Terminate agent session if unresponsive',
      'Reassign task to another agent',
      'Investigate cause of inactivity',
    ],
  };
}

/**
 * Log potential crash warning
 */
export function logPotentialCrashWarning(
  agentId: string,
  role: string,
  lastActivity: Date,
  timeSinceActivity: number
): void {
  const warning = formatPotentialCrashWarning(agentId, role, lastActivity, timeSinceActivity);

  console.warn('[SessionManager] Potential agent crash detected:', {
    ...warning.context,
    suggestedActions: warning.suggestedActions,
  });
}
