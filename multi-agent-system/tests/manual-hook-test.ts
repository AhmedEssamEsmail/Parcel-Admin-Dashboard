/**
 * Manual test to verify MessageBus hooks are working
 * Run with: npx tsx multi-agent-system/tests/manual-hook-test.ts
 */

import { InfrastructureManager } from '../lib/infrastructure-manager';
import { AgentMessage } from '../lib/types';
import { AgentRole } from '../lib/agent-definition-schema';

async function testMessageHooks() {
  console.log('=== Testing MessageBus Hooks ===\n');

  // Get infrastructure
  const infra = InfrastructureManager.getInstance();
  const messageBus = infra.getMessageBus();
  const invocationManager = infra.getInvocationManager();

  // Track callback invocations
  let onMessageCount = 0;
  let onEscalateCount = 0;
  let onCompleteCount = 0;

  // Spawn an agent with callbacks
  console.log('1. Spawning agent with callbacks...');
  const result = await invocationManager.invokeSubAgent({
    role: AgentRole.DEVELOPER,
    task: 'Test task',
    parentAgent: 'test-parent',
    onMessage: async (message: AgentMessage) => {
      onMessageCount++;
      console.log(`   ✓ onMessage callback invoked! (count: ${onMessageCount})`);
      console.log(`     Message: ${message.from} → ${message.to} (${message.type})`);
    },
    onEscalate: async (escalation) => {
      onEscalateCount++;
      console.log(`   ✓ onEscalate callback invoked! (count: ${onEscalateCount})`);
      console.log(`     Escalation: ${escalation.reason}`);
    },
    onComplete: async (result) => {
      onCompleteCount++;
      console.log(`   ✓ onComplete callback invoked! (count: ${onCompleteCount})`);
      console.log(`     Result: ${result.success ? 'success' : 'failed'}`);
    },
  });

  if (!result.success) {
    console.error('Failed to spawn agent:', result.error);
    return;
  }

  const agentId = result.agentId;
  console.log(`   Agent spawned: ${agentId}\n`);

  // Test 1: Send a regular message FROM the agent
  console.log('2. Sending regular message from agent...');
  await messageBus.send({
    id: 'msg-1',
    from: agentId,
    to: 'test-recipient',
    type: 'request',
    priority: 'normal',
    payload: { action: 'test' },
    timestamp: new Date(),
    acknowledged: false,
  });

  // Wait a bit for async processing
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Test 2: Send an escalation message FROM the agent
  console.log('\n3. Sending escalation message from agent...');
  await messageBus.send({
    id: 'msg-2',
    from: agentId,
    to: 'test-parent',
    type: 'escalation',
    priority: 'critical',
    payload: {
      action: 'escalation',
      context: {
        escalation: {
          agentId,
          role: 'developer',
          reason: 'Test escalation',
          issue: 'Test issue',
          context: {},
          attemptedSolutions: [],
          severity: 'high',
          timestamp: new Date(),
        },
      },
    },
    timestamp: new Date(),
    acknowledged: false,
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  // Test 3: Send a completion notification FROM the agent
  console.log('\n4. Sending completion notification from agent...');
  await messageBus.send({
    id: 'msg-3',
    from: agentId,
    to: 'test-parent',
    type: 'notification',
    priority: 'high',
    payload: {
      action: 'work-complete',
      result: 'Task completed',
      context: {},
    },
    timestamp: new Date(),
    acknowledged: false,
  });

  await new Promise((resolve) => setTimeout(resolve, 100));

  // Print results
  console.log('\n=== Test Results ===');
  console.log(`onMessage invocations: ${onMessageCount} (expected: 3)`);
  console.log(`onEscalate invocations: ${onEscalateCount} (expected: 1)`);
  console.log(`onComplete invocations: ${onCompleteCount} (expected: 1)`);

  const allPassed = onMessageCount === 3 && onEscalateCount === 1 && onCompleteCount === 1;

  if (allPassed) {
    console.log('\n✅ ALL TESTS PASSED!');
  } else {
    console.log('\n❌ SOME TESTS FAILED!');
    if (onMessageCount !== 3) {
      console.log(`   - onMessage: expected 3, got ${onMessageCount}`);
    }
    if (onEscalateCount !== 1) {
      console.log(`   - onEscalate: expected 1, got ${onEscalateCount}`);
    }
    if (onCompleteCount !== 1) {
      console.log(`   - onComplete: expected 1, got ${onCompleteCount}`);
    }
  }

  // Cleanup
  InfrastructureManager.reset();
}

testMessageHooks().catch(console.error);
