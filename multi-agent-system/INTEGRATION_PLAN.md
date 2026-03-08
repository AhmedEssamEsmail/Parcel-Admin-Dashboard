# Multi-Agent System - Full Integration Plan (Option 2)

**Goal**: Integrate our multi-agent orchestration infrastructure with Kiro's agent invocation system so agents can communicate through MessageBus, share context, and use automated workflows.

**Status**: Planning Phase  
**Complexity**: High  
**Estimated Effort**: 2-3 weeks  
**Priority**: High

## Overview

We need to bridge our multi-agent infrastructure (MessageBus, AgentRegistry, SharedContext, etc.) with Kiro's actual agent spawning and execution system.

## Architecture

### Current State (Disconnected)

```
Kiro's Agent System                Our Multi-Agent Library
┌─────────────────┐               ┌──────────────────────┐
│ invokeSubAgent  │               │ MessageBus           │
│ Agent Spawning  │    ❌ NOT     │ AgentRegistry        │
│ Agent Execution │   CONNECTED   │ SharedContext        │
│ Agent Context   │               │ WorkflowEngine       │
└─────────────────┘               └──────────────────────┘
```

### Target State (Integrated)

```
Kiro's Agent System + Our Infrastructure
┌────────────────────────────────────────┐
│ invokeSubAgent (Enhanced)              │
│   ↓                                    │
│ Initialize Infrastructure              │
│   - MessageBus                         │
│   - AgentRegistry                      │
│   - SharedContext                      │
│   ↓                                    │
│ Spawn Agent with Infrastructure        │
│   - Inject MessageBus                  │
│   - Inject SharedContext               │
│   - Register in AgentRegistry          │
│   ↓                                    │
│ Agent Executes with Infrastructure     │
│   - Can send/receive messages          │
│   - Can access shared context          │
│   - Triggers workflow automation       │
└────────────────────────────────────────┘
```

## Integration Points

### 1. Agent Spawning Hook

**What**: Hook into Kiro's agent spawning to initialize our infrastructure

**Where**: When `invokeSubAgent` is called

**How**:

- Detect when parent agent starts (first agent invocation)
- Initialize MessageBus, AgentRegistry, SharedContext
- Store instances in parent agent's context
- Pass instances to all spawned agents

### 2. Agent Context Injection

**What**: Inject our infrastructure into each spawned agent's context

**Where**: During agent initialization

**How**:

- Add MessageBus instance to agent context
- Add SharedContext instance to agent context
- Add AgentRegistry reference to agent context
- Add agent ID and role to agent context

### 3. Message Handling API

**What**: Provide API for agents to send/receive messages

**Where**: Agent system prompt and available tools

**How**:

- Add `sendMessage(to, message)` function to agent context
- Add `onMessage(callback)` subscription to agent context
- Add `getMessages()` to retrieve pending messages
- Add `acknowledgeMessage(id)` to acknowledge receipt

### 4. Shared Context API

**What**: Provide API for agents to access shared state

**Where**: Agent system prompt and available tools

**How**:

- Add `getSharedContext()` to agent context
- Add `updateSharedContext(key, value)` to agent context
- Add `acquireFileLock(file)` to agent context
- Add `releaseFileLock(file)` to agent context

### 5. Workflow Integration

**What**: Trigger workflow rules based on agent actions

**Where**: Agent lifecycle hooks (start, complete, fail)

**How**:

- Hook into agent completion events
- Trigger WorkflowEngine.processEvent()
- Execute workflow rules (feature→QA, test failure→bug fix, etc.)
- Automatically invoke next agents in workflow

### 6. Quality Gates Integration

**What**: Enforce quality gates before task completion

**Where**: Agent completion handler

**How**:

- Hook into agent completion events
- Run QualityGatesSystem.runGates()
- Block completion if gates fail
- Reassign to agent for fixes

## Implementation Steps

### Phase 1: Infrastructure Initialization (Week 1)

#### Step 1.1: Create Infrastructure Manager

**File**: `multi-agent-system/lib/infrastructure-manager.ts`

**Purpose**: Singleton that manages infrastructure lifecycle

**Implementation**:

```typescript
export class InfrastructureManager {
  private static instance: InfrastructureManager;
  private messageBus: MessageBus;
  private agentRegistry: AgentRegistry;
  private sharedContext: SharedContextManager;
  private workflowEngine: WorkflowEngine;
  private qualityGates: QualityGatesSystem;
  private invocationManager: AgentInvocationManager;

  private constructor() {
    this.messageBus = new MessageBus();
    this.agentRegistry = new AgentRegistry();
    this.sharedContext = new SharedContextManager();
    this.workflowEngine = new WorkflowEngine(this.messageBus, this.agentRegistry);
    this.qualityGates = new QualityGatesSystem();
    this.invocationManager = new AgentInvocationManager(
      this.agentRegistry,
      new AgentDefinitionLoader(),
      this.messageBus,
      this.sharedContext
    );
  }

  static getInstance(): InfrastructureManager {
    if (!InfrastructureManager.instance) {
      InfrastructureManager.instance = new InfrastructureManager();
    }
    return InfrastructureManager.instance;
  }

  getMessageBus(): MessageBus {
    return this.messageBus;
  }
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }
  getSharedContext(): SharedContextManager {
    return this.sharedContext;
  }
  getWorkflowEngine(): WorkflowEngine {
    return this.workflowEngine;
  }
  getQualityGates(): QualityGatesSystem {
    return this.qualityGates;
  }
  getInvocationManager(): AgentInvocationManager {
    return this.invocationManager;
  }
}
```

#### Step 1.2: Create Agent Context Wrapper

**File**: `multi-agent-system/lib/agent-context.ts`

**Purpose**: Wrapper that provides infrastructure APIs to agents

**Implementation**:

```typescript
export class AgentContext {
  constructor(
    private agentId: string,
    private role: AgentRole,
    private infrastructure: InfrastructureManager
  ) {}

  // Message API
  async sendMessage(to: string, message: any): Promise<void> {
    await this.infrastructure.getMessageBus().send({
      id: `msg-${Date.now()}`,
      from: this.agentId,
      to,
      type: 'request',
      priority: 'normal',
      payload: message,
      timestamp: new Date(),
      acknowledged: false,
    });
  }

  onMessage(callback: (message: AgentMessage) => void): void {
    this.infrastructure.getMessageBus().subscribe(this.agentId, callback);
  }

  // Shared Context API
  getSharedContext(): SharedContextManager {
    return this.infrastructure.getSharedContext();
  }

  async acquireFileLock(file: string, mode: 'read' | 'write'): Promise<FileLock> {
    return this.infrastructure.getSharedContext().acquireFileLock(this.agentId, file, mode);
  }

  async releaseFileLock(file: string): Promise<void> {
    this.infrastructure.getSharedContext().releaseFileLock(this.agentId, file);
  }

  // Agent Registry API
  getAgentRegistry(): AgentRegistry {
    return this.infrastructure.getAgentRegistry();
  }

  updateStatus(status: AgentStatus): void {
    this.infrastructure.getAgentRegistry().updateStatus(this.agentId, status);
  }
}
```

#### Step 1.3: Create Kiro Integration Hook

**File**: `multi-agent-system/lib/kiro-integration.ts`

**Purpose**: Hook that integrates with Kiro's agent system

**Implementation**:

```typescript
export class KiroIntegration {
  private infrastructure: InfrastructureManager;

  constructor() {
    this.infrastructure = InfrastructureManager.getInstance();
  }

  /**
   * Called when parent agent starts
   * Initializes infrastructure for the session
   */
  async initializeSession(): Promise<void> {
    console.log('[KiroIntegration] Initializing multi-agent infrastructure...');

    // Infrastructure is already initialized via singleton
    // Just log confirmation
    console.log('[KiroIntegration] Infrastructure ready:');
    console.log('  - MessageBus: Active');
    console.log('  - AgentRegistry: Active');
    console.log('  - SharedContext: Active');
    console.log('  - WorkflowEngine: Active');
    console.log('  - QualityGates: Active');
  }

  /**
   * Called when an agent is spawned
   * Injects infrastructure into agent context
   */
  async onAgentSpawn(agentId: string, role: AgentRole): Promise<AgentContext> {
    console.log(`[KiroIntegration] Agent spawned: ${agentId} (${role})`);

    // Register agent
    const definition = await new AgentDefinitionLoader().loadDefinition(role);
    if (definition) {
      this.infrastructure.getAgentRegistry().registerAgent({
        id: agentId,
        role,
        status: 'idle',
        capabilities: definition.capabilities,
        canRequestHelpFrom: definition.canRequestHelpFrom,
        workload: 0,
      });
    }

    // Create and return agent context
    return new AgentContext(agentId, role, this.infrastructure);
  }

  /**
   * Called when an agent completes a task
   * Triggers workflow automation and quality gates
   */
  async onAgentComplete(agentId: string, result: any): Promise<void> {
    console.log(`[KiroIntegration] Agent completed: ${agentId}`);

    // Trigger workflow automation
    await this.infrastructure.getWorkflowEngine().processEvent({
      type: 'work-complete',
      agentId,
      timestamp: new Date(),
      data: result,
    });

    // Run quality gates if applicable
    const agent = this.infrastructure.getAgentRegistry().getAgent(agentId);
    if (agent && agent.role === 'developer') {
      const gateResult = await this.infrastructure
        .getQualityGates()
        .runGates(agentId, result.workItemId);

      if (!gateResult.passed) {
        console.log(`[KiroIntegration] Quality gates failed for ${agentId}`);
        // Trigger reassignment workflow
        await this.infrastructure.getWorkflowEngine().processEvent({
          type: 'quality-gate-failure',
          agentId,
          timestamp: new Date(),
          data: { gateResult },
        });
      }
    }

    // Update agent status
    this.infrastructure.getAgentRegistry().updateStatus(agentId, 'idle');
  }

  /**
   * Called when an agent fails or times out
   */
  async onAgentFail(agentId: string, error: Error): Promise<void> {
    console.log(`[KiroIntegration] Agent failed: ${agentId}`, error);

    // Update agent status
    this.infrastructure.getAgentRegistry().updateStatus(agentId, 'offline');

    // Trigger error recovery
    // (Error recovery system would handle reassignment)
  }

  /**
   * Get infrastructure instance for direct access
   */
  getInfrastructure(): InfrastructureManager {
    return this.infrastructure;
  }
}
```

### Phase 2: Agent System Prompt Integration (Week 1-2)

#### Step 2.1: Update Agent System Prompts

**Files**: `.kiro/agents/*.md`

**Add to each agent's system prompt**:

````markdown
## Multi-Agent Infrastructure Access

You have access to the multi-agent orchestration infrastructure:

### Sending Messages

To send a message to another agent:

```typescript
await agentContext.sendMessage('agent-id', {
  type: 'request',
  action: 'help-needed',
  data: { ... }
});
```
````

### Receiving Messages

To receive messages:

```typescript
agentContext.onMessage((message) => {
  console.log('Received message:', message);
  // Handle message
});
```

### Accessing Shared Context

To access shared state:

```typescript
const context = agentContext.getSharedContext();
const projectState = context.getProjectState();
```

### Acquiring File Locks

To lock a file before editing:

```typescript
const lock = await agentContext.acquireFileLock('src/app.ts', 'write');
// Edit file
await agentContext.releaseFileLock('src/app.ts');
```

### Updating Your Status

To update your status:

```typescript
agentContext.updateStatus('busy'); // or 'idle', 'blocked'
```

## CRITICAL: Use Infrastructure for Communication

- ✅ Use `agentContext.sendMessage()` to communicate with other agents
- ✅ Use `agentContext.getSharedContext()` to access shared state
- ✅ Use `agentContext.acquireFileLock()` before editing files
- ❌ Do NOT invoke other agents directly (still forbidden)
- ❌ Do NOT edit files without acquiring locks

````

#### Step 2.2: Create Infrastructure Initialization Script

**File**: `multi-agent-system/scripts/initialize-infrastructure.ts`

**Purpose**: Script that parent agent runs to initialize infrastructure

**Implementation**:
```typescript
import { KiroIntegration } from '../lib/kiro-integration';

async function initializeInfrastructure() {
  console.log('='.repeat(60));
  console.log('INITIALIZING MULTI-AGENT ORCHESTRATION INFRASTRUCTURE');
  console.log('='.repeat(60));

  const integration = new KiroIntegration();
  await integration.initializeSession();

  console.log('\n✅ Infrastructure initialized successfully!');
  console.log('\nYou can now spawn agents with full infrastructure support.');
  console.log('\nExample:');
  console.log('  const context = await integration.onAgentSpawn("dev-1", "developer");');
  console.log('  await context.sendMessage("qa-1", { type: "test-request" });');
  console.log('\n' + '='.repeat(60));

  return integration;
}

// Export for use in agent system
export { initializeInfrastructure };
````

### Phase 3: Kiro Platform Integration (Week 2)

**⚠️ This phase requires access to Kiro's internal code or plugin system**

#### Step 3.1: Create Kiro Plugin/Extension

**File**: `kiro-plugins/multi-agent-orchestration/index.ts`

**Purpose**: Kiro plugin that hooks into agent lifecycle

**Implementation**:

```typescript
import { KiroIntegration } from '../../multi-agent-system/lib/kiro-integration';

export class MultiAgentOrchestrationPlugin {
  private integration: KiroIntegration;
  private agentContexts: Map<string, AgentContext> = new Map();

  constructor() {
    this.integration = new KiroIntegration();
  }

  // Hook: Called when Kiro starts
  async onKiroStart() {
    await this.integration.initializeSession();
  }

  // Hook: Called before agent is spawned
  async beforeAgentSpawn(agentId: string, role: string, config: any) {
    const agentContext = await this.integration.onAgentSpawn(agentId, role as AgentRole);
    this.agentContexts.set(agentId, agentContext);

    // Inject agent context into agent's execution environment
    config.context = {
      ...config.context,
      agentContext,
    };

    return config;
  }

  // Hook: Called after agent completes
  async afterAgentComplete(agentId: string, result: any) {
    await this.integration.onAgentComplete(agentId, result);
    this.agentContexts.delete(agentId);
  }

  // Hook: Called when agent fails
  async onAgentFail(agentId: string, error: Error) {
    await this.integration.onAgentFail(agentId, error);
    this.agentContexts.delete(agentId);
  }

  // API: Get agent context
  getAgentContext(agentId: string): AgentContext | undefined {
    return this.agentContexts.get(agentId);
  }

  // API: Get infrastructure
  getInfrastructure(): InfrastructureManager {
    return this.integration.getInfrastructure();
  }
}

// Register plugin with Kiro
export default new MultiAgentOrchestrationPlugin();
```

#### Step 3.2: Register Plugin with Kiro

**File**: `kiro-plugins/registry.ts` (or wherever Kiro registers plugins)

```typescript
import multiAgentPlugin from './multi-agent-orchestration';

export const plugins = [
  multiAgentPlugin,
  // ... other plugins
];
```

### Phase 4: Testing and Validation (Week 2-3)

#### Step 4.1: Create Integration Tests

**File**: `multi-agent-system/tests/integration/kiro-integration.test.ts`

**Tests**:

- Infrastructure initialization
- Agent spawning with context injection
- Message sending/receiving between agents
- Shared context access
- File locking
- Workflow automation triggers
- Quality gate enforcement

#### Step 4.2: Create End-to-End Tests

**File**: `multi-agent-system/tests/e2e/full-workflow.test.ts`

**Tests**:

- Complete feature implementation workflow
- Bug fix workflow with QA verification
- Database schema change workflow
- Conflict resolution workflow
- Error recovery workflow

### Phase 5: Documentation and Rollout (Week 3)

#### Step 5.1: Update Documentation

- Update LAUNCH_GUIDE.md with new capabilities
- Update README.md with integration details
- Create INTEGRATION_GUIDE.md for developers
- Update agent system prompts with infrastructure APIs

#### Step 5.2: Create Migration Guide

**File**: `multi-agent-system/MIGRATION_GUIDE.md`

**Content**:

- How to migrate from Option 3 (Hybrid) to Option 2 (Integrated)
- Breaking changes
- New capabilities
- Updated examples

## Implementation Checklist

### Week 1: Core Infrastructure

- [ ] Create InfrastructureManager singleton
- [ ] Create AgentContext wrapper
- [ ] Create KiroIntegration hook
- [ ] Create initialization script
- [ ] Update agent system prompts with infrastructure APIs
- [ ] Write unit tests for new components

### Week 2: Kiro Integration

- [ ] Create Kiro plugin/extension
- [ ] Hook into agent lifecycle (spawn, complete, fail)
- [ ] Inject AgentContext into spawned agents
- [ ] Test infrastructure initialization
- [ ] Test message passing between agents
- [ ] Test shared context access
- [ ] Write integration tests

### Week 3: Testing and Rollout

- [ ] Create end-to-end tests
- [ ] Test all workflows (feature, bug fix, schema change, etc.)
- [ ] Update all documentation
- [ ] Create migration guide
- [ ] Conduct user acceptance testing
- [ ] Deploy to production

## Technical Requirements

### Access Needed

1. **Kiro Plugin System**: Ability to create and register plugins
2. **Agent Lifecycle Hooks**: Access to beforeSpawn, afterComplete, onFail hooks
3. **Agent Context Injection**: Ability to inject custom context into agents
4. **Agent Execution Environment**: Access to agent's execution context

### Dependencies

- TypeScript 4.5+
- Node.js 16+
- Kiro SDK/API (if available)
- Access to Kiro's internal agent system

### Performance Considerations

- Infrastructure initialization: < 100ms
- Message passing overhead: < 10ms per message
- Shared context access: < 5ms (cached)
- File lock acquisition: < 50ms
- Quality gate execution: < 30s (parallel)

## Risks and Mitigation

### Risk 1: Kiro Platform Limitations

**Risk**: Kiro may not provide plugin hooks or context injection

**Mitigation**:

- Work with Kiro team to add necessary hooks
- Alternative: Modify Kiro's agent system directly
- Fallback: Use Option 3 (Hybrid) approach

### Risk 2: Performance Overhead

**Risk**: Infrastructure adds latency to agent communication

**Mitigation**:

- Optimize MessageBus for low latency
- Use caching for SharedContext
- Profile and optimize hot paths
- Monitor performance metrics

### Risk 3: Breaking Changes

**Risk**: Integration breaks existing agent functionality

**Mitigation**:

- Comprehensive testing before rollout
- Gradual rollout with feature flags
- Maintain backward compatibility
- Provide migration guide

### Risk 4: Complexity

**Risk**: Integration adds significant complexity

**Mitigation**:

- Clear documentation
- Training for users
- Support channels
- Monitoring and debugging tools

## Success Criteria

Integration is successful when:

- ✅ Agents can send/receive messages through MessageBus
- ✅ Agents can access SharedContext
- ✅ Agents can acquire/release file locks
- ✅ Workflow automation triggers automatically
- ✅ Quality gates enforce automatically
- ✅ All integration tests pass
- ✅ All end-to-end tests pass
- ✅ Performance targets met
- ✅ Documentation complete
- ✅ Users can launch and use system successfully

## Next Steps

1. **Review this plan** with Kiro team
2. **Assess feasibility** of Kiro platform integration
3. **Get access** to necessary Kiro APIs/hooks
4. **Start implementation** following the phased approach
5. **Test thoroughly** at each phase
6. **Deploy gradually** with monitoring

## Support

For questions or issues during integration:

- Review this integration plan
- Check TROUBLESHOOTING.md
- Consult with Kiro platform team
- Create issues in project repository

---

**Status**: Planning Complete  
**Next**: Begin Phase 1 Implementation  
**Owner**: Development Team  
**Timeline**: 2-3 weeks  
**Last Updated**: 2026-03-07
