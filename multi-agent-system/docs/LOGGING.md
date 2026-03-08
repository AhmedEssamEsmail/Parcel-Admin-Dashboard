# Comprehensive Logging System

## Overview

The multi-agent system includes a comprehensive structured logging system that provides full observability into all infrastructure operations. The logger supports multiple log levels, formats, correlation IDs, and specialized logging methods for different operation types.

## Features

- **Log Levels**: DEBUG, INFO, WARN, ERROR
- **Log Formats**: Text (human-readable) and JSON (machine-parseable)
- **Correlation IDs**: Track related operations across components
- **Timestamps**: ISO 8601 format for all log entries
- **Structured Context**: Attach arbitrary metadata to log entries
- **Environment Configuration**: Configure via environment variables
- **Performance**: < 1ms overhead per log operation

## Configuration

### Environment Variables

```bash
# Set log level (DEBUG, INFO, WARN, ERROR)
export MULTI_AGENT_LOG_LEVEL=INFO

# Set log format (text, json)
export MULTI_AGENT_LOG_FORMAT=text
```

### Programmatic Configuration

```typescript
import { createLogger, LogLevel, LogFormat } from './lib/logger';

const logger = createLogger({
  level: LogLevel.DEBUG,
  format: LogFormat.JSON,
  enableConsole: true,
});
```

## Usage

### Basic Logging

```typescript
import { getLogger } from './lib/logger';

const logger = getLogger();

// Debug messages (only logged if level is DEBUG)
logger.debug('Component', 'Debug message', { key: 'value' });

// Info messages
logger.info('Component', 'Info message', { key: 'value' });

// Warning messages
logger.warn('Component', 'Warning message', { key: 'value' });

// Error messages
logger.error('Component', 'Error message', error, { context: 'data' });
```

### Specialized Logging Methods

#### Infrastructure Initialization

```typescript
logger.logInfrastructureInit('MessageBus', 5); // Component initialized in 5ms
logger.logInfrastructureInit('Complete', 50, 'success'); // All components initialized
```

**Format**: `[Infrastructure] Initialized MessageBus in 5ms`

#### Agent Spawning

```typescript
const correlationId = logger.generateCorrelationId();
logger.logAgentSpawn('developer-1', 'developer', 'tech-lead', correlationId);
```

**Format**: `[AgentSpawn] Spawned developer-1 (parent: tech-lead)`

#### Message Sending

```typescript
logger.logMessageSend('tech-lead', 'developer-1', 'request', 'high', 'msg-123', correlationId);
```

**Format**: `[Message] tech-lead → developer-1 (request, high)`

#### Workflow Triggers

```typescript
logger.logWorkflowTrigger('feature-complete', 'trigger-qa', ['test-feature'], correlationId);
```

**Format**: `[Workflow] Event 'feature-complete' matched rule 'trigger-qa'`

#### Quality Gates

```typescript
// Starting gates
logger.logQualityGates('developer-1', 6);

// Completed gates
logger.logQualityGates('developer-1', 6, { passed: 5, failed: 1 }, 150, correlationId);
```

**Format**: `[QualityGates] Running 6 gates for developer-1`
**Format**: `[QualityGates] Completed 6 gates for developer-1 (5 passed, 1 failed) in 150ms`

#### File Locking

```typescript
logger.logFileLock('developer-1', 'acquired', 'src/auth.ts', 'write', correlationId);
logger.logFileLock('developer-1', 'released', 'src/auth.ts', 'write', correlationId);
```

**Format**: `[FileLock] developer-1 acquired write lock on src/auth.ts`

#### Error Logging

```typescript
logger.logError(
  'MessageBus',
  'Message delivery failed: No handlers for agent-123',
  error,
  {
    messageId: 'msg-456',
    from: 'tech-lead',
    to: 'agent-123',
  },
  correlationId
);
```

**Format**: `[Error] Message delivery failed: No handlers for agent-123`

## Correlation IDs

Correlation IDs allow you to track related operations across multiple components:

```typescript
const correlationId = logger.generateCorrelationId();

// All operations with the same correlation ID
logger.logAgentSpawn('dev-1', 'developer', 'tech-lead', correlationId);
logger.logMessageSend('tech-lead', 'dev-1', 'request', 'high', 'msg-1', correlationId);
logger.logQualityGates('dev-1', 6, undefined, undefined, correlationId);

// Query all logs for this correlation ID
const relatedLogs = logger.getLogsByCorrelationId(correlationId);
```

## Querying Logs

### Get All Logs

```typescript
const allLogs = logger.getAllLogs();
```

### Filter by Category

```typescript
const infrastructureLogs = logger.getLogsByCategory('Infrastructure');
const agentSpawnLogs = logger.getLogsByCategory('AgentSpawn');
const messageLogs = logger.getLogsByCategory('Message');
```

### Filter by Level

```typescript
const errorLogs = logger.getLogsByLevel(LogLevel.ERROR);
const warnLogs = logger.getLogsByLevel(LogLevel.WARN);
```

### Filter by Correlation ID

```typescript
const relatedLogs = logger.getLogsByCorrelationId('corr-123');
```

## Log Entry Structure

Each log entry contains:

```typescript
interface LogEntry {
  timestamp: string; // ISO 8601 format
  level: string; // DEBUG, INFO, WARN, ERROR
  category: string; // Component category
  message: string; // Human-readable message
  correlationId?: string; // Optional correlation ID
  details?: Record<string, unknown>; // Optional structured data
}
```

## Log Formats

### Text Format (Default)

```
2024-01-15T10:30:45.123Z [INFO] [AgentSpawn] Spawned developer-1 (parent: tech-lead) (corr-123) {"agentId":"developer-1","role":"developer","parentId":"tech-lead"}
```

### JSON Format

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "category": "AgentSpawn",
  "message": "Spawned developer-1 (parent: tech-lead)",
  "correlationId": "corr-123",
  "details": {
    "agentId": "developer-1",
    "role": "developer",
    "parentId": "tech-lead"
  }
}
```

## Integration with Infrastructure

The logger is integrated into all infrastructure components:

### InfrastructureManager

- Logs initialization of each component with timing
- Logs total initialization time
- Logs cleanup operations
- Logs initialization errors with full context

### AgentInvocationManager

- Logs agent spawning with parent relationships
- Logs agent hierarchy recording
- Logs spawn failures with error details

### MessageBus

- Logs message sending with sender, recipient, type, priority
- Logs circuit breaker events
- Logs message delivery failures

### WorkflowEngine

- Logs workflow event processing
- Logs rule matching and execution
- Logs when no agents available for rule execution

### QualityGatesSystem

- Logs quality gate execution start
- Logs quality gate results with pass/fail counts
- Logs quality gate timeouts and errors

### SharedContextManager

- Logs file lock acquisition and release
- Logs file lock conflicts with holder details
- Logs lock failures

## Performance Considerations

- **Overhead**: < 1ms per log operation
- **Memory**: Logs are stored in memory (configurable max size)
- **Filtering**: Log level filtering happens before log creation
- **Async**: All logging is synchronous but fast

## Best Practices

1. **Use Correlation IDs**: Track related operations across components
2. **Appropriate Levels**: Use DEBUG for detailed tracing, INFO for normal operations, WARN for recoverable issues, ERROR for failures
3. **Structured Context**: Include relevant metadata in the details object
4. **Category Naming**: Use consistent category names (component names)
5. **Error Logging**: Always include the error object and context when logging errors

## Example

See `examples/logging-example.ts` for a complete example demonstrating all logging features.

## Testing

The logger includes comprehensive unit tests covering:

- Basic logging at all levels
- Log level filtering
- Correlation ID generation and tracking
- Specialized logging methods
- Log querying
- Environment configuration
- Log formats

Run tests:

```bash
npm run test:run -- logger.test.ts
```

## Troubleshooting

### Logs Not Appearing

- Check log level: `logger.setLevel(LogLevel.DEBUG)`
- Check console output: `logger.getConfig().enableConsole`
- Check environment variables: `MULTI_AGENT_LOG_LEVEL`, `MULTI_AGENT_LOG_FORMAT`

### Too Many Logs

- Increase log level: `logger.setLevel(LogLevel.WARN)`
- Filter by category: `logger.getLogsByCategory('Error')`

### Performance Issues

- Increase log level to reduce volume
- Disable console output: `createLogger({ enableConsole: false })`
- Clear logs periodically: `logger.clearLogs()`

## Future Enhancements

- Log rotation and archiving
- Remote log shipping (e.g., to Elasticsearch, CloudWatch)
- Log sampling for high-volume scenarios
- Structured query language for complex log queries
- Performance metrics and statistics
