import {
  ProjectState,
  FileLock,
  WorkItem,
  Decision,
  KnowledgeItem,
  CacheEntry,
  CacheStats,
  ConsistencyMode,
  SyncState,
  BatchedUpdate,
} from './shared-context-types';

/**
 * LRU Cache Manager with TTL support
 */
class CacheManager<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttlMs: number;
  private stats: CacheStats;

  constructor(maxSize: number = 100, ttlMs: number = 5000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.stats = { hits: 0, misses: 0, evictions: 0, size: 0 };
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size--;
      return undefined;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + this.ttlMs,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  invalidate(key: string): void {
    if (this.cache.delete(key)) {
      this.stats.size--;
    }
  }

  invalidateAll(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size--;
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, size: 0 };
  }
}

/**
 * Persistence Layer for periodic sync
 */
class PersistenceLayer {
  private syncState: SyncState;
  private syncIntervalMs: number;
  private syncTimer?: NodeJS.Timeout;
  private writeAheadLog: BatchedUpdate[];

  constructor(syncIntervalMs: number = 30000) {
    this.syncIntervalMs = syncIntervalMs;
    this.syncState = {
      lastSyncAt: new Date(),
      pendingWrites: 0,
      syncInProgress: false,
    };
    this.writeAheadLog = [];
  }

  startPeriodicSync(syncFn: () => Promise<void>): void {
    this.syncTimer = setInterval(async () => {
      await this.sync(syncFn);
    }, this.syncIntervalMs);
  }

  stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  async sync(syncFn: () => Promise<void>): Promise<void> {
    if (this.syncState.syncInProgress) {
      return;
    }

    this.syncState.syncInProgress = true;

    try {
      await syncFn();
      this.syncState.lastSyncAt = new Date();
      this.syncState.pendingWrites = 0;
      this.syncState.lastError = undefined;
      this.writeAheadLog = [];
    } catch (error) {
      this.syncState.lastError = error as Error;
      console.error('Sync failed:', error);
    } finally {
      this.syncState.syncInProgress = false;
    }
  }

  addToWriteAheadLog(update: BatchedUpdate): void {
    this.writeAheadLog.push(update);
    this.syncState.pendingWrites++;
  }

  getWriteAheadLog(): BatchedUpdate[] {
    return [...this.writeAheadLog];
  }

  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  clear(): void {
    this.writeAheadLog = [];
    this.syncState = {
      lastSyncAt: new Date(),
      pendingWrites: 0,
      syncInProgress: false,
    };
  }
}

/**
 * Shared Context Manager with Performance Optimizations
 *
 * Maintains consistent project state across all agents.
 * Provides file locking, work item tracking, and knowledge base.
 *
 * Optimizations:
 * - Caching with TTL (5 seconds) and LRU eviction
 * - Batched state updates (50ms window)
 * - Eventual consistency model
 * - Periodic sync to persistent storage (30 seconds)
 */
export class SharedContextManager {
  private projectState: ProjectState;
  private fileLocks: Map<string, FileLock>;
  private workItems: Map<string, WorkItem>;
  private decisions: Map<string, Decision>;
  private knowledgeBase: KnowledgeItem[];
  private stateChangeListeners: Array<(state: ProjectState) => void>;
  private lockRenewalTimers: Map<string, NodeJS.Timeout>;

  // Performance optimizations
  private projectStateCache: CacheManager<ProjectState>;
  private workItemCache: CacheManager<WorkItem>;
  private pendingUpdates: BatchedUpdate[];
  private batchTimer?: NodeJS.Timeout;
  private batchWindowMs: number;
  private persistenceLayer: PersistenceLayer;
  private previousProjectState?: ProjectState;

  constructor() {
    this.projectState = {
      currentPhase: 'initializing',
      completedTasks: [],
      activeTasks: new Map(),
      blockedTasks: [],
      version: 0,
      lastUpdated: new Date(),
    };
    this.fileLocks = new Map();
    this.workItems = new Map();
    this.decisions = new Map();
    this.knowledgeBase = [];
    this.stateChangeListeners = [];
    this.lockRenewalTimers = new Map();

    // Initialize performance optimizations
    this.projectStateCache = new CacheManager<ProjectState>(10, 5000); // 5 second TTL
    this.workItemCache = new CacheManager<WorkItem>(100, 5000);
    this.pendingUpdates = [];
    this.batchWindowMs = 50; // 50ms batch window
    this.persistenceLayer = new PersistenceLayer(30000); // 30 second sync interval

    // Start lock expiration checker
    this.startLockExpirationChecker();

    // Start periodic sync
    this.persistenceLayer.startPeriodicSync(async () => {
      await this.syncToPersistentStorage();
    });
  }

  // ============================================================================
  // Project State Management (Task 3.2) - Optimized
  // ============================================================================

  /**
   * Get current project state with consistency mode
   * @param mode - 'eventual' (from cache) or 'strong' (from source)
   */
  getProjectState(mode: ConsistencyMode = 'eventual'): ProjectState {
    if (mode === 'eventual') {
      // Try cache first
      const cached = this.projectStateCache.get('current');
      if (cached) {
        return cached;
      }
    }

    // Strong consistency or cache miss - read from source
    const state: ProjectState = {
      ...this.projectState,
      activeTasks: new Map(this.projectState.activeTasks),
      completedTasks: [...this.projectState.completedTasks],
      blockedTasks: [...this.projectState.blockedTasks],
    };

    // Update cache
    this.projectStateCache.set('current', state);

    return state;
  }

  /**
   * Update project state with batching and shallow comparison
   */
  updateProjectState(update: Partial<ProjectState>): void {
    // Add to batch
    const batchedUpdate: BatchedUpdate = {
      type: 'projectState',
      data: update,
      timestamp: Date.now(),
    };

    this.pendingUpdates.push(batchedUpdate);

    // Add to write-ahead log
    this.persistenceLayer.addToWriteAheadLog(batchedUpdate);

    // Schedule batch processing
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatchedUpdates();
      }, this.batchWindowMs);
    }
  }

  /**
   * Process batched updates
   */
  private processBatchedUpdates(): void {
    if (this.pendingUpdates.length === 0) {
      this.batchTimer = undefined;
      return;
    }

    // Merge all project state updates
    const projectStateUpdates = this.pendingUpdates.filter((u) => u.type === 'projectState');

    if (projectStateUpdates.length > 0) {
      const mergedUpdate = projectStateUpdates.reduce((acc, update) => {
        return { ...acc, ...(update.data as Partial<ProjectState>) };
      }, {} as Partial<ProjectState>);

      // Apply merged update
      const newVersion = this.projectState.version + 1;
      const newState: ProjectState = {
        ...this.projectState,
        ...mergedUpdate,
        version: newVersion,
        lastUpdated: new Date(),
      };

      // Shallow comparison - only notify if actually changed
      if (this.hasStateChanged(this.projectState, newState)) {
        this.projectState = newState;

        // Invalidate cache
        this.projectStateCache.invalidate('current');

        // Notify listeners (debounced)
        this.notifyStateChange();
      }
    }

    // Clear pending updates
    this.pendingUpdates = [];
    this.batchTimer = undefined;
  }

  /**
   * Shallow comparison to detect actual state changes
   */
  private hasStateChanged(oldState: ProjectState, newState: ProjectState): boolean {
    if (oldState.currentPhase !== newState.currentPhase) return true;
    if (oldState.completedTasks.length !== newState.completedTasks.length) return true;
    if (oldState.blockedTasks.length !== newState.blockedTasks.length) return true;
    if (oldState.activeTasks.size !== newState.activeTasks.size) return true;

    // Check if arrays have same elements (shallow)
    if (!this.arraysEqual(oldState.completedTasks, newState.completedTasks)) return true;
    if (!this.arraysEqual(oldState.blockedTasks, newState.blockedTasks)) return true;

    return false;
  }

  /**
   * Compare two arrays for equality
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Register a listener for state changes
   */
  onStateChange(listener: (state: ProjectState) => void): void {
    this.stateChangeListeners.push(listener);
  }

  /**
   * Notify all listeners of state change (debounced)
   */
  private notifyStateChange(): void {
    const state = this.getProjectState('strong');
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  // ============================================================================
  // File Locking System (Task 3.3)
  // ============================================================================

  /**
   * Acquire a file lock with timeout
   */
  async acquireFileLock(
    agentId: string,
    filePath: string,
    type: 'read' | 'write' = 'write',
    timeoutMs: number = 10 * 60 * 1000
  ): Promise<boolean> {
    const existingLock = this.fileLocks.get(filePath);

    if (existingLock) {
      // Check if lock has expired
      if (new Date() > existingLock.expiresAt) {
        this.releaseFileLock(existingLock.lockedBy, filePath);
      } else {
        // Lock still valid
        if (type === 'read' && existingLock.type === 'read') {
          // Multiple read locks allowed
          return true;
        }
        // Write lock or conflicting lock types
        return false;
      }
    }

    // Acquire new lock
    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeoutMs);

    const lock: FileLock = {
      filePath,
      lockedBy: agentId,
      acquiredAt: now,
      expiresAt,
      type,
    };

    this.fileLocks.set(filePath, lock);
    return true;
  }

  /**
   * Release a file lock
   */
  releaseFileLock(agentId: string, filePath: string): void {
    const lock = this.fileLocks.get(filePath);

    if (lock && lock.lockedBy === agentId) {
      this.fileLocks.delete(filePath);

      // Clear renewal timer if exists
      const timer = this.lockRenewalTimers.get(filePath);
      if (timer) {
        clearTimeout(timer);
        this.lockRenewalTimers.delete(filePath);
      }
    }
  }

  /**
   * Renew a file lock to extend expiration
   */
  renewFileLock(agentId: string, filePath: string, extensionMs: number = 10 * 60 * 1000): boolean {
    const lock = this.fileLocks.get(filePath);

    if (!lock || lock.lockedBy !== agentId) {
      return false;
    }

    // Extend expiration
    lock.expiresAt = new Date(Date.now() + extensionMs);
    return true;
  }

  /**
   * Get all locks held by an agent
   */
  getAgentLocks(agentId: string): FileLock[] {
    return Array.from(this.fileLocks.values()).filter((lock) => lock.lockedBy === agentId);
  }

  /**
   * Check if a file is locked
   */
  isFileLocked(filePath: string): boolean {
    const lock = this.fileLocks.get(filePath);
    if (!lock) return false;

    // Check if expired
    if (new Date() > lock.expiresAt) {
      this.fileLocks.delete(filePath);
      return false;
    }

    return true;
  }

  /**
   * Start periodic lock expiration checker
   */
  private startLockExpirationChecker(): void {
    setInterval(() => {
      const now = new Date();
      for (const [filePath, lock] of this.fileLocks.entries()) {
        if (now > lock.expiresAt) {
          this.fileLocks.delete(filePath);
          const timer = this.lockRenewalTimers.get(filePath);
          if (timer) {
            clearTimeout(timer);
            this.lockRenewalTimers.delete(filePath);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // ============================================================================
  // Work Item Tracking (Task 3.4) - Optimized
  // ============================================================================

  /**
   * Get a work item by ID with caching
   */
  getWorkItem(id: string, mode: ConsistencyMode = 'eventual'): WorkItem | undefined {
    if (mode === 'eventual') {
      // Try cache first
      const cached = this.workItemCache.get(id);
      if (cached) {
        return cached;
      }
    }

    // Strong consistency or cache miss
    const item = this.workItems.get(id);
    if (item) {
      this.workItemCache.set(id, item);
    }
    return item;
  }

  /**
   * Update a work item with batching
   */
  updateWorkItem(id: string, update: Partial<WorkItem>): void {
    const existing = this.workItems.get(id);

    if (!existing) {
      throw new Error(`Work item ${id} not found`);
    }

    // Validate state transitions
    if (update.status) {
      this.validateStateTransition(existing.status, update.status);
    }

    // Update timestamps
    if (update.status === 'in-progress' && !existing.startedAt) {
      update.startedAt = new Date();
    }

    if (update.status === 'complete' && !existing.completedAt) {
      update.completedAt = new Date();
    }

    const updated: WorkItem = {
      ...existing,
      ...update,
    };

    this.workItems.set(id, updated);

    // Invalidate cache
    this.workItemCache.invalidate(id);

    // Update project state
    if (update.status === 'complete') {
      this.projectState.completedTasks.push(id);
      this.projectState.activeTasks.delete(id);
    } else if (update.status === 'blocked') {
      if (!this.projectState.blockedTasks.includes(id)) {
        this.projectState.blockedTasks.push(id);
      }
    } else if (update.status === 'in-progress') {
      this.projectState.blockedTasks = this.projectState.blockedTasks.filter(
        (taskId) => taskId !== id
      );
      if (update.assignedTo) {
        this.projectState.activeTasks.set(id, update.assignedTo);
      }
    }

    this.projectState.version++;
    this.projectState.lastUpdated = new Date();

    // Invalidate project state cache
    this.projectStateCache.invalidate('current');

    // Add to write-ahead log
    this.persistenceLayer.addToWriteAheadLog({
      type: 'workItem',
      id,
      data: updated,
      timestamp: Date.now(),
    });

    this.notifyStateChange();
  }

  /**
   * Create a new work item
   */
  createWorkItem(workItem: WorkItem): void {
    if (this.workItems.has(workItem.id)) {
      throw new Error(`Work item ${workItem.id} already exists`);
    }

    this.workItems.set(workItem.id, workItem);

    // Update cache
    this.workItemCache.set(workItem.id, workItem);

    if (workItem.status === 'in-progress') {
      this.projectState.activeTasks.set(workItem.id, workItem.assignedTo);
    }

    this.projectState.version++;
    this.projectState.lastUpdated = new Date();

    // Invalidate project state cache
    this.projectStateCache.invalidate('current');

    // Add to write-ahead log
    this.persistenceLayer.addToWriteAheadLog({
      type: 'workItem',
      id: workItem.id,
      data: workItem,
      timestamp: Date.now(),
    });

    this.notifyStateChange();
  }

  /**
   * Get all work items
   */
  getAllWorkItems(): WorkItem[] {
    return Array.from(this.workItems.values());
  }

  /**
   * Get work items by status
   */
  getWorkItemsByStatus(status: WorkItem['status']): WorkItem[] {
    return Array.from(this.workItems.values()).filter((item) => item.status === status);
  }

  /**
   * Get work items assigned to an agent
   */
  getWorkItemsByAgent(agentId: string): WorkItem[] {
    return Array.from(this.workItems.values()).filter((item) => item.assignedTo === agentId);
  }

  /**
   * Validate work item state transitions
   */
  private validateStateTransition(from: WorkItem['status'], to: WorkItem['status']): void {
    const validTransitions: Record<WorkItem['status'], WorkItem['status'][]> = {
      pending: ['in-progress'],
      'in-progress': ['review', 'blocked'],
      review: ['in-progress', 'complete'],
      blocked: ['in-progress', 'pending'],
      complete: [], // Terminal state
    };

    const allowed = validTransitions[from];
    if (!allowed.includes(to)) {
      throw new Error(`Invalid state transition from ${from} to ${to}`);
    }
  }

  // ============================================================================
  // Knowledge Base (Task 3.5)
  // ============================================================================

  /**
   * Add a decision to the knowledge base
   */
  addDecision(decision: Decision): void {
    // Check for contradictory decisions
    const contradictions = this.findContradictoryDecisions(decision);
    if (contradictions.length > 0) {
      console.warn(
        `Warning: Decision "${decision.title}" may contradict existing decisions:`,
        contradictions.map((d) => d.title)
      );
    }

    this.decisions.set(decision.id, decision);

    // Add to knowledge base
    const knowledgeItem: KnowledgeItem = {
      type: 'decision',
      title: decision.title,
      content: `${decision.context}\n\nChosen: ${decision.chosen}\n\nRationale: ${decision.rationale}`,
      tags: decision.tags,
      createdAt: decision.madeAt,
    };

    this.knowledgeBase.push(knowledgeItem);

    // Add to write-ahead log
    this.persistenceLayer.addToWriteAheadLog({
      type: 'decision',
      id: decision.id,
      data: decision,
      timestamp: Date.now(),
    });
  }

  /**
   * Add a knowledge item (pattern, convention, anti-pattern)
   */
  addKnowledgeItem(item: KnowledgeItem): void {
    this.knowledgeBase.push(item);

    // Add to write-ahead log
    this.persistenceLayer.addToWriteAheadLog({
      type: 'knowledge',
      data: item,
      timestamp: Date.now(),
    });
  }

  /**
   * Query the knowledge base
   */
  queryKnowledgeBase(query: string): KnowledgeItem[] {
    const lowerQuery = query.toLowerCase();

    return this.knowledgeBase.filter((item) => {
      // Search in title, content, and tags
      const titleMatch = item.title.toLowerCase().includes(lowerQuery);
      const contentMatch = item.content.toLowerCase().includes(lowerQuery);
      const tagMatch = item.tags.some((tag) => tag.toLowerCase().includes(lowerQuery));

      return titleMatch || contentMatch || tagMatch;
    });
  }

  /**
   * Get all decisions
   */
  getAllDecisions(): Decision[] {
    return Array.from(this.decisions.values());
  }

  /**
   * Get decisions by tag
   */
  getDecisionsByTag(tag: string): Decision[] {
    return Array.from(this.decisions.values()).filter((decision) => decision.tags.includes(tag));
  }

  /**
   * Find contradictory decisions
   */
  private findContradictoryDecisions(newDecision: Decision): Decision[] {
    const contradictions: Decision[] = [];

    // Check for decisions with overlapping tags and different choices
    for (const existing of this.decisions.values()) {
      const hasOverlappingTags = existing.tags.some((tag) => newDecision.tags.includes(tag));

      if (hasOverlappingTags) {
        // Check if the context is similar but choice is different
        const contextSimilarity = this.calculateSimilarity(existing.context, newDecision.context);

        if (contextSimilarity > 0.5 && existing.chosen !== newDecision.chosen) {
          contradictions.push(existing);
        }
      }
    }

    return contradictions;
  }

  /**
   * Calculate simple text similarity (Jaccard similarity)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((word) => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  // ============================================================================
  // Performance Optimization Methods
  // ============================================================================

  /**
   * Get cache statistics
   */
  getCacheStats(): { projectState: CacheStats; workItems: CacheStats } {
    return {
      projectState: this.projectStateCache.getStats(),
      workItems: this.workItemCache.getStats(),
    };
  }

  /**
   * Get sync state
   */
  getSyncState(): SyncState {
    return this.persistenceLayer.getSyncState();
  }

  /**
   * Force immediate sync to persistent storage
   */
  async forceSyncToPersistentStorage(): Promise<void> {
    await this.persistenceLayer.sync(async () => {
      await this.syncToPersistentStorage();
    });
  }

  /**
   * Sync to persistent storage (placeholder - would write to disk/database)
   */
  private async syncToPersistentStorage(): Promise<void> {
    // In a real implementation, this would:
    // 1. Serialize current state
    // 2. Write to disk/database
    // 3. Handle errors and retries
    // 4. Clear write-ahead log on success

    // For now, just simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Log sync for testing
    console.log('Synced to persistent storage:', {
      projectStateVersion: this.projectState.version,
      workItemsCount: this.workItems.size,
      decisionsCount: this.decisions.size,
      knowledgeBaseCount: this.knowledgeBase.length,
    });
  }

  /**
   * Recover from persistent storage (placeholder)
   */
  async recoverFromPersistentStorage(): Promise<void> {
    // In a real implementation, this would:
    // 1. Read from disk/database
    // 2. Deserialize state
    // 3. Replay write-ahead log
    // 4. Restore caches

    // For now, just simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.projectState = {
      currentPhase: 'initializing',
      completedTasks: [],
      activeTasks: new Map(),
      blockedTasks: [],
      version: 0,
      lastUpdated: new Date(),
    };
    this.fileLocks.clear();
    this.workItems.clear();
    this.decisions.clear();
    this.knowledgeBase = [];
    this.stateChangeListeners = [];

    // Clear all timers
    for (const timer of this.lockRenewalTimers.values()) {
      clearTimeout(timer);
    }
    this.lockRenewalTimers.clear();

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    // Clear caches
    this.projectStateCache.clear();
    this.workItemCache.clear();

    // Clear pending updates
    this.pendingUpdates = [];

    // Clear persistence layer
    this.persistenceLayer.clear();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clear();
    this.persistenceLayer.stopPeriodicSync();
  }
}
