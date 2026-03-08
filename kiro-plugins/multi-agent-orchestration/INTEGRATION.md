# Kiro Plugin Integration Guide

## Overview

This document explains how to integrate the Multi-Agent Orchestration Plugin with Kiro.

## Plugin Structure

```
kiro-plugins/multi-agent-orchestration/
├── index.ts           # Main plugin implementation
├── package.json       # Plugin metadata
├── README.md          # User documentation
└── INTEGRATION.md     # This file
```

## How Kiro Loads the Plugin

### Option 1: Automatic Discovery (Recommended)

If Kiro supports automatic plugin discovery, it will:

1. Scan the `kiro-plugins/` directory
2. Load each plugin's `index.ts` file
3. Import the default export (the plugin instance)
4. Call lifecycle hooks at appropriate times

### Option 2: Manual Registration

If Kiro requires manual plugin registration:

```typescript
// In Kiro's plugin loader
import multiAgentPlugin from './kiro-plugins/multi-agent-orchestration';

// Register plugin
kiro.registerPlugin(multiAgentPlugin);

// Kiro will then call lifecycle hooks:
// - onKiroStart() when Kiro starts
// - beforeAgentSpawn() before spawning agents
// - afterAgentComplete() when agents complete
// - onAgentFail() when agents fail
```

## Lifecycle Hook Integration

### 1. onKiroStart()

**When to call**: Once when Kiro starts up

```typescript
// In Kiro's startup sequence
await multiAgentPlugin.onKiroStart();
```

**What it does**:

- Initializes InfrastructureManager singleton
- Sets up MessageBus, AgentRegistry, SharedContext, WorkflowEngine, QualityGates
- Validates configuration
- Logs initialization status

**Performance**: Must complete within 100ms

### 2. beforeAgentSpawn(agentId, role, config)

**When to call**: Before spawning each agent

```typescript
// In Kiro's agent spawn logic
const agentId = generateAgentId();
const role = 'developer';
const config = {
  /* original config */
};

// Call plugin hook
const modifiedConfig = await multiAgentPlugin.beforeAgentSpawn(agentId, role, config);

// Spawn agent with modified config
const agent = await spawnAgent(agentId, role, modifiedConfig);
```

**What it does**:

- Creates AgentContext for the agent
- Registers agent in AgentRegistry
- Records parent-child relationships (if parentId in config)
- Injects AgentContext into config

**Returns**: Modified config with `agentContext` and `_multiAgentContext` properties

### 3. afterAgentComplete(agentId, result)

**When to call**: After agent completes successfully

```typescript
// In Kiro's agent completion handler
const result = await agent.execute();

// Call plugin hook
await multiAgentPlugin.afterAgentComplete(agentId, result);
```

**What it does**:

- Triggers workflow automation events
- Runs quality gates for developer agents
- Updates agent status to idle
- Logs completion

### 4. onAgentFail(agentId, error)

**When to call**: When agent fails or crashes

```typescript
// In Kiro's agent error handler
try {
  await agent.execute();
} catch (error) {
  // Call plugin hook
  await multiAgentPlugin.onAgentFail(agentId, error);
  throw error;
}
```

**What it does**:

- Updates agent status to offline
- Releases all file locks held by agent
- Removes agent from hierarchy
- Logs failure with full context

## Configuration

### Environment Variables

Set these before starting Kiro:

```bash
# Enable/disable plugin (default: true)
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=true

# Set log level (default: info)
export MULTI_AGENT_LOG_LEVEL=debug
```

### Feature Flag Behavior

When `ENABLE_MULTI_AGENT_INFRASTRUCTURE=false`:

- `onKiroStart()` does nothing
- `beforeAgentSpawn()` returns original config unchanged
- `afterAgentComplete()` does nothing
- `onAgentFail()` does nothing

This ensures backward compatibility with existing Kiro installations.

## Agent Access to Infrastructure

Agents can access the infrastructure via the injected AgentContext:

```typescript
// In agent code
const agentContext = config.agentContext;

if (agentContext) {
  // Send message
  await agentContext.sendMessage('agent-2', {
    type: 'request',
    priority: 'high',
    payload: { action: 'test-feature' },
  });

  // Acquire file lock
  await agentContext.acquireFileLock('src/auth.ts', 'write');

  // Access shared context
  const state = await agentContext.getProjectState();

  // Query agent registry
  const qaEngineers = await agentContext.getAgentsByRole('qa-engineer');
}
```

## Error Handling

The plugin is designed to fail gracefully:

1. **Infrastructure initialization fails**
   - Plugin disables itself
   - Logs error
   - Kiro continues without infrastructure

2. **AgentContext creation fails**
   - Returns original config
   - Agent runs without infrastructure
   - Logs error

3. **Workflow/quality gate fails**
   - Logs error
   - Doesn't fail agent completion

4. **Cleanup fails**
   - Logs error
   - Doesn't fail the failure handler

## Testing the Integration

### 1. Verify Plugin Loads

```bash
# Start Kiro with debug logging
export MULTI_AGENT_LOG_LEVEL=debug
kiro start

# Look for log message:
# [MultiAgentPlugin] [INFO] Initializing multi-agent infrastructure...
# [MultiAgentPlugin] [INFO] Multi-agent infrastructure initialized successfully
```

### 2. Verify AgentContext Injection

```bash
# Spawn an agent
kiro spawn developer

# Look for log message:
# [MultiAgentPlugin] [DEBUG] AgentContext created for agent <id> (developer)
```

### 3. Verify Workflows Trigger

```bash
# Complete an agent task
# Look for log message:
# [MultiAgentPlugin] [DEBUG] Agent <id> completed, triggering workflows and quality gates
# [MultiAgentPlugin] [DEBUG] Workflows and quality gates completed for agent <id>
```

### 4. Test Feature Flag

```bash
# Disable infrastructure
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=false
kiro start

# Look for log message:
# [MultiAgentPlugin] [INFO] Multi-agent infrastructure disabled via feature flag

# Verify agents still work normally
kiro spawn developer
```

## Performance Monitoring

The plugin logs performance warnings:

- Infrastructure initialization >100ms
- Message delivery >10ms
- Quality gate execution exceeding limits

Monitor logs for these warnings to identify performance issues.

## Troubleshooting

### Plugin not loading

1. Check plugin is in `kiro-plugins/multi-agent-orchestration/`
2. Verify `index.ts` exports default plugin instance
3. Check Kiro logs for plugin loading errors

### AgentContext not available

1. Verify plugin initialized successfully
2. Check `ENABLE_MULTI_AGENT_INFRASTRUCTURE` is not `false`
3. Verify `config.agentContext` exists in agent config

### Infrastructure errors

1. Set `MULTI_AGENT_LOG_LEVEL=debug`
2. Check InfrastructureManager initialization logs
3. Verify all components initialized successfully

### Performance issues

1. Check logs for performance warnings
2. Verify infrastructure initialization <100ms
3. Verify message delivery <10ms
4. Check quality gate execution times

## Next Steps

After integrating the plugin:

1. Update agent system prompts to use AgentContext APIs
2. Register workflow rules for automation
3. Register quality gates for validation
4. Test with real agent scenarios
5. Monitor performance and errors
6. Adjust configuration as needed

## Support

For issues or questions:

1. Check logs with `MULTI_AGENT_LOG_LEVEL=debug`
2. Review `README.md` for usage examples
3. Check `TROUBLESHOOTING.md` in multi-agent-system/
4. Review requirements in `.kiro/specs/multi-agent-kiro-integration/`
