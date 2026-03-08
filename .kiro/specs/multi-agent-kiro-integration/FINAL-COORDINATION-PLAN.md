# Final Coordination Plan - Multi-Agent Kiro Integration

**Tech Lead**: Coordinating 6 specialized agents to complete remaining work
**Status**: ~85% complete, 6 critical tasks remaining
**Timeline**: All agents start immediately in parallel

## Agent Assignments

### Developer 1: Fix BUG #2 - MessageBus Callback Architecture

**Priority**: CRITICAL
**Estimated Time**: 2-3 hours
**Status**: ASSIGNED

**Problem**:

- onMessage and onEscalate callbacks in AgentInvocationManager never invoked
- MessageBus doesn't deliver messages when no subscriber exists for recipient
- Need wildcard subscription or message interception mechanism

**Root Cause**:

- MessageBus requires explicit subscription per agentId
- Parent agent needs to intercept ALL outgoing messages from child agents
- Current architecture: MessageBus → Subscriber (if exists) → Handler
- Needed architecture: MessageBus → Intercept → Parent Handler + Subscriber

**Solution Options**:

1. **Option A**: Add wildcard subscription to MessageBus (e.g., subscribe("\*", handler))
2. **Option B**: Add message interception hooks to MessageBus (beforeSend, afterSend)
3. **Option C**: Modify AgentInvocationManager to subscribe to all child agent IDs

**Recommended**: Option B (message interception hooks)

- Least invasive to MessageBus architecture
- Allows parent to intercept without affecting delivery
- Maintains separation of concerns

**Implementation Steps**:

1. Add `beforeSend` and `afterSend` hooks to MessageBus constructor options
2. Call `beforeSend(message)` in MessageBus.send() before enqueuing
3. Call `afterSend(message)` in MessageBus.deliverMessage() after delivery
4. Update AgentInvocationManager to register hooks during agent spawn
5. In beforeSend hook, check if message.from === childAgentId → call onMessage callback
6. In beforeSend hook, check if message.type === 'escalation' → call onEscalate callback
7. Update integration tests to verify callbacks are invoked

**Files to Modify**:

- `multi-agent-system/lib/message-bus.ts` - Add hook support
- `multi-agent-system/lib/agent-invocation.ts` - Register hooks, implement callback logic
- `multi-agent-system/tests/integration/message-passing.test.ts` - Verify callbacks work

**Acceptance Criteria**:

- onMessage callback invoked for every message sent by child agent
- onEscalate callback invoked for every escalation message
- Integration tests pass with >0 callback invocations
- No breaking changes to existing MessageBus API
- Performance: Hook overhead < 1ms per message

**Quality Gates**:

- npm run build
- npm run type-check
- npm run lint
- npm run test:run

---

### Developer 2: Implement Comprehensive Error Handling (Task 16.1)

**Priority**: HIGH
**Estimated Time**: 2-3 hours
**Status**: ASSIGNED

**Objective**: Add comprehensive error handling across all infrastructure components

**Implementation Requirements**:

1. **Infrastructure Initialization Failures** (14.1)
   - Wrap InfrastructureManager.initialize() in try-catch
   - Log initialization errors with component details
   - Provide fallback behavior (graceful degradation)
   - Return initialization status with error details

2. **Message Delivery Failures** (14.2)
   - Already implemented: Dead letter queue in MessageBus
   - Add: Notification to sender when message fails
   - Add: Escalation to tech-lead for critical message failures
   - Verify: Dead letter queue accessible via API

3. **File Lock Timeouts** (14.3)
   - Add: Lock holder details in timeout error
   - Add: Suggested actions (wait, request release, escalate)
   - Add: Lock queue visibility (who's waiting)
   - Improve: Error message clarity

4. **Quality Gate Execution Errors** (14.4)
   - Wrap each gate execution in try-catch
   - Continue executing other gates if one fails
   - Include error details in QualityGateReport
   - Log gate execution errors with stack trace

5. **Workflow Rule Execution Errors** (14.5)
   - Already implemented: Error isolation in WorkflowEngine
   - Verify: Errors don't stop other rules from executing
   - Add: Error details in workflow execution log

6. **Agent Session Timeouts** (14.6)
   - Already implemented: SessionManager handles timeouts
   - Verify: Cleanup happens on timeout
   - Verify: onAgentFail callback invoked

7. **Agent Crashes** (14.6)
   - Add: Crash detection mechanism
   - Add: Automatic cleanup on crash
   - Add: Notification to parent/tech-lead
   - Add: Crash details in agent registry

8. **Permission Violations** (14.7)
   - Add: Clear error messages for permission denials
   - Add: Suggested actions (request permission, escalate)
   - Add: Audit log for permission violations

9. **Concurrent State Updates** (14.7)
   - Add: Conflict detection in SharedContext
   - Add: Merge strategies for concurrent updates
   - Add: Conflict resolution guidance

**Files to Modify**:

- `multi-agent-system/lib/infrastructure-manager.ts` - Initialization error handling
- `multi-agent-system/lib/message-bus.ts` - Delivery failure notifications
- `multi-agent-system/lib/shared-context.ts` - Lock timeout details, conflict detection
- `multi-agent-system/lib/quality-gates.ts` - Gate execution error handling
- `multi-agent-system/lib/workflow-engine.ts` - Verify error isolation
- `multi-agent-system/lib/session-manager.ts` - Crash detection
- `multi-agent-system/lib/agent-context.ts` - Permission violation errors
- `multi-agent-system/lib/agent-registry.ts` - Crash status tracking

**Acceptance Criteria**:

- All error scenarios have explicit handling
- Error messages are clear and actionable
- Errors include full context (agent ID, operation, timestamp)
- Errors don't crash the system (graceful degradation)
- All error paths tested

**Quality Gates**:

- npm run build
- npm run type-check
- npm run lint
- npm run test:run

---

### Developer 3: Implement Comprehensive Logging (Task 16.2)

**Priority**: HIGH
**Estimated Time**: 2-3 hours
**Status**: ASSIGNED

**Objective**: Add structured logging across all infrastructure components

**Logging Requirements**:

1. **Infrastructure Initialization** (15.1)
   - Log: Infrastructure startup with timestamp
   - Log: Each component initialization (MessageBus, AgentRegistry, etc.)
   - Log: Component status (initialized, failed, skipped)
   - Log: Total initialization time
   - Format: `[Infrastructure] Initialized MessageBus in 5ms`

2. **Agent Spawning** (15.2)
   - Log: Agent spawn with ID, role, parent
   - Log: AgentContext creation
   - Log: Agent registration in registry
   - Log: Hierarchy relationship recording
   - Format: `[AgentSpawn] Spawned developer-1 (parent: tech-lead)`

3. **Message Sending** (15.3)
   - Log: Message send with sender, recipient, type, priority
   - Log: Message delivery success/failure
   - Log: Message acknowledgment
   - Log: Dead letter queue additions
   - Format: `[Message] tech-lead → developer-1 (request, high)`

4. **Workflow Rule Triggers** (15.4)
   - Log: Workflow event triggered with type and context
   - Log: Matched rules with conditions
   - Log: Actions executed with results
   - Log: Rule execution time
   - Format: `[Workflow] Event 'feature-complete' matched rule 'trigger-qa'`

5. **Quality Gate Execution** (15.5)
   - Log: Quality gates started with agent ID
   - Log: Each gate execution with result
   - Log: Total execution time
   - Log: Pass/fail summary
   - Format: `[QualityGates] Running 6 gates for developer-1`

6. **File Lock Operations** (15.6)
   - Log: Lock acquisition with agent, file, mode
   - Log: Lock release with duration held
   - Log: Lock timeout with holder details
   - Log: Lock conflicts with waiting agents
   - Format: `[FileLock] developer-1 acquired write lock on src/auth.ts`

7. **All Errors** (15.7)
   - Log: Error type and message
   - Log: Full context (agent, operation, parameters)
   - Log: Stack trace
   - Log: Recovery action taken
   - Format: `[Error] Message delivery failed: No handlers for agent-123`

**Implementation**:

- Create `multi-agent-system/lib/logger.ts` with structured logging
- Support log levels: DEBUG, INFO, WARN, ERROR
- Support log output formats: JSON, text
- Add timestamps to all log entries
- Add correlation IDs for tracing operations
- Environment variable: `MULTI_AGENT_LOG_LEVEL` (default: INFO)
- Environment variable: `MULTI_AGENT_LOG_FORMAT` (default: text)

**Files to Modify**:

- `multi-agent-system/lib/logger.ts` - Create structured logger
- `multi-agent-system/lib/infrastructure-manager.ts` - Add initialization logging
- `multi-agent-system/lib/agent-invocation.ts` - Add spawn logging
- `multi-agent-system/lib/message-bus.ts` - Add message logging
- `multi-agent-system/lib/workflow-engine.ts` - Add workflow logging
- `multi-agent-system/lib/quality-gates.ts` - Add quality gate logging
- `multi-agent-system/lib/shared-context.ts` - Add file lock logging
- All error handlers - Add error logging

**Acceptance Criteria**:

- All operations logged with appropriate level
- Log format is consistent and parseable
- Logs include full context for debugging
- Log level configurable via environment variable
- Performance: Logging overhead < 1ms per operation

**Quality Gates**:

- npm run build
- npm run type-check
- npm run lint
- npm run test:run

---

### Technical Writer 1: Create Troubleshooting Guide (Task 18.5)

**Priority**: HIGH
**Estimated Time**: 2 hours
**Status**: ASSIGNED

**Objective**: Create comprehensive troubleshooting guide for common integration issues

**Content Requirements**:

1. **Common Integration Issues** (18.7)
   - Infrastructure not initializing
   - AgentContext undefined in spawned agents
   - Messages not being delivered
   - File locks timing out
   - Quality gates failing unexpectedly
   - Workflow rules not triggering
   - Agent hierarchy not tracked
   - Performance degradation

2. **Error Messages and Meanings**
   - "AgentRegistry not initialized" → Cause and fix
   - "No handlers registered for agent" → Cause and fix
   - "Lock timeout: file locked by agent-X" → Cause and fix
   - "Quality gate failed: build" → Cause and fix
   - "Circuit breaker open for agent" → Cause and fix
   - "Permission denied: cannot communicate with agent" → Cause and fix

3. **Debugging Tips**
   - Enable debug logging: `MULTI_AGENT_LOG_LEVEL=DEBUG`
   - Check infrastructure status: `infrastructure.getStatus()`
   - Inspect message queue: `messageBus.getQueueSize()`
   - Check dead letter queue: `messageBus.getDeadLetterQueue()`
   - View agent hierarchy: `hierarchy.getAgentHierarchy()`
   - Check file locks: `sharedContext.getActiveLocks()`
   - View circuit breaker states: `messageBus.getCircuitBreakerState()`

4. **Performance Tuning**
   - Reduce message queue size
   - Increase file lock timeout
   - Optimize quality gate execution
   - Tune workflow rule complexity
   - Adjust circuit breaker thresholds
   - Monitor infrastructure metrics

5. **Common Scenarios**
   - Scenario: Agent not receiving messages
     - Check: Agent registered in registry?
     - Check: MessageBus subscription active?
     - Check: Circuit breaker open?
     - Check: Permission to communicate?
   - Scenario: File lock conflicts
     - Check: Who holds the lock?
     - Check: Lock expiration time?
     - Check: Can request lock release?
   - Scenario: Quality gates always failing
     - Check: Gate configuration correct?
     - Check: Build/test commands valid?
     - Check: Timeout sufficient?

6. **Diagnostic Commands**

   ```typescript
   // Check infrastructure health
   const status = infrastructure.getStatus();
   console.log(status);

   // Check agent status
   const agent = registry.getAgent('developer-1');
   console.log(agent);

   // Check message queue
   const queueSize = messageBus.getQueueSize('developer-1');
   console.log(`Queue size: ${queueSize}`);

   // Check file locks
   const locks = sharedContext.getActiveLocks();
   console.log(locks);
   ```

**File to Create**:

- `multi-agent-system/TROUBLESHOOTING.md`

**Structure**:

1. Introduction
2. Quick Diagnostics Checklist
3. Common Issues and Solutions (8-10 issues)
4. Error Message Reference (10-15 errors)
5. Debugging Tools and Commands
6. Performance Tuning Guide
7. Advanced Troubleshooting
8. Getting Help

**Acceptance Criteria**:

- Covers all common integration issues
- Provides clear step-by-step solutions
- Includes diagnostic commands
- Easy to navigate and search
- Includes code examples
- Links to relevant API documentation

---

### Technical Writer 2: Update Agent System Prompts (Task 19.1)

**Priority**: HIGH
**Estimated Time**: 2-3 hours
**Status**: ASSIGNED

**Objective**: Update all agent system prompts to use AgentContext APIs

**Agent Prompts to Update**:

1. **Tech Lead** (`.kiro/agents/tech-lead.md`)
   - Add: AgentContext availability
   - Add: Message passing for agent coordination
   - Add: Workflow event triggering
   - Add: Quality gate enforcement
   - Add: Agent hierarchy management
   - Add: Shared context for task tracking

2. **Developer** (`.kiro/agents/developer.md`)
   - Add: File locking before editing files
   - Add: Message sending to tech-lead/QA
   - Add: Shared context for work items
   - Add: Status updates in registry
   - Add: Quality gate execution

3. **QA Engineer** (`.kiro/agents/qa-engineer.md`)
   - Add: Message sending for bug reports
   - Add: Workflow event triggering
   - Add: Shared context for test results
   - Add: Status updates

4. **Data Architect** (`.kiro/agents/data-architect.md`)
   - Add: File locking for migrations
   - Add: Message sending for schema changes
   - Add: Workflow event triggering

5. **DevOps** (`.kiro/agents/devops.md`)
   - Add: Message sending for deployment status
   - Add: Shared context for infrastructure state

6. **Security Engineer** (`.kiro/agents/security-engineer.md`)
   - Add: Message sending for security findings
   - Add: Escalation for critical vulnerabilities

7. **Performance Engineer** (`.kiro/agents/performance-engineer.md`)
   - Add: Message sending for performance reports
   - Add: Shared context for metrics

8. **UX/UI Designer** (`.kiro/agents/ux-ui-designer.md`)
   - Add: Message sending for design handoffs
   - Add: Shared context for design specs

9. **Technical Writer** (`.kiro/agents/technical-writer.md`)
   - Add: Message sending for documentation updates
   - Add: Shared context for doc status

**Update Template for Each Agent**:

```markdown
## Infrastructure Access

You have access to the multi-agent orchestration infrastructure through the `agentContext` object:

### Identity

- `agentContext.getAgentId()` - Your unique agent ID
- `agentContext.getRole()` - Your role (e.g., 'developer')

### Message Passing

- `agentContext.sendMessage(to, type, payload, priority)` - Send message to another agent
- `agentContext.onMessage(callback)` - Register callback for incoming messages
- `agentContext.getMessages(filter)` - Retrieve message history

### File Locking (Developer, Data Architect)

- `agentContext.acquireFileLock(filePath, mode)` - Acquire lock before editing
- `agentContext.releaseFileLock(filePath)` - Release lock after editing

### Shared Context

- `agentContext.getProjectState()` - Get current project state
- `agentContext.updateProjectState(updates)` - Update project state
- `agentContext.getWorkItem(id)` - Get work item details
- `agentContext.updateWorkItem(id, updates)` - Update work item

### Agent Registry

- `agentContext.updateStatus(status)` - Update your status
- `agentContext.getAgentsByRole(role)` - Find agents by role
- `agentContext.getAgent(id)` - Get agent details

### Workflows (Tech Lead, QA)

- `agentContext.triggerWorkflowEvent(eventType, context)` - Trigger workflow

### Quality Gates (Developer, Tech Lead)

- `agentContext.runQualityGates()` - Run quality gates

## Usage Examples

[Role-specific examples here]
```

**Files to Modify**:

- `.kiro/agents/tech-lead.md`
- `.kiro/agents/developer.md`
- `.kiro/agents/qa-engineer.md`
- `.kiro/agents/data-architect.md`
- `.kiro/agents/devops.md`
- `.kiro/agents/security-engineer.md`
- `.kiro/agents/performance-engineer.md`
- `.kiro/agents/ux-ui-designer.md`
- `.kiro/agents/technical-writer.md`

**Acceptance Criteria**:

- All agent prompts updated with AgentContext APIs
- Role-specific examples provided
- Clear usage instructions
- Consistent format across all prompts
- No breaking changes to existing prompts

---

### DevOps: Create Initialization Script (Task 19.2)

**Priority**: HIGH
**Estimated Time**: 1-2 hours
**Status**: ASSIGNED

**Objective**: Create script to initialize infrastructure on Kiro startup

**Script Requirements**:

1. **Infrastructure Initialization** (1.1)
   - Initialize InfrastructureManager
   - Verify all components initialized
   - Report initialization status
   - Handle initialization failures gracefully

2. **Workflow Rule Registration** (7.4)
   - Register "Feature Complete → QA Testing" rule
   - Register "Test Failure → Bug Fix" rule
   - Register "Schema Change → Code Update" rule
   - Register "Quality Gate Failure → Reassignment" rule
   - Register "Migration Complete → DevOps Update" rule

3. **Quality Gate Registration** (8.3)
   - Register "build" gate (npm run build)
   - Register "type-check" gate (npm run type-check)
   - Register "lint" gate (npm run lint)
   - Register "test" gate (npm run test:run)
   - Register "integration-test" gate (npm run test:integration)
   - Register "coverage" gate (coverage >= 60%)

4. **Configuration Validation**
   - Validate environment variables
   - Validate file paths
   - Validate command availability
   - Report configuration issues

5. **Health Check**
   - Verify infrastructure status
   - Test message passing
   - Test shared context
   - Test agent registry
   - Report health status

**File to Create**:

- `multi-agent-system/scripts/initialize-infrastructure.ts`

**Script Structure**:

```typescript
#!/usr/bin/env node

import { InfrastructureManager } from '../lib/infrastructure-manager';
import { WorkflowEngine } from '../lib/workflow-engine';
import { QualityGates } from '../lib/quality-gates';

async function main() {
  console.log('[Init] Starting infrastructure initialization...');

  // 1. Initialize infrastructure
  const infrastructure = InfrastructureManager.getInstance();
  await infrastructure.initialize();

  // 2. Register workflow rules
  const workflowEngine = infrastructure.getWorkflowEngine();
  registerWorkflowRules(workflowEngine);

  // 3. Register quality gates
  const qualityGates = infrastructure.getQualityGates();
  registerQualityGates(qualityGates);

  // 4. Validate configuration
  validateConfiguration();

  // 5. Run health check
  await runHealthCheck(infrastructure);

  console.log('[Init] Infrastructure initialization complete!');
}

function registerWorkflowRules(engine: WorkflowEngine) {
  // Register rules...
}

function registerQualityGates(gates: QualityGates) {
  // Register gates...
}

function validateConfiguration() {
  // Validate config...
}

async function runHealthCheck(infrastructure: InfrastructureManager) {
  // Run health checks...
}

main().catch(console.error);
```

**Integration Points**:

- Called by Kiro plugin on startup (kiro-plugins/multi-agent-orchestration/index.ts)
- Can be run manually for testing: `npm run init-infrastructure`
- Logs to console and file

**Files to Create/Modify**:

- `multi-agent-system/scripts/initialize-infrastructure.ts` - Main script
- `package.json` - Add script: `"init-infrastructure": "tsx multi-agent-system/scripts/initialize-infrastructure.ts"`

**Acceptance Criteria**:

- Script initializes infrastructure successfully
- All workflow rules registered
- All quality gates registered
- Configuration validated
- Health check passes
- Clear logging output
- Error handling for failures
- Can be run multiple times safely (idempotent)

**Quality Gates**:

- npm run build
- npm run type-check
- npm run lint
- Script runs without errors

---

## Coordination Strategy

### Parallel Execution

All 6 agents start work immediately. No dependencies between tasks.

### Progress Tracking

Each agent MUST update tasks.md when:

1. Starting work (mark "In Progress")
2. Completing work (mark "Complete" with files modified)

### Communication Protocol

- Agents report blockers to Tech Lead immediately (< 5 min)
- Tech Lead monitors progress every 30 minutes
- Tech Lead runs quality gates after each completion

### Quality Gate Enforcement

Before marking any task complete:

- npm run build (must pass)
- npm run type-check (must pass)
- npm run lint (must pass)
- npm run test:run (must pass)

### Success Criteria

- All 6 tasks completed
- All quality gates passing
- tasks.md updated with completion status
- No critical bugs remaining
- Documentation complete
- Infrastructure 100% functional

## Timeline

**Phase 1: Parallel Execution** (2-3 hours)

- All 6 agents working simultaneously
- Tech Lead monitoring progress
- Blockers resolved immediately

**Phase 2: Quality Validation** (30 minutes)

- Run all quality gates
- Fix any issues found
- Verify integration tests pass

**Phase 3: Final Verification** (30 minutes)

- Review all completed work
- Update tasks.md with final status
- Generate completion report
- Escalate to user with summary

**Total Estimated Time**: 3-4 hours

## Risk Mitigation

**Risk**: BUG #2 fix takes longer than expected
**Mitigation**: Developer 1 can request help from Tech Lead, may need architectural discussion

**Risk**: Quality gates fail after completion
**Mitigation**: Each agent runs quality gates before reporting complete

**Risk**: Agent gets blocked
**Mitigation**: Escalate to Tech Lead within 5 minutes, Tech Lead reassigns if needed

**Risk**: Integration issues between components
**Mitigation**: Run integration tests after each completion, fix issues immediately

## Next Steps

1. Tech Lead invokes all 6 agents with detailed task assignments
2. Agents start work immediately in parallel
3. Tech Lead monitors progress and resolves blockers
4. Tech Lead runs quality gates after each completion
5. Tech Lead generates final report and escalates to user

---

**Prepared by**: Tech Lead Agent
**Date**: 2024
**Status**: READY TO EXECUTE
