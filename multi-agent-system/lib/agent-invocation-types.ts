/**
 * Agent Invocation Types
 *
 * Defines the enhanced API for spawning and managing sub-agents with role-based capabilities,
 * hierarchical delegation, shared context injection, and message callbacks.
 */

import { AgentRole } from './agent-definition-schema';
import { AgentMessage } from './types';

/**
 * Callback invoked when a spawned agent sends a message
 */
export type OnMessageCallback = (message: AgentMessage) => Promise<void> | void;

/**
 * Callback invoked when a spawned agent completes its work
 */
export type OnCompleteCallback = (result: AgentCompletionResult) => Promise<void> | void;

/**
 * Callback invoked when a spawned agent escalates an issue
 */
export type OnEscalateCallback = (escalation: AgentEscalation) => Promise<void> | void;

/**
 * Result returned when an agent completes its work
 */
export interface AgentCompletionResult {
  agentId: string;
  role: AgentRole;
  success: boolean;
  result?: unknown;
  artifacts?: string[]; // Files created/modified
  metrics?: {
    duration: number; // milliseconds
    messagesProcessed: number;
    tasksCompleted: number;
  };
  error?: string;
  timestamp: Date;
}

/**
 * Escalation raised by an agent
 */
export interface AgentEscalation {
  agentId: string;
  role: AgentRole;
  reason: string;
  context: unknown;
  attemptedSolutions?: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

/**
 * Shared context passed to spawned agents
 */
export interface SharedContext {
  projectState?: unknown;
  workItems?: unknown;
  decisions?: unknown;
  conventions?: unknown;
  [key: string]: unknown;
}

/**
 * Parameters for invoking a sub-agent
 */
export interface InvokeSubAgentParams {
  /**
   * Role of the agent to spawn (e.g., 'developer', 'qa-engineer')
   */
  role: AgentRole;

  /**
   * ID of the parent agent (for hierarchical delegation)
   */
  parentAgent?: string;

  /**
   * List of agent IDs this agent can communicate with
   * If not specified, uses default permissions from role definition
   */
  canCommunicateWith?: string[];

  /**
   * Shared context to inject into the spawned agent
   * Allows agent to read/write shared state
   */
  sharedContext?: SharedContext;

  /**
   * Initial task or instruction for the agent
   */
  task?: string;

  /**
   * Callback invoked when the agent sends a message
   */
  onMessage?: OnMessageCallback;

  /**
   * Callback invoked when the agent completes its work
   */
  onComplete?: OnCompleteCallback;

  /**
   * Callback invoked when the agent escalates an issue
   */
  onEscalate?: OnEscalateCallback;

  /**
   * Maximum time (in milliseconds) the agent can run before timeout
   * Default: no timeout
   */
  timeout?: number;

  /**
   * Custom agent ID (if not specified, one will be generated)
   */
  agentId?: string;
}

/**
 * Result of invoking a sub-agent
 */
export interface InvokeSubAgentResult {
  /**
   * ID of the spawned agent
   */
  agentId: string;

  /**
   * Role of the spawned agent
   */
  role: AgentRole;

  /**
   * Whether the agent was successfully spawned
   */
  success: boolean;

  /**
   * Error message if spawn failed
   */
  error?: string;

  /**
   * Timestamp when agent was spawned
   */
  spawnedAt: Date;
}

/**
 * Internal state tracking for spawned agents
 */
export interface SpawnedAgentState {
  agentId: string;
  role: AgentRole;
  parentAgent?: string;
  canCommunicateWith: string[];
  sharedContext?: SharedContext;
  callbacks: {
    onMessage?: OnMessageCallback;
    onComplete?: OnCompleteCallback;
    onEscalate?: OnEscalateCallback;
  };
  timeout?: number;
  timeoutHandle?: NodeJS.Timeout;
  spawnedAt: Date;
  completedAt?: Date;
  status: 'spawning' | 'active' | 'completed' | 'failed' | 'timeout';
}

/**
 * Enhanced parameters for invoking a sub-agent with full capabilities
 */
export interface EnhancedInvocationParams {
  /** The role of the agent to spawn */
  role: AgentRole;

  /** The task or prompt for the agent */
  prompt: string;

  /** ID of the parent agent (for hierarchical delegation) */
  parentAgentId?: string;

  /** List of agent IDs this agent can communicate with */
  canCommunicateWith?: string[];

  /** Shared context manager for state access */
  sharedContext?: any;

  /** Callback for incoming messages */
  onMessage?: (message: AgentMessage) => void | Promise<void>;

  /** Callback when agent completes work */
  onComplete?: (result: AgentInvocationResult) => void | Promise<void>;

  /** Callback when agent escalates */
  onEscalate?: (escalation: AgentEscalation) => void | Promise<void>;

  /** Additional context to pass to the agent */
  context?: Record<string, any>;

  /** Timeout in milliseconds (default: no timeout) */
  timeout?: number;
}

/**
 * Result of agent invocation
 */
export interface AgentInvocationResult {
  /** ID of the agent that completed */
  agentId: string;

  /** Role of the agent */
  role: AgentRole;

  /** Whether the task was completed successfully */
  success: boolean;

  /** Result data from the agent */
  result?: any;

  /** Error message if failed */
  error?: string;

  /** Artifacts produced (files created/modified) */
  artifacts?: string[];

  /** Metrics about the execution */
  metrics?: {
    timeSpent: number;
    messagesExchanged: number;
    escalations: number;
  };

  /** Timestamp when completed */
  completedAt: Date;
}

/**
 * Configuration for agent spawning
 */
export interface AgentSpawnConfig {
  /** Agent ID (generated if not provided) */
  agentId?: string;

  /** Role of the agent */
  role: AgentRole;

  /** Parent agent ID */
  parentAgentId?: string;

  /** System prompt path */
  systemPromptPath: string;

  /** Capabilities */
  capabilities: string[];

  /** Tool permissions */
  toolPermissions: string[];

  /** File access patterns */
  fileAccessPatterns?: string[];

  /** Communication permissions */
  canCommunicateWith: string[];

  /** Shared context manager */
  sharedContext?: any;
}

/**
 * Active agent session
 */
export interface AgentSession {
  /** Agent ID */
  agentId: string;

  /** Role */
  role: AgentRole;

  /** Parent agent ID */
  parentAgentId?: string;

  /** Start time */
  startedAt: Date;

  /** Current status */
  status: 'active' | 'idle' | 'blocked' | 'completed' | 'failed';

  /** Message callbacks */
  callbacks: {
    onMessage?: (message: AgentMessage) => void | Promise<void>;
    onComplete?: (result: AgentInvocationResult) => void | Promise<void>;
    onEscalate?: (escalation: AgentEscalation) => void | Promise<void>;
  };

  /** Metrics */
  metrics: {
    messagesReceived: number;
    messagesSent: number;
    escalations: number;
  };

  /** Timeout handle */
  timeoutHandle?: NodeJS.Timeout;
}
