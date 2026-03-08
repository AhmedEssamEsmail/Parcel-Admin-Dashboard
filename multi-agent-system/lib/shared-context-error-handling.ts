/**
 * Enhanced Error Handling for SharedContext
 *
 * Provides detailed error messages and suggested actions for file lock conflicts
 * and concurrent state updates.
 */

import type { FileLock } from './shared-context-types';

/**
 * Format file lock timeout error with full context
 */
export function formatFileLockTimeoutError(
  filePath: string,
  requestedBy: string,
  requestedType: 'read' | 'write',
  existingLock: FileLock
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  const timeRemaining = existingLock.expiresAt.getTime() - Date.now();
  const lockDuration = Date.now() - existingLock.acquiredAt.getTime();

  return {
    message: `File lock acquisition failed for ${filePath}`,
    context: {
      filePath,
      requestedBy,
      requestedType,
      currentLockHolder: existingLock.lockedBy,
      currentLockType: existingLock.type,
      lockAcquiredAt: existingLock.acquiredAt.toISOString(),
      lockExpiresAt: existingLock.expiresAt.toISOString(),
      timeRemaining: `${Math.round(timeRemaining / 1000)}s`,
      lockDuration: `${Math.round(lockDuration / 1000)}s`,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      `Wait for lock holder ${existingLock.lockedBy} to release the lock`,
      `Contact lock holder ${existingLock.lockedBy} if blocked for >5 minutes`,
      'Consider using a different file if possible',
      'Escalate to Tech Lead if urgent',
      `Lock will auto-expire in ${Math.round(timeRemaining / 1000)} seconds`,
    ],
  };
}

/**
 * Format concurrent state update conflict error
 */
export function formatConcurrentUpdateError(
  agentId: string,
  operation: string,
  conflictDetails: {
    expectedVersion?: number;
    actualVersion?: number;
    conflictingAgentId?: string;
  }
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  return {
    message: `Concurrent state update conflict detected`,
    context: {
      agentId,
      operation,
      ...conflictDetails,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      'Retry the operation with the latest state',
      'Use eventual consistency mode if strong consistency is not required',
      'Coordinate with other agents to avoid conflicts',
      'Consider using file locks for critical sections',
    ],
  };
}

/**
 * Log file lock acquisition with context
 */
export function logFileLockAcquisition(
  filePath: string,
  agentId: string,
  type: 'read' | 'write',
  expiresAt: Date
): void {
  console.log('[SharedContext] File lock acquired:', {
    filePath,
    agentId,
    type,
    expiresAt: expiresAt.toISOString(),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log file lock release with context
 */
export function logFileLockRelease(filePath: string, agentId: string, lockDuration: number): void {
  console.log('[SharedContext] File lock released:', {
    filePath,
    agentId,
    lockDuration: `${Math.round(lockDuration / 1000)}s`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log file lock timeout with context
 */
export function logFileLockTimeout(
  filePath: string,
  agentId: string,
  requestedType: 'read' | 'write',
  existingLock: FileLock
): void {
  const errorInfo = formatFileLockTimeoutError(filePath, agentId, requestedType, existingLock);

  console.warn('[SharedContext] File lock acquisition failed:', {
    ...errorInfo.context,
    suggestedActions: errorInfo.suggestedActions,
  });
}
