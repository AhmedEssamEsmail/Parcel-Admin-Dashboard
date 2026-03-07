# Task Assignment: 18.1 - Optimize Message Bus

**Task**: Optimize Message Bus Performance
**Assigned to**: Developer 1
**Priority**: High
**Estimated Duration**: 2 hours
**Dependencies**: None (can start immediately)

## Description

Optimize the MessageBus implementation in `lib/agents/message-bus.ts` to improve performance under high load conditions. The current implementation processes messages sequentially and doesn't have mechanisms for batching, sharding, or circuit breaking.

## Acceptance Criteria

1. **Message Batching**: Implement batching for low-priority messages
   - Batch up to 10 low-priority messages together
   - Process batch every 100ms or when batch is full
   - Maintain priority ordering within batches

2. **Sharding by Agent ID**: Implement message sharding
   - Create separate queues per agent (or agent group)
   - Distribute messages to appropriate shard based on recipient agent ID
   - Process shards in parallel

3. **Circuit Breaker**: Add circuit breaker for failed agents
   - Track delivery failures per agent
   - Open circuit after 5 consecutive failures to same agent
   - Half-open after 30 seconds to retry
   - Close circuit on successful delivery

4. **Priority Queue Optimization**: Optimize existing priority queue
   - Review heap operations for efficiency
   - Consider using a more efficient data structure if needed
   - Ensure O(log n) enqueue/dequeue operations

## Requirements

- NFR-1: Message latency < 5s (p99)
- NFR-12: System handles 1000 messages/min

## Files to Modify

- `lib/agents/message-bus.ts` - Main implementation
- `lib/agents/types.ts` - Add new types if needed (MessageBatch, CircuitBreakerState, etc.)

## Context

Current MessageBus implementation:

- Uses PriorityQueue with min-heap
- Processes messages sequentially in `processQueue()`
- Has retry logic with exponential backoff
- Has dead letter queue for failed messages

## Quality Gates

Before marking complete, ensure:

- [ ] All unit tests pass (`npm run test:run`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] New code has >= 60% test coverage
- [ ] Write unit tests for batching, sharding, and circuit breaker

## Communication

- **Blocked?** Escalate to Tech Lead after 5 minutes
- **Need Help?** Request help from Performance Engineer for optimization strategies
- **Complete?** Update tasks.md and report to Tech Lead with files modified

## Implementation Hints

1. **Batching**: Create a `MessageBatcher` class that collects low-priority messages
2. **Sharding**: Use a Map<agentId, PriorityQueue> for per-agent queues
3. **Circuit Breaker**: Track state (closed, open, half-open) per agent
4. **Testing**: Write tests for each optimization independently

## Performance Targets

- Message latency: < 5s (p99)
- Throughput: >= 1000 messages/min
- Circuit breaker response: < 100ms to open circuit
- Batch processing: <= 100ms delay for low-priority messages

Good luck! Remember to update tasks.md when you start and when you complete.
