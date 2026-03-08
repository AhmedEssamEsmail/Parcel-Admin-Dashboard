# Integration Tests

This directory contains integration tests for the multi-agent infrastructure. These tests verify end-to-end functionality using real components (not mocks).

## Test Files

### 1. agent-spawning.test.ts

Tests agent spawning and context injection:

- AgentContext creation via KiroIntegration.onAgentSpawn()
- Infrastructure API access (sendMessage, acquireFileLock, etc.)
- Agent registration in AgentRegistry
- Parent-child relationship tracking

### 2. message-passing.test.ts

Tests message passing between agents:

- Message queuing in MessageBus
- Message delivery via callbacks
- Message acknowledgment
- Priority ordering (critical > high > normal)
- Permission enforcement

### 3. shared-context.test.ts

Tests shared state and file locking:

- Multiple agents accessing shared project state
- Concurrent state updates and merging
- File lock acquisition and release
- Lock blocking and timeout behavior
- Automatic lock cleanup on session end

## Running Tests

### Run All Integration Tests

```bash
npm run test:integration
```

### Run Specific Test File

```bash
npm run test:run -- tests/integration/agent-spawning.test.ts
npm run test:run -- tests/integration/message-passing.test.ts
npm run test:run -- tests/integration/shared-context.test.ts
```

### Run with Coverage

```bash
npm run test:coverage -- tests/integration/
```

### Watch Mode (for development)

```bash
npm run test:watch -- tests/integration/
```

## Test Setup

Each test file follows this pattern:

```typescript
describe('Test Suite', () => {
  let infrastructure: InfrastructureManager;
  let integration: KiroIntegration;

  beforeEach(() => {
    // Initialize real infrastructure
    infrastructure = new InfrastructureManager();
    integration = new KiroIntegration(infrastructure);
  });

  afterEach(() => {
    // Clean up all sessions and state
    infrastructure.cleanup();
  });

  // Tests...
});
```

## Key Principles

1. **Real Components**: Tests use real InfrastructureManager, not mocks
2. **Isolation**: Each test is independent with clean setup/teardown
3. **Cleanup**: All resources are cleaned up after each test
4. **Timeouts**: Tests use appropriate timeouts to prevent hanging
5. **Assertions**: Clear, specific assertions that verify behavior

## Test Status

⚠️ **These tests are ready but may fail until critical bugs are fixed:**

- Bug #1: AgentContext not injected during agent spawn
- Bug #2: Message delivery callbacks not invoked
- Bug #3: File locks not released on session end

See `.kiro/specs/multi-agent-kiro-integration/test-validation-report.md` for details.

## Expected Behavior

Once bugs are fixed, all tests should:

- ✅ Pass consistently (no flaky tests)
- ✅ Complete within reasonable time (<5s per test)
- ✅ Provide clear failure messages
- ✅ Clean up resources properly

## Debugging Failed Tests

If a test fails:

1. **Check the error message**: Vitest provides detailed assertion failures
2. **Review recent changes**: What changed since last passing?
3. **Run in isolation**: Run just the failing test to isolate the issue
4. **Check cleanup**: Ensure previous tests cleaned up properly
5. **Verify infrastructure**: Check that InfrastructureManager is initialized correctly

## Adding New Tests

When adding new integration tests:

1. Follow the existing pattern (beforeEach/afterEach setup)
2. Use descriptive test names that explain what's being tested
3. Follow Arrange-Act-Assert pattern
4. Clean up all resources in afterEach
5. Use appropriate timeouts for async operations
6. Add documentation comments explaining the test purpose

## Coverage Goals

Integration tests should cover:

- ✅ Happy paths (normal operation)
- ✅ Edge cases (boundary conditions)
- ✅ Error conditions (failures, timeouts)
- ✅ Concurrent operations (multiple agents)
- ✅ Resource cleanup (session end, lock release)

Target: 80%+ coverage of integration scenarios

## Related Documentation

- `multi-agent-system/lib/kiro-integration.ts` - Integration hooks
- `multi-agent-system/lib/agent-context.ts` - AgentContext API
- `multi-agent-system/lib/infrastructure-manager.ts` - Infrastructure setup
- `.kiro/specs/multi-agent-kiro-integration/test-validation-report.md` - Bug report
- `.kiro/specs/multi-agent-kiro-integration/design.md` - System design
