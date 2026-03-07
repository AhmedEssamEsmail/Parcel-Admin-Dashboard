import {
  AgentMessage,
  MessageHandler,
  MessageQueue,
  CircuitBreaker,
  CircuitBreakerState,
} from './types';

/**
 * Priority queue implementation using a min-heap
 * Messages with higher priority (lower numeric value) are dequeued first
 */
class PriorityQueue implements MessageQueue {
  private heap: AgentMessage[] = [];
  private readonly priorityMap = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  enqueue(message: AgentMessage): void {
    this.heap.push(message);
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): AgentMessage | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const root = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return root;
  }

  peek(): AgentMessage | undefined {
    return this.heap[0];
  }

  size(): number {
    return this.heap.length;
  }

  clear(): void {
    this.heap = [];
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parentIndex]) >= 0) break;

      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (
        leftChild < this.heap.length &&
        this.compare(this.heap[leftChild], this.heap[smallest]) < 0
      ) {
        smallest = leftChild;
      }

      if (
        rightChild < this.heap.length &&
        this.compare(this.heap[rightChild], this.heap[smallest]) < 0
      ) {
        smallest = rightChild;
      }

      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }

  private compare(a: AgentMessage, b: AgentMessage): number {
    const priorityDiff = this.priorityMap[a.priority] - this.priorityMap[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.timestamp.getTime() - b.timestamp.getTime();
  }
}

/**
 * Message batcher for low-priority messages
 * Batches up to 10 messages and processes every 100ms
 */
class MessageBatcher {
  private batch: AgentMessage[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly maxBatchSize = 10;
  private readonly batchInterval = 100; // ms

  constructor(private onFlush: (messages: AgentMessage[]) => void) {}

  add(message: AgentMessage): void {
    this.batch.push(message);

    if (this.batch.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchInterval);
    }
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.batch.length > 0) {
      const messages = [...this.batch];
      this.batch = [];
      this.onFlush(messages);
    }
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.batch = [];
  }
}

export class MessageBus {
  // Sharding: separate queue per agent
  private queues = new Map<string, MessageQueue>();
  private subscribers = new Map<string, Set<MessageHandler>>();
  private threads = new Map<string, AgentMessage[]>();
  private deadLetterQueue: AgentMessage[] = [];
  private processing = new Set<string>();
  private readonly maxRetries = 3;
  private readonly baseRetryDelay = 1000; // 1 second

  // Circuit breakers per agent
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly circuitBreakerThreshold = 5;
  private readonly circuitBreakerTimeout = 30000; // 30 seconds

  // Message batching for low-priority messages
  private batchers = new Map<string, MessageBatcher>();

  /**
   * Subscribe an agent to receive messages
   */
  subscribe(agentId: string, handler: MessageHandler): void {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, new Set());
    }
    this.subscribers.get(agentId)!.add(handler);
  }

  /**
   * Unsubscribe an agent from receiving messages
   */
  unsubscribe(agentId: string, handler?: MessageHandler): void {
    if (!handler) {
      this.subscribers.delete(agentId);
      return;
    }

    const handlers = this.subscribers.get(agentId);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscribers.delete(agentId);
      }
    }
  }

  /**
   * Send a message through the bus
   */
  async send(message: AgentMessage): Promise<void> {
    // Generate thread ID if not present
    if (!message.threadId) {
      message.threadId = this.generateThreadId();
    }

    // Add to thread history
    if (!this.threads.has(message.threadId)) {
      this.threads.set(message.threadId, []);
    }
    this.threads.get(message.threadId)!.push(message);

    // Check circuit breaker
    if (this.isCircuitOpen(message.to)) {
      console.warn(`[MessageBus] Circuit breaker open for agent: ${message.to}`);
      this.deadLetterQueue.push(message);
      return;
    }

    // Use batching for low-priority messages
    if (message.priority === 'low') {
      this.getBatcher(message.to).add(message);
    } else {
      // Enqueue to agent-specific queue
      this.getQueue(message.to).enqueue(message);

      // Start processing if not already running for this agent
      if (!this.processing.has(message.to)) {
        this.processQueue(message.to);
      }
    }
  }

  /**
   * Get conversation history for a thread
   */
  getThread(threadId: string): AgentMessage[] {
    return this.threads.get(threadId) || [];
  }

  /**
   * Get messages that failed after max retries
   */
  getDeadLetterQueue(): AgentMessage[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear the dead letter queue
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
  }

  /**
   * Get or create queue for an agent (sharding)
   */
  private getQueue(agentId: string): MessageQueue {
    if (!this.queues.has(agentId)) {
      this.queues.set(agentId, new PriorityQueue());
    }
    return this.queues.get(agentId)!;
  }

  /**
   * Get or create batcher for an agent
   */
  private getBatcher(agentId: string): MessageBatcher {
    if (!this.batchers.has(agentId)) {
      const batcher = new MessageBatcher((messages) => {
        // Enqueue all batched messages
        const queue = this.getQueue(agentId);
        messages.forEach((msg) => queue.enqueue(msg));

        // Start processing if not already running
        if (!this.processing.has(agentId)) {
          this.processQueue(agentId);
        }
      });
      this.batchers.set(agentId, batcher);
    }
    return this.batchers.get(agentId)!;
  }

  /**
   * Check if circuit breaker is open for an agent
   */
  private isCircuitOpen(agentId: string): boolean {
    const breaker = this.circuitBreakers.get(agentId);
    if (!breaker) return false;

    if (breaker.state === 'open') {
      // Check if we should transition to half-open
      if (breaker.nextRetryTime && Date.now() >= breaker.nextRetryTime.getTime()) {
        breaker.state = 'half-open';
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record delivery success for circuit breaker
   */
  private recordSuccess(agentId: string): void {
    const breaker = this.circuitBreakers.get(agentId);
    if (breaker) {
      breaker.state = 'closed';
      breaker.failureCount = 0;
      breaker.lastFailureTime = undefined;
      breaker.nextRetryTime = undefined;
    }
  }

  /**
   * Record delivery failure for circuit breaker
   */
  private recordFailure(agentId: string): void {
    let breaker = this.circuitBreakers.get(agentId);
    if (!breaker) {
      breaker = {
        state: 'closed',
        failureCount: 0,
      };
      this.circuitBreakers.set(agentId, breaker);
    }

    breaker.failureCount++;
    breaker.lastFailureTime = new Date();

    if (breaker.failureCount >= this.circuitBreakerThreshold) {
      breaker.state = 'open';
      breaker.nextRetryTime = new Date(Date.now() + this.circuitBreakerTimeout);
      console.warn(
        `[MessageBus] Circuit breaker opened for agent: ${agentId} after ${breaker.failureCount} failures`
      );
    }
  }

  /**
   * Process messages from an agent-specific queue
   */
  private async processQueue(agentId: string): Promise<void> {
    this.processing.add(agentId);

    const queue = this.getQueue(agentId);

    while (queue.size() > 0) {
      const message = queue.dequeue();
      if (!message) break;

      try {
        await this.deliverMessage(message);
        this.recordSuccess(agentId);
      } catch (error) {
        this.recordFailure(agentId);
        await this.handleDeliveryError(message, error);
      }
    }

    this.processing.delete(agentId);
  }

  /**
   * Deliver a message to its recipient
   */
  private async deliverMessage(message: AgentMessage): Promise<void> {
    const handlers = this.subscribers.get(message.to);

    if (!handlers || handlers.size === 0) {
      throw new Error(`No handlers registered for agent: ${message.to}`);
    }

    // Deliver to all handlers
    const deliveryPromises = Array.from(handlers).map((handler) =>
      Promise.resolve(handler(message))
    );

    await Promise.all(deliveryPromises);

    // Mark as acknowledged
    message.acknowledged = true;
  }

  /**
   * Handle message delivery errors with retry logic
   */
  private async handleDeliveryError(message: AgentMessage, error: unknown): Promise<void> {
    const retryCount = (message.retryCount || 0) + 1;

    if (retryCount <= this.maxRetries) {
      // Retry with exponential backoff
      const delay = this.baseRetryDelay * Math.pow(2, retryCount - 1);

      console.warn(
        `[MessageBus] Retrying message ${message.id} (attempt ${retryCount}/${this.maxRetries}) after ${delay}ms`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));

      // Re-enqueue with updated retry count
      const retryMessage = {
        ...message,
        retryCount,
      };

      this.getQueue(message.to).enqueue(retryMessage);
    } else {
      // Max retries exceeded, move to dead letter queue
      this.deadLetterQueue.push({
        ...message,
        retryCount,
      });

      console.error(`Message ${message.id} failed after ${this.maxRetries} retries:`, error);

      // Notify sender of delivery failure
      await this.notifyDeliveryFailure(message, error);

      // Escalate critical message failures
      if (message.priority === 'critical') {
        await this.escalateCriticalFailure(message, error);
      }
    }
  }

  /**
   * Notify sender of message delivery failure
   */
  private async notifyDeliveryFailure(message: AgentMessage, error: unknown): Promise<void> {
    try {
      const failureNotification: AgentMessage = {
        id: `delivery-failure-${message.id}`,
        from: 'message-bus',
        to: message.from,
        type: 'notification',
        priority: 'high',
        inReplyTo: message.id,
        payload: {
          action: 'delivery-failed',
          context: {
            originalMessage: message,
            error: error instanceof Error ? error.message : String(error),
            retries: this.maxRetries,
          },
        },
        timestamp: new Date(),
        acknowledged: false,
      };

      // Deliver directly to sender's handlers (don't queue to avoid infinite loop)
      const handlers = this.subscribers.get(message.from);
      if (handlers && handlers.size > 0) {
        const deliveryPromises = Array.from(handlers).map((handler) =>
          Promise.resolve(handler(failureNotification))
        );
        await Promise.all(deliveryPromises);
      }
    } catch (notificationError) {
      console.error('Failed to notify sender of delivery failure:', notificationError);
    }
  }

  /**
   * Escalate critical message delivery failures
   */
  private async escalateCriticalFailure(message: AgentMessage, error: unknown): Promise<void> {
    try {
      const escalation: AgentMessage = {
        id: `critical-failure-${message.id}`,
        from: 'message-bus',
        to: 'tech-lead',
        type: 'escalation',
        priority: 'critical',
        payload: {
          action: 'critical-message-failure',
          context: {
            originalMessage: message,
            error: error instanceof Error ? error.message : String(error),
            retries: this.maxRetries,
            timestamp: new Date(),
          },
        },
        timestamp: new Date(),
        acknowledged: false,
      };

      // Deliver directly to tech lead handlers
      const handlers = this.subscribers.get('tech-lead');
      if (handlers && handlers.size > 0) {
        const deliveryPromises = Array.from(handlers).map((handler) =>
          Promise.resolve(handler(escalation))
        );
        await Promise.all(deliveryPromises);
      }
    } catch (escalationError) {
      console.error('Failed to escalate critical message failure:', escalationError);
    }
  }

  /**
   * Generate a unique thread ID
   */
  private generateThreadId(): string {
    return `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get current queue size for an agent
   */
  getQueueSize(agentId?: string): number {
    if (agentId) {
      return this.queues.get(agentId)?.size() || 0;
    }
    // Return total queue size across all agents
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.size();
    }
    return total;
  }

  /**
   * Get circuit breaker state for an agent
   */
  getCircuitBreakerState(agentId: string): CircuitBreakerState {
    return this.circuitBreakers.get(agentId)?.state || 'closed';
  }

  /**
   * Clear all queues and subscribers (for testing)
   */
  clear(): void {
    this.queues.clear();
    this.subscribers.clear();
    this.threads.clear();
    this.deadLetterQueue = [];
    this.processing.clear();
    this.circuitBreakers.clear();

    // Clear all batchers
    for (const batcher of this.batchers.values()) {
      batcher.clear();
    }
    this.batchers.clear();
  }
}
