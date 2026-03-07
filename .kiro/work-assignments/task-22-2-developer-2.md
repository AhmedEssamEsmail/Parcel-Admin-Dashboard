# Work Assignment: Task 22.2 - Move Test Files

**Assigned to**: Developer 2
**Task ID**: 22.2
**Priority**: HIGH
**Estimated effort**: 2.5 hours
**Dependencies**: Task 22.1 (Developer 1 must complete library file moves first)
**Status**: ⏳ WAITING

## Objective

Move all multi-agent orchestration test files from `tests/unit/agents/`, `tests/integration/agents/`, and `tests/performance/` to the new `multi-agent-system/tests/` directory structure.

## Acceptance Criteria

- [ ] All unit test files moved to multi-agent-system/tests/unit/
- [ ] All integration test files moved to multi-agent-system/tests/integration/
- [ ] All performance test files moved to multi-agent-system/tests/performance/
- [ ] All import paths updated to reference new lib locations
- [ ] All tests still pass after move
- [ ] Update tasks.md when starting and completing work

## Files to Move

**Unit Tests** (6 files):

- tests/unit/agents/agent-auth.test.ts → multi-agent-system/tests/unit/agent-auth.test.ts
- tests/unit/agents/agent-invocation.test.ts → multi-agent-system/tests/unit/agent-invocation.test.ts
- tests/unit/agents/audit-logger.test.ts → multi-agent-system/tests/unit/audit-logger.test.ts
- tests/unit/agents/message-bus-optimizations.test.ts → multi-agent-system/tests/unit/message-bus-optimizations.test.ts
- tests/unit/agents/quality-gates-optimization.test.ts → multi-agent-system/tests/unit/quality-gates-optimization.test.ts
- tests/unit/agents/shared-context-optimizations.test.ts → multi-agent-system/tests/unit/shared-context-optimizations.test.ts

**Integration Tests** (7 files):

- tests/integration/agents/agent-invocation.test.ts → multi-agent-system/tests/integration/agent-invocation.test.ts
- tests/integration/agents/agent-lifecycle.test.ts → multi-agent-system/tests/integration/agent-lifecycle.test.ts
- tests/integration/agents/authorization-enforcement.test.ts → multi-agent-system/tests/integration/authorization-enforcement.test.ts
- tests/integration/agents/basic-communication.test.ts → multi-agent-system/tests/integration/basic-communication.test.ts
- tests/integration/agents/multi-agent-collaboration.test.ts → multi-agent-system/tests/integration/multi-agent-collaboration.test.ts
- tests/integration/agents/task-assignment-workflow.test.ts → multi-agent-system/tests/integration/task-assignment-workflow.test.ts
- tests/integration/agents/workflow-automation.test.ts → multi-agent-system/tests/integration/workflow-automation.test.ts

**Performance Tests** (2 files):

- tests/performance/message-bus-performance.test.ts → multi-agent-system/tests/performance/message-bus-performance.test.ts
- tests/performance/shared-context-performance.test.ts → multi-agent-system/tests/performance/shared-context-performance.test.ts

**Total**: 15 test files

## Implementation Steps

### Step 0: Wait for Developer 1 (Variable)

**DO NOT START** until Developer 1 completes Task 22.1 and reports to Tech Lead.

Tech Lead will notify you when to begin.

### Step 1: Create Directory Structure (5 min)

```bash
mkdir -p multi-agent-system/tests/unit
mkdir -p multi-agent-system/tests/integration
mkdir -p multi-agent-system/tests/performance
```

### Step 2: Move Unit Tests (45 min)

Use `smartRelocate` tool for each file:

**Example**:

```typescript
// Use smartRelocate tool with:
// oldPath: "tests/unit/agents/agent-auth.test.ts"
// newPath: "multi-agent-system/tests/unit/agent-auth.test.ts"
```

After moving all unit tests, verify:

```bash
npm run test:run -- multi-agent-system/tests/unit
```

### Step 3: Move Integration Tests (45 min)

Use `smartRelocate` tool for each file.

After moving all integration tests, verify:

```bash
npm run test:run -- multi-agent-system/tests/integration
```

### Step 4: Move Performance Tests (30 min)

Use `smartRelocate` tool for each file.

After moving all performance tests, verify:

```bash
npm run test:run -- multi-agent-system/tests/performance
```

### Step 5: Update Import Paths (30 min)

**CRITICAL**: Test files will need import path updates to reference the new library locations.

**Old import pattern**:

```typescript
import { MessageBus } from '@/lib/agents/message-bus';
```

**New import pattern**:

```typescript
import { MessageBus } from '@/multi-agent-system/lib/message-bus';
```

The `smartRelocate` tool should handle most of this automatically, but verify each test file compiles.

### Step 6: Final Verification (15 min)

```bash
npm run test:run
npm run type-check
```

All tests must pass, no new type errors.

## Critical Rules

1. **WAIT for Developer 1** - Do not start until Task 22.1 is complete
2. **ALWAYS use smartRelocate tool** - Never manually move files
3. **Move by category** - Do unit tests, then integration, then performance
4. **Verify after each category** - Run tests to catch issues early
5. **Update tasks.md** - Mark task as "In Progress" when starting, "Complete" when done
6. **Report to Tech Lead** - Notify when complete or if blocked >5 minutes

## Quality Checks

Before marking complete:

- [ ] All 15 test files moved to multi-agent-system/tests/
- [ ] All import paths updated to new lib locations
- [ ] `npm run test:run` passes (all tests)
- [ ] `npm run type-check` shows no new errors
- [ ] No test files remain in tests/unit/agents/, tests/integration/agents/, tests/performance/ (agent-related only)
- [ ] tasks.md updated with completion status

## Blockers & Escalation

If you encounter:

- **Import errors in tests**: Check that Developer 1 completed Task 22.1 correctly
- **Test failures**: Investigate if related to file moves; escalate if stuck >10 minutes
- **Tool failures**: Escalate to Tech Lead immediately

## Communication

**When starting**: Update tasks.md to mark 22.2 as "🔄 IN PROGRESS (Developer 2)"

**When complete**:

1. Update tasks.md to mark 22.2 as "✅ COMPLETE (Developer 2)"
2. List test results (X/X passing)
3. Report to Tech Lead: "Task 22.2 complete. All 15 test files moved to multi-agent-system/tests/. All tests passing."

**If blocked**: Notify Tech Lead within 5 minutes with specific blocker details.

## Success Criteria

Task is complete when:

- ✅ All 15 test files moved successfully
- ✅ All tests pass
- ✅ Type check passes (no new errors)
- ✅ tasks.md updated
- ✅ Tech Lead notified
