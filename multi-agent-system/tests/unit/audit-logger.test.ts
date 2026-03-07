/**
 * Unit tests for Audit Logger
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger, AuditEventType, AuditSeverity } from '@/multi-agent-system/lib/audit-logger';
import { AgentRole } from '@/multi-agent-system/lib/agent-definition-schema';
import type { AgentMessage } from '@/multi-agent-system/lib/types';
import type { AuthorizationDenial } from '@/multi-agent-system/lib/agent-auth';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger({ enableConsoleOutput: false });
    logger.clearLogs();
  });

  describe('Basic Logging', () => {
    it('should log an audit event', () => {
      logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        'agent-1',
        AgentRole.DEVELOPER,
        'write-code',
        { file: 'test.ts' }
      );

      const logs = logger.getAllLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].agentId).toBe('agent-1');
      expect(logs[0].action).toBe('write-code');
    });

    it('should generate unique log IDs', () => {
      logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        'agent-1',
        AgentRole.DEVELOPER,
        'action-1'
      );
      logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        'agent-1',
        AgentRole.DEVELOPER,
        'action-2'
      );

      const logs = logger.getAllLogs();
      expect(logs[0].id).not.toBe(logs[1].id);
    });

    it('should include timestamp in log entry', () => {
      const before = new Date();
      logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        'agent-1',
        AgentRole.DEVELOPER,
        'test-action'
      );
      const after = new Date();

      const logs = logger.getAllLogs();
      expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(logs[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Agent Lifecycle Logging', () => {
    it('should log agent spawn', () => {
      logger.logAgentSpawned('agent-1', AgentRole.DEVELOPER, ['write-code', 'fix-bugs']);

      const logs = logger.getAllLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].eventType).toBe(AuditEventType.AGENT_SPAWNED);
      expect(logs[0].agentId).toBe('agent-1');
      expect(logs[0].details.capabilities).toEqual(['write-code', 'fix-bugs']);
    });

    it('should log agent termination', () => {
      logger.logAgentTerminated('agent-1', AgentRole.DEVELOPER, 'task completed');

      const logs = logger.getAllLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].eventType).toBe(AuditEventType.AGENT_TERMINATED);
      expect(logs[0].details.reason).toBe('task completed');
    });
  });

  describe('Message Logging', () => {
    it('should log message sent', () => {
      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-1',
        to: 'agent-2',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      logger.logMessageSent(message, AgentRole.DEVELOPER);

      const logs = logger.getAllLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].eventType).toBe(AuditEventType.MESSAGE_SENT);
      expect(logs[0].details.messageId).toBe('msg-1');
      expect(logs[0].details.to).toBe('agent-2');
    });

    it('should log message received', () => {
      const message: AgentMessage = {
        id: 'msg-2',
        from: 'agent-1',
        to: 'agent-2',
        type: 'response',
        priority: 'high',
        payload: {},
        timestamp: new Date(),
        acknowledged: true,
      };

      logger.logMessageReceived(message, AgentRole.QA_ENGINEER);

      const logs = logger.getAllLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].eventType).toBe(AuditEventType.MESSAGE_RECEIVED);
      expect(logs[0].agentId).toBe('agent-2');
    });

    it('should log message failure', () => {
      const message: AgentMessage = {
        id: 'msg-3',
        from: 'agent-1',
        to: 'agent-2',
        type: 'request',
        priority: 'critical',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
        retryCount: 3,
      };

      logger.logMessageFailed(message, AgentRole.DEVELOPER, 'Agent offline');

      const logs = logger.getAllLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].eventType).toBe(AuditEventType.MESSAGE_FAILED);
      expect(logs[0].severity).toBe(AuditSeverity.ERROR);
      expect(logs[0].details.error).toBe('Agent offline');
    });
  });

  describe('File Operation Logging', () => {
    it('should log file creation', () => {
      logger.logFileOperation('agent-1', AgentRole.DEVELOPER, 'create', 'src/test.ts', true);

      const logs = logger.getAllLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].eventType).toBe(AuditEventType.FILE_CREATED);
      expect(logs[0].details.filePath).toBe('src/test.ts');
      expect(logs[0].details.success).toBe(true);
    });

    it('should log file modification', () => {
      logger.logFileOperation('agent-1', AgentRole.DEVELOPER, 'modify', 'src/test.ts', true);

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.FILE_MODIFIED);
    });

    it('should log file deletion', () => {
      logger.logFileOperation('agent-1', AgentRole.DEVELOPER, 'delete', 'src/test.ts', true);

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.FILE_DELETED);
    });

    it('should log file read', () => {
      logger.logFileOperation('agent-1', AgentRole.DEVELOPER, 'read', 'src/test.ts', true);

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.FILE_READ);
    });

    it('should log file operation failure', () => {
      logger.logFileOperation(
        'agent-1',
        AgentRole.DEVELOPER,
        'create',
        'src/test.ts',
        false,
        'Permission denied'
      );

      const logs = logger.getAllLogs();
      expect(logs[0].severity).toBe(AuditSeverity.ERROR);
      expect(logs[0].details.error).toBe('Permission denied');
    });
  });

  describe('Authentication Logging', () => {
    it('should log successful authentication', () => {
      logger.logAuthentication('agent-1', AgentRole.DEVELOPER, true);

      const logs = logger.getAllLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].eventType).toBe(AuditEventType.AUTHENTICATION_SUCCESS);
      expect(logs[0].severity).toBe(AuditSeverity.INFO);
    });

    it('should log failed authentication', () => {
      logger.logAuthentication('agent-1', AgentRole.DEVELOPER, false, 'Invalid token');

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.AUTHENTICATION_FAILURE);
      expect(logs[0].severity).toBe(AuditSeverity.WARNING);
      expect(logs[0].details.reason).toBe('Invalid token');
    });

    it('should log token generation', () => {
      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
      logger.logTokenGenerated('agent-1', AgentRole.DEVELOPER, expiresAt);

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.TOKEN_GENERATED);
      expect(logs[0].details.expiresAt).toBe(expiresAt.toISOString());
    });

    it('should log token refresh', () => {
      const newExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
      logger.logTokenRefreshed('agent-1', AgentRole.DEVELOPER, newExpiresAt);

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.TOKEN_REFRESHED);
    });
  });

  describe('Permission Denial Logging', () => {
    it('should log permission denial', () => {
      const denial: AuthorizationDenial = {
        agentId: 'agent-1',
        role: AgentRole.DEVELOPER,
        action: 'deploy',
        timestamp: new Date(),
        reason: 'Role developer not authorized for action: deploy',
      };

      logger.logPermissionDenied(denial);

      const logs = logger.getAllLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].eventType).toBe(AuditEventType.PERMISSION_DENIED);
      expect(logs[0].severity).toBe(AuditSeverity.WARNING);
      expect(logs[0].action).toBe('deploy');
    });
  });

  describe('Quality Gate Logging', () => {
    it('should log quality gate pass', () => {
      logger.logQualityGate('agent-1', AgentRole.DEVELOPER, 'tests-passing', true, {
        coverage: 85,
      });

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.QUALITY_GATE_PASSED);
      expect(logs[0].severity).toBe(AuditSeverity.INFO);
      expect(logs[0].details.coverage).toBe(85);
    });

    it('should log quality gate failure', () => {
      logger.logQualityGate('agent-1', AgentRole.DEVELOPER, 'tests-passing', false, {
        failedTests: 3,
      });

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.QUALITY_GATE_FAILED);
      expect(logs[0].severity).toBe(AuditSeverity.WARNING);
    });
  });

  describe('Escalation Logging', () => {
    it('should log escalation created', () => {
      logger.logEscalation('agent-1', AgentRole.DEVELOPER, 'created', {
        reason: 'Blocked on dependency',
      });

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.ESCALATION_CREATED);
      expect(logs[0].severity).toBe(AuditSeverity.WARNING);
    });

    it('should log escalation resolved', () => {
      logger.logEscalation('agent-1', AgentRole.DEVELOPER, 'resolved', {
        resolution: 'Dependency provided',
      });

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.ESCALATION_RESOLVED);
    });
  });

  describe('Conflict Logging', () => {
    it('should log conflict detected', () => {
      logger.logConflict('agent-1', AgentRole.DEVELOPER, 'detected', {
        file: 'src/test.ts',
        conflictWith: 'agent-2',
      });

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.CONFLICT_DETECTED);
      expect(logs[0].severity).toBe(AuditSeverity.WARNING);
    });

    it('should log conflict resolved', () => {
      logger.logConflict('agent-1', AgentRole.DEVELOPER, 'resolved', {
        resolution: 'Auto-merged',
      });

      const logs = logger.getAllLogs();
      expect(logs[0].eventType).toBe(AuditEventType.CONFLICT_RESOLVED);
      expect(logs[0].severity).toBe(AuditSeverity.INFO);
    });
  });

  describe('PII Redaction', () => {
    it('should redact email addresses', () => {
      logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        'agent-1',
        AgentRole.DEVELOPER,
        'test',
        {
          message: 'Contact user@example.com for details',
        }
      );

      const logs = logger.getAllLogs();
      expect(logs[0].details.message).toBe('Contact [EMAIL_REDACTED] for details');
    });

    it('should redact phone numbers', () => {
      logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        'agent-1',
        AgentRole.DEVELOPER,
        'test',
        {
          message: 'Call 555-123-4567 for support',
        }
      );

      const logs = logger.getAllLogs();
      expect(logs[0].details.message).toBe('Call [PHONE_REDACTED] for support');
    });

    it('should redact SSN', () => {
      logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        'agent-1',
        AgentRole.DEVELOPER,
        'test',
        {
          message: 'SSN: 123-45-6789',
        }
      );

      const logs = logger.getAllLogs();
      expect(logs[0].details.message).toBe('SSN: [SSN_REDACTED]');
    });

    it('should redact credit card numbers', () => {
      logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        'agent-1',
        AgentRole.DEVELOPER,
        'test',
        {
          message: 'Card: 1234-5678-9012-3456',
        }
      );

      const logs = logger.getAllLogs();
      expect(logs[0].details.message).toBe('Card: [CC_REDACTED]');
    });

    it('should redact sensitive field names', () => {
      logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        'agent-1',
        AgentRole.DEVELOPER,
        'test',
        {
          password: 'secret123',
          apiKey: 'key-abc-123',
          token: 'jwt-token-here',
        }
      );

      const logs = logger.getAllLogs();
      expect(logs[0].details.password).toBe('[REDACTED]');
      expect(logs[0].details.apiKey).toBe('[REDACTED]');
      expect(logs[0].details.token).toBe('[REDACTED]');
    });

    it('should redact nested sensitive data', () => {
      logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        'agent-1',
        AgentRole.DEVELOPER,
        'test',
        {
          user: {
            name: 'John',
            password: 'secret',
            email: 'john@example.com',
          },
        }
      );

      const logs = logger.getAllLogs();
      const user = logs[0].details.user as Record<string, unknown>;
      expect(user.password).toBe('[REDACTED]');
      expect(user.email).toBe('[EMAIL_REDACTED]');
    });

    it('should not redact when PII redaction is disabled', () => {
      const noRedactLogger = new AuditLogger({
        enableConsoleOutput: false,
        redactPII: false,
      });

      noRedactLogger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        'agent-1',
        AgentRole.DEVELOPER,
        'test',
        {
          email: 'user@example.com',
        }
      );

      const logs = noRedactLogger.getAllLogs();
      expect(logs[0].details.email).toBe('user@example.com');
    });
  });

  describe('Query and Filtering', () => {
    beforeEach(() => {
      logger.logAgentSpawned('agent-1', AgentRole.DEVELOPER, []);
      logger.logAgentSpawned('agent-2', AgentRole.QA_ENGINEER, []);
      logger.logPermissionDenied({
        agentId: 'agent-1',
        role: AgentRole.DEVELOPER,
        action: 'deploy',
        timestamp: new Date(),
        reason: 'Not authorized',
      });
    });

    it('should query logs by agent ID', () => {
      const logs = logger.query({ agentId: 'agent-1' });
      expect(logs.length).toBe(2);
      expect(logs.every((log) => log.agentId === 'agent-1')).toBe(true);
    });

    it('should query logs by role', () => {
      const logs = logger.query({ agentRole: AgentRole.DEVELOPER });
      expect(logs.length).toBe(2);
      expect(logs.every((log) => log.agentRole === AgentRole.DEVELOPER)).toBe(true);
    });

    it('should query logs by event type', () => {
      const logs = logger.query({ eventType: AuditEventType.AGENT_SPAWNED });
      expect(logs.length).toBe(2);
    });

    it('should query logs by severity', () => {
      const logs = logger.query({ severity: AuditSeverity.WARNING });
      expect(logs.length).toBe(1);
    });

    it('should get logs by agent', () => {
      const logs = logger.getLogsByAgent('agent-2');
      expect(logs.length).toBe(1);
      expect(logs[0].agentId).toBe('agent-2');
    });

    it('should get logs by event type', () => {
      const logs = logger.getLogsByEventType(AuditEventType.PERMISSION_DENIED);
      expect(logs.length).toBe(1);
    });

    it('should get logs by severity', () => {
      const logs = logger.getLogsBySeverity(AuditSeverity.INFO);
      expect(logs.length).toBe(2);
    });

    it('should get recent logs', () => {
      const logs = logger.getRecentLogs(2);
      expect(logs.length).toBe(2);
    });
  });

  describe('Log Management', () => {
    it('should limit logs to max entries', () => {
      const smallLogger = new AuditLogger({
        enableConsoleOutput: false,
        maxEntries: 5,
      });

      for (let i = 0; i < 10; i++) {
        smallLogger.log(
          AuditEventType.ACTION_PERFORMED,
          AuditSeverity.INFO,
          `agent-${i}`,
          AgentRole.DEVELOPER,
          'test'
        );
      }

      const logs = smallLogger.getAllLogs();
      expect(logs.length).toBe(5);
    });

    it('should clear all logs', () => {
      logger.logAgentSpawned('agent-1', AgentRole.DEVELOPER, []);
      expect(logger.getAllLogs().length).toBe(1);

      logger.clearLogs();
      expect(logger.getAllLogs().length).toBe(0);
    });

    it('should export logs as JSON', () => {
      logger.logAgentSpawned('agent-1', AgentRole.DEVELOPER, []);

      const json = logger.exportLogs();
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      logger.logAgentSpawned('agent-1', AgentRole.DEVELOPER, []);
      logger.logAgentSpawned('agent-2', AgentRole.QA_ENGINEER, []);
      logger.logPermissionDenied({
        agentId: 'agent-1',
        role: AgentRole.DEVELOPER,
        action: 'deploy',
        timestamp: new Date(),
        reason: 'Not authorized',
      });
    });

    it('should get log statistics', () => {
      const stats = logger.getStatistics();

      expect(stats.totalLogs).toBe(3);
      expect(stats.byEventType[AuditEventType.AGENT_SPAWNED]).toBe(2);
      expect(stats.byEventType[AuditEventType.PERMISSION_DENIED]).toBe(1);
      expect(stats.bySeverity[AuditSeverity.INFO]).toBe(2);
      expect(stats.bySeverity[AuditSeverity.WARNING]).toBe(1);
      expect(stats.byAgent['agent-1']).toBe(2);
      expect(stats.byAgent['agent-2']).toBe(1);
    });
  });
});
