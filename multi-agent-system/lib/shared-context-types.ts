export interface ProjectState {
  currentPhase: string;
  completedTasks: string[];
  activeTasks: Map<string, string>; // taskId -> agentId
  blockedTasks: string[];
  version: number;
  lastUpdated: Date;
}

export interface FileLock {
  filePath: string;
  lockedBy: string;
  acquiredAt: Date;
  expiresAt: Date;
  type: 'read' | 'write';
}

export interface WorkItem {
  id: string;
  title: string;
  assignedTo: string;
  status: 'pending' | 'in-progress' | 'review' | 'blocked' | 'complete';
  dependencies: string[];
  artifacts: string[];
  startedAt?: Date;
  completedAt?: Date;
  timeSpent: number;
}

export interface Decision {
  id: string;
  title: string;
  context: string;
  options: string[];
  chosen: string;
  rationale: string;
  madeBy: string;
  madeAt: Date;
  tags: string[];
}

export interface KnowledgeItem {
  type: 'decision' | 'pattern' | 'convention' | 'anti-pattern';
  title: string;
  content: string;
  examples?: string[];
  tags: string[];
  createdAt: Date;
}

// Cache-related types
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

// Consistency mode for reads
export type ConsistencyMode = 'eventual' | 'strong';

// Sync state for persistence
export interface SyncState {
  lastSyncAt: Date;
  pendingWrites: number;
  syncInProgress: boolean;
  lastError?: Error;
}

// Batched update
export interface BatchedUpdate {
  type: 'projectState' | 'workItem' | 'decision' | 'knowledge';
  id?: string;
  data: unknown;
  timestamp: number;
}
