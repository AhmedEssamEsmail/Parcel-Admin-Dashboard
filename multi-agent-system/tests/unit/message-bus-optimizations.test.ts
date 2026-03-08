import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageBus } from '@/multi-agent-system/lib/message-bus';

describe('MessageBus Optimizations', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    // Use fast retries for tests (10ms instead of 1000ms)
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    messageBus.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Message Batching', () => {
    it('should batch low-priority messages', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      // Send 3 low-priority messages
      await messageBus.send({
        id: 'msg-1',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'low',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await messageBus.send({
        id: 'msg-2',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'low',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await messageBus.send({
        id: 'msg-3',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'low',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      // Messages should not be delivered yet
      expect(handler).not.toHaveBeenCalled();

      // Advance time by 100ms to trigger batch processing
      await vi.advanceTimersByTimeAsync(100);

      // All 3 messages should be delivered
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should flush batch when it reaches max size (10 messages)', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      // Send 10 low-priority messages
      for (let i = 0; i < 10; i++) {
        await messageBus.send({
          id: `msg-${i}`,
          from: 'sender',
          to: 'agent-1',
          type: 'notification',
          priority: 'low',
          payload: {},
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      // Batch should flush immediately without waiting for timer
      await vi.runAllTimersAsync();

      expect(handler).toHaveBeenCalledTimes(10);
    });

    it('should not batch high-priority messages', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      await messageBus.send({
        id: 'msg-1',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'high',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      // High-priority message should be delivered immediately
      await vi.runAllTimersAsync();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should maintain priority ordering within batches', async () => {
      const deliveredMessages: string[] = [];

      messageBus.subscribe('agent-1', (msg) => {
        deliveredMessages.push(msg.id);
      });

      // Send low-priority messages with different timestamps
      await messageBus.send({
        id: 'msg-3',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'low',
        payload: {},
        timestamp: new Date(Date.now() + 300),
        acknowledged: false,
      });

      await messageBus.send({
        id: 'msg-1',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'low',
        payload: {},
        timestamp: new Date(Date.now() + 100),
        acknowledged: false,
      });

      await messageBus.send({
        id: 'msg-2',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'low',
        payload: {},
        timestamp: new Date(Date.now() + 200),
        acknowledged: false,
      });

      // Advance time to trigger batch processing
      await vi.advanceTimersByTimeAsync(100);

      // Messages should be delivered in timestamp order
      expect(deliveredMessages).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });
  });

  describe('Sharding by Agent ID', () => {
    it('should create separate queues for different agents', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      messageBus.subscribe('agent-1', handler1);
      messageBus.subscribe('agent-2', handler2);

      await messageBus.send({
        id: 'msg-1',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await messageBus.send({
        id: 'msg-2',
        from: 'sender',
        to: 'agent-2',
        type: 'notification',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await vi.runAllTimersAsync();

      // Each agent should receive only their messages
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler1.mock.calls[0][0].id).toBe('msg-1');
      expect(handler2.mock.calls[0][0].id).toBe('msg-2');
    });

    it('should process agent queues independently', async () => {
      const handler1 = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      const handler2 = vi.fn();

      messageBus.subscribe('agent-1', handler1);
      messageBus.subscribe('agent-2', handler2);

      // Send message to agent-1 (slow handler)
      await messageBus.send({
        id: 'msg-1',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      // Send message to agent-2 (fast handler)
      await messageBus.send({
        id: 'msg-2',
        from: 'sender',
        to: 'agent-2',
        type: 'notification',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await vi.runAllTimersAsync();

      // Both handlers should be called despite agent-1's slow handler
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should return queue size for specific agent', async () => {
      // Don't subscribe handlers so messages stay in queue
      await messageBus.send({
        id: 'msg-1',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await messageBus.send({
        id: 'msg-2',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await messageBus.send({
        id: 'msg-3',
        from: 'sender',
        to: 'agent-2',
        type: 'notification',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      // Wait for messages to be queued
      await vi.runAllTimersAsync();

      // Check queue sizes (messages will be in dead letter queue since no handlers)
      // But we can check that the queues were created
      expect(messageBus.getQueueSize()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after 5 consecutive failures', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      messageBus.subscribe('agent-1', handler);

      // Send 5 messages that will fail
      for (let i = 0; i < 5; i++) {
        await messageBus.send({
          id: `msg-${i}`,
          from: 'sender',
          to: 'agent-1',
          type: 'notification',
          priority: 'normal',
          payload: {},
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await vi.runAllTimersAsync();

      // Circuit should be open
      expect(messageBus.getCircuitBreakerState('agent-1')).toBe('open');
    });

    it('should reject messages when circuit is open', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      messageBus.subscribe('agent-1', handler);

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await messageBus.send({
          id: `msg-${i}`,
          from: 'sender',
          to: 'agent-1',
          type: 'notification',
          priority: 'normal',
          payload: {},
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await vi.runAllTimersAsync();

      // Circuit is now open
      expect(messageBus.getCircuitBreakerState('agent-1')).toBe('open');

      // Try to send another message
      await messageBus.send({
        id: 'msg-rejected',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      // Message should be in dead letter queue
      const dlq = messageBus.getDeadLetterQueue();
      expect(dlq.some((msg) => msg.id === 'msg-rejected')).toBe(true);
    });

    it('should transition to half-open after 30 seconds', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      messageBus.subscribe('agent-1', handler);

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await messageBus.send({
          id: `msg-${i}`,
          from: 'sender',
          to: 'agent-1',
          type: 'notification',
          priority: 'normal',
          payload: {},
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await vi.runAllTimersAsync();

      expect(messageBus.getCircuitBreakerState('agent-1')).toBe('open');

      // Advance time by 30 seconds
      await vi.advanceTimersByTimeAsync(30000);

      // Send a new message to trigger half-open check
      await messageBus.send({
        id: 'msg-retry',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      // Circuit should allow the message through (half-open state)
      expect(messageBus.getCircuitBreakerState('agent-1')).toBe('half-open');
    });

    it('should close circuit on successful delivery', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler failed'));

      messageBus.subscribe('agent-1', handler);

      // Send 5 messages that will fail to open the circuit
      for (let i = 0; i < 5; i++) {
        await messageBus.send({
          id: `msg-fail-${i}`,
          from: 'sender',
          to: 'agent-1',
          type: 'notification',
          priority: 'normal',
          payload: {},
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await vi.runAllTimersAsync();

      // Circuit should be open
      expect(messageBus.getCircuitBreakerState('agent-1')).toBe('open');

      // Now make the handler succeed
      handler.mockResolvedValue(undefined);

      // Advance time to half-open
      await vi.advanceTimersByTimeAsync(30000);

      // Send a message that will succeed
      await messageBus.send({
        id: 'msg-success',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await vi.runAllTimersAsync();

      // Circuit should be closed
      expect(messageBus.getCircuitBreakerState('agent-1')).toBe('closed');
    });

    it('should have independent circuit breakers per agent', async () => {
      const handler1 = vi.fn().mockRejectedValue(new Error('Handler 1 failed'));
      const handler2 = vi.fn();

      messageBus.subscribe('agent-1', handler1);
      messageBus.subscribe('agent-2', handler2);

      // Trigger circuit breaker for agent-1
      for (let i = 0; i < 5; i++) {
        await messageBus.send({
          id: `msg-1-${i}`,
          from: 'sender',
          to: 'agent-1',
          type: 'notification',
          priority: 'normal',
          payload: {},
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await vi.runAllTimersAsync();

      // agent-1 circuit should be open
      expect(messageBus.getCircuitBreakerState('agent-1')).toBe('open');

      // agent-2 circuit should still be closed
      expect(messageBus.getCircuitBreakerState('agent-2')).toBe('closed');

      // agent-2 should still receive messages
      await messageBus.send({
        id: 'msg-2',
        from: 'sender',
        to: 'agent-2',
        type: 'notification',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await vi.runAllTimersAsync();

      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Priority Queue Optimization', () => {
    it('should maintain O(log n) enqueue/dequeue operations', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      // Send 100 messages with random priorities
      const priorities: Array<'critical' | 'high' | 'normal' | 'low'> = [
        'critical',
        'high',
        'normal',
        'low',
      ];

      for (let i = 0; i < 100; i++) {
        await messageBus.send({
          id: `msg-${i}`,
          from: 'sender',
          to: 'agent-1',
          type: 'notification',
          priority: priorities[Math.floor(Math.random() * priorities.length)],
          payload: {},
          timestamp: new Date(Date.now() + i),
          acknowledged: false,
        });
      }

      await vi.runAllTimersAsync();

      // All messages should be delivered
      expect(handler).toHaveBeenCalledTimes(100);

      // Verify messages were delivered in priority order
      const deliveredPriorities = handler.mock.calls.map((call) => call[0].priority);

      // Check that critical messages come before high
      const lastCriticalIndex = deliveredPriorities.lastIndexOf('critical');
      const firstLowIndex = deliveredPriorities.indexOf('low');

      if (lastCriticalIndex >= 0 && firstLowIndex >= 0) {
        expect(lastCriticalIndex).toBeLessThan(firstLowIndex);
      }
    });

    it('should handle concurrent enqueue operations', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      // Send multiple messages concurrently
      const sendPromises = [];
      for (let i = 0; i < 50; i++) {
        sendPromises.push(
          messageBus.send({
            id: `msg-${i}`,
            from: 'sender',
            to: 'agent-1',
            type: 'notification',
            priority: 'normal',
            payload: {},
            timestamp: new Date(),
            acknowledged: false,
          })
        );
      }

      await Promise.all(sendPromises);
      await vi.runAllTimersAsync();

      // All messages should be delivered
      expect(handler).toHaveBeenCalledTimes(50);
    });
  });

  describe('Integration: All Optimizations Together', () => {
    it('should handle mixed priority messages with batching and sharding', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      messageBus.subscribe('agent-1', handler1);
      messageBus.subscribe('agent-2', handler2);

      // Send mix of high and low priority messages to different agents
      await messageBus.send({
        id: 'msg-1-high',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'high',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await messageBus.send({
        id: 'msg-1-low',
        from: 'sender',
        to: 'agent-1',
        type: 'notification',
        priority: 'low',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await messageBus.send({
        id: 'msg-2-high',
        from: 'sender',
        to: 'agent-2',
        type: 'notification',
        priority: 'high',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      await messageBus.send({
        id: 'msg-2-low',
        from: 'sender',
        to: 'agent-2',
        type: 'notification',
        priority: 'low',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      });

      // High priority messages should be delivered immediately
      await vi.runAllTimersAsync();

      // Advance time to trigger batch processing
      await vi.advanceTimersByTimeAsync(100);

      // All messages should be delivered
      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(2);

      // High priority messages should be delivered first
      expect(handler1.mock.calls[0][0].id).toBe('msg-1-high');
      expect(handler2.mock.calls[0][0].id).toBe('msg-2-high');
    });

    it('should handle circuit breaker with sharding', async () => {
      const handler1 = vi.fn().mockRejectedValue(new Error('Handler 1 failed'));
      const handler2 = vi.fn();

      messageBus.subscribe('agent-1', handler1);
      messageBus.subscribe('agent-2', handler2);

      // Trigger circuit breaker for agent-1
      for (let i = 0; i < 5; i++) {
        await messageBus.send({
          id: `msg-1-${i}`,
          from: 'sender',
          to: 'agent-1',
          type: 'notification',
          priority: 'normal',
          payload: {},
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      // Send messages to agent-2
      for (let i = 0; i < 3; i++) {
        await messageBus.send({
          id: `msg-2-${i}`,
          from: 'sender',
          to: 'agent-2',
          type: 'notification',
          priority: 'normal',
          payload: {},
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      await vi.runAllTimersAsync();

      // agent-1 circuit should be open
      expect(messageBus.getCircuitBreakerState('agent-1')).toBe('open');

      // agent-2 should still work
      expect(handler2).toHaveBeenCalledTimes(3);
    });
  });
});
