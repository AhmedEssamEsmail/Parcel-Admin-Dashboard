import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConflictResolver } from './conflict-resolver';
import { SharedContextManager } from './shared-context';
import { MessageBus } from './message-bus';
import { AgentRegistry } from './agent-registry';
import { AgentRole } from './agent-definition-schema';
import type {
  Conflict,
  FileAccessRequest,
  AgentWaitState,
  FileConflictDetails,
  DeadlockDetails,
} from './conflict-types';
import type { Decision } from './shared-context-types';

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;
  let sharedContext: SharedContextManager;
  let messageBus: MessageBus;
  let agentRegistry: AgentRegistry;

  beforeEach(async () => {
    sharedContext = new SharedContextManager();
    messageBus = new MessageBus();
    agentRegistry = new AgentRegistry();

    // Initialize registry
    await agentRegistry.initialize();

    // Register test agents
    agentRegistry.registerAgent({
      id: 'agent1',
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    agentRegistry.registerAgent({
      id: 'agent2',
      role: AgentRole.DEVELOPER,
      status: 'idle',
      capabilities: ['write-code'],
      canRequestHelpFrom: [AgentRole.TECH_LEAD],
      workload: 0,
    });

    agentRegistry.registerAgent({
      id: 'tech-lead',
      role: AgentRole.TECH_LEAD,
      status: 'idle',
      capabilities: ['coordinate', 'assign-tasks'],
      canRequestHelpFrom: [],
      workload: 0,
    });

    resolver = new ConflictResolver(sharedContext, messageBus, agentRegistry);

    vi.useFakeTimers();
  });

  afterEach(() => {
    resolver.stop();
    resolver.clear();
    sharedContext.clear();
    messageBus.clear();
    agentRegistry.clear();
    vi.useRealTimers();
  });

  // ============================================================================
  // File Conflict Detection Tests (Task 9.2)
  // ============================================================================

  describe('File Conflict Detection', () => {
    it('should detect conflict when two agents request write lock on same file', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      const conflict1 = await resolver.registerFileAccess(request1);
      expect(conflict1).toBeNull();

      const conflict2 = await resolver.registerFileAccess(request2);
      expect(conflict2).not.toBeNull();
      expect(conflict2?.type).toBe('file');
      expect(conflict2?.involvedAgents).toContain('agent1');
      expect(conflict2?.involvedAgents).toContain('agent2');
    });

    it('should not detect conflict for read locks', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'read',
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'read',
        timestamp: new Date(),
      };

      const conflict1 = await resolver.registerFileAccess(request1);
      const conflict2 = await resolver.registerFileAccess(request2);

      expect(conflict1).toBeNull();
      expect(conflict2).toBeNull();
    });

    it('should detect conflict when write lock conflicts with read lock', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'read',
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      const conflict = await resolver.registerFileAccess(request2);

      expect(conflict).not.toBeNull();
      expect(conflict?.type).toBe('file');
    });

    it('should detect overlapping line ranges', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 10, end: 20 },
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 15, end: 25 },
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      const conflict = await resolver.registerFileAccess(request2);

      expect(conflict).not.toBeNull();
      const details = conflict?.details as FileConflictDetails;
      expect(details.overlapping).toBe(true);
      expect(conflict?.severity).toBe('high');
    });

    it('should not detect conflict for non-overlapping line ranges', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 10, end: 20 },
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 30, end: 40 },
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      const conflict = await resolver.registerFileAccess(request2);

      expect(conflict).not.toBeNull();
      const details = conflict?.details as FileConflictDetails;
      expect(details.overlapping).toBe(false);
      expect(conflict?.severity).toBe('medium');
    });

    it('should remove file access when agent releases lock', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      resolver.removeFileAccess('agent1', 'file.ts');

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      const conflict = await resolver.registerFileAccess(request2);
      expect(conflict).toBeNull();
    });

    it('should not detect conflict for same agent', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      const conflict = await resolver.registerFileAccess(request2);

      expect(conflict).toBeNull();
    });
  });

  // ============================================================================
  // Automatic Conflict Resolution Tests (Task 9.3)
  // ============================================================================

  describe('Automatic Conflict Resolution', () => {
    it('should auto-resolve non-overlapping file conflicts', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 10, end: 20 },
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 30, end: 40 },
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      const conflict = await resolver.registerFileAccess(request2);

      expect(conflict).not.toBeNull();
      expect(resolver.canAutoResolve(conflict!)).toBe(true);

      const resolution = await resolver.resolveConflict(conflict!);
      expect(resolution.strategy).toBe('auto-merge');
      expect(resolution.outcome).toContain('auto-merged');
    });

    it('should escalate overlapping file conflicts', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 10, end: 20 },
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 15, end: 25 },
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      const conflict = await resolver.registerFileAccess(request2);

      expect(conflict).not.toBeNull();
      expect(resolver.canAutoResolve(conflict!)).toBe(false);

      const resolution = await resolver.resolveConflict(conflict!);
      expect(resolution.strategy).toBe('escalate');
      expect(resolution.resolvedBy).toBe('tech-lead');
    });

    it('should send escalation message to tech lead', async () => {
      const sendSpy = vi.spyOn(messageBus, 'send');

      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 10, end: 20 },
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 15, end: 25 },
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      const conflict = await resolver.registerFileAccess(request2);

      await resolver.resolveConflict(conflict!);

      expect(sendSpy).toHaveBeenCalled();
      const message = sendSpy.mock.calls[sendSpy.mock.calls.length - 1][0];
      expect(message.to).toBe('tech-lead');
      expect(message.type).toBe('escalation');
    });

    it('should notify agents of conflict detection', async () => {
      const sendSpy = vi.spyOn(messageBus, 'send');

      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      await resolver.registerFileAccess(request2);

      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy.mock.calls[0][0].payload.action).toBe('conflict-detected');
      expect(sendSpy.mock.calls[1][0].payload.action).toBe('conflict-detected');
    });

    it('should notify agents of conflict resolution', async () => {
      const sendSpy = vi.spyOn(messageBus, 'send');

      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 10, end: 20 },
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 30, end: 40 },
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      const conflict = await resolver.registerFileAccess(request2);

      sendSpy.mockClear();
      await resolver.resolveConflict(conflict!);

      // Should notify both agents of resolution
      const resolutionMessages = sendSpy.mock.calls.filter(
        (call) => call[0].payload.action === 'conflict-resolved'
      );
      expect(resolutionMessages.length).toBe(2);
    });
  });

  // ============================================================================
  // Architectural Conflict Detection Tests (Task 9.4)
  // ============================================================================

  describe('Architectural Conflict Detection', () => {
    it('should detect contradictory architectural decisions', async () => {
      const decision1: Decision = {
        id: 'dec-1',
        title: 'Database Choice',
        context: 'Need database for user data storage',
        options: ['PostgreSQL', 'MongoDB'],
        chosen: 'PostgreSQL',
        rationale: 'Need ACID compliance',
        madeBy: 'agent1',
        madeAt: new Date(),
        tags: ['database', 'architecture'],
      };

      const decision2: Decision = {
        id: 'dec-2',
        title: 'Database Selection',
        context: 'Need database for user data management',
        options: ['PostgreSQL', 'MongoDB'],
        chosen: 'MongoDB',
        rationale: 'Need flexibility',
        madeBy: 'agent2',
        madeAt: new Date(),
        tags: ['database', 'architecture'],
      };

      sharedContext.addDecision(decision1);
      sharedContext.addDecision(decision2);

      const conflicts = await resolver.detectArchitecturalConflicts();

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].type).toBe('architectural');
      expect(conflicts[0].severity).toBe('high');
    });

    it('should not detect conflict for unrelated decisions', async () => {
      const decision1: Decision = {
        id: 'dec-1',
        title: 'Database Choice',
        context: 'Need database for user data',
        options: ['PostgreSQL', 'MongoDB'],
        chosen: 'PostgreSQL',
        rationale: 'Need ACID',
        madeBy: 'agent1',
        madeAt: new Date(),
        tags: ['database'],
      };

      const decision2: Decision = {
        id: 'dec-2',
        title: 'UI Framework',
        context: 'Need UI framework for frontend',
        options: ['React', 'Vue'],
        chosen: 'React',
        rationale: 'Team expertise',
        madeBy: 'agent2',
        madeAt: new Date(),
        tags: ['frontend'],
      };

      sharedContext.addDecision(decision1);
      sharedContext.addDecision(decision2);

      const conflicts = await resolver.detectArchitecturalConflicts();

      expect(conflicts.length).toBe(0);
    });

    it('should not detect conflict for same choice', async () => {
      const decision1: Decision = {
        id: 'dec-1',
        title: 'Database Choice',
        context: 'Need database for user data',
        options: ['PostgreSQL', 'MongoDB'],
        chosen: 'PostgreSQL',
        rationale: 'Need ACID',
        madeBy: 'agent1',
        madeAt: new Date(),
        tags: ['database'],
      };

      const decision2: Decision = {
        id: 'dec-2',
        title: 'Database Selection',
        context: 'Need database for user information',
        options: ['PostgreSQL', 'MongoDB'],
        chosen: 'PostgreSQL',
        rationale: 'Consistency',
        madeBy: 'agent2',
        madeAt: new Date(),
        tags: ['database'],
      };

      sharedContext.addDecision(decision1);
      sharedContext.addDecision(decision2);

      const conflicts = await resolver.detectArchitecturalConflicts();

      expect(conflicts.length).toBe(0);
    });

    it('should always escalate architectural conflicts', async () => {
      const decision1: Decision = {
        id: 'dec-1',
        title: 'Database Choice',
        context: 'Need database for user data',
        options: ['PostgreSQL', 'MongoDB'],
        chosen: 'PostgreSQL',
        rationale: 'Need ACID',
        madeBy: 'agent1',
        madeAt: new Date(),
        tags: ['database'],
      };

      const decision2: Decision = {
        id: 'dec-2',
        title: 'Database Selection',
        context: 'Need database for user information',
        options: ['PostgreSQL', 'MongoDB'],
        chosen: 'MongoDB',
        rationale: 'Flexibility',
        madeBy: 'agent2',
        madeAt: new Date(),
        tags: ['database'],
      };

      sharedContext.addDecision(decision1);
      sharedContext.addDecision(decision2);

      const conflicts = await resolver.detectArchitecturalConflicts();
      expect(conflicts.length).toBeGreaterThan(0);

      const canAutoResolve = resolver.canAutoResolve(conflicts[0]);
      expect(canAutoResolve).toBe(false);
    });
  });

  // ============================================================================
  // Deadlock Detection Tests (Task 9.5)
  // ============================================================================

  describe('Deadlock Detection', () => {
    it('should detect simple circular wait (A -> B -> A)', async () => {
      const waitState1: AgentWaitState = {
        agentId: 'agent1',
        waitingFor: 'agent2',
        reason: 'Waiting for file lock',
        since: new Date(),
        heldResources: ['file1.ts'],
      };

      const waitState2: AgentWaitState = {
        agentId: 'agent2',
        waitingFor: 'agent1',
        reason: 'Waiting for file lock',
        since: new Date(),
        heldResources: ['file2.ts'],
      };

      resolver.registerWaitState(waitState1);
      resolver.registerWaitState(waitState2);

      const conflicts = await resolver.detectDeadlocks();

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].type).toBe('deadlock');
      expect(conflicts[0].severity).toBe('critical');

      const details = conflicts[0].details as DeadlockDetails;
      expect(details.cycle.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect complex circular wait (A -> B -> C -> A)', async () => {
      agentRegistry.registerAgent({
        id: 'agent3',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      const waitState1: AgentWaitState = {
        agentId: 'agent1',
        waitingFor: 'agent2',
        reason: 'Waiting for file lock',
        since: new Date(),
        heldResources: ['file1.ts'],
      };

      const waitState2: AgentWaitState = {
        agentId: 'agent2',
        waitingFor: 'agent3',
        reason: 'Waiting for file lock',
        since: new Date(),
        heldResources: ['file2.ts'],
      };

      const waitState3: AgentWaitState = {
        agentId: 'agent3',
        waitingFor: 'agent1',
        reason: 'Waiting for file lock',
        since: new Date(),
        heldResources: ['file3.ts'],
      };

      resolver.registerWaitState(waitState1);
      resolver.registerWaitState(waitState2);
      resolver.registerWaitState(waitState3);

      const conflicts = await resolver.detectDeadlocks();

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].type).toBe('deadlock');

      const details = conflicts[0].details as DeadlockDetails;
      expect(details.cycle.length).toBe(3);
    });

    it('should not detect deadlock for linear wait chain', async () => {
      agentRegistry.registerAgent({
        id: 'agent3',
        role: AgentRole.DEVELOPER,
        status: 'idle',
        capabilities: ['write-code'],
        canRequestHelpFrom: [AgentRole.TECH_LEAD],
        workload: 0,
      });

      const waitState1: AgentWaitState = {
        agentId: 'agent1',
        waitingFor: 'agent2',
        reason: 'Waiting for file lock',
        since: new Date(),
        heldResources: ['file1.ts'],
      };

      const waitState2: AgentWaitState = {
        agentId: 'agent2',
        waitingFor: 'agent3',
        reason: 'Waiting for file lock',
        since: new Date(),
        heldResources: ['file2.ts'],
      };

      resolver.registerWaitState(waitState1);
      resolver.registerWaitState(waitState2);

      const conflicts = await resolver.detectDeadlocks();

      expect(conflicts.length).toBe(0);
    });

    it('should automatically break deadlock', async () => {
      const releaseSpy = vi.spyOn(sharedContext, 'releaseFileLock');
      const sendSpy = vi.spyOn(messageBus, 'send');

      const waitState1: AgentWaitState = {
        agentId: 'agent1',
        waitingFor: 'agent2',
        reason: 'Waiting for file lock',
        since: new Date(),
        heldResources: ['file1.ts'],
      };

      const waitState2: AgentWaitState = {
        agentId: 'agent2',
        waitingFor: 'agent1',
        reason: 'Waiting for file lock',
        since: new Date(),
        heldResources: ['file2.ts'],
      };

      resolver.registerWaitState(waitState1);
      resolver.registerWaitState(waitState2);

      await resolver.detectDeadlocks();

      // Should release locks
      expect(releaseSpy).toHaveBeenCalled();

      // Should notify victim agent
      const notifyMessages = sendSpy.mock.calls.filter(
        (call) => call[0].payload.action === 'deadlock-broken'
      );
      expect(notifyMessages.length).toBeGreaterThan(0);
    });

    it('should clear wait state', () => {
      const waitState: AgentWaitState = {
        agentId: 'agent1',
        waitingFor: 'agent2',
        reason: 'Waiting',
        since: new Date(),
        heldResources: [],
      };

      resolver.registerWaitState(waitState);
      resolver.clearWaitState('agent1');

      // Should not detect deadlock after clearing
      const conflicts = resolver.getConflictsByAgent('agent1');
      expect(conflicts.length).toBe(0);
    });

    it('should run deadlock detection periodically', async () => {
      resolver.start();

      const detectSpy = vi.spyOn(resolver, 'detectDeadlocks');

      // Advance time by 30 seconds
      await vi.advanceTimersByTimeAsync(30000);

      expect(detectSpy).toHaveBeenCalled();

      resolver.stop();
    });
  });

  // ============================================================================
  // Query and Retrieval Tests
  // ============================================================================

  describe('Query and Retrieval', () => {
    it('should get all active conflicts', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file1.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file1.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      const request3: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file2.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      const request4: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file2.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      await resolver.registerFileAccess(request2);
      await resolver.registerFileAccess(request3);
      await resolver.registerFileAccess(request4);

      const conflicts = resolver.getActiveConflicts();
      expect(conflicts.length).toBe(2);
    });

    it('should get conflicts by type', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      await resolver.registerFileAccess(request2);

      const fileConflicts = resolver.getConflictsByType('file');
      expect(fileConflicts.length).toBe(1);
      expect(fileConflicts[0].type).toBe('file');
    });

    it('should get conflicts by agent', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file1.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file1.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      await resolver.registerFileAccess(request2);

      const agent1Conflicts = resolver.getConflictsByAgent('agent1');
      expect(agent1Conflicts.length).toBe(1);
      expect(agent1Conflicts[0].involvedAgents).toContain('agent1');
    });

    it('should get resolution for conflict', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 10, end: 20 },
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 30, end: 40 },
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      const conflict = await resolver.registerFileAccess(request2);

      const resolution = await resolver.resolveConflict(conflict!);

      const retrieved = resolver.getResolution(conflict!.id);
      expect(retrieved).toEqual(resolution);
    });

    it('should get all resolutions', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file1.ts',
        lockType: 'write',
        lineRange: { start: 10, end: 20 },
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file1.ts',
        lockType: 'write',
        lineRange: { start: 30, end: 40 },
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      const conflict1 = await resolver.registerFileAccess(request2);
      await resolver.resolveConflict(conflict1!);

      const resolutions = resolver.getAllResolutions();
      expect(resolutions.length).toBe(1);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should handle complete conflict lifecycle', async () => {
      // 1. Register file access
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 10, end: 20 },
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        lineRange: { start: 30, end: 40 },
        timestamp: new Date(),
      };

      // 2. Detect conflict
      await resolver.registerFileAccess(request1);
      const conflict = await resolver.registerFileAccess(request2);

      expect(conflict).not.toBeNull();

      // 3. Resolve conflict
      const resolution = await resolver.resolveConflict(conflict!);

      expect(resolution.strategy).toBe('auto-merge');

      // 4. Verify conflict is resolved
      const activeConflicts = resolver.getActiveConflicts();
      expect(activeConflicts.find((c) => c.id === conflict!.id)).toBeUndefined();

      // 5. Verify resolution is recorded
      const storedResolution = resolver.getResolution(conflict!.id);
      expect(storedResolution).toEqual(resolution);
    });

    it('should handle multiple concurrent conflicts', async () => {
      const requests: FileAccessRequest[] = [
        {
          agentId: 'agent1',
          filePath: 'file1.ts',
          lockType: 'write',
          lineRange: { start: 10, end: 20 },
          timestamp: new Date(),
        },
        {
          agentId: 'agent2',
          filePath: 'file1.ts',
          lockType: 'write',
          lineRange: { start: 30, end: 40 },
          timestamp: new Date(),
        },
        {
          agentId: 'agent1',
          filePath: 'file2.ts',
          lockType: 'write',
          lineRange: { start: 10, end: 20 },
          timestamp: new Date(),
        },
        {
          agentId: 'agent2',
          filePath: 'file2.ts',
          lockType: 'write',
          lineRange: { start: 30, end: 40 },
          timestamp: new Date(),
        },
      ];

      for (const request of requests) {
        await resolver.registerFileAccess(request);
      }

      const conflicts = resolver.getActiveConflicts();
      expect(conflicts.length).toBe(2);

      // Resolve all conflicts (make a copy since resolveConflict modifies the map)
      const conflictsToResolve = [...conflicts];
      for (const conflict of conflictsToResolve) {
        await resolver.resolveConflict(conflict);
      }

      const remainingConflicts = resolver.getActiveConflicts();
      expect(remainingConflicts.length).toBe(0);
    });
  });

  // ============================================================================
  // Clear Tests
  // ============================================================================

  describe('Clear', () => {
    it('should clear all data', async () => {
      const request1: FileAccessRequest = {
        agentId: 'agent1',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      const request2: FileAccessRequest = {
        agentId: 'agent2',
        filePath: 'file.ts',
        lockType: 'write',
        timestamp: new Date(),
      };

      await resolver.registerFileAccess(request1);
      const conflict = await resolver.registerFileAccess(request2);
      await resolver.resolveConflict(conflict!);

      resolver.clear();

      expect(resolver.getActiveConflicts().length).toBe(0);
      expect(resolver.getAllResolutions().length).toBe(0);
    });
  });
});
