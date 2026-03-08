# Multi-Agent Infrastructure Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the multi-agent orchestration infrastructure.

## Table of Contents

1. [Quick Diagnostics Checklist](#quick-diagnostics-checklist)
2. [Common Issues and Solutions](#common-issues-and-solutions)
3. [Error Message Reference](#error-message-reference)
4. [Debugging Tools and Commands](#debugging-tools-and-commands)
5. [Performance Tuning Guide](#performance-tuning-guide)
6. [Advanced Troubleshooting](#advanced-troubleshooting)
7. [Getting Help](#getting-help)

---

## Quick Diagnostics Checklist

Use this checklist to quickly identify infrastructure issues:

### Infrastructure Status

```typescript
// Check if infrastructure is initialized
const infrastructure = InfrastructureManager.getInstance();
const status = infrastructure.getStatus();

console.log('Infrastructure Status:', JSON.stringify(status, null, 2));
```

**Expected Output** (Healthy System):

```json
{
  "messageBus": {
    "queueDepth": 0,
    "deadLetterQueueSize": 0
  },
  "agentRegistry": {
    "totalAgents": 3,
    "activeAgents": 3
  },
  "sharedContext": {
    "workItems": 5,
    "fileLocks": 0
  },
  "workflowEngine": {
    "rulesRegistered": 8
  },
  "qualityGates": {
    "gatesRegistered": 5
  },
  "agentHierarchy": {
    "totalAgents": 3,
    "rootAgents": 1,
    "maxDepth": 2,
    "avgChildren": 1.5
  }
}
```

**Red Flags** (Issues Detected):

- ❌ `queueDepth > 100`: Message backlog, agents not processing messages
- ❌ `deadLetterQueueSize > 0`: Messages failing to deliver
- ❌ `activeAgents = 0`: No agents running
- ❌ `fileLocks > 10`: Possible lock contention or leaks
- ❌ `maxDepth > 5`: Deep hierarchy, possible infinite spawning

### Agent Registration Check

```typescript
// Check if agent is registered
const agentContext = config.agentContext;

if (!agentContext) {
  console.error('❌ AgentContext not injected');
} else {
  console.log('✅ AgentContext available');
  console.log('Agent ID:', agentContext.getAgentId());
  console.log('Agent Role:', agentContext.getRole());
}
```

### Message Queue Check

```typescript
// Check message queue depth
const messageBus = infrastructure.getMessageBus();
const queueSize = messageBus.getQueueSize();

if (queueSize > 50) {
  console.warn('⚠️ High message queue depth:', queueSize);
}
```

### File Lock Check

```typescript
// Check for stuck file locks
const sharedContext = infrastructure.getSharedContext();
const allAgents = infrastructure.getAgentRegistry().getAllAgents();

for (const agent of allAgents) {
  const locks = sharedContext.getAgentLocks(agent.id);
  if (locks.length > 0) {
    console.log(`Agent ${agent.id} holds ${locks.length} locks:`, locks);
  }
}
```

---

## Common Issues and Solutions

### Issue 1: Infrastructure Not Initializing

**Symptoms**:

- Error: "Infrastructure not initialized"
- AgentContext is undefined
- No agents registered

**Causes**:

1. KiroIntegration.initializeSession() not called
2. Plugin not loaded by Kiro
3. Feature flag disabled

**Solutions**:

**Solution 1: Verify Plugin is Loaded**

```bash
# Check if plugin exists
ls -la kiro-plugins/multi-agent-orchestration/

# Should show: index.ts, README.md, package.json
```

**Solution 2: Check Feature Flag**

```bash
# Check environment variable
echo $ENABLE_MULTI_AGENT_INFRASTRUCTURE

# Should output: true (or empty, defaults to true)
```

If disabled, enable it:

```bash
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=true
```

**Solution 3: Manually Initialize**

```typescript
// In your code, before spawning agents
const integration = new KiroIntegration();
await integration.initializeSession();

// Verify initialization
const infrastructure = integration.getInfrastructure();
console.log('Infrastructure initialized:', infrastructure !== null);
```

**Solution 4: Check Logs**

```bash
# Look for initialization logs
# Should see: "[InfrastructureManager] Initializing multi-agent infrastructure..."
# Should see: "[InfrastructureManager] Infrastructure initialized successfully"
```

If you see errors in logs, check the error message for specific issues.

---

### Issue 2: AgentContext Undefined in Spawned Agents

**Symptoms**:

- `config.agentContext` is undefined
- Cannot call agentContext methods
- Agent cannot access infrastructure

**Causes**:

1. KiroIntegration.onAgentSpawn() not called
2. AgentContext not injected into config
3. Infrastructure not initialized before spawn

**Solutions**:

**Solution 1: Verify Lifecycle Hook**

```typescript
// In KiroIntegration or plugin
const agentContext = await integration.onAgentSpawn(agentId, role, parentId);

// Inject into config
config.agentContext = agentContext;

// Return modified config
return config;
```

**Solution 2: Check Agent Config**

```typescript
// In agent execution
console.log('Config keys:', Object.keys(config));
console.log('Has agentContext:', 'agentContext' in config);

if (!config.agentContext) {
  console.error('AgentContext not injected - infrastructure unavailable');
  // Fallback to direct invocation
}
```

**Solution 3: Verify Infrastructure Initialized**

```typescript
// Before spawning agents
const infrastructure = InfrastructureManager.getInstance();
const status = infrastructure.getStatus();

if (status.agentRegistry.totalAgents === 0) {
  console.log('Infrastructure ready for agent spawning');
}
```

**Solution 4: Enable Debug Logging**

```bash
export MULTI_AGENT_LOG_LEVEL=debug
```

Look for logs:

- `[KiroIntegration] Creating AgentContext for agent-id`
- `[AgentRegistry] Registering agent: agent-id`

---

### Issue 3: Messages Not Being Delivered

**Symptoms**:

- `onMessage()` callback never fires
- Messages sent but not received
- High dead letter queue size

**Causes**:

1. Recipient agent not subscribed to messages
2. Communication permissions not set
3. Message delivery failure
4. Recipient agent ID incorrect

**Solutions**:

**Solution 1: Verify Subscription**

```typescript
// Recipient agent must subscribe
agentContext.onMessage((message) => {
  console.log('Received message:', message);
  // Process message
});

// Verify subscription
console.log('Subscribed to messages for:', agentContext.getAgentId());
```

**Solution 2: Check Communication Permissions**

```typescript
// Check if sender can communicate with recipient
const registry = agentContext.getAgentRegistry();
const sender = registry.getAgent(senderId);
const recipient = registry.getAgent(recipientId);

console.log('Sender:', sender?.id, 'Role:', sender?.role);
console.log('Recipient:', recipient?.id, 'Role:', recipient?.role);

// Check permissions (implementation-specific)
// Agents can communicate with tech-lead and help agents
```

**Solution 3: Check Dead Letter Queue**

```typescript
const messageBus = infrastructure.getMessageBus();
const deadLetters = messageBus.getDeadLetterQueue();

if (deadLetters.length > 0) {
  console.error('Failed messages:', deadLetters);

  for (const msg of deadLetters) {
    console.log('Failed:', msg.from, '→', msg.to);
    console.log('Reason:', msg.error);
  }
}
```

**Solution 4: Verify Agent IDs**

```typescript
// List all registered agents
const allAgents = registry.getAllAgents();
console.log(
  'Registered agents:',
  allAgents.map((a) => a.id)
);

// Check if recipient exists
const recipient = registry.getAgent(recipientId);
if (!recipient) {
  console.error('Recipient not found:', recipientId);
}
```

**Solution 5: Test Message Delivery**

```typescript
// Send test message
await agentContext.sendMessage(recipientId, {
  type: 'notification',
  priority: 'high',
  payload: { test: true },
});

// Check queue
const queueSize = messageBus.getQueueSize();
console.log('Messages in queue:', queueSize);

// Wait for delivery
await new Promise((resolve) => setTimeout(resolve, 100));

// Check if delivered
const messages = await recipientContext.getMessages();
console.log('Recipient messages:', messages.length);
```

---

### Issue 4: File Locks Timing Out

**Symptoms**:

- `acquireFileLock()` throws TimeoutError
- Agents blocked waiting for locks
- High file lock count in status

**Causes**:

1. Another agent holds the lock
2. Lock not released after use
3. Agent crashed while holding lock
4. Timeout too short for operation

**Solutions**:

**Solution 1: Check Lock Holder**

```typescript
try {
  const locked = await agentContext.acquireFileLock('src/auth.ts', 'write', 5000);
} catch (error) {
  if (error.message.includes('Timeout')) {
    // Check who holds the lock
    const sharedContext = agentContext.getSharedContext();
    const locks = sharedContext.getAllLocks();

    const authLock = locks.find((l) => l.file === 'src/auth.ts');
    if (authLock) {
      console.error('Lock held by:', authLock.agentId);
      console.error('Lock mode:', authLock.mode);
      console.error('Acquired at:', authLock.acquiredAt);

      // Check if agent is still active
      const holder = agentContext.getAgent(authLock.agentId);
      console.log('Holder status:', holder?.status);
    }
  }
}
```

**Solution 2: Increase Timeout**

```typescript
// Increase timeout for long operations
const locked = await agentContext.acquireFileLock(
  'src/auth.ts',
  'write',
  30000 // 30 seconds instead of default 5 seconds
);
```

**Solution 3: Use Read Locks for Reading**

```typescript
// Multiple agents can hold read locks simultaneously
const locked = await agentContext.acquireFileLock('src/auth.ts', 'read', 5000);

// Read file
const content = await readFile('src/auth.ts');

// Release lock
agentContext.releaseFileLock('src/auth.ts');
```

**Solution 4: Always Release Locks**

```typescript
// Use try-finally to ensure lock is released
let locked = false;

try {
  locked = await agentContext.acquireFileLock('src/auth.ts', 'write', 5000);

  if (locked) {
    // Edit file
    await editFile('src/auth.ts', changes);
  }
} finally {
  if (locked) {
    agentContext.releaseFileLock('src/auth.ts');
  }
}
```

**Solution 5: Clean Up Stale Locks**

```typescript
// Check for locks held by offline agents
const allAgents = registry.getAllAgents();
const offlineAgents = allAgents.filter((a) => a.status === 'offline');

for (const agent of offlineAgents) {
  const locks = sharedContext.getAgentLocks(agent.id);

  if (locks.length > 0) {
    console.warn(`Offline agent ${agent.id} holds ${locks.length} locks`);

    // Locks should be auto-released on session end
    // If not, this indicates a bug
  }
}
```

---

### Issue 5: Quality Gates Failing Unexpectedly

**Symptoms**:

- Quality gates fail but code seems correct
- Inconsistent gate results
- Gates timeout or hang

**Causes**:

1. Build/test commands not configured
2. Working directory incorrect
3. Dependencies not installed
4. Environment variables missing
5. Gates running in wrong order

**Solutions**:

**Solution 1: Verify Commands Exist**

```bash
# Check package.json scripts
cat package.json | grep -A 10 '"scripts"'

# Should have:
# "build": "...",
# "test:run": "...",
# "lint": "...",
# "type-check": "..."
```

**Solution 2: Test Commands Manually**

```bash
# Run each gate command manually
npm run build
npm run test:run
npm run lint
npm run type-check

# Check exit codes
echo $?  # Should be 0 for success
```

**Solution 3: Check Gate Configuration**

```typescript
const qualityGates = infrastructure.getQualityGates();
const gates = qualityGates.getAllGates();

console.log(
  'Registered gates:',
  gates.map((g) => g.name)
);

// Should include: build, test, lint, type-check
```

**Solution 4: Run Gates with Logging**

```typescript
const result = await agentContext.runQualityGates(workItemId);

console.log('Quality Gates Result:');
console.log('  Passed:', result.passed);
console.log('  Execution time:', result.executionTime, 'ms');

if (!result.passed) {
  console.log('Failed gates:');
  for (const gate of result.failedGates) {
    console.log(`  - ${gate.name}`);
    console.log(`    Error: ${gate.error}`);
    console.log(`    Output: ${gate.output}`);
  }
}
```

**Solution 5: Increase Gate Timeout**

```typescript
// In quality-gates.ts configuration
const gateTimeout = 60000; // 60 seconds instead of default 30 seconds
```

---

### Issue 6: Workflow Rules Not Triggering

**Symptoms**:

- Workflow events fired but no actions execute
- Follow-up agents not spawned
- Workflow automation not working

**Causes**:

1. Workflow rules not registered
2. Event type mismatch
3. Rule conditions not met
4. Workflow engine not initialized

**Solutions**:

**Solution 1: Verify Rules Registered**

```typescript
const workflowEngine = infrastructure.getWorkflowEngine();
const rules = workflowEngine.getRules();

console.log('Registered workflow rules:', rules.length);

for (const rule of rules) {
  console.log(`Rule: ${rule.name}`);
  console.log(`  Event: ${rule.eventType}`);
  console.log(`  Actions: ${rule.actions.length}`);
}
```

**Solution 2: Check Event Type**

```typescript
// Event type must match rule eventType exactly
await agentContext.triggerWorkflowEvent({
  type: 'work-complete', // Must match rule.eventType
  data: {
    workItemId: 'feature-auth',
    agentId: agentContext.getAgentId(),
  },
});
```

**Solution 3: Test Rule Matching**

```typescript
// Manually test if event matches rule
const event = {
  type: 'work-complete',
  source: 'dev-1',
  timestamp: new Date(),
  data: { workItemId: 'feature-auth' },
};

// Check which rules match
for (const rule of rules) {
  if (rule.eventType === event.type) {
    console.log('Rule matches:', rule.name);

    // Check conditions
    if (rule.condition) {
      const matches = rule.condition(event);
      console.log('  Condition met:', matches);
    }
  }
}
```

**Solution 4: Enable Workflow Logging**

```bash
export MULTI_AGENT_LOG_LEVEL=debug
```

Look for logs:

- `[WorkflowEngine] Processing event: work-complete`
- `[WorkflowEngine] Rule matched: feature-to-qa`
- `[WorkflowEngine] Executing action: invoke-agent`

**Solution 5: Register Default Rules**

```typescript
// Register common workflow rules
workflowEngine.registerRule({
  name: 'feature-to-qa',
  eventType: 'work-complete',
  condition: (event) => {
    return event.data?.workItemId?.startsWith('feature-');
  },
  actions: [
    {
      type: 'invoke-agent',
      config: {
        role: 'qa-engineer',
        task: 'test-feature',
      },
    },
  ],
});
```

---

### Issue 7: Agent Hierarchy Not Tracked

**Symptoms**:

- `getChildAgents()` returns empty array
- `getParentAgent()` returns null
- Hierarchy stats show 0 agents

**Causes**:

1. AgentHierarchy not initialized
2. Parent-child relationship not recorded
3. AgentInvocationManager not calling recordRelationship()

**Solutions**:

**Solution 1: Verify Hierarchy Initialized**

```typescript
const hierarchy = infrastructure.getAgentHierarchy();
const stats = hierarchy.getHierarchyStats();

console.log('Hierarchy stats:', stats);
// Should show: totalAgents > 0, rootAgents > 0
```

**Solution 2: Record Relationship on Spawn**

```typescript
// When spawning child agent
const parentId = agentContext.getAgentId();
const childId = 'child-agent-1';

// Record relationship
hierarchy.recordRelationship(parentId, childId);

// Verify
const children = hierarchy.getChildAgents(parentId);
console.log('Children:', children); // Should include childId
```

**Solution 3: Check Parent ID Passed**

```typescript
// When spawning agent, pass parent ID
const agentContext = await integration.onAgentSpawn(
  'child-1',
  'developer',
  'parent-1' // Parent ID must be provided
);

// Verify parent recorded
const parent = agentContext.getParentAgent();
console.log('Parent:', parent); // Should be 'parent-1'
```

**Solution 4: Visualize Hierarchy**

```typescript
const hierarchyTree = hierarchy.getAgentHierarchy();

console.log('Agent Hierarchy:');
console.log(JSON.stringify(hierarchyTree, null, 2));

// Should show tree structure with parent-child relationships
```

---

### Issue 8: Performance Degradation

**Symptoms**:

- Slow message delivery (>100ms)
- High memory usage
- Slow quality gate execution
- System becomes unresponsive

**Causes**:

1. Message queue backlog
2. Too many agents spawned
3. Memory leaks (agents not cleaned up)
4. File locks not released
5. Inefficient workflow rules

**Solutions**:

**Solution 1: Check Message Queue**

```typescript
const status = infrastructure.getStatus();

if (status.messageBus.queueDepth > 100) {
  console.warn('High message queue depth:', status.messageBus.queueDepth);

  // Possible causes:
  // - Agents not processing messages fast enough
  // - Too many messages being sent
  // - Message handlers blocking
}
```

**Solution 2: Limit Agent Spawning**

```typescript
// Check active agent count before spawning
const activeAgents = registry.getAllAgents().filter((a) => a.status !== 'offline');

if (activeAgents.length > 10) {
  console.warn('Too many active agents:', activeAgents.length);
  // Consider waiting for agents to complete before spawning more
}
```

**Solution 3: Clean Up Completed Agents**

```typescript
// Ensure agents are removed from registry after completion
const allAgents = registry.getAllAgents();

for (const agent of allAgents) {
  if (agent.status === 'offline') {
    console.log('Cleaning up offline agent:', agent.id);
    registry.unregisterAgent(agent.id);
  }
}
```

**Solution 4: Monitor Memory Usage**

```typescript
// Check memory usage
const memUsage = process.memoryUsage();

console.log('Memory Usage:');
console.log('  RSS:', Math.round(memUsage.rss / 1024 / 1024), 'MB');
console.log('  Heap Used:', Math.round(memUsage.heapUsed / 1024 / 1024), 'MB');
console.log('  Heap Total:', Math.round(memUsage.heapTotal / 1024 / 1024), 'MB');

// If heap used > 500MB, investigate memory leaks
```

**Solution 5: Profile Quality Gates**

```typescript
const startTime = Date.now();
const result = await agentContext.runQualityGates(workItemId);
const duration = Date.now() - startTime;

console.log('Quality gates execution time:', duration, 'ms');

if (duration > 30000) {
  console.warn('Quality gates too slow');

  // Check individual gate times
  for (const gate of result.passedGates) {
    console.log(`${gate.name}: ${gate.executionTime}ms`);
  }
}
```

---

## Error Message Reference

### Error: "Infrastructure not initialized"

**Cause**: InfrastructureManager.getInstance() not called or initialization failed

**Fix**: Call `await integration.initializeSession()` before spawning agents

**Example**:

```typescript
const integration = new KiroIntegration();
await integration.initializeSession();
```

---

### Error: "AgentContext is undefined"

**Cause**: AgentContext not injected into agent config

**Fix**: Ensure KiroIntegration.onAgentSpawn() is called and returns modified config

**Example**:

```typescript
const agentContext = await integration.onAgentSpawn(agentId, role, parentId);
config.agentContext = agentContext;
```

---

### Error: "Agent not registered"

**Cause**: Agent not found in AgentRegistry

**Fix**: Verify agent was registered during spawn

**Example**:

```typescript
const agent = registry.getAgent(agentId);
if (!agent) {
  console.error('Agent not registered:', agentId);
}
```

---

### Error: "Timeout acquiring file lock"

**Cause**: Another agent holds the lock or lock not released

**Fix**: Check lock holder, increase timeout, or release locks properly

**Example**:

```typescript
try {
  await agentContext.acquireFileLock('file.ts', 'write', 30000);
} catch (error) {
  // Check who holds the lock
  const locks = sharedContext.getAllLocks();
  console.log('Current locks:', locks);
}
```

---

### Error: "Permission denied: cannot communicate with agent"

**Cause**: Communication permissions not set or agent not in allowed list

**Fix**: Verify agent can communicate with recipient (tech-lead or help agents)

**Example**:

```typescript
// Agents can always communicate with tech-lead
await agentContext.sendMessage('tech-lead-1', { payload: {} });
```

---

### Error: "Quality gate failed: build"

**Cause**: Build command failed or not configured

**Fix**: Run `npm run build` manually to see error, fix build issues

**Example**:

```bash
npm run build
# Check output for specific errors
```

---

### Error: "Quality gate failed: test"

**Cause**: Tests failing or test command not configured

**Fix**: Run `npm run test:run` manually to see failures, fix tests

**Example**:

```bash
npm run test:run
# Check which tests are failing
```

---

### Error: "Quality gate failed: lint"

**Cause**: Linting errors in code

**Fix**: Run `npm run lint` manually, fix linting errors

**Example**:

```bash
npm run lint
# Fix reported errors
npm run lint -- --fix  # Auto-fix some errors
```

---

### Error: "Quality gate failed: type-check"

**Cause**: TypeScript type errors

**Fix**: Run `npm run type-check` manually, fix type errors

**Example**:

```bash
npm run type-check
# Fix reported type errors
```

---

### Error: "Workflow rule execution failed"

**Cause**: Error in workflow rule action or condition

**Fix**: Check workflow rule definition, add error handling

**Example**:

```typescript
workflowEngine.registerRule({
  name: 'my-rule',
  eventType: 'work-complete',
  condition: (event) => {
    try {
      return event.data?.workItemId !== undefined;
    } catch (error) {
      console.error('Condition error:', error);
      return false;
    }
  },
  actions: [
    /* ... */
  ],
});
```

---

### Error: "Message delivery failed"

**Cause**: Recipient not found or not subscribed

**Fix**: Verify recipient exists and has subscribed to messages

**Example**:

```typescript
// Recipient must subscribe
agentContext.onMessage((message) => {
  console.log('Received:', message);
});
```

---

### Error: "Work item not found"

**Cause**: Work item ID doesn't exist in SharedContext

**Fix**: Create work item before referencing it

**Example**:

```typescript
const sharedContext = agentContext.getSharedContext();
sharedContext.createWorkItem({
  id: 'feature-auth',
  title: 'Implement authentication',
  status: 'in-progress',
  assignedTo: agentContext.getAgentId(),
});
```

---

### Error: "Parent agent not found"

**Cause**: Parent ID invalid or parent agent terminated

**Fix**: Verify parent agent exists before escalating

**Example**:

```typescript
const parentId = agentContext.getParentAgent();

if (parentId) {
  const parent = agentContext.getAgent(parentId);
  if (parent && parent.status !== 'offline') {
    agentContext.escalateToParent('Need help');
  }
}
```

---

### Error: "Hierarchy depth exceeded"

**Cause**: Too many nested agent spawns (possible infinite recursion)

**Fix**: Limit hierarchy depth, check for infinite spawning

**Example**:

```typescript
const stats = hierarchy.getHierarchyStats();

if (stats.maxDepth > 5) {
  console.error('Hierarchy too deep:', stats.maxDepth);
  // Don't spawn more agents
}
```

---

## Debugging Tools and Commands

### Enable Debug Logging

```bash
# Set log level to debug
export MULTI_AGENT_LOG_LEVEL=debug

# Run your code
npm run dev
```

**Debug logs include**:

- Infrastructure initialization
- Agent registration
- Message sending/receiving
- File lock acquisition/release
- Workflow rule evaluation
- Quality gate execution

---

### Check Infrastructure Status

```typescript
const infrastructure = InfrastructureManager.getInstance();
const status = infrastructure.getStatus();

console.log('Infrastructure Status:');
console.log(JSON.stringify(status, null, 2));
```

**Output includes**:

- Message queue depth
- Dead letter queue size
- Total and active agents
- Work items count
- File locks count
- Workflow rules registered
- Quality gates registered
- Hierarchy statistics

---

### Inspect Message Queue

```typescript
const messageBus = infrastructure.getMessageBus();

// Get queue size
const queueSize = messageBus.getQueueSize();
console.log('Messages in queue:', queueSize);

// Get dead letter queue
const deadLetters = messageBus.getDeadLetterQueue();
console.log('Failed messages:', deadLetters.length);

for (const msg of deadLetters) {
  console.log('Failed:', msg.from, '→', msg.to);
  console.log('Error:', msg.error);
}
```

---

### View Agent Registry

```typescript
const registry = infrastructure.getAgentRegistry();

// Get all agents
const allAgents = registry.getAllAgents();
console.log('Total agents:', allAgents.length);

// Group by status
const byStatus = {
  idle: allAgents.filter((a) => a.status === 'idle'),
  busy: allAgents.filter((a) => a.status === 'busy'),
  blocked: allAgents.filter((a) => a.status === 'blocked'),
  offline: allAgents.filter((a) => a.status === 'offline'),
};

console.log('Agents by status:');
console.log('  Idle:', byStatus.idle.length);
console.log('  Busy:', byStatus.busy.length);
console.log('  Blocked:', byStatus.blocked.length);
console.log('  Offline:', byStatus.offline.length);

// List agents by role
const developers = registry.getAgentsByRole('developer');
const qaEngineers = registry.getAgentsByRole('qa-engineer');

console.log('Developers:', developers.length);
console.log('QA Engineers:', qaEngineers.length);
```

---

### Check File Locks

```typescript
const sharedContext = infrastructure.getSharedContext();

// Get all locks
const allLocks = sharedContext.getAllLocks();
console.log('Total file locks:', allLocks.length);

// Group by file
const locksByFile = {};
for (const lock of allLocks) {
  if (!locksByFile[lock.file]) {
    locksByFile[lock.file] = [];
  }
  locksByFile[lock.file].push(lock);
}

console.log('Locks by file:');
for (const [file, locks] of Object.entries(locksByFile)) {
  console.log(`  ${file}: ${locks.length} locks`);
  for (const lock of locks) {
    console.log(`    - ${lock.agentId} (${lock.mode})`);
  }
}

// Check for stale locks
const now = Date.now();
for (const lock of allLocks) {
  const age = now - lock.acquiredAt.getTime();
  if (age > 60000) {
    // 1 minute
    console.warn('Stale lock:', lock.file, 'held by', lock.agentId, 'for', age, 'ms');
  }
}
```

---

### View Agent Hierarchy

```typescript
const hierarchy = infrastructure.getAgentHierarchy();

// Get hierarchy tree
const tree = hierarchy.getAgentHierarchy();
console.log('Agent Hierarchy:');
console.log(JSON.stringify(tree, null, 2));

// Get statistics
const stats = hierarchy.getHierarchyStats();
console.log('Hierarchy Statistics:');
console.log('  Total agents:', stats.totalAgents);
console.log('  Root agents:', stats.rootAgents);
console.log('  Max depth:', stats.maxDepth);
console.log('  Avg children per agent:', stats.avgChildren);

// Check specific agent's family
const agentId = 'dev-1';
const children = hierarchy.getChildAgents(agentId);
const parent = hierarchy.getParentAgent(agentId);
const descendants = hierarchy.getDescendants(agentId);
const ancestors = hierarchy.getAncestors(agentId);

console.log(`Agent ${agentId}:`);
console.log('  Parent:', parent);
console.log('  Children:', children);
console.log('  Descendants:', descendants);
console.log('  Ancestors:', ancestors);
```

---

### Inspect Workflow Rules

```typescript
const workflowEngine = infrastructure.getWorkflowEngine();

// Get all rules
const rules = workflowEngine.getRules();
console.log('Workflow Rules:', rules.length);

for (const rule of rules) {
  console.log(`Rule: ${rule.name}`);
  console.log(`  Event type: ${rule.eventType}`);
  console.log(`  Has condition: ${rule.condition !== undefined}`);
  console.log(`  Actions: ${rule.actions.length}`);

  for (const action of rule.actions) {
    console.log(`    - ${action.type}:`, action.config);
  }
}
```

---

### Check Quality Gates

```typescript
const qualityGates = infrastructure.getQualityGates();

// Get all gates
const gates = qualityGates.getAllGates();
console.log('Quality Gates:', gates.length);

for (const gate of gates) {
  console.log(`Gate: ${gate.name}`);
  console.log(`  Command: ${gate.command}`);
  console.log(`  Timeout: ${gate.timeout}ms`);
}
```

---

### Test Message Delivery

```typescript
// Create two test agents
const agent1 = await integration.onAgentSpawn('test-agent-1', 'developer');
const agent2 = await integration.onAgentSpawn('test-agent-2', 'qa-engineer');

// Subscribe agent 2 to messages
let receivedMessage = null;
agent2.onMessage((message) => {
  receivedMessage = message;
  console.log('Agent 2 received message:', message);
});

// Send message from agent 1 to agent 2
await agent1.sendMessage('test-agent-2', {
  type: 'notification',
  priority: 'normal',
  payload: { test: 'hello' },
});

// Wait for delivery
await new Promise((resolve) => setTimeout(resolve, 100));

// Check if received
if (receivedMessage) {
  console.log('✅ Message delivery working');
} else {
  console.error('❌ Message not delivered');
}
```

---

### Test File Locking

```typescript
// Create two test agents
const agent1 = await integration.onAgentSpawn('test-agent-1', 'developer');
const agent2 = await integration.onAgentSpawn('test-agent-2', 'developer');

// Agent 1 acquires lock
const locked1 = await agent1.acquireFileLock('test.ts', 'write', 5000);
console.log('Agent 1 lock acquired:', locked1);

// Agent 2 tries to acquire same lock (should timeout)
try {
  const locked2 = await agent2.acquireFileLock('test.ts', 'write', 100);
  console.error('❌ Lock not exclusive - both agents acquired lock');
} catch (error) {
  console.log('✅ Lock exclusivity working - agent 2 blocked');
}

// Agent 1 releases lock
agent1.releaseFileLock('test.ts');

// Agent 2 tries again (should succeed)
const locked2 = await agent2.acquireFileLock('test.ts', 'write', 5000);
console.log('Agent 2 lock acquired after release:', locked2);
```

---

### Test Workflow Automation

```typescript
// Register test workflow rule
const workflowEngine = infrastructure.getWorkflowEngine();

let actionExecuted = false;

workflowEngine.registerRule({
  name: 'test-rule',
  eventType: 'test-event',
  actions: [
    {
      type: 'custom',
      config: {},
      execute: async () => {
        actionExecuted = true;
        console.log('Test action executed');
      },
    },
  ],
});

// Trigger event
await workflowEngine.processEvent({
  type: 'test-event',
  source: 'test-agent',
  timestamp: new Date(),
  data: {},
});

// Check if action executed
if (actionExecuted) {
  console.log('✅ Workflow automation working');
} else {
  console.error('❌ Workflow action not executed');
}
```

---

## Performance Tuning Guide

### Reduce Message Queue Size

**Problem**: High message queue depth causing delays

**Solutions**:

1. **Increase message processing rate**:

```typescript
// Process messages in batches
agentContext.onMessage(async (message) => {
  // Process quickly
  await handleMessage(message);

  // Acknowledge immediately
  await agentContext.acknowledgeMessage(message.id);
});
```

2. **Reduce message sending rate**:

```typescript
// Batch multiple updates into single message
const updates = [];
updates.push({ type: 'update1', data: {} });
updates.push({ type: 'update2', data: {} });

// Send once instead of multiple times
await agentContext.sendMessage(recipientId, {
  type: 'batch-update',
  payload: { updates },
});
```

3. **Use priority for critical messages**:

```typescript
// Critical messages processed first
await agentContext.sendMessage(recipientId, {
  type: 'request',
  priority: 'critical', // Processed before normal/low priority
  payload: {},
});
```

---

### Increase Lock Timeouts

**Problem**: File locks timing out too quickly

**Solutions**:

1. **Increase timeout for long operations**:

```typescript
// Default: 5000ms
// For long operations: 30000ms or more
const locked = await agentContext.acquireFileLock('large-file.ts', 'write', 30000);
```

2. **Use read locks when possible**:

```typescript
// Multiple agents can hold read locks simultaneously
const locked = await agentContext.acquireFileLock('config.ts', 'read', 5000);
```

3. **Release locks quickly**:

```typescript
// Acquire lock
const locked = await agentContext.acquireFileLock('file.ts', 'write', 5000);

// Do minimal work while holding lock
const content = await readFile('file.ts');
const modified = transformContent(content);
await writeFile('file.ts', modified);

// Release immediately
agentContext.releaseFileLock('file.ts');

// Do other work without lock
await processResults(modified);
```

---

### Optimize Quality Gates

**Problem**: Quality gates taking too long to execute

**Solutions**:

1. **Run gates in parallel** (already implemented):

```typescript
// Gates run in parallel by default
// build, test, lint, type-check all run simultaneously
```

2. **Increase gate timeout**:

```typescript
// In quality-gates.ts
const gateTimeout = 60000; // 60 seconds instead of 30 seconds
```

3. **Skip unnecessary gates**:

```typescript
// Only run gates relevant to changes
const result = await qualityGates.runGates(workItem, agentRole, {
  skipGates: ['integration'], // Skip slow integration tests
});
```

4. **Cache gate results**:

```typescript
// Cache results for unchanged files
const cacheKey = `${workItemId}-${filesHash}`;
const cached = gateResultsCache.get(cacheKey);

if (cached) {
  return cached;
}

const result = await qualityGates.runGates(workItem, agentRole);
gateResultsCache.set(cacheKey, result);
```

---

### Tune Workflow Rules

**Problem**: Workflow rules causing performance issues

**Solutions**:

1. **Optimize rule conditions**:

```typescript
// Bad: Complex condition evaluated for every event
condition: (event) => {
  const workItem = sharedContext.getWorkItem(event.data.workItemId);
  const agent = registry.getAgent(event.source);
  return workItem?.status === 'complete' && agent?.role === 'developer';
};

// Good: Simple condition, fast evaluation
condition: (event) => {
  return event.data?.workItemId?.startsWith('feature-');
};
```

2. **Limit action execution**:

```typescript
// Add rate limiting to prevent too many agent spawns
let lastSpawnTime = 0;

actions: [
  {
    type: 'invoke-agent',
    config: { role: 'qa-engineer' },
    execute: async (event) => {
      const now = Date.now();
      if (now - lastSpawnTime < 1000) {
        console.log('Rate limit: skipping spawn');
        return;
      }

      lastSpawnTime = now;
      // Spawn agent
    },
  },
];
```

3. **Disable verbose logging**:

```bash
# Production: Use warn or error level
export MULTI_AGENT_LOG_LEVEL=warn
```

---

### Limit Agent Spawning

**Problem**: Too many agents causing resource exhaustion

**Solutions**:

1. **Check active agent count**:

```typescript
const activeAgents = registry.getAllAgents().filter((a) => a.status !== 'offline');

if (activeAgents.length >= 10) {
  console.warn('Max agents reached, waiting for completion');
  // Wait for agents to complete before spawning more
  return;
}
```

2. **Implement agent pooling**:

```typescript
// Reuse idle agents instead of spawning new ones
const idleAgents = registry.getAgentsByRole(role).filter((a) => a.status === 'idle');

if (idleAgents.length > 0) {
  // Assign task to idle agent
  const agent = idleAgents[0];
  await assignTask(agent.id, task);
} else {
  // Spawn new agent only if no idle agents
  await spawnAgent(role, task);
}
```

3. **Set hierarchy depth limit**:

```typescript
const stats = hierarchy.getHierarchyStats();

if (stats.maxDepth >= 5) {
  console.error('Max hierarchy depth reached');
  // Don't spawn child agents
  return;
}
```

---

### Memory Optimization

**Problem**: High memory usage or memory leaks

**Solutions**:

1. **Clean up completed agents**:

```typescript
// Periodically clean up offline agents
setInterval(() => {
  const allAgents = registry.getAllAgents();

  for (const agent of allAgents) {
    if (agent.status === 'offline') {
      registry.unregisterAgent(agent.id);
      console.log('Cleaned up offline agent:', agent.id);
    }
  }
}, 60000); // Every minute
```

2. **Limit message history**:

```typescript
// In MessageBus, limit stored messages
const MAX_MESSAGES = 1000;

if (messages.length > MAX_MESSAGES) {
  // Remove oldest acknowledged messages
  messages = messages.filter((m) => !m.acknowledged).slice(-MAX_MESSAGES);
}
```

3. **Clear dead letter queue**:

```typescript
// Periodically clear old failed messages
const deadLetters = messageBus.getDeadLetterQueue();

if (deadLetters.length > 100) {
  console.warn('Clearing dead letter queue:', deadLetters.length);
  messageBus.clearDeadLetterQueue();
}
```

4. **Release resources on session end**:

```typescript
// Ensure cleanup happens
await integration.onAgentFail(agentId, new Error('Session ended'));

// Verify cleanup
const agent = registry.getAgent(agentId);
console.log('Agent status after cleanup:', agent?.status); // Should be 'offline'

const locks = sharedContext.getAgentLocks(agentId);
console.log('Locks after cleanup:', locks.length); // Should be 0
```

---

## Advanced Troubleshooting

### Analyzing Logs

**Enable detailed logging**:

```bash
export MULTI_AGENT_LOG_LEVEL=debug
```

**Log patterns to look for**:

1. **Infrastructure initialization**:

```
[InfrastructureManager] Initializing multi-agent infrastructure...
[InfrastructureManager] Infrastructure initialized successfully
```

2. **Agent spawning**:

```
[KiroIntegration] Creating AgentContext for agent-id (role: developer)
[AgentRegistry] Registering agent: agent-id
[AgentHierarchy] Recording relationship: parent-id → agent-id
```

3. **Message passing**:

```
[MessageBus] Sending message: sender-id → recipient-id (type: request, priority: normal)
[MessageBus] Message delivered: message-id
[MessageBus] Message acknowledged: message-id
```

4. **File locking**:

```
[SharedContext] Lock acquired: agent-id locked file.ts (mode: write)
[SharedContext] Lock released: agent-id released file.ts
[SharedContext] Lock timeout: agent-id waiting for file.ts (held by other-agent-id)
```

5. **Workflow automation**:

```
[WorkflowEngine] Processing event: work-complete
[WorkflowEngine] Rule matched: feature-to-qa
[WorkflowEngine] Executing action: invoke-agent (role: qa-engineer)
```

6. **Quality gates**:

```
[QualityGates] Running gates for work-item-id
[QualityGates] Gate passed: build (120ms)
[QualityGates] Gate passed: test (450ms)
[QualityGates] Gate passed: lint (80ms)
[QualityGates] Gate passed: type-check (200ms)
[QualityGates] All gates passed (850ms total)
```

**Error patterns**:

```
[ERROR] Infrastructure initialization failed: <error>
[ERROR] Agent registration failed: <error>
[ERROR] Message delivery failed: <error>
[ERROR] File lock timeout: <error>
[ERROR] Quality gate failed: <gate-name> - <error>
[ERROR] Workflow rule execution failed: <rule-name> - <error>
```

---

### Tracing Message Flow

**Problem**: Messages not reaching destination

**Debugging steps**:

1. **Enable message tracing**:

```typescript
const messageBus = infrastructure.getMessageBus();

// Log all messages
messageBus.onSend((message) => {
  console.log('[TRACE] Message sent:', {
    id: message.id,
    from: message.from,
    to: message.to,
    type: message.type,
    priority: message.priority,
  });
});

messageBus.onDeliver((message) => {
  console.log('[TRACE] Message delivered:', message.id);
});

messageBus.onAcknowledge((message) => {
  console.log('[TRACE] Message acknowledged:', message.id);
});
```

2. **Check message lifecycle**:

```typescript
// Send message
const messageId = await agentContext.sendMessage(recipientId, { payload: {} });
console.log('Message sent:', messageId);

// Wait for delivery
await new Promise((resolve) => setTimeout(resolve, 100));

// Check if delivered
const messages = await recipientContext.getMessages();
const delivered = messages.find((m) => m.id === messageId);
console.log('Message delivered:', delivered !== undefined);

// Check if acknowledged
console.log('Message acknowledged:', delivered?.acknowledged);
```

3. **Inspect dead letter queue**:

```typescript
const deadLetters = messageBus.getDeadLetterQueue();

for (const msg of deadLetters) {
  console.log('Failed message:', {
    id: msg.id,
    from: msg.from,
    to: msg.to,
    error: msg.error,
    attempts: msg.attempts,
  });
}
```

---

### Debugging Workflow Rules

**Problem**: Workflow rules not executing as expected

**Debugging steps**:

1. **Log rule evaluation**:

```typescript
const workflowEngine = infrastructure.getWorkflowEngine();

// Add logging to rule condition
workflowEngine.registerRule({
  name: 'debug-rule',
  eventType: 'work-complete',
  condition: (event) => {
    console.log('[DEBUG] Evaluating rule condition:', {
      eventType: event.type,
      eventData: event.data,
    });

    const matches = event.data?.workItemId?.startsWith('feature-');
    console.log('[DEBUG] Condition result:', matches);

    return matches;
  },
  actions: [
    {
      type: 'invoke-agent',
      config: { role: 'qa-engineer' },
      execute: async (event) => {
        console.log('[DEBUG] Executing action:', event);
      },
    },
  ],
});
```

2. **Test rule matching manually**:

```typescript
const rules = workflowEngine.getRules();
const testEvent = {
  type: 'work-complete',
  source: 'dev-1',
  timestamp: new Date(),
  data: { workItemId: 'feature-auth' },
};

for (const rule of rules) {
  console.log('Testing rule:', rule.name);

  if (rule.eventType === testEvent.type) {
    console.log('  Event type matches');

    if (rule.condition) {
      const matches = rule.condition(testEvent);
      console.log('  Condition result:', matches);
    } else {
      console.log('  No condition (always matches)');
    }
  } else {
    console.log('  Event type mismatch:', rule.eventType, '!==', testEvent.type);
  }
}
```

3. **Check action execution**:

```typescript
// Add error handling to actions
actions: [
  {
    type: 'invoke-agent',
    config: { role: 'qa-engineer' },
    execute: async (event) => {
      try {
        console.log('[DEBUG] Action starting:', event);

        // Execute action
        await spawnAgent('qa-engineer', event.data);

        console.log('[DEBUG] Action completed');
      } catch (error) {
        console.error('[DEBUG] Action failed:', error);
        throw error;
      }
    },
  },
];
```

---

### Profiling Performance

**Problem**: System running slowly

**Profiling steps**:

1. **Profile infrastructure initialization**:

```typescript
console.time('Infrastructure initialization');
const infrastructure = InfrastructureManager.getInstance();
console.timeEnd('Infrastructure initialization');
// Should be < 100ms
```

2. **Profile message delivery**:

```typescript
console.time('Message delivery');
await agentContext.sendMessage(recipientId, { payload: {} });
await new Promise((resolve) => setTimeout(resolve, 100));
console.timeEnd('Message delivery');
// Should be < 10ms
```

3. **Profile file lock acquisition**:

```typescript
console.time('File lock acquisition');
await agentContext.acquireFileLock('file.ts', 'write', 5000);
console.timeEnd('File lock acquisition');
// Should be < 10ms (if no contention)
```

4. **Profile quality gates**:

```typescript
console.time('Quality gates');
const result = await agentContext.runQualityGates(workItemId);
console.timeEnd('Quality gates');
// Should be < 30 seconds

// Profile individual gates
for (const gate of result.passedGates) {
  console.log(`${gate.name}: ${gate.executionTime}ms`);
}
```

5. **Profile workflow rule evaluation**:

```typescript
console.time('Workflow rule evaluation');
await workflowEngine.processEvent({
  type: 'work-complete',
  source: 'dev-1',
  timestamp: new Date(),
  data: {},
});
console.timeEnd('Workflow rule evaluation');
// Should be < 100ms
```

6. **Monitor memory usage over time**:

```typescript
setInterval(() => {
  const memUsage = process.memoryUsage();
  const status = infrastructure.getStatus();

  console.log('Memory & Infrastructure Status:', {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
    queueDepth: status.messageBus.queueDepth,
    activeAgents: status.agentRegistry.activeAgents,
    fileLocks: status.sharedContext.fileLocks,
  });
}, 10000); // Every 10 seconds
```

---

### Debugging Agent Hierarchy

**Problem**: Hierarchy not tracking correctly

**Debugging steps**:

1. **Visualize hierarchy**:

```typescript
const hierarchy = infrastructure.getAgentHierarchy();
const tree = hierarchy.getAgentHierarchy();

console.log('Agent Hierarchy Tree:');
console.log(JSON.stringify(tree, null, 2));
```

2. **Trace relationship recording**:

```typescript
// Add logging to recordRelationship
hierarchy.recordRelationship = ((original) => {
  return function (parentId, childId) {
    console.log('[DEBUG] Recording relationship:', parentId, '→', childId);
    return original.call(this, parentId, childId);
  };
})(hierarchy.recordRelationship);
```

3. **Verify parent-child links**:

```typescript
const agentId = 'child-agent-1';

// Check parent
const parent = hierarchy.getParentAgent(agentId);
console.log('Parent of', agentId, ':', parent);

// Check if parent knows about child
if (parent) {
  const children = hierarchy.getChildAgents(parent);
  console.log('Children of', parent, ':', children);
  console.log('Includes', agentId, ':', children.includes(agentId));
}
```

4. **Check for orphaned agents**:

```typescript
const allAgents = registry.getAllAgents();
const stats = hierarchy.getHierarchyStats();

console.log('Total agents in registry:', allAgents.length);
console.log('Total agents in hierarchy:', stats.totalAgents);

if (allAgents.length !== stats.totalAgents) {
  console.warn('Mismatch: some agents not in hierarchy');

  // Find orphaned agents
  for (const agent of allAgents) {
    const parent = hierarchy.getParentAgent(agent.id);
    const children = hierarchy.getChildAgents(agent.id);

    if (!parent && children.length === 0 && stats.rootAgents === 0) {
      console.log('Orphaned agent:', agent.id);
    }
  }
}
```

---

## Getting Help

### Where to Report Bugs

**GitHub Issues**: [Repository URL]/issues

**Bug Report Template**:

```markdown
## Bug Description

Brief description of the issue

## Steps to Reproduce

1. Step 1
2. Step 2
3. Step 3

## Expected Behavior

What should happen

## Actual Behavior

What actually happens

## Environment

- Node.js version: X.X.X
- Infrastructure version: X.X.X
- OS: [Windows/Mac/Linux]

## Logs
```

Paste relevant logs here

````

## Infrastructure Status
```json
Paste output of infrastructure.getStatus()
````

## Additional Context

Any other relevant information

````

---

### How to Provide Diagnostics

When reporting issues, include:

1. **Infrastructure status**:
```typescript
const status = infrastructure.getStatus();
console.log(JSON.stringify(status, null, 2));
````

2. **Agent registry dump**:

```typescript
const allAgents = registry.getAllAgents();
console.log(JSON.stringify(allAgents, null, 2));
```

3. **Message queue state**:

```typescript
const queueSize = messageBus.getQueueSize();
const deadLetters = messageBus.getDeadLetterQueue();
console.log('Queue size:', queueSize);
console.log('Dead letters:', deadLetters.length);
```

4. **File locks**:

```typescript
const locks = sharedContext.getAllLocks();
console.log(JSON.stringify(locks, null, 2));
```

5. **Hierarchy tree**:

```typescript
const tree = hierarchy.getAgentHierarchy();
console.log(JSON.stringify(tree, null, 2));
```

6. **Recent logs** (with debug level enabled):

```bash
export MULTI_AGENT_LOG_LEVEL=debug
# Run your code
# Copy last 100 lines of logs
```

---

### Community Resources

**Documentation**:

- [Integration Guide](./docs/INTEGRATION_GUIDE.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Usage Examples](./docs/USAGE_EXAMPLES.md)
- [Migration Guide](./docs/MIGRATION_GUIDE.md)

**Example Code**:

- [Integration Tests](./tests/integration/)
- [Unit Tests](./tests/unit/)

**Support Channels**:

- GitHub Discussions: [Repository URL]/discussions
- Stack Overflow: Tag `multi-agent-kiro`
- Discord: [Server invite link]

---

### Quick Reference

**Common Commands**:

```bash
# Enable debug logging
export MULTI_AGENT_LOG_LEVEL=debug

# Run tests
npm run test:integration
npm run test:unit

# Check quality gates
npm run build
npm run test:run
npm run lint
npm run type-check

# Check infrastructure status
node -e "const {InfrastructureManager} = require('./lib/infrastructure-manager'); console.log(InfrastructureManager.getInstance().getStatus())"
```

**Common Fixes**:

- Infrastructure not initialized → Call `await integration.initializeSession()`
- AgentContext undefined → Verify `onAgentSpawn()` called and config injected
- Messages not delivered → Check recipient subscribed with `onMessage()`
- File locks timeout → Check lock holder, increase timeout, or release locks
- Quality gates fail → Run commands manually to see errors
- Workflow rules not triggering → Verify event type matches rule
- Hierarchy not tracked → Verify `recordRelationship()` called on spawn
- Performance issues → Check queue depth, active agents, file locks

---

## Summary

This troubleshooting guide covers:

✅ **Quick diagnostics** - Fast health checks
✅ **8 common issues** - With step-by-step solutions
✅ **15 error messages** - With causes and fixes
✅ **10 debugging tools** - For inspecting infrastructure
✅ **6 performance tuning tips** - For optimization
✅ **5 advanced techniques** - For complex issues
✅ **Support resources** - Where to get help

For more information, see:

- [Integration Guide](./docs/INTEGRATION_GUIDE.md) - How infrastructure works
- [API Reference](./docs/API_REFERENCE.md) - Complete API documentation
- [Usage Examples](./docs/USAGE_EXAMPLES.md) - Code examples

**Need more help?** Open an issue on GitHub with diagnostics output.
