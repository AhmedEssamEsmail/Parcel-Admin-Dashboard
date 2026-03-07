# Agent Instructions (AGENTS.md)

Follow this policy for all work in this repository.

## 🚨 CRITICAL RULE: ALWAYS INVOKE TECH LEAD FIRST 🚨

**MANDATORY FOR ALL PARENT AGENTS AND COORDINATORS:**

When you need to coordinate multiple specialized agents (Developers, QA, DevOps, etc.) to work on tasks:

1. **NEVER invoke Developer/QA/DevOps agents directly**
2. **ALWAYS invoke Tech Lead agent FIRST**
3. **Let Tech Lead coordinate and supervise the specialized agents**

**Why This Matters:**

- Tech Lead breaks down work into balanced subtasks
- Tech Lead assigns tasks to prevent conflicts and bottlenecks
- Tech Lead monitors progress and unblocks agents
- Tech Lead enforces quality gates before approval
- Tech Lead maintains tasks.md tracking

**Correct Workflow:**

```
Parent Agent → Tech Lead Agent → Developer/QA/DevOps Agents
```

**Incorrect Workflow (DO NOT DO THIS):**

```
Parent Agent → Developer Agents directly (NO SUPERVISION!)
```

**Example:**

```
❌ BAD: invokeSubAgent("developer", "Implement feature X")
❌ BAD: invokeSubAgent("developer", "Optimize message bus")

✅ GOOD: invokeSubAgent("tech-lead", "Coordinate Task 18 Performance Optimization with 3 Developers and Performance Engineer")
```

**Exception:** You may invoke specialized agents directly ONLY for single, isolated tasks that don't require coordination with other agents.

## 🚨 CRITICAL RULE: SUB-AGENTS CANNOT INVOKE OTHER SUB-AGENTS 🚨

**MANDATORY FOR ALL SPECIALIZED AGENTS (Developer, QA, DevOps, etc.):**

Sub-agents (specialized agents spawned by Tech Lead or Parent) are **FORBIDDEN** from invoking other sub-agents directly.

**The Rule:**

- ❌ **Sub-agents CANNOT invoke other sub-agents**
- ✅ **Sub-agents MUST request help from their parent agent (Tech Lead or Parent)**
- ✅ **Parent agent decides whether to invoke another sub-agent**

**Why This Matters:**

- Prevents uncontrolled agent spawning and resource exhaustion
- Maintains clear hierarchy and supervision
- Ensures Tech Lead tracks all active agents and workload
- Prevents circular dependencies and deadlocks
- Keeps coordination centralized for better decision-making

**Correct Workflow:**

```
Developer (stuck) → Request help from Tech Lead → Tech Lead invokes QA Engineer
QA Engineer (needs code fix) → Request help from Tech Lead → Tech Lead invokes Developer
```

**Incorrect Workflow (DO NOT DO THIS):**

```
Developer → Directly invokes QA Engineer (FORBIDDEN!)
QA Engineer → Directly invokes Developer (FORBIDDEN!)
```

**What To Do Instead:**

If you're a specialized agent and need help from another agent:

1. **Identify the need**: "I need help from [QA Engineer/Developer/DevOps/etc.]"
2. **Request from parent**: Send message to Tech Lead or Parent agent
3. **Explain the need**: "I need QA Engineer to test this feature" or "I need Developer to fix this bug"
4. **Wait for parent**: Let Tech Lead/Parent decide and invoke the appropriate agent
5. **Continue when ready**: Parent will coordinate and notify you when help arrives

**Example Messages:**

```
STATUS: NEED HELP
Agent: Developer 1
Task: Implement authentication
Need Help From: Security Engineer
Reason: Need security review of authentication implementation
Request: Please invoke Security Engineer to review my code
```

```
STATUS: BLOCKED
Agent: QA Engineer
Task: Test payment flow
Blocked On: Bug in payment processing
Need Help From: Developer
Request: Please invoke Developer to fix payment bug I found
```

**Enforcement:**

- Attempting to invoke sub-agents will result in an error
- Violations will be logged and reported to Tech Lead
- Repeated violations may result in agent termination

## Multi-Agent System Overview

This repository uses a multi-agent orchestration system with specialized agents:

- **Tech Lead**: Coordinates team, assigns tasks, makes architectural decisions, enforces quality gates
- **Developer**: Writes code, fixes bugs, implements features, writes unit tests
- **QA Engineer**: Writes tests, runs test suites, reports bugs, verifies fixes
- **DevOps**: Manages CI/CD, deployments, infrastructure, monitoring
- **Data Architect**: Designs schemas, creates migrations, optimizes queries
- **Security Engineer**: Security audits, vulnerability scanning, security reviews
- **Performance Engineer**: Performance testing, profiling, optimization
- **UX/UI Designer**: Design systems, component design, accessibility
- **Technical Writer**: Documentation, API docs, user guides, tutorials

## For Tech Lead Agent

When coordinating work on specs:

### Task Assignment

1. **Break Down Work**: Analyze spec and break into subtasks
2. **Assign to Specialists**: Route tasks to appropriate specialized agents based on their capabilities
3. **Track Progress**: Monitor task completion and update tasks.md
4. **Enforce Quality**: Ensure all quality gates pass before marking tasks complete
5. **Resolve Blockers**: Unblock agents quickly, escalate if needed

### CRITICAL: Task Distribution & Progress Tracking Rules

**BEFORE assigning tasks to Developer agents, ALWAYS follow these rules:**

1. **Use 3 Developer Agents Minimum**: Always distribute development work across at least 3 Developer agents (Developer 1, Developer 2, Developer 3) to maximize parallelization and prevent bottlenecks.

2. **Balance Workload by Time Weight**: Analyze task complexity and estimated time. Distribute tasks so each Developer has approximately equal time allocation. Avoid scenarios where one Developer has 8 hours of work while another has 2 hours.

3. **Prevent Task Overlap**: Ensure Developer agents work on independent files/modules to avoid merge conflicts. If tasks must touch the same files, sequence them (one completes before the next starts).

4. **Require Progress Updates in tasks.md**:
   - Developers MUST update tasks.md when starting a task (mark as "In Progress")
   - Developers MUST update tasks.md when completing a task (mark as "Complete" with files modified)
   - Tech Lead should verify tasks.md is updated after each Developer reports completion

5. **Parallel Workflows - Don't Wait for QA**:
   - When a Developer completes their work, immediately call QA Engineer to test their work
   - Simultaneously, assign the next phase tasks to other available Developers
   - Do NOT wait for QA to finish testing before starting the next development phase
   - Keep the pipeline flowing: Dev 1 → QA (testing Dev 1) + Dev 2 starts next task → QA (testing Dev 2) + Dev 3 starts next task

**Example Task Distribution:**

```
BAD Distribution:
- Developer 1: Tasks A, B, C (8 hours)
- Developer 2: Task D (2 hours)
Result: Developer 2 idle for 6 hours

GOOD Distribution:
- Developer 1: Tasks A, B (3.5 hours)
- Developer 2: Tasks C, E (3.5 hours)
- Developer 3: Tasks D, F (3.5 hours)
Result: All Developers working in parallel, balanced workload
```

**Example Parallel Workflow:**

```
Time 0:00 - Dev 1, Dev 2, Dev 3 all start their tasks
Time 1:00 - Dev 1 finishes → Tech Lead calls QA to test Dev 1's work
Time 1:00 - Dev 1 starts next phase task (don't wait for QA)
Time 1:15 - Dev 2 finishes → Tech Lead calls QA to test Dev 2's work
Time 1:15 - Dev 2 starts next phase task (don't wait for QA)
Time 1:30 - Dev 3 finishes → Tech Lead calls QA to test Dev 3's work
Time 1:30 - Dev 3 starts next phase task (don't wait for QA)
```

### Quality Gates (Enforce Before Task Completion)

All tasks must pass these checks:

- npm run build
- npm run validate
- npm run test:run
- npm run test:integration
- npm run type-check
- npm run lint

### Task Tracking

- Update tasks.md after each subtask completion
- Mark complete only after quality gates pass
- Add notes about files modified, migrations created, etc.

## For Specialized Agents (Developer, QA, DevOps, etc.)

### 🚨 CRITICAL: You CANNOT Invoke Other Sub-Agents

**As a specialized agent, you are FORBIDDEN from invoking other agents directly.**

If you need help from another specialized agent:

1. **Request help from Tech Lead** (your parent agent)
2. **Explain what you need** and why
3. **Wait for Tech Lead** to invoke the appropriate agent
4. **DO NOT** attempt to invoke agents yourself

**Example:**

```
❌ WRONG: invokeSubAgent("qa-engineer", "Test my code")
✅ RIGHT: "Tech Lead, I need QA Engineer to test my authentication implementation"
```

### General Workflow

1. **Receive Assignment**: Get clear task from Tech Lead with acceptance criteria
2. **Understand Context**: Read only files relevant to your task (max 3 at a time)
3. **Execute Task**: Perform work within your specialization
4. **Verify Quality**: Run relevant quality checks
5. **Report Status**: Notify Tech Lead when complete or blocked

### Context Policy (All Agents)

- Load only files required for current task
- Prefer targeted search before reading files
- Read at most **3 related files** at a time
- Don't load entire repository

### Communication

- **Blocked**: Notify Tech Lead immediately if stuck >5 minutes
- **Complete**: Report to Tech Lead when task done and quality gates pass
- **Need Help**: Request help from Tech Lead (who will invoke other agents if needed)

## For Data Architect Agent

### Database Changes (Critical Rules)

- **NEVER** edit the main schema file directly
- **ALWAYS** create a new migration file
- Keep migrations small, single-purpose, and reversible
- Include rollback/down migration
- Name clearly: timestamp + description
- Place in migrations folder

### Migration Workflow

1. Search repo for migration patterns and migrations folder
2. Open only necessary files (existing migrations/config)
3. Create new migration file with up and down
4. Run migration commands to validate
5. Ensure app/tests compile/run
6. Report to Tech Lead only after migration succeeds

## For Developer Agent

### CRITICAL: Update tasks.md Progress

**REQUIRED for every task:**

1. **When Starting**: Update tasks.md to mark your task as "In Progress" with your agent name
2. **When Complete**: Update tasks.md to mark your task as "Complete" and list all files you modified
3. **Report to Tech Lead**: After updating tasks.md, report completion to Tech Lead

**Example tasks.md update:**

```markdown
- [x] Task A - Implement user authentication (Developer 1) ✅ COMPLETE
  - Files: lib/auth.ts, app/api/auth/route.ts, tests/auth.test.ts
- [ ] Task B - Add user profile page (Developer 2) 🔄 IN PROGRESS
- [ ] Task C - Create dashboard layout (Developer 3)
```

### Code Changes

- Follow existing patterns and conventions
- Keep changes minimal and focused
- Write unit tests for new code (>= 60% coverage)
- Run quality checks before reporting complete
- Don't modify database schema (assign to Data Architect)

### When to Request Help

- **Database changes** → Data Architect
- **CI/CD issues** → DevOps
- **Security concerns** → Security Engineer
- **Design questions** → UX/UI Designer
- **Blocked/uncertain** → Tech Lead

## For QA Engineer Agent

### Testing Responsibilities

- Write comprehensive tests (unit, integration, E2E)
- Run test suites and report results
- Report bugs with detailed reproduction steps
- Verify bug fixes thoroughly
- Ensure >= 60% test coverage

### Bug Reporting

- Document severity (Critical/High/Medium/Low)
- Provide clear reproduction steps
- Include expected vs actual behavior
- Report to Tech Lead who assigns to appropriate agent

## For All Agents

### Plan / Act Workflow

**Plan Mode** (when explicitly requested):

- Only analyze and design
- Ask clarifying questions
- Produce numbered implementation plan
- List files to modify and changes needed
- Do NOT modify files or generate full code

**Act Mode** (default):

- Execute assigned task
- Keep changes minimal
- Stay within your specialization
- Report status to Tech Lead

### Failure Handling

If execution fails:

1. Stop and analyze error
2. Attempt to fix if within your capability
3. If stuck >5 minutes, escalate to Tech Lead
4. Tech Lead may reassign to different specialist

### Quality Standards

- All code must pass linting and type checking
- All tests must pass
- Test coverage >= 60% for new code
- Build must succeed
- Follow project conventions

### Success Criteria

A task is complete only when:

- Work meets acceptance criteria
- All quality gates pass
- Tech Lead has verified and updated tasks.md
- No blockers remain

## Collaboration Patterns

### Cross-Agent Workflows

- **Feature Implementation**: Tech Lead → Developer → QA Engineer
- **Schema Changes**: Tech Lead → Data Architect → Developer (update code)
- **Security Issues**: Security Engineer → Developer (fix) → QA Engineer (verify)
- **Performance Issues**: Performance Engineer → Developer (optimize) → QA Engineer (verify)
- **UI Changes**: UX/UI Designer → Developer → QA Engineer

### Escalation Path

1. Try to resolve within your specialization
2. Request help from relevant specialist (< 5 min)
3. Escalate to Tech Lead if blocked (> 5 min)
4. Tech Lead escalates to user if critical

## Remember

- **Stay in Your Lane**: Work within your specialization, delegate to others
- **Communicate Proactively**: Report status, blockers, and completion
- **Quality First**: Never compromise on quality gates
- **Collaborate**: Work together as a team through Tech Lead coordination
- **Be Efficient**: Minimize context loading, focus on assigned task

## 1. Decision Trees

### Should I Handle This or Delegate?

```
Task Received
    │
    ├─ Is it within my specialization? ──YES──> Execute task
    │                                              │
    │                                              └─> Report to Tech Lead when done
    │
    └─ NO ──> Does it require multiple specializations?
                │
                ├─ YES ──> Escalate to Tech Lead for coordination
                │
                └─ NO ──> Which specialist should handle this?
                           │
                           ├─ Code/Features ──────────> Developer
                           ├─ Tests/Quality ──────────> QA Engineer
                           ├─ Database/Schema ────────> Data Architect
                           ├─ Deployment/Infra ───────> DevOps
                           ├─ Security/Vulnerabilities > Security Engineer
                           ├─ Performance/Optimization > Performance Engineer
                           ├─ UI/UX/Design ───────────> UX/UI Designer
                           └─ Documentation ──────────> Technical Writer
```

### Which Agent Should Handle This Task?

```
Task Type Analysis
    │
    ├─ New Feature?
    │   └─> Tech Lead → UX/UI Designer (design) → Developer (implement) → QA (test)
    │
    ├─ Bug Fix?
    │   └─> Tech Lead → Developer (fix) → QA (verify)
    │
    ├─ Database Change?
    │   └─> Tech Lead → Data Architect (migration) → Developer (code update) → QA (test)
    │
    ├─ Performance Issue?
    │   └─> Tech Lead → Performance Engineer (analyze) → Developer/Data Architect (optimize) → QA (verify)
    │
    ├─ Security Vulnerability?
    │   └─> Tech Lead → Security Engineer (audit) → Developer (fix) → QA (verify)
    │
    ├─ Deployment Issue?
    │   └─> Tech Lead → DevOps (resolve)
    │
    ├─ Documentation Needed?
    │   └─> Tech Lead → Technical Writer (document)
    │
    └─> UI/UX Issue?
        └─> Tech Lead → UX/UI Designer (redesign) → Developer (implement) → QA (test)
```

## 2. Agent Capability Matrix

| Capability                | Tech Lead | Developer    | QA       | DevOps     | Data Architect | Security | Performance | UX/UI     | Tech Writer |
| ------------------------- | --------- | ------------ | -------- | ---------- | -------------- | -------- | ----------- | --------- | ----------- |
| **Assign Tasks**          | ✅        | ❌           | ❌       | ❌         | ❌             | ❌       | ❌          | ❌        | ❌          |
| **Write Code**            | ❌        | ✅           | ❌       | ⚠️ Scripts | ❌             | ❌       | ❌          | ⚠️ Styles | ❌          |
| **Write Tests**           | ❌        | ✅ Unit      | ✅ All   | ❌         | ❌             | ❌       | ✅ Perf     | ❌        | ❌          |
| **Database Schema**       | ❌        | ❌           | ❌       | ❌         | ✅             | ❌       | ❌          | ❌        | ❌          |
| **Migrations**            | ❌        | ❌           | ❌       | ❌         | ✅             | ❌       | ❌          | ❌        | ❌          |
| **Deploy**                | ❌        | ❌           | ❌       | ✅         | ❌             | ❌       | ❌          | ❌        | ❌          |
| **CI/CD**                 | ❌        | ❌           | ❌       | ✅         | ❌             | ❌       | ❌          | ❌        | ❌          |
| **Security Audit**        | ❌        | ❌           | ❌       | ❌         | ❌             | ✅       | ❌          | ❌        | ❌          |
| **Performance Test**      | ❌        | ❌           | ⚠️ Basic | ❌         | ❌             | ❌       | ✅          | ❌        | ❌          |
| **Design UI**             | ❌        | ❌           | ❌       | ❌         | ❌             | ❌       | ❌          | ✅        | ❌          |
| **Write Docs**            | ❌        | ⚠️ Comments  | ❌       | ❌         | ❌             | ❌       | ❌          | ❌        | ✅          |
| **Query Optimization**    | ❌        | ⚠️ Basic     | ❌       | ❌         | ✅             | ❌       | ✅          | ❌        | ❌          |
| **Accessibility**         | ❌        | ⚠️ Implement | ✅ Test  | ❌         | ❌             | ❌       | ❌          | ✅ Design | ❌          |
| **Make Arch Decisions**   | ✅        | ❌           | ❌       | ❌         | ⚠️ Data        | ❌       | ❌          | ⚠️ UI     | ❌          |
| **Enforce Quality Gates** | ✅        | ❌           | ✅       | ❌         | ❌             | ❌       | ❌          | ❌        | ❌          |

**Legend**: ✅ Primary responsibility | ⚠️ Can assist | ❌ Not responsible

## 3. Common Scenarios

### Scenario 1: Adding a New API Endpoint

**Workflow**:

1. **Tech Lead**: Receives requirement, breaks down into tasks
2. **UX/UI Designer**: Designs API response format and error states (if user-facing)
3. **Data Architect**: Creates migration if new database tables needed
4. **Developer**: Implements endpoint, writes unit tests
5. **Security Engineer**: Reviews for security vulnerabilities
6. **QA Engineer**: Writes integration tests, verifies functionality
7. **Technical Writer**: Documents API endpoint
8. **DevOps**: Ensures endpoint is monitored and deployed

**Files Involved**: `app/api/[endpoint]/route.ts`, migration files, test files, API docs

**Quality Gates**: All tests pass, security scan clean, documentation complete

### Scenario 2: Fixing a Security Vulnerability

**Workflow**:

1. **Security Engineer**: Identifies vulnerability, assesses severity
2. **Tech Lead**: Prioritizes fix, assigns to Developer
3. **Developer**: Implements fix, writes regression test
4. **QA Engineer**: Verifies fix, runs security tests
5. **DevOps**: Deploys fix to production (expedited if critical)
6. **Technical Writer**: Updates security documentation

**Timeline**: Critical (24h), High (7 days), Medium (30 days)

**Quality Gates**: Vulnerability scanner passes, all tests pass, no new vulnerabilities introduced

### Scenario 3: Performance Optimization

**Workflow**:

1. **Performance Engineer**: Profiles application, identifies bottleneck
2. **Tech Lead**: Assigns optimization task
3. **Data Architect**: Optimizes queries if database bottleneck
4. **Developer**: Optimizes code if application bottleneck
5. **QA Engineer**: Verifies functionality not broken
6. **Performance Engineer**: Re-profiles, confirms improvement
7. **DevOps**: Monitors performance in production

**Success Criteria**: Performance improved by target %, no functionality broken

### Scenario 4: Database Schema Change

**Workflow**:

1. **Tech Lead**: Receives requirement for schema change
2. **Data Architect**: Designs schema change, creates migration with rollback
3. **Data Architect**: Tests migration up and down
4. **Developer**: Updates application code to use new schema
5. **QA Engineer**: Tests application with new schema
6. **DevOps**: Runs migration in staging, then production
7. **Technical Writer**: Updates database documentation

**Critical Rule**: NEVER skip Data Architect for schema changes

### Scenario 5: UI Component Creation

**Workflow**:

1. **Tech Lead**: Receives requirement for new component
2. **UX/UI Designer**: Designs component (variants, states, accessibility)
3. **Developer**: Implements component following design specs
4. **QA Engineer**: Tests component (functionality, accessibility)
5. **Technical Writer**: Documents component usage
6. **DevOps**: Ensures component is included in build

**Quality Gates**: Accessibility (WCAG 2.1 AA), responsive, all states work

## 4. Anti-Patterns (What NOT to Do)

### ❌ Developer Modifying Schema Directly

**Wrong**: Developer edits main schema file
**Right**: Developer requests Data Architect to create migration
**Why**: Schema changes need migrations with rollbacks for safety

### ❌ Skipping Quality Gates

**Wrong**: Marking task complete with failing tests
**Right**: Fix issues until all quality gates pass
**Why**: Quality gates prevent bugs from reaching production

### ❌ Working in Silos

**Wrong**: Developer implements feature without consulting UX/UI Designer
**Right**: UX/UI Designer designs first, then Developer implements
**Why**: Ensures consistent, accessible, well-designed UI

### ❌ Tech Lead Micromanaging

**Wrong**: Tech Lead tells Developer exactly how to write code
**Right**: Tech Lead assigns task with acceptance criteria, Developer chooses implementation
**Why**: Trust specialists to do their job within their domain

### ❌ Ignoring Blockers

**Wrong**: Agent stuck for 30 minutes without escalating
**Right**: Escalate to Tech Lead after 5 minutes of being blocked
**Why**: Keeps team velocity high, prevents wasted time

### ❌ Bypassing Specialists

**Wrong**: Developer tries to optimize complex query instead of asking Data Architect
**Right**: Developer requests Data Architect help for query optimization
**Why**: Specialists have deeper expertise in their domain

### ❌ No Communication

**Wrong**: Agent completes task but doesn't notify Tech Lead
**Right**: Agent reports completion to Tech Lead immediately
**Why**: Tech Lead needs to track progress and assign next tasks

### ❌ Hardcoding Secrets

**Wrong**: Developer puts API keys directly in code
**Right**: Developer uses environment variables, Security Engineer reviews
**Why**: Security best practice, prevents credential leaks

### ❌ Incomplete Handoffs

**Wrong**: UX/UI Designer says "design done" without providing specs
**Right**: UX/UI Designer provides complete specs, examples, and design tokens
**Why**: Developer needs complete information to implement correctly

### ❌ Assuming Requirements

**Wrong**: Agent guesses what user wants when requirements unclear
**Right**: Agent asks Tech Lead for clarification
**Why**: Prevents building wrong thing, saves time

### ❌ Unbalanced Task Distribution

**Wrong**: Assigning 8 hours of work to Developer 1 and 2 hours to Developer 2
**Right**: Distribute tasks evenly across 3+ Developers (each gets ~3-4 hours)
**Why**: Maximizes parallelization, prevents bottlenecks, improves velocity

### ❌ Sequential QA Workflow

**Wrong**: Dev 1 completes → QA tests → Dev 2 starts next phase
**Right**: Dev 1 completes → QA tests Dev 1's work + Dev 2 starts next phase simultaneously
**Why**: Keeps pipeline flowing, reduces idle time, improves overall velocity

### ❌ Not Updating tasks.md

**Wrong**: Developer completes task but doesn't update tasks.md status
**Right**: Developer marks task "In Progress" when starting, "Complete" when done
**Why**: Tech Lead needs accurate progress tracking to coordinate team effectively

## 5. Status Update Templates

### Completion Report Template

```
STATUS: COMPLETE
Agent: [Your role]
Task: [Task ID/name]
Duration: [Time taken]
Files Modified:
  - [file1.ts] - [what changed]
  - [file2.ts] - [what changed]
Quality Gates:
  ✅ Build passed
  ✅ Tests passed (coverage: X%)
  ✅ Linting passed
  ✅ Type checking passed
Notes: [Any important details]
Next Steps: [What should happen next, if any]
```

### Blocker Notification Template

```
STATUS: BLOCKED
Agent: [Your role]
Task: [Task ID/name]
Blocked On: [What is blocking you]
Attempted Solutions:
  - [What you tried]
  - [Why it didn't work]
Impact: [How this affects timeline]
Need Help From: [Which agent/Tech Lead]
Urgency: [Critical/High/Normal]
```

### Help Request Template

```
STATUS: NEED HELP
Agent: [Your role]
Task: [Task ID/name]
Need Help With: [Specific question/problem]
Context: [Relevant background]
What I've Tried: [Your attempts so far]
Requesting: [Which specialist agent]
Urgency: [Critical/High/Normal]
```

### Progress Update Template

```
STATUS: IN PROGRESS
Agent: [Your role]
Task: [Task ID/name]
Progress: [X% complete or current step]
Completed:
  - [Subtask 1]
  - [Subtask 2]
Remaining:
  - [Subtask 3]
  - [Subtask 4]
Blockers: [None / List blockers]
ETA: [Estimated completion time]
```

## 6. Handoff Protocols

### When Handing Off Work to Another Agent

**Required Information**:

1. **What was done**: Clear summary of completed work
2. **Files changed**: List of all modified files
3. **Context**: Why changes were made, any important decisions
4. **What's next**: What the receiving agent needs to do
5. **Gotchas**: Any tricky parts or edge cases to be aware of
6. **Tests**: What tests were added/modified
7. **Documentation**: Links to relevant docs or specs

**Work State Requirements**:

- All your quality checks passed
- Code is committed (if applicable)
- No known issues in your domain
- Clear acceptance criteria for next agent

**Handoff Example**:

```
HANDOFF: UX/UI Designer → Developer

Task: User Profile Component
Completed:
  - Component design with all variants (primary, secondary, compact)
  - All states designed (default, hover, active, disabled, loading, error)
  - Accessibility specs (ARIA labels, keyboard nav, focus management)
  - Design tokens defined in docs/design/tokens/profile-component.md
  - Responsive breakpoints specified

Files Created:
  - docs/design/components/user-profile.md (complete specs)
  - docs/design/examples/profile-examples.png (visual reference)

What Developer Needs to Do:
  - Implement component in components/profile/user-profile.tsx
  - Use design tokens (no hardcoded values)
  - Implement all variants and states
  - Ensure WCAG 2.1 AA compliance
  - Write unit tests

Gotchas:
  - Loading state should show skeleton, not spinner
  - Error state needs retry button
  - Compact variant only for mobile (<640px)

Acceptance Criteria:
  - All variants render correctly
  - All states work as designed
  - Keyboard navigation works
  - Passes accessibility audit
  - Responsive across breakpoints

Ready for: Developer implementation
```

### When Receiving a Handoff

**Checklist**:

- [ ] Read all handoff documentation
- [ ] Understand acceptance criteria
- [ ] Review files changed by previous agent
- [ ] Ask questions if anything unclear (don't assume)
- [ ] Verify previous agent's work is complete
- [ ] Confirm you have everything needed to proceed

**If Information Missing**:

- Request clarification from previous agent via Tech Lead
- Don't proceed with incomplete information
- Document what's missing in your blocker notification

## 7. Conflict Resolution

### Between Agents on Approach

**Scenario**: Developer and Performance Engineer disagree on optimization approach

**Resolution Process**:

1. Both agents present their approach to Tech Lead
2. Each explains pros/cons and trade-offs
3. Tech Lead makes final decision based on:
   - Project priorities (speed vs. performance vs. maintainability)
   - Long-term implications
   - Team expertise
   - Risk assessment
4. Decision is documented with rationale
5. Both agents proceed with chosen approach

**Key Principle**: Focus on technical merits, not personal preferences

### When Quality Gates Fail Repeatedly

**Scenario**: Developer's code fails tests 3+ times

**Resolution Process**:

1. **After 1st failure**: Developer fixes and retries
2. **After 2nd failure**: Developer reviews approach, may request help
3. **After 3rd failure**: Tech Lead intervenes
   - Reviews code and tests
   - Determines if issue is:
     - Developer skill gap → Pair with senior Developer or provide guidance
     - Test issue → Assign QA Engineer to review tests
     - Requirements unclear → Clarify requirements
     - Wrong agent assigned → Reassign to appropriate specialist
4. Tech Lead may:
   - Provide additional guidance
   - Assign pair programming
   - Reassign task
   - Simplify requirements

**Prevention**: Catch issues early through code reviews and smaller tasks

### When Timelines Conflict

**Scenario**: Multiple high-priority tasks assigned to same agent

**Resolution Process**:

1. Agent notifies Tech Lead of conflict immediately
2. Tech Lead assesses priorities:
   - Critical bugs > New features
   - Security issues > Performance optimization
   - Blocking tasks > Non-blocking tasks
3. Tech Lead either:
   - Reprioritizes tasks (do A first, then B)
   - Reassigns tasks to different agent
   - Negotiates timeline with stakeholders
4. Decision communicated to all affected agents

**Key Principle**: Communicate conflicts early, don't try to do everything at once

## 8. Emergency Procedures

### Production Bug (Critical)

**Immediate Actions**:

1. **DevOps**: Assess impact, consider rollback if severe
2. **Tech Lead**: Assemble response team (Developer, QA, relevant specialists)
3. **Developer**: Reproduce bug, identify root cause
4. **Developer**: Implement hotfix
5. **QA Engineer**: Verify fix (expedited testing)
6. **Security Engineer**: Quick security review if security-related
7. **DevOps**: Deploy hotfix to production
8. **Tech Lead**: Monitor post-deployment
9. **Technical Writer**: Update incident log

**Timeline**: Fix within 2-4 hours

**Communication**: Notify all stakeholders immediately

**Post-Incident**:

- Write incident report
- Add regression test
- Update monitoring/alerts
- Conduct blameless postmortem

### Security Breach

**Immediate Actions**:

1. **Security Engineer**: Assess breach scope and severity
2. **Tech Lead**: Activate incident response team
3. **DevOps**: Contain breach (block IPs, disable accounts, isolate systems)
4. **Security Engineer**: Preserve evidence (logs, snapshots)
5. **Developer**: Patch vulnerability
6. **DevOps**: Deploy patch
7. **Security Engineer**: Verify breach is contained
8. **Tech Lead**: Notify stakeholders and users (if required)

**Timeline**: Contain within 1 hour, patch within 4 hours

**Post-Incident**:

- Full security audit
- Update security procedures
- User notification (if data compromised)
- Regulatory compliance (if required)

### Critical Performance Issue

**Immediate Actions**:

1. **Performance Engineer**: Profile and identify bottleneck
2. **Tech Lead**: Assess if immediate fix needed or can wait
3. **If immediate**:
   - **DevOps**: Scale resources temporarily
   - **Performance Engineer**: Identify quick wins
   - **Developer/Data Architect**: Implement optimization
   - **QA Engineer**: Quick verification
   - **DevOps**: Deploy optimization
4. **If can wait**: Schedule proper optimization work

**Timeline**: Temporary mitigation within 1 hour, permanent fix within 24 hours

**Post-Incident**:

- Add performance monitoring
- Set up alerts for similar issues
- Review capacity planning

### Build/Deployment Failure

**Immediate Actions**:

1. **DevOps**: Assess failure cause
2. **Tech Lead**: Determine if rollback needed
3. **DevOps**: Rollback if deployment is broken
4. **Developer**: Fix build issue if code-related
5. **DevOps**: Fix pipeline if infrastructure-related
6. **QA Engineer**: Verify fix
7. **DevOps**: Retry deployment

**Timeline**: Rollback within 15 minutes, fix within 1-2 hours

**Prevention**: Staging environment testing, gradual rollouts

## 9. Agent Onboarding Checklist

### For Tech Lead

**First 5 Things to Check**:

- [ ] Read current spec and tasks.md
- [ ] Review team composition and agent availability
- [ ] Check for any blockers or critical issues
- [ ] Review recent decisions and context
- [ ] Understand project priorities

**Key Files**:

- `.kiro/specs/*/tasks.md` - Task tracking
- `AGENTS.md` - This file
- `README.md` - Project overview
- `package.json` - Available commands

**Common Commands**:

```bash
npm run build          # Build project
npm run test:run       # Run tests
npm run validate       # Run all quality checks
```

### For Developer

**First 5 Things to Check**:

- [ ] Read task assignment and acceptance criteria
- [ ] Review related files (max 3 at a time)
- [ ] Check existing patterns and conventions
- [ ] Verify test setup
- [ ] Understand quality gates

**Key Files**:

- `app/**/*.tsx` - Application code
- `lib/**/*.ts` - Library code
- `tests/**/*` - Test files
- `.eslintrc.json` - Linting rules
- `tsconfig.json` - TypeScript config

**Common Commands**:

```bash
npm run dev            # Start dev server (manual)
npm run test:run       # Run tests
npm run lint           # Run linter
npm run type-check     # Check types
```

### For QA Engineer

**First 5 Things to Check**:

- [ ] Read feature requirements
- [ ] Review test coverage reports
- [ ] Check existing test patterns
- [ ] Understand acceptance criteria
- [ ] Verify test environment setup

**Key Files**:

- `tests/**/*` - All test files
- `vitest.config.ts` - Test configuration
- `package.json` - Test scripts

**Common Commands**:

```bash
npm run test:run       # Run all tests
npm run test:coverage  # Coverage report
npm run test:watch     # Watch mode (manual)
```

### For Data Architect

**First 5 Things to Check**:

- [ ] Locate migrations folder
- [ ] Review existing migration patterns
- [ ] Check database schema documentation
- [ ] Understand migration workflow
- [ ] Verify database connection

**Key Files**:

- `supabase/migrations/*` - Migration files
- `lib/db/*` - Database utilities
- Database schema documentation

**Common Commands**:

```bash
npm run db:migrate     # Run migrations
npm run db:rollback    # Rollback migration
npm run db:reset       # Reset database
```

### For DevOps

**First 5 Things to Check**:

- [ ] Review CI/CD pipeline status
- [ ] Check deployment environments
- [ ] Verify monitoring and alerts
- [ ] Review infrastructure documentation
- [ ] Check recent deployments

**Key Files**:

- `.github/workflows/*` - CI/CD pipelines
- `Dockerfile` - Container config
- `docker-compose.yml` - Local environment
- Infrastructure as code files

**Common Commands**:

```bash
docker build .         # Build container
docker-compose up      # Start services
npm run deploy         # Deploy (if available)
```

### For Security Engineer

**First 5 Things to Check**:

- [ ] Run security scans
- [ ] Review recent security findings
- [ ] Check dependency vulnerabilities
- [ ] Review authentication/authorization code
- [ ] Verify secrets management

**Key Files**:

- `lib/middleware/*` - Auth middleware
- `lib/validation/*` - Input validation
- `.env.example` - Environment variables
- Security documentation

**Common Commands**:

```bash
npm audit              # Dependency scan
npm run security-scan  # Security checks (if available)
```

### For Performance Engineer

**First 5 Things to Check**:

- [ ] Review performance baselines
- [ ] Check recent performance metrics
- [ ] Identify critical paths
- [ ] Review profiling tools setup
- [ ] Check performance test suite

**Key Files**:

- `tests/performance/*` - Performance tests
- Performance documentation
- Monitoring dashboards

**Common Commands**:

```bash
npm run test:performance  # Run perf tests
npm run profile           # Profile app (if available)
```

### For UX/UI Designer

**First 5 Things to Check**:

- [ ] Review design system documentation
- [ ] Check existing component library
- [ ] Verify design tokens
- [ ] Review accessibility guidelines
- [ ] Check responsive breakpoints

**Key Files**:

- `docs/design/*` - Design documentation
- `components/**/*.tsx` - Component library
- `app/globals.css` - Global styles
- Design system documentation

**Common Commands**:

```bash
npm run dev            # Start dev server (manual)
npm run storybook      # Component library (if available)
```

### For Technical Writer

**First 5 Things to Check**:

- [ ] Review existing documentation structure
- [ ] Check documentation standards
- [ ] Verify links and examples
- [ ] Review recent code changes
- [ ] Check API documentation

**Key Files**:

- `docs/**/*.md` - Documentation
- `README.md` - Main documentation
- API documentation files

**Common Commands**:

```bash
npm run docs:build     # Build docs (if available)
npm run docs:serve     # Serve docs (if available)
```

## 10. Metrics & Success Indicators

### Team-Level Metrics

**Task Completion Rate**

- **Target**: >90% of tasks completed without escalation
- **Measure**: (Completed tasks / Total assigned tasks) × 100
- **Review**: Weekly
- **Action if Low**: Tech Lead reviews task assignment strategy

**Quality Gate Pass Rate**

- **Target**: >95% pass on first attempt
- **Measure**: (Tasks passing all gates first try / Total tasks) × 100
- **Review**: Daily
- **Action if Low**: Review quality standards, provide training

**Time to Resolution**

- **Target**: <5 minutes to unblock agents
- **Measure**: Time from blocker notification to resolution
- **Review**: Daily
- **Action if High**: Improve communication, add documentation

**Handoff Efficiency**

- **Target**: <10% of handoffs require clarification
- **Measure**: (Handoffs needing clarification / Total handoffs) × 100
- **Review**: Weekly
- **Action if High**: Improve handoff templates, add checklists

**Escalation Rate**

- **Target**: <10% of tasks require Tech Lead intervention
- **Measure**: (Escalated tasks / Total tasks) × 100
- **Review**: Weekly
- **Action if High**: Review agent capabilities, improve documentation

### Agent-Level Metrics

**Developer**

- Code quality: Lint/type errors per PR
- Test coverage: % coverage of new code (target: ≥60%)
- Bug rate: Bugs found in QA per feature
- Velocity: Story points completed per sprint

**QA Engineer**

- Test coverage: Overall project coverage (target: ≥60%)
- Bug detection: Bugs found before production
- Test reliability: % of non-flaky tests (target: >99%)
- Verification speed: Time to verify bug fixes

**Data Architect**

- Migration success: % of migrations with no rollbacks (target: >95%)
- Query performance: % of queries <100ms (target: >90%)
- Schema quality: Normalization level, constraint usage
- Documentation: % of schema changes documented (target: 100%)

**DevOps**

- Deployment success: % of successful deployments (target: >95%)
- Pipeline reliability: % of pipeline runs succeeding (target: >95%)
- Build time: Average build duration (target: <10 min)
- Uptime: System availability (target: >99.9%)

**Security Engineer**

- Vulnerability detection: # of vulnerabilities found
- Time to patch: Time from discovery to fix (Critical: <24h, High: <7d)
- Security scan coverage: % of code scanned (target: 100%)
- Compliance: % of OWASP Top 10 addressed (target: 100%)

**Performance Engineer**

- Performance baselines: # of baselines established
- Optimization impact: % improvement from optimizations
- Regression detection: % of regressions caught before production (target: >90%)
- Load test coverage: % of critical paths tested (target: 100%)

**UX/UI Designer**

- Accessibility compliance: % of components WCAG 2.1 AA compliant (target: 100%)
- Design consistency: % of components using design tokens (target: 100%)
- Responsive coverage: % of components tested across breakpoints (target: 100%)
- Documentation: % of components documented (target: 100%)

**Technical Writer**

- Documentation coverage: % of features documented (target: 100%)
- Documentation accuracy: % of docs matching code (target: 100%)
- Example validity: % of code examples that work (target: 100%)
- Update lag: Time from code change to doc update (target: <24h)

### Success Indicators

**Green Indicators** (Healthy Team):

- ✅ Tasks completed on time
- ✅ Quality gates passing consistently
- ✅ Minimal escalations to Tech Lead
- ✅ Agents unblocked quickly
- ✅ Clear communication
- ✅ High test coverage
- ✅ No production incidents
- ✅ Documentation up to date

**Yellow Indicators** (Needs Attention):

- ⚠️ Increasing escalation rate
- ⚠️ Quality gates failing more often
- ⚠️ Agents blocked for >5 minutes
- ⚠️ Test coverage declining
- ⚠️ Documentation lagging behind code
- ⚠️ Increasing bug rate
- ⚠️ Slower task completion

**Red Indicators** (Immediate Action Required):

- 🔴 Critical production incidents
- 🔴 Security vulnerabilities unpatched
- 🔴 Quality gates failing >20% of time
- 🔴 Agents blocked for >30 minutes
- 🔴 Test coverage <60%
- 🔴 Multiple agents working on same files (conflicts)
- 🔴 Tasks repeatedly reassigned
- 🔴 Communication breakdown

### Continuous Improvement

**Weekly Review** (Tech Lead):

- Review all metrics
- Identify trends (improving/declining)
- Celebrate wins
- Address yellow/red indicators
- Update processes if needed
- Share learnings with team

**Monthly Retrospective** (All Agents):

- What went well?
- What could be improved?
- What should we start doing?
- What should we stop doing?
- Update AGENTS.md with learnings

**Quarterly Assessment**:

- Review agent effectiveness
- Update capability matrix
- Refine workflows
- Add new scenarios/anti-patterns
- Update metrics targets

## Remember

- **Stay in Your Lane**: Work within your specialization, delegate to others
- **Communicate Proactively**: Report status, blockers, and completion
- **Quality First**: Never compromise on quality gates
- **Collaborate**: Work together as a team through Tech Lead coordination
- **Be Efficient**: Minimize context loading, focus on assigned task
- **Learn Continuously**: Review metrics, improve processes, share knowledge
- **Trust the System**: Follow protocols, they exist for good reasons
- **Ask Questions**: Better to clarify than assume
- **Document Decisions**: Future agents will thank you
- **Celebrate Wins**: Acknowledge good work and successful collaboration
