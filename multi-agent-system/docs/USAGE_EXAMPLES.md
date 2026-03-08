# Usage Examples

Complete, runnable examples for using the multi-agent orchestration infrastructure.

## Prerequisites

- Multi-agent infrastructure enabled via `ENABLE_MULTI_AGENT_INFRASTRUCTURE=true`
- Agent spawned with AgentContext injected
- Infrastructure initialized and running

## Checking Infrastructure Availability

```typescript
const agentContext = config.agentContext;

if (!agentContext) {
  console.log('Multi-agent infrastructure not available');
  return; // Use fallback logic
}

console.log(`Agent ID: ${agentContext.getAgentId()}`);
console.log(`Agent Role: ${agentContext.getRole()}`);
```

---

## 1. Sending Messages Between Agents

### 1.1 Developer Requests QA Testing

```typescript
// Developer completes feature and requests testing
const agentContext = config.agentContext;

await implementUserAuthentication();
await writeUnitTests();

await agentContext.sendMessage('qa-engineer-1', {
  type: 'request',
  priority: 'high',
  payload: {
    action: 'test-feature',
    featureId: 'user-authentication',
    files: ['src/auth.ts', 'tests/auth.test.ts'],
    description: 'JWT-based authentication with refresh tokens',
  },
});

console.log('Test request sent to QA Engineer');
```

### 1.2 QA Engineer Receives and Responds

```typescript
// QA Engineer listens for test requests
const agentContext = config.agentContext;

agentContext.onMessage(async (message) => {
  if (message.type === 'request' && message.payload.action === 'test-feature') {
    console.log(`Testing ${message.payload.featureId}`);

    const testResults = await runTests(message.payload.files);

    await agentContext.sendMessage(message.from, {
      type: 'response',
      priority: 'normal',
      payload: {
        action: 'test-complete',
        featureId: message.payload.featureId,
        result: testResults.passed ? 'passed' : 'failed',
        coverage: testResults.coverage,
        failedTests: testResults.failed,
      },
    });
  }
});
```

### 1.3 Message Types and Priorities

```typescript
// Request: Ask another agent to do something
await agentContext.sendMessage('developer-2', {
  type: 'request',
  priority: 'high',
  payload: { action: 'fix-bug', bugId: 'BUG-123' },
});

// Response: Reply to a request
await agentContext.sendMessage('tech-lead', {
  type: 'response',
  priority: 'normal',
  payload: { action: 'task-complete', taskId: 'TASK-456' },
});

// Notification: Inform without expecting response
await agentContext.sendMessage('tech-lead', {
  type: 'notification',
  priority: 'low',
  payload: { event: 'progress-update', progress: 75 },
});

// Escalation: Request help from parent/Tech Lead
await agentContext.sendMessage('tech-lead', {
  type: 'escalation',
  priority: 'critical',
  payload: { issue: 'blocked', reason: 'Cannot acquire file lock' },
});
```

### 1.4 Message Threading

```typescript
// Start a conversation thread
const threadId = `thread-${Date.now()}`;

await agentContext.sendMessage('data-architect', {
  type: 'request',
  priority: 'high',
  threadId: threadId,
  payload: { action: 'review-schema', schema: schemaDefinition },
});

// Reply in the same thread
agentContext.onMessage(async (message) => {
  if (message.threadId === threadId) {
    await agentContext.sendMessage(message.from, {
      type: 'response',
      priority: 'normal',
      threadId: message.threadId,
      parentMessageId: message.id,
      payload: { action: 'schema-approved', changes: [] },
    });
  }
});
```

---

## 2. Acquiring File Locks Before Editing

### 2.1 Acquire Write Lock (Exclusive)

```typescript
const agentContext = config.agentContext;
const filePath = 'src/auth.ts';

try {
  console.log(`Acquiring write lock for ${filePath}...`);
  await agentContext.acquireFileLock(filePath, 'write', 30000); // 30s timeout
  console.log(`Lock acquired for ${filePath}`);

  // Edit file safely
  await editFile(filePath, {
    addFunction: 'validateToken',
    addImport: 'jsonwebtoken',
  });

  console.log(`File ${filePath} edited successfully`);
} catch (error) {
  console.error(`Failed to acquire lock: ${error.message}`);
  // Handle lock timeout
} finally {
  // Always release lock
  agentContext.releaseFileLock(filePath);
  console.log(`Lock released for ${filePath}`);
}
```

### 2.2 Acquire Read Lock (Shared)

```typescript
// Multiple agents can hold read locks simultaneously
const agentContext = config.agentContext;

await agentContext.acquireFileLock('src/config.ts', 'read');
const content = await readFile('src/config.ts');
const config = parseConfig(content);
agentContext.releaseFileLock('src/config.ts');

console.log(`Read config: ${config.apiUrl}`);
```

### 2.3 Lock Multiple Files

```typescript
const agentContext = config.agentContext;
const files = ['src/auth.ts', 'src/middleware/auth.ts', 'tests/auth.test.ts'];

try {
  // Acquire all locks
  for (const file of files) {
    await agentContext.acquireFileLock(file, 'write');
  }

  // Edit all files
  await editAuthFiles(files);
} finally {
  // Release all locks
  for (const file of files) {
    agentContext.releaseFileLock(file);
  }
}
```

### 2.4 Handle Lock Timeout

```typescript
const agentContext = config.agentContext;
const filePath = 'src/database.ts';

try {
  await agentContext.acquireFileLock(filePath, 'write', 10000);
  await editFile(filePath, changes);
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error(`File ${filePath} is locked by another agent`);

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
} finally {
  agentContext.releaseFileLock(filePath);
}
```

---

## 3. Accessing Shared Context and Work Items

### 3.1 Read and Update Project State

```typescript
const agentContext = config.agentContext;

// Get current project state
const projectState = agentContext.getProjectState();
console.log(`Build status: ${projectState.buildStatus}`);
console.log(`Test coverage: ${projectState.testCoverage}%`);
console.log(`Last build: ${projectState.lastBuild}`);

// Update project state after running tests
agentContext.updateProjectState({
  buildStatus: 'passing',
  lastBuild: new Date().toISOString(),
  testCoverage: 87,
  lastTestRun: new Date().toISOString(),
});

console.log('Project state updated');
```

### 3.2 Create and Update Work Items

```typescript
const agentContext = config.agentContext;
const sharedContext = agentContext.getSharedContext();

// Create work item
sharedContext.createWorkItem({
  id: 'feature-auth',
  title: 'Implement user authentication',
  description: 'Add JWT-based authentication with refresh tokens',
  type: 'feature',
  status: 'in-progress',
  assignedTo: agentContext.getAgentId(),
  priority: 'high',
  tags: ['authentication', 'security'],
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Update work item
agentContext.updateWorkItem('feature-auth', {
  status: 'testing',
  progress: 85,
  updatedAt: new Date(),
  notes: 'Implementation complete, unit tests passing',
});

// Get work item
const workItem = agentContext.getWorkItem('feature-auth');
console.log(`Work item status: ${workItem.status}`);
```

### 3.3 Add Decisions to Knowledge Base

```typescript
const agentContext = config.agentContext;

// Record architectural decision
agentContext.addDecision({
  title: 'Use JWT for authentication',
  description: 'Implement stateless authentication using JSON Web Tokens',
  rationale:
    'JWT provides stateless authentication, scales horizontally, and supports microservices',
  alternatives: [
    'Session-based authentication (requires server-side storage)',
    'OAuth 2.0 (more complex, overkill for our use case)',
  ],
  tags: ['authentication', 'architecture', 'security'],
});

console.log('Decision recorded in knowledge base');
```

### 3.4 Query Knowledge Base

```typescript
const agentContext = config.agentContext;

// Search for authentication-related decisions
const authDecisions = agentContext.queryKnowledgeBase('authentication');

console.log(`Found ${authDecisions.length} authentication decisions:`);
authDecisions.forEach((item) => {
  if (item.type === 'decision') {
    console.log(`- ${item.title}: ${item.rationale}`);
  }
});
```

---

## 4. Querying Agent Registry

### 4.1 Find Agents by Role

```typescript
const agentContext = config.agentContext;

// Get all QA Engineers
const qaEngineers = agentContext.getAgentsByRole('qa-engineer');

// Filter by status
const availableQA = qaEngineers.filter((agent) => agent.status === 'idle' && agent.workload < 3);

if (availableQA.length > 0) {
  // Assign work to least busy QA Engineer
  const leastBusy = availableQA.sort((a, b) => a.workload - b.workload)[0];

  console.log(`Assigning work to ${leastBusy.id} (workload: ${leastBusy.workload})`);

  await agentContext.sendMessage(leastBusy.id, {
    type: 'request',
    priority: 'high',
    payload: {
      action: 'test-feature',
      featureId: 'user-authentication',
    },
  });
} else {
  console.log('No available QA Engineers, escalating to Tech Lead');
}
```

### 4.2 Get Agent Details

```typescript
const agentContext = config.agentContext;

// Get specific agent
const agent = agentContext.getAgent('developer-1');

if (agent) {
  console.log(`Agent: ${agent.id}`);
  console.log(`Role: ${agent.role}`);
  console.log(`Status: ${agent.status}`);
  console.log(`Workload: ${agent.workload}`);
  console.log(`Capabilities: ${agent.capabilities.join(', ')}`);
  console.log(`Last activity: ${agent.lastActivity}`);
}
```

### 4.3 Check Agent Capabilities

```typescript
const agentContext = config.agentContext;

// Check if current agent can perform actions
const canWriteCode = agentContext.canPerformAction('write-code');
const canDeploy = agentContext.canPerformAction('deploy');
const canReviewSecurity = agentContext.canPerformAction('security-review');

console.log(`Can write code: ${canWriteCode}`);
console.log(`Can deploy: ${canDeploy}`);
console.log(`Can review security: ${canReviewSecurity}`);

// Check another agent's capabilities
const registry = agentContext.getAgentRegistry();
const devOpsCanDeploy = registry.canPerformAction('devops-1', 'deploy');
console.log(`DevOps can deploy: ${devOpsCanDeploy}`);
```

### 4.4 Update Agent Status

```typescript
const agentContext = config.agentContext;

// Update status when starting work
agentContext.updateStatus('busy');
console.log('Status updated to busy');

// Do work
await implementFeature();

// Update status when blocked
agentContext.updateStatus('blocked');
await agentContext.sendMessage('tech-lead', {
  type: 'escalation',
  priority: 'high',
  payload: { issue: 'Need schema review from Data Architect' },
});

// Update status when complete
agentContext.updateStatus('idle');
console.log('Status updated to idle');
```

---

## 5. Triggering Workflow Events

### 5.1 Feature Complete Workflow

```typescript
// Developer completes feature
const agentContext = config.agentContext;

await implementFeature();
await writeUnitTests();

// Trigger workflow event
await agentContext.triggerWorkflowEvent({
  type: 'feature-complete',
  data: {
    featureId: 'user-authentication',
    files: ['src/auth.ts', 'tests/auth.test.ts'],
    coverage: 85,
    assignedTo: agentContext.getAgentId(),
  },
});

console.log('Feature complete workflow triggered');
// Workflow engine will automatically:
// 1. Spawn QA Engineer to test the feature
// 2. Run quality gates
// 3. Update work item status
```

### 5.2 Test Failure Workflow

```typescript
// QA Engineer finds bugs
const agentContext = config.agentContext;

const testResults = await runTests();

if (!testResults.passed) {
  // Trigger bug fix workflow
  await agentContext.triggerWorkflowEvent({
    type: 'test-failure',
    data: {
      featureId: 'user-authentication',
      failedTests: testResults.failed,
      severity: 'high',
      assignedTo: 'developer-1',
    },
  });

  console.log('Test failure workflow triggered');
  // Workflow engine will automatically:
  // 1. Create bug work item
  // 2. Assign to original developer
  // 3. Notify Tech Lead
}
```

### 5.3 Schema Change Workflow

```typescript
// Data Architect completes migration
const agentContext = config.agentContext;

await createMigration('add_user_roles');
await runMigration();

// Trigger schema change workflow
await agentContext.triggerWorkflowEvent({
  type: 'schema-change',
  data: {
    migration: 'add_user_roles',
    tables: ['users', 'roles'],
    breaking: false,
  },
});

console.log('Schema change workflow triggered');
// Workflow engine will automatically:
// 1. Notify all developers
// 2. Update documentation
// 3. Run integration tests
```

---

## 6. Running Quality Gates

### 6.1 Run All Quality Gates

```typescript
const agentContext = config.agentContext;

// Complete implementation
await implementFeature();
await writeTests();

// Run quality gates
console.log('Running quality gates...');
const report = await agentContext.runQualityGates('feature-auth');

if (report.passed) {
  console.log('✅ All quality gates passed!');
  console.log(`Total execution time: ${report.totalExecutionTime}ms`);

  // Mark work complete
  agentContext.updateWorkItem('feature-auth', {
    status: 'complete',
    qualityGatesPassed: true,
  });
} else {
  console.error('❌ Quality gates failed:');
  report.results.forEach((result) => {
    if (!result.passed) {
      console.error(`  - ${result.gateName}: ${result.message}`);
      console.error(`    Duration: ${result.duration}ms`);
    }
  });

  // Fix issues and retry
  agentContext.updateWorkItem('feature-auth', {
    status: 'in-progress',
    notes: 'Quality gates failed, fixing issues',
  });
}
```

### 6.2 Handle Quality Gate Failures

```typescript
const agentContext = config.agentContext;

const report = await agentContext.runQualityGates('feature-auth');

if (!report.passed) {
  // Analyze failures
  const failedGates = report.results.filter((r) => !r.passed);

  for (const gate of failedGates) {
    switch (gate.gateName) {
      case 'build':
        console.error('Build failed, fixing compilation errors');
        await fixBuildErrors();
        break;

      case 'tests':
        console.error('Tests failed, fixing test failures');
        await fixFailingTests();
        break;

      case 'lint':
        console.error('Linting failed, fixing code style');
        await runLintFix();
        break;

      case 'type-check':
        console.error('Type checking failed, fixing type errors');
        await fixTypeErrors();
        break;
    }
  }

  // Retry quality gates
  console.log('Retrying quality gates...');
  const retryReport = await agentContext.runQualityGates('feature-auth');

  if (retryReport.passed) {
    console.log('✅ Quality gates passed on retry');
  } else {
    console.error('❌ Quality gates still failing, escalating');
    await agentContext.sendMessage('tech-lead', {
      type: 'escalation',
      priority: 'high',
      payload: {
        issue: 'quality-gates-failing',
        workItemId: 'feature-auth',
        failedGates: retryReport.results.filter((r) => !r.passed),
      },
    });
  }
}
```

---

## 7. Complete Workflows

### 7.1 Feature Implementation Workflow

```typescript
// ========== TECH LEAD: Assign Feature ==========
const techLeadContext = config.agentContext;

// Create work item
techLeadContext.getSharedContext().createWorkItem({
  id: 'feature-auth',
  title: 'Implement user authentication',
  description: 'Add JWT-based authentication with refresh tokens',
  type: 'feature',
  status: 'assigned',
  assignedTo: 'developer-1',
  priority: 'high',
  tags: ['authentication', 'security'],
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Assign to developer
await techLeadContext.sendMessage('developer-1', {
  type: 'request',
  priority: 'high',
  payload: {
    action: 'implement-feature',
    workItemId: 'feature-auth',
  },
});

// ========== DEVELOPER: Implement Feature ==========
const developerContext = config.agentContext;

developerContext.onMessage(async (message) => {
  if (message.payload.action === 'implement-feature') {
    const workItemId = message.payload.workItemId;

    // Update status
    developerContext.updateStatus('busy');
    developerContext.updateWorkItem(workItemId, {
      status: 'in-progress',
      updatedAt: new Date(),
    });

    // Acquire file locks
    await developerContext.acquireFileLock('src/auth.ts', 'write');
    await developerContext.acquireFileLock('tests/auth.test.ts', 'write');

    try {
      // Implement feature
      await implementAuthentication();
      await writeUnitTests();

      // Release locks
      developerContext.releaseFileLock('src/auth.ts');
      developerContext.releaseFileLock('tests/auth.test.ts');

      // Run quality gates
      const report = await developerContext.runQualityGates(workItemId);

      if (report.passed) {
        // Trigger workflow
        await developerContext.triggerWorkflowEvent({
          type: 'feature-complete',
          data: { workItemId },
        });

        // Update status
        developerContext.updateStatus('idle');

        // Notify Tech Lead
        await developerContext.sendMessage('tech-lead', {
          type: 'notification',
          priority: 'normal',
          payload: {
            action: 'feature-complete',
            workItemId,
            qualityGatesPassed: true,
          },
        });
      } else {
        // Quality gates failed
        developerContext.updateWorkItem(workItemId, {
          status: 'in-progress',
          notes: 'Quality gates failed, fixing issues',
        });
      }
    } catch (error) {
      // Release locks on error
      developerContext.releaseFileLock('src/auth.ts');
      developerContext.releaseFileLock('tests/auth.test.ts');

      // Escalate
      await developerContext.sendMessage('tech-lead', {
        type: 'escalation',
        priority: 'high',
        payload: {
          issue: 'implementation-failed',
          workItemId,
          error: error.message,
        },
      });
    }
  }
});

// ========== QA ENGINEER: Test Feature (Spawned by Workflow) ==========
const qaContext = config.agentContext;

qaContext.onMessage(async (message) => {
  if (message.payload.action === 'test-feature') {
    const workItemId = message.payload.workItemId;

    // Update status
    qaContext.updateStatus('busy');
    qaContext.updateWorkItem(workItemId, {
      status: 'testing',
      testedBy: qaContext.getAgentId(),
      updatedAt: new Date(),
    });

    // Run tests
    const testResults = await runIntegrationTests();

    // Update work item
    qaContext.updateWorkItem(workItemId, {
      status: testResults.passed ? 'complete' : 'failed',
      testResults,
      testedAt: new Date(),
      updatedAt: new Date(),
    });

    // Notify Tech Lead
    await qaContext.sendMessage('tech-lead', {
      type: 'notification',
      priority: testResults.passed ? 'normal' : 'high',
      payload: {
        action: 'test-complete',
        workItemId,
        result: testResults.passed ? 'passed' : 'failed',
        coverage: testResults.coverage,
        failedTests: testResults.failed,
      },
    });

    // Update status
    qaContext.updateStatus('idle');
  }
});
```

### 7.2 Bug Fix Workflow

```typescript
// ========== QA ENGINEER: Report Bug ==========
const qaContext = config.agentContext;

const bug = {
  id: 'bug-auth-token-expiry',
  title: 'Token expiry not validated',
  description: 'Expired tokens are accepted as valid',
  severity: 'high',
  steps: [
    '1. Generate token',
    '2. Wait for expiry',
    '3. Use expired token',
    '4. Request succeeds (should fail)',
  ],
};

// Create bug work item
qaContext.getSharedContext().createWorkItem({
  ...bug,
  type: 'bug',
  status: 'reported',
  reportedBy: qaContext.getAgentId(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Trigger bug fix workflow
await qaContext.triggerWorkflowEvent({
  type: 'test-failure',
  data: {
    workItemId: bug.id,
    severity: bug.severity,
    originalFeature: 'feature-auth',
  },
});

// ========== DEVELOPER: Fix Bug (Assigned by Workflow) ==========
const developerContext = config.agentContext;

developerContext.onMessage(async (message) => {
  if (message.payload.action === 'fix-bug') {
    const workItemId = message.payload.workItemId;
    const bug = developerContext.getWorkItem(workItemId);

    // Update status
    developerContext.updateWorkItem(workItemId, {
      status: 'in-progress',
      assignedTo: developerContext.getAgentId(),
      updatedAt: new Date(),
    });

    // Acquire lock
    await developerContext.acquireFileLock('src/auth.ts', 'write');

    // Fix bug
    await fixTokenValidation();
    await addRegressionTest();

    // Release lock
    developerContext.releaseFileLock('src/auth.ts');

    // Run quality gates
    const report = await developerContext.runQualityGates(workItemId);

    if (report.passed) {
      // Request verification
      await developerContext.sendMessage('qa-engineer-1', {
        type: 'request',
        priority: 'high',
        payload: {
          action: 'verify-bug-fix',
          workItemId,
        },
      });
    }
  }
});
```

---

## 8. Error Handling

### 8.1 Infrastructure Unavailable

```typescript
// Graceful degradation when infrastructure not available
const agentContext = config.agentContext;

if (!agentContext) {
  console.log('Multi-agent infrastructure not available');
  console.log('Using fallback: standalone agent mode');

  // Continue without infrastructure features
  await implementFeatureStandalone();
  return;
}

// Infrastructure available, use it
await implementFeatureWithInfrastructure();
```

### 8.2 Message Send Failure

```typescript
const agentContext = config.agentContext;

try {
  await agentContext.sendMessage('qa-engineer-1', {
    type: 'request',
    payload: { action: 'test-feature' },
  });
} catch (error) {
  console.error(`Failed to send message: ${error.message}`);

  // Fallback: Log request for manual handling
  console.log('Please manually assign QA Engineer to test feature');

  // Or escalate to Tech Lead
  await agentContext.sendMessage('tech-lead', {
    type: 'escalation',
    priority: 'high',
    payload: {
      issue: 'message-send-failed',
      targetAgent: 'qa-engineer-1',
      originalMessage: 'test-feature request',
    },
  });
}
```

### 8.3 File Lock Conflict

```typescript
const agentContext = config.agentContext;
const filePath = 'src/auth.ts';
const maxRetries = 3;
let retries = 0;

while (retries < maxRetries) {
  try {
    await agentContext.acquireFileLock(filePath, 'write', 10000);
    await editFile(filePath, changes);
    agentContext.releaseFileLock(filePath);
    break; // Success
  } catch (error) {
    if (error.message.includes('timeout')) {
      retries++;
      console.log(`Lock timeout (attempt ${retries}/${maxRetries})`);

      if (retries < maxRetries) {
        console.log('Waiting 30 seconds before retry...');
        await sleep(30000);
      } else {
        console.error('Max retries reached, escalating');
        await agentContext.sendMessage('tech-lead', {
          type: 'escalation',
          priority: 'high',
          payload: {
            issue: 'file-lock-conflict',
            file: filePath,
            retries: maxRetries,
          },
        });
      }
    } else {
      throw error; // Other error
    }
  }
}
```

### 8.4 Quality Gates Failure

```typescript
const agentContext = config.agentContext;

try {
  const report = await agentContext.runQualityGates('feature-auth');

  if (!report.passed) {
    console.error('Quality gates failed');

    // Attempt auto-fix for common issues
    const fixable = ['lint', 'format'];
    const failedGates = report.results.filter((r) => !r.passed);

    for (const gate of failedGates) {
      if (fixable.includes(gate.gateName)) {
        console.log(`Auto-fixing ${gate.gateName}...`);
        await autoFix(gate.gateName);
      }
    }

    // Retry
    const retryReport = await agentContext.runQualityGates('feature-auth');

    if (!retryReport.passed) {
      // Escalate unfixable issues
      await agentContext.sendMessage('tech-lead', {
        type: 'escalation',
        priority: 'high',
        payload: {
          issue: 'quality-gates-failing',
          workItemId: 'feature-auth',
          failedGates: retryReport.results.filter((r) => !r.passed),
        },
      });
    }
  }
} catch (error) {
  console.error(`Quality gates execution failed: ${error.message}`);
  // Continue without quality gates or escalate
}
```

### 8.5 Work Item Not Found

```typescript
const agentContext = config.agentContext;

const workItemId = 'feature-auth';
const workItem = agentContext.getWorkItem(workItemId);

if (!workItem) {
  console.error(`Work item not found: ${workItemId}`);

  // Create work item if it should exist
  agentContext.getSharedContext().createWorkItem({
    id: workItemId,
    title: 'User Authentication',
    description: 'Implement JWT authentication',
    type: 'feature',
    status: 'in-progress',
    assignedTo: agentContext.getAgentId(),
    priority: 'high',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Created work item: ${workItemId}`);
}
```

---

## Best Practices

### 1. Always Check Infrastructure Availability

```typescript
if (!config.agentContext) {
  // Use fallback logic
  return;
}
```

### 2. Always Release File Locks

```typescript
try {
  await agentContext.acquireFileLock(file, 'write');
  await editFile(file);
} finally {
  agentContext.releaseFileLock(file);
}
```

### 3. Use Appropriate Message Priorities

- `critical`: System failures, security issues
- `high`: Blockers, urgent tasks
- `normal`: Regular work items
- `low`: Nice-to-have, background tasks

### 4. Update Agent Status

```typescript
agentContext.updateStatus('busy'); // When starting work
agentContext.updateStatus('blocked'); // When blocked
agentContext.updateStatus('idle'); // When complete
```

### 5. Handle Errors Gracefully

```typescript
try {
  await agentContext.sendMessage(...);
} catch (error) {
  console.error('Failed:', error);
  // Fallback logic
}
```

### 6. Update Work Items Regularly

```typescript
agentContext.updateWorkItem(taskId, {
  status: 'in-progress',
  progress: 50,
  updatedAt: new Date(),
});
```

### 7. Query Registry Before Assigning Work

```typescript
const availableAgents = agentContext.getAgentsByRole(role);
const idleAgents = availableAgents.filter((a) => a.status === 'idle');
```

---

## Next Steps

- Read [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) to update existing agents
- Review [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md) for architecture details
- Check [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for common issues
