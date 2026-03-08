/**
 * Example: Comprehensive Logging
 *
 * This example demonstrates the structured logging system with:
 * - Infrastructure initialization logging
 * - Agent spawning logging
 * - Message passing logging
 * - Workflow trigger logging
 * - Quality gate logging
 * - File lock logging
 * - Error logging with full context
 */

import { getLogger, LogLevel, LogFormat } from '../lib/logger';

async function main() {
  const logger = getLogger();

  // Configure logger
  logger.setLevel(LogLevel.INFO);
  logger.setFormat(LogFormat.TEXT);

  console.log('=== Comprehensive Logging Example ===\n');

  // 1. Infrastructure Initialization Logging
  console.log('1. Infrastructure Initialization:');
  logger.logInfrastructureInit('MessageBus', 5);
  logger.logInfrastructureInit('AgentRegistry', 3);
  logger.logInfrastructureInit('SharedContext', 4);
  logger.logInfrastructureInit('Complete', 12, 'success');
  console.log('');

  // 2. Agent Spawning Logging
  console.log('2. Agent Spawning:');
  const corrId1 = logger.generateCorrelationId();
  logger.logAgentSpawn('tech-lead-1', 'tech-lead', undefined, corrId1);
  logger.logAgentSpawn('developer-1', 'developer', 'tech-lead-1', corrId1);
  logger.logAgentSpawn('developer-2', 'developer', 'tech-lead-1', corrId1);
  console.log('');

  // 3. Message Passing Logging
  console.log('3. Message Passing:');
  const corrId2 = logger.generateCorrelationId();
  logger.logMessageSend('tech-lead-1', 'developer-1', 'request', 'high', 'msg-1', corrId2);
  logger.logMessageSend('developer-1', 'tech-lead-1', 'response', 'normal', 'msg-2', corrId2);
  logger.logMessageSend('developer-1', 'tech-lead-1', 'escalation', 'critical', 'msg-3', corrId2);
  console.log('');

  // 4. Workflow Trigger Logging
  console.log('4. Workflow Triggers:');
  const corrId3 = logger.generateCorrelationId();
  logger.logWorkflowTrigger('feature-complete', 'trigger-qa', ['test-feature'], corrId3);
  logger.logWorkflowTrigger('test-failure', 'trigger-bugfix', ['fix-bug'], corrId3);
  console.log('');

  // 5. Quality Gate Logging
  console.log('5. Quality Gates:');
  const corrId4 = logger.generateCorrelationId();
  logger.logQualityGates('developer-1', 6, undefined, undefined, corrId4);
  // Simulate gate execution
  await new Promise((resolve) => setTimeout(resolve, 100));
  logger.logQualityGates('developer-1', 6, { passed: 5, failed: 1 }, 150, corrId4);
  console.log('');

  // 6. File Lock Logging
  console.log('6. File Locking:');
  const corrId5 = logger.generateCorrelationId();
  logger.logFileLock('developer-1', 'acquired', 'src/auth.ts', 'write', corrId5);
  logger.logFileLock('developer-2', 'failed', 'src/auth.ts', 'write', corrId5);
  logger.logFileLock('developer-1', 'released', 'src/auth.ts', 'write', corrId5);
  logger.logFileLock('developer-2', 'acquired', 'src/auth.ts', 'write', corrId5);
  console.log('');

  // 7. Error Logging
  console.log('7. Error Logging:');
  const error = new Error('Connection timeout');
  logger.logError('MessageBus', 'Message delivery failed: No handlers for agent-123', error, {
    messageId: 'msg-456',
    from: 'tech-lead-1',
    to: 'agent-123',
    retryCount: 3,
  });
  console.log('');

  // 8. Query Logs
  console.log('8. Log Queries:');
  console.log(`Total logs: ${logger.getLogCount()}`);
  console.log(`Infrastructure logs: ${logger.getLogsByCategory('Infrastructure').length}`);
  console.log(`Agent spawn logs: ${logger.getLogsByCategory('AgentSpawn').length}`);
  console.log(`Message logs: ${logger.getLogsByCategory('Message').length}`);
  console.log(`Workflow logs: ${logger.getLogsByCategory('Workflow').length}`);
  console.log(`Quality gate logs: ${logger.getLogsByCategory('QualityGates').length}`);
  console.log(`File lock logs: ${logger.getLogsByCategory('FileLock').length}`);
  console.log(`Error logs: ${logger.getLogsByLevel(LogLevel.ERROR).length}`);
  console.log('');

  // 9. Correlation ID Tracking
  console.log('9. Correlation ID Tracking:');
  console.log(`Logs for correlation ${corrId1}: ${logger.getLogsByCorrelationId(corrId1).length}`);
  console.log(`Logs for correlation ${corrId2}: ${logger.getLogsByCorrelationId(corrId2).length}`);
  console.log('');

  // 10. Environment Configuration
  console.log('10. Configuration:');
  const config = logger.getConfig();
  console.log(`Log Level: ${LogLevel[config.level]}`);
  console.log(`Log Format: ${config.format}`);
  console.log(`Console Output: ${config.enableConsole}`);
  console.log('');

  console.log('=== Example Complete ===');
  console.log('\nTo change log level: export MULTI_AGENT_LOG_LEVEL=DEBUG');
  console.log('To change log format: export MULTI_AGENT_LOG_FORMAT=json');
}

// Run example
main().catch(console.error);
