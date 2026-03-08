# Work Assignment: Phase 1 - Stream A (Message Bus Testing)

**Assigned to**: Developer Agent 1
**Priority**: High
**Status**: In Progress

## Task: Complete Message Bus Unit Tests (Task 1.5)

### Context

The message bus implementation is complete in `lib/agents/message-bus.ts`. Your job is to write comprehensive unit tests to verify all functionality works correctly.

### Acceptance Criteria

- [ ] Test message queuing and delivery
- [ ] Test priority ordering (critical > high > normal > low)
- [ ] Test threading (thread ID generation, history tracking)
- [ ] Test retry mechanism (exponential backoff, max 3 retries)
- [ ] Test acknowledgment flow
- [ ] Test dead letter queue for failed messages
- [ ] All tests pass
- [ ] Test coverage >= 80% for message-bus.ts

### Files to Modify

- `lib/agents/message-bus.test.ts` (create comprehensive tests)

### Files to Reference

- `lib/agents/message-bus.ts` (implementation to test)
- `lib/agents/types.ts` (type definitions)

### Test Requirements

Use Vitest framework. Test cases should include:

1. **Message Queuing**:
   - Enqueue messages
   - Dequeue in priority order
   - FIFO within same priority

2. **Priority Ordering**:
   - Critical messages processed first
   - High before normal
   - Normal before low
   - Timestamp ordering within same priority

3. **Threading**:
   - Thread ID auto-generation
   - Thread history tracking
   - Parent message references
   - getThread() returns correct history

4. **Retry Mechanism**:
   - Failed delivery triggers retry
   - Exponential backoff (1s, 2s, 4s)
   - Max 3 retry attempts
   - Dead letter queue after max retries

5. **Acknowledgment**:
   - Messages marked as acknowledged after delivery
   - Unacknowledged messages can be tracked

6. **Edge Cases**:
   - No subscribers for recipient
   - Handler throws error
   - Multiple handlers for same agent
   - Concurrent message processing

### Validation Commands

```bash
npm run test:run -- lib/agents/message-bus.test.ts
npm run type-check
npm run lint
```

### Dependencies

None - can start immediately

### Estimated Time

1-2 hours
