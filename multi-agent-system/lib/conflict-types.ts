/**
 * Conflict Types and Data Models
 *
 * Defines types for conflict detection and resolution in the multi-agent system.
 */

export type ConflictType = 'file' | 'architectural' | 'dependency' | 'deadlock';
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ResolutionStrategy = 'auto-merge' | 'rebase' | 'manual' | 'escalate';

/**
 * Represents a conflict between agents
 */
export interface Conflict {
  id: string;
  type: ConflictType;
  involvedAgents: string[];
  description: string;
  severity: ConflictSeverity;
  detectedAt: Date;
  details?: ConflictDetails;
}

/**
 * Type-specific conflict details
 */
export type ConflictDetails =
  | FileConflictDetails
  | ArchitecturalConflictDetails
  | DependencyConflictDetails
  | DeadlockDetails;

/**
 * Details for file conflicts
 */
export interface FileConflictDetails {
  type: 'file';
  filePath: string;
  agent1: {
    agentId: string;
    lineRange?: { start: number; end: number };
    lockType: 'read' | 'write';
  };
  agent2: {
    agentId: string;
    lineRange?: { start: number; end: number };
    lockType: 'read' | 'write';
  };
  overlapping: boolean;
}

/**
 * Details for architectural conflicts
 */
export interface ArchitecturalConflictDetails {
  type: 'architectural';
  decision1: {
    agentId: string;
    decisionId: string;
    title: string;
    chosen: string;
  };
  decision2: {
    agentId: string;
    decisionId: string;
    title: string;
    chosen: string;
  };
  contradictionReason: string;
}

/**
 * Details for dependency conflicts
 */
export interface DependencyConflictDetails {
  type: 'dependency';
  chain: Array<{
    agentId: string;
    waitingFor: string;
    reason: string;
  }>;
  circular: boolean;
}

/**
 * Details for deadlock
 */
export interface DeadlockDetails {
  type: 'deadlock';
  participants: Array<{
    agentId: string;
    heldResources: string[];
    waitingFor: string[];
  }>;
  cycle: string[];
}

/**
 * Resolution of a conflict
 */
export interface Resolution {
  conflictId: string;
  strategy: ResolutionStrategy;
  resolvedBy: string;
  outcome: string;
  resolvedAt: Date;
  actions?: ResolutionAction[];
}

/**
 * Actions taken to resolve a conflict
 */
export interface ResolutionAction {
  type: 'merge' | 'rebase' | 'rollback' | 'release-lock' | 'reassign' | 'notify';
  target: string;
  details: string;
}

/**
 * File access request for conflict detection
 */
export interface FileAccessRequest {
  agentId: string;
  filePath: string;
  lockType: 'read' | 'write';
  lineRange?: { start: number; end: number };
  timestamp: Date;
}

/**
 * Agent wait state for deadlock detection
 */
export interface AgentWaitState {
  agentId: string;
  waitingFor: string;
  reason: string;
  since: Date;
  heldResources: string[];
}
