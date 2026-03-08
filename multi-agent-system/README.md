# Multi-Agent Orchestration System

## Overview

This directory contains the complete multi-agent orchestration system that enables specialized AI agents (Tech Lead, Developers, QA Engineer, DevOps, Data Architect, UX/UI Designer, Security Engineer, Technical Writer, Performance Engineer) to collaborate on complex software development tasks.

## Directory Structure

```
multi-agent-system/
├── lib/                    # Core library files
│   ├── types.ts           # Base type definitions
│   ├── roles.ts           # Agent role definitions
│   ├── message-bus.ts     # Message passing infrastructure
│   ├── agent-registry.ts  # Agent registration and discovery
│   ├── shared-context.ts  # Shared state management
│   ├── workflow-engine.ts # Workflow automation
│   ├── quality-gates.ts   # Quality gate system
│   ├── tech-lead-coordinator.ts  # Tech lead coordination logic
│   ├── conflict-resolver.ts      # Conflict detection and resolution
│   ├── communication-protocols.ts # Communication protocols
│   ├── error-recovery.ts         # Error handling and recovery
│   └── ... (other library files)
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── performance/       # Performance tests
└── README.md              # This file
```

## Key Components

### Message Bus

- Priority-based message queue
- Message threading and acknowledgment
- Retry mechanism with exponential backoff
- Dead letter queue for failed messages
- Message batching and sharding optimizations

### Agent Registry

- Agent registration and discovery
- Role-based capability management
- Agent status tracking (idle, busy, blocked, offline)
- Workload balancing and statistics

### Shared Context Manager

- Project state management with versioning
- File locking system (read/write locks)
- Work item tracking with state machine
- Knowledge base for decisions and patterns
- Caching with TTL for performance

### Workflow Engine

- Event-driven workflow automation
- Predefined workflow rules (feature→QA, test failure→bug fix, etc.)
- Task dependency management
- Circular dependency detection
- Critical path analysis

### Quality Gates System

- Parallel gate execution with resource limits
- Predefined quality gates (tests, lint, type-check, coverage, migrations, CI)
- Gate override mechanism (tech lead only)
- Result caching (1 minute TTL)
- Skip gates for unchanged files

### Tech Lead Coordinator

- Task analysis and assignment
- Agent selection based on capabilities and workload
- Escalation handling (guidance, reassignment, parent escalation)
- Work review and approval
- Workload balancing across agents

### Conflict Resolver

- File conflict detection with line range overlap checking
- Automatic conflict resolution (merge, rebase, escalation)
- Architectural conflict detection
- Deadlock detection and breaking (DFS cycle detection)

### Communication Protocols

- Help request protocol (permission-based routing)
- Escalation protocol (tech lead and parent escalation)
- Work completion protocol (artifact tracking, metrics)
- Automatic notifications (role-based)

### Error Recovery System

- Agent failure detection (heartbeat monitoring every 30s)
- Agent failure recovery (work preservation, task reassignment, restart)
- Message delivery failure handling
- Quality gate timeout handling (AbortController)

## Usage

### Quick Start - Launch the System

The multi-agent orchestration system is ready to use! Here's how to launch it:

**Option 1: Ask Kiro to use it (Recommended)**

```
"Use the multi-agent system to implement user authentication"
"Coordinate a team of agents to fix the payment bug"
"Use Tech Lead to organize work on the checkout feature"
```

**Option 2: Direct Tech Lead invocation**

```
"Invoke tech-lead agent to coordinate implementation of feature X"
```

**Option 3: Use with spec files**

```
"Use the multi-agent system to implement the spec in .kiro/specs/my-feature/"
```

**See [LAUNCH_GUIDE.md](./LAUNCH_GUIDE.md) for complete launch instructions and examples.**

### How It Works

```
You (User)
  ↓
Kiro (Parent Agent)
  ↓
Tech Lead Agent (Coordinator)
  ↓
Specialized Agents (Developers, QA, DevOps, etc.)
```

1. You make a request to Kiro
2. Kiro invokes Tech Lead agent
3. Tech Lead breaks down work and assigns to specialized agents
4. Agents work in parallel, coordinated by Tech Lead
5. Tech Lead enforces quality gates
6. Tech Lead reports completion back to you

### Spawning an Agent

```typescript
import { AgentRegistry } from '@/multi-agent-system/lib/agent-registry';
import { AgentRole } from '@/multi-agent-system/lib/roles';

const registry = new AgentRegistry();
registry.registerAgent({
  id: 'dev-1',
  role: AgentRole.DEVELOPER,
  status: 'idle',
  capabilities: ['write-code', 'write-tests', 'fix-bugs'],
});
```

### Sending Messages

```typescript
import { MessageBus } from '@/multi-agent-system/lib/message-bus';

const messageBus = new MessageBus();
await messageBus.send({
  id: 'msg-1',
  from: 'tech-lead-1',
  to: 'dev-1',
  type: 'task-assignment',
  priority: 'high',
  payload: { task: 'Implement feature X' },
  timestamp: Date.now(),
});
```

### Running Quality Gates

```typescript
import { QualityGatesSystem } from '@/multi-agent-system/lib/quality-gates';

const gates = new QualityGatesSystem();
const result = await gates.runGates('dev-1', 'work-item-1');
if (result.passed) {
  console.log('All quality gates passed!');
}
```

### Managing Shared Context

```typescript
import { SharedContextManager } from '@/multi-agent-system/lib/shared-context';

const context = new SharedContextManager();

// Acquire file lock
const lock = await context.acquireFileLock('dev-1', 'src/app.ts', 'write');

// Update project state
context.updateProjectState({
  currentPhase: 'development',
  activeAgents: ['dev-1', 'dev-2'],
});

// Release lock
context.releaseFileLock('dev-1', 'src/app.ts');
```

## Testing

### Run All Tests

```bash
npm run test:run -- multi-agent-system
```

### Run Unit Tests

```bash
npm run test:run -- multi-agent-system/tests/unit
```

### Run Integration Tests

```bash
npm run test:run -- multi-agent-system/tests/integration
```

### Run Performance Tests

```bash
npm run test:run -- multi-agent-system/tests/performance
```

### Run Specific Test File

```bash
npm run test:run -- multi-agent-system/lib/message-bus.test.ts
```

## Architecture

The system follows a hierarchical architecture:

1. **Parent Agent** (User/Orchestrator)
   - Spawns Tech Lead agent
   - Receives escalations
   - Makes final decisions

2. **Tech Lead Agent**
   - Coordinates specialized agents
   - Assigns tasks based on capabilities
   - Enforces quality gates
   - Resolves conflicts
   - Handles escalations

3. **Specialized Agents**
   - **Developer**: Write code, fix bugs, implement features, write unit tests
   - **QA Engineer**: Write tests, verify fixes, report bugs, test automation
   - **DevOps**: CI/CD, deployment, infrastructure, monitoring
   - **Data Architect**: Schema design, migrations, query optimization
   - **UX/UI Designer**: Design systems, component design, accessibility
   - **Security Engineer**: Security audits, vulnerability scanning
   - **Technical Writer**: Documentation, API docs, user guides
   - **Performance Engineer**: Performance testing, profiling, optimization

## Performance Characteristics

- **Message Latency**: < 5s (p99)
- **Agent Response**: < 30s
- **Context Updates**: < 2s
- **File Lock Acquisition**: < 1s
- **Test Coverage**: > 80%
- **Message Throughput**: 1000+ messages/min
- **Concurrent Agents**: 20+ agents supported

## Optimizations

### Message Bus

- Message batching for low priority messages
- Sharding by agent ID for parallel processing
- Circuit breaker for failed agents
- Optimized priority queue operations

### Shared Context

- Caching with TTL (5 minutes default)
- Optimized state update operations
- Eventual consistency model
- Periodic sync to persistent storage

### Quality Gates

- Parallel gate execution (max 5 concurrent)
- Result caching (1 minute TTL)
- Skip gates for unchanged files
- Resource limits to prevent overload

## Documentation

- [Architecture Documentation](../docs/agents/architecture.md) _(coming soon)_
- [API Documentation](../docs/agents/api.md) _(coming soon)_
- [Operator Guide](../docs/agents/operator-guide.md) _(coming soon)_
- [Developer Guide](../docs/agents/developer-guide.md) _(coming soon)_
- [Agent Instructions](../AGENTS.md)

## Implementation Status

### Phase 1: Foundation ✅ COMPLETE

- Message Bus with priority queue, threading, retry mechanism
- Agent Registry with role-based capabilities
- Shared Context Manager with file locking and knowledge base

### Phase 2: Coordination ✅ COMPLETE

- Workflow Engine with predefined rules and dependency management
- Quality Gates System with parallel execution
- Tech Lead Coordinator with task assignment and escalation

### Phase 3: Advanced Features ✅ COMPLETE

- Conflict Resolver with file and architectural conflict detection
- Enhanced Communication Protocols
- Error Recovery System with heartbeat monitoring

### Phase 4: Specialization ✅ COMPLETE

- Agent-specific system prompts for all 9 roles
- Enhanced agent invocation API
- Security and authorization (JWT tokens, audit logging)
- Multi-agent collaboration integration tests

### Phase 5: Performance & Monitoring 🔄 IN PROGRESS

- Performance optimizations (message bus, shared context, quality gates)
- Metrics collection and dashboards
- Alerting system
- Performance testing (load and stress tests)

## Contributing

See [Developer Guide](../docs/agents/developer-guide.md) for information on:

- Adding new agent roles
- Adding workflow rules
- Adding quality gates
- Extending the system

## License

See [LICENSE](../LICENSE) file in the root directory.
