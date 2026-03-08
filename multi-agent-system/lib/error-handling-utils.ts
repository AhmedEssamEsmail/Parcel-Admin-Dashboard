/**
 * Error Handling Utilities
 *
 * Provides comprehensive error handling utilities for the multi-agent system.
 * Includes error context, logging, and recovery strategies.
 */

export interface ErrorContext {
  operation: string;
  component: string;
  agentId?: string;
  timestamp: string;
  error: string;
  errorStack?: string;
  additionalContext?: Record<string, unknown>;
}

export interface ErrorWithSuggestions extends ErrorContext {
  suggestedActions: string[];
}

/**
 * Format an error with full context
 */
export function formatError(
  error: unknown,
  component: string,
  operation: string,
  additionalContext?: Record<string, unknown>
): ErrorContext {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return {
    operation,
    component,
    timestamp: new Date().toISOString(),
    error: errorMessage,
    errorStack,
    additionalContext,
  };
}

/**
 * Format an error with suggested actions
 */
export function formatErrorWithSuggestions(
  error: unknown,
  component: string,
  operation: string,
  suggestedActions: string[],
  additionalContext?: Record<string, unknown>
): ErrorWithSuggestions {
  const baseError = formatError(error, component, operation, additionalContext);

  return {
    ...baseError,
    suggestedActions,
  };
}

/**
 * Log an error with full context
 */
export function logError(errorContext: ErrorContext): void {
  console.error(`[${errorContext.component}] Error in ${errorContext.operation}:`, {
    error: errorContext.error,
    stack: errorContext.errorStack,
    timestamp: errorContext.timestamp,
    ...errorContext.additionalContext,
  });
}

/**
 * Log an error with suggested actions
 */
export function logErrorWithSuggestions(errorContext: ErrorWithSuggestions): void {
  console.error(`[${errorContext.component}] Error in ${errorContext.operation}:`, {
    error: errorContext.error,
    stack: errorContext.errorStack,
    timestamp: errorContext.timestamp,
    suggestedActions: errorContext.suggestedActions,
    ...errorContext.additionalContext,
  });
}

/**
 * Wrap an async operation with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  component: string,
  operationName: string,
  onError?: (error: ErrorContext) => void
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const errorContext = formatError(error, component, operationName);
    logError(errorContext);

    if (onError) {
      onError(errorContext);
    }

    return null;
  }
}

/**
 * Wrap a sync operation with error handling
 */
export function withErrorHandlingSync<T>(
  operation: () => T,
  component: string,
  operationName: string,
  onError?: (error: ErrorContext) => void
): T | null {
  try {
    return operation();
  } catch (error) {
    const errorContext = formatError(error, component, operationName);
    logError(errorContext);

    if (onError) {
      onError(errorContext);
    }

    return null;
  }
}

/**
 * Create a timeout error with context
 */
export function createTimeoutError(
  operation: string,
  timeoutMs: number,
  additionalContext?: Record<string, unknown>
): Error {
  const error = new Error(`Operation '${operation}' timed out after ${timeoutMs}ms`);

  if (additionalContext) {
    Object.assign(error, { context: additionalContext });
  }

  return error;
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('timed out') || error.message.includes('timeout');
  }
  return false;
}

/**
 * Check if an error is a permission error
 */
export function isPermissionError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('permission') ||
      error.message.includes('unauthorized') ||
      error.message.includes('forbidden')
    );
  }
  return false;
}

/**
 * Check if an error is a not found error
 */
export function isNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('not found') || error.message.includes('does not exist');
  }
  return false;
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  component: string = 'RetryUtil',
  operationName: string = 'operation'
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `[${component}] ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  const errorContext = formatError(lastError, component, operationName, {
    maxRetries,
    attemptsExhausted: true,
  });
  logError(errorContext);

  throw lastError;
}
