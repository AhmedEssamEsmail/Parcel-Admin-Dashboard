import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageBus } from './message-bus';
import { AgentRegistry } from './agent-registry';
import { SharedContextManager } from './shared-context';
import { WorkflowEngine } from './workflow-engine';
import { AgentRole } from './agent-definition-schema';
import {
  HelpRequestProtocol,
  EscalationProtocol,
  WorkCompletionProtocol,
  AutomaticNotificationSystem,
  CommunicationProtocolsManager,
} from './communication-protocols';
import type { AgentMessage } from './types';

describe('HelpRequestProtocol', () => {
  let messageBus: MessageBus;
  let agentRegistry: AgentRegistry;
  let helpRequest: HelpRequestProtocol;

  beforeEach(async () => {
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
    agentRegistry = new AgentRegistry();
    await agentRegistry.initialize();
    helpRequest = new HelpRequestProtocol(messageBus, agentRegistry);
  });

  afterEach(() => {
    messageBus.clear();
    agentRegistry.clear();
    helpRequest.clear();
  });

  it('should successfully send help request to authorized role', async () => {
    const developerId = 'dev-1';
    const techLeadId = 'tech-lead-1';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'busy',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    agentRegistry.registerAgent({
      id: techLeadId,
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: ['coordinate-team'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    const messages: AgentMessage[] = [];
    messageBus.subscribe(techLeadId, (msg) => {
      messages.push(msg);
    });

    const result = await helpRequest.requestHelp(
      developerId,
      AgentRole.TECH_LEAD,
      'Need help with database schema',
      {
        currentTask: 'task-123',
        attemptedSolutions: ['Tried using existing table'],
        relevantFiles: ['lib/db/schema.ts'],
      },
      'high'
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.success).toBe(true);
    expect(result.helperId).toBe(techLeadId);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('request');
    expect(messages[0].priority).toBe('high');
    expect(messages[0].payload.action).toBe('request-help');
  });

  it('should reject help request to unauthorized role', async () => {
    const developerId = 'dev-1';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'busy',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    agentRegistry.registerAgent({
      id: 'qa-1',
      role: AgentRole.QA_ENGINEER,
      status: 'idle',
      capabilities: ['write-tests'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    const result = await helpRequest.requestHelp(
      developerId,
      AgentRole.QA_ENGINEER,
      'Need help',
      {}
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot request help from');
  });

  it('should fail when no available helper exists', async () => {
    const developerId = 'dev-1';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'busy',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    const result = await helpRequest.requestHelp(developerId, AgentRole.TECH_LEAD, 'Need help', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('No available agent');
  });

  it('should acknowledge help request', async () => {
    const developerId = 'dev-1';
    const techLeadId = 'tech-lead-1';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'busy',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    agentRegistry.registerAgent({
      id: techLeadId,
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: ['coordinate-team'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    const messages: AgentMessage[] = [];
    let capturedRequestId = '';
    messageBus.subscribe(developerId, (msg) => {
      messages.push(msg);
    });
    messageBus.subscribe(techLeadId, (msg) => {
      capturedRequestId = msg.id;
    });

    const result = await helpRequest.requestHelp(developerId, AgentRole.TECH_LEAD, 'Need help', {});

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.success).toBe(true);
    expect(capturedRequestId).toBeTruthy();

    await helpRequest.acknowledgeHelpRequest(techLeadId, capturedRequestId, {
      canHelp: true,
      estimatedTime: 300,
      message: 'I can help with that',
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const ackMessages = messages.filter((m) => m.payload.action === 'help-acknowledgment');
    expect(ackMessages).toHaveLength(1);
    expect(ackMessages[0].type).toBe('response');
  });

  it('should track pending requests', async () => {
    const developerId = 'dev-1';
    const techLeadId = 'tech-lead-1';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'busy',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    agentRegistry.registerAgent({
      id: techLeadId,
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: ['coordinate-team'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    messageBus.subscribe(techLeadId, () => {});

    await helpRequest.requestHelp(developerId, AgentRole.TECH_LEAD, 'Need help', {});

    const pending = helpRequest.getPendingRequests(techLeadId);
    expect(pending).toHaveLength(1);
    expect(pending[0].requesterId).toBe(developerId);
    expect(pending[0].acknowledged).toBe(false);
  });
});

describe('EscalationProtocol', () => {
  let messageBus: MessageBus;
  let agentRegistry: AgentRegistry;
  let escalation: EscalationProtocol;

  beforeEach(async () => {
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
    agentRegistry = new AgentRegistry();
    await agentRegistry.initialize();
    escalation = new EscalationProtocol(messageBus, agentRegistry);
  });

  afterEach(() => {
    messageBus.clear();
    agentRegistry.clear();
    escalation.clear();
  });

  it('should escalate issue to tech lead', async () => {
    const developerId = 'dev-1';
    const techLeadId = 'tech-lead-1';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'blocked',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    agentRegistry.registerAgent({
      id: techLeadId,
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: ['coordinate-team'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    const messages: AgentMessage[] = [];
    messageBus.subscribe(techLeadId, (msg) => {
      messages.push(msg);
    });

    const result = await escalation.escalateToTechLead(
      developerId,
      'Cannot resolve merge conflict',
      {
        taskId: 'task-123',
        conflictingFiles: ['lib/auth/session.ts'],
        attemptedSolutions: ['Tried auto-merge', 'Attempted rebase'],
        blockedSince: new Date(),
        impactedTasks: ['task-124'],
      },
      'critical'
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.success).toBe(true);
    expect(result.techLeadId).toBe(techLeadId);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('escalation');
    expect(messages[0].priority).toBe('critical');
  });

  it('should fail when no tech lead available', async () => {
    const developerId = 'dev-1';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'blocked',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    const result = await escalation.escalateToTechLead(developerId, 'Issue', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('No available tech lead');
  });

  it('should escalate to parent after 5 minutes', async () => {
    const developerId = 'dev-1';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'blocked',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    const messages: AgentMessage[] = [];
    messageBus.subscribe('parent-agent', (msg) => {
      messages.push(msg);
    });

    const blockedSince = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago

    const result = await escalation.escalateToParent(developerId, 'Still blocked', {
      taskId: 'task-123',
      blockedSince,
      techLeadNotified: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.success).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('escalation');
    expect(messages[0].priority).toBe('critical');
    expect(messages[0].to).toBe('parent-agent');
  });

  it('should reject parent escalation before 5 minutes', async () => {
    const developerId = 'dev-1';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'blocked',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    const blockedSince = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

    const result = await escalation.escalateToParent(developerId, 'Blocked', {
      taskId: 'task-123',
      blockedSince,
      techLeadNotified: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('at least 5 minutes');
  });

  it('should resolve escalation', async () => {
    const developerId = 'dev-1';
    const techLeadId = 'tech-lead-1';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'blocked',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    agentRegistry.registerAgent({
      id: techLeadId,
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: ['coordinate-team'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    messageBus.subscribe(techLeadId, () => {});

    await escalation.escalateToTechLead(developerId, 'Issue', {});
    await new Promise((resolve) => setTimeout(resolve, 50));

    const escalations = escalation.getEscalations(developerId);
    expect(escalations).toHaveLength(1);
    expect(escalations[0].resolved).toBe(false);

    escalation.resolveEscalation(escalations[0].escalationId, 'Fixed by tech lead');

    const updatedEscalations = escalation.getEscalations(developerId);
    expect(updatedEscalations[0].resolved).toBe(true);
  });
});

describe('WorkCompletionProtocol', () => {
  let messageBus: MessageBus;
  let agentRegistry: AgentRegistry;
  let sharedContext: SharedContextManager;
  let workCompletion: WorkCompletionProtocol;

  beforeEach(async () => {
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
    agentRegistry = new AgentRegistry();
    await agentRegistry.initialize();
    sharedContext = new SharedContextManager();
    workCompletion = new WorkCompletionProtocol(messageBus, agentRegistry, sharedContext);
  });

  afterEach(() => {
    messageBus.clear();
    agentRegistry.clear();
    sharedContext.clear();
  });

  it('should notify work completion with artifacts and metrics', async () => {
    const developerId = 'dev-1';
    const techLeadId = 'tech-lead-1';
    const taskId = 'task-123';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'busy',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    agentRegistry.registerAgent({
      id: techLeadId,
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: ['coordinate-team'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    sharedContext.createWorkItem({
      id: taskId,
      title: 'Implement auth',
      assignedTo: developerId,
      status: 'review',
      dependencies: [],
      artifacts: [],
      timeSpent: 0,
    });

    const messages: AgentMessage[] = [];
    messageBus.subscribe(techLeadId, (msg) => {
      messages.push(msg);
    });

    const result = await workCompletion.notifyWorkComplete(
      developerId,
      taskId,
      [
        { type: 'file', data: 'app/api/auth/login/route.ts' },
        { type: 'file', data: 'tests/integration/api/auth.test.ts' },
      ],
      {
        timeSpent: 3600,
        linesAdded: 150,
        linesDeleted: 20,
        testsAdded: 5,
      },
      'Implemented JWT auth with refresh tokens'
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.success).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('notification');
    expect(messages[0].payload.action).toBe('work-complete');
    expect((messages[0].payload.context as { taskId?: string })?.taskId).toBe(taskId);

    const workItem = sharedContext.getWorkItem(taskId);
    expect(workItem?.status).toBe('complete');
    expect(workItem?.artifacts).toHaveLength(2);
    expect(workItem?.timeSpent).toBe(3600);

    const agent = agentRegistry.getAgent(developerId);
    expect(agent?.status).toBe('idle');
  });

  it('should fail when work item not found', async () => {
    const developerId = 'dev-1';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'busy',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    const result = await workCompletion.notifyWorkComplete(developerId, 'nonexistent-task', [], {
      timeSpent: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Work item');
  });

  it('should fail when no tech lead available', async () => {
    const developerId = 'dev-1';
    const taskId = 'task-123';

    agentRegistry.registerAgent({
      id: developerId,
      role: AgentRole.DEVELOPER,
      status: 'busy',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 1,
    });

    sharedContext.createWorkItem({
      id: taskId,
      title: 'Task',
      assignedTo: developerId,
      status: 'review',
      dependencies: [],
      artifacts: [],
      timeSpent: 0,
    });

    const result = await workCompletion.notifyWorkComplete(developerId, taskId, [], {
      timeSpent: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No available tech lead');
  });
});

describe('AutomaticNotificationSystem', () => {
  let messageBus: MessageBus;
  let agentRegistry: AgentRegistry;
  let workflowEngine: WorkflowEngine;
  let notifications: AutomaticNotificationSystem;

  beforeEach(async () => {
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
    agentRegistry = new AgentRegistry();
    await agentRegistry.initialize();
    workflowEngine = new WorkflowEngine(messageBus, agentRegistry);
    notifications = new AutomaticNotificationSystem(messageBus, agentRegistry, workflowEngine);
  });

  afterEach(() => {
    messageBus.clear();
    agentRegistry.clear();
    workflowEngine.clearRules();
    workflowEngine.clearTasks();
  });

  it('should notify specific role', async () => {
    const dataArchitectId = 'data-architect-1';

    agentRegistry.registerAgent({
      id: dataArchitectId,
      role: AgentRole.DATA_ARCHITECT,
      status: 'idle',
      capabilities: ['design-schema'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    const messages: AgentMessage[] = [];
    messageBus.subscribe(dataArchitectId, (msg) => {
      messages.push(msg);
    });

    const result = await notifications.notifyRole(
      AgentRole.DATA_ARCHITECT,
      'schema-change-needed',
      { table: 'users', reason: 'Add new column' },
      'high'
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.success).toBe(true);
    expect(result.notifiedAgents).toContain(dataArchitectId);
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('notification');
    expect(messages[0].priority).toBe('high');
  });

  it('should fail when no agents with role available', async () => {
    const result = await notifications.notifyRole(
      AgentRole.DATA_ARCHITECT,
      'schema-change-needed',
      {}
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No available agents');
  });

  it('should broadcast to all agents', async () => {
    const dev1 = 'dev-1';
    const qa1 = 'qa-1';

    agentRegistry.registerAgent({
      id: dev1,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    agentRegistry.registerAgent({
      id: qa1,
      role: AgentRole.QA_ENGINEER,
      status: 'idle',
      capabilities: ['write-tests'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    const devMessages: AgentMessage[] = [];
    const qaMessages: AgentMessage[] = [];

    messageBus.subscribe(dev1, (msg) => {
      devMessages.push(msg);
    });
    messageBus.subscribe(qa1, (msg) => {
      qaMessages.push(msg);
    });

    const result = await notifications.broadcast(
      'system-maintenance',
      { message: 'System will be down for maintenance' },
      'critical'
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.success).toBe(true);
    expect(result.notifiedAgents).toHaveLength(2);
    expect(devMessages).toHaveLength(1);
    expect(qaMessages).toHaveLength(1);
  });

  it('should skip offline agents in broadcast', async () => {
    const dev1 = 'dev-1';
    const dev2 = 'dev-2';

    agentRegistry.registerAgent({
      id: dev1,
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    agentRegistry.registerAgent({
      id: dev2,
      role: AgentRole.DEVELOPER,
      status: 'offline',
      capabilities: ['write-code'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    messageBus.subscribe(dev1, () => {});

    const result = await notifications.broadcast('test-event', {});

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.success).toBe(true);
    expect(result.notifiedAgents).toHaveLength(1);
    expect(result.notifiedAgents).toContain(dev1);
    expect(result.notifiedAgents).not.toContain(dev2);
  });
});

describe('CommunicationProtocolsManager', () => {
  let manager: CommunicationProtocolsManager;
  let messageBus: MessageBus;
  let agentRegistry: AgentRegistry;
  let sharedContext: SharedContextManager;
  let workflowEngine: WorkflowEngine;

  beforeEach(async () => {
    messageBus = new MessageBus({ maxRetries: 3, baseRetryDelay: 10 });
    agentRegistry = new AgentRegistry();
    await agentRegistry.initialize();
    sharedContext = new SharedContextManager();
    workflowEngine = new WorkflowEngine(messageBus, agentRegistry);
    manager = new CommunicationProtocolsManager(
      messageBus,
      agentRegistry,
      sharedContext,
      workflowEngine
    );
  });

  afterEach(() => {
    messageBus.clear();
    agentRegistry.clear();
    sharedContext.clear();
    workflowEngine.clearRules();
    workflowEngine.clearTasks();
    manager.clear();
  });

  it('should provide access to all protocols', () => {
    expect(manager.helpRequest).toBeInstanceOf(HelpRequestProtocol);
    expect(manager.escalation).toBeInstanceOf(EscalationProtocol);
    expect(manager.workCompletion).toBeInstanceOf(WorkCompletionProtocol);
    expect(manager.notifications).toBeInstanceOf(AutomaticNotificationSystem);
  });

  it('should clear all protocol state', () => {
    manager.clear();
    // If clear works, no errors should be thrown
    expect(true).toBe(true);
  });
});
