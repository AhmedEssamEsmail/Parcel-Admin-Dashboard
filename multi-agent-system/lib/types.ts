export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'notification' | 'escalation';
  priority: 'critical' | 'high' | 'normal' | 'low';
  threadId?: string;
  parentMessageId?: string;
  inReplyTo?: string;
  payload: {
    action?: string;
    context?: unknown;
    result?: unknown;
    [key: string]: unknown; // Allow additional fields for flexibility
  };
  timestamp: Date;
  acknowledged: boolean;
  retryCount?: number;
}

export type MessageHandler = (message: AgentMessage) => Promise<void> | void;

export interface MessageQueue {
  enqueue(message: AgentMessage): void;
  dequeue(): AgentMessage | undefined;
  peek(): AgentMessage | undefined;
  size(): number;
  clear(): void;
}

export interface MessageBatch {
  messages: AgentMessage[];
  createdAt: Date;
}

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreaker {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}
