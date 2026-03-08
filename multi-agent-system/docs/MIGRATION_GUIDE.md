# Migration Guide

Guide for integrating the multi-agent orchestration infrastructure into existing Kiro agent systems.

## Table of Contents

1. [Overview](#overview)
2. [Migration Checklist](#migration-checklist)
3. [Updating Agent System Prompts](#updating-agent-system-prompts)
4. [Breaking Changes](#breaking-changes)
5. [Rollback Instructions](#rollback-instructions)
6. [Testing Your Migration](#testing-your-migration)

---

## Overview

This guide helps you migrate from standalone Kiro agents to the integrated multi-agent orchestration system. The migration enables:

- **Message passing** between agents
- **File locking** to prevent conflicts
- **Shared context** for coordination
- **Workflow automation** for common patterns
- **Quality gates** enforcement

### Migration Strategy

The migration is **opt-in** and **backward compatible**:

1. Enable infrastructure via environment variable
2. Update agent prompts to use AgentContext
3. Test with a single agent type first
4. Gradually roll out to all agent types
5. Monitor for issues

### Estimated Time

- **Small project** (1-2 agent types): 1-2 hours
- **Medium project** (3-5 agent types): 2-4 hours
- **Large project** (6+ agent types): 4-8 hours

---

## Migration Checklist

### Phase 1: Preparation

- [ ] Read this migration guide completely
- [ ] Review [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)
- [ ] Backup current agent system prompts
- [ ] Identify which agents will use infrastructure
- [ ] Plan testing strategy

### Phase 2: Enable Infrastructure

- [ ] Set environment variable: `ENABLE_MULTI_AGENT_INFRASTRUCTURE=true`
- [ ] Verify infrastructure initializes on first agent spawn
- [ ] Check logs for initialization confirmation
- [ ] Test infrastructure status endpoint (if available)

### Phase 3: Update Agent Prompts

- [ ] Update Developer agent prompt
- [ ] Update QA Engineer agent prompt
- [ ] Update Tech Lead agent prompt
- [ ] Update Data Architect agent prompt
- [ ] Update other specialized agents as needed

### Phase 4: Testing

- [ ] Test agent spawning with context injection
- [ ] Test message passing between agents
- [ ] Test file locking
- [ ] Test workflow automation
- [ ] Test quality gates
- [ ] Run integration tests

### Phase 5: Monitoring

- [ ] Monitor agent performance
- [ ] Check for errors in logs
- [ ] Verify message delivery
- [ ] Monitor file lock timeouts
- [ ] Track quality gate pass rates

### Phase 6: Rollout

- [ ] Deploy to development environment
- [ ] Test thoroughly
- [ ] Deploy to staging environment
- [ ] Monitor for issues
- [ ] Deploy to production
- [ ] Continue monitoring

---

## Updating Agent System Prompts

### General Pattern

All agent prompts should follow this pattern:

1. **Check infrastructure availability**
2. **Use infrastructure if available**
3. **Fall back to standalone mode if not**

### Example: Developer Agent

**Before (Standalone)**:

```markdown
## Your Role

You are a Developer agent. Your responsibilities:

- Write code
- Fix bugs
- Write unit tests
- Report completion to Tech Lead
```

**After (With Infrastructure)**:

```markdown
## Your Role

You are a Developer agent. Your responsibilities:

- Write code
- Fix bugs
- Write unit tests
- Report completion to Tech Lead

## Using Multi-Agent Infrastructure

If `config.agentContext` is available, use it for coordination:

### Before Editing Files

Always acquire file locks to prevent conflicts:

\`\`\`typescript
const agentContext = config.agentContext;
if (agentContext) {
await agentContext.acquireFileLock('src/auth.ts', 'write');
// Edit file
agentContext.releaseFileLock('src/auth.ts');
}
\`\`\`

### After Completing Work

Trigger workflow events:

\`\`\`typescript
if (agentContext) {
await agentContext.triggerWorkflowEvent({
type: 'feature-complete',
data: { featureId: 'user-auth' }
});
}
\`\`\`

### When Blocked

Escalate to Tech Lead:

\`\`\`typescript
if (agentContext) {
await agentContext.sendMessage('tech-lead', {
type: 'escalation',
priority: 'high',
payload: { issue: 'Cannot acquire file lock' }
});
}
\`\`\`

### Run Quality Gates

Before marking work complete:

\`\`\`typescript
if (agentContext) {
const report = await agentContext.runQualityGates(workItemId);
if (!report.passed) {
// Fix issues
}
}
\`\`\`
```

---

## Agent-Specific Updates

### Developer Agent

**Add to prompt**:

```markdown
## File Locking (Required)

Before editing any file:

1. Acquire write lock: `await agentContext.acquireFileLock(file, 'write')`
2. Edit file
3. Release lock: `agentContext.releaseFileLock(file)`

## Quality Gates (Required)

Before completing work:

1. Run quality gates: `await agentContext.runQualityGates(workItemId)`
2. If failed, fix issues and retry
3. If passed, trigger workflow event

## Workflow Events

After completing feature:

\`\`\`typescript
await agentContext.triggerWorkflowEvent({
type: 'feature-complete',
data: { featureId, files, coverage }
});
\`\`\`
```

### QA Engineer Agent

**Add to prompt**:

```markdown
## Message Handling

Listen for test requests:

\`\`\`typescript
agentContext.onMessage(async (message) => {
if (message.payload.action === 'test-feature') {
const results = await runTests(message.payload.files);

    await agentContext.sendMessage(message.from, {
      type: 'response',
      payload: {
        action: 'test-complete',
        result: results.passed ? 'passed' : 'failed',
        coverage: results.coverage
      }
    });

}
});
\`\`\`

## Workflow Events

After testing:

\`\`\`typescript
if (!testResults.passed) {
await agentContext.triggerWorkflowEvent({
type: 'test-failure',
data: { featureId, failedTests, severity }
});
}
\`\`\`
```

### Tech Lead Agent

**Add to prompt**:

```markdown
## Agent Registry

Query available agents:

\`\`\`typescript
const qaEngineers = agentContext.getAgentsByRole('qa-engineer');
const available = qaEngineers.filter(a => a.status === 'idle');
\`\`\`

## Work Item Management

Create and track work items:

\`\`\`typescript
agentContext.getSharedContext().createWorkItem({
id: 'feature-auth',
title: 'Implement authentication',
type: 'feature',
status: 'assigned',
assignedTo: 'developer-1',
priority: 'high'
});
\`\`\`

## Message Coordination

Assign work via messages:

\`\`\`typescript
await agentContext.sendMessage('developer-1', {
type: 'request',
priority: 'high',
payload: {
action: 'implement-feature',
workItemId: 'feature-auth'
}
});
\`\`\`
```

### Data Architect Agent

**Add to prompt**:

```markdown
## File Locking for Migrations

Always lock migration files:

\`\`\`typescript
await agentContext.acquireFileLock('migrations/001_add_users.sql', 'write');
await createMigration();
agentContext.releaseFileLock('migrations/001_add_users.sql');
\`\`\`

## Workflow Events

After schema changes:

\`\`\`typescript
await agentContext.triggerWorkflowEvent({
type: 'schema-change',
data: { migration, tables, breaking }
});
\`\`\`
```

---

## Breaking Changes

### None Currently

The integration is designed to be **100% backward compatible**:

- Existing agent invocations continue to work
- Infrastructure is opt-in via environment variable
- Agents work standalone if infrastructure not available
- No changes to existing APIs

### Future Breaking Changes

If breaking changes are introduced in future versions, they will be documented here with migration paths.

---

## Rollback Instructions

If you need to rollback the migration:

### Step 1: Disable Infrastructure

```bash
# Remove or set to false
ENABLE_MULTI_AGENT_INFRASTRUCTURE=false
```

### Step 2: Revert Agent Prompts (Optional)

If you want to remove infrastructure code from prompts:

```bash
# Restore from backup
cp .kiro/agents/developer.md.backup .kiro/agents/developer.md
cp .kiro/agents/qa-engineer.md.backup .kiro/agents/qa-engineer.md
# ... restore other agents
```

**Note**: This is optional because prompts check `if (agentContext)` and gracefully degrade.

### Step 3: Restart Kiro

```bash
# Restart to clear infrastructure state
pkill -f kiro
kiro start
```

### Step 4: Verify Rollback

```bash
# Check that agents work without infrastructure
kiro invoke developer "Implement feature X"

# Verify no infrastructure logs
tail -f kiro.log | grep -i "infrastructure"
```

### Step 5: Monitor

- Check agent execution logs
- Verify agents complete tasks successfully
- Confirm no infrastructure-related errors

---

## Testing Your Migration

### Test 1: Infrastructure Initialization

```bash
# Enable infrastructure
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=true

# Spawn an agent
kiro invoke developer "Write hello world function"

# Check logs for initialization
# Expected: "Multi-agent infrastructure initialized"
```

### Test 2: Message Passing

```bash
# Spawn two agents that communicate
kiro invoke tech-lead "Assign feature to developer and request QA testing"

# Check logs for messages
# Expected: Messages sent and received between agents
```

### Test 3: File Locking

```bash
# Spawn two developers editing same file
kiro invoke developer "Edit src/auth.ts" &
kiro invoke developer "Edit src/auth.ts" &

# Check logs for lock acquisition
# Expected: One acquires lock, other waits or times out
```

### Test 4: Workflow Automation

```bash
# Complete a feature
kiro invoke developer "Implement user authentication"

# Check logs for workflow trigger
# Expected: QA Engineer automatically spawned to test
```

### Test 5: Quality Gates

```bash
# Implement feature with failing tests
kiro invoke developer "Implement feature with bugs"

# Check logs for quality gate results
# Expected: Quality gates fail, developer notified
```

### Test 6: Graceful Degradation

```bash
# Disable infrastructure
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=false

# Spawn agent
kiro invoke developer "Write hello world function"

# Check logs
# Expected: "Multi-agent infrastructure not available", agent continues
```

---

## Common Migration Issues

### Issue 1: Infrastructure Not Initializing

**Symptom**: Agents spawn but `agentContext` is undefined

**Solution**:

```bash
# Check environment variable
echo $ENABLE_MULTI_AGENT_INFRASTRUCTURE

# Should output: true
# If not, set it:
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=true
```

### Issue 2: File Lock Timeouts

**Symptom**: Agents frequently timeout acquiring locks

**Solution**:

```typescript
// Increase timeout
await agentContext.acquireFileLock(file, 'write', 60000); // 60s

// Or implement retry logic
for (let i = 0; i < 3; i++) {
  try {
    await agentContext.acquireFileLock(file, 'write');
    break;
  } catch (error) {
    if (i === 2) throw error;
    await sleep(30000);
  }
}
```

### Issue 3: Messages Not Delivered

**Symptom**: Messages sent but not received

**Solution**:

```typescript
// Ensure message handler is registered
agentContext.onMessage(async (message) => {
  console.log('Received message:', message);
  // Handle message
});

// Check agent ID is correct
const agent = agentContext.getAgent('qa-engineer-1');
if (!agent) {
  console.error('Agent not found in registry');
}
```

### Issue 4: Quality Gates Always Failing

**Symptom**: Quality gates fail even when code is correct

**Solution**:

```bash
# Run quality checks manually
npm run build
npm run test:run
npm run lint
npm run type-check

# Check which gate is failing
# Fix the underlying issue
```

### Issue 5: Workflow Not Triggering

**Symptom**: Workflow events triggered but no action

**Solution**:

```typescript
// Check event type matches workflow rule
await agentContext.triggerWorkflowEvent({
  type: 'feature-complete', // Must match workflow rule
  data: { featureId: 'auth' },
});

// Check workflow engine logs
// Verify workflow rules are registered
```

---

## Performance Considerations

### Message Passing

- **Overhead**: <10ms per message
- **Recommendation**: Use for coordination, not high-frequency communication

### File Locking

- **Overhead**: <50ms per lock acquisition
- **Recommendation**: Lock only when editing, release immediately after

### Quality Gates

- **Overhead**: 5-30 seconds (depends on project size)
- **Recommendation**: Run in parallel, cache results when possible

### Shared Context

- **Overhead**: <5ms per read (cached)
- **Recommendation**: Read frequently, write sparingly

---

## Next Steps

After successful migration:

1. **Monitor Performance**: Track message delivery, lock timeouts, quality gate pass rates
2. **Optimize Workflows**: Add custom workflow rules for your project
3. **Extend Quality Gates**: Add project-specific quality checks
4. **Train Team**: Share [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) with team
5. **Iterate**: Improve agent prompts based on real-world usage

---

## Support

For issues or questions:

1. Check [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
2. Review [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)
3. Check infrastructure logs
4. File an issue with reproduction steps

---

## Appendix: Complete Agent Prompt Template

```markdown
# [Agent Role] Agent

## Your Role

[Role description]

## Responsibilities

- [Responsibility 1]
- [Responsibility 2]

## Multi-Agent Infrastructure

Check if infrastructure is available:

\`\`\`typescript
const agentContext = config.agentContext;
if (!agentContext) {
// Use standalone mode
return;
}
\`\`\`

### File Locking

\`\`\`typescript
await agentContext.acquireFileLock(file, 'write');
try {
// Edit file
} finally {
agentContext.releaseFileLock(file);
}
\`\`\`

### Message Handling

\`\`\`typescript
agentContext.onMessage(async (message) => {
// Handle message
});
\`\`\`

### Workflow Events

\`\`\`typescript
await agentContext.triggerWorkflowEvent({
type: 'event-type',
data: { ... }
});
\`\`\`

### Quality Gates

\`\`\`typescript
const report = await agentContext.runQualityGates(workItemId);
if (!report.passed) {
// Fix issues
}
\`\`\`

### Escalation

\`\`\`typescript
await agentContext.sendMessage('tech-lead', {
type: 'escalation',
priority: 'high',
payload: { issue: 'description' }
});
\`\`\`

## [Rest of agent prompt]
```
