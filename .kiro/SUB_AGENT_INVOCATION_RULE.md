# Sub-Agent Invocation Rule - Documentation

**Date Added**: 2026-03-07  
**Rule**: Sub-agents cannot invoke other sub-agents

## The Rule

**Sub-agents (specialized agents spawned by Tech Lead or Parent) are FORBIDDEN from invoking other sub-agents directly.**

- ❌ Sub-agents CANNOT invoke other sub-agents
- ✅ Sub-agents MUST request help from their parent agent (Tech Lead or Parent)
- ✅ Parent agent decides whether to invoke another sub-agent

## Why This Rule Exists

1. **Prevents uncontrolled agent spawning**: Without this rule, agents could spawn agents recursively, leading to resource exhaustion
2. **Maintains clear hierarchy**: Ensures supervision and coordination remain centralized
3. **Enables workload tracking**: Tech Lead can track all active agents and balance workload
4. **Prevents circular dependencies**: Avoids Agent A invoking Agent B which invokes Agent A
5. **Prevents deadlocks**: Avoids complex waiting chains between agents
6. **Centralizes decision-making**: Tech Lead makes informed decisions about which agents to involve

## Correct Workflow

```
Developer (needs help)
  → Requests help from Tech Lead
    → Tech Lead evaluates request
      → Tech Lead invokes QA Engineer
        → QA Engineer performs work
          → QA Engineer reports to Tech Lead
            → Tech Lead notifies Developer
```

## Incorrect Workflow (FORBIDDEN)

```
Developer → Directly invokes QA Engineer (VIOLATION!)
QA Engineer → Directly invokes Developer (VIOLATION!)
```

## Where This Rule Is Documented

### 1. AGENTS.md (Primary Steering File)

**Location**: Root of repository  
**Section 1**: "🚨 CRITICAL RULE: SUB-AGENTS CANNOT INVOKE OTHER SUB-AGENTS"  
**Section 2**: "For Specialized Agents (Developer, QA, DevOps, etc.)" → "🚨 CRITICAL: You CANNOT Invoke Other Sub-Agents"

**Audience**: All agents (parent and sub-agents)

**Content**:

- Clear statement of the rule
- Why it matters (prevents spawning, maintains hierarchy, etc.)
- Correct vs incorrect workflows with examples
- What to do instead (request help from Tech Lead)
- Example request messages
- Enforcement policy

### 2. .kiro/agents/developer.md (Developer Agent Definition)

**Location**: `.kiro/agents/developer.md`  
**Section**: "🚨 CRITICAL MANDATORY RULES - READ FIRST" → "RULE 4: YOU CANNOT INVOKE OTHER SUB-AGENTS"

**Audience**: Developer agents specifically

**Content**:

- Rule stated clearly for Developer context
- Why it matters
- What to do instead (request from Tech Lead)
- Example request message
- DO NOT and ALWAYS lists

### 3. Future: Other Agent Definitions

**Recommended**: Add similar RULE 4 to all specialized agent definitions:

- `.kiro/agents/qa-engineer.md`
- `.kiro/agents/devops.md`
- `.kiro/agents/data-architect.md`
- `.kiro/agents/security-engineer.md`
- `.kiro/agents/performance-engineer.md`
- `.kiro/agents/ux-ui-designer.md`
- `.kiro/agents/technical-writer.md`

**Template for other agents**:

```markdown
### RULE 4: YOU CANNOT INVOKE OTHER SUB-AGENTS (CRITICAL)

**As a [Agent Role] agent, you are FORBIDDEN from invoking other agents directly.**

**The Rule**:

- ❌ **You CANNOT invoke Developer, QA Engineer, DevOps, or any other agent**
- ✅ **You MUST request help from Tech Lead (your parent agent)**
- ✅ **Tech Lead will decide whether to invoke another agent**

**What To Do Instead**:

If you need help from another agent:

1. **Identify the need**: "I need help from [Agent Role]"
2. **Request from Tech Lead**: Send message to Tech Lead
3. **Explain the need**: Be specific about what you need
4. **Wait for Tech Lead**: Let Tech Lead coordinate
5. **Continue when ready**: Tech Lead will notify you

**Example Request**:

\`\`\`
STATUS: NEED HELP
Agent: [Your Role] [Your Number]
Task: [Task name]
Need Help From: [Other Agent Role]
Reason: [Specific reason]
Request: Please invoke [Other Agent Role] to [specific action]
\`\`\`

**DO NOT**:

- Attempt to invoke other agents yourself
- Use invokeSubAgent tool (you don't have access to it)
- Try to coordinate with other agents directly

**ALWAYS**:

- Request help through Tech Lead
- Explain clearly what you need
- Wait for Tech Lead to coordinate
```

## Enforcement

### Technical Enforcement

**Recommended Implementation**:

1. Sub-agents should not have access to `invokeSubAgent` tool
2. If they attempt to use it, return error: "Sub-agents cannot invoke other agents. Please request help from Tech Lead."
3. Log all attempted violations for monitoring

### Policy Enforcement

**Current**:

- Rule documented in AGENTS.md (automatically included in all agent contexts)
- Rule documented in Developer agent definition
- Violations will be caught by Tech Lead during coordination

**Future**:

- Add to all specialized agent definitions
- Add monitoring/logging for violation attempts
- Add automated checks in agent invocation system

## Examples

### Example 1: Developer Needs QA Help

**Correct**:

```
Developer: "Tech Lead, I've completed the authentication feature.
           I need QA Engineer to write integration tests for it.
           Files modified: lib/auth.ts, app/api/auth/route.ts"

Tech Lead: "Acknowledged. Invoking QA Engineer now."
           [Tech Lead invokes QA Engineer with task details]

QA Engineer: [Receives task from Tech Lead, writes tests]
```

**Incorrect**:

```
Developer: [Attempts to invoke QA Engineer directly]
System: ERROR - Sub-agents cannot invoke other agents
```

### Example 2: QA Finds Bug, Needs Developer

**Correct**:

```
QA Engineer: "Tech Lead, I found a bug in the payment processing.
              Error: Payment fails when amount is exactly $0.00
              Need Developer to fix this bug."

Tech Lead: "Acknowledged. Assigning to Developer 2."
           [Tech Lead invokes Developer 2 with bug details]

Developer 2: [Receives bug assignment from Tech Lead, fixes bug]
```

**Incorrect**:

```
QA Engineer: [Attempts to invoke Developer directly]
System: ERROR - Sub-agents cannot invoke other agents
```

### Example 3: Developer Needs Schema Change

**Correct**:

```
Developer: "Tech Lead, I need to add a new 'email_verified' column
            to the users table for the authentication feature.
            Need Data Architect to create migration."

Tech Lead: "Acknowledged. Invoking Data Architect."
           [Tech Lead invokes Data Architect with schema change request]

Data Architect: [Creates migration, reports back to Tech Lead]

Tech Lead: "Developer, migration created. You can now update your code."
```

## Benefits of This Rule

1. **Controlled Resource Usage**: Prevents exponential agent spawning
2. **Clear Accountability**: Tech Lead knows all active agents and their tasks
3. **Better Coordination**: Tech Lead can optimize task assignment and prevent conflicts
4. **Simplified Debugging**: Easier to trace agent interactions and issues
5. **Workload Balancing**: Tech Lead can distribute work evenly
6. **Prevents Deadlocks**: No circular waiting between agents
7. **Maintains Hierarchy**: Clear parent-child relationships

## Related Rules

- **AGENTS.md**: "🚨 CRITICAL RULE: ALWAYS INVOKE TECH LEAD FIRST" - Parent agents should invoke Tech Lead for coordination
- **AGENTS.md**: "For Specialized Agents" → "Communication" - How to request help from Tech Lead
- **Developer Agent**: "RULE 2: NEVER GET STUCK SILENTLY" - Escalate to Tech Lead after 5 minutes

## Revision History

- **2026-03-07**: Initial documentation
  - Added to AGENTS.md (2 sections)
  - Added to .kiro/agents/developer.md (RULE 4)
  - Created this documentation file

## Next Steps

1. ✅ Add rule to AGENTS.md (COMPLETE)
2. ✅ Add rule to Developer agent definition (COMPLETE)
3. ⏳ Add rule to all other specialized agent definitions (RECOMMENDED)
4. ⏳ Implement technical enforcement in agent invocation system (FUTURE)
5. ⏳ Add monitoring/logging for violation attempts (FUTURE)

---

**Maintained by**: Tech Lead  
**Last Updated**: 2026-03-07
