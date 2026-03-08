/**
 * Simple test script to verify the plugin loads and initializes correctly
 */

import plugin from './index';

async function testPlugin() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║     Multi-Agent Orchestration Plugin Test                 ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('Plugin Info:');
  console.log(`  Name: ${plugin.name}`);
  console.log(`  Version: ${plugin.version}`);
  console.log(`  Description: ${plugin.description}`);
  console.log(`  Enabled: ${plugin.isEnabled()}\n`);

  // Test 1: Initialize on Kiro start
  console.log('============================================================');
  console.log('  Test 1: onKiroStart()');
  console.log('============================================================\n');

  try {
    await plugin.onKiroStart();
    console.log('✅ Plugin initialized successfully\n');
  } catch (error) {
    console.error('❌ Plugin initialization failed:', error);
    process.exit(1);
  }

  // Test 2: Spawn an agent
  console.log('============================================================');
  console.log('  Test 2: beforeAgentSpawn()');
  console.log('============================================================\n');

  try {
    const config = await plugin.beforeAgentSpawn('test-agent-1', 'developer', {
      parentId: undefined,
    });

    console.log('✅ Agent spawned successfully');
    console.log(`  AgentContext injected: ${!!config.agentContext}`);
    console.log(`  Agent ID: ${config.agentContext?.agentId}`);
    console.log(`  Agent Role: ${config.agentContext?.role}\n`);
  } catch (error) {
    console.error('❌ Agent spawn failed:', error);
    process.exit(1);
  }

  // Test 3: Complete an agent
  console.log('============================================================');
  console.log('  Test 3: afterAgentComplete()');
  console.log('============================================================\n');

  try {
    await plugin.afterAgentComplete('test-agent-1', {
      status: 'success',
      filesModified: ['src/test.ts'],
    });
    console.log('✅ Agent completion handled successfully\n');
  } catch (error) {
    console.error('❌ Agent completion failed:', error);
    process.exit(1);
  }

  // Test 4: Handle agent failure
  console.log('============================================================');
  console.log('  Test 4: onAgentFail()');
  console.log('============================================================\n');

  try {
    await plugin.onAgentFail('test-agent-1', new Error('Test error'));
    console.log('✅ Agent failure handled successfully\n');
  } catch (error) {
    console.error('❌ Agent failure handling failed:', error);
    process.exit(1);
  }

  // Test 5: Get infrastructure status
  console.log('============================================================');
  console.log('  Test 5: Infrastructure Status');
  console.log('============================================================\n');

  try {
    const kiroIntegration = plugin.getKiroIntegration();
    const infrastructure = kiroIntegration.getInfrastructure();
    const status = infrastructure.getStatus();

    console.log('Infrastructure Status:');
    console.log(`  Message Bus:`);
    console.log(`    - Queue Depth: ${status.messageBus.queueDepth}`);
    console.log(`    - Dead Letter Queue: ${status.messageBus.deadLetterQueueSize}`);
    console.log(`  Agent Registry:`);
    console.log(`    - Total Agents: ${status.agentRegistry.totalAgents}`);
    console.log(`    - Active Agents: ${status.agentRegistry.activeAgents}`);
    console.log(`  Shared Context:`);
    console.log(`    - Work Items: ${status.sharedContext.workItems}`);
    console.log(`    - File Locks: ${status.sharedContext.fileLocks}`);
    console.log(`  Workflow Engine:`);
    console.log(`    - Rules Registered: ${status.workflowEngine.rulesRegistered}`);
    console.log(`  Quality Gates:`);
    console.log(`    - Gates Registered: ${status.qualityGates.gatesRegistered}`);
    console.log(`  Agent Hierarchy:`);
    console.log(`    - Total Agents: ${status.agentHierarchy.totalAgents}`);
    console.log(`    - Root Agents: ${status.agentHierarchy.rootAgents}`);
    console.log(`    - Max Depth: ${status.agentHierarchy.maxDepth}`);
    console.log(`    - Avg Children: ${status.agentHierarchy.avgChildren.toFixed(2)}\n`);

    console.log('✅ Infrastructure status retrieved successfully\n');
  } catch (error) {
    console.error('❌ Failed to get infrastructure status:', error);
    process.exit(1);
  }

  console.log('============================================================');
  console.log('  All Tests Passed ✅');
  console.log('============================================================\n');

  console.log('✅ Plugin is ready to be loaded by Kiro\n');

  // Cleanup: Stop periodic sync to allow script to exit
  console.log('Cleaning up resources...');
  const kiroIntegration = plugin.getKiroIntegration();
  const infrastructure = kiroIntegration.getInfrastructure();
  infrastructure.getSharedContext().destroy();
  console.log('✅ Cleanup complete\n');

  // Force exit since there may be other timers
  process.exit(0);
}

// Run tests
testPlugin().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
