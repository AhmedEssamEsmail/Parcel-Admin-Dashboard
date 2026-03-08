# Multi-Agent Infrastructure API Reference

Complete API documentation for the multi-agent orchestration infrastructure.

## Table of Contents

1. [AgentContext API](#agentcontext-api)
2. [InfrastructureManager API](#infrastructuremanager-api)
3. [KiroIntegration API](#kirointegration-api)
4. [MessageBus API](#messagebus-api)
5. [AgentRegistry API](#agentregistry-api)
6. [SharedContext API](#sharedcontext-api)
7. [WorkflowEngine API](#workflowengine-api)
8. [QualityGates API](#qualitygates-api)
9. [AgentHierarchy API](#agenthierarchy-api)
10. [Type Definitions](#type-definitions)

## AgentContext API

The AgentContext provides infrastructure APIs to spawned agents in a controlled way.

### Constructor

```typescript
new AgentContext(agentId: string, role: AgentRole)
```

Creates a new AgentContext for an agent.

**Parameters**:

- `agentId` (string): Unique identifier for the agent
- `role` (AgentRole): Role of the agent (developer, qa-engineer, etc.)

**Example**:

```typescript
const agentContext = new AgentContext('dev-1', 'developer');
```

---

### Identity Methods

#### getAgentId()

```typescript
getAgentId(): string
```

Returns the agent's unique identifier.

**Returns**: Agent ID string

**Example**:

```typescript
const agentId = agentContext.getAgentId();
console.log('Agent ID:', agentId); // "dev-1"
```

---

#### getRole()

```typescript
getRole(): AgentRole
```

Returns the agent's role.

**Returns**: AgentRole enum value

**Example**:

```typescript
const role = agentContext.getRole();
console.log('Agent role:', role); // "developer"
```

---

### Message API

#### sendMessage()

```typescript
async sendMessage(
  to: string,
  message: {
    type?: 'request' | 'response' | 'notification' | 'escalation';
    priority?: 'low' | 'normal' | 'high' | 'critical';
    payload: Record<string, unknown>;
    threadId?: string;
    parentMessageId?: string;
  }
): Promise<void>
```

Sends a message to another agent through the MessageBus.

**Parameters**:

- `to` (string): Recipient agent ID
- `message` (object): Message configuration
  - `type` (optional): Message type (default: 'request')
  - `priority` (optional): Message priority (default: 'normal')
  - `payload` (required): Message data
  - `threadId` (optional): Thread ID for conversation tracking
  - `parentMessageId` (optional): Parent message ID for replies

**Returns**: Promise that resolves when message is queued

**Example**:

```typescript
await agentContext.sendMessage('qa-engineer-1', {
  type: 'request',
  priority: 'high',
  payload: {
    action: 'test-feature',
    featureId: 'auth',
    filesModified: ['src/auth.ts'],
  },
});
```

**See Also**: [onMessage()](#onmessage), [acknowledgeMessage()](#acknowledgemessage)

---

#### onMessage()

```typescript
onMessage(callback: (message: AgentMessage) => void | Promise<void>): void
```

Subscribes to incoming messages for this agent.

**Parameters**:

- `callback` (function): Function to call when message received
  - Receives `AgentMessage` object
  - Can be async

**Example**:

```typescript
agentContext.onMessage(async (message) => {
  console.log('Received message from:', message.from);
  console.log('Message type:', message.type);
  console.log('Payload:', message.payload);

  // Process message
  if (message.type === 'request') {
    await handleRequest(message.payload);

    // Acknowledge receipt
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

**See Also**: [sendMessage()](#sendmessage), [acknowledgeMessage()](#acknowledgemessage)

---

#### getMessages()

```typescript
async getMessages(): Promise<AgentMessage[]>
```

Gets pending messages for this agent.

**Returns**: Promise resolving to array of AgentMessage objects

**Note**: Messages are typically delivered via `onMessage()` callback. This method is provided for polling-based message retrieval.

**Example**:

```typescript
const messages = await agentContext.getMessages();
console.log('Pending messages:', messages.length);

for (const message of messages) {
  console.log('From:', message.from);
  console.log('Payload:', message.payload);
}
```

---

#### acknowledgeMessage()

```typescript
async acknowledgeMessage(messageId: string): Promise<void>
```

Acknowledges receipt of a message.

**Parameters**:

- `messageId` (string): ID of the message to acknowledge

**Returns**: Promise that resolves when message is acknowledged

**Example**:

```typescript
agentContext.onMessage(async (message) => {
  // Process message
  await processMessage(message);

  // Acknowledge receipt
  await agentContext.acknowledgeMessage(message.id);
});
```

**See Also**: [onMessage()](#onmessage)

---

### Shared Context API

#### getSharedContext()

```typescript
getSharedContext(): SharedContextManager
```

Gets direct access to the SharedContextManager.

**Returns**: SharedContextManager instance

**Example**:

```typescript
const sharedContext = agentContext.getSharedContext();
const workItems = sharedContext.getAllWorkItems();
console.log('Total work items:', workItems.length);
```

**See Also**: [getProjectState()](#getprojectstate), [updateProjectState()](#updateprojectstate)

---

#### getProjectState()

```typescript
getProjectState(): ProjectState
```

Gets the current shared project state.

**Returns**: ProjectState object containing shared state

**Example**:

```typescript
const state = agentContext.getProjectState();
console.log('Build status:', state.buildStatus);
console.log('Test coverage:', state.testCoverage);
console.log('Last deploy:', state.lastDeployTime);
```

**See Also**: [updateProjectState()](#updateprojectstate)

---

#### updateProjectState()

```typescript
updateProjectState(updates: Partial<ProjectState>): void
```

Updates the shared project state.

**Parameters**:

- `updates` (object): Partial ProjectState with fields to update

**Example**:

```typescript
agentContext.updateProjectState({
  buildStatus: 'passing',
  lastBuildTime: new Date(),
  testCoverage: 85,
});

// Later, another agent can read this
const state = agentContext.getProjectState();
console.log('Build status:', state.buildStatus); // "passing"
```

**See Also**: [getProjectState()](#getprojectstate)

---

#### getWorkItem()

```typescript
getWorkItem(workItemId: string): WorkItem | undefined
```

Gets a work item by ID.

**Parameters**:

- `workItemId` (string): ID of the work item

**Returns**: WorkItem object or undefined if not found

**Example**:

```typescript
const workItem = agentContext.getWorkItem('feature-auth');

if (workItem) {
  console.log('Title:', workItem.title);
  console.log('Status:', workItem.status);
  console.log('Assigned to:', workItem.assignedTo);
}
```

**See Also**: [updateWorkItem()](#updateworkitem)

---

#### updateWorkItem()

```typescript
updateWorkItem(workItemId: string, updates: Partial<WorkItem>): void
```

Updates a work item.

**Parameters**:

- `workItemId` (string): ID of the work item
- `updates` (object): Partial WorkItem with fields to update

**Example**:

```typescript
agentContext.updateWorkItem('feature-auth', {
  status: 'in-progress',
  assignedTo: 'dev-1',
  metadata: {
    startedAt: new Date(),
    estimatedHours: 8,
  },
});
```

**See Also**: [getWorkItem()](#getworkitem)

---

#### addDecision()

```typescript
addDecision(decision: {
  title: string;
  description: string;
  rationale: string;
  alternatives?: string[];
  tags?: string[];
}): void
```

Adds a decision to the knowledge base.

**Parameters**:

- `decision` (object): Decision information
  - `title` (required): Decision title
  - `description` (required): Decision description
  - `rationale` (required): Why this decision was made
  - `alternatives` (optional): Alternative options considered
  - `tags` (optional): Tags for categorization

**Example**:

```typescript
agentContext.addDecision({
  title: 'Use JWT for authentication',
  description: 'Implement JWT-based authentication for API endpoints',
  rationale: 'JWT provides stateless authentication and scales well',
  alternatives: ['Session-based auth', 'OAuth2'],
  tags: ['authentication', 'security', 'architecture'],
});
```

**See Also**: [queryKnowledgeBase()](#queryknowledgebase)

---

#### queryKnowledgeBase()

```typescript
queryKnowledgeBase(query: string): KnowledgeItem[]
```

Queries the knowledge base for decisions and learnings.

**Parameters**:

- `query` (string): Search query

**Returns**: Array of KnowledgeItem objects matching the query

**Example**:

```typescript
const decisions = agentContext.queryKnowledgeBase('authentication');

for (const decision of decisions) {
  console.log('Title:', decision.title);
  console.log('Rationale:', decision.rationale);
  console.log('Made by:', decision.madeBy);
}
```

**See Also**: [addDecision()](#adddecision)

---

### File Locking API

#### acquireFileLock()

```typescript
async acquireFileLock(
  file: string,
  mode: 'read' | 'write',
  timeout?: number
): Promise<boolean>
```

Acquires a file lock before editing.

**Parameters**:

- `file` (string): File path to lock
- `mode` ('read' | 'write'): Lock mode
  - `'read'`: Shared lock (multiple readers allowed)
  - `'write'`: Exclusive lock (no other locks allowed)
- `timeout` (optional): Timeout in milliseconds (default: 5000)

**Returns**: Promise resolving to true if lock acquired, false if timeout

**Throws**: TimeoutError if lock cannot be acquired within timeout

**Example**:

```typescript
// Acquire write lock
const locked = await agentContext.acquireFileLock('src/auth.ts', 'write', 5000);

if (locked) {
  // Edit file safely
  await editFile('src/auth.ts', changes);

  // Release lock when done
  agentContext.releaseFileLock('src/auth.ts');
} else {
  console.log('Could not acquire lock');
}
```

**Lock Semantics**:

- **Write lock**: Exclusive access, blocks all other locks
- **Read lock**: Shared access, multiple readers allowed, blocks write locks

**See Also**: [releaseFileLock()](#releasefilelock)

---

#### releaseFileLock()

```typescript
releaseFileLock(file: string): void
```

Releases a file lock.

**Parameters**:

- `file` (string): File path to unlock

**Example**:

```typescript
// Acquire lock
await agentContext.acquireFileLock('src/auth.ts', 'write');

// Edit file
await editFile('src/auth.ts', changes);

// Release lock
agentContext.releaseFileLock('src/auth.ts');
```

**Note**: Locks are automatically released when agent session ends.

**See Also**: [acquireFileLock()](#acquirefilelock)

---

### Agent Registry API

#### getAgentRegistry()

```typescript
getAgentRegistry(): AgentRegistry
```

Gets direct access to the AgentRegistry.

**Returns**: AgentRegistry instance

**Example**:

```typescript
const registry = agentContext.getAgentRegistry();
const allAgents = registry.getAllAgents();
console.log('Total agents:', allAgents.length);
```

---

#### updateStatus()

```typescript
updateStatus(status: AgentStatus): void
```

Updates this agent's status.

**Parameters**:

- `status` (AgentStatus): New status
  - `'idle'`: Agent is idle and available
  - `'busy'`: Agent is working on a task
  - `'blocked'`: Agent is blocked waiting for something
  - `'offline'`: Agent is offline or terminated

**Example**:

```typescript
// Mark agent as busy
agentContext.updateStatus('busy');

// Do work
await performTask();

// Mark agent as idle
agentContext.updateStatus('idle');
```

---

#### getAgentsByRole()

```typescript
getAgentsByRole(role: AgentRole): Agent[]
```

Gets all agents with a specific role.

**Parameters**:

- `role` (AgentRole): Role to filter by

**Returns**: Array of Agent objects with the specified role

**Example**:

```typescript
// Find all QA engineers
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

---

#### getAgent()

```typescript
getAgent(agentId: string): Agent | undefined
```

Gets an agent by ID.

**Parameters**:

- `agentId` (string): Agent ID to look up

**Returns**: Agent object or undefined if not found

**Example**:

```typescript
const agent = agentContext.getAgent('dev-1');

if (agent) {
  console.log('Role:', agent.role);
  console.log('Status:', agent.status);
  console.log('Capabilities:', agent.capabilities);
}
```

---

#### canPerformAction()

```typescript
canPerformAction(action: string): boolean
```

Checks if this agent can perform a specific action.

**Parameters**:

- `action` (string): Action to check (e.g., 'write-code', 'run-tests')

**Returns**: true if agent has capability, false otherwise

**Example**:

```typescript
if (agentContext.canPerformAction('write-code')) {
  // Agent can write code
  await writeCode();
} else {
  console.log('Agent cannot write code');
}
```

---

### Workflow API

#### triggerWorkflowEvent()

```typescript
async triggerWorkflowEvent(event: {
  type: string;
  data?: WorkflowEventData;
}): Promise<void>
```

Triggers a workflow automation event.

**Parameters**:

- `event` (object): Event configuration
  - `type` (required): Event type (e.g., 'work-complete', 'bug-found')
  - `data` (optional): Event data

**Returns**: Promise that resolves when event is processed

**Example**:

```typescript
// Trigger work completion event
await agentContext.triggerWorkflowEvent({
  type: 'work-complete',
  data: {
    workItemId: 'feature-auth',
    filesModified: ['src/auth.ts'],
  },
});

// Workflow engine will evaluate rules and may spawn follow-up agents
```

**Common Event Types**:

- `'work-complete'`: Agent completed work
- `'bug-found'`: Bug discovered during testing
- `'quality-gate-failure'`: Quality gates failed
- `'schema-change'`: Database schema changed

---

### Quality Gates API

#### runQualityGates()

```typescript
async runQualityGates(workItemId: string): Promise<QualityGateReport>
```

Runs quality gates for a work item.

**Parameters**:

- `workItemId` (string): ID of the work item to check

**Returns**: Promise resolving to QualityGateReport with results

**Throws**: Error if work item not found

**Example**:

```typescript
// Run quality gates
const result = await agentContext.runQualityGates('feature-auth');

if (result.passed) {
  console.log('All quality gates passed');
  console.log('Execution time:', result.executionTime, 'ms');

  // Mark work item complete
  agentContext.updateWorkItem('feature-auth', { status: 'complete' });
} else {
  console.log('Quality gates failed');

  for (const gate of result.failedGates) {
    console.log(`Failed: ${gate.name}`);
    console.log(`Error: ${gate.error}`);
    console.log(`Output: ${gate.output}`);
  }

  // Fix issues and retry
}
```

**Quality Gates**:

- `build`: npm run build
- `test`: npm run test:run
- `lint`: npm run lint
- `type-check`: npm run type-check
- `integration`: npm run test:integration

---

### Hierarchy API

#### getChildAgents()

```typescript
getChildAgents(): string[]
```

Gets IDs of child agents spawned by this agent.

**Returns**: Array of child agent IDs

**Example**:

```typescript
const children = agentContext.getChildAgents();
console.log('Child agents:', children);

// Check status of children
for (const childId of children) {
  const child = agentContext.getAgent(childId);
  console.log(`${childId}: ${child?.status}`);
}
```

**See Also**: [getParentAgent()](#getparentagent), [getDescendants()](#getdescendants)

---

#### getParentAgent()

```typescript
getParentAgent(): string | null
```

Gets the ID of the parent agent that spawned this agent.

**Returns**: Parent agent ID or null if this is a root agent

**Example**:

```typescript
const parentId = agentContext.getParentAgent();

if (parentId) {
  console.log('Parent agent:', parentId);

  // Send message to parent
  await agentContext.sendMessage(parentId, {
    type: 'notification',
    payload: { status: 'in-progress' },
  });
} else {
  console.log('This is a root agent');
}
```

**See Also**: [getChildAgents()](#getchildagents), [escalateToParent()](#escalatetoparent)

---

#### escalateToParent()

```typescript
escalateToParent(message: string): boolean
```

Escalates an issue to the parent agent.

**Parameters**:

- `message` (string): Escalation message describing the issue

**Returns**: true if escalation sent, false if no parent

**Example**:

```typescript
// Encounter blocker
const escalated = agentContext.escalateToParent(
  'Blocked: Need schema change for user authentication'
);

if (escalated) {
  console.log('Escalated to parent agent');
  // Wait for parent to resolve
} else {
  console.log('No parent to escalate to');
  // Handle differently
}
```

**Note**: Escalation messages bypass normal communication permissions and are always delivered to parent.

**See Also**: [getParentAgent()](#getparentagent)

---

#### getDescendants()

```typescript
getDescendants(): string[]
```

Gets IDs of all descendants (children, grandchildren, etc.).

**Returns**: Array of descendant agent IDs

**Example**:

```typescript
const descendants = agentContext.getDescendants();
console.log('Total descendants:', descendants.length);

// Check if any descendants are blocked
for (const descendantId of descendants) {
  const agent = agentContext.getAgent(descendantId);
  if (agent?.status === 'blocked') {
    console.log(`Descendant ${descendantId} is blocked`);
  }
}
```

**See Also**: [getChildAgents()](#getchildagents), [getAncestors()](#getancestors)

---

#### getAncestors()

```typescript
getAncestors(): string[]
```

Gets IDs of all ancestors (parent, grandparent, etc.).

**Returns**: Array of ancestor agent IDs

**Example**:

```typescript
const ancestors = agentContext.getAncestors();
console.log('Ancestors:', ancestors);

// Find root agent
const rootId = ancestors[ancestors.length - 1];
console.log('Root agent:', rootId);
```

**See Also**: [getParentAgent()](#getparentagent), [getDescendants()](#getdescendants)

---

### Utility API

#### log()

```typescript
log(message: string, data?: unknown): void
```

Logs a message with agent context.

**Parameters**:

- `message` (string): Log message
- `data` (optional): Additional data to log

**Example**:

```typescript
agentContext.log('Starting feature implementation');
agentContext.log('Acquired file lock', { file: 'src/auth.ts' });
agentContext.log('Feature complete', { duration: 3600 });
```

**Output Format**: `[Agent:agent-id] message data`

---

#### getInfrastructureStatus()

```typescript
getInfrastructureStatus(): Record<string, unknown>
```

Gets infrastructure health status.

**Returns**: Object with status of all infrastructure components

**Example**:

```typescript
const status = agentContext.getInfrastructureStatus();

console.log('Message queue depth:', status.messageBus.queueDepth);
console.log('Active agents:', status.agentRegistry.activeAgents);
console.log('File locks:', status.sharedContext.fileLocks);
console.log('Work items:', status.sharedContext.workItems);
```

**Status Fields**:

- `messageBus`: Queue depth, dead letter queue size
- `agentRegistry`: Total agents, active agents
- `sharedContext`: Work items, file locks
- `workflowEngine`: Rules registered
- `qualityGates`: Gates registered
- `agentHierarchy`: Total agents, root agents, max depth, avg children

---

## InfrastructureManager API

The InfrastructureManager is a singleton that manages all infrastructure components.

### getInstance()

```typescript
static getInstance(): InfrastructureManager
```

Gets the singleton InfrastructureManager instance.

**Returns**: InfrastructureManager instance

**Example**:

```typescript
const infrastructure = InfrastructureManager.getInstance();
const messageBus = infrastructure.getMessageBus();
```

**Note**: Creates and initializes infrastructure on first call.

---

### reset()

```typescript
static reset(): void
```

Resets the singleton instance (for testing).

**Example**:

```typescript
// In test teardown
afterEach(() => {
  InfrastructureManager.reset();
});
```

**Warning**: Only use in tests. Resets all infrastructure state.

---

### getMessageBus()

```typescript
getMessageBus(): MessageBus
```

Gets the MessageBus instance.

**Returns**: MessageBus instance

**Example**:

```typescript
const infrastructure = InfrastructureManager.getInstance();
const messageBus = infrastructure.getMessageBus();

// Send message directly
await messageBus.send({
  id: 'msg-1',
  from: 'agent-1',
  to: 'agent-2',
  type: 'request',
  priority: 'normal',
  payload: { test: true },
  timestamp: new Date(),
  acknowledged: false,
});
```

---

### getAgentRegistry()

```typescript
getAgentRegistry(): AgentRegistry
```

Gets the AgentRegistry instance.

**Returns**: AgentRegistry instance

**Example**:

```typescript
const infrastructure = InfrastructureManager.getInstance();
const registry = infrastructure.getAgentRegistry();

// Register agent
registry.registerAgent({
  id: 'dev-1',
  role: 'developer',
  status: 'idle',
  capabilities: ['write-code', 'fix-bugs'],
  workload: 0,
});
```

---

### getSharedContext()

```typescript
getSharedContext(): SharedContextManager
```

Gets the SharedContextManager instance.

**Returns**: SharedContextManager instance

**Example**:

```typescript
const infrastructure = InfrastructureManager.getInstance();
const sharedContext = infrastructure.getSharedContext();

// Update project state
sharedContext.updateProjectState({
  buildStatus: 'passing',
  testCoverage: 85,
});
```

---

### getWorkflowEngine()

```typescript
getWorkflowEngine(): WorkflowEngine
```

Gets the WorkflowEngine instance.

**Returns**: WorkflowEngine instance

**Example**:

```typescript
const infrastructure = InfrastructureManager.getInstance();
const workflowEngine = infrastructure.getWorkflowEngine();

// Process event
await workflowEngine.processEvent({
  type: 'work-complete',
  source: 'dev-1',
  timestamp: new Date(),
  data: { workItemId: 'feature-auth' },
});
```

---

### getQualityGates()

```typescript
getQualityGates(): QualityGatesSystem
```

Gets the QualityGatesSystem instance.

**Returns**: QualityGatesSystem instance

**Example**:

```typescript
const infrastructure = InfrastructureManager.getInstance();
const qualityGates = infrastructure.getQualityGates();

// Run gates
const result = await qualityGates.runGates(workItem, 'developer');
```

---

### getInvocationManager()

```typescript
getInvocationManager(): AgentInvocationManager
```

Gets the AgentInvocationManager instance.

**Returns**: AgentInvocationManager instance

**Example**:

```typescript
const infrastructure = InfrastructureManager.getInstance();
const invocationManager = infrastructure.getInvocationManager();

// Invoke agent
await invocationManager.invokeAgent('qa-engineer', {
  task: 'test-feature',
  context: { featureId: 'auth' },
});
```

---

### getDefinitionLoader()

```typescript
getDefinitionLoader(): AgentDefinitionLoader
```

Gets the AgentDefinitionLoader instance.

**Returns**: AgentDefinitionLoader instance

**Example**:

```typescript
const infrastructure = InfrastructureManager.getInstance();
const loader = infrastructure.getDefinitionLoader();

// Load agent definition
const definition = loader.loadDefinition('developer');
```

---

### getAgentHierarchy()

```typescript
getAgentHierarchy(): AgentHierarchy
```

Gets the AgentHierarchy instance.

**Returns**: AgentHierarchy instance

**Example**:

```typescript
const infrastructure = InfrastructureManager.getInstance();
const hierarchy = infrastructure.getAgentHierarchy();

// Get hierarchy stats
const stats = hierarchy.getHierarchyStats();
console.log('Total agents:', stats.totalAgents);
console.log('Max depth:', stats.maxDepth);
```

---

### getStatus()

```typescript
getStatus(): {
  messageBus: { queueDepth: number; deadLetterQueueSize: number };
  agentRegistry: { totalAgents: number; activeAgents: number };
  sharedContext: { workItems: number; fileLocks: number };
  workflowEngine: { rulesRegistered: number };
  qualityGates: { gatesRegistered: number };
  agentHierarchy: {
    totalAgents: number;
    rootAgents: number;
    maxDepth: number;
    avgChildren: number;
  };
}
```

Gets infrastructure health status.

**Returns**: Object with status of all components

**Example**:

```typescript
const infrastructure = InfrastructureManager.getInstance();
const status = infrastructure.getStatus();

console.log('Infrastructure Status:');
console.log('  Message queue depth:', status.messageBus.queueDepth);
console.log('  Active agents:', status.agentRegistry.activeAgents);
console.log('  File locks:', status.sharedContext.fileLocks);
console.log('  Workflow rules:', status.workflowEngine.rulesRegistered);
console.log('  Quality gates:', status.qualityGates.gatesRegistered);
console.log('  Hierarchy depth:', status.agentHierarchy.maxDepth);
```

---

## KiroIntegration API

The KiroIntegration class bridges Kiro's agent lifecycle with the infrastructure.

### Constructor

```typescript
new KiroIntegration();
```

Creates a new KiroIntegration instance.

**Example**:

```typescript
const integration = new KiroIntegration();
```

---

### initializeSession()

```typescript
async initializeSession(): Promise<void>
```

Initializes infrastructure on session start.

**Returns**: Promise that resolves when initialization complete

**Throws**: Error if initialization fails

**Example**:

```typescript
const integration = new KiroIntegration();
await integration.initializeSession();

// Infrastructure is now ready
```

**Performance**: Must complete within 100ms

**Note**: Called once at Kiro startup, before any agents are spawned.

---

### onAgentSpawn()

```typescript
async onAgentSpawn(
  agentId: string,
  role: AgentRole,
  parentId?: string
): Promise<AgentContext>
```

Creates and injects AgentContext when agent spawns.

**Parameters**:

- `agentId` (string): Unique identifier for the agent
- `role` (AgentRole): Role of the agent
- `parentId` (optional): Parent agent ID for hierarchy tracking

**Returns**: Promise resolving to AgentContext instance

**Throws**: Error if infrastructure not initialized or agent registration fails

**Example**:

```typescript
const integration = new KiroIntegration();
await integration.initializeSession();

// Spawn agent
const agentContext = await integration.onAgentSpawn('dev-1', 'developer', 'tech-lead-1');

// Agent can now use infrastructure
await agentContext.sendMessage('qa-1', { payload: {} });
```

**Note**: Called by Kiro before each agent is spawned.

---

### onAgentComplete()

```typescript
async onAgentComplete(agentId: string, result: unknown): Promise<void>
```

Triggers workflows and quality gates when agent completes.

**Parameters**:

- `agentId` (string): ID of the agent that completed
- `result` (unknown): Result data from agent execution

**Returns**: Promise that resolves when processing complete

**Throws**: Error if workflow or quality gate execution fails

**Example**:

```typescript
await integration.onAgentComplete('dev-1', {
  workItemId: 'feature-auth',
  filesModified: ['src/auth.ts'],
  status: 'complete',
});

// Workflow engine evaluates rules
// Quality gates run if agent is developer
```

**Note**: Called by Kiro when agent completes successfully.

---

### onAgentFail()

```typescript
async onAgentFail(agentId: string, error: Error): Promise<void>
```

Handles agent failures and cleans up resources.

**Parameters**:

- `agentId` (string): ID of the agent that failed
- `error` (Error): Error that caused the failure

**Returns**: Promise that resolves when cleanup complete

**Example**:

```typescript
await integration.onAgentFail('dev-1', new Error('Timeout'));

// Agent status updated to offline
// File locks released
// Hierarchy updated
// Parent notified
```

**Note**: Called by Kiro when agent fails, crashes, or times out.

---

### getInfrastructure()

```typescript
getInfrastructure(): InfrastructureManager
```

Gets direct access to infrastructure.

**Returns**: InfrastructureManager instance

**Throws**: Error if infrastructure not initialized

**Example**:

```typescript
const integration = new KiroIntegration();
await integration.initializeSession();

const infrastructure = integration.getInfrastructure();
const status = infrastructure.getStatus();
```

**Note**: Most agents should use AgentContext APIs instead of direct infrastructure access.

---

### isInitialized()

```typescript
isInitialized(): boolean
```

Checks if infrastructure is initialized.

**Returns**: true if initialized, false otherwise

**Example**:

```typescript
const integration = new KiroIntegration();

console.log('Initialized:', integration.isInitialized()); // false

await integration.initializeSession();

console.log('Initialized:', integration.isInitialized()); // true
```

---

### reset()

```typescript
reset(): void
```

Resets infrastructure (for testing).

**Example**:

```typescript
// In test teardown
afterEach(() => {
  integration.reset();
});
```

**Warning**: Only use in tests. Resets all infrastructure state.

---

## MessageBus API

The MessageBus handles asynchronous message passing between agents.

### send()

```typescript
async send(message: AgentMessage): Promise<void>
```

Sends a message to an agent.

**Parameters**:

- `message` (AgentMessage): Message to send

**Returns**: Promise that resolves when message is queued

**Example**:

```typescript
const messageBus = infrastructure.getMessageBus();

await messageBus.send({
  id: 'msg-1',
  from: 'dev-1',
  to: 'qa-1',
  type: 'request',
  priority: 'high',
  payload: { action: 'test-feature' },
  timestamp: new Date(),
  acknowledged: false,
});
```

---

### subscribe()

```typescript
subscribe(agentId: string, callback: (message: AgentMessage) => void | Promise<void>): void
```

Subscribes to messages for an agent.

**Parameters**:

- `agentId` (string): Agent ID to subscribe
- `callback` (function): Function to call when message received

**Example**:

```typescript
messageBus.subscribe('qa-1', async (message) => {
  console.log('Received:', message);
  await processMessage(message);
});
```

---

### getQueueSize()

```typescript
getQueueSize(): number
```

Gets the current message queue size.

**Returns**: Number of messages in queue

---

### getDeadLetterQueue()

```typescript
getDeadLetterQueue(): AgentMessage[]
```

Gets messages that failed delivery.

**Returns**: Array of failed messages

---

## AgentRegistry API

The AgentRegistry tracks all active agents and their metadata.

### registerAgent()

```typescript
registerAgent(agent: {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  capabilities: string[];
  workload: number;
}): void
```

Registers a new agent.

**Parameters**:

- `agent` (object): Agent information

**Example**:

```typescript
registry.registerAgent({
  id: 'dev-1',
  role: 'developer',
  status: 'idle',
  capabilities: ['write-code', 'fix-bugs'],
  workload: 0,
});
```

---

### unregisterAgent()

```typescript
unregisterAgent(agentId: string): void
```

Unregisters an agent.

**Parameters**:

- `agentId` (string): Agent ID to unregister

---

### updateStatus()

```typescript
updateStatus(agentId: string, status: AgentStatus): void
```

Updates an agent's status.

**Parameters**:

- `agentId` (string): Agent ID
- `status` (AgentStatus): New status

---

### getAgent()

```typescript
getAgent(agentId: string): Agent | undefined
```

Gets an agent by ID.

**Parameters**:

- `agentId` (string): Agent ID

**Returns**: Agent object or undefined

---

### getAllAgents()

```typescript
getAllAgents(): Agent[]
```

Gets all registered agents.

**Returns**: Array of all agents

---

### getAgentsByRole()

```typescript
getAgentsByRole(role: AgentRole): Agent[]
```

Gets agents by role.

**Parameters**:

- `role` (AgentRole): Role to filter by

**Returns**: Array of agents with the role

---

### canPerformAction()

```typescript
canPerformAction(agentId: string, action: string): boolean
```

Checks if agent can perform action.

**Parameters**:

- `agentId` (string): Agent ID
- `action` (string): Action to check

**Returns**: true if agent has capability

---

## SharedContext API

The SharedContext manages shared state and file locking.

### getProjectState()

```typescript
getProjectState(): ProjectState
```

Gets the current project state.

**Returns**: ProjectState object

---

### updateProjectState()

```typescript
updateProjectState(updates: Partial<ProjectState>): void
```

Updates the project state.

**Parameters**:

- `updates` (object): Partial ProjectState

---

### getWorkItem()

```typescript
getWorkItem(workItemId: string): WorkItem | undefined
```

Gets a work item by ID.

**Parameters**:

- `workItemId` (string): Work item ID

**Returns**: WorkItem or undefined

---

### updateWorkItem()

```typescript
updateWorkItem(workItemId: string, updates: Partial<WorkItem>): void
```

Updates a work item.

**Parameters**:

- `workItemId` (string): Work item ID
- `updates` (object): Partial WorkItem

---

### getAllWorkItems()

```typescript
getAllWorkItems(): WorkItem[]
```

Gets all work items.

**Returns**: Array of all work items

---

### acquireFileLock()

```typescript
async acquireFileLock(
  agentId: string,
  file: string,
  mode: 'read' | 'write',
  timeout?: number
): Promise<boolean>
```

Acquires a file lock.

**Parameters**:

- `agentId` (string): Agent ID acquiring lock
- `file` (string): File path
- `mode` ('read' | 'write'): Lock mode
- `timeout` (optional): Timeout in ms

**Returns**: Promise resolving to true if acquired

---

### releaseFileLock()

```typescript
releaseFileLock(agentId: string, file: string): void
```

Releases a file lock.

**Parameters**:

- `agentId` (string): Agent ID releasing lock
- `file` (string): File path

---

### getAgentLocks()

```typescript
getAgentLocks(agentId: string): string[]
```

Gets files locked by an agent.

**Parameters**:

- `agentId` (string): Agent ID

**Returns**: Array of locked file paths

---

### addDecision()

```typescript
addDecision(decision: Decision): void
```

Adds a decision to knowledge base.

**Parameters**:

- `decision` (Decision): Decision object

---

### queryKnowledgeBase()

```typescript
queryKnowledgeBase(query: string): KnowledgeItem[]
```

Queries the knowledge base.

**Parameters**:

- `query` (string): Search query

**Returns**: Array of matching knowledge items

---

### clear()

```typescript
clear(): void
```

Clears all shared context (for testing).

---

## WorkflowEngine API

The WorkflowEngine automates agent coordination based on events.

### processEvent()

```typescript
async processEvent(event: WorkflowEvent): Promise<void>
```

Processes a workflow event.

**Parameters**:

- `event` (WorkflowEvent): Event to process

**Returns**: Promise that resolves when processing complete

**Example**:

```typescript
await workflowEngine.processEvent({
  type: 'work-complete',
  source: 'dev-1',
  timestamp: new Date(),
  data: { workItemId: 'feature-auth' },
});
```

---

### getRules()

```typescript
getRules(): WorkflowRule[]
```

Gets all registered workflow rules.

**Returns**: Array of workflow rules

---

## QualityGates API

The QualityGates system enforces quality standards.

### runGates()

```typescript
async runGates(workItem: WorkItem, agentRole: AgentRole): Promise<QualityGateReport>
```

Runs quality gates for a work item.

**Parameters**:

- `workItem` (WorkItem): Work item to check
- `agentRole` (AgentRole): Role of the agent

**Returns**: Promise resolving to QualityGateReport

**Example**:

```typescript
const result = await qualityGates.runGates(workItem, 'developer');

if (result.passed) {
  console.log('All gates passed');
} else {
  console.log('Failed gates:', result.failedGates);
}
```

---

### getAllGates()

```typescript
getAllGates(): QualityGate[]
```

Gets all registered quality gates.

**Returns**: Array of quality gates

---

## AgentHierarchy API

The AgentHierarchy tracks parent-child relationships.

### recordRelationship()

```typescript
recordRelationship(parentId: string, childId: string): void
```

Records a parent-child relationship.

**Parameters**:

- `parentId` (string): Parent agent ID
- `childId` (string): Child agent ID

---

### getChildAgents()

```typescript
getChildAgents(agentId: string): string[]
```

Gets child agent IDs.

**Parameters**:

- `agentId` (string): Parent agent ID

**Returns**: Array of child agent IDs

---

### getParentAgent()

```typescript
getParentAgent(agentId: string): string | null
```

Gets parent agent ID.

**Parameters**:

- `agentId` (string): Child agent ID

**Returns**: Parent agent ID or null

---

### getDescendants()

```typescript
getDescendants(agentId: string): string[]
```

Gets all descendant agent IDs.

**Parameters**:

- `agentId` (string): Agent ID

**Returns**: Array of descendant agent IDs

---

### getAncestors()

```typescript
getAncestors(agentId: string): string[]
```

Gets all ancestor agent IDs.

**Parameters**:

- `agentId` (string): Agent ID

**Returns**: Array of ancestor agent IDs

---

### routeEscalation()

```typescript
routeEscalation(agentId: string, message: string): boolean
```

Routes an escalation to parent.

**Parameters**:

- `agentId` (string): Agent ID escalating
- `message` (string): Escalation message

**Returns**: true if escalation sent

---

### getHierarchyStats()

```typescript
getHierarchyStats(): {
  totalAgents: number;
  rootAgents: number;
  maxDepth: number;
  avgChildren: number;
}
```

Gets hierarchy statistics.

**Returns**: Object with hierarchy stats

---

### clear()

```typescript
clear(): void
```

Clears all hierarchy data (for testing).

---

## Type Definitions

### AgentRole

```typescript
enum AgentRole {
  TECH_LEAD = 'tech-lead',
  DEVELOPER = 'developer',
  QA_ENGINEER = 'qa-engineer',
  DEVOPS = 'devops',
  DATA_ARCHITECT = 'data-architect',
  SECURITY_ENGINEER = 'security-engineer',
  PERFORMANCE_ENGINEER = 'performance-engineer',
  UX_UI_DESIGNER = 'ux-ui-designer',
  TECHNICAL_WRITER = 'technical-writer',
}
```

Agent roles in the multi-agent system.

---

### AgentStatus

```typescript
type AgentStatus = 'idle' | 'busy' | 'blocked' | 'offline';
```

Agent status values:

- `'idle'`: Agent is idle and available for work
- `'busy'`: Agent is actively working on a task
- `'blocked'`: Agent is blocked waiting for something
- `'offline'`: Agent is offline or terminated

---

### AgentMessage

```typescript
interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'notification' | 'escalation';
  priority: 'low' | 'normal' | 'high' | 'critical';
  payload: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
  threadId?: string;
  parentMessageId?: string;
  retryCount?: number;
  deliveredAt?: Date;
}
```

Message passed between agents.

**Fields**:

- `id`: Unique message identifier
- `from`: Sender agent ID
- `to`: Recipient agent ID
- `type`: Message type
- `priority`: Message priority
- `payload`: Message data
- `timestamp`: When message was created
- `acknowledged`: Whether message was acknowledged
- `threadId`: Optional thread ID for conversation tracking
- `parentMessageId`: Optional parent message ID for replies
- `retryCount`: Number of delivery retries
- `deliveredAt`: When message was delivered

---

### Agent

```typescript
interface Agent {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  capabilities: string[];
  canRequestHelpFrom: AgentRole[];
  workload: number;
  lastActivity?: Date;
  spawnedAt?: Date;
}
```

Agent information in the registry.

**Fields**:

- `id`: Unique agent identifier
- `role`: Agent role
- `status`: Current status
- `capabilities`: Array of capability strings
- `canRequestHelpFrom`: Roles this agent can request help from
- `workload`: Current workload (0-100)
- `lastActivity`: Last activity timestamp
- `spawnedAt`: When agent was spawned

---

### ProjectState

```typescript
interface ProjectState {
  buildStatus?: 'passing' | 'failing' | 'unknown';
  testCoverage?: number;
  lastBuildTime?: Date;
  lastDeployTime?: Date;
  [key: string]: unknown;
}
```

Shared project state.

**Fields**:

- `buildStatus`: Current build status
- `testCoverage`: Test coverage percentage
- `lastBuildTime`: Last build timestamp
- `lastDeployTime`: Last deployment timestamp
- Additional custom fields allowed

---

### WorkItem

```typescript
interface WorkItem {
  id: string;
  type: 'feature' | 'bug' | 'refactor' | 'docs';
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'blocked' | 'complete' | 'failed';
  assignedTo?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}
```

Work item tracked in shared context.

**Fields**:

- `id`: Unique work item identifier
- `type`: Type of work
- `title`: Work item title
- `description`: Detailed description
- `status`: Current status
- `assignedTo`: Agent ID assigned to work item
- `createdBy`: Agent ID that created work item
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp
- `metadata`: Additional metadata

---

### Decision

```typescript
interface Decision {
  id: string;
  title: string;
  context: string;
  options: string[];
  chosen: string;
  rationale: string;
  madeBy: string;
  madeAt: Date;
  tags: string[];
}
```

Decision recorded in knowledge base.

**Fields**:

- `id`: Unique decision identifier
- `title`: Decision title
- `context`: Context and background
- `options`: Options considered
- `chosen`: Chosen option
- `rationale`: Why this option was chosen
- `madeBy`: Agent ID that made decision
- `madeAt`: Decision timestamp
- `tags`: Tags for categorization

---

### KnowledgeItem

```typescript
type KnowledgeItem = Decision;
```

Item in the knowledge base (currently only decisions).

---

### WorkflowEvent

```typescript
interface WorkflowEvent {
  type: string;
  source: string;
  timestamp: Date;
  data?: WorkflowEventData;
}
```

Event that triggers workflow automation.

**Fields**:

- `type`: Event type (e.g., 'work-complete', 'bug-found')
- `source`: Agent ID that triggered event
- `timestamp`: Event timestamp
- `data`: Optional event data

---

### WorkflowEventData

```typescript
interface WorkflowEventData {
  agentId?: string;
  role?: AgentRole;
  workItemId?: string;
  filesModified?: string[];
  [key: string]: unknown;
}
```

Data associated with workflow event.

---

### WorkflowRule

```typescript
interface WorkflowRule {
  name: string;
  trigger: {
    eventType: string;
    agentRole?: AgentRole;
  };
  conditions: Array<{
    field: string;
    operator: 'equals' | 'startsWith' | 'contains';
    value: unknown;
  }>;
  actions: Array<{
    type: 'invoke-agent' | 'send-message' | 'update-state';
    role?: AgentRole;
    task?: string;
    [key: string]: unknown;
  }>;
}
```

Workflow automation rule.

---

### QualityGateReport

```typescript
interface QualityGateReport {
  passed: boolean;
  results: GateResult[];
  failedGates: GateResult[];
  executionTime: number;
}
```

Result of quality gate execution.

**Fields**:

- `passed`: Whether all gates passed
- `results`: Results for all gates
- `failedGates`: Results for failed gates only
- `executionTime`: Total execution time in ms

---

### GateResult

```typescript
interface GateResult {
  name: string;
  passed: boolean;
  output?: string;
  error?: string;
  executionTime: number;
}
```

Result of a single quality gate.

**Fields**:

- `name`: Gate name (e.g., 'build', 'test')
- `passed`: Whether gate passed
- `output`: Command output
- `error`: Error message if failed
- `executionTime`: Execution time in ms

---

### QualityGate

```typescript
interface QualityGate {
  name: string;
  command: string;
  timeout?: number;
  requiredFor?: AgentRole[];
}
```

Quality gate configuration.

**Fields**:

- `name`: Gate name
- `command`: Command to execute
- `timeout`: Timeout in ms
- `requiredFor`: Roles this gate is required for

---

### FileLock

```typescript
interface FileLock {
  agentId: string;
  file: string;
  mode: 'read' | 'write';
  acquiredAt: Date;
  expiresAt?: Date;
}
```

File lock held by an agent.

**Fields**:

- `agentId`: Agent holding the lock
- `file`: File path
- `mode`: Lock mode (read or write)
- `acquiredAt`: When lock was acquired
- `expiresAt`: Optional expiration time

---

## Common Patterns

### Pattern 1: Request-Response Communication

```typescript
// Agent A sends request
await agentContext.sendMessage('agent-b', {
  type: 'request',
  payload: { action: 'test-feature', featureId: 'auth' },
  threadId: 'thread-1',
});

// Agent B receives and responds
agentContext.onMessage(async (message) => {
  if (message.type === 'request') {
    // Process request
    const result = await processRequest(message.payload);

    // Send response
    await agentContext.sendMessage(message.from, {
      type: 'response',
      payload: { result },
      threadId: message.threadId,
      parentMessageId: message.id,
    });
  }
});
```

---

### Pattern 2: Safe File Editing

```typescript
// Acquire lock
const locked = await agentContext.acquireFileLock('src/auth.ts', 'write', 5000);

if (locked) {
  try {
    // Edit file
    await editFile('src/auth.ts', changes);
  } finally {
    // Always release lock
    agentContext.releaseFileLock('src/auth.ts');
  }
} else {
  // Handle lock failure
  console.log('Could not acquire lock');
}
```

---

### Pattern 3: Escalation to Parent

```typescript
// Try to complete task
try {
  await performTask();
} catch (error) {
  // Escalate if blocked
  if (error.code === 'BLOCKED') {
    const escalated = agentContext.escalateToParent(`Blocked: ${error.message}`);

    if (escalated) {
      // Wait for parent to resolve
      await waitForResolution();
    }
  }
}
```

---

### Pattern 4: Workflow Automation

```typescript
// Developer completes feature
agentContext.updateWorkItem('feature-auth', { status: 'complete' });

// Trigger workflow event
await agentContext.triggerWorkflowEvent({
  type: 'work-complete',
  data: {
    workItemId: 'feature-auth',
    filesModified: ['src/auth.ts'],
  },
});

// Workflow engine automatically spawns QA agent
```

---

### Pattern 5: Quality Gate Enforcement

```typescript
// Run quality gates before marking complete
const result = await agentContext.runQualityGates('feature-auth');

if (result.passed) {
  // All gates passed
  agentContext.updateWorkItem('feature-auth', { status: 'complete' });
} else {
  // Some gates failed
  console.log('Failed gates:', result.failedGates);

  // Fix issues
  for (const gate of result.failedGates) {
    console.log(`Fix ${gate.name}: ${gate.error}`);
  }

  // Retry after fixes
}
```

---

## Performance Considerations

### Infrastructure Initialization

- **Target**: < 100ms
- **Tip**: Initialize once at session start, not per agent

### Message Delivery

- **Target**: < 10ms overhead
- **Tip**: Use appropriate priority levels, batch messages when possible

### File Lock Acquisition

- **Target**: < 50ms
- **Tip**: Use read locks when possible, release locks promptly

### Quality Gates

- **Target**: < 30s total
- **Tip**: Gates run in parallel, optimize slow commands

### SharedContext Queries

- **Target**: < 5ms
- **Tip**: Cache frequently accessed data

---

## Error Handling

### TimeoutError

Thrown when file lock cannot be acquired within timeout.

```typescript
try {
  await agentContext.acquireFileLock('file.ts', 'write', 5000);
} catch (error) {
  if (error.name === 'TimeoutError') {
    console.log('Lock held by:', error.lockHolder);
    console.log('Acquired at:', error.acquiredAt);
  }
}
```

---

### PermissionError

Thrown when agent attempts unauthorized operation.

```typescript
try {
  await agentContext.sendMessage('restricted-agent', { payload: {} });
} catch (error) {
  if (error.name === 'PermissionError') {
    console.log('Unauthorized communication');
  }
}
```

---

## See Also

- [Integration Guide](./INTEGRATION_GUIDE.md) - Setup and integration instructions
- [Plugin README](../../kiro-plugins/multi-agent-orchestration/README.md) - Plugin configuration
- [Design Document](../../.kiro/specs/multi-agent-kiro-integration/design.md) - Architecture details
- [Troubleshooting Guide](../TROUBLESHOOTING.md) - Common issues and solutions
