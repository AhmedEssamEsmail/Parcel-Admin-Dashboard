# Multi-Agent Orchestration Plugin - Installation & Usage Guide

## Status: ✅ Ready for Use

The multi-agent orchestration plugin is fully implemented, tested, and ready to be loaded by Kiro.

## What Was Done

### 1. Fixed Async Initialization Bug

- **Issue**: `AgentRegistry.initialize()` was never being called, causing agent definitions to not load
- **Fix**: Updated `InfrastructureManager` to support async initialization via `getInitializedInstance()`
- **Fix**: Updated `KiroIntegration.initializeSession()` to use `getInitializedInstance()`

### 2. Created Plugin Test Suite

- Created `test-plugin.ts` to verify all plugin lifecycle hooks work correctly
- Tests cover:
  - Infrastructure initialization (`onKiroStart`)
  - Agent spawning with AgentContext injection (`beforeAgentSpawn`)
  - Agent completion with workflow/quality gate triggers (`afterAgentComplete`)
  - Agent failure handling with resource cleanup (`onAgentFail`)
  - Infrastructure status reporting

### 3. Verified Build & Quality Checks

- ✅ `npm run build` - Passes
- ✅ `npm run init-infrastructure` - Passes (7ms initialization)
- ✅ Plugin test - All tests pass

## Installation

The plugin is already in the correct location:

```
kiro-plugins/multi-agent-orchestration/
├── index.ts           # Plugin entry point
├── README.md          # Plugin documentation
├── test-plugin.ts     # Test suite
└── INSTALLATION.md    # This file
```

Kiro will automatically load the plugin from this directory when it starts.

## Configuration

### Environment Variables

```bash
# Enable/disable the plugin (default: enabled)
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=true

# Set log level (default: info)
export MULTI_AGENT_LOG_LEVEL=debug  # Options: debug, info, warn, error
```

### Disable the Plugin

To disable the plugin without removing it:

```bash
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=false
```

## How It Works

### 1. Kiro Startup

When Kiro starts, it calls `plugin.onKiroStart()`:

- Initializes `InfrastructureManager` singleton
- Loads all infrastructure components:
  - MessageBus (message passing between agents)
  - AgentRegistry (tracks all active agents)
  - SharedContext (project state, file locks, work items)
  - WorkflowEngine (automation rules)
  - QualityGates (code quality checks)
  - AgentHierarchy (parent-child relationships)
- Registers 6 predefined workflow rules
- Completes in ~7ms

### 2. Agent Spawning

When Kiro spawns an agent, it calls `plugin.beforeAgentSpawn(agentId, role, config)`:

- Creates an `AgentContext` instance for the agent
- Registers the agent in `AgentRegistry`
- Records parent-child relationships (if parentId provided)
- Injects `AgentContext` into the agent's config
- Agent can now access infrastructure via `config.agentContext`

### 3. Agent Completion

When an agent completes, Kiro calls `plugin.afterAgentComplete(agentId, result)`:

- Triggers workflow automation events
- Runs quality gates for developer agents
- Updates agent status to idle
- Logs completion with audit trail

### 4. Agent Failure

When an agent fails, Kiro calls `plugin.onAgentFail(agentId, error)`:

- Updates agent status to offline
- Releases all file locks held by the agent
- Cleans up resources
- Logs failure with error details

## Testing the Plugin

Run the test suite to verify everything works:

```bash
npx tsx kiro-plugins/multi-agent-orchestration/test-plugin.ts
```

Expected output:

```
✅ Plugin initialized successfully
✅ Agent spawned successfully
✅ Agent completion handled successfully
✅ Agent failure handled successfully
✅ Infrastructure status retrieved successfully
✅ All Tests Passed
✅ Plugin is ready to be loaded by Kiro
```

## Using AgentContext in Agents

Once the plugin is loaded, spawned agents can access the infrastructure:

```typescript
// In an agent's execution context
const agentContext = config.agentContext;

// Send message to another agent
await agentContext.sendMessage('agent-2', {
  type: 'request',
  priority: 'high',
  payload: { action: 'test-feature' },
});

// Acquire file lock before editing
const lock = await agentContext.acquireFileLock('src/auth.ts', 'write');
// ... edit file ...
await agentContext.releaseFileLock('src/auth.ts');

// Access shared project state
const projectState = await agentContext.getProjectState();
await agentContext.updateProjectState({ buildStatus: 'passing' });

// Query agent registry
const qaEngineers = await agentContext.getAgentsByRole('qa-engineer');
```

## Infrastructure Status

Check infrastructure health:

```bash
npm run init-infrastructure
```

This shows:

- Message Bus queue depth
- Active agents count
- File locks count
- Workflow rules registered (6)
- Quality gates registered (6)
- Agent hierarchy statistics

## Troubleshooting

### Plugin not loading

- Check that `ENABLE_MULTI_AGENT_INFRASTRUCTURE` is not set to `false`
- Check Kiro logs for initialization errors
- Verify the plugin is in `kiro-plugins/multi-agent-orchestration/`

### AgentContext not available

- Verify plugin initialized successfully (check logs)
- Ensure agent is spawned after plugin initialization
- Check that `config.agentContext` exists in agent config

### Infrastructure errors

- Set `MULTI_AGENT_LOG_LEVEL=debug` for detailed logs
- Check InfrastructureManager initialization logs
- Verify all components initialized successfully

### Performance issues

- Infrastructure initialization should complete within 100ms
- Message delivery should have <10ms overhead
- Check logs for performance warnings

## Next Steps

The plugin is ready to use. When Kiro starts:

1. The plugin will automatically initialize the infrastructure
2. All spawned agents will receive AgentContext
3. Agents can use the multi-agent APIs for coordination
4. Workflows and quality gates will run automatically

## Files Modified

- `multi-agent-system/lib/infrastructure-manager.ts` - Added async initialization support
- `multi-agent-system/lib/kiro-integration.ts` - Updated to use async initialization
- `kiro-plugins/multi-agent-orchestration/test-plugin.ts` - Created test suite
- `kiro-plugins/multi-agent-orchestration/INSTALLATION.md` - This file

## Summary

✅ Plugin is fully functional and tested
✅ Async initialization bug fixed
✅ All quality checks pass
✅ Ready for Kiro to load automatically

The multi-agent orchestration infrastructure is now ready to coordinate specialized agents working together on complex tasks.
