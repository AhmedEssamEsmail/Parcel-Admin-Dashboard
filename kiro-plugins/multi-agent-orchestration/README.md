# Kiro Multi-Agent Orchestration Plugin

This plugin integrates the multi-agent orchestration infrastructure with Kiro's agent lifecycle system.

## Features

- **Infrastructure Initialization**: Automatically initializes the multi-agent infrastructure on Kiro startup
- **AgentContext Injection**: Creates and injects AgentContext for each spawned agent
- **Workflow Automation**: Triggers workflows when agents complete tasks
- **Quality Gates**: Runs quality gates for developer agents
- **Resource Cleanup**: Cleans up resources when agents fail or crash
- **Feature Flag**: Can be enabled/disabled via environment variable

## Installation

The plugin is automatically loaded by Kiro if present in the `kiro-plugins` directory.

## Configuration

### Environment Variables

- `ENABLE_MULTI_AGENT_INFRASTRUCTURE` (default: `true`)
  - Set to `false` to disable the plugin
  - When disabled, Kiro functions normally without multi-agent infrastructure

- `MULTI_AGENT_LOG_LEVEL` (default: `info`)
  - Controls plugin logging verbosity
  - Options: `debug`, `info`, `warn`, `error`

### Example

```bash
# Enable plugin with debug logging
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=true
export MULTI_AGENT_LOG_LEVEL=debug

# Disable plugin
export ENABLE_MULTI_AGENT_INFRASTRUCTURE=false
```

## Usage

### For Kiro

The plugin implements the Kiro plugin interface with these lifecycle hooks:

1. **onKiroStart()** - Called once when Kiro starts
   - Initializes InfrastructureManager
   - Sets up MessageBus, AgentRegistry, SharedContext, WorkflowEngine, QualityGates

2. **beforeAgentSpawn(agentId, role, config)** - Called before spawning an agent
   - Creates AgentContext for the agent
   - Registers agent in AgentRegistry
   - Records parent-child relationships
   - Injects AgentContext into agent config

3. **afterAgentComplete(agentId, result)** - Called when agent completes
   - Triggers workflow automation events
   - Runs quality gates for developer agents
   - Updates agent status

4. **onAgentFail(agentId, error)** - Called when agent fails
   - Updates agent status to offline
   - Releases file locks
   - Cleans up resources

### For Agents

Agents can access the infrastructure via the injected AgentContext:

```typescript
// Access AgentContext from config
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

// Access shared context
const projectState = await agentContext.getProjectState();
await agentContext.updateProjectState({ buildStatus: 'passing' });

// Query agent registry
const qaEngineers = await agentContext.getAgentsByRole('qa-engineer');
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Kiro Platform                          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │         Multi-Agent Orchestration Plugin              │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │          KiroIntegration Hook                   │ │ │
│  │  │                                                 │ │ │
│  │  │  • initializeSession()                         │ │ │
│  │  │  • onAgentSpawn()                              │ │ │
│  │  │  • onAgentComplete()                           │ │ │
│  │  │  • onAgentFail()                               │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  │                        │                             │ │
│  │                        ▼                             │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │       InfrastructureManager                     │ │ │
│  │  │                                                 │ │ │
│  │  │  • MessageBus                                   │ │ │
│  │  │  • AgentRegistry                                │ │ │
│  │  │  • SharedContext                                │ │ │
│  │  │  • WorkflowEngine                               │ │ │
│  │  │  • QualityGates                                 │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                    Agents                             │ │
│  │                                                       │ │
│  │  • Developer  • QA Engineer  • DevOps                │ │
│  │  • Data Architect  • Security  • Performance         │ │
│  │                                                       │ │
│  │  Each agent receives AgentContext via config         │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

The plugin is designed to fail gracefully:

- **Infrastructure initialization fails**: Plugin disables itself and logs error
- **AgentContext creation fails**: Returns original config, agent runs without infrastructure
- **Workflow/quality gate fails**: Logs error but doesn't fail agent completion
- **Cleanup fails**: Logs error but doesn't fail the failure handler

This ensures Kiro continues to function even if the multi-agent infrastructure encounters issues.

## Backward Compatibility

The plugin maintains backward compatibility with existing Kiro agents:

- **Feature Flag**: Can be disabled via `ENABLE_MULTI_AGENT_INFRASTRUCTURE=false`
- **Graceful Degradation**: If infrastructure fails, agents run normally
- **Optional AgentContext**: Agents work with or without AgentContext
- **No Breaking Changes**: Existing agent system prompts don't need updates

## Testing

The plugin can be tested using the KiroIntegration test suite:

```bash
npm run test:run -- multi-agent-system/lib/kiro-integration.test.ts
```

## Troubleshooting

### Plugin not loading

- Check that the plugin is in `kiro-plugins/multi-agent-orchestration/`
- Verify `ENABLE_MULTI_AGENT_INFRASTRUCTURE` is not set to `false`
- Check Kiro logs for initialization errors

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
- Quality gates should complete within time limits
- Check logs for performance warnings

## License

MIT
