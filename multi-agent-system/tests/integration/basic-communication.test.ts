import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageBus } from '@/multi-agent-system/lib/message-bus';
import { AgentRegistry } from '@/multi-agent-system/lib/agent-registry';
import { AgentRole } from '@/multi-agent-system/lib/agent-definition-schema';
import type { AgentMessage } from '@/multi-agent-system/lib/types';

describe('Integration: Basic Agent Communication', () => {
  let messageBus: MessageBus;
  let registry: AgentRegistry;

  beforeEach(async () => {
    messageBus = new MessageBus();
    registry = new AgentRegistry();
    await registry.initialize();
  });

  afterEach(() => {
    messageBus.clear();
    registry.clear();
  });

  it('should send and receive messages between two agents', async () => {
    const agent1Id = 'agent-1';
    const agent2Id = 'agent-2';

    registry.registerAgent({
      id: agent1Id,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    registry.registerAgent({
      id: agent2Id,
      role: AgentRole.QA_ENGINEER,
      status: 'idle',
      capabilities: ['write-tests'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    const agent2Messages: AgentMessage[] = [];
    messageBus.subscribe(agent2Id, async (msg) => {
      agent2Messages.push(msg);
    });

    const message: AgentMessage = {
      id: 'msg-1',
      from: agent1Id,
      to: agent2Id,
      type: 'request',
      payload: { action: 'write-tests' },
      timestamp: new Date(),
      priority: 'normal',
      acknowledged: false,
    };

    await messageBus.send(message);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(agent2Messages).toHaveLength(1);
    expect(agent2Messages[0].id).toBe('msg-1');
    expect(agent2Messages[0].from).toBe(agent1Id);
  });

  it('should maintain conversation threads', async () => {
    const agent1Id = 'agent-1';
    const agent2Id = 'agent-2';

    registry.registerAgent({
      id: agent1Id,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: [],
      canRequestHelpFrom: [],
      workload: 0,
    });

    registry.registerAgent({
      id: agent2Id,
      role: AgentRole.QA_ENGINEER,
      status: 'idle',
      capabilities: [],
      canRequestHelpFrom: [],
      workload: 0,
    });

    messageBus.subscribe(agent1Id, async () => {});
    messageBus.subscribe(agent2Id, async () => {});

    const threadId = 'test-thread';
    const msg1: AgentMessage = {
      id: 'msg-1',
      from: agent1Id,
      to: agent2Id,
      type: 'request',
      payload: {},
      timestamp: new Date(),
      priority: 'normal',
      acknowledged: false,
      threadId,
    };

    const msg2: AgentMessage = {
      id: 'msg-2',
      from: agent2Id,
      to: agent1Id,
      type: 'response',
      payload: {},
      timestamp: new Date(),
      priority: 'normal',
      acknowledged: false,
      threadId,
    };

    await messageBus.send(msg1);
    await messageBus.send(msg2);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const thread = messageBus.getThread(threadId);
    expect(thread).toHaveLength(2);
    expect(thread[0].id).toBe('msg-1');
    expect(thread[1].id).toBe('msg-2');
    expect(thread[1].threadId).toBe(threadId);
  });

  it('should handle priority message delivery', async () => {
    const senderId = 'sender';
    const receiverId = 'receiver';

    registry.registerAgent({
      id: senderId,
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: [],
      canRequestHelpFrom: [],
      workload: 0,
    });

    registry.registerAgent({
      id: receiverId,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: [],
      canRequestHelpFrom: [],
      workload: 0,
    });

    const receivedOrder: string[] = [];
    let processing = false;
    let resolveProcessing: (() => void) | null = null;

    // Handler that blocks to allow messages to queue
    messageBus.subscribe(receiverId, async (msg) => {
      if (!processing) {
        processing = true;
        // Block until we signal to continue
        await new Promise<void>((resolve) => {
          resolveProcessing = resolve;
        });
      }
      receivedOrder.push(msg.id);
    });

    // Send low priority message (starts processing but blocks)
    const send1 = messageBus.send({
      id: 'low-msg',
      from: senderId,
      to: receiverId,
      type: 'request',
      payload: {},
      timestamp: new Date(),
      priority: 'low',
      acknowledged: false,
    });

    // Wait for first message to start processing
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Send normal and critical while first is blocked
    const send2 = messageBus.send({
      id: 'normal-msg',
      from: senderId,
      to: receiverId,
      type: 'request',
      payload: {},
      timestamp: new Date(),
      priority: 'normal',
      acknowledged: false,
    });

    const send3 = messageBus.send({
      id: 'critical-msg',
      from: senderId,
      to: receiverId,
      type: 'request',
      payload: {},
      timestamp: new Date(),
      priority: 'critical',
      acknowledged: false,
    });

    // Wait for messages to be queued
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Unblock processing
    if (resolveProcessing) {
      resolveProcessing();
    }

    // Wait for all to complete
    await Promise.all([send1, send2, send3]);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify: low processed first (was already in handler)
    // Then critical (higher priority than normal in queue)
    // Then normal
    expect(receivedOrder).toHaveLength(3);
    expect(receivedOrder[0]).toBe('low-msg');
    expect(receivedOrder[1]).toBe('critical-msg');
    expect(receivedOrder[2]).toBe('normal-msg');
  });
});
