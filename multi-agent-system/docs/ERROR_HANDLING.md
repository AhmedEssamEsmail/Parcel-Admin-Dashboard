# Comprehensive Error Handling Guide

This document describes the comprehensive error handling implemented across all infrastructure components in the multi-agent system.

## Overview

The multi-agent system implements comprehensive error handling with:

- **Full Context**: All errors include timestamp, component, operation, and relevant data
- **Suggested Actions**: Every error provides actionable steps for resolution
- **Graceful Degradation**: System continues operating with reduced functionality when possible
- **Audit Logging**: Security-relevant errors are logged for audit trails
- **Error Isolation**: Errors in one component don't crash the entire system

## Error Handling by Component

### 1. Infrastructure Manager

**Error Scenarios**:

- Infrastructure initialization failures

**Handling**:

- Wraps initialization in try-catch
- Logs full error context with stack trace
- Provides fallback: marks as initialized with degraded functionality
- Re-throws error to allow caller to handle

**Example Error Output**:

```
[InfrastructureManager] CRITICAL: Infrastructure initialization failed
{
  error: "AgentRegistry initialization failed",
  stack: "Error: ...",
  timestamp: "2024-01-15T10:30:00.000Z",
  context: "constructor"
}
```

### 2. Message Bus

**Error Scenarios**:

- Message delivery failures
- Circuit breaker open
- Dead letter queue overflow

**Handling**:

- Retry with exponential backoff (max 3 retries)
- Move to dead letter queue after max retries
- Notify sender of delivery failure with full context
- Escalate critical message failures to Tech Lead
- Circuit breaker prevents cascading failures

**Example Error Output**:

```
[MessageBus] Failed to notify sender of delivery failure:
{
  originalMessageId: "msg-123",
  sender: "developer-1",
  recipient: "qa-engineer-1",
  notificationError: "No handlers registered",
  timestamp: "2024-01-15T10:30:00.000Z"
}
```

**Suggested Actions in Notification**:

- Check if recipient agent is registered and online
- Verify recipient agent ID is correct
- Check if recipient has message handlers subscribed
- Consider using escalation if urgent

### 3. Shared Context

**Error Scenarios**:

- File lock timeouts
- Concurrent state updates
- Lock holder conflicts

**Handling**:

- Detailed error context with lock holder information
- Time remaining until lock expires
- Suggested actions for resolution
- Automatic lock release on expiration

**Example Error Output**:

```
[SharedContext] File lock acquisition failed:
{
  filePath: "src/auth.ts",
  requestedBy: "developer-2",
  requestedType: "write",
  currentLockHolder: "developer-1",
  currentLockType: "write",
  lockAcquiredAt: "2024-01-15T10:25:00.000Z",
  lockExpiresAt: "2024-01-15T10:35:00.000Z",
  timeRemaining: "300s",
  lockDuration: "300s",
  timestamp: "2024-01-15T10:30:00.000Z",
  suggestedActions: [
    "Wait for lock holder developer-1 to release the lock",
    "Contact lock holder developer-1 if blocked for >5 minutes",
    "Consider using a different file if possible",
    "Escalate to Tech Lead if urgent",
    "Lock will auto-expire in 300 seconds"
  ]
}
```

### 4. Quality Gates

**Error Scenarios**:

- Gate execution errors
- Gate timeouts
- Gate check failures

**Handling**:

- Each gate wrapped in try-catch with timeout
- Errors include full context (gate, work item, duration)
- Timeout detection with suggested timeout increases
- Failed gates don't block other gates (parallel execution)
- Detailed failure reports with actionable insights

**Example Error Output**:

```
[QualityGates] Gate execution failed:
{
  gateId: "lint-check",
  gateName: "Linting",
  workItemId: "task-123",
  workItemTitle: "Implement authentication",
  assignedTo: "developer-1",
  error: "Linting failed: 5 errors found",
  duration: "2500ms",
  timeout: "30000ms",
  isTimeout: false,
  timestamp: "2024-01-15T10:30:00.000Z",
  suggestedActions: [
    "Review gate check implementation for bugs",
    "Verify work item artifacts are valid",
    "Check gate prerequisites are met",
    "Review error message and stack trace",
    "Contact Tech Lead if issue persists"
  ]
}
```

**Timeout Error Output**:

```
[QualityGates] Gate timed out:
{
  gateId: "integration-tests",
  workItemId: "task-123",
  timeout: "60000ms",
  actualDuration: "75000ms",
  exceeded: "15000ms",
  timestamp: "2024-01-15T10:30:00.000Z",
  suggestedActions: [
    "Increase gate timeout (current: 60000ms, needed: ~90000ms)",
    "Optimize gate check implementation",
    "Check if external dependencies are slow (network, file I/O, etc.)",
    "Consider splitting into multiple smaller gates",
    "Review timeout logs for patterns"
  ]
}
```

### 5. Workflow Engine

**Error Scenarios**:

- Rule execution errors
- Condition evaluation errors
- Target agent not found

**Handling**:

- Error isolation: failed rules don't affect other rules
- Condition evaluation wrapped in try-catch
- Target agent availability checked before execution
- Detailed logging with rule and event context

**Example Error Output**:

```
[WorkflowEngine] Rule execution failed (isolated):
{
  ruleId: "feature-complete-to-qa",
  trigger: "feature-complete",
  action: "test-feature",
  target: "qa-engineer",
  priority: 80,
  eventType: "feature-complete",
  eventAgentId: "developer-1",
  error: "No available QA engineer",
  timestamp: "2024-01-15T10:30:00.000Z",
  suggestedActions: [
    "Review rule action implementation for bugs",
    "Verify target agent role exists and is available",
    "Check event data structure matches rule expectations",
    "Review error message and stack trace",
    "Consider disabling rule if repeatedly failing"
  ],
  note: "Error was isolated - other rules will continue to execute"
}
```

### 6. Session Manager

**Error Scenarios**:

- Agent timeouts
- Agent crashes
- Session cleanup failures

**Handling**:

- Timeout detection with automatic termination
- Crash detection (no activity for >5 minutes)
- Automatic resource cleanup (file locks, registry, hierarchy)
- Parent notification on crash
- Detailed crash reports with session duration

**Example Error Output**:

```
[SessionManager] Agent crashed:
{
  agentId: "developer-1",
  role: "developer",
  parentAgentId: "tech-lead-1",
  startTime: "2024-01-15T10:00:00.000Z",
  sessionDuration: "1800s",
  error: "Unhandled exception in agent code",
  errorStack: "Error: ...",
  timestamp: "2024-01-15T10:30:00.000Z",
  cleanupPerformed: true,
  suggestedActions: [
    "Review error message and stack trace",
    "Check agent implementation for bugs",
    "Verify input data is valid",
    "Review agent logs for additional context",
    "Reassign task to another agent",
    "Escalate to Tech Lead if issue persists"
  ]
}
```

### 7. Agent Registry

**Error Scenarios**:

- Permission violations
- Unauthorized action attempts
- Agent not found

**Handling**:

- Permission checks before all operations
- Audit logging of unauthorized attempts
- Clear error messages with suggested actions
- Silent mode for testing (suppresses warnings)

**Example Error Output**:

```
[PermissionCheck] Permission violation detected:
{
  agentId: "developer-1",
  role: "developer",
  action: "deploy-to-production",
  reason: "Agent developer does not have capability: deploy-to-production",
  timestamp: "2024-01-15T10:30:00.000Z",
  severity: "warning",
  auditLog: true,
  suggestedActions: [
    "Review agent role capabilities",
    "Request help from an agent with required capability",
    "Escalate to Tech Lead if action is necessary",
    "Check if action name is correct"
  ]
}
```

## Error Handling Utilities

The system provides utility functions for consistent error handling:

### formatError()

Formats an error with full context (component, operation, timestamp, stack trace).

### formatErrorWithSuggestions()

Formats an error with suggested actions for resolution.

### logError()

Logs an error with full context to console.

### withErrorHandling()

Wraps an async operation with error handling and optional callback.

### retryWithBackoff()

Retries an operation with exponential backoff.

## Best Practices

### 1. Always Include Context

```typescript
console.error('[Component] Operation failed:', {
  error: errorMessage,
  stack: errorStack,
  timestamp: new Date().toISOString(),
  // Add relevant context
  agentId,
  operation,
  additionalData,
});
```

### 2. Provide Suggested Actions

```typescript
suggestedActions: [
  'Specific action to resolve the issue',
  'Alternative approach if first action fails',
  'Who to contact for help',
  'How to escalate if urgent',
];
```

### 3. Use Error Isolation

```typescript
try {
  await riskyOperation();
} catch (error) {
  logError(error);
  // Continue with other operations
}
```

### 4. Implement Graceful Degradation

```typescript
try {
  await initializeComponent();
} catch (error) {
  logError(error);
  // Continue with reduced functionality
  this.degradedMode = true;
}
```

### 5. Add Audit Logging for Security

```typescript
logPermissionViolation(agentId, role, action, reason);
// Automatically adds auditLog: true flag
```

## Error Recovery Strategies

### 1. Retry with Backoff

For transient errors (network, temporary unavailability):

```typescript
await retryWithBackoff(
  () => sendMessage(message),
  maxRetries: 3,
  baseDelayMs: 1000
);
```

### 2. Circuit Breaker

For cascading failures (agent repeatedly failing):

```typescript
if (isCircuitOpen(agentId)) {
  moveToDeadLetterQueue(message);
  return;
}
```

### 3. Dead Letter Queue

For undeliverable messages:

```typescript
if (retryCount > maxRetries) {
  deadLetterQueue.push(message);
  notifySender(message, error);
}
```

### 4. Automatic Cleanup

For resource leaks:

```typescript
// On session end
releaseAllFileLocks(agentId);
updateAgentStatus(agentId, 'offline');
removeFromHierarchy(agentId);
```

### 5. Parent Notification

For agent crashes:

```typescript
if (agentCrashed) {
  notifyParent(parentAgentId, crashDetails);
  cleanupResources(agentId);
}
```

## Monitoring and Alerting

### Error Metrics to Track

- Message delivery failure rate
- Quality gate timeout rate
- Agent crash rate
- Permission violation rate
- File lock timeout rate

### Alert Thresholds

- **Critical**: >10% message delivery failures
- **High**: >5% quality gate timeouts
- **Medium**: >3 agent crashes per hour
- **Low**: >10 permission violations per agent

### Log Analysis

All errors include structured data for easy parsing:

```typescript
{
  timestamp: "ISO 8601 format",
  component: "Component name",
  operation: "Operation name",
  error: "Error message",
  errorStack: "Stack trace",
  suggestedActions: ["Action 1", "Action 2"],
  // Component-specific context
}
```

## Testing Error Handling

### Unit Tests

Test each error scenario in isolation:

```typescript
it('should handle message delivery failure', async () => {
  // Simulate failure
  // Verify error logged
  // Verify sender notified
  // Verify suggested actions included
});
```

### Integration Tests

Test error propagation across components:

```typescript
it('should handle agent crash with cleanup', async () => {
  // Simulate agent crash
  // Verify cleanup performed
  // Verify parent notified
  // Verify resources released
});
```

### Error Injection

Use error injection for testing:

```typescript
// Inject error in test
messageBus.injectError('delivery-failure');

// Verify system handles gracefully
expect(deadLetterQueue).toHaveLength(1);
expect(senderNotified).toBe(true);
```

## Conclusion

Comprehensive error handling ensures the multi-agent system is:

- **Resilient**: Continues operating despite errors
- **Observable**: All errors logged with full context
- **Actionable**: Suggested actions guide resolution
- **Secure**: Permission violations audited
- **Maintainable**: Consistent error handling patterns

For questions or issues, contact the Tech Lead or refer to the troubleshooting guide.
