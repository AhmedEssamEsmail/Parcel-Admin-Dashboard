import { AgentRole, type AgentDefinition } from './agent-definition-schema';
import { agentDefinitionLoader } from './agent-definition-loader';

/**
 * Agent Registry
 *
 * Manages agent instances, tracks their status, and enforces capability-based authorization.
 */

export type AgentStatus = 'idle' | 'busy' | 'blocked' | 'offline';

export interface Agent {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  currentTask?: string;
  capabilities: string[];
  canRequestHelpFrom: AgentRole[];
  workload: number;
  lastActivity: Date;
  createdAt: Date;
}

interface UnauthorizedAttempt {
  agentId: string;
  action: string;
  timestamp: Date;
  reason: string;
}

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private definitions: Map<AgentRole, AgentDefinition> = new Map();
  private unauthorizedAttempts: UnauthorizedAttempt[] = [];
  private initialized = false;

  /**
   * Initialize the registry by loading agent definitions
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.definitions = await agentDefinitionLoader.loadAllDefinitions();
    this.initialized = true;
  }

  /**
   * Ensure the registry is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AgentRegistry not initialized. Call initialize() first.');
    }
  }

  /**
   * Register a new agent
   */
  registerAgent(agent: Omit<Agent, 'createdAt' | 'lastActivity'>): Agent {
    this.ensureInitialized();

    // Validate role exists
    const definition = this.definitions.get(agent.role);
    if (!definition) {
      throw new Error(`Unknown agent role: ${agent.role}`);
    }

    // Check if agent already exists
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with id ${agent.id} already registered`);
    }

    // Create full agent object
    const fullAgent: Agent = {
      ...agent,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.agents.set(agent.id, fullAgent);
    return fullAgent;
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    this.ensureInitialized();
    return this.agents.get(agentId);
  }

  /**
   * Get all agents with a specific role
   */
  getAgentsByRole(role: AgentRole): Agent[] {
    this.ensureInitialized();
    return Array.from(this.agents.values()).filter((agent) => agent.role === role);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    this.ensureInitialized();
    return Array.from(this.agents.values());
  }

  /**
   * Get agent definition for a role
   */
  getDefinition(role: AgentRole): AgentDefinition | undefined {
    this.ensureInitialized();
    return this.definitions.get(role);
  }

  /**
   * Update agent status
   */
  updateStatus(agentId: string, status: AgentStatus, currentTask?: string): void {
    this.ensureInitialized();

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.status = status;
    agent.lastActivity = new Date();

    if (currentTask !== undefined) {
      agent.currentTask = currentTask;
    }

    // Clear current task if agent becomes idle
    if (status === 'idle') {
      agent.currentTask = undefined;
      agent.workload = 0;
    }
  }

  /**
   * Update agent workload
   */
  updateWorkload(agentId: string, workload: number): void {
    this.ensureInitialized();

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.workload = workload;
    agent.lastActivity = new Date();
  }

  /**
   * Check if an agent can perform a specific action based on capabilities
   */
  canPerformAction(agentId: string, action: string): boolean {
    this.ensureInitialized();

    const agent = this.agents.get(agentId);
    if (!agent) {
      this.logUnauthorizedAttempt(agentId, action, 'Agent not found');
      return false;
    }

    // Check if agent has the required capability
    const hasCapability = agent.capabilities.includes(action);

    if (!hasCapability) {
      this.logUnauthorizedAttempt(
        agentId,
        action,
        `Agent ${agent.role} does not have capability: ${action}`
      );
    }

    return hasCapability;
  }

  /**
   * Check if an agent can request help from another role
   */
  canRequestHelpFrom(agentId: string, targetRole: AgentRole): boolean {
    this.ensureInitialized();

    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    return agent.canRequestHelpFrom.includes(targetRole);
  }

  /**
   * Log an unauthorized action attempt
   */
  private logUnauthorizedAttempt(agentId: string, action: string, reason: string): void {
    const attempt: UnauthorizedAttempt = {
      agentId,
      action,
      timestamp: new Date(),
      reason,
    };

    this.unauthorizedAttempts.push(attempt);

    // Log to console for visibility
    console.warn(
      `[AgentRegistry] Unauthorized attempt: Agent ${agentId} tried to perform ${action}. Reason: ${reason}`
    );

    // Keep only last 1000 attempts to prevent memory issues
    if (this.unauthorizedAttempts.length > 1000) {
      this.unauthorizedAttempts = this.unauthorizedAttempts.slice(-1000);
    }
  }

  /**
   * Get unauthorized attempts (for auditing)
   */
  getUnauthorizedAttempts(agentId?: string): UnauthorizedAttempt[] {
    if (agentId) {
      return this.unauthorizedAttempts.filter((attempt) => attempt.agentId === agentId);
    }
    return [...this.unauthorizedAttempts];
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): boolean {
    this.ensureInitialized();
    return this.agents.delete(agentId);
  }

  /**
   * Get agents by status
   */
  getAgentsByStatus(status: AgentStatus): Agent[] {
    this.ensureInitialized();
    return Array.from(this.agents.values()).filter((agent) => agent.status === status);
  }

  /**
   * Get idle agents with a specific role
   */
  getIdleAgentsByRole(role: AgentRole): Agent[] {
    this.ensureInitialized();
    return Array.from(this.agents.values()).filter(
      (agent) => agent.role === role && agent.status === 'idle'
    );
  }

  /**
   * Get least busy agent with a specific role
   */
  getLeastBusyAgent(role: AgentRole): Agent | undefined {
    this.ensureInitialized();

    const agentsWithRole = this.getAgentsByRole(role).filter((agent) => agent.status !== 'offline');

    if (agentsWithRole.length === 0) {
      return undefined;
    }

    // Sort by workload (ascending) and return the first one
    return agentsWithRole.sort((a, b) => a.workload - b.workload)[0];
  }

  /**
   * Clear all agents (for testing)
   */
  clear(): void {
    this.agents.clear();
    this.unauthorizedAttempts = [];
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAgents: number;
    byRole: Record<string, number>;
    byStatus: Record<AgentStatus, number>;
    unauthorizedAttempts: number;
  } {
    this.ensureInitialized();

    const byRole: Record<string, number> = {};
    const byStatus: Record<AgentStatus, number> = {
      idle: 0,
      busy: 0,
      blocked: 0,
      offline: 0,
    };

    for (const agent of this.agents.values()) {
      byRole[agent.role] = (byRole[agent.role] || 0) + 1;
      byStatus[agent.status]++;
    }

    return {
      totalAgents: this.agents.size,
      byRole,
      byStatus,
      unauthorizedAttempts: this.unauthorizedAttempts.length,
    };
  }
}

// Export singleton instance
export const agentRegistry = new AgentRegistry();
