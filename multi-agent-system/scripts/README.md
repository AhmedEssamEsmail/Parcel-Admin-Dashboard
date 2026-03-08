# Multi-Agent Infrastructure Scripts

This directory contains scripts for managing the multi-agent infrastructure.

## initialize-infrastructure.ts

Initializes the multi-agent infrastructure on Kiro startup.

### What It Does

1. **Initialize Infrastructure**: Creates singleton InfrastructureManager instance and initializes all components
2. **Register Workflow Rules**: Registers 6 predefined workflow automation rules
3. **Register Quality Gates**: Registers 6 standard quality gates for code validation
4. **Validate Configuration**: Checks environment variables, file paths, and command availability
5. **Run Health Checks**: Verifies all infrastructure components are healthy

### Usage

```bash
# Run the initialization script
npm run init-infrastructure

# Or run directly with tsx
tsx multi-agent-system/scripts/initialize-infrastructure.ts
```

### Workflow Rules Registered

1. **feature-complete-to-qa**: When a feature is complete and quality gates pass, assign to QA Engineer for testing
2. **test-failure-to-bugfix**: When tests fail, assign bug fix to Developer
3. **schema-change-to-architect**: When schema change is requested, assign to Data Architect for review
4. **migration-complete-to-devops**: When database migration is complete, assign pipeline update to DevOps
5. **quality-gate-failure-to-owner**: When quality gates fail, reassign to original Developer for fixes
6. **task-blocked-to-tech-lead**: When task is blocked for >5 minutes, escalate to Tech Lead

### Quality Gates Registered

1. **build** (blocker): Verify project builds successfully (`npm run build`)
   - Required for: Developer, Data Architect, UX/UI Designer
   - Timeout: 60 seconds

2. **type-check** (blocker): Verify TypeScript types are correct (`npm run type-check`)
   - Required for: Developer, Data Architect
   - Timeout: 30 seconds

3. **lint** (non-blocker): Verify code meets linting standards (`npm run lint`)
   - Required for: Developer, Data Architect, UX/UI Designer
   - Timeout: 30 seconds

4. **test** (blocker): Verify all unit tests pass (`npm run test:run`)
   - Required for: Developer, QA Engineer
   - Timeout: 120 seconds

5. **integration-test** (blocker): Verify integration tests pass (`npm run test:integration`)
   - Required for: Developer, QA Engineer, DevOps
   - Timeout: 180 seconds

6. **coverage** (non-blocker): Verify test coverage >= 60% (`npm run test:coverage`)
   - Required for: Developer, QA Engineer
   - Timeout: 120 seconds

### Configuration

The script checks for these optional environment variables:

- `ENABLE_MULTI_AGENT_INFRASTRUCTURE`: Enable/disable infrastructure (default: enabled)
- `MULTI_AGENT_LOG_LEVEL`: Log level for infrastructure (default: info)

### Output

The script provides colored terminal output:

- ✅ Green: Success messages
- ❌ Red: Error messages
- ⚠️ Yellow: Warning messages
- ℹ️ Blue: Info messages
- Cyan: Section headers

### Exit Codes

- `0`: Success - infrastructure initialized successfully
- `1`: Failure - initialization failed (see error messages)

### Performance

- Infrastructure initialization target: <100ms
- Script will warn if initialization exceeds this target
- Total script execution time is displayed at the end

### Health Checks

The script verifies:

- MessageBus is initialized
- AgentRegistry is initialized
- SharedContext is initialized
- WorkflowEngine has >= 6 rules registered
- QualityGates has >= 6 gates registered
- AgentHierarchy is initialized

### Idempotency

The script is idempotent and can be run multiple times safely:

- InfrastructureManager uses singleton pattern
- Workflow rules are registered only once
- Quality gates are registered only once
- No side effects from repeated execution

### Integration with Kiro

This script is designed to be called by the Kiro plugin on startup:

```typescript
// In kiro-plugins/multi-agent-orchestration/index.ts
import { main as initializeInfrastructure } from '../../multi-agent-system/scripts/initialize-infrastructure';

export const onKiroStart = async () => {
  await initializeInfrastructure();
};
```

### Troubleshooting

**Error: "Some required files are missing"**

- Ensure you're running the script from the project root directory
- Verify all infrastructure files exist in `multi-agent-system/lib/`

**Error: "Some components are unhealthy"**

- Check the health check output to see which component failed
- Review infrastructure initialization logs for errors

**Warning: "Initialization took >100ms"**

- This is a performance warning, not an error
- Infrastructure still works, but may be slower than expected
- Consider optimizing component initialization

**Error: "Command not found in package.json"**

- Ensure all required npm scripts are defined in package.json
- Required scripts: build, type-check, lint, test:run, test:integration

### Adding Custom Workflow Rules

To add custom workflow rules, edit the `registerWorkflowRules` function:

```typescript
// Add after predefined rules
workflowEngine.registerRule({
  id: 'custom-rule',
  trigger: 'custom-event',
  action: 'custom-action',
  target: AgentRole.DEVELOPER,
  payload: {},
  priority: 50,
});
```

### Adding Custom Quality Gates

To add custom quality gates, edit the `registerQualityGates` function:

```typescript
// Add after standard gates
qualityGates.registerGate({
  id: 'custom-gate',
  name: 'Custom Gate',
  description: 'Custom validation',
  requiredFor: [AgentRole.DEVELOPER],
  blocker: false,
  timeout: 30000,
  check: async (workItem: WorkItem) => {
    // Your custom validation logic
    return true;
  },
});
```

## Future Scripts

Additional scripts may be added to this directory:

- `cleanup-infrastructure.ts`: Clean up infrastructure resources
- `migrate-infrastructure.ts`: Migrate infrastructure to new version
- `test-infrastructure.ts`: Run infrastructure integration tests
- `monitor-infrastructure.ts`: Monitor infrastructure health in real-time
