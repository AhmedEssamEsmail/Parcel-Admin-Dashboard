/**
 * Agent Context - Provides infrastructure APIs to agents
 *
 * This wrapper gives agents access to MessageBus, SharedContext, AgentRegistry,
 * and other infrastructure components in a controlled way.
 */

import { InfrastructureManager } from './infrastructure-manager';
import { AgentRole } from './agent-definition-schema';
import { AgentMessage } from './types';
import { ProjectState, WorkItem, KnowledgeItem } from './shared-context-types';
import { SharedContextManager } from './shared-context';
import { AgentRegistry, Agent } from './agent-registry';
import { WorkflowEventData } from './workflow-types';
import { QualityGateReport } from './quality-gates-types';

// Agent status type
export type AgentStatus = 'idle' | 'busy' | 'blocked' | 'offline';

export class AgentContext {
  private infrastructure: InfrastructureManager;

  constructor(
    private agentId: string,
    private role: AgentRole
  ) {
    this.infrastructure = InfrastructureManager.getInstance();
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Get agent role
   */
  getRole(): AgentRole {
    return this.role;
  }

  // ==================== MESSAGE API ====================

  /**
   * Send a message to another agent
   */
  async sendMessage(
    to: string,
    message: {
      type?: 'request' | 'response' | 'notification' | 'escalation';
      priority?: 'low' | 'normal' | 'high' | 'critical';
      payload: Record<string, unknown>;
      threadId?: string;
      parentMessageId?: string;
    }
  ): Promise<void> {
    await this.infrastructure.getMessageBus().send({
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      from: this.agentId,
      to,
      type: message.type || 'request',
      priority: message.priority || 'normal',
      payload: message.payload,
      timestamp: new Date(),
      acknowledged: false,
      threadId: message.threadId,
      parentMessageId: message.parentMessageId,
    });
  }

  /**
   * Subscribe to messages for this agent
   */
  onMessage(callback: (message: AgentMessage) => void | Promise<void>): void {
    this.infrastructure.getMessageBus().subscribe(this.agentId, callback);
  }

  /**
   * Get pending messages for this agent
   */
  async getMessages(): Promise<AgentMessage[]> {
    // In a real implementation, this would query the message bus
    // For now, return empty array (messages are delivered via subscription)
    return [];
  }

  /**
   * Acknowledge a message
   */
  async acknowledgeMessage(messageId: string): Promise<void> {
    // Message acknowledgment is handled automatically by the message bus
    // This method is kept for API compatibility
    console.log(`[Agent:${this.agentId}] Acknowledged message: ${messageId}`);
  }

  // ==================== SHARED CONTEXT API ====================

  /**
   * Get shared context manager
   */
  getSharedContext(): SharedContextManager {
    return this.infrastructure.getSharedContext();
  }

  /**
   * Get project state
   */
  getProjectState(): ProjectState {
    return this.infrastructure.getSharedContext().getProjectState();
  }

  /**
   * Update project state
   */
  updateProjectState(updates: Partial<ProjectState>): void {
    this.infrastructure.getSharedContext().updateProjectState(updates);
  }

  /**
   * Acquire a file lock
   */
  async acquireFileLock(file: string, mode: 'read' | 'write', timeout?: number): Promise<boolean> {
    return this.infrastructure
      .getSharedContext()
      .acquireFileLock(this.agentId, file, mode, timeout);
  }

  /**
   * Release a file lock
   */
  releaseFileLock(file: string): void {
    this.infrastructure.getSharedContext().releaseFileLock(this.agentId, file);
  }

  /**
   * Get work item
   */
  getWorkItem(workItemId: string): WorkItem | undefined {
    return this.infrastructure.getSharedContext().getWorkItem(workItemId);
  }

  /**
   * Update work item
   */
  updateWorkItem(workItemId: string, updates: Partial<WorkItem>): void {
    this.infrastructure.getSharedContext().updateWorkItem(workItemId, updates);
  }

  /**
   * Add decision to knowledge base
   */
  addDecision(decision: {
    title: string;
    description: string;
    rationale: string;
    alternatives?: string[];
    tags?: string[];
  }): void {
    this.infrastructure.getSharedContext().addDecision({
      id: `decision-${Date.now()}`,
      title: decision.title,
      context: decision.description,
      options: decision.alternatives || [],
      chosen: decision.title,
      rationale: decision.rationale,
      madeBy: this.agentId,
      madeAt: new Date(),
      tags: decision.tags || [],
    });
  }

  /**
   * Query knowledge base
   */
  queryKnowledgeBase(query: string): KnowledgeItem[] {
    return this.infrastructure.getSharedContext().queryKnowledgeBase(query);
  }

  // ==================== AGENT REGISTRY API ====================

  /**
   * Get agent registry
   */
  getAgentRegistry(): AgentRegistry {
    return this.infrastructure.getAgentRegistry();
  }

  /**
   * Update this agent's status
   */
  updateStatus(status: AgentStatus): void {
    this.infrastructure.getAgentRegistry().updateStatus(this.agentId, status);
  }

  /**
   * Get agents by role
   */
  getAgentsByRole(role: AgentRole): Agent[] {
    return this.infrastructure.getAgentRegistry().getAgentsByRole(role);
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.infrastructure.getAgentRegistry().getAgent(agentId);
  }

  /**
   * Check if agent can perform action
   */
  canPerformAction(action: string): boolean {
    return this.infrastructure.getAgentRegistry().canPerformAction(this.agentId, action);
  }

  // ==================== WORKFLOW API ====================

  /**
   * Trigger a workflow event
   */
  async triggerWorkflowEvent(event: { type: string; data?: WorkflowEventData }): Promise<void> {
    await this.infrastructure.getWorkflowEngine().processEvent({
      type: event.type,
      source: this.agentId,
      data: event.data || {},
      timestamp: new Date(),
    });
  }

  // ==================== QUALITY GATES API ====================

  /**
   * Run quality gates for a work item
   */
  async runQualityGates(workItemId: string): Promise<QualityGateReport> {
    const workItem = this.infrastructure.getSharedContext().getWorkItem(workItemId);
    if (!workItem) {
      throw new Error(`Work item not found: ${workItemId}`);
    }
    return this.infrastructure.getQualityGates().runGates(workItem, this.role);
  }

  // ==================== UTILITY API ====================

  /**
   * Log a message (for debugging)
   */
  log(message: string, data?: unknown): void {
    console.log(`[Agent:${this.agentId}] ${message}`, data || '');
  }

  /**
   * Get infrastructure status
   */
  getInfrastructureStatus(): Record<string, unknown> {
    return this.infrastructure.getStatus();
  }

  // ==================== HIERARCHY API ====================

  /**
   * Get child agents spawned by this agent
   */
  getChildAgents(): string[] {
    return this.infrastructure.getAgentHierarchy().getChildAgents(this.agentId);
  }

  /**
   * Get parent agent that spawned this agent
   */
  getParentAgent(): string | null {
    return this.infrastructure.getAgentHierarchy().getParentAgent(this.agentId);
  }

  /**
   * Escalate an issue to parent agent
   */
  escalateToParent(message: string): boolean {
    return this.infrastructure.getAgentHierarchy().routeEscalation(this.agentId, message);
  }

  /**
   * Get all descendants of this agent (children, grandchildren, etc.)
   */
  getDescendants(): string[] {
    return this.infrastructure.getAgentHierarchy().getDescendants(this.agentId);
  }

  /**
   * Get all ancestors of this agent (parent, grandparent, etc.)
   */
  getAncestors(): string[] {
    return this.infrastructure.getAgentHierarchy().getAncestors(this.agentId);
  }
}
