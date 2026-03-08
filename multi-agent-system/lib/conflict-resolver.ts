import { SharedContextManager } from './shared-context';
import { MessageBus } from './message-bus';
import { AgentRegistry } from './agent-registry';
import { AgentRole } from './agent-definition-schema';
import type { AgentMessage } from './types';
import type {
  Conflict,
  Resolution,
  ConflictType,
  ConflictSeverity,
  ResolutionStrategy,
  FileAccessRequest,
  AgentWaitState,
  FileConflictDetails,
  ArchitecturalConflictDetails,
  DependencyConflictDetails,
  DeadlockDetails,
  ResolutionAction,
} from './conflict-types';
import type { Decision } from './shared-context-types';

/**
 * Conflict Resolver
 *
 * Detects and resolves conflicts between agents:
 * - File conflicts (overlapping edits)
 * - Architectural conflicts (contradictory decisions)
 * - Dependency conflicts (circular waits)
 * - Deadlocks (resource contention)
 */
export class ConflictResolver {
  private conflicts: Map<string, Conflict> = new Map();
  private resolutions: Map<string, Resolution> = new Map();
  private fileAccessRequests: Map<string, FileAccessRequest[]> = new Map();
  private agentWaitStates: Map<string, AgentWaitState> = new Map();
  private deadlockCheckInterval?: NodeJS.Timeout;
  private conflictIdCounter = 0;

  constructor(
    private sharedContext: SharedContextManager,
    private messageBus: MessageBus,
    private agentRegistry: AgentRegistry
  ) {}

  /**
   * Start the conflict resolver (begins deadlock detection)
   */
  start(): void {
    // Check for deadlocks every 30 seconds
    this.deadlockCheckInterval = setInterval(() => {
      this.detectDeadlocks();
    }, 30000);
  }

  /**
   * Stop the conflict resolver
   */
  stop(): void {
    if (this.deadlockCheckInterval) {
      clearInterval(this.deadlockCheckInterval);
      this.deadlockCheckInterval = undefined;
    }
  }

  // ============================================================================
  // File Conflict Detection (Task 9.2)
  // ============================================================================

  /**
   * Register a file access request and check for conflicts
   */
  async registerFileAccess(request: FileAccessRequest): Promise<Conflict | null> {
    const { filePath, agentId } = request;

    // Get existing requests for this file
    const existingRequests = this.fileAccessRequests.get(filePath) || [];

    // Check for conflicts with existing requests
    for (const existing of existingRequests) {
      // Skip if same agent
      if (existing.agentId === agentId) {
        continue;
      }

      // Check if there's a conflict
      const conflict = this.checkFileConflict(request, existing);
      if (conflict) {
        this.conflicts.set(conflict.id, conflict);

        // Notify involved agents
        await this.notifyConflict(conflict);

        return conflict;
      }
    }

    // No conflict, add to requests
    existingRequests.push(request);
    this.fileAccessRequests.set(filePath, existingRequests);

    return null;
  }

  /**
   * Check if two file access requests conflict
   */
  private checkFileConflict(
    request1: FileAccessRequest,
    request2: FileAccessRequest
  ): Conflict | null {
    // Read locks don't conflict with each other
    if (request1.lockType === 'read' && request2.lockType === 'read') {
      return null;
    }

    // Check for line range overlap if both have ranges
    const overlapping = this.checkLineRangeOverlap(request1.lineRange, request2.lineRange);

    // Determine severity
    let severity: ConflictSeverity = 'medium';
    if (overlapping) {
      severity = 'high';
    } else if (request1.lockType === 'write' || request2.lockType === 'write') {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    const details: FileConflictDetails = {
      type: 'file',
      filePath: request1.filePath,
      agent1: {
        agentId: request1.agentId,
        lineRange: request1.lineRange,
        lockType: request1.lockType,
      },
      agent2: {
        agentId: request2.agentId,
        lineRange: request2.lineRange,
        lockType: request2.lockType,
      },
      overlapping,
    };

    return {
      id: this.generateConflictId(),
      type: 'file',
      involvedAgents: [request1.agentId, request2.agentId],
      description: `File conflict on ${request1.filePath} between ${request1.agentId} and ${request2.agentId}`,
      severity,
      detectedAt: new Date(),
      details,
    };
  }

  /**
   * Check if two line ranges overlap
   */
  private checkLineRangeOverlap(
    range1?: { start: number; end: number },
    range2?: { start: number; end: number }
  ): boolean {
    // If either range is undefined, assume full file (overlapping)
    if (!range1 || !range2) {
      return true;
    }

    // Check for overlap: ranges overlap if one starts before the other ends
    return range1.start <= range2.end && range2.start <= range1.end;
  }

  /**
   * Remove file access request when agent releases lock
   */
  removeFileAccess(agentId: string, filePath: string): void {
    const requests = this.fileAccessRequests.get(filePath);
    if (!requests) return;

    const filtered = requests.filter((req) => req.agentId !== agentId);

    if (filtered.length === 0) {
      this.fileAccessRequests.delete(filePath);
    } else {
      this.fileAccessRequests.set(filePath, filtered);
    }
  }

  // ============================================================================
  // Automatic Conflict Resolution (Task 9.3)
  // ============================================================================

  /**
   * Attempt to automatically resolve a conflict
   */
  async resolveConflict(conflict: Conflict): Promise<Resolution> {
    // Check if auto-resolution is possible
    if (!this.canAutoResolve(conflict)) {
      return this.escalateToTechLead(conflict);
    }

    // Determine resolution strategy
    const strategy = this.determineResolutionStrategy(conflict);

    let outcome: string;
    const actions: ResolutionAction[] = [];

    switch (strategy) {
      case 'auto-merge':
        outcome = await this.autoMerge(conflict, actions);
        break;

      case 'rebase':
        outcome = await this.suggestRebase(conflict, actions);
        break;

      case 'manual':
      case 'escalate':
      default:
        return this.escalateToTechLead(conflict);
    }

    const resolution: Resolution = {
      conflictId: conflict.id,
      strategy,
      resolvedBy: 'conflict-resolver',
      outcome,
      resolvedAt: new Date(),
      actions,
    };

    this.resolutions.set(conflict.id, resolution);
    this.conflicts.delete(conflict.id);

    // Notify agents of resolution
    await this.notifyResolution(conflict, resolution);

    return resolution;
  }

  /**
   * Check if a conflict can be automatically resolved
   */
  canAutoResolve(conflict: Conflict): boolean {
    switch (conflict.type) {
      case 'file':
        // Can auto-resolve if non-overlapping changes
        const fileDetails = conflict.details as FileConflictDetails;
        return !fileDetails.overlapping;

      case 'architectural':
        // Always escalate architectural conflicts
        return false;

      case 'dependency':
        // Can auto-resolve simple dependency conflicts
        const depDetails = conflict.details as DependencyConflictDetails;
        return !depDetails.circular && depDetails.chain.length <= 3;

      case 'deadlock':
        // Can auto-resolve deadlocks by breaking them
        return true;

      default:
        return false;
    }
  }

  /**
   * Determine the best resolution strategy
   */
  private determineResolutionStrategy(conflict: Conflict): ResolutionStrategy {
    switch (conflict.type) {
      case 'file':
        const fileDetails = conflict.details as FileConflictDetails;
        if (!fileDetails.overlapping) {
          return 'auto-merge';
        } else {
          return 'rebase';
        }

      case 'dependency':
        return 'rebase';

      case 'deadlock':
        return 'auto-merge'; // Will break deadlock

      default:
        return 'escalate';
    }
  }

  /**
   * Auto-merge non-overlapping changes
   */
  private async autoMerge(conflict: Conflict, actions: ResolutionAction[]): Promise<string> {
    if (conflict.type === 'file') {
      const details = conflict.details as FileConflictDetails;

      actions.push({
        type: 'merge',
        target: details.filePath,
        details: `Auto-merged non-overlapping changes from ${details.agent1.agentId} and ${details.agent2.agentId}`,
      });

      return `Successfully auto-merged non-overlapping changes in ${details.filePath}`;
    }

    if (conflict.type === 'deadlock') {
      return await this.breakDeadlock(conflict, actions);
    }

    return 'Auto-merge not applicable';
  }

  /**
   * Suggest rebase for sequential changes
   */
  private async suggestRebase(conflict: Conflict, actions: ResolutionAction[]): Promise<string> {
    const agents = conflict.involvedAgents;

    // Determine which agent should rebase (typically the second one)
    const rebaseAgent = agents[1];

    actions.push({
      type: 'rebase',
      target: rebaseAgent,
      details: `Suggested ${rebaseAgent} to rebase their changes`,
    });

    // Notify agent to rebase
    await this.messageBus.send({
      id: `msg-${Date.now()}-${Math.random()}`,
      from: 'conflict-resolver',
      to: rebaseAgent,
      type: 'notification',
      priority: 'high',
      payload: {
        action: 'rebase-required',
        context: {
          conflictId: conflict.id,
          reason: conflict.description,
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    });

    return `Suggested ${rebaseAgent} to rebase their changes`;
  }

  /**
   * Escalate conflict to tech lead
   */
  async escalateToTechLead(conflict: Conflict): Promise<Resolution> {
    // Find tech lead
    const techLeads = this.agentRegistry.getAgentsByRole(AgentRole.TECH_LEAD);

    if (techLeads.length === 0) {
      throw new Error('No tech lead available for escalation');
    }

    const techLead = techLeads[0];

    // Send escalation message
    const message: AgentMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      from: 'conflict-resolver',
      to: techLead.id,
      type: 'escalation',
      priority: conflict.severity === 'critical' ? 'critical' : 'high',
      payload: {
        action: 'resolve-conflict',
        context: {
          conflict,
          reason: 'Cannot auto-resolve',
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    };

    await this.messageBus.send(message);

    const resolution: Resolution = {
      conflictId: conflict.id,
      strategy: 'escalate',
      resolvedBy: techLead.id,
      outcome: `Escalated to tech lead ${techLead.id}`,
      resolvedAt: new Date(),
      actions: [
        {
          type: 'notify',
          target: techLead.id,
          details: 'Escalated conflict for manual resolution',
        },
      ],
    };

    this.resolutions.set(conflict.id, resolution);

    return resolution;
  }

  // ============================================================================
  // Architectural Conflict Detection (Task 9.4)
  // ============================================================================

  /**
   * Detect architectural conflicts in decisions
   */
  async detectArchitecturalConflicts(): Promise<Conflict[]> {
    const decisions = this.sharedContext.getAllDecisions();
    const conflicts: Conflict[] = [];

    // Check for contradictory decisions
    for (let i = 0; i < decisions.length; i++) {
      for (let j = i + 1; j < decisions.length; j++) {
        const decision1 = decisions[i];
        const decision2 = decisions[j];

        const conflict = this.checkArchitecturalConflict(decision1, decision2);
        if (conflict) {
          conflicts.push(conflict);
          this.conflicts.set(conflict.id, conflict);

          // Notify involved agents
          await this.notifyConflict(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two decisions conflict
   */
  private checkArchitecturalConflict(decision1: Decision, decision2: Decision): Conflict | null {
    // Check for overlapping tags
    const hasOverlappingTags = decision1.tags.some((tag) => decision2.tags.includes(tag));

    if (!hasOverlappingTags) {
      return null;
    }

    // Check if contexts are similar but choices differ
    const contextSimilarity = this.calculateSimilarity(decision1.context, decision2.context);

    if (contextSimilarity > 0.5 && decision1.chosen !== decision2.chosen) {
      const details: ArchitecturalConflictDetails = {
        type: 'architectural',
        decision1: {
          agentId: decision1.madeBy,
          decisionId: decision1.id,
          title: decision1.title,
          chosen: decision1.chosen,
        },
        decision2: {
          agentId: decision2.madeBy,
          decisionId: decision2.id,
          title: decision2.title,
          chosen: decision2.chosen,
        },
        contradictionReason: `Similar contexts but different choices: "${decision1.chosen}" vs "${decision2.chosen}"`,
      };

      return {
        id: this.generateConflictId(),
        type: 'architectural',
        involvedAgents: [decision1.madeBy, decision2.madeBy],
        description: `Architectural conflict: "${decision1.title}" vs "${decision2.title}"`,
        severity: 'high',
        detectedAt: new Date(),
        details,
      };
    }

    return null;
  }

  /**
   * Calculate text similarity (Jaccard similarity)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((word) => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  // ============================================================================
  // Deadlock Detection (Task 9.5)
  // ============================================================================

  /**
   * Register an agent wait state
   */
  registerWaitState(waitState: AgentWaitState): void {
    this.agentWaitStates.set(waitState.agentId, waitState);
  }

  /**
   * Clear an agent wait state
   */
  clearWaitState(agentId: string): void {
    this.agentWaitStates.delete(agentId);
  }

  /**
   * Detect deadlocks (circular waits)
   */
  async detectDeadlocks(): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Build wait-for graph
    const waitForGraph = new Map<string, string>();

    for (const [agentId, waitState] of this.agentWaitStates.entries()) {
      waitForGraph.set(agentId, waitState.waitingFor);
    }

    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const agentId of waitForGraph.keys()) {
      if (!visited.has(agentId)) {
        const cycle = this.detectCycle(agentId, waitForGraph, visited, recursionStack, []);

        if (cycle) {
          const conflict = this.createDeadlockConflict(cycle);
          conflicts.push(conflict);
          this.conflicts.set(conflict.id, conflict);

          // Automatically break deadlock
          await this.resolveConflict(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect cycle in wait-for graph using DFS
   */
  private detectCycle(
    agentId: string,
    graph: Map<string, string>,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): string[] | null {
    visited.add(agentId);
    recursionStack.add(agentId);
    path.push(agentId);

    const waitingFor = graph.get(agentId);

    if (waitingFor) {
      if (recursionStack.has(waitingFor)) {
        // Found cycle
        const cycleStart = path.indexOf(waitingFor);
        return path.slice(cycleStart);
      }

      if (!visited.has(waitingFor)) {
        const cycle = this.detectCycle(waitingFor, graph, visited, recursionStack, [...path]);
        if (cycle) {
          return cycle;
        }
      }
    }

    recursionStack.delete(agentId);
    return null;
  }

  /**
   * Create a deadlock conflict from a cycle
   */
  private createDeadlockConflict(cycle: string[]): Conflict {
    const participants = cycle.map((agentId) => {
      const waitState = this.agentWaitStates.get(agentId);
      return {
        agentId,
        heldResources: waitState?.heldResources || [],
        waitingFor: waitState ? [waitState.waitingFor] : [],
      };
    });

    const details: DeadlockDetails = {
      type: 'deadlock',
      participants,
      cycle,
    };

    return {
      id: this.generateConflictId(),
      type: 'deadlock',
      involvedAgents: cycle,
      description: `Deadlock detected: ${cycle.join(' -> ')} -> ${cycle[0]}`,
      severity: 'critical',
      detectedAt: new Date(),
      details,
    };
  }

  /**
   * Break a deadlock by selecting a victim and rolling back
   */
  private async breakDeadlock(conflict: Conflict, actions: ResolutionAction[]): Promise<string> {
    const details = conflict.details as DeadlockDetails;

    // Select victim (agent with lowest priority or least work done)
    const victim = this.selectDeadlockVictim(details.participants.map((p) => p.agentId));

    // Release victim's locks
    const victimState = this.agentWaitStates.get(victim);
    if (victimState) {
      for (const resource of victimState.heldResources) {
        this.sharedContext.releaseFileLock(victim, resource);

        actions.push({
          type: 'release-lock',
          target: resource,
          details: `Released lock held by ${victim}`,
        });
      }
    }

    // Clear victim's wait state
    this.clearWaitState(victim);

    // Notify victim to retry
    await this.messageBus.send({
      id: `msg-${Date.now()}-${Math.random()}`,
      from: 'conflict-resolver',
      to: victim,
      type: 'notification',
      priority: 'high',
      payload: {
        action: 'deadlock-broken',
        context: {
          conflictId: conflict.id,
          reason: 'Selected as deadlock victim',
          instruction: 'Please retry your operation',
        },
      },
      timestamp: new Date(),
      acknowledged: false,
    });

    actions.push({
      type: 'notify',
      target: victim,
      details: 'Notified to retry after deadlock break',
    });

    return `Broke deadlock by releasing locks held by ${victim}`;
  }

  /**
   * Select a victim for deadlock breaking
   */
  private selectDeadlockVictim(agents: string[]): string {
    // Simple strategy: select agent with least workload
    let victim = agents[0];
    let minWorkload = Infinity;

    for (const agentId of agents) {
      const agent = this.agentRegistry.getAgent(agentId);
      if (agent && agent.workload < minWorkload) {
        minWorkload = agent.workload;
        victim = agentId;
      }
    }

    return victim;
  }

  // ============================================================================
  // Conflict Detection (Task 9.1)
  // ============================================================================

  /**
   * Detect all types of conflicts
   */
  async detectConflicts(): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Detect architectural conflicts
    const archConflicts = await this.detectArchitecturalConflicts();
    conflicts.push(...archConflicts);

    // Detect deadlocks
    const deadlocks = await this.detectDeadlocks();
    conflicts.push(...deadlocks);

    // File conflicts are detected on-demand via registerFileAccess

    return conflicts;
  }

  /**
   * Get all active conflicts
   */
  getActiveConflicts(): Conflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * Get conflicts by type
   */
  getConflictsByType(type: ConflictType): Conflict[] {
    return Array.from(this.conflicts.values()).filter((c) => c.type === type);
  }

  /**
   * Get conflicts involving a specific agent
   */
  getConflictsByAgent(agentId: string): Conflict[] {
    return Array.from(this.conflicts.values()).filter((c) => c.involvedAgents.includes(agentId));
  }

  /**
   * Get resolution for a conflict
   */
  getResolution(conflictId: string): Resolution | undefined {
    return this.resolutions.get(conflictId);
  }

  /**
   * Get all resolutions
   */
  getAllResolutions(): Resolution[] {
    return Array.from(this.resolutions.values());
  }

  // ============================================================================
  // Notification Helpers
  // ============================================================================

  /**
   * Notify agents of a conflict
   */
  private async notifyConflict(conflict: Conflict): Promise<void> {
    for (const agentId of conflict.involvedAgents) {
      await this.messageBus.send({
        id: `msg-${Date.now()}-${Math.random()}`,
        from: 'conflict-resolver',
        to: agentId,
        type: 'notification',
        priority: conflict.severity === 'critical' ? 'critical' : 'high',
        payload: {
          action: 'conflict-detected',
          context: {
            conflict,
          },
        },
        timestamp: new Date(),
        acknowledged: false,
      });
    }
  }

  /**
   * Notify agents of a resolution
   */
  private async notifyResolution(conflict: Conflict, resolution: Resolution): Promise<void> {
    for (const agentId of conflict.involvedAgents) {
      await this.messageBus.send({
        id: `msg-${Date.now()}-${Math.random()}`,
        from: 'conflict-resolver',
        to: agentId,
        type: 'notification',
        priority: 'normal',
        payload: {
          action: 'conflict-resolved',
          context: {
            conflict,
            resolution,
          },
        },
        timestamp: new Date(),
        acknowledged: false,
      });
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate a unique conflict ID
   */
  private generateConflictId(): string {
    return `conflict-${Date.now()}-${++this.conflictIdCounter}`;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.conflicts.clear();
    this.resolutions.clear();
    this.fileAccessRequests.clear();
    this.agentWaitStates.clear();
    this.conflictIdCounter = 0;
  }
}
