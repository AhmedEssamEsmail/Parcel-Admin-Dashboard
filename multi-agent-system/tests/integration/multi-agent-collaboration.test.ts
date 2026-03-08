/**
 * Integration Test: Multi-Agent Collaboration
 * Task 16.2: Test complex multi-agent workflows
 *
 * Tests:
 * - Tech Lead assigns tasks to multiple agents
 * - Agents communicate via message bus
 * - Hierarchical delegation works correctly
 * - Work completes successfully with proper coordination
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentRegistry } from '@/multi-agent-system/lib/agent-registry';
import { MessageBus } from '@/multi-agent-system/lib/message-bus';
import { SharedContextManager } from '@/multi-agent-system/lib/shared-context';
import { AgentRole } from '@/multi-agent-system/lib/agent-definition-schema';
import type { AgentMessage } from '@/multi-agent-system/lib/types';

describe('Multi-Agent Collaboration Integration Tests', () => {
  let registry: AgentRegistry;
  let messageBus: MessageBus;
  let sharedContext: SharedContextManager;

  beforeEach(async () => {
    // Initialize all systems
    registry = new AgentRegistry();
    await registry.initialize();

    // Use fast retries for tests (10ms instead of 1000ms)
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
    sharedContext = new SharedContextManager();
  });

  afterEach(() => {
    registry.clear();
    messageBus.clear();
    sharedContext.clear();
  });

  it('should coordinate feature development across multiple agents', async () => {
    // Arrange: Register agents
    const techLeadId = 'tech-lead-1';
    const dev1Id = 'developer-1';
    const qaId = 'qa-engineer-1';

    registry.registerAgent({
      id: techLeadId,
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: ['assign-tasks'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    registry.registerAgent({
      id: dev1Id,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    registry.registerAgent({
      id: qaId,
      role: AgentRole.QA_ENGINEER,
      status: 'idle',
      capabilities: ['write-tests'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    // Track messages
    const messages: AgentMessage[] = [];
    messageBus.subscribe(dev1Id, async (msg) => {
      messages.push(msg);
    });

    // Act: Tech Lead sends task to developer
    await messageBus.send({
      id: 'task-1',
      from: techLeadId,
      to: dev1Id,
      type: 'request',
      priority: 'high',
      payload: {
        action: 'implement-feature',
        context: { feature: 'auth' },
      },
      timestamp: new Date(),
      acknowledged: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(messages.length).toBe(1);
    expect(messages[0].from).toBe(techLeadId);
    expect(messages[0].payload.action).toBe('implement-feature');
  });

  it('should handle hierarchical delegation correctly', async () => {
    // Arrange
    const techLeadId = 'tech-lead-1';
    const developerId = 'developer-1';

    registry.registerAgent({
      id: techLeadId,
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: ['assign-tasks'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    registry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    // Track escalations
    const escalations: AgentMessage[] = [];
    messageBus.subscribe(techLeadId, async (msg) => {
      if (msg.type === 'escalation') {
        escalations.push(msg);
      }
    });

    // Act: Developer escalates to tech lead
    await messageBus.send({
      id: 'escalation-1',
      from: developerId,
      to: techLeadId,
      type: 'escalation',
      priority: 'high',
      payload: {
        action: 'escalation',
        context: { issue: 'Blocked on schema' },
      },
      timestamp: new Date(),
      acknowledged: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(escalations.length).toBe(1);
    expect(escalations[0].from).toBe(developerId);
  });

  it('should enable shared context access across agents', async () => {
    // Arrange: Create work item
    const workItemId = 'work-1';
    sharedContext.createWorkItem({
      id: workItemId,
      title: 'Feature X',
      assignedTo: 'developer-1',
      status: 'in-progress',
      artifacts: [],
      dependencies: [],
      timeSpent: 0,
    });

    // Act: Update through valid state transitions
    sharedContext.updateWorkItem(workItemId, { status: 'review' });
    sharedContext.updateWorkItem(workItemId, {
      status: 'complete',
      artifacts: [
        { type: 'file', data: 'file1.ts' },
        { type: 'file', data: 'file2.ts' },
      ],
    });

    // Assert
    const updated = sharedContext.getWorkItem(workItemId);
    expect(updated?.status).toBe('complete');
    expect(updated?.artifacts).toHaveLength(2);
  });

  it('should route messages through message bus correctly', async () => {
    // Arrange
    const senderId = 'developer-1';
    const receiverId = 'qa-engineer-1';

    registry.registerAgent({
      id: senderId,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    registry.registerAgent({
      id: receiverId,
      role: AgentRole.QA_ENGINEER,
      status: 'idle',
      capabilities: ['write-tests'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    const received: AgentMessage[] = [];
    messageBus.subscribe(receiverId, async (msg) => {
      received.push(msg);
    });

    // Act
    await messageBus.send({
      id: 'msg-1',
      from: senderId,
      to: receiverId,
      type: 'request',
      priority: 'normal',
      payload: {
        action: 'review-code',
        context: { files: ['auth.ts'] },
      },
      timestamp: new Date(),
      acknowledged: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(received.length).toBe(1);
    expect(received[0].from).toBe(senderId);
    expect(received[0].payload.action).toBe('review-code');
  });

  it('should coordinate agents with different capabilities', async () => {
    // Arrange
    registry.registerAgent({
      id: 'dev-1',
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code', 'database'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    registry.registerAgent({
      id: 'dev-2',
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    // Act
    const dbDev = registry
      .getAgentsByRole(AgentRole.DEVELOPER)
      .find((a) => a.capabilities.includes('database'));

    // Assert
    expect(dbDev).toBeDefined();
    expect(dbDev?.id).toBe('dev-1');
  });

  it('should support multi-agent workflows', async () => {
    // Arrange: Register 3 agents
    const agents = ['dev-1', 'dev-2', 'qa-1'];
    agents.forEach((id, index) => {
      registry.registerAgent({
        id,
        role: index < 2 ? AgentRole.DEVELOPER : AgentRole.QA_ENGINEER,
        status: 'idle',
        capabilities: index < 2 ? ['write-code'] : ['write-tests'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });
    });

    // Act: Verify all agents registered
    const allAgents = registry.getAllAgents();

    // Assert
    expect(allAgents.length).toBe(3);
    expect(registry.getAgentsByRole(AgentRole.DEVELOPER).length).toBe(2);
    expect(registry.getAgentsByRole(AgentRole.QA_ENGINEER).length).toBe(1);
  });
});
