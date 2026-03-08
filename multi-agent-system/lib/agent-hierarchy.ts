/**
 * Agent Hierarchy - Tracks parent-child relationships between agents
 *
 * This module manages the hierarchical structure of spawned agents, enabling:
 * - Parent-child relationship tracking
 * - Escalation routing to parent agents
 * - Cascade termination when parent agents end
 * - Hierarchy visualization and statistics
 */

import { MessageBus } from './message-bus';

/**
 * Represents a node in the agent hierarchy tree
 */
export interface HierarchyNode {
  agentId: string;
  parentId: string | null;
  children: string[];
  depth: number;
}

/**
 * Complete hierarchy tree structure
 */
export interface HierarchyTree {
  roots: string[];
  nodes: Map<string, HierarchyNode>;
  totalAgents: number;
  maxDepth: number;
  avgChildren: number;
}

/**
 * Hierarchy statistics
 */
export interface HierarchyStats {
  totalAgents: number;
  rootAgents: number;
  maxDepth: number;
  avgChildren: number;
}

/**
 * AgentHierarchy manages parent-child relationships between agents
 */
export class AgentHierarchy {
  // Map from agent ID to parent ID (null for root agents)
  private parentMap: Map<string, string | null> = new Map();

  // Map from parent ID to array of child IDs
  private childrenMap: Map<string, string[]> = new Map();

  // MessageBus for escalation routing
  private messageBus: MessageBus;

  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
  }

  /**
   * Record a parent-child relationship when an agent spawns another
   * @param childId - ID of the spawned child agent
   * @param parentId - ID of the parent agent (null for root agents)
   */
  recordRelationship(childId: string, parentId: string | null): void {
    // Record parent relationship
    this.parentMap.set(childId, parentId);

    // Record child relationship
    if (parentId !== null) {
      const children = this.childrenMap.get(parentId) || [];
      if (!children.includes(childId)) {
        children.push(childId);
        this.childrenMap.set(parentId, children);
      }
    }

    console.log(
      `[AgentHierarchy] Recorded relationship: ${childId} -> parent: ${parentId || 'ROOT'}`
    );
  }

  /**
   * Get all child agent IDs for a given parent agent
   * @param agentId - ID of the parent agent
   * @returns Array of child agent IDs
   */
  getChildAgents(agentId: string): string[] {
    return this.childrenMap.get(agentId) || [];
  }

  /**
   * Get the parent agent ID for a given agent
   * @param agentId - ID of the agent
   * @returns Parent agent ID or null if root agent
   */
  getParentAgent(agentId: string): string | null {
    return this.parentMap.get(agentId) ?? null;
  }

  /**
   * Route an escalation message to the parent agent
   * @param fromAgentId - ID of the agent escalating
   * @param message - Escalation message content
   * @returns true if escalation was routed, false if no parent exists
   */
  routeEscalation(fromAgentId: string, message: string): boolean {
    const parentId = this.getParentAgent(fromAgentId);

    if (parentId === null) {
      console.warn(
        `[AgentHierarchy] Cannot escalate from ${fromAgentId}: no parent agent (root agent)`
      );
      return false;
    }

    // Send escalation message to parent via MessageBus
    this.messageBus.send({
      id: `escalation-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      from: fromAgentId,
      to: parentId,
      type: 'escalation',
      priority: 'high',
      payload: { message },
      timestamp: new Date(),
      acknowledged: false,
    });

    console.log(`[AgentHierarchy] Escalated from ${fromAgentId} to parent ${parentId}`);
    return true;
  }

  /**
   * Terminate an agent and all its descendants (cascade termination)
   * @param agentId - ID of the agent to terminate
   * @param onTerminate - Callback to execute for each terminated agent
   * @returns Array of all terminated agent IDs (including the root)
   */
  cascadeTerminate(agentId: string, onTerminate: (agentId: string) => void): string[] {
    const terminated: string[] = [];

    // Recursive helper function
    const terminateRecursive = (id: string): void => {
      // Get all children
      const children = this.getChildAgents(id);

      // Recursively terminate all children first
      for (const childId of children) {
        terminateRecursive(childId);
      }

      // Terminate this agent
      onTerminate(id);
      terminated.push(id);

      // Remove from hierarchy
      this.removeAgent(id);

      console.log(`[AgentHierarchy] Terminated agent ${id} (cascade)`);
    };

    terminateRecursive(agentId);

    console.log(
      `[AgentHierarchy] Cascade termination complete: ${terminated.length} agents terminated`
    );

    return terminated;
  }

  /**
   * Get the complete agent hierarchy tree
   * @returns Complete hierarchy tree structure
   */
  getAgentHierarchy(): HierarchyTree {
    const nodes = new Map<string, HierarchyNode>();
    const roots: string[] = [];

    // Build nodes map
    for (const [agentId, parentId] of this.parentMap.entries()) {
      const children = this.getChildAgents(agentId);
      const depth = this.calculateDepth(agentId);

      nodes.set(agentId, {
        agentId,
        parentId,
        children,
        depth,
      });

      // Track root agents
      if (parentId === null) {
        roots.push(agentId);
      }
    }

    // Calculate statistics
    const stats = this.getHierarchyStats();

    return {
      roots,
      nodes,
      totalAgents: stats.totalAgents,
      maxDepth: stats.maxDepth,
      avgChildren: stats.avgChildren,
    };
  }

  /**
   * Get hierarchy statistics
   * @returns Statistics about the agent hierarchy
   */
  getHierarchyStats(): HierarchyStats {
    const totalAgents = this.parentMap.size;
    const rootAgents = Array.from(this.parentMap.values()).filter((p) => p === null).length;

    // Calculate max depth
    let maxDepth = 0;
    for (const agentId of this.parentMap.keys()) {
      const depth = this.calculateDepth(agentId);
      maxDepth = Math.max(maxDepth, depth);
    }

    // Calculate average children per agent
    let totalChildren = 0;
    for (const children of this.childrenMap.values()) {
      totalChildren += children.length;
    }
    const avgChildren = totalAgents > 0 ? totalChildren / totalAgents : 0;

    return {
      totalAgents,
      rootAgents,
      maxDepth,
      avgChildren,
    };
  }

  /**
   * Remove an agent from the hierarchy (cleanup on session end)
   * @param agentId - ID of the agent to remove
   */
  removeAgent(agentId: string): void {
    const parentId = this.parentMap.get(agentId);

    // Remove from parent's children list
    if (parentId !== null && parentId !== undefined) {
      const siblings = this.childrenMap.get(parentId) || [];
      const filtered = siblings.filter((id) => id !== agentId);
      if (filtered.length > 0) {
        this.childrenMap.set(parentId, filtered);
      } else {
        this.childrenMap.delete(parentId);
      }
    }

    // Remove from parent map
    this.parentMap.delete(agentId);

    // Remove from children map (if it has children, they become orphaned)
    this.childrenMap.delete(agentId);

    console.log(`[AgentHierarchy] Removed agent ${agentId} from hierarchy`);
  }

  /**
   * Calculate the depth of an agent in the hierarchy
   * @param agentId - ID of the agent
   * @returns Depth (0 for root agents)
   */
  private calculateDepth(agentId: string): number {
    let depth = 0;
    let currentId: string | null = agentId;

    // Walk up the tree until we reach a root
    while (currentId !== null) {
      const parentId = this.parentMap.get(currentId);
      if (parentId === null || parentId === undefined) {
        break;
      }
      depth++;
      currentId = parentId;

      // Safety check to prevent infinite loops
      if (depth > 100) {
        console.error(`[AgentHierarchy] Circular reference detected for agent ${agentId}`);
        break;
      }
    }

    return depth;
  }

  /**
   * Clear all hierarchy data (for testing)
   */
  clear(): void {
    this.parentMap.clear();
    this.childrenMap.clear();
    console.log('[AgentHierarchy] Cleared all hierarchy data');
  }

  /**
   * Check if an agent exists in the hierarchy
   * @param agentId - ID of the agent
   * @returns true if agent exists in hierarchy
   */
  hasAgent(agentId: string): boolean {
    return this.parentMap.has(agentId);
  }

  /**
   * Get all agents in the hierarchy
   * @returns Array of all agent IDs
   */
  getAllAgents(): string[] {
    return Array.from(this.parentMap.keys());
  }

  /**
   * Get all root agents (agents with no parent)
   * @returns Array of root agent IDs
   */
  getRootAgents(): string[] {
    const roots: string[] = [];
    for (const [agentId, parentId] of this.parentMap.entries()) {
      if (parentId === null) {
        roots.push(agentId);
      }
    }
    return roots;
  }

  /**
   * Get all descendants of an agent (children, grandchildren, etc.)
   * @param agentId - ID of the agent
   * @returns Array of all descendant agent IDs
   */
  getDescendants(agentId: string): string[] {
    const descendants: string[] = [];

    const collectDescendants = (id: string): void => {
      const children = this.getChildAgents(id);
      for (const childId of children) {
        descendants.push(childId);
        collectDescendants(childId);
      }
    };

    collectDescendants(agentId);
    return descendants;
  }

  /**
   * Get all ancestors of an agent (parent, grandparent, etc.)
   * @param agentId - ID of the agent
   * @returns Array of all ancestor agent IDs (ordered from parent to root)
   */
  getAncestors(agentId: string): string[] {
    const ancestors: string[] = [];
    let currentId: string | null = agentId;

    while (currentId !== null) {
      const parentId = this.parentMap.get(currentId);
      if (parentId === null || parentId === undefined) {
        break;
      }
      ancestors.push(parentId);
      currentId = parentId;

      // Safety check
      if (ancestors.length > 100) {
        console.error(`[AgentHierarchy] Circular reference detected for agent ${agentId}`);
        break;
      }
    }

    return ancestors;
  }
}
