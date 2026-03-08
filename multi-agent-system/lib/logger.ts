/**
 * Structured Logger for Multi-Agent Infrastructure
 *
 * Provides structured logging with configurable levels and formats
 * for all infrastructure operations.
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log formats
 */
export enum LogFormat {
  TEXT = 'text',
  JSON = 'json',
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level?: LogLevel;
  format?: LogFormat;
  enableConsole?: boolean;
}

/**
 * Structured Logger
 *
 * Supports:
 * - Log levels: DEBUG, INFO, WARN, ERROR
 * - Log formats: JSON, text
 * - Timestamps and correlation IDs
 * - Structured context data
 */
export class Logger {
  private level: LogLevel;
  private format: LogFormat;
  private enableConsole: boolean;
  private logs: LogEntry[] = [];
  private correlationIdCounter = 0;

  constructor(config: LoggerConfig = {}) {
    // Read from environment variables with defaults
    const envLevel = process.env.MULTI_AGENT_LOG_LEVEL?.toUpperCase();
    const envFormat = process.env.MULTI_AGENT_LOG_FORMAT?.toLowerCase();

    this.level = config.level ?? this.parseLogLevel(envLevel) ?? LogLevel.INFO;
    this.format = config.format ?? this.parseLogFormat(envFormat) ?? LogFormat.TEXT;
    this.enableConsole = config.enableConsole ?? true;
  }

  /**
   * Parse log level from string
   */
  private parseLogLevel(level?: string): LogLevel | undefined {
    if (!level) return undefined;
    switch (level) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      default:
        return undefined;
    }
  }

  /**
   * Parse log format from string
   */
  private parseLogFormat(format?: string): LogFormat | undefined {
    if (!format) return undefined;
    switch (format) {
      case 'text':
        return LogFormat.TEXT;
      case 'json':
        return LogFormat.JSON;
      default:
        return undefined;
    }
  }

  /**
   * Generate correlation ID
   */
  generateCorrelationId(): string {
    return `corr-${Date.now()}-${++this.correlationIdCounter}`;
  }

  /**
   * Check if level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  /**
   * Format log entry
   */
  private formatEntry(entry: LogEntry): string {
    if (this.format === LogFormat.JSON) {
      return JSON.stringify(entry);
    }

    // Text format
    const parts = [entry.timestamp, `[${entry.level}]`, `[${entry.category}]`, entry.message];

    if (entry.correlationId) {
      parts.push(`(${entry.correlationId})`);
    }

    if (entry.details && Object.keys(entry.details).length > 0) {
      parts.push(JSON.stringify(entry.details));
    }

    return parts.join(' ');
  }

  /**
   * Log a message
   */
  private log(
    level: LogLevel,
    category: string,
    message: string,
    details?: Record<string, unknown>,
    correlationId?: string
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      category,
      message,
      ...(correlationId && { correlationId }),
      ...(details && { details }),
    };

    this.logs.push(entry);

    if (this.enableConsole) {
      const formatted = this.formatEntry(entry);
      switch (level) {
        case LogLevel.ERROR:
          console.error(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        default:
          console.log(formatted);
      }
    }
  }

  /**
   * Log debug message
   */
  debug(category: string, message: string, details?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, category, message, details);
  }

  /**
   * Log info message
   */
  info(category: string, message: string, details?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, category, message, details);
  }

  /**
   * Log warning message
   */
  warn(category: string, message: string, details?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, category, message, details);
  }

  /**
   * Log error message
   */
  error(
    category: string,
    message: string,
    error?: Error | unknown,
    details?: Record<string, unknown>
  ): void {
    const errorDetails: Record<string, unknown> = {
      ...details,
    };

    if (error instanceof Error) {
      errorDetails.error = error.message;
      errorDetails.stack = error.stack;
    } else if (error) {
      errorDetails.error = String(error);
    }

    this.log(LogLevel.ERROR, category, message, errorDetails);
  }

  /**
   * Log infrastructure initialization
   * Format: [Infrastructure] Initialized MessageBus in 5ms
   */
  logInfrastructureInit(component: string, durationMs: number, status?: string): void {
    this.info('Infrastructure', `Initialized ${component} in ${durationMs}ms`, {
      component,
      durationMs,
      ...(status && { status }),
    });
  }

  /**
   * Log agent spawning
   * Format: [AgentSpawn] Spawned developer-1 (parent: tech-lead)
   */
  logAgentSpawn(agentId: string, role: string, parentId?: string, correlationId?: string): void {
    const message = parentId
      ? `Spawned ${agentId} (parent: ${parentId})`
      : `Spawned ${agentId} (root)`;

    this.log(
      LogLevel.INFO,
      'AgentSpawn',
      message,
      {
        agentId,
        role,
        ...(parentId && { parentId }),
      },
      correlationId
    );
  }

  /**
   * Log message sending
   * Format: [Message] tech-lead → developer-1 (request, high)
   */
  logMessageSend(
    from: string,
    to: string,
    type: string,
    priority: string,
    messageId?: string,
    correlationId?: string
  ): void {
    this.log(
      LogLevel.INFO,
      'Message',
      `${from} → ${to} (${type}, ${priority})`,
      {
        from,
        to,
        type,
        priority,
        ...(messageId && { messageId }),
      },
      correlationId
    );
  }

  /**
   * Log workflow rule trigger
   * Format: [Workflow] Event 'feature-complete' matched rule 'trigger-qa'
   */
  logWorkflowTrigger(
    eventType: string,
    ruleName: string,
    actions: string[],
    correlationId?: string
  ): void {
    this.log(
      LogLevel.INFO,
      'Workflow',
      `Event '${eventType}' matched rule '${ruleName}'`,
      {
        eventType,
        ruleName,
        actions,
      },
      correlationId
    );
  }

  /**
   * Log quality gate execution
   * Format: [QualityGates] Running 6 gates for developer-1
   */
  logQualityGates(
    agentId: string,
    gateCount: number,
    results?: { passed: number; failed: number },
    durationMs?: number,
    correlationId?: string
  ): void {
    const message = results
      ? `Completed ${gateCount} gates for ${agentId} (${results.passed} passed, ${results.failed} failed) in ${durationMs}ms`
      : `Running ${gateCount} gates for ${agentId}`;

    this.log(
      LogLevel.INFO,
      'QualityGates',
      message,
      {
        agentId,
        gateCount,
        ...(results && { results }),
        ...(durationMs && { durationMs }),
      },
      correlationId
    );
  }

  /**
   * Log file lock operation
   * Format: [FileLock] developer-1 acquired write lock on src/auth.ts
   */
  logFileLock(
    agentId: string,
    operation: 'acquired' | 'released' | 'renewed' | 'failed',
    filePath: string,
    mode: 'read' | 'write',
    correlationId?: string
  ): void {
    this.log(
      LogLevel.INFO,
      'FileLock',
      `${agentId} ${operation} ${mode} lock on ${filePath}`,
      {
        agentId,
        operation,
        filePath,
        mode,
      },
      correlationId
    );
  }

  /**
   * Log error with full context
   * Format: [Error] Message delivery failed: No handlers for agent-123
   */
  logError(
    category: string,
    message: string,
    error?: Error | unknown,
    context?: Record<string, unknown>,
    correlationId?: string
  ): void {
    const errorDetails: Record<string, unknown> = {
      ...(context || {}),
    };

    if (error instanceof Error) {
      errorDetails.error = error.message;
      errorDetails.stack = error.stack;
    } else if (error) {
      errorDetails.error = String(error);
    }

    this.log(LogLevel.ERROR, category, message, errorDetails, correlationId);
  }

  /**
   * Get all logs
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by category
   */
  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter((log) => log.category === category);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === LogLevel[level]);
  }

  /**
   * Get logs by correlation ID
   */
  getLogsByCorrelationId(correlationId: string): LogEntry[] {
    return this.logs.filter((log) => log.correlationId === correlationId);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get log count
   */
  getLogCount(): number {
    return this.logs.length;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Set log format
   */
  setFormat(format: LogFormat): void {
    this.format = format;
  }

  /**
   * Get current configuration
   */
  getConfig(): { level: LogLevel; format: LogFormat; enableConsole: boolean } {
    return {
      level: this.level,
      format: this.format,
      enableConsole: this.enableConsole,
    };
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

/**
 * Get or create global logger instance
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

/**
 * Reset global logger (for testing)
 */
export function resetLogger(): void {
  globalLogger = null;
}

/**
 * Create a new logger instance
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}
