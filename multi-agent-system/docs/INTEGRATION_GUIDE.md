# Multi-Agent Infrastructure Integration Guide

This guide explains how the multi-agent orchestration infrastructure integrates with Kiro's agent lifecycle system, enabling structured communication, shared state management, workflow automation, and quality enforcement.

## Table of Contents

1. [Overview](#overview)
2. [How the Infrastructure Works](#how-the-infrastructure-works)
3. [Integration Architecture](#integration-architecture)
4. [Setup Instructions](#setup-instructions)
5. [Component Interaction](#component-interaction)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [Lifecycle Hooks](#lifecycle-hooks)
8. [AgentContext Injection](#agentcontext-injection)
9. [Common Use Cases](#common-use-cases)
10. [Troubleshooting](#troubleshooting)

## Overview

The multi-agent infrastructure provides a comprehensive orchestration layer for Kiro agents, enabling:

- **Structured Communication**: Agents communicate through MessageBus with priority queuing and acknowledgment
- **Conflict Prevention**: File locking prevents concurrent edit conflicts
- **Automated Coordination**: Workflows trigger automatically (feature→QA, bug fix, etc.)
- **Quality Enforcement**: Quality gates run automatically before task completion
- **Shared Knowledge**: Agents access shared project state and decisions
- **Observability**: Comprehensive logging and metrics for debugging

### Key Components

- **InfrastructureManager**: Singleton managing all infrastructure components
- **AgentContext**: API wrapper providing infrastructure access to agents
- **MessageBus**: Asynchronous message passing between agents
- **AgentRegistry**: Tracks all active agents and their capabilities
- **SharedContext**: Shared state management and file locking
- **WorkflowEngine**: Automated workflow coordination
- **QualityGates**: Automated quality enforcement
- **AgentHierarchy**: Parent-child relationship tracking
- **KiroIntegration**: Bridge between Kiro and infrastructure

## How the Infrastructure Works

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Kiro Agent System                           │
│                                                                 │
│  ┌──────────────┐         ┌──────────────────────────────┐    │
│  │ invokeSubAgent│────────▶│  KiroIntegration Hook        │    │
│  └──────────────┘         │  - initializeSession()       │    │
│                           │  - onAgentSpawn()            │    │
│                           │  - onAgentComplete()         │    │
│                           │  - onAgentFail()             │    │
│                           └──────────┬───────────────────┘    │
│                                      │                         │
└──────────────────────────────────────┼─────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Infrastructure Manager (Singleton)                 │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  MessageBus  │  │AgentRegistry │  │ SharedContext    │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │WorkflowEngine│  │ QualityGates │  │AgentHierarchy    │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Context                              │
│                                                                 │
│  Provides APIs to spawned agents:                              │
│  - sendMessage / onMessage / acknowledgeMessage                │
│  - getSharedContext / updateProjectState                       │
│  - acquireFileLock / releaseFileLock                           │
│  - updateStatus / getAgentsByRole                              │
│  - triggerWorkflowEvent / runQualityGates                      │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**InfrastructureManager**

- Initializes all infrastructure components on first access
- Provides singleton access to MessageBus, AgentRegistry, SharedContext, etc.
- Tracks infrastructure health status
- Manages component lifecycle and cleanup

**AgentContext**

- Wraps infrastructure APIs for agent consumption
- Enforces permissions based on agent role
- Tracks agent identity (ID and role)
- Provides simplified API surface for agents

**MessageBus**

- Routes messages between agents with priority queuing
- Handles message acknowledgment and retry logic
- Enforces communication permissions
- Maintains dead letter queue for failed deliveries

**AgentRegistry**

- Tracks all active agents and their metadata
- Provides agent lookup by ID or role
- Manages agent status (idle, busy, blocked, offline)
- Validates agent capabilities and permissions

**SharedContext**

- Manages shared project state with atomic updates
- Provides file locking with read/write semantics
- Tracks work items and their status
- Maintains knowledge base of decisions

**WorkflowEngine**

- Evaluates workflow rules on events
- Automatically triggers agent coordination
- Supports common workflows (feature→QA, bug fix, etc.)
- Isolates errors to prevent cascade failures

**QualityGates**

- Runs quality checks (build, test, lint, type-check)
- Executes gates in parallel for performance
- Provides detailed failure reporting
- Triggers reassignment on failure

**AgentHierarchy**

- Tracks parent-child relationships between agents
- Routes escalations to parent agents
- Supports cascade termination
- Provides hierarchy statistics

**KiroIntegration**

- Bridges Kiro's agent lifecycle with infrastructure
- Initializes infrastructure on session start
- Creates and injects AgentContext on agent spawn
- Triggers workflows and quality gates on completion
- Handles cleanup on agent failure

## Integration Architecture

### Kiro Plugin Integration

The infrastructure integrates with Kiro through a plugin located at `kiro-plugins/multi-agent-orchestration/`. The plugin implements Kiro's lifecycle hooks:

1. **onKiroStart()** - Called once when Kiro starts
   - Initializes InfrastructureManager singleton
   - Sets up all infrastructure components
   - Verifies infrastructure health

2. **beforeAgentSpawn(agentId, role, config)** - Called before spawning an agent
   - Creates AgentContext for the agent
   - Registers agent in AgentRegistry
   - Records parent-child relationships in AgentHierarchy
   - Injects AgentContext into agent config

3. **afterAgentComplete(agentId, result)** - Called when agent completes
   - Triggers workflow automation events
   - Runs quality gates for developer agents
   - Updates agent status to idle
   - Logs completion with full context

4. **onAgentFail(agentId, error)** - Called when agent fails
   - Updates agent status to offline
   - Releases all file locks held by agent
   - Removes agent from hierarchy
   - Triggers error recovery workflows

### Lifecycle Hook Flow

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. onKiroStart()                                            │
│    - Initialize InfrastructureManager                       │
│    - Setup MessageBus, AgentRegistry, SharedContext, etc.   │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. beforeAgentSpawn(agentId, role, config)                  │
│    - Create AgentContext(agentId, role)                     │
│    - Register agent in AgentRegistry                        │
│    - Record parent-child relationship                       │
│    - Inject AgentContext into config                        │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Agent Executes with AgentContext                         │
│    - Agent can call agentContext.sendMessage()              │
│    - Agent can call agentContext.acquireFileLock()          │
│    - Agent can call agentContext.getSharedContext()         │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. afterAgentComplete(agentId, result)                      │
│    - Trigger workflow automation                            │
│    - Run quality gates (if developer)                       │
│    - Update agent status                                    │
│    - Log completion                                         │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
   Done
```

### AgentContext Injection Mechanism

When an agent is spawned, the KiroIntegration hook creates an AgentContext and injects it into the agent's execution environment:

```typescript
// In KiroIntegration.onAgentSpawn()
const agentContext = new AgentContext(agentId, role);

// Register agent in registry
agentRegistry.registerAgent({
  id: agentId,
  role,
  status: 'idle',
  capabilities: getCapabilitiesForRole(role),
  workload: 0,
});

// Record parent-child relationship
if (parentId) {
  agentHierarchy.recordRelationship(parentId, agentId);
}

// Inject into agent config
config.agentContext = agentContext;

// Return modified config to Kiro
return config;
```

The agent can then access the infrastructure through the injected context:

```typescript
// In agent execution
const agentContext = config.agentContext;

// Use infrastructure APIs
await agentContext.sendMessage('qa-engineer-1', {
  type: 'request',
  payload: { action: 'test-feature', featureId: 'auth' },
});
```

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Kiro agent system installed
- Multi-agent infrastructure code in `multi-agent-system/`
- Plugin code in `kiro-plugins/multi-agent-orchestration/`

### Installation Steps

1. **Install Dependencies**

```bash
cd multi-agent-system
npm install
```

2. **Build Infrastructure**

```bash
npm run build
```

3. **Configure Environment Variables**

Create or update `.env` file:

```bash
# Enable multi-agent infrastructure (default: true)
ENABLE_MULTI_AGENT_INFRASTRUCTURE=true

# Set log level (default: info)
# Options: debug, info, warn, error
MULTI_AGENT_LOG_LEVEL=info
```

4. **Verify Plugin Installation**

Check that the plugin exists:

```bash
ls -la kiro-plugins/multi-agent-orchestration/
# Should show: index.ts, README.md, package.json
```

5. **Test Infrastructure**

Run the test suite to verify everything works:

```bash
npm run test:run
```

### Configuration Options

#### Environment Variables

**ENABLE_MULTI_AGENT_INFRASTRUCTURE**

- Type: `boolean`
- Default: `true`
- Description: Enable or disable the multi-agent infrastructure
- When disabled: Kiro functions normally without infrastructure

**MULTI_AGENT_LOG_LEVEL**

- Type: `string`
- Default: `info`
- Options: `debug`, `info`, `warn`, `error`
- Description: Controls logging verbosity for infrastructure components

#### Example Configurations

**Development (Verbose Logging)**

```bash
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=true
export MULTI_AGENT_LOG_LEVEL=debug
```

**Production (Minimal Logging)**

```bash
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=true
export MULTI_AGENT_LOG_LEVEL=warn
```

**Disabled (Backward Compatibility)**

```bash
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=false
```

### Verification Steps

After setup, verify the infrastructure is working:

1. **Check Infrastructure Initialization**

```bash
# Start Kiro and check logs
# Should see: "[InfrastructureManager] Initializing multi-agent infrastructure..."
# Should see: "[InfrastructureManager] Infrastructure initialized successfully"
```

2. **Verify Component Health**

```typescript
// In any agent or test
const infrastructure = InfrastructureManager.getInstance();
const status = infrastructure.getStatus();

console.log('Infrastructure Status:', status);
// Should show healthy metrics for all components
```

3. **Test Agent Spawning**

```typescript
// Spawn a test agent
const integration = new KiroIntegration();
await integration.initializeSession();

const agentContext = await integration.onAgentSpawn('test-agent', 'developer');

console.log('Agent ID:', agentContext.getAgentId());
console.log('Agent Role:', agentContext.getRole());
// Should show: test-agent, developer
```

4. **Test Message Passing**

```typescript
// Create two agents
const agent1 = await integration.onAgentSpawn('agent-1', 'developer');
const agent2 = await integration.onAgentSpawn('agent-2', 'qa-engineer');

// Subscribe to messages
agent2.onMessage((message) => {
  console.log('Received message:', message);
});

// Send message
await agent1.sendMessage('agent-2', {
  type: 'request',
  payload: { test: 'hello' },
});

// Should see: "Received message: { from: 'agent-1', ... }"
```

5. **Test File Locking**

```typescript
// Acquire lock
const locked = await agent1.acquireFileLock('test.ts', 'write', 5000);
console.log('Lock acquired:', locked); // Should be true

// Try to acquire same lock (should timeout)
try {
  await agent2.acquireFileLock('test.ts', 'write', 100);
} catch (error) {
  console.log('Lock blocked:', error.message); // Should show timeout error
}

// Release lock
agent1.releaseFileLock('test.ts');
```

## Component Interaction

### Message Passing Flow

```
Agent A                    MessageBus                    Agent B
   │                           │                            │
   │ sendMessage(B, payload)   │                            │
   ├──────────────────────────▶│                            │
   │                           │                            │
   │                           │ 1. Validate permissions    │
   │                           │    (A can communicate      │
   │                           │     with B?)               │
   │                           │                            │
   │                           │ 2. Create message with ID  │
   │                           │                            │
   │                           │ 3. Add to priority queue   │
   │                           │                            │
   │                           │ 4. Invoke B's onMessage()  │
   │                           ├───────────────────────────▶│
   │                           │                            │
   │                           │                            │ 5. Process message
   │                           │                            │
   │                           │ 6. acknowledgeMessage()    │
   │                           │◀───────────────────────────┤
   │                           │                            │
   │                           │ 7. Mark acknowledged       │
   │                           │                            │
```

### File Locking Flow

```
Agent A                    SharedContext                  Agent B
   │                           │                            │
   │ acquireFileLock(file, W)  │                            │
   ├──────────────────────────▶│                            │
   │                           │                            │
   │                           │ 1. Check existing locks    │
   │                           │    No conflicts found      │
   │                           │                            │
   │                           │ 2. Create lock record      │
   │                           │                            │
   │◀──────────────────────────┤ 3. Return true             │
   │                           │                            │
   │ Edit file                 │                            │
   │                           │                            │
   │                           │ acquireFileLock(file, W)   │
   │                           │◀───────────────────────────┤
   │                           │                            │
   │                           │ 4. Lock held by A          │
   │                           │    Wait for timeout        │
   │                           │                            │
   │ releaseFileLock(file)     │                            │
   ├──────────────────────────▶│                            │
   │                           │                            │
   │                           │ 5. Remove lock             │
   │                           │                            │
   │                           │ 6. Return true to B        │
   │                           ├───────────────────────────▶│
   │                           │                            │
```

### Workflow Automation Flow

```
Developer Agent            WorkflowEngine              QA Agent
      │                         │                         │
      │ Complete feature        │                         │
      ├────────────────────────▶│                         │
      │                         │                         │
      │                         │ 1. Receive event        │
      │                         │    type: work-complete  │
      │                         │                         │
      │                         │ 2. Evaluate rules       │
      │                         │    Match: feature-to-qa │
      │                         │                         │
      │                         │ 3. Execute actions      │
      │                         │    invoke-agent: qa     │
      │                         │                         │
      │                         │ 4. Spawn QA agent       │
      │                         ├────────────────────────▶│
      │                         │                         │
      │                         │                         │ 5. Test feature
      │                         │                         │
```

### Quality Gates Flow

```
Developer Agent            QualityGates              Tech Lead
      │                         │                         │
      │ Complete task           │                         │
      ├────────────────────────▶│                         │
      │                         │                         │
      │                         │ 1. Run gates in parallel│
      │                         │    - Build              │
      │                         │    - Test               │
      │                         │    - Lint               │
      │                         │    - Type-check         │
      │                         │                         │
      │                         │ 2. Aggregate results    │
      │                         │                         │
      │◀────────────────────────┤ 3. Return result        │
      │                         │                         │
      │ If failed:              │                         │
      ├─────────────────────────┼────────────────────────▶│
      │ Escalate to Tech Lead   │                         │
```

## Data Flow Diagrams

### Agent Spawning with Infrastructure

```
1. Parent Agent calls invokeSubAgent(role, task)
                    │
                    ▼
2. KiroIntegration.onAgentSpawn() hook executes
                    │
                    ├─▶ Initialize Infrastructure (if first agent)
                    │   └─▶ InfrastructureManager.getInstance()
                    │       - Create MessageBus
                    │       - Create AgentRegistry
                    │       - Create SharedContext
                    │       - Create WorkflowEngine
                    │       - Create QualityGates
                    │       - Create AgentHierarchy
                    │
                    ├─▶ Register agent in AgentRegistry
                    │   └─▶ agentRegistry.registerAgent(id, role, capabilities)
                    │
                    ├─▶ Record parent-child relationship
                    │   └─▶ agentHierarchy.recordRelationship(parentId, childId)
                    │
                    └─▶ Create AgentContext
                        └─▶ new AgentContext(agentId, role)
                    │
                    ▼
3. Inject AgentContext into agent's execution environment
                    │
                    ▼
4. Agent executes with infrastructure access
   - Can call agentContext.sendMessage()
   - Can call agentContext.acquireFileLock()
   - Can call agentContext.getSharedContext()
   - Can call agentContext.updateStatus()
   - Can call agentContext.triggerWorkflowEvent()
                    │
                    ▼
5. Agent completes task
                    │
                    ▼
6. KiroIntegration.onAgentComplete() hook executes
                    │
                    ├─▶ Trigger workflow automation
                    │   └─▶ workflowEngine.processEvent('work-complete')
                    │       - Evaluate all rules
                    │       - Execute matching actions
                    │       - Spawn follow-up agents if needed
                    │
                    ├─▶ Run quality gates (if developer)
                    │   └─▶ qualityGates.runGates(agentId, workItemId)
                    │       - Run build, test, lint, type-check
                    │       - Aggregate results
                    │       - Trigger reassignment if failed
                    │
                    └─▶ Update agent status to idle
                        └─▶ agentRegistry.updateStatus(agentId, 'idle')
```

### Complete Feature Implementation Workflow

```
Tech Lead                Developer              QA Engineer
    │                        │                       │
    │ 1. Assign feature      │                       │
    ├───────────────────────▶│                       │
    │                        │                       │
    │                        │ 2. Implement feature  │
    │                        │    - Acquire locks    │
    │                        │    - Write code       │
    │                        │    - Release locks    │
    │                        │                       │
    │                        │ 3. Complete           │
    │                        ├──────────────────────▶│
    │                        │    (workflow trigger) │
    │                        │                       │
    │                        │                       │ 4. Test feature
    │                        │                       │    - Run tests
    │                        │                       │    - Verify behavior
    │                        │                       │
    │                        │                       │ 5. Complete
    │◀───────────────────────┼───────────────────────┤
    │ 6. Feature done        │                       │
```

### Bug Fix Workflow

```
QA Engineer              Tech Lead              Developer
    │                        │                       │
    │ 1. Find bug            │                       │
    ├───────────────────────▶│                       │
    │                        │                       │
    │                        │ 2. Assign to dev      │
    │                        ├──────────────────────▶│
    │                        │                       │
    │                        │                       │ 3. Fix bug
    │                        │                       │    - Acquire locks
    │                        │                       │    - Fix code
    │                        │                       │    - Release locks
    │                        │                       │
    │                        │                       │ 4. Complete
    │◀───────────────────────┼───────────────────────┤
    │    (workflow trigger)  │                       │
    │                        │                       │
    │ 5. Verify fix          │                       │
    │                        │                       │
    │ 6. Complete            │                       │
    ├───────────────────────▶│                       │
    │                        │                       │
```

## Lifecycle Hooks

### onKiroStart()

**Purpose**: Initialize infrastructure when Kiro starts

**When Called**: Once at Kiro startup, before any agents are spawned

**What It Does**:

1. Creates InfrastructureManager singleton
2. Initializes all infrastructure components
3. Verifies infrastructure health
4. Logs initialization status

**Performance**: Must complete within 100ms

**Example**:

```typescript
const integration = new KiroIntegration();
await integration.initializeSession();

// Infrastructure is now ready for agent spawning
```

**Error Handling**:

- If initialization fails, plugin disables itself
- Kiro continues to function without infrastructure
- Error is logged with full context

### beforeAgentSpawn(agentId, role, config)

**Purpose**: Create and inject AgentContext when agent spawns

**When Called**: Before each agent is spawned

**Parameters**:

- `agentId`: Unique identifier for the agent
- `role`: Agent role (developer, qa-engineer, etc.)
- `config`: Agent configuration object

**What It Does**:

1. Creates AgentContext for the agent
2. Registers agent in AgentRegistry
3. Records parent-child relationship (if parentId provided)
4. Injects AgentContext into config
5. Returns modified config

**Returns**: Modified config with AgentContext injected

**Example**:

```typescript
const agentContext = await integration.onAgentSpawn('dev-1', 'developer', {
  parentId: 'tech-lead-1',
});

// Agent can now use agentContext APIs
await agentContext.sendMessage('qa-1', { payload: { test: true } });
```

**Error Handling**:

- If AgentContext creation fails, returns original config
- Agent runs without infrastructure access
- Error is logged with full context

### afterAgentComplete(agentId, result)

**Purpose**: Trigger workflows and quality gates when agent completes

**When Called**: After agent completes its task successfully

**Parameters**:

- `agentId`: ID of the agent that completed
- `result`: Result data from agent execution

**What It Does**:

1. Triggers workflow automation events
2. Runs quality gates (if agent is developer)
3. Updates agent status to idle
4. Logs completion with full context

**Example**:

```typescript
await integration.onAgentComplete('dev-1', {
  workItemId: 'feature-auth',
  filesModified: ['src/auth.ts'],
  status: 'complete',
});

// Workflow engine evaluates rules and may spawn QA agent
// Quality gates run if agent is developer
```

**Error Handling**:

- Workflow errors are logged but don't fail completion
- Quality gate errors are logged and reported
- Agent completion succeeds even if workflows fail

### onAgentFail(agentId, error)

**Purpose**: Handle agent failures and cleanup resources

**When Called**: When agent fails, crashes, or times out

**Parameters**:

- `agentId`: ID of the agent that failed
- `error`: Error that caused the failure

**What It Does**:

1. Updates agent status to offline
2. Releases all file locks held by agent
3. Removes agent from hierarchy
4. Triggers error recovery workflows
5. Logs failure with full context

**Example**:

```typescript
await integration.onAgentFail('dev-1', new Error('Timeout'));

// All locks released
// Agent removed from hierarchy
// Parent notified of failure
```

**Error Handling**:

- Cleanup errors are logged but don't fail the handler
- Ensures resources are released even if cleanup partially fails
- Parent agent is notified of failure

## AgentContext Injection

### How Injection Works

When an agent is spawned, the KiroIntegration hook creates an AgentContext and injects it into the agent's configuration:

```typescript
// 1. KiroIntegration creates AgentContext
const agentContext = new AgentContext(agentId, role);

// 2. Register agent in registry
agentRegistry.registerAgent({
  id: agentId,
  role,
  status: 'idle',
  capabilities: ['write-code', 'fix-bugs', ...],
  workload: 0,
});

// 3. Inject into config
config.agentContext = agentContext;

// 4. Return modified config to Kiro
return config;
```

### Accessing AgentContext in Agents

Agents can access the infrastructure through the injected context:

```typescript
// In agent system prompt or execution
const agentContext = config.agentContext;

// Check if infrastructure is available
if (agentContext) {
  // Use infrastructure APIs
  await agentContext.sendMessage('qa-1', {
    type: 'request',
    payload: { action: 'test-feature' },
  });
} else {
  // Fallback: infrastructure not available
  console.log('Infrastructure not available, using direct invocation');
}
```

### AgentContext API Surface

The AgentContext provides these API categories:

**Identity APIs**

- `getAgentId()`: Get agent's unique ID
- `getRole()`: Get agent's role

**Message APIs**

- `sendMessage(to, message)`: Send message to another agent
- `onMessage(callback)`: Subscribe to incoming messages
- `getMessages()`: Get pending messages
- `acknowledgeMessage(messageId)`: Acknowledge message receipt

**Shared Context APIs**

- `getSharedContext()`: Get SharedContext manager
- `getProjectState()`: Get current project state
- `updateProjectState(updates)`: Update project state
- `getWorkItem(id)`: Get work item by ID
- `updateWorkItem(id, updates)`: Update work item
- `addDecision(decision)`: Add decision to knowledge base
- `queryKnowledgeBase(query)`: Query knowledge base

**File Locking APIs**

- `acquireFileLock(file, mode, timeout)`: Acquire file lock
- `releaseFileLock(file)`: Release file lock

**Agent Registry APIs**

- `getAgentRegistry()`: Get AgentRegistry
- `updateStatus(status)`: Update agent's status
- `getAgentsByRole(role)`: Get agents by role
- `getAgent(agentId)`: Get agent by ID
- `canPerformAction(action)`: Check if agent can perform action

**Workflow APIs**

- `triggerWorkflowEvent(event)`: Trigger workflow event

**Quality Gates APIs**

- `runQualityGates(workItemId)`: Run quality gates

**Hierarchy APIs**

- `getChildAgents()`: Get child agents
- `getParentAgent()`: Get parent agent
- `escalateToParent(message)`: Escalate to parent
- `getDescendants()`: Get all descendants
- `getAncestors()`: Get all ancestors

**Utility APIs**

- `log(message, data)`: Log message
- `getInfrastructureStatus()`: Get infrastructure status

## Common Use Cases

### Use Case 1: Send Message to Another Agent

```typescript
// Developer sends message to QA Engineer
await agentContext.sendMessage('qa-engineer-1', {
  type: 'request',
  priority: 'high',
  payload: {
    action: 'test-feature',
    featureId: 'auth',
    filesModified: ['src/auth.ts', 'tests/auth.test.ts'],
  },
});
```

### Use Case 2: Acquire File Lock Before Editing

```typescript
// Acquire write lock before editing file
const locked = await agentContext.acquireFileLock('src/auth.ts', 'write', 5000);

if (locked) {
  // Edit file safely
  await editFile('src/auth.ts', changes);

  // Release lock when done
  agentContext.releaseFileLock('src/auth.ts');
} else {
  // Lock acquisition failed
  console.log('Could not acquire lock, file is being edited by another agent');
}
```

### Use Case 3: Update Shared Project State

```typescript
// Update build status in shared state
agentContext.updateProjectState({
  buildStatus: 'passing',
  lastBuildTime: new Date(),
  testCoverage: 85,
});

// Later, another agent can read this state
const state = agentContext.getProjectState();
console.log('Build status:', state.buildStatus);
```

### Use Case 4: Query Available Agents

```typescript
// Find available QA engineers
const qaEngineers = agentContext.getAgentsByRole('qa-engineer');

// Filter for idle agents
const availableQA = qaEngineers.filter((agent) => agent.status === 'idle');

if (availableQA.length > 0) {
  // Send work to first available QA
  await agentContext.sendMessage(availableQA[0].id, {
    type: 'request',
    payload: { action: 'test-feature' },
  });
}
```

### Use Case 5: Escalate to Parent Agent

```typescript
// Child agent encounters blocker
const parentId = agentContext.getParentAgent();

if (parentId) {
  // Escalate to parent
  const escalated = agentContext.escalateToParent(
    'Blocked: Need schema change for user authentication'
  );

  if (escalated) {
    console.log('Escalated to parent agent');
  }
}
```

### Use Case 6: Run Quality Gates

```typescript
// Developer completes work item
const workItemId = 'feature-auth';

// Run quality gates
const result = await agentContext.runQualityGates(workItemId);

if (result.passed) {
  console.log('All quality gates passed');
  // Mark work item complete
  agentContext.updateWorkItem(workItemId, { status: 'complete' });
} else {
  console.log('Quality gates failed:', result.failedGates);
  // Fix issues and retry
}
```

### Use Case 7: Add Decision to Knowledge Base

```typescript
// Record architectural decision
agentContext.addDecision({
  title: 'Use JWT for authentication',
  description: 'Implement JWT-based authentication for API endpoints',
  rationale: 'JWT provides stateless authentication and scales well',
  alternatives: ['Session-based auth', 'OAuth2'],
  tags: ['authentication', 'security', 'architecture'],
});

// Later, query knowledge base
const decisions = agentContext.queryKnowledgeBase('authentication');
console.log('Found decisions:', decisions);
```

### Use Case 8: Subscribe to Messages

```typescript
// Subscribe to incoming messages
agentContext.onMessage(async (message) => {
  console.log('Received message from:', message.from);
  console.log('Message type:', message.type);
  console.log('Payload:', message.payload);

  // Process message based on type
  if (message.type === 'request') {
    // Handle request
    await handleRequest(message.payload);

    // Acknowledge message
    await agentContext.acknowledgeMessage(message.id);

    // Send response
    await agentContext.sendMessage(message.from, {
      type: 'response',
      payload: { status: 'complete' },
      parentMessageId: message.id,
    });
  }
});
```

## Troubleshooting

### Infrastructure Not Initializing

**Symptoms**:

- No initialization logs in console
- AgentContext not available in agents
- Infrastructure APIs throw errors

**Possible Causes**:

1. `ENABLE_MULTI_AGENT_INFRASTRUCTURE` set to `false`
2. Plugin not loaded by Kiro
3. Initialization error during startup

**Solutions**:

```bash
# 1. Check environment variable
echo $ENABLE_MULTI_AGENT_INFRASTRUCTURE
# Should be: true

# 2. Check plugin exists
ls -la kiro-plugins/multi-agent-orchestration/
# Should show: index.ts, README.md

# 3. Enable debug logging
export MULTI_AGENT_LOG_LEVEL=debug

# 4. Check Kiro logs for errors
# Look for: "[InfrastructureManager] Initializing..."
```

### AgentContext Not Available

**Symptoms**:

- `config.agentContext` is undefined
- Cannot call infrastructure APIs
- Agent runs without infrastructure

**Possible Causes**:

1. Infrastructure not initialized
2. Agent spawned before initialization
3. Error during AgentContext creation

**Solutions**:

```typescript
// 1. Check if AgentContext exists
if (!config.agentContext) {
  console.log('AgentContext not available');
  // Use fallback behavior
}

// 2. Verify infrastructure initialized
const integration = new KiroIntegration();
console.log('Initialized:', integration.isInitialized());

// 3. Check logs for errors
// Look for: "[KiroIntegration] Failed to spawn agent"
```

### Message Not Delivered

**Symptoms**:

- Message sent but not received
- onMessage callback not invoked
- Message in dead letter queue

**Possible Causes**:

1. Recipient not subscribed to messages
2. Permission violation (sender cannot communicate with recipient)
3. Recipient agent offline
4. Message delivery failed after retries

**Solutions**:

```typescript
// 1. Verify recipient subscribed
recipientContext.onMessage((msg) => {
  console.log('Received:', msg);
});

// 2. Check permissions
const sender = agentContext.getAgent(senderId);
const recipient = agentContext.getAgent(recipientId);
console.log('Can communicate:', sender.canCommunicateWith.includes(recipient.role));

// 3. Check recipient status
const recipient = agentContext.getAgent(recipientId);
console.log('Recipient status:', recipient.status);
// Should be: idle or busy (not offline)

// 4. Check dead letter queue
const infrastructure = InfrastructureManager.getInstance();
const dlq = infrastructure.getMessageBus().getDeadLetterQueue();
console.log('Dead letter queue:', dlq);
```

### File Lock Timeout

**Symptoms**:

- `acquireFileLock()` throws TimeoutError
- Cannot acquire lock within timeout
- File appears locked by another agent

**Possible Causes**:

1. Another agent holds write lock
2. Multiple agents hold read locks (trying to acquire write)
3. Lock not released properly
4. Timeout too short

**Solutions**:

```typescript
// 1. Check who holds the lock
try {
  await agentContext.acquireFileLock('src/auth.ts', 'write', 5000);
} catch (error) {
  if (error.name === 'TimeoutError') {
    console.log('Lock held by:', error.lockHolder);
    console.log('Acquired at:', error.acquiredAt);

    // Option 1: Wait and retry
    await sleep(5000);
    await agentContext.acquireFileLock('src/auth.ts', 'write', 5000);

    // Option 2: Escalate to parent
    agentContext.escalateToParent(
      `Cannot acquire lock on src/auth.ts, held by ${error.lockHolder}`
    );
  }
}

// 2. Increase timeout
await agentContext.acquireFileLock('src/auth.ts', 'write', 30000); // 30 seconds

// 3. Check for orphaned locks
const infrastructure = InfrastructureManager.getInstance();
const locks = infrastructure.getSharedContext().getAgentLocks(agentId);
console.log('Active locks:', locks);
```

### Quality Gates Failing

**Symptoms**:

- Quality gates return `passed: false`
- Specific gates failing (build, test, lint, etc.)
- Task not marked complete

**Possible Causes**:

1. Code has actual issues (build errors, test failures, etc.)
2. Quality gate commands not configured correctly
3. Quality gate timeout too short
4. Environment issues (missing dependencies, etc.)

**Solutions**:

```typescript
// 1. Check which gates failed
const result = await agentContext.runQualityGates(workItemId);
console.log('Failed gates:', result.failedGates);

for (const gate of result.failedGates) {
  console.log(`Gate: ${gate.name}`);
  console.log(`Error: ${gate.error}`);
  console.log(`Output: ${gate.output}`);
}

// 2. Run gates manually to debug
// npm run build
// npm run test:run
// npm run lint
// npm run type-check

// 3. Check gate configuration
const infrastructure = InfrastructureManager.getInstance();
const gates = infrastructure.getQualityGates().getAllGates();
console.log('Configured gates:', gates);
```

### Workflow Not Triggering

**Symptoms**:

- Agent completes but follow-up agent not spawned
- Workflow event not processed
- Expected automation not happening

**Possible Causes**:

1. Workflow rule not registered
2. Event doesn't match rule conditions
3. Workflow engine error
4. Action execution failed

**Solutions**:

```typescript
// 1. Check registered rules
const infrastructure = InfrastructureManager.getInstance();
const rules = infrastructure.getWorkflowEngine().getRules();
console.log('Registered rules:', rules);

// 2. Manually trigger event to test
await agentContext.triggerWorkflowEvent({
  type: 'work-complete',
  data: {
    agentId: 'dev-1',
    role: 'developer',
    workItemId: 'feature-auth',
  },
});

// 3. Check logs for workflow errors
// Look for: "[WorkflowEngine] Rule execution failed"

// 4. Enable debug logging
export MULTI_AGENT_LOG_LEVEL=debug
```

### Performance Issues

**Symptoms**:

- Infrastructure initialization slow (>100ms)
- Message delivery slow (>10ms overhead)
- File lock acquisition slow (>50ms)
- Quality gates slow (>30s)

**Possible Causes**:

1. Too many agents registered
2. Large message queue backlog
3. Many file locks held
4. Quality gate commands slow

**Solutions**:

```typescript
// 1. Check infrastructure status
const status = infrastructure.getStatus();
console.log('Status:', status);

// Look for:
// - High queue depth (>100 messages)
// - Many active agents (>50)
// - Many file locks (>20)

// 2. Monitor performance
const startTime = Date.now();
await agentContext.sendMessage('qa-1', { payload: {} });
const duration = Date.now() - startTime;
console.log('Message send duration:', duration, 'ms');

// 3. Profile quality gates
const result = await agentContext.runQualityGates(workItemId);
console.log('Quality gates execution time:', result.executionTime, 'ms');

for (const gate of result.results) {
  console.log(`${gate.name}: ${gate.executionTime}ms`);
}
```

### Getting Help

If you encounter issues not covered here:

1. **Check Logs**: Enable debug logging with `MULTI_AGENT_LOG_LEVEL=debug`
2. **Check Status**: Call `infrastructure.getStatus()` to see component health
3. **Run Tests**: Run `npm run test:run` to verify infrastructure works
4. **Check Documentation**: See [API_REFERENCE.md](./API_REFERENCE.md) for detailed API docs
5. **Report Issue**: File an issue with logs, status output, and reproduction steps

## See Also

- [API Reference](./API_REFERENCE.md) - Detailed API documentation
- [Plugin README](../../kiro-plugins/multi-agent-orchestration/README.md) - Plugin configuration
- [Design Document](../../.kiro/specs/multi-agent-kiro-integration/design.md) - Architecture details
- [Troubleshooting Guide](../TROUBLESHOOTING.md) - Additional troubleshooting tips
