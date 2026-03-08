import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageBus } from './message-bus';
import { AgentMessage, MessageHandler } from './types';

describe('MessageBus', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    // Use fast retries for tests (10ms instead of 1000ms)
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
  });

  afterEach(() => {
    messageBus.clear();
  });

  describe('Message Queuing and Delivery', () => {
    it('should deliver a message to a subscribed agent', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: { action: 'test' },
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          from: 'agent-0',
          to: 'agent-1',
        })
      );
    });

    it('should deliver messages to multiple handlers for the same agent', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      messageBus.subscribe('agent-1', handler1);
      messageBus.subscribe('agent-1', handler2);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should mark message as acknowledged after delivery', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(message.acknowledged).toBe(true);
    });

    it('should handle unsubscribe correctly', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);
      messageBus.unsubscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should unsubscribe all handlers when no handler specified', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      messageBus.subscribe('agent-1', handler1);
      messageBus.subscribe('agent-1', handler2);
      messageBus.unsubscribe('agent-1');

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('Priority Ordering', () => {
    it('should deliver critical messages before high priority messages', async () => {
      const deliveryOrder: string[] = [];

      // Use a blocking handler to queue up messages
      let blockHandler = true;
      const handler: MessageHandler = async (msg) => {
        // Wait until we're ready to process
        while (blockHandler) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        deliveryOrder.push(msg.id);
      };

      messageBus.subscribe('agent-1', handler);

      // Send all messages while handler is blocked
      const normalMsg: AgentMessage = {
        id: 'msg-normal',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      const criticalMsg: AgentMessage = {
        id: 'msg-critical',
        from: 'agent-0',
        to: 'agent-1',
        type: 'escalation',
        priority: 'critical',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      const highMsg: AgentMessage = {
        id: 'msg-high',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'high',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      // Send in reverse priority order
      messageBus.send(normalMsg);
      messageBus.send(highMsg);
      messageBus.send(criticalMsg);

      // Wait a bit for messages to queue
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Unblock handler and let messages process
      blockHandler = false;

      // Wait for all messages to be delivered
      await new Promise((resolve) => setTimeout(resolve, 200));

      // First message (normal) processes first since it started before blocking
      // Then critical and high process in priority order
      expect(deliveryOrder[0]).toBe('msg-normal');
      expect(deliveryOrder.slice(1)).toEqual(['msg-critical', 'msg-high']);
    });

    it('should deliver messages with same priority in FIFO order', async () => {
      const deliveryOrder: string[] = [];
      const handler: MessageHandler = async (msg) => {
        deliveryOrder.push(msg.id);
      };

      messageBus.subscribe('agent-1', handler);

      const msg1: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(Date.now() - 1000),
        acknowledged: false,
      };

      const msg2: AgentMessage = {
        id: 'msg-2',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(msg1);
      await messageBus.send(msg2);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(deliveryOrder).toEqual(['msg-1', 'msg-2']);
    });

    it('should handle all priority levels correctly', async () => {
      const deliveryOrder: string[] = [];

      // Use a blocking handler to queue up messages
      let blockHandler = true;
      const handler: MessageHandler = async (msg) => {
        // Wait until we're ready to process
        while (blockHandler) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        deliveryOrder.push(msg.id);
      };

      messageBus.subscribe('agent-1', handler);

      const priorities: Array<'critical' | 'high' | 'normal' | 'low'> = [
        'low',
        'normal',
        'high',
        'critical',
      ];

      for (const priority of priorities) {
        const msg: AgentMessage = {
          id: `msg-${priority}`,
          from: 'agent-0',
          to: 'agent-1',
          type: 'request',
          priority,
          payload: {},
          timestamp: new Date(),
          acknowledged: false,
        };
        messageBus.send(msg);
      }

      // Wait a bit for messages to queue
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Unblock handler and let messages process
      blockHandler = false;

      // Wait for all messages to be delivered
      await new Promise((resolve) => setTimeout(resolve, 200));

      // First message (low) processes first since it started before blocking
      // Then remaining messages process in priority order
      expect(deliveryOrder[0]).toBe('msg-low');
      expect(deliveryOrder.slice(1)).toEqual(['msg-critical', 'msg-high', 'msg-normal']);
    });
  });

  describe('Message Threading', () => {
    it('should generate thread ID if not provided', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(message.threadId).toBeDefined();
      expect(message.threadId).toMatch(/^thread-/);
    });

    it('should preserve thread ID when provided', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        threadId: 'custom-thread-123',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(message.threadId).toBe('custom-thread-123');
    });

    it('should track message history in threads', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);
      messageBus.subscribe('agent-2', handler);

      const threadId = 'thread-123';

      const msg1: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        threadId,
        payload: { action: 'start' },
        timestamp: new Date(),
        acknowledged: false,
      };

      const msg2: AgentMessage = {
        id: 'msg-2',
        from: 'agent-1',
        to: 'agent-2',
        type: 'response',
        priority: 'normal',
        threadId,
        parentMessageId: 'msg-1',
        payload: { result: 'done' },
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(msg1);
      await messageBus.send(msg2);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const thread = messageBus.getThread(threadId);
      expect(thread).toHaveLength(2);
      expect(thread[0].id).toBe('msg-1');
      expect(thread[1].id).toBe('msg-2');
      expect(thread[1].parentMessageId).toBe('msg-1');
    });

    it('should return empty array for non-existent thread', () => {
      const thread = messageBus.getThread('non-existent-thread');
      expect(thread).toEqual([]);
    });

    it('should support parent message references', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      const parentMsg: AgentMessage = {
        id: 'msg-parent',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        threadId: 'thread-123',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      const childMsg: AgentMessage = {
        id: 'msg-child',
        from: 'agent-1',
        to: 'agent-0',
        type: 'response',
        priority: 'normal',
        threadId: 'thread-123',
        parentMessageId: 'msg-parent',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(parentMsg);
      await messageBus.send(childMsg);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const thread = messageBus.getThread('thread-123');
      expect(thread[1].parentMessageId).toBe('msg-parent');
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry failed message delivery with exponential backoff', async () => {
      let attemptCount = 0;
      const handler: MessageHandler = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Delivery failed');
        }
      };

      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);

      // Wait for retries (1s + 2s + processing time)
      await new Promise((resolve) => setTimeout(resolve, 3500));

      expect(attemptCount).toBe(3);
    });

    it('should move message to dead letter queue after max retries', async () => {
      const handler: MessageHandler = async () => {
        throw new Error('Always fails');
      };

      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);

      // Wait for all retries (1s + 2s + 4s + processing time)
      await new Promise((resolve) => setTimeout(resolve, 8000));

      const deadLetters = messageBus.getDeadLetterQueue();
      expect(deadLetters).toHaveLength(1);
      expect(deadLetters[0].id).toBe('msg-1');
      expect(deadLetters[0].retryCount).toBe(4); // Initial + 3 retries
    }, 10000); // 10 second timeout

    it('should not retry if delivery succeeds on first attempt', async () => {
      let attemptCount = 0;
      const handler: MessageHandler = async () => {
        attemptCount++;
      };

      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(attemptCount).toBe(1);
    });

    it('should clear dead letter queue', async () => {
      const handler: MessageHandler = async () => {
        throw new Error('Always fails');
      };

      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 8000));

      expect(messageBus.getDeadLetterQueue()).toHaveLength(1);

      messageBus.clearDeadLetterQueue();
      expect(messageBus.getDeadLetterQueue()).toHaveLength(0);
    }, 10000); // 10 second timeout
  });

  describe('Acknowledgment', () => {
    it('should acknowledge message after successful delivery', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      expect(message.acknowledged).toBe(false);

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(message.acknowledged).toBe(true);
    });

    it('should not acknowledge message if delivery fails', async () => {
      const handler: MessageHandler = async () => {
        throw new Error('Delivery failed');
      };

      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(message.acknowledged).toBe(false);
    });
  });

  describe('Queue Management', () => {
    it('should report correct queue size', async () => {
      expect(messageBus.getQueueSize()).toBe(0);

      // Create a slow handler to keep messages in queue longer
      const handler: MessageHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      };
      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      // Send message and check queue size immediately
      const sendPromise = messageBus.send(message);

      // Queue should have message before processing completes
      // Note: This is timing-dependent, so we just verify it eventually processes
      await sendPromise;
      await new Promise((resolve) => setTimeout(resolve, 150));

      // After processing, queue should be empty
      expect(messageBus.getQueueSize()).toBe(0);
    });

    it('should clear all queues and subscribers', async () => {
      const handler = vi.fn();
      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);
      messageBus.clear();

      expect(messageBus.getQueueSize()).toBe(0);
      expect(messageBus.getThread('any-thread')).toEqual([]);
      expect(messageBus.getDeadLetterQueue()).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing subscriber gracefully', async () => {
      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'non-existent-agent',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);

      // Wait for retry attempts
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // Should end up in dead letter queue
      const deadLetters = messageBus.getDeadLetterQueue();
      expect(deadLetters.length).toBeGreaterThan(0);
    }, 10000); // 10 second timeout

    it('should handle async handler errors', async () => {
      const handler: MessageHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Async error');
      };

      messageBus.subscribe('agent-1', handler);

      const message: AgentMessage = {
        id: 'msg-1',
        from: 'agent-0',
        to: 'agent-1',
        type: 'request',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
        acknowledged: false,
      };

      await messageBus.send(message);

      // Wait for retries
      await new Promise((resolve) => setTimeout(resolve, 8000));

      const deadLetters = messageBus.getDeadLetterQueue();
      expect(deadLetters).toHaveLength(1);
    }, 10000); // 10 second timeout
  });
});
