# Work Assignment: Phase 1 - Stream B (Agent Registry)

**Assigned to**: Developer Agent 2
**Priority**: High
**Status**: In Progress

## Tasks: Implement Agent Registry (Tasks 2.1-2.5)

### Context

Build the agent registry system that manages agent registration, role definitions, capabilities, and health monitoring. This is a critical component for the multi-agent orchestration system.

### Acceptance Criteria

**Task 2.1: Create agent role definitions**

- [ ] Update `lib/agents/roles.ts` with complete role definitions
- [ ] Define AgentRole enum with all 9 roles
- [ ] Define AgentDefinition interface
- [ ] Define capabilities for each role
- [ ] Define responsibilities for each role
- [ ] Define canRequestHelpFrom for each role
- [ ] Define mustNotifyOn events for each role

**Task 2.2: Implement agent definition loader**

- [ ] Create `lib/agents/agent-definition-loader.ts`
- [ ] Implement loadDefinition method (read JSON files)
- [ ] Implement loadAllDefinitions method
- [ ] Implement validateDefinition method
- [ ] Implement reloadDefinitions for hot-reload
- [ ] Cache loaded definitions

**Task 2.3: Implement agent registry**

- [ ] Implement `lib/agents/agent-registry.ts`
- [ ] Implement registerAgent method
- [ ] Implement getAgent and getAgentsByRole methods
- [ ] Implement getDefinition method
- [ ] Implement updateStatus method
- [ ] Track agent status (idle, busy, blocked, offline)

**Task 2.4: Implement capability-based authorization**

- [ ] Implement canPerformAction method
- [ ] Check capabilities before actions
- [ ] Log unauthorized attempts
- [ ] Return clear error messages

**Task 2.5: Write unit tests**

- [ ] Test agent registration
- [ ] Test role queries
- [ ] Test capability checks
- [ ] Test status updates
- [ ] Test health monitoring
- [ ] All tests pass
- [ ] Test coverage >= 80%

### Files to Create/Modify

- `lib/agents/roles.ts` (update with complete definitions)
- `lib/agents/agent-definition-loader.ts` (create)
- `lib/agents/agent-registry.ts` (implement - currently empty)
- `lib/agents/agent-registry.test.ts` (create tests)

### Files to Reference

- `lib/agents/agent-definition-schema.ts` (existing schema)
- `.kiro/agents/definitions/*.json` (agent definition files)

### Implementation Guidelines

**Agent Roles** (from requirements):

- tech-lead
- developer
- qa-engineer
- devops
- data-architect
- ux-ui-designer
- security-engineer
- technical-writer
- performance-engineer

**Agent Status States**:

- idle: Available for work
- busy: Currently working on task
- blocked: Waiting on dependency
- offline: Not responding to heartbeats

**Capabilities Examples**:

- Developer: write-code, run-tests, fix-bugs, refactor
- QA: write-tests, run-tests, report-bugs, verify-fixes
- Tech Lead: assign-tasks, review-work, resolve-conflicts, make-decisions

**Health Monitoring**:

- Heartbeat every 30 seconds
- 3 missed heartbeats = offline
- Auto-update status
- Trigger notifications on status changes

### Validation Commands

```bash
npm run test:run -- lib/agents/agent-registry.test.ts
npm run type-check
npm run lint
```

### Dependencies

None - can start immediately

### Estimated Time

3-4 hours
