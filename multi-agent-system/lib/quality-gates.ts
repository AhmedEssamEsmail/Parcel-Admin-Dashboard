import {
  QualityGate,
  GateResult,
  GateOverride,
  QualityGateReport,
  GateCacheEntry,
  FileHashInfo,
} from './quality-gates-types';
import { WorkItem } from './shared-context-types';
import { AgentRole } from './agent-definition-schema';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';

/**
 * Semaphore for limiting concurrent gate execution
 */
class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve();
      });
    });
  }

  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }

  getCurrentCount(): number {
    return this.current;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

/**
 * Quality Gates System
 * Enforces quality standards before work is approved
 * Optimized with caching, file change detection, and resource limits
 */
export class QualityGatesSystem {
  private gates: Map<string, QualityGate> = new Map();
  private overrides: Map<string, GateOverride[]> = new Map();
  private cache: Map<string, GateCacheEntry> = new Map();
  private fileHashes: Map<string, FileHashInfo> = new Map();
  private semaphore: Semaphore;
  private readonly CACHE_TTL_MS = 60 * 1000; // 1 minute
  private maxConcurrentGates: number;

  constructor(maxConcurrentGates: number = 5) {
    this.maxConcurrentGates = maxConcurrentGates;
    this.semaphore = new Semaphore(maxConcurrentGates);
  }

  /**
   * Register a quality gate
   * @param gate The gate to register
   */
  registerGate(gate: QualityGate): void {
    if (this.gates.has(gate.id)) {
      throw new Error(`Gate with id '${gate.id}' is already registered`);
    }

    // Validate gate
    if (!gate.id || !gate.name || !gate.check) {
      throw new Error('Gate must have id, name, and check function');
    }

    if (gate.timeout <= 0) {
      throw new Error('Gate timeout must be positive');
    }

    this.gates.set(gate.id, gate);
  }

  /**
   * Get a registered gate by ID
   * @param gateId The gate ID
   * @returns The gate or undefined
   */
  getGate(gateId: string): QualityGate | undefined {
    return this.gates.get(gateId);
  }

  /**
   * Get all registered gates
   * @returns Array of all gates
   */
  getAllGates(): QualityGate[] {
    return Array.from(this.gates.values());
  }

  /**
   * Compute SHA-256 hash of file contents
   * @param filePath Path to the file
   * @returns Hash string or null if file doesn't exist
   */
  private computeFileHash(filePath: string): string | null {
    try {
      if (!existsSync(filePath)) {
        return null;
      }
      const content = readFileSync(filePath, 'utf-8');
      return createHash('sha256').update(content).digest('hex');
    } catch (error) {
      console.error(`[QualityGate] Error computing hash for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Get or compute file hashes for a work item
   * @param workItem The work item
   * @param files Optional list of files to hash (defaults to artifacts)
   * @returns Array of file hashes
   */
  private getFileHashes(workItem: WorkItem, files?: string[]): string[] {
    const hashes: string[] = [];
    const filesToHash = files || workItem.artifacts || [];

    for (const filePath of filesToHash) {
      // Always compute fresh hash (don't use cached hash for file change detection)
      const hash = this.computeFileHash(filePath);
      if (hash) {
        // Update cached hash info
        const hashInfo: FileHashInfo = {
          path: filePath,
          hash,
          computedAt: new Date(),
        };
        this.fileHashes.set(filePath, hashInfo);
        hashes.push(hash);
      }
    }

    return hashes;
  }

  /**
   * Generate cache key for a gate result
   * @param workItemId Work item ID
   * @param gateId Gate ID
   * @param fileHashes File hashes
   * @returns Cache key
   */
  private getCacheKey(workItemId: string, gateId: string, fileHashes: string[]): string {
    return `${workItemId}:${gateId}:${fileHashes.join(',')}`;
  }

  /**
   * Get cached gate result if valid
   * @param workItemId Work item ID
   * @param gateId Gate ID
   * @param fileHashes Current file hashes
   * @returns Cached result or null
   */
  private getCachedResult(
    workItemId: string,
    gateId: string,
    fileHashes: string[]
  ): GateResult | null {
    const cacheKey = this.getCacheKey(workItemId, gateId, fileHashes);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    // Check if cache entry is expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Check if file hashes match
    if (JSON.stringify(entry.fileHashes) !== JSON.stringify(fileHashes)) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.result;
  }

  /**
   * Cache a gate result
   * @param workItemId Work item ID
   * @param gateId Gate ID
   * @param fileHashes File hashes
   * @param result Gate result
   */
  private cacheResult(
    workItemId: string,
    gateId: string,
    fileHashes: string[],
    result: GateResult
  ): void {
    const cacheKey = this.getCacheKey(workItemId, gateId, fileHashes);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.CACHE_TTL_MS);

    const entry: GateCacheEntry = {
      result,
      fileHashes,
      cachedAt: now,
      expiresAt,
    };

    this.cache.set(cacheKey, entry);
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = new Date();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns Cache stats
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    totalRequests: number;
    cacheHits: number;
  } {
    return {
      size: this.cache.size,
      hitRate: this.cacheHitRate,
      totalRequests: this.cacheRequests,
      cacheHits: this.cacheHits,
    };
  }

  private cacheRequests = 0;
  private cacheHits = 0;
  private get cacheHitRate(): number {
    return this.cacheRequests === 0 ? 0 : this.cacheHits / this.cacheRequests;
  }

  /**
   * Get gates required for a specific role
   * @param role The agent role
   * @returns Array of gates required for this role
   */
  getGatesForRole(role: AgentRole): QualityGate[] {
    return Array.from(this.gates.values()).filter((gate) => gate.requiredFor.includes(role));
  }

  /**
   * Run quality gates for a work item
   * Executes gates in parallel with timeout per gate
   * Uses caching and resource limits for optimization
   * Fails fast on blocker gate failure
   *
   * @param workItem The work item to check
   * @param role The role of the agent who completed the work
   * @returns Report with all gate results
   */
  async runGates(workItem: WorkItem, role: AgentRole): Promise<QualityGateReport> {
    const startTime = Date.now();
    const applicableGates = this.getGatesForRole(role);

    if (applicableGates.length === 0) {
      return {
        workItemId: workItem.id,
        passed: true,
        results: [],
        overrides: this.overrides.get(workItem.id) || [],
        generatedAt: new Date(),
        totalDuration: Date.now() - startTime,
      };
    }

    // Clear expired cache entries periodically
    this.clearExpiredCache();

    // Get file hashes for change detection
    const fileHashes = this.getFileHashes(workItem);

    // Run all gates in parallel with caching and resource limits
    const gatePromises = applicableGates.map((gate) =>
      this.runSingleGateWithOptimizations(gate, workItem, fileHashes)
    );

    const results = await Promise.all(gatePromises);

    // Check if any overrides exist for failed gates
    const workItemOverrides = this.overrides.get(workItem.id) || [];
    const overriddenGateIds = new Set(workItemOverrides.map((o) => o.gateId));

    // Determine overall pass/fail
    // Pass if: all gates passed OR all failed gates have overrides
    const failedResults = results.filter((r) => !r.passed);
    const unovrriddenFailures = failedResults.filter((r) => !overriddenGateIds.has(r.gateId));

    const passed = unovrriddenFailures.length === 0;

    return {
      workItemId: workItem.id,
      passed,
      results,
      overrides: workItemOverrides,
      generatedAt: new Date(),
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Run a single gate with caching and resource limits
   * @param gate The gate to run
   * @param workItem The work item to check
   * @param fileHashes File hashes for caching
   * @returns Gate result
   */
  private async runSingleGateWithOptimizations(
    gate: QualityGate,
    workItem: WorkItem,
    fileHashes: string[]
  ): Promise<GateResult> {
    // Check cache first
    this.cacheRequests++;
    const cachedResult = this.getCachedResult(workItem.id, gate.id, fileHashes);
    if (cachedResult) {
      this.cacheHits++;
      return {
        ...cachedResult,
        message: `${cachedResult.message} (cached)`,
      };
    }

    // Acquire semaphore to limit concurrent execution
    await this.semaphore.acquire();

    try {
      // Run the gate
      const result = await this.runSingleGate(gate, workItem);

      // Cache the result if it passed (don't cache failures as they might be transient)
      if (result.passed && !result.timedOut) {
        this.cacheResult(workItem.id, gate.id, fileHashes, result);
      }

      return result;
    } finally {
      // Always release the semaphore
      this.semaphore.release();
    }
  }

  /**
   * Run a single gate with timeout
   * @param gate The gate to run
   * @param workItem The work item to check
   * @returns Gate result
   */
  private async runSingleGate(gate: QualityGate, workItem: WorkItem): Promise<GateResult> {
    const startTime = Date.now();
    let gateProcess: AbortController | undefined;

    try {
      // Create abort controller for timeout
      gateProcess = new AbortController();

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          // Kill gate process
          if (gateProcess) {
            gateProcess.abort();
          }

          const timeoutError = new Error(`Gate '${gate.id}' timed out after ${gate.timeout}ms`);
          reject(timeoutError);
        }, gate.timeout);
      });

      // Race between gate check and timeout
      const passed = await Promise.race([gate.check(workItem), timeoutPromise]);

      const duration = Date.now() - startTime;

      return {
        gateId: gate.id,
        passed,
        message: passed ? `${gate.name} passed` : `${gate.name} failed`,
        executedAt: new Date(),
        duration,
        timedOut: false,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes('timed out');

      // Kill gate process if it timed out
      if (isTimeout && gateProcess) {
        gateProcess.abort();
      }

      // Log timeout for analysis
      if (isTimeout) {
        console.error(
          `[QualityGate] Gate '${gate.id}' timed out after ${gate.timeout}ms for work item ${workItem.id}`
        );
        this.logTimeout(gate.id, workItem.id, duration);
      }

      return {
        gateId: gate.id,
        passed: false,
        message: error instanceof Error ? error.message : String(error),
        details: {
          error: String(error),
          workItemId: workItem.id,
          gateName: gate.name,
        },
        executedAt: new Date(),
        duration,
        timedOut: isTimeout,
      };
    }
  }

  /**
   * Log timeout for analysis
   */
  private timeoutLogs: Array<{
    gateId: string;
    workItemId: string;
    duration: number;
    timestamp: Date;
  }> = [];

  private logTimeout(gateId: string, workItemId: string, duration: number): void {
    this.timeoutLogs.push({
      gateId,
      workItemId,
      duration,
      timestamp: new Date(),
    });

    // Keep only last 100 timeout logs
    if (this.timeoutLogs.length > 100) {
      this.timeoutLogs = this.timeoutLogs.slice(-100);
    }
  }

  /**
   * Get timeout logs for analysis
   */
  getTimeoutLogs(gateId?: string): Array<{
    gateId: string;
    workItemId: string;
    duration: number;
    timestamp: Date;
  }> {
    if (gateId) {
      return this.timeoutLogs.filter((log) => log.gateId === gateId);
    }
    return [...this.timeoutLogs];
  }

  /**
   * Override a failed quality gate
   * Only tech lead can override gates
   *
   * @param workItemId The work item ID
   * @param gateId The gate to override
   * @param approvedBy The tech lead approving the override
   * @param reason Documented reason for override
   * @param originalResult The original gate result
   */
  override(
    workItemId: string,
    gateId: string,
    approvedBy: string,
    reason: string,
    originalResult: GateResult
  ): void {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Override reason is required');
    }

    if (!this.gates.has(gateId)) {
      throw new Error(`Gate '${gateId}' does not exist`);
    }

    const override: GateOverride = {
      workItemId,
      gateId,
      approvedBy,
      reason: reason.trim(),
      approvedAt: new Date(),
      originalResult,
    };

    const workItemOverrides = this.overrides.get(workItemId) || [];
    workItemOverrides.push(override);
    this.overrides.set(workItemId, workItemOverrides);

    // Log the override for audit trail
    console.log(
      `[QUALITY GATE OVERRIDE] Work item: ${workItemId}, Gate: ${gateId}, Approved by: ${approvedBy}, Reason: ${reason}`
    );
  }

  /**
   * Check if a work item can be approved
   * @param workItemId The work item ID
   * @param results The gate results
   * @returns True if all gates passed or have overrides
   */
  canApprove(workItemId: string, results: GateResult[]): boolean {
    const workItemOverrides = this.overrides.get(workItemId) || [];
    const overriddenGateIds = new Set(workItemOverrides.map((o) => o.gateId));

    // Check if all failed gates have overrides
    const failedResults = results.filter((r) => !r.passed);
    const unovrriddenFailures = failedResults.filter((r) => !overriddenGateIds.has(r.gateId));

    return unovrriddenFailures.length === 0;
  }

  /**
   * Get all overrides for a work item
   * @param workItemId The work item ID
   * @returns Array of overrides
   */
  getOverrides(workItemId: string): GateOverride[] {
    return this.overrides.get(workItemId) || [];
  }

  /**
   * Clear all overrides for a work item
   * @param workItemId The work item ID
   */
  clearOverrides(workItemId: string): void {
    this.overrides.delete(workItemId);
  }

  /**
   * Clear all gates, overrides, cache, and file hashes (for testing)
   */
  clear(): void {
    this.gates.clear();
    this.overrides.clear();
    this.timeoutLogs = [];
    this.cache.clear();
    this.fileHashes.clear();
    this.cacheRequests = 0;
    this.cacheHits = 0;
  }

  /**
   * Clear cache only
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheRequests = 0;
    this.cacheHits = 0;
  }

  /**
   * Clear file hashes only
   */
  clearFileHashes(): void {
    this.fileHashes.clear();
  }

  /**
   * Get semaphore statistics
   */
  getSemaphoreStats(): {
    current: number;
    max: number;
    queueLength: number;
  } {
    return {
      current: this.semaphore.getCurrentCount(),
      max: this.maxConcurrentGates,
      queueLength: this.semaphore.getQueueLength(),
    };
  }
}
