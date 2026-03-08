/**
 * Tests for structured logger
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Logger, LogLevel, LogFormat, getLogger, resetLogger, createLogger } from './logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createLogger({ enableConsole: false });
  });

  describe('Basic Logging', () => {
    it('should log debug messages', () => {
      logger.setLevel(LogLevel.DEBUG); // Set to DEBUG to see debug messages
      logger.debug('Test', 'Debug message', { key: 'value' });
      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('DEBUG');
      expect(logs[0].category).toBe('Test');
      expect(logs[0].message).toBe('Debug message');
      expect(logs[0].details).toEqual({ key: 'value' });
    });

    it('should log info messages', () => {
      logger.info('Test', 'Info message');
      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('INFO');
    });

    it('should log warning messages', () => {
      logger.warn('Test', 'Warning message');
      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('WARN');
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Test', 'Error message', error);
      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('ERROR');
      expect(logs[0].details?.error).toBe('Test error');
      expect(logs[0].details?.stack).toBeDefined();
    });
  });

  describe('Log Levels', () => {
    it('should respect log level filtering', () => {
      logger.setLevel(LogLevel.WARN);
      logger.debug('Test', 'Debug message');
      logger.info('Test', 'Info message');
      logger.warn('Test', 'Warning message');
      logger.error('Test', 'Error message');

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(2); // Only WARN and ERROR
      expect(logs[0].level).toBe('WARN');
      expect(logs[1].level).toBe('ERROR');
    });
  });

  describe('Correlation IDs', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = logger.generateCorrelationId();
      const id2 = logger.generateCorrelationId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^corr-\d+-\d+$/);
    });
  });

  describe('Specialized Logging Methods', () => {
    it('should log infrastructure initialization', () => {
      logger.logInfrastructureInit('MessageBus', 5, 'success');
      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].category).toBe('Infrastructure');
      expect(logs[0].message).toContain('MessageBus');
      expect(logs[0].message).toContain('5ms');
      expect(logs[0].details?.component).toBe('MessageBus');
      expect(logs[0].details?.durationMs).toBe(5);
    });

    it('should log agent spawning', () => {
      logger.logAgentSpawn('dev-1', 'developer', 'tech-lead', 'corr-123');
      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].category).toBe('AgentSpawn');
      expect(logs[0].message).toContain('dev-1');
      expect(logs[0].message).toContain('tech-lead');
      expect(logs[0].correlationId).toBe('corr-123');
    });

    it('should log message sending', () => {
      logger.logMessageSend('agent-a', 'agent-b', 'request', 'high', 'msg-1', 'corr-123');
      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].category).toBe('Message');
      expect(logs[0].message).toContain('agent-a → agent-b');
      expect(logs[0].message).toContain('request');
      expect(logs[0].message).toContain('high');
    });

    it('should log workflow triggers', () => {
      logger.logWorkflowTrigger('feature-complete', 'trigger-qa', ['test-feature'], 'corr-123');
      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].category).toBe('Workflow');
      expect(logs[0].message).toContain('feature-complete');
      expect(logs[0].message).toContain('trigger-qa');
      expect(logs[0].details?.actions).toEqual(['test-feature']);
    });

    it('should log quality gates', () => {
      logger.logQualityGates('dev-1', 6, { passed: 5, failed: 1 }, 150, 'corr-123');
      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].category).toBe('QualityGates');
      expect(logs[0].message).toContain('6 gates');
      expect(logs[0].message).toContain('dev-1');
      expect(logs[0].details?.results).toEqual({ passed: 5, failed: 1 });
    });

    it('should log file locks', () => {
      logger.logFileLock('dev-1', 'acquired', 'src/auth.ts', 'write', 'corr-123');
      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].category).toBe('FileLock');
      expect(logs[0].message).toContain('dev-1');
      expect(logs[0].message).toContain('acquired');
      expect(logs[0].message).toContain('write');
      expect(logs[0].message).toContain('src/auth.ts');
    });
  });

  describe('Log Queries', () => {
    beforeEach(() => {
      logger.info('Cat1', 'Message 1');
      logger.warn('Cat2', 'Message 2');
      logger.error('Cat1', 'Message 3');
      logger.debug('Cat3', 'Message 4');
    });

    it('should get logs by category', () => {
      const logs = logger.getLogsByCategory('Cat1');
      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Message 1');
      expect(logs[1].message).toBe('Message 3');
    });

    it('should get logs by level', () => {
      const logs = logger.getLogsByLevel(LogLevel.WARN);
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Message 2');
    });

    it('should get logs by correlation ID', () => {
      const corrId = logger.generateCorrelationId();
      // Use logAgentSpawn which accepts correlationId
      logger.logAgentSpawn('test-agent', 'developer', undefined, corrId);
      const logs = logger.getLogsByCorrelationId(corrId);
      expect(logs).toHaveLength(1);
      expect(logs[0].correlationId).toBe(corrId);
    });
  });

  describe('Log Formats', () => {
    it('should format logs as text', () => {
      logger.setFormat(LogFormat.TEXT);
      logger.info('Test', 'Test message', { key: 'value' });
      const logs = logger.getAllLogs();
      expect(logs[0].timestamp).toBeDefined();
      expect(logs[0].level).toBe('INFO');
      expect(logs[0].category).toBe('Test');
    });

    it('should format logs as JSON', () => {
      logger.setFormat(LogFormat.JSON);
      logger.info('Test', 'Test message', { key: 'value' });
      const logs = logger.getAllLogs();
      expect(logs[0]).toHaveProperty('timestamp');
      expect(logs[0]).toHaveProperty('level');
      expect(logs[0]).toHaveProperty('category');
      expect(logs[0]).toHaveProperty('message');
    });
  });

  describe('Global Logger', () => {
    beforeEach(() => {
      resetLogger();
    });

    it('should return singleton instance', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });

    it('should reset global logger', () => {
      const logger1 = getLogger();
      resetLogger();
      const logger2 = getLogger();
      expect(logger1).not.toBe(logger2);
    });
  });

  describe('Configuration', () => {
    it('should read log level from environment', () => {
      process.env.MULTI_AGENT_LOG_LEVEL = 'ERROR';
      const envLogger = createLogger();
      const config = envLogger.getConfig();
      expect(config.level).toBe(LogLevel.ERROR);
      delete process.env.MULTI_AGENT_LOG_LEVEL;
    });

    it('should read log format from environment', () => {
      process.env.MULTI_AGENT_LOG_FORMAT = 'json';
      const envLogger = createLogger();
      const config = envLogger.getConfig();
      expect(config.format).toBe(LogFormat.JSON);
      delete process.env.MULTI_AGENT_LOG_FORMAT;
    });

    it('should use defaults when environment not set', () => {
      delete process.env.MULTI_AGENT_LOG_LEVEL;
      delete process.env.MULTI_AGENT_LOG_FORMAT;
      const envLogger = createLogger();
      const config = envLogger.getConfig();
      expect(config.level).toBe(LogLevel.INFO);
      expect(config.format).toBe(LogFormat.TEXT);
    });
  });

  describe('Utility Methods', () => {
    it('should clear logs', () => {
      logger.info('Test', 'Message 1');
      logger.info('Test', 'Message 2');
      expect(logger.getLogCount()).toBe(2);
      logger.clearLogs();
      expect(logger.getLogCount()).toBe(0);
    });

    it('should get log count', () => {
      expect(logger.getLogCount()).toBe(0);
      logger.info('Test', 'Message 1');
      expect(logger.getLogCount()).toBe(1);
      logger.info('Test', 'Message 2');
      expect(logger.getLogCount()).toBe(2);
    });
  });
});
