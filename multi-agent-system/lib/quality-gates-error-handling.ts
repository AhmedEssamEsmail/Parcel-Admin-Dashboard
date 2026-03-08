/**
 * Enhanced Error Handling for Quality Gates
 *
 * Provides detailed error messages and recovery strategies for quality gate failures.
 */

import type { GateResult, QualityGate } from './quality-gates-types';
import type { WorkItem } from './shared-context-types';

/**
 * Format quality gate execution error with full context
 */
export function formatQualityGateError(
  gate: QualityGate,
  workItem: WorkItem,
  error: unknown,
  duration: number
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const isTimeout = errorMessage.includes('timed out');

  return {
    message: `Quality gate '${gate.name}' failed for work item ${workItem.id}`,
    context: {
      gateId: gate.id,
      gateName: gate.name,
      workItemId: workItem.id,
      workItemTitle: workItem.title,
      assignedTo: workItem.assignedTo,
      error: errorMessage,
      errorStack,
      duration: `${duration}ms`,
      timeout: `${gate.timeout}ms`,
      isTimeout,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: isTimeout
      ? [
          `Increase gate timeout (current: ${gate.timeout}ms)`,
          'Optimize gate check implementation',
          'Check if external dependencies are slow',
          'Consider splitting into multiple smaller gates',
        ]
      : [
          'Review gate check implementation for bugs',
          'Verify work item artifacts are valid',
          'Check gate prerequisites are met',
          'Review error message and stack trace',
          'Contact Tech Lead if issue persists',
        ],
  };
}

/**
 * Format quality gate timeout error
 */
export function formatQualityGateTimeoutError(
  gateId: string,
  workItemId: string,
  timeout: number,
  duration: number
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  return {
    message: `Quality gate '${gateId}' timed out`,
    context: {
      gateId,
      workItemId,
      timeout: `${timeout}ms`,
      actualDuration: `${duration}ms`,
      exceeded: `${duration - timeout}ms`,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      `Increase gate timeout (current: ${timeout}ms, needed: ~${Math.ceil(duration * 1.2)}ms)`,
      'Optimize gate check implementation',
      'Check if external dependencies are slow (network, file I/O, etc.)',
      'Consider splitting into multiple smaller gates',
      'Review timeout logs for patterns',
    ],
  };
}

/**
 * Log quality gate execution error
 */
export function logQualityGateError(
  gate: QualityGate,
  workItem: WorkItem,
  error: unknown,
  duration: number
): void {
  const errorInfo = formatQualityGateError(gate, workItem, error, duration);

  console.error('[QualityGates] Gate execution failed:', {
    ...errorInfo.context,
    suggestedActions: errorInfo.suggestedActions,
  });
}

/**
 * Log quality gate timeout
 */
export function logQualityGateTimeout(
  gateId: string,
  workItemId: string,
  timeout: number,
  duration: number
): void {
  const errorInfo = formatQualityGateTimeoutError(gateId, workItemId, timeout, duration);

  console.error('[QualityGates] Gate timed out:', {
    ...errorInfo.context,
    suggestedActions: errorInfo.suggestedActions,
  });
}

/**
 * Format quality gate failure report with actionable insights
 */
export function formatQualityGateFailureReport(
  workItemId: string,
  failedGates: GateResult[],
  assignedTo: string
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  const timeoutGates = failedGates.filter((g) => g.timedOut);
  const errorGates = failedGates.filter((g) => !g.timedOut);

  return {
    message: `${failedGates.length} quality gate(s) failed for work item ${workItemId}`,
    context: {
      workItemId,
      assignedTo,
      totalFailed: failedGates.length,
      timeoutCount: timeoutGates.length,
      errorCount: errorGates.length,
      failedGateIds: failedGates.map((g) => g.gateId),
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      'Review failed gate details and error messages',
      'Fix issues identified by quality gates',
      'Re-run quality gates after fixes',
      'Request Tech Lead override if gates are incorrect',
      'Update work item status to reflect issues',
    ],
  };
}

/**
 * Log quality gate failure report
 */
export function logQualityGateFailureReport(
  workItemId: string,
  failedGates: GateResult[],
  assignedTo: string
): void {
  const report = formatQualityGateFailureReport(workItemId, failedGates, assignedTo);

  console.error('[QualityGates] Quality gates failed:', {
    ...report.context,
    suggestedActions: report.suggestedActions,
    failedGates: failedGates.map((g) => ({
      gateId: g.gateId,
      message: g.message,
      timedOut: g.timedOut,
      duration: g.duration,
    })),
  });
}
