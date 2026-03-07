import { AgentRole } from './agent-definition-schema';

/**
 * Workflow rule definition
 * Rules define automated actions triggered by events
 */
export interface WorkflowRule {
  /** Unique identifier for the rule */
  id: string;

  /** Event type that triggers this rule */
  trigger: string;

  /** Optional condition function to evaluate before executing action */
  condition?: (context: WorkflowEventData) => boolean;

  /** Action to perform when rule is triggered */
  action: string;

  /** Target agent role to receive the action */
  target: AgentRole;

  /** Payload to send with the action */
  payload: unknown;

  /** Priority for rule execution (higher = more important) */
  priority: number;
}

/**
 * Workflow event data
 * Events trigger workflow rules
 */
export interface WorkflowEvent {
  /** Event type identifier */
  type: string;

  /** Agent ID that generated the event */
  source: string;

  /** Event-specific data */
  data: WorkflowEventData;

  /** When the event occurred */
  timestamp: Date;
}

/**
 * Event data payload
 */
export interface WorkflowEventData {
  /** Task ID if event is task-related */
  taskId?: string;

  /** Agent ID if event is agent-related */
  agentId?: string;

  /** Files affected by the event */
  files?: string[];

  /** Test results if event is test-related */
  testResults?: {
    passed: boolean;
    coverage?: number;
    failures?: string[];
  };

  /** Quality gate results if event is quality-related */
  qualityGateResults?: {
    passed: boolean;
    failedGates?: string[];
    details?: unknown;
  };

  /** Schema changes if event is database-related */
  schemaChanges?: {
    tables?: string[];
    migrations?: string[];
  };

  /** Blocker information if event is blocker-related */
  blocker?: {
    reason: string;
    attemptedSolutions?: string[];
    duration?: number;
  };

  /** Additional context */
  [key: string]: unknown;
}

/**
 * Task dependency information
 */
export interface TaskDependency {
  /** Task ID */
  taskId: string;

  /** IDs of tasks this task depends on */
  dependsOn: string[];

  /** Current status of the task */
  status: 'pending' | 'in-progress' | 'blocked' | 'complete';

  /** Agent assigned to this task */
  assignedTo?: string;
}

/**
 * Dependency graph for task management
 */
export interface DependencyGraph {
  /** Map of task ID to its dependencies */
  tasks: Map<string, TaskDependency>;

  /** Adjacency list for graph traversal */
  adjacencyList: Map<string, string[]>;
}
