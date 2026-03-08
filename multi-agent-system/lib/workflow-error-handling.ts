/**
 * Enhanced Error Handling for Workflow Engine
 *
 * Provides error isolation and detailed logging for workflow rule execution.
 */

import type { WorkflowRule, WorkflowEvent } from './workflow-types';

/**
 * Format workflow rule execution error
 */
export function formatWorkflowRuleError(
  rule: WorkflowRule,
  event: WorkflowEvent,
  error: unknown
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return {
    message: `Workflow rule '${rule.id}' execution failed`,
    context: {
      ruleId: rule.id,
      trigger: rule.trigger,
      action: rule.action,
      target: rule.target,
      priority: rule.priority,
      eventType: event.type,
      eventSource: event.source,
      error: errorMessage,
      errorStack,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      'Review rule action implementation for bugs',
      'Verify target agent role exists and is available',
      'Check event data structure matches rule expectations',
      'Review error message and stack trace',
      'Consider disabling rule if repeatedly failing',
    ],
  };
}

/**
 * Format workflow condition evaluation error
 */
export function formatWorkflowConditionError(
  rule: WorkflowRule,
  event: WorkflowEvent,
  error: unknown
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return {
    message: `Workflow rule '${rule.id}' condition evaluation failed`,
    context: {
      ruleId: rule.id,
      trigger: rule.trigger,
      eventType: event.type,
      error: errorMessage,
      errorStack,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      'Review rule condition function for bugs',
      'Verify event data structure is correct',
      'Add null/undefined checks in condition',
      'Consider removing condition if not needed',
    ],
  };
}

/**
 * Format workflow target agent not found error
 */
export function formatWorkflowTargetNotFoundError(
  rule: WorkflowRule,
  event: WorkflowEvent
): {
  message: string;
  context: Record<string, unknown>;
  suggestedActions: string[];
} {
  return {
    message: `No available agent found for workflow rule '${rule.id}'`,
    context: {
      ruleId: rule.id,
      trigger: rule.trigger,
      action: rule.action,
      targetRole: rule.target,
      eventType: event.type,
      eventSource: event.source,
      timestamp: new Date().toISOString(),
    },
    suggestedActions: [
      `Spawn a new ${rule.target} agent`,
      'Wait for existing agents to become idle',
      'Increase agent pool size for this role',
      'Queue the work item for later processing',
      'Escalate to Tech Lead if urgent',
    ],
  };
}

/**
 * Log workflow rule execution error with isolation
 */
export function logWorkflowRuleError(
  rule: WorkflowRule,
  event: WorkflowEvent,
  error: unknown
): void {
  const errorInfo = formatWorkflowRuleError(rule, event, error);

  console.error('[WorkflowEngine] Rule execution failed (isolated):', {
    ...errorInfo.context,
    suggestedActions: errorInfo.suggestedActions,
    note: 'Error was isolated - other rules will continue to execute',
  });
}

/**
 * Log workflow condition evaluation error
 */
export function logWorkflowConditionError(
  rule: WorkflowRule,
  event: WorkflowEvent,
  error: unknown
): void {
  const errorInfo = formatWorkflowConditionError(rule, event, error);

  console.error('[WorkflowEngine] Condition evaluation failed:', {
    ...errorInfo.context,
    suggestedActions: errorInfo.suggestedActions,
  });
}

/**
 * Log workflow target agent not found
 */
export function logWorkflowTargetNotFound(rule: WorkflowRule, event: WorkflowEvent): void {
  const errorInfo = formatWorkflowTargetNotFoundError(rule, event);

  console.warn('[WorkflowEngine] Target agent not available:', {
    ...errorInfo.context,
    suggestedActions: errorInfo.suggestedActions,
  });
}

/**
 * Wrap workflow rule execution with error isolation
 */
export async function executeRuleWithIsolation(
  rule: WorkflowRule,
  event: WorkflowEvent,
  executor: () => Promise<void>
): Promise<{ success: boolean; error?: unknown }> {
  try {
    await executor();
    return { success: true };
  } catch (error) {
    logWorkflowRuleError(rule, event, error);
    return { success: false, error };
  }
}

/**
 * Wrap workflow condition evaluation with error handling
 */
export function evaluateConditionSafely(
  rule: WorkflowRule,
  event: WorkflowEvent,
  condition: (data: unknown) => boolean
): boolean {
  try {
    return condition(event.data);
  } catch (error) {
    logWorkflowConditionError(rule, event, error);
    // Default to false on error (don't execute rule)
    return false;
  }
}
