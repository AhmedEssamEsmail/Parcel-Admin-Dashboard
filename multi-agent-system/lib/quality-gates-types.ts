import { WorkItem } from './shared-context-types';
import { AgentRole } from './agent-definition-schema';

/**
 * Quality gate definition
 * Defines a check that must pass before work can be approved
 */
export interface QualityGate {
  /** Unique identifier for the gate */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this gate checks */
  description: string;

  /** Function that performs the check */
  check: (workItem: WorkItem) => Promise<boolean>;

  /** Which agent roles must pass this gate */
  requiredFor: AgentRole[];

  /** If true, failure blocks approval (cannot be overridden easily) */
  blocker: boolean;

  /** Maximum time in milliseconds to wait for gate to complete */
  timeout: number;
}

/**
 * Result of running a quality gate
 */
export interface GateResult {
  /** ID of the gate that was run */
  gateId: string;

  /** Whether the gate passed */
  passed: boolean;

  /** Human-readable message about the result */
  message: string;

  /** Additional details about the result (errors, warnings, etc.) */
  details?: unknown;

  /** When the gate was executed */
  executedAt: Date;

  /** How long the gate took to execute (milliseconds) */
  duration?: number;

  /** If the gate timed out */
  timedOut?: boolean;
}

/**
 * Override record for a quality gate
 * Used when tech lead overrides a failed gate
 */
export interface GateOverride {
  /** ID of the work item */
  workItemId: string;

  /** ID of the gate that was overridden */
  gateId: string;

  /** Who approved the override (must be tech lead) */
  approvedBy: string;

  /** Documented reason for the override */
  reason: string;

  /** When the override was approved */
  approvedAt: Date;

  /** Original gate result that was overridden */
  originalResult: GateResult;
}

/**
 * Aggregate result of running all gates for a work item
 */
export interface QualityGateReport {
  /** ID of the work item */
  workItemId: string;

  /** Overall pass/fail status */
  passed: boolean;

  /** Individual gate results */
  results: GateResult[];

  /** Any overrides that were applied */
  overrides: GateOverride[];

  /** When the report was generated */
  generatedAt: Date;

  /** Total time taken to run all gates (milliseconds) */
  totalDuration: number;
}

/**
 * Cache entry for gate results
 */
export interface GateCacheEntry {
  /** The cached result */
  result: GateResult;

  /** File hashes at the time of caching */
  fileHashes: string[];

  /** When the cache entry was created */
  cachedAt: Date;

  /** When the cache entry expires */
  expiresAt: Date;
}

/**
 * File hash information for change detection
 */
export interface FileHashInfo {
  /** File path */
  path: string;

  /** SHA-256 hash of file contents */
  hash: string;

  /** When the hash was computed */
  computedAt: Date;
}
