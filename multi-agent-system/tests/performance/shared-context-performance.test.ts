/**
 * Performance Tests for Shared Context Manager
 *
 * Tests shared context performance under various load conditions:
 * - Concurrent read/write operations
 * - File locking performance
 * - Work item tracking at scale
 * - Knowledge base query performance
 * - Cache effectiveness
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SharedContextManager } from '@/multi-agent-system/lib/shared-context';
import { WorkItem, KnowledgeItem } from '@/multi-agent-system/lib/shared-context-types';

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

describe('Shared Context Performance', () => {
  let contextManager: SharedContextManager;

  beforeEach(() => {
    contextManager = new SharedContextManager();
  });

  afterEach(() => {
    contextManager.clear();
  });

  describe('Read/Write Performance', () => {
    it('should handle concurrent reads efficiently', async () => {
      const concurrentReads = 1000;
      const latencies: number[] = [];

      // Populate context with data
      for (let i = 0; i < 100; i++) {
        const workItem: WorkItem = {
          id: `task-${i}`,
          title: `Feature ${i}`,
          assignedTo: `agent-${i % 10}`,
          status: 'pending',
          dependencies: [],
          artifacts: [],
          timeSpent: 0,
        };
        contextManager.createWorkItem(workItem);
      }

      // Perform concurrent reads
      const readPromises: Promise<void>[] = [];

      for (let i = 0; i < concurrentReads; i++) {
        readPromises.push(
          (async () => {
            const startTime = Date.now();
            contextManager.getProjectState();
            const latency = Date.now() - startTime;
            latencies.push(latency);
          })()
        );
      }

      await Promise.all(readPromises);

      // Calculate statistics
      const sortedLatencies = latencies.sort((a, b) => a - b);
      const p50 = calculatePercentile(sortedLatencies, 50);
      const p95 = calculatePercentile(sortedLatencies, 95);
      const p99 = calculatePercentile(sortedLatencies, 99);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log('\n=== Concurrent Read Performance ===');
      console.log(`Total reads: ${concurrentReads}`);
      console.log(`Average latency: ${avg.toFixed(2)}ms`);
      console.log(`p50 latency: ${p50.toFixed(2)}ms`);
      console.log(`p95 latency: ${p95.toFixed(2)}ms`);
      console.log(`p99 latency: ${p99.toFixed(2)}ms`);

      // Reads should be very fast (< 10ms p99)
      expect(p99).toBeLessThan(10);
      expect(avg).toBeLessThan(5);
    });

    it('should handle concurrent writes with versioning', async () => {
      const concurrentWrites = 100;
      const latencies: number[] = [];

      // Perform concurrent writes
      const writePromises: Promise<void>[] = [];

      for (let i = 0; i < concurrentWrites; i++) {
        writePromises.push(
          (async () => {
            const startTime = Date.now();
            contextManager.updateProjectState({
              currentPhase: `phase-${i}`,
            });
            const latency = Date.now() - startTime;
            latencies.push(latency);
          })()
        );
      }

      await Promise.all(writePromises);

      // Calculate statistics
      const sortedLatencies = latencies.sort((a, b) => a - b);
      const p50 = calculatePercentile(sortedLatencies, 50);
      const p95 = calculatePercentile(sortedLatencies, 95);
      const p99 = calculatePercentile(sortedLatencies, 99);

      console.log('\n=== Concurrent Write Performance ===');
      console.log(`Total writes: ${concurrentWrites}`);
      console.log(`p50 latency: ${p50.toFixed(2)}ms`);
      console.log(`p95 latency: ${p95.toFixed(2)}ms`);
      console.log(`p99 latency: ${p99.toFixed(2)}ms`);

      // Writes should complete quickly (< 100ms p99)
      expect(p99).toBeLessThan(100);

      // Version should be incremented correctly
      const finalState = contextManager.getProjectState();
      expect(finalState.version).toBe(concurrentWrites);
    });

    it('should handle mixed read/write workload', async () => {
      const operations = 1000;
      const readRatio = 0.8; // 80% reads, 20% writes
      const readLatencies: number[] = [];
      const writeLatencies: number[] = [];

      // Perform mixed operations
      const operationPromises: Promise<void>[] = [];

      for (let i = 0; i < operations; i++) {
        if (Math.random() < readRatio) {
          // Read operation
          operationPromises.push(
            (async () => {
              const startTime = Date.now();
              contextManager.getProjectState();
              const latency = Date.now() - startTime;
              readLatencies.push(latency);
            })()
          );
        } else {
          // Write operation
          operationPromises.push(
            (async () => {
              const startTime = Date.now();
              contextManager.updateProjectState({
                currentPhase: `phase-${i}`,
              });
              const latency = Date.now() - startTime;
              writeLatencies.push(latency);
            })()
          );
        }
      }

      await Promise.all(operationPromises);

      // Calculate statistics
      const sortedReadLatencies = readLatencies.sort((a, b) => a - b);
      const sortedWriteLatencies = writeLatencies.sort((a, b) => a - b);

      const readP99 = calculatePercentile(sortedReadLatencies, 99);
      const writeP99 = calculatePercentile(sortedWriteLatencies, 99);

      console.log('\n=== Mixed Read/Write Performance ===');
      console.log(`Total operations: ${operations}`);
      console.log(`Reads: ${readLatencies.length} (p99: ${readP99.toFixed(2)}ms)`);
      console.log(`Writes: ${writeLatencies.length} (p99: ${writeP99.toFixed(2)}ms)`);

      // Both should meet performance targets
      expect(readP99).toBeLessThan(10);
      expect(writeP99).toBeLessThan(100);
    });
  });

  describe('File Locking Performance', () => {
    it('should acquire locks quickly under normal load', async () => {
      const lockCount = 100;
      const latencies: number[] = [];

      // Acquire locks sequentially
      for (let i = 0; i < lockCount; i++) {
        const startTime = Date.now();
        const acquired = await contextManager.acquireFileLock(
          `agent-${i}`,
          `file-${i}.ts`,
          'write'
        );
        const latency = Date.now() - startTime;
        latencies.push(latency);

        expect(acquired).toBe(true);
      }

      // Calculate statistics
      const sortedLatencies = latencies.sort((a, b) => a - b);
      const p50 = calculatePercentile(sortedLatencies, 50);
      const p95 = calculatePercentile(sortedLatencies, 95);
      const p99 = calculatePercentile(sortedLatencies, 99);

      console.log('\n=== Lock Acquisition Performance ===');
      console.log(`Total locks: ${lockCount}`);
      console.log(`p50 latency: ${p50.toFixed(2)}ms`);
      console.log(`p95 latency: ${p95.toFixed(2)}ms`);
      console.log(`p99 latency: ${p99.toFixed(2)}ms`);

      // Lock acquisition should be very fast (< 50ms p99)
      expect(p99).toBeLessThan(50);
    });

    it('should handle lock contention efficiently', async () => {
      const agentCount = 10;
      const filePath = 'contested-file.ts';
      const attempts: Array<{ agentId: string; acquired: boolean; latency: number }> = [];

      // Multiple agents try to acquire the same lock
      const lockPromises: Promise<void>[] = [];

      for (let i = 0; i < agentCount; i++) {
        lockPromises.push(
          (async () => {
            const agentId = `agent-${i}`;
            const startTime = Date.now();
            const acquired = await contextManager.acquireFileLock(agentId, filePath, 'write');
            const latency = Date.now() - startTime;

            attempts.push({ agentId, acquired, latency });

            // Release lock if acquired
            if (acquired) {
              await new Promise((resolve) => setTimeout(resolve, 10));
              contextManager.releaseFileLock(agentId, filePath);
            }
          })()
        );
      }

      await Promise.all(lockPromises);

      const successfulAttempts = attempts.filter((a) => a.acquired);
      const failedAttempts = attempts.filter((a) => !a.acquired);

      console.log('\n=== Lock Contention Test ===');
      console.log(`Total attempts: ${agentCount}`);
      console.log(`Successful: ${successfulAttempts.length}`);
      console.log(`Failed: ${failedAttempts.length}`);

      // At least one should succeed
      expect(successfulAttempts.length).toBeGreaterThan(0);

      // Failed attempts should return quickly
      const failedLatencies = failedAttempts.map((a) => a.latency);
      if (failedLatencies.length > 0) {
        const maxFailedLatency = Math.max(...failedLatencies);
        expect(maxFailedLatency).toBeLessThan(100);
      }
    });

    it('should handle high volume of lock operations', async () => {
      const operations = 500;
      const agentCount = 20;
      const fileCount = 50;
      const latencies: number[] = [];

      // Perform random lock/unlock operations
      const operationPromises: Promise<void>[] = [];

      for (let i = 0; i < operations; i++) {
        operationPromises.push(
          (async () => {
            const agentId = `agent-${Math.floor(Math.random() * agentCount)}`;
            const filePath = `file-${Math.floor(Math.random() * fileCount)}.ts`;

            const startTime = Date.now();
            const acquired = await contextManager.acquireFileLock(agentId, filePath, 'write');
            const latency = Date.now() - startTime;
            latencies.push(latency);

            if (acquired) {
              // Hold lock briefly
              await new Promise((resolve) => setTimeout(resolve, 5));
              contextManager.releaseFileLock(agentId, filePath);
            }
          })()
        );
      }

      await Promise.all(operationPromises);

      // Calculate statistics
      const sortedLatencies = latencies.sort((a, b) => a - b);
      const p99 = calculatePercentile(sortedLatencies, 99);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log('\n=== High Volume Lock Operations ===');
      console.log(`Total operations: ${operations}`);
      console.log(`Agents: ${agentCount}`);
      console.log(`Files: ${fileCount}`);
      console.log(`Average latency: ${avg.toFixed(2)}ms`);
      console.log(`p99 latency: ${p99.toFixed(2)}ms`);

      // Should handle high volume efficiently
      expect(p99).toBeLessThan(100);
      expect(avg).toBeLessThan(50);
    });
  });

  describe('Work Item Tracking Performance', () => {
    it('should handle large number of work items', async () => {
      const workItemCount = 1000;
      const createLatencies: number[] = [];
      const queryLatencies: number[] = [];

      // Create work items
      for (let i = 0; i < workItemCount; i++) {
        const startTime = Date.now();

        const workItem: WorkItem = {
          id: `task-${i}`,
          title: `Feature ${i}`,
          assignedTo: `agent-${i % 10}`,
          status: 'pending',
          dependencies: [],
          artifacts: [],
          timeSpent: 0,
        };

        contextManager.createWorkItem(workItem);

        const latency = Date.now() - startTime;
        createLatencies.push(latency);
      }

      // Query work items
      for (let i = 0; i < 100; i++) {
        const startTime = Date.now();
        contextManager.getAllWorkItems();
        const latency = Date.now() - startTime;
        queryLatencies.push(latency);
      }

      // Calculate statistics
      const createP99 = calculatePercentile(
        createLatencies.sort((a, b) => a - b),
        99
      );
      const queryP99 = calculatePercentile(
        queryLatencies.sort((a, b) => a - b),
        99
      );

      console.log('\n=== Work Item Tracking Performance ===');
      console.log(`Work items created: ${workItemCount}`);
      console.log(`Create p99 latency: ${createP99.toFixed(2)}ms`);
      console.log(`Query p99 latency: ${queryP99.toFixed(2)}ms`);

      // Should handle large datasets efficiently
      expect(createP99).toBeLessThan(50);
      expect(queryP99).toBeLessThan(100);
    });

    it('should query work items by status efficiently', async () => {
      const workItemCount = 500;

      // Create work items with various statuses
      for (let i = 0; i < workItemCount; i++) {
        const statuses: WorkItem['status'][] = ['pending', 'in-progress', 'review', 'complete'];
        const status = statuses[i % statuses.length];

        const workItem: WorkItem = {
          id: `task-${i}`,
          title: `Feature ${i}`,
          assignedTo: `agent-${i % 10}`,
          status,
          dependencies: [],
          artifacts: [],
          timeSpent: 0,
        };

        contextManager.createWorkItem(workItem);
      }

      // Query by each status
      const queryLatencies: number[] = [];
      const statuses: WorkItem['status'][] = ['pending', 'in-progress', 'review', 'complete'];

      for (let i = 0; i < 100; i++) {
        const status = statuses[i % statuses.length];
        const startTime = Date.now();
        const items = contextManager.getWorkItemsByStatus(status);
        const latency = Date.now() - startTime;
        queryLatencies.push(latency);

        expect(items.length).toBeGreaterThan(0);
      }

      const p99 = calculatePercentile(
        queryLatencies.sort((a, b) => a - b),
        99
      );

      console.log('\n=== Work Item Query Performance ===');
      console.log(`Total work items: ${workItemCount}`);
      console.log(`Queries: ${queryLatencies.length}`);
      console.log(`p99 latency: ${p99.toFixed(2)}ms`);

      // Queries should be fast
      expect(p99).toBeLessThan(50);
    });
  });

  describe('Knowledge Base Performance', () => {
    it('should handle large knowledge base efficiently', async () => {
      const itemCount = 1000;
      const addLatencies: number[] = [];
      const queryLatencies: number[] = [];

      // Add knowledge items
      for (let i = 0; i < itemCount; i++) {
        const startTime = Date.now();

        const item: KnowledgeItem = {
          type: i % 3 === 0 ? 'pattern' : i % 3 === 1 ? 'convention' : 'anti-pattern',
          title: `Knowledge Item ${i}`,
          content: `This is the content for knowledge item ${i}. It contains important information about patterns and best practices.`,
          tags: [`tag-${i % 10}`, `category-${i % 5}`],
          createdAt: new Date(),
        };

        contextManager.addKnowledgeItem(item);

        const latency = Date.now() - startTime;
        addLatencies.push(latency);
      }

      // Perform queries
      const queries = ['pattern', 'convention', 'best practices', 'tag-5', 'category-2'];

      for (let i = 0; i < 100; i++) {
        const query = queries[i % queries.length];
        const startTime = Date.now();
        const results = contextManager.queryKnowledgeBase(query);
        const latency = Date.now() - startTime;
        queryLatencies.push(latency);

        expect(results.length).toBeGreaterThan(0);
      }

      // Calculate statistics
      const addP99 = calculatePercentile(
        addLatencies.sort((a, b) => a - b),
        99
      );
      const queryP99 = calculatePercentile(
        queryLatencies.sort((a, b) => a - b),
        99
      );

      console.log('\n=== Knowledge Base Performance ===');
      console.log(`Knowledge items: ${itemCount}`);
      console.log(`Add p99 latency: ${addP99.toFixed(2)}ms`);
      console.log(`Query p99 latency: ${queryP99.toFixed(2)}ms`);

      // Should handle large knowledge base
      expect(addP99).toBeLessThan(50);
      expect(queryP99).toBeLessThan(100);
    });

    it('should handle complex queries efficiently', async () => {
      // Add diverse knowledge items
      for (let i = 0; i < 200; i++) {
        const item: KnowledgeItem = {
          type: 'pattern',
          title: `Design Pattern ${i}`,
          content: `This pattern demonstrates ${i % 2 === 0 ? 'synchronous' : 'asynchronous'} processing with ${i % 3 === 0 ? 'caching' : 'direct access'} strategy.`,
          tags: [
            i % 2 === 0 ? 'sync' : 'async',
            i % 3 === 0 ? 'cache' : 'direct',
            `performance-${i % 5}`,
          ],
          createdAt: new Date(),
        };

        contextManager.addKnowledgeItem(item);
      }

      // Perform complex queries
      const complexQueries = [
        'synchronous caching',
        'asynchronous direct',
        'performance pattern',
        'cache strategy',
      ];

      const queryLatencies: number[] = [];

      for (const query of complexQueries) {
        for (let i = 0; i < 25; i++) {
          const startTime = Date.now();
          const results = contextManager.queryKnowledgeBase(query);
          const latency = Date.now() - startTime;
          queryLatencies.push(latency);

          expect(results.length).toBeGreaterThan(0);
        }
      }

      const p99 = calculatePercentile(
        queryLatencies.sort((a, b) => a - b),
        99
      );

      console.log('\n=== Complex Query Performance ===');
      console.log(`Queries: ${queryLatencies.length}`);
      console.log(`p99 latency: ${p99.toFixed(2)}ms`);

      // Complex queries should still be fast
      expect(p99).toBeLessThan(150);
    });
  });

  describe('State Change Notifications', () => {
    it('should handle many listeners efficiently', async () => {
      const listenerCount = 100;
      const updateCount = 100;
      const notificationCounts: number[] = new Array(listenerCount).fill(0);

      // Register many listeners
      for (let i = 0; i < listenerCount; i++) {
        const index = i;
        contextManager.onStateChange(() => {
          notificationCounts[index]++;
        });
      }

      // Perform updates
      const startTime = Date.now();

      for (let i = 0; i < updateCount; i++) {
        contextManager.updateProjectState({
          currentPhase: `phase-${i}`,
        });
      }

      const duration = Date.now() - startTime;
      const avgLatency = duration / updateCount;

      console.log('\n=== State Change Notification Performance ===');
      console.log(`Listeners: ${listenerCount}`);
      console.log(`Updates: ${updateCount}`);
      console.log(`Total duration: ${duration}ms`);
      console.log(`Average latency per update: ${avgLatency.toFixed(2)}ms`);

      // All listeners should be notified
      notificationCounts.forEach((count) => {
        expect(count).toBe(updateCount);
      });

      // Should handle many listeners efficiently
      expect(avgLatency).toBeLessThan(10);
    });
  });

  describe('System Stability', () => {
    it('should maintain performance under sustained load', async () => {
      const rounds = 10;
      const operationsPerRound = 100;
      const roundLatencies: number[] = [];

      for (let round = 0; round < rounds; round++) {
        const startTime = Date.now();

        // Mixed operations
        for (let i = 0; i < operationsPerRound; i++) {
          // Create work item
          contextManager.createWorkItem({
            id: `task-${round}-${i}`,
            title: `Feature ${i}`,
            assignedTo: `agent-${i % 5}`,
            status: 'pending',
            dependencies: [],
            artifacts: [],
            timeSpent: 0,
          });

          // Acquire lock
          await contextManager.acquireFileLock(`agent-${i % 5}`, `file-${i}.ts`, 'write');

          // Query state
          contextManager.getProjectState();

          // Release lock
          contextManager.releaseFileLock(`agent-${i % 5}`, `file-${i}.ts`);
        }

        const roundLatency = Date.now() - startTime;
        roundLatencies.push(roundLatency);

        console.log(`Round ${round + 1}: ${roundLatency}ms`);
      }

      // Calculate statistics
      const avgLatency = roundLatencies.reduce((a, b) => a + b, 0) / roundLatencies.length;
      const firstRound = roundLatencies[0];
      const lastRound = roundLatencies[roundLatencies.length - 1];
      const degradation = ((lastRound - firstRound) / firstRound) * 100;

      console.log('\n=== Sustained Load Performance ===');
      console.log(`Rounds: ${rounds}`);
      console.log(`Operations per round: ${operationsPerRound}`);
      console.log(`Average round latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`First round: ${firstRound}ms`);
      console.log(`Last round: ${lastRound}ms`);
      console.log(`Performance degradation: ${degradation.toFixed(2)}%`);

      // Performance should not degrade significantly
      expect(Math.abs(degradation)).toBeLessThan(50); // < 50% degradation
    }, 30000);
  });
});
