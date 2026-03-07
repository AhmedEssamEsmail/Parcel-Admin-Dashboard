# Work Assignment: Task 22.1 - Move Core Library Files

**Assigned to**: Developer 1
**Task ID**: 22.1
**Priority**: HIGH
**Estimated effort**: 2.5 hours
**Dependencies**: None
**Status**: 🔄 IN PROGRESS

## Objective

Move all multi-agent orchestration library files from `lib/agents/` to `multi-agent-system/lib/` to create a clean separation between the operations app and the multi-agent system.

## Acceptance Criteria

- [ ] All 32 files moved from `lib/agents/*.ts` to `multi-agent-system/lib/*.ts`
- [ ] All import paths automatically updated by relocation tool
- [ ] No broken imports in moved files
- [ ] Files compile successfully after move
- [ ] Update tasks.md when starting and completing work

## Files to Move

**Core Infrastructure** (11 files):

- lib/agents/types.ts → multi-agent-system/lib/types.ts
- lib/agents/roles.ts → multi-agent-system/lib/roles.ts
- lib/agents/message-bus.ts → multi-agent-system/lib/message-bus.ts
- lib/agents/agent-registry.ts → multi-agent-system/lib/agent-registry.ts
- lib/agents/shared-context.ts → multi-agent-system/lib/shared-context.ts
- lib/agents/shared-context-types.ts → multi-agent-system/lib/shared-context-types.ts
- lib/agents/workflow-engine.ts → multi-agent-system/lib/workflow-engine.ts
- lib/agents/workflow-types.ts → multi-agent-system/lib/workflow-types.ts
- lib/agents/quality-gates.ts → multi-agent-system/lib/quality-gates.ts
- lib/agents/quality-gates-types.ts → multi-agent-system/lib/quality-gates-types.ts
- lib/agents/predefined-gates.ts → multi-agent-system/lib/predefined-gates.ts

**Coordination** (3 files):

- lib/agents/tech-lead-coordinator.ts → multi-agent-system/lib/tech-lead-coordinator.ts
- lib/agents/conflict-resolver.ts → multi-agent-system/lib/conflict-resolver.ts
- lib/agents/conflict-types.ts → multi-agent-system/lib/conflict-types.ts

**Communication** (2 files):

- lib/agents/communication-protocols.ts → multi-agent-system/lib/communication-protocols.ts
- lib/agents/error-recovery.ts → multi-agent-system/lib/error-recovery.ts

**Agent Management** (5 files):

- lib/agents/agent-definition-schema.ts → multi-agent-system/lib/agent-definition-schema.ts
- lib/agents/agent-definition-loader.ts → multi-agent-system/lib/agent-definition-loader.ts
- lib/agents/agent-invocation.ts → multi-agent-system/lib/agent-invocation.ts
- lib/agents/agent-invocation-types.ts → multi-agent-system/lib/agent-invocation-types.ts
- lib/agents/agent-auth.ts → multi-agent-system/lib/agent-auth.ts

**Audit & Security** (1 file):

- lib/agents/audit-logger.ts → multi-agent-system/lib/audit-logger.ts

**Test Files** (10 files - move these too):

- lib/agents/agent-definition-schema.test.ts → multi-agent-system/lib/agent-definition-schema.test.ts
- lib/agents/agent-registry.test.ts → multi-agent-system/lib/agent-registry.test.ts
- lib/agents/communication-protocols.test.ts → multi-agent-system/lib/communication-protocols.test.ts
- lib/agents/conflict-resolver.test.ts → multi-agent-system/lib/conflict-resolver.test.ts
- lib/agents/error-recovery.test.ts → multi-agent-system/lib/error-recovery.test.ts
- lib/agents/message-bus.test.ts → multi-agent-system/lib/message-bus.test.ts
- lib/agents/quality-gates.test.ts → multi-agent-system/lib/quality-gates.test.ts
- lib/agents/shared-context.test.ts → multi-agent-system/lib/shared-context.test.ts
- lib/agents/tech-lead-coordinator.test.ts → multi-agent-system/lib/tech-lead-coordinator.test.ts
- lib/agents/workflow-engine.test.ts → multi-agent-system/lib/workflow-engine.test.ts

**Total**: 32 files

## Implementation Steps

### Step 1: Create Directory Structure (5 min)

```bash
mkdir -p multi-agent-system/lib
```

### Step 2: Move Files Using smartRelocate Tool (2 hours)

**CRITICAL**: Use the `smartRelocate` tool for each file move. This tool automatically updates all import references across the codebase.

**Example for first file**:

```typescript
// Use smartRelocate tool with:
// oldPath: "lib/agents/types.ts"
// newPath: "multi-agent-system/lib/types.ts"
```

**Recommended Order** (to minimize dependency issues):

1. Move base types first: types.ts, roles.ts
2. Move type definition files: \*-types.ts files
3. Move implementation files: \*.ts files (non-test)
4. Move test files: \*.test.ts files

### Step 3: Verify After Each Batch (30 min)

After moving each batch of 5-10 files:

```bash
npm run type-check
```

If errors appear, fix import paths immediately before continuing.

### Step 4: Final Verification (10 min)

```bash
npm run build
npm run type-check
```

Both must pass with no errors.

## Critical Rules

1. **ALWAYS use smartRelocate tool** - Never manually move files, as this will break imports
2. **Move in batches** - Don't move all 32 files at once; do 5-10 at a time
3. **Verify after each batch** - Run type-check to catch issues early
4. **Update tasks.md** - Mark task as "In Progress" when starting, "Complete" when done
5. **Report to Tech Lead** - Notify when complete or if blocked >5 minutes

## Quality Checks

Before marking complete:

- [ ] All 32 files moved to multi-agent-system/lib/
- [ ] `npm run build` passes
- [ ] `npm run type-check` shows no new errors
- [ ] No files remain in lib/agents/ (except non-agent files)
- [ ] tasks.md updated with completion status

## Blockers & Escalation

If you encounter:

- **Import errors that won't resolve**: Escalate to Tech Lead immediately
- **Type errors in moved files**: Try to fix, but escalate if stuck >10 minutes
- **Tool failures**: Escalate to Tech Lead immediately

## Communication

**When starting**: Update tasks.md to mark 22.1 as "🔄 IN PROGRESS (Developer 1)"

**When complete**:

1. Update tasks.md to mark 22.1 as "✅ COMPLETE (Developer 1)"
2. List all files moved
3. Report to Tech Lead: "Task 22.1 complete. All 32 library files moved to multi-agent-system/lib/. Build and type-check passing."

**If blocked**: Notify Tech Lead within 5 minutes with specific blocker details.

## Success Criteria

Task is complete when:

- ✅ All 32 files moved successfully
- ✅ Build passes
- ✅ Type check passes (no new errors)
- ✅ tasks.md updated
- ✅ Tech Lead notified
