# Usage Examples

This document provides practical examples of how agents can use the multi-agent orchestration infrastructure.

## Accessing AgentContext

```typescript
// In agent code
const agentContext = config.agentContext;

if (!agentContext) {
  // Infrastructure not available, continue without it
  console.log('Multi-agent infrastructure not available');
  return;
}

// Infrastructure available, use it
console.log(`Agent ID: ${agentContext.getAgentId()}`);
console.log(`Agent Role: ${agentContext.getRole()}`);
```

## Example 1: Sending Messages Between Agents

### Developer sends message to QA Engineer

```typescript
// Developer agent code
const agentContext = config.agentContext;

// Implement feature
await implementFeature();

// Send message to QA Engineer to test
await agentContext.sendMessage('qa-engineer-1', {
  type: 'request',
  priority: 'high',
  payload: {
    action: 'test-feature',
    featureId: 'user-authentication',
    files: ['src/auth.ts', 'tests/auth.test.ts'],
  },
});

console.log('Test request sent to QA Engineer');
```

### QA Engineer receives and responds

```typescript
// QA Engineer agent code
const agentContext = config.agentContext;

// Listen for messages
agentContext.onMessage((message) => {
  if (message.type === 'request' && message.payload.action === 'test-feature') {
    console.log(`Received test request for ${message.payload.featureId}`);

    // Test the feature
    testFeature(message.payload.files);

    // Acknowledge message
    agentContext.acknowledgeMessage(message.id);

    // Send response
    agentContext.sendMessage(message.from, {
      type: 'response',
      priority: 'normal',
      payload: {
        action: 'test-complete',
        featureId: message.payload.featureId,
        result: 'passed',
        coverage: 85,
      },
    });
  }
});
```

## Example 2: File Locking

### Acquire lock before editing

```typescript
// Developer agent code
const agentContext = config.agentContext;
const filePath = 'src/auth.ts';

try {
  // Acquire write lock (exclusive)
  console.log(`Acquiring write lock for ${filePath}...`);
  await agentContext.acquireFileLock(filePath, 'write');
  console.log(`Lock acquired for ${filePath}`);

  // Edit file
  await editFile(filePath, changes);

  // Release lock
  await agentContext.releaseFileLock(filePath);
  console.log(`Lock released for ${filePath}`);
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error(`Failed to acquire lock for ${filePath}: Another agent is editing it`);
    // Wait and retry, or escalate to Tech Lead
  }
}
```

### Multiple agents reading same file

```typescript
// Agent 1 - Read lock
const agentContext1 = config.agentContext;
await agentContext1.acquireFileLock('src/config.ts', 'read');
const content1 = await readFile('src/config.ts');
await agentContext1.releaseFileLock('src/config.ts');

// Agent 2 - Read lock (can acquire simultaneously)
const agentContext2 = config.agentContext;
await agentContext2.acquireFileLock('src/config.ts', 'read');
const content2 = await readFile('src/config.ts');
await agentContext2.releaseFileLock('src/config.ts');

// Both agents can read at the same time
```

## Example 3: Shared Context

### Update project state

```typescript
// Developer agent code
const agentContext = config.agentContext;

// Get current project state
const projectState = await agentContext.getProjectState();
console.log(`Current build status: ${projectState.buildStatus}`);

// Update build status after running tests
await agentContext.updateProjectState({
  buildStatus: 'passing',
  lastBuild: new Date().toISOString(),
  testCoverage: 85,
});

console.log('Project state updated');
```

### Access work items

```typescript
// QA Engineer agent code
const agentContext = config.agentContext;

// Get work item for current task
const workItem = await agentContext.getWorkItem('feature-123');

if (workItem) {
  console.log(`Testing ${workItem.title}`);
  console.log(`Assigned to: ${workItem.assignedTo}`);
  console.log(`Status: ${workItem.status}`);

  // Run tests
  const testResults = await runTests(workItem);

  // Update work item status
  await agentContext.updateWorkItem('feature-123', {
    status: testResults.passed ? 'tested' : 'failed',
    testResults: testResults,
    testedBy: agentContext.getAgentId(),
    testedAt: new Date().toISOString(),
  });
}
```

## Example 4: Agent Registry Queries

### Find available QA Engineers

```typescript
// Tech Lead agent code
const agentContext = config.agentContext;

// Get all QA Engineers
const qaEngineers = await agentContext.getAgentsByRole('qa-engineer');

// Filter by status
const availableQA = qaEngineers.filter((agent) => agent.status === 'idle' && agent.workload < 3);

if (availableQA.length > 0) {
  // Assign work to least busy QA Engineer
  const leastBusy = availableQA.sort((a, b) => a.workload - b.workload)[0];

  console.log(`Assigning work to ${leastBusy.id}`);
  await agentContext.sendMessage(leastBusy.id, {
    type: 'task-assignment',
    priority: 'high',
    payload: {
      taskId: 'test-feature-123',
      description: 'Test user authentication feature',
    },
  });
}
```

### Check agent capabilities

```typescript
// Tech Lead agent code
const agentContext = config.agentContext;

// Get specific agent
const agent = await agentContext.getAgent('developer-1');

if (agent) {
  // Check if agent can perform action
  const canWriteCode = await agentContext.canPerformAction('developer-1', 'write-code');
  const canDeploy = await agentContext.canPerformAction('developer-1', 'deploy');

  console.log(`Developer can write code: ${canWriteCode}`);
  console.log(`Developer can deploy: ${canDeploy}`);
}
```

## Example 5: Workflow Automation

### Trigger workflow event

```typescript
// Developer agent code
const agentContext = config.agentContext;

// Complete feature implementation
await implementFeature();

// Trigger workflow event
await agentContext.triggerWorkflowEvent({
  type: 'feature-complete',
  data: {
    featureId: 'user-authentication',
    files: ['src/auth.ts', 'tests/auth.test.ts'],
    coverage: 85,
  },
});

// Workflow engine will automatically:
// 1. Spawn QA Engineer to test the feature
// 2. Run quality gates
// 3. Update work item status
```

## Example 6: Quality Gates

### Run quality gates before completion

```typescript
// Developer agent code
const agentContext = config.agentContext;

// Complete implementation
await implementFeature();

// Get work item
const workItem = await agentContext.getWorkItem('feature-123');

// Run quality gates
console.log('Running quality gates...');
const report = await agentContext.runQualityGates(workItem);

if (report.passed) {
  console.log('All quality gates passed!');
  console.log(`Total execution time: ${report.totalExecutionTime}ms`);

  // Mark work complete
  await agentContext.updateWorkItem('feature-123', {
    status: 'complete',
    qualityGatesPassed: true,
  });
} else {
  console.error('Quality gates failed:');
  report.results.forEach((result) => {
    if (!result.passed) {
      console.error(`- ${result.gateName}: ${result.message}`);
    }
  });

  // Fix issues and retry
}
```

## Example 7: Error Handling

### Handle infrastructure unavailable

```typescript
// Agent code with graceful degradation
const agentContext = config.agentContext;

if (!agentContext) {
  // Infrastructure not available, use fallback
  console.log('Multi-agent infrastructure not available, using fallback');

  // Continue without infrastructure features
  await implementFeatureWithoutInfrastructure();
  return;
}

// Infrastructure available, use it
try {
  await agentContext.sendMessage('qa-engineer-1', {
    type: 'request',
    payload: { action: 'test-feature' },
  });
} catch (error) {
  console.error('Failed to send message:', error.message);
  // Fallback: log request for manual handling
  console.log('Please manually assign QA Engineer to test feature');
}
```

### Handle lock timeout

```typescript
// Agent code with lock timeout handling
const agentContext = config.agentContext;
const filePath = 'src/auth.ts';

try {
  await agentContext.acquireFileLock(filePath, 'write');
  await editFile(filePath, changes);
  await agentContext.releaseFileLock(filePath);
} catch (error) {
  if (error.message.includes('timeout')) {
    // Another agent is editing the file
    console.error(`Cannot edit ${filePath}: File is locked by another agent`);

    // Option 1: Wait and retry
    console.log('Waiting 30 seconds and retrying...');
    await sleep(30000);
    return retryEdit(filePath, changes);

    // Option 2: Escalate to Tech Lead
    await agentContext.sendMessage('tech-lead', {
      type: 'escalation',
      priority: 'high',
      payload: {
        issue: 'file-lock-conflict',
        file: filePath,
        message: 'Cannot acquire lock to edit file',
      },
    });
  }
}
```

## Example 8: Complete Feature Implementation Workflow

```typescript
// Tech Lead assigns feature to Developer
const techLeadContext = config.agentContext;

await techLeadContext.sendMessage('developer-1', {
  type: 'task-assignment',
  priority: 'high',
  payload: {
    taskId: 'feature-123',
    title: 'Implement user authentication',
    description: 'Add JWT-based authentication',
    files: ['src/auth.ts', 'tests/auth.test.ts'],
  },
});

// Developer implements feature
const developerContext = config.agentContext;

// Acquire locks
await developerContext.acquireFileLock('src/auth.ts', 'write');
await developerContext.acquireFileLock('tests/auth.test.ts', 'write');

// Implement
await implementAuthentication();
await writeTests();

// Release locks
await developerContext.releaseFileLock('src/auth.ts');
await developerContext.releaseFileLock('tests/auth.test.ts');

// Run quality gates
const workItem = await developerContext.getWorkItem('feature-123');
const report = await developerContext.runQualityGates(workItem);

if (report.passed) {
  // Trigger workflow (automatically spawns QA Engineer)
  await developerContext.triggerWorkflowEvent({
    type: 'feature-complete',
    data: { featureId: 'feature-123' },
  });
}

// QA Engineer tests feature (spawned by workflow)
const qaContext = config.agentContext;

qaContext.onMessage(async (message) => {
  if (message.type === 'task-assignment') {
    const { taskId } = message.payload;

    // Test feature
    const testResults = await testFeature(taskId);

    // Update work item
    await qaContext.updateWorkItem(taskId, {
      status: testResults.passed ? 'complete' : 'failed',
      testResults,
    });

    // Notify Tech Lead
    await qaContext.sendMessage('tech-lead', {
      type: 'task-complete',
      payload: {
        taskId,
        result: testResults.passed ? 'passed' : 'failed',
      },
    });
  }
});
```

## Best Practices

1. **Always check if AgentContext is available**

   ```typescript
   if (!config.agentContext) {
     // Fallback logic
   }
   ```

2. **Always release file locks**

   ```typescript
   try {
     await agentContext.acquireFileLock(file, 'write');
     await editFile(file);
   } finally {
     await agentContext.releaseFileLock(file);
   }
   ```

3. **Acknowledge messages after processing**

   ```typescript
   agentContext.onMessage(async (message) => {
     await processMessage(message);
     await agentContext.acknowledgeMessage(message.id);
   });
   ```

4. **Use appropriate message priorities**
   - `critical`: System failures, security issues
   - `high`: Blockers, urgent tasks
   - `normal`: Regular work items
   - `low`: Nice-to-have, background tasks

5. **Handle errors gracefully**

   ```typescript
   try {
     await agentContext.sendMessage(...);
   } catch (error) {
     console.error('Failed to send message:', error);
     // Fallback logic
   }
   ```

6. **Update work items regularly**

   ```typescript
   await agentContext.updateWorkItem(taskId, {
     status: 'in-progress',
     progress: 50,
     lastUpdate: new Date().toISOString(),
   });
   ```

7. **Query agent registry before assigning work**
   ```typescript
   const availableAgents = await agentContext.getAgentsByRole(role);
   const idleAgents = availableAgents.filter((a) => a.status === 'idle');
   ```
