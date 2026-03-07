/**
 * Performance Tests for Message Bus
 *
 * Tests message bus performance under various load conditions:
 * - Load test: 1000 messages/min with 10 agents
 * - Stress test: 5000 messages/min with 20 agents
 * - Latency measurements (p50, p95, p99)
 * - Priority queue performance
 * - Circuit breaker effectiveness
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageBus } from '@/multi-agent-system/lib/message-bus';
import { AgentMessage } from '@/multi-agent-system/lib/types';

interface PerformanceMetrics {
  latencies: number[];
  throughput: number;
  queueDepths: number[];
  deadLetterCount: number;
  startTime: number;
  endTime: number;
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

/**
 * Generate mock agents with message handlers
 */
function createMockAgents(messageBus: MessageBus, count: number, latencies: number[]): string[] {
  const agentIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const agentId = `agent-${i}`;
    agentIds.push(agentId);

    // Subscribe agent with handler that tracks latency
    messageBus.subscribe(agentId, async (message: AgentMessage) => {
      const latency = Date.now() - message.timestamp.getTime();
      latencies.push(latency);
    });
  }

  return agentIds;
}

/**
 * Generate load by sending messages at specified rate
 */
async function generateLoad(
  messageBus: MessageBus,
  agentIds: string[],
  messagesPerMinute: number,
  durationMs: number,
  metrics: PerformanceMetrics
): Promise<void> {
  const intervalMs = (60 * 1000) / messagesPerMinute;
  const messageCount = Math.floor((durationMs / 60000) * messagesPerMinute);

  metrics.startTime = Date.now();

  for (let i = 0; i < messageCount; i++) {
    const fromAgent = agentIds[Math.floor(Math.random() * agentIds.length)];
    const toAgent = agentIds[Math.floor(Math.random() * agentIds.length)];

    // Vary priority distribution
    let priority: 'critical' | 'high' | 'normal' | 'low';
    const rand = Math.random();
    if (rand < 0.05) priority = 'critical';
    else if (rand < 0.2) priority = 'high';
    else if (rand < 0.8) priority = 'normal';
    else priority = 'low';

    const message: AgentMessage = {
      id: `msg-${i}`,
      from: fromAgent,
      to: toAgent,
      type: 'request',
      priority,
      payload: { action: 'test', context: `message-${i}` },
      timestamp: new Date(),
      acknowledged: false,
    };

    await messageBus.send(message);

    // Track queue depth
    metrics.queueDepths.push(messageBus.getQueueSize());

    // Wait for next message interval
    if (i < messageCount - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // Wait for all messages to be processed
  await new Promise((resolve) => setTimeout(resolve, 1000));

  metrics.endTime = Date.now();
  metrics.deadLetterCount = messageBus.getDeadLetterQueue().length;

  const durationSeconds = (metrics.endTime - metrics.startTime) / 1000;
  metrics.throughput = messageCount / durationSeconds;
}

describe('Message Bus Performance', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  afterEach(() => {
    messageBus.clear();
  });

  describe('Load Test - Normal Operating Conditions', () => {
    it('should handle 1000 messages/min with 10 agents', async () => {
      const agentCount = 10;
      const messagesPerMinute = 1000;
      const testDurationMs = 60000; // 1 minute

      const metrics: PerformanceMetrics = {
        latencies: [],
        throughput: 0,
        queueDepths: [],
        deadLetterCount: 0,
        startTime: 0,
        endTime: 0,
      };

      // Create mock agents
      const agentIds = createMockAgents(messageBus, agentCount, metrics.latencies);

      // Generate load
      await generateLoad(messageBus, agentIds, messagesPerMinute, testDurationMs, metrics);

      // Calculate latency percentiles
      const sortedLatencies = metrics.latencies.sort((a, b) => a - b);
      const p50 = calculatePercentile(sortedLatencies, 50);
      const p95 = calculatePercentile(sortedLatencies, 95);
      const p99 = calculatePercentile(sortedLatencies, 99);

      // Calculate average queue depth
      const avgQueueDepth =
        metrics.queueDepths.reduce((a, b) => a + b, 0) / metrics.queueDepths.length;
      const maxQueueDepth = Math.max(...metrics.queueDepths);

      // Log results
      console.log('\n=== Load Test Results (1000 msg/min, 10 agents) ===');
      console.log(`Messages processed: ${metrics.latencies.length}`);
      console.log(`Throughput: ${metrics.throughput.toFixed(2)} msg/sec`);
      console.log(`Latency p50: ${p50.toFixed(2)}ms`);
      console.log(`Latency p95: ${p95.toFixed(2)}ms`);
      console.log(`Latency p99: ${p99.toFixed(2)}ms`);
      console.log(`Avg queue depth: ${avgQueueDepth.toFixed(2)}`);
      console.log(`Max queue depth: ${maxQueueDepth}`);
      console.log(`Dead letter queue: ${metrics.deadLetterCount}`);

      // Assertions - NFR-1: Message latency < 5s (p99)
      expect(p99).toBeLessThan(5000);

      // Throughput should be close to target (allow 10% variance)
      const targetThroughput = messagesPerMinute / 60;
      expect(metrics.throughput).toBeGreaterThan(targetThroughput * 0.9);

      // No messages should fail
      expect(metrics.deadLetterCount).toBe(0);

      // Queue should not grow unbounded
      expect(maxQueueDepth).toBeLessThan(100);
    }, 90000); // 90 second timeout

    it('should maintain low latency across all priority levels', async () => {
      const agentCount = 10;
      const messagesPerPriority = 100;

      const latenciesByPriority: Record<string, number[]> = {
        critical: [],
        high: [],
        normal: [],
        low: [],
      };

      // Create mock agents
      const agentIds: string[] = [];
      for (let i = 0; i < agentCount; i++) {
        const agentId = `agent-${i}`;
        agentIds.push(agentId);

        messageBus.subscribe(agentId, async (message: AgentMessage) => {
          const latency = Date.now() - message.timestamp.getTime();
          latenciesByPriority[message.priority].push(latency);
        });
      }

      // Send messages for each priority level
      const priorities: Array<'critical' | 'high' | 'normal' | 'low'> = [
        'critical',
        'high',
        'normal',
        'low',
      ];

      for (const priority of priorities) {
        for (let i = 0; i < messagesPerPriority; i++) {
          const fromAgent = agentIds[Math.floor(Math.random() * agentIds.length)];
          const toAgent = agentIds[Math.floor(Math.random() * agentIds.length)];

          const message: AgentMessage = {
            id: `msg-${priority}-${i}`,
            from: fromAgent,
            to: toAgent,
            type: 'request',
            priority,
            payload: { action: 'test' },
            timestamp: new Date(),
            acknowledged: false,
          };

          await messageBus.send(message);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Analyze latencies by priority
      console.log('\n=== Latency by Priority Level ===');
      for (const priority of priorities) {
        const latencies = latenciesByPriority[priority].sort((a, b) => a - b);
        const p99 = calculatePercentile(latencies, 99);

        console.log(
          `${priority.toUpperCase()} - p99: ${p99.toFixed(2)}ms (${latencies.length} messages)`
        );

        // All priorities should meet latency target
        expect(p99).toBeLessThan(5000);
      }

      // Critical messages should have lower latency than low priority
      const criticalP99 = calculatePercentile(
        latenciesByPriority.critical.sort((a, b) => a - b),
        99
      );
      const lowP99 = calculatePercentile(
        latenciesByPriority.low.sort((a, b) => a - b),
        99
      );

      expect(criticalP99).toBeLessThanOrEqual(lowP99);
    }, 60000);
  });

  describe('Stress Test - High Load Conditions', () => {
    it('should handle 5000 messages/min with 20 agents', async () => {
      const agentCount = 20;
      const messagesPerMinute = 5000;
      const testDurationMs = 60000; // 1 minute

      const metrics: PerformanceMetrics = {
        latencies: [],
        throughput: 0,
        queueDepths: [],
        deadLetterCount: 0,
        startTime: 0,
        endTime: 0,
      };

      // Create mock agents
      const agentIds = createMockAgents(messageBus, agentCount, metrics.latencies);

      // Generate high load
      await generateLoad(messageBus, agentIds, messagesPerMinute, testDurationMs, metrics);

      // Calculate latency percentiles
      const sortedLatencies = metrics.latencies.sort((a, b) => a - b);
      const p50 = calculatePercentile(sortedLatencies, 50);
      const p95 = calculatePercentile(sortedLatencies, 95);
      const p99 = calculatePercentile(sortedLatencies, 99);

      // Calculate queue statistics
      const avgQueueDepth =
        metrics.queueDepths.reduce((a, b) => a + b, 0) / metrics.queueDepths.length;
      const maxQueueDepth = Math.max(...metrics.queueDepths);

      // Log results
      console.log('\n=== Stress Test Results (5000 msg/min, 20 agents) ===');
      console.log(`Messages processed: ${metrics.latencies.length}`);
      console.log(`Throughput: ${metrics.throughput.toFixed(2)} msg/sec`);
      console.log(`Latency p50: ${p50.toFixed(2)}ms`);
      console.log(`Latency p95: ${p95.toFixed(2)}ms`);
      console.log(`Latency p99: ${p99.toFixed(2)}ms`);
      console.log(`Avg queue depth: ${avgQueueDepth.toFixed(2)}`);
      console.log(`Max queue depth: ${maxQueueDepth}`);
      console.log(`Dead letter queue: ${metrics.deadLetterCount}`);

      // System should remain stable under stress
      expect(p99).toBeLessThan(5000);

      // Should handle high throughput
      const targetThroughput = messagesPerMinute / 60;
      expect(metrics.throughput).toBeGreaterThan(targetThroughput * 0.8); // Allow 20% variance under stress

      // Minimal failures acceptable under stress
      expect(metrics.deadLetterCount).toBeLessThan(metrics.latencies.length * 0.01); // < 1% failure rate

      // Queue should not grow unbounded even under stress
      expect(maxQueueDepth).toBeLessThan(500);
    }, 90000);

    it('should handle burst traffic spikes', async () => {
      const agentCount = 15;
      const burstSize = 500;
      const latencies: number[] = [];

      // Create mock agents
      const agentIds = createMockAgents(messageBus, agentCount, latencies);

      // Send burst of messages
      const startTime = Date.now();
      const sendPromises: Promise<void>[] = [];

      for (let i = 0; i < burstSize; i++) {
        const fromAgent = agentIds[Math.floor(Math.random() * agentIds.length)];
        const toAgent = agentIds[Math.floor(Math.random() * agentIds.length)];

        const message: AgentMessage = {
          id: `burst-msg-${i}`,
          from: fromAgent,
          to: toAgent,
          type: 'request',
          priority: 'normal',
          payload: { action: 'test' },
          timestamp: new Date(),
          acknowledged: false,
        };

        sendPromises.push(messageBus.send(message));
      }

      await Promise.all(sendPromises);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Calculate metrics
      const sortedLatencies = latencies.sort((a, b) => a - b);
      const p99 = calculatePercentile(sortedLatencies, 99);
      const throughput = burstSize / duration;

      console.log('\n=== Burst Traffic Test Results ===');
      console.log(`Burst size: ${burstSize} messages`);
      console.log(`Duration: ${duration.toFixed(2)}s`);
      console.log(`Throughput: ${throughput.toFixed(2)} msg/sec`);
      console.log(`Latency p99: ${p99.toFixed(2)}ms`);
      console.log(`Messages processed: ${latencies.length}`);

      // Should handle burst without excessive latency
      expect(p99).toBeLessThan(5000);

      // All messages should be processed
      expect(latencies.length).toBe(burstSize);
    }, 30000);
  });

  describe('Priority Queue Performance', () => {
    it('should process critical messages first', async () => {
      const agentId = 'test-agent';
      const processedMessages: AgentMessage[] = [];

      messageBus.subscribe(agentId, async (message: AgentMessage) => {
        processedMessages.push(message);
      });

      // Send messages in mixed priority order
      const messages: Array<{ id: string; priority: 'critical' | 'high' | 'normal' | 'low' }> = [
        { id: 'msg-1', priority: 'normal' },
        { id: 'msg-2', priority: 'critical' },
        { id: 'msg-3', priority: 'low' },
        { id: 'msg-4', priority: 'high' },
        { id: 'msg-5', priority: 'critical' },
        { id: 'msg-6', priority: 'normal' },
      ];

      for (const msg of messages) {
        await messageBus.send({
          id: msg.id,
          from: 'sender',
          to: agentId,
          type: 'request',
          priority: msg.priority,
          payload: { action: 'test' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify priority ordering
      expect(processedMessages.length).toBe(6);

      // First two should be critical
      expect(processedMessages[0].priority).toBe('critical');
      expect(processedMessages[1].priority).toBe('critical');

      // Next should be high
      expect(processedMessages[2].priority).toBe('high');

      // Then normal
      expect(processedMessages[3].priority).toBe('normal');
      expect(processedMessages[4].priority).toBe('normal');

      // Last should be low
      expect(processedMessages[5].priority).toBe('low');
    });
  });

  describe('System Stability', () => {
    it('should not leak memory under sustained load', async () => {
      const agentCount = 10;
      const messagesPerRound = 100;
      const rounds = 10;
      const latencies: number[] = [];

      // Create mock agents
      const agentIds = createMockAgents(messageBus, agentCount, latencies);

      // Track memory usage (approximate)
      const initialQueueSize = messageBus.getQueueSize();

      for (let round = 0; round < rounds; round++) {
        // Send messages
        for (let i = 0; i < messagesPerRound; i++) {
          const fromAgent = agentIds[Math.floor(Math.random() * agentIds.length)];
          const toAgent = agentIds[Math.floor(Math.random() * agentIds.length)];

          await messageBus.send({
            id: `msg-${round}-${i}`,
            from: fromAgent,
            to: toAgent,
            type: 'request',
            priority: 'normal',
            payload: { action: 'test' },
            timestamp: new Date(),
            acknowledged: false,
          });
        }

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Queue should be empty or near-empty after processing
        const currentQueueSize = messageBus.getQueueSize();
        expect(currentQueueSize).toBeLessThan(10);
      }

      const finalQueueSize = messageBus.getQueueSize();

      console.log('\n=== Memory Stability Test ===');
      console.log(`Rounds: ${rounds}`);
      console.log(`Messages per round: ${messagesPerRound}`);
      console.log(`Total messages: ${rounds * messagesPerRound}`);
      console.log(`Initial queue size: ${initialQueueSize}`);
      console.log(`Final queue size: ${finalQueueSize}`);
      console.log(`Messages processed: ${latencies.length}`);

      // Queue should not grow over time
      expect(finalQueueSize).toBeLessThanOrEqual(initialQueueSize + 5);

      // All messages should be processed
      expect(latencies.length).toBe(rounds * messagesPerRound);
    }, 30000);

    it('should handle agent failures gracefully', async () => {
      const agentCount = 5;
      const failingAgentId = 'failing-agent';
      const latencies: number[] = [];

      // Create normal agents
      const agentIds = createMockAgents(messageBus, agentCount, latencies);

      // Create failing agent
      messageBus.subscribe(failingAgentId, async () => {
        throw new Error('Agent handler failed');
      });

      // Send messages to both normal and failing agents
      for (let i = 0; i < 50; i++) {
        const toAgent = i % 2 === 0 ? failingAgentId : agentIds[i % agentIds.length];

        await messageBus.send({
          id: `msg-${i}`,
          from: 'sender',
          to: toAgent,
          type: 'request',
          priority: 'normal',
          payload: { action: 'test' },
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      // Wait for processing and retries
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const deadLetterCount = messageBus.getDeadLetterQueue().length;

      console.log('\n=== Failure Handling Test ===');
      console.log(`Messages sent: 50`);
      console.log(`Successful deliveries: ${latencies.length}`);
      console.log(`Dead letter queue: ${deadLetterCount}`);

      // Normal agents should receive their messages
      expect(latencies.length).toBeGreaterThan(20);

      // Failed messages should be in dead letter queue
      expect(deadLetterCount).toBeGreaterThan(0);
    }, 15000);
  });
});
