# Task Assignment: 18.4 - Run Performance Tests

**Task**: Create and Run Performance Tests
**Assigned to**: Performance Engineer
**Priority**: High
**Estimated Duration**: 2 hours
**Dependencies**: Tasks 18.1, 18.2, 18.3 (will run tests as optimizations complete)

## Description

Create comprehensive performance tests to validate the optimizations made to the message bus, shared context, and quality gates. Run load tests and stress tests to ensure the system meets performance targets.

## Acceptance Criteria

1. **Load Test**: Test normal operating conditions
   - Simulate 10 agents
   - Process 100 tasks
   - Generate 1000 messages/min
   - Measure message latency (p50, p95, p99)
   - Verify latency < 5s (p99)

2. **Stress Test**: Test high-load conditions
   - Simulate 20 agents
   - Process 500 tasks
   - Generate 5000 messages/min
   - Measure system stability
   - Verify no crashes or data loss

3. **Message Latency**: Verify message performance
   - Measure end-to-end message latency
   - Test all priority levels (critical, high, normal, low)
   - Verify p99 latency < 5s
   - Test batching effectiveness for low-priority messages

4. **System Stability**: Verify system remains stable
   - Monitor memory usage over time
   - Check for memory leaks
   - Verify no deadlocks
   - Ensure graceful degradation under load

## Requirements

- NFR-1: Message latency < 5s (p99)
- NFR-11: System handles expected load
- NFR-12: System handles 1000 messages/min

## Files to Create

- `tests/performance/message-bus-performance.test.ts` - Message bus load tests
- `tests/performance/shared-context-performance.test.ts` - Context manager tests
- `tests/performance/quality-gates-performance.test.ts` - Quality gates tests
- `tests/performance/system-integration-performance.test.ts` - End-to-end tests

## Context

Performance targets:

- Message latency: < 5s (p99)
- Agent response: < 30s
- Context updates: < 2s
- File lock acquisition: < 1s
- System uptime: 99.9%
- Zero message loss

## Quality Gates

Before marking complete, ensure:

- [ ] All performance tests created
- [ ] Load test passes with targets met
- [ ] Stress test passes without crashes
- [ ] Performance report generated
- [ ] Bottlenecks identified and documented

## Communication

- **Blocked?** Escalate to Tech Lead after 5 minutes
- **Need Help?** Request help from Developers if tests reveal issues
- **Complete?** Update tasks.md and report to Tech Lead with performance report

## Implementation Hints

1. **Test Framework**: Use Vitest with custom performance utilities
2. **Metrics Collection**: Track latency, throughput, memory, CPU
3. **Load Generation**: Create utility to spawn mock agents and generate load
4. **Reporting**: Generate performance report with charts and statistics
5. **Baseline**: Establish baseline before optimizations, compare after

## Performance Test Structure

```typescript
describe('Message Bus Performance', () => {
  it('should handle 1000 messages/min with p99 latency < 5s', async () => {
    const messageBus = new MessageBus();
    const latencies: number[] = [];

    // Spawn 10 agents
    // Send 1000 messages over 1 minute
    // Measure latency for each message
    // Calculate p99 latency

    const p99 = calculatePercentile(latencies, 99);
    expect(p99).toBeLessThan(5000); // 5 seconds
  });
});
```

## Metrics to Collect

- **Message Bus**:
  - Message latency (p50, p95, p99)
  - Throughput (messages/sec)
  - Queue depth over time
  - Dead letter queue size
  - Circuit breaker activations

- **Shared Context**:
  - Read latency (cache hit vs miss)
  - Write latency
  - Cache hit rate
  - Sync duration
  - Lock contention

- **Quality Gates**:
  - Gate execution time
  - Cache hit rate
  - Concurrent gate count
  - Timeout frequency
  - Overall run time

- **System**:
  - Memory usage
  - CPU usage
  - Active agent count
  - Task completion rate

## Performance Report Format

```markdown
# Performance Test Report

## Test Environment

- Agents: 10 (load) / 20 (stress)
- Tasks: 100 (load) / 500 (stress)
- Messages: 1000/min (load) / 5000/min (stress)

## Results

### Message Bus

- p99 latency: X ms (target: < 5000ms) ✅/❌
- Throughput: X msg/sec (target: >= 16.67 msg/sec) ✅/❌

### Shared Context

- Read latency: X ms (target: < 10ms) ✅/❌
- Cache hit rate: X% (target: >= 80%) ✅/❌

### Quality Gates

- Execution time: X ms (target: < 30000ms) ✅/❌
- Cache hit rate: X% (target: >= 70%) ✅/❌

## Bottlenecks Identified

1. ...
2. ...

## Recommendations

1. ...
2. ...
```

Good luck! Remember to update tasks.md when you start and when you complete.
