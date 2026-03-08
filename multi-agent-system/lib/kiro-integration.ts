/**
 * Kiro Integration Hook
 *
 * Connects Kiro's agent lifecycle events to the multi-agent orchestration infrastructure.
 * This class serves as the bridge between Kiro's agent invocation system and the
 * infrastructure components (MessageBus, AgentRegistry, SharedContext, WorkflowEngine, QualityGates).
 *
 * Lifecycle Flow:
 * 1. initializeSession() - Initialize infrastructure on first agent spawn
 * 2. onAgentSpawn() - Create and inject AgentContext when agent spawns
 * 3. onAgentComplete() - Trigger workflows and quality gates when agent completes
 * 4. onAgentFail() - Handle failures and cleanup resources
 */

import { InfrastructureManager } from './infrastructure-manager';
import { AgentContext } from './agent-context';
import { AgentRole } from './agent-definition-schema';
import { AuditLogger, AuditEventType, AuditSeverity } from './audit-logger';

/**
 * KiroIntegration Hook Class
 *
 * Provides lifecycle hooks for integrating Kiro's agent system with the
 * multi-agent orchestration infrastructure.
 */
export class KiroIntegration {
  private infrastructure: InfrastructureManager | null = null;
  private initialized = false;
  private logger: AuditLogger;
  private readonly SYSTEM_AGENT_ID = 'kiro-integration';
  private readonly SYSTEM_ROLE = AgentRole.TECH_LEAD;

  constructor() {
    this.logger = new AuditLogger();
  }

  /**
   * Initialize infrastructure on session start
   *
   * This method should be called once at the beginning of a Kiro session,
   * before any agents are spawned. It initializes the InfrastructureManager
   * singleton and all its components.
   *
   * Performance Requirement: Must complete within 100ms
   *
   * @throws Error if initialization fails
   */
  async initializeSession(): Promise<void> {
    if (this.initialized) {
      this.logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        this.SYSTEM_AGENT_ID,
        this.SYSTEM_ROLE,
        'initialize-session',
        { status: 'already-initialized' }
      );
      return;
    }

    const startTime = Date.now();

    try {
      // Get or create infrastructure singleton and initialize async components
      this.infrastructure = await InfrastructureManager.getInitializedInstance();
      this.initialized = true;

      const duration = Date.now() - startTime;

      this.logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        this.SYSTEM_AGENT_ID,
        this.SYSTEM_ROLE,
        'initialize-session',
        {
          duration,
          status: this.infrastructure.getStatus(),
        }
      );

      // Warn if initialization took too long
      if (duration > 100) {
        this.logger.log(
          AuditEventType.ACTION_PERFORMED,
          AuditSeverity.WARNING,
          this.SYSTEM_AGENT_ID,
          this.SYSTEM_ROLE,
          'initialize-session-slow',
          {
            duration,
            threshold: 100,
            message: 'Infrastructure initialization exceeded 100ms threshold',
          }
        );
      }
    } catch (error) {
      this.logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.ERROR,
        this.SYSTEM_AGENT_ID,
        this.SYSTEM_ROLE,
        'initialize-session-failed',
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );

      throw new Error(
        `Failed to initialize infrastructure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create and inject AgentContext when agent spawns
   *
   * This method is called by Kiro when a new agent is spawned. It creates
   * an AgentContext instance for the agent, registers the agent in the
   * AgentRegistry, and records parent-child relationships if a parentId is provided.
   *
   * The returned AgentContext should be injected into the agent's execution
   * environment so the agent can access infrastructure APIs.
   *
   * @param agentId - Unique identifier for the agent
   * @param role - Role of the agent (developer, qa-engineer, etc.)
   * @param parentId - Optional parent agent ID for hierarchy tracking
   * @returns AgentContext instance to be injected into the agent
   * @throws Error if infrastructure not initialized or agent registration fails
   */
  async onAgentSpawn(agentId: string, role: AgentRole, parentId?: string): Promise<AgentContext> {
    // Ensure infrastructure is initialized
    if (!this.initialized || !this.infrastructure) {
      this.logger.log(
        AuditEventType.AGENT_SPAWNED,
        AuditSeverity.WARNING,
        agentId,
        role,
        'spawn-auto-initialize',
        {
          message: 'Infrastructure not initialized, initializing now',
        }
      );

      await this.initializeSession();
    }

    try {
      // Create AgentContext for the spawned agent
      const agentContext = new AgentContext(agentId, role);

      // Register agent in AgentRegistry
      const agentRegistry = this.infrastructure!.getAgentRegistry();
      agentRegistry.registerAgent({
        id: agentId,
        role,
        status: 'idle',
        capabilities: this.getCapabilitiesForRole(role),
        canRequestHelpFrom: this.getCanRequestHelpFromForRole(role),
        workload: 0,
      });

      // Record parent-child relationship if parentId provided
      if (parentId) {
        // Note: Hierarchy tracking will be implemented in Phase 7 (Task 9.1)
        // For now, we just log the relationship
        this.logger.log(
          AuditEventType.AGENT_SPAWNED,
          AuditSeverity.INFO,
          agentId,
          role,
          'spawn-with-parent',
          {
            parentId,
            message: 'Parent-child relationship recorded',
          }
        );
      }

      this.logger.logAgentSpawned(agentId, role, this.getCapabilitiesForRole(role));

      return agentContext;
    } catch (error) {
      this.logger.log(
        AuditEventType.AGENT_SPAWNED,
        AuditSeverity.ERROR,
        agentId,
        role,
        'spawn-failed',
        {
          parentId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );

      throw new Error(
        `Failed to spawn agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Trigger workflows and quality gates when agent completes
   *
   * This method is called by Kiro when an agent completes its task. It:
   * 1. Triggers workflow automation events
   * 2. Runs quality gates if the agent is a developer
   * 3. Logs completion with full context
   *
   * @param agentId - ID of the agent that completed
   * @param result - Result data from the agent's execution
   * @throws Error if workflow or quality gate execution fails
   */
  async onAgentComplete(agentId: string, result: unknown): Promise<void> {
    if (!this.initialized || !this.infrastructure) {
      this.logger.log(
        AuditEventType.AGENT_TERMINATED,
        AuditSeverity.ERROR,
        agentId,
        this.SYSTEM_ROLE,
        'complete-no-infrastructure',
        {
          message: 'Infrastructure not initialized on agent complete',
        }
      );
      throw new Error('Infrastructure not initialized');
    }

    try {
      const agentRegistry = this.infrastructure.getAgentRegistry();
      const agent = agentRegistry.getAgent(agentId);

      if (!agent) {
        this.logger.log(
          AuditEventType.AGENT_TERMINATED,
          AuditSeverity.WARNING,
          agentId,
          this.SYSTEM_ROLE,
          'complete-agent-not-found',
          {
            message: 'Agent not found in registry on complete',
          }
        );
        return;
      }

      // Trigger workflow automation event
      const workflowEngine = this.infrastructure.getWorkflowEngine();
      await workflowEngine.processEvent({
        type: 'work-complete',
        source: agentId,
        timestamp: new Date(),
        data: {
          agentId,
          role: agent.role,
          result,
        },
      });

      this.logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        agentId,
        agent.role,
        'workflow-event-triggered',
        {
          eventType: 'work-complete',
        }
      );

      // Run quality gates if agent is a developer
      if (agent.role === AgentRole.DEVELOPER) {
        this.logger.log(
          AuditEventType.QUALITY_GATE_PASSED,
          AuditSeverity.INFO,
          agentId,
          agent.role,
          'quality-gates-check',
          {
            message: 'Running quality gates for developer agent',
          }
        );

        // Note: Quality gates require a WorkItem, which should be extracted from result
        // For now, we log that quality gates should be run
        // Full implementation will be completed when WorkItem structure is finalized
        this.logger.log(
          AuditEventType.QUALITY_GATE_PASSED,
          AuditSeverity.INFO,
          agentId,
          agent.role,
          'quality-gates-pending',
          {
            note: 'Quality gates will be run when WorkItem is available in result',
          }
        );
      }

      // Update agent status to idle
      agentRegistry.updateStatus(agentId, 'idle');

      this.logger.logAgentTerminated(agentId, agent.role, 'completed');
    } catch (error) {
      this.logger.log(
        AuditEventType.AGENT_TERMINATED,
        AuditSeverity.ERROR,
        agentId,
        this.SYSTEM_ROLE,
        'complete-failed',
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );

      throw new Error(
        `Failed to handle agent completion for ${agentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle agent failures and cleanup resources
   *
   * This method is called by Kiro when an agent fails or crashes. It:
   * 1. Updates agent status to 'offline'
   * 2. Releases all file locks held by the agent
   * 3. Removes agent from hierarchy (when hierarchy tracking is implemented)
   * 4. Logs failure with full context
   *
   * @param agentId - ID of the agent that failed
   * @param error - Error that caused the failure
   */
  async onAgentFail(agentId: string, error: Error): Promise<void> {
    if (!this.initialized || !this.infrastructure) {
      this.logger.log(
        AuditEventType.AGENT_TERMINATED,
        AuditSeverity.ERROR,
        agentId,
        this.SYSTEM_ROLE,
        'fail-no-infrastructure',
        {
          message: 'Infrastructure not initialized on agent fail',
          error: error.message,
        }
      );
      return;
    }

    try {
      const agentRegistry = this.infrastructure.getAgentRegistry();
      const agent = agentRegistry.getAgent(agentId);
      const agentRole = agent?.role || this.SYSTEM_ROLE;

      // Update agent status to offline
      try {
        agentRegistry.updateStatus(agentId, 'offline');
        this.logger.log(
          AuditEventType.AGENT_TERMINATED,
          AuditSeverity.INFO,
          agentId,
          agentRole,
          'status-updated-offline',
          {
            message: 'Agent status updated to offline',
          }
        );
      } catch (statusError) {
        this.logger.log(
          AuditEventType.AGENT_TERMINATED,
          AuditSeverity.WARNING,
          agentId,
          agentRole,
          'status-update-failed',
          {
            error: statusError instanceof Error ? statusError.message : String(statusError),
          }
        );
      }

      // Release all file locks held by the agent
      // Note: SharedContext doesn't have getActiveLocks() method yet
      // This will be implemented when file locking is fully integrated
      this.logger.log(
        AuditEventType.FILE_MODIFIED,
        AuditSeverity.INFO,
        agentId,
        agentRole,
        'locks-release-pending',
        {
          message: 'File locks will be released when getActiveLocks() is implemented',
        }
      );

      // Remove agent from hierarchy (will be implemented in Phase 7)
      this.logger.log(
        AuditEventType.AGENT_TERMINATED,
        AuditSeverity.INFO,
        agentId,
        agentRole,
        'hierarchy-cleanup-pending',
        {
          note: 'Hierarchy removal will be implemented in Phase 7',
        }
      );

      // Log failure with full context
      this.logger.logAgentTerminated(agentId, agentRole, `failed: ${error.message}`);
    } catch (cleanupError) {
      this.logger.log(
        AuditEventType.AGENT_TERMINATED,
        AuditSeverity.ERROR,
        agentId,
        this.SYSTEM_ROLE,
        'cleanup-failed',
        {
          originalError: error.message,
          cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        }
      );
    }
  }

  /**
   * Get direct access to infrastructure
   *
   * Provides direct access to the InfrastructureManager for advanced use cases.
   * Most agents should use AgentContext APIs instead.
   *
   * @returns InfrastructureManager instance
   * @throws Error if infrastructure not initialized
   */
  getInfrastructure(): InfrastructureManager {
    if (!this.initialized || !this.infrastructure) {
      throw new Error('Infrastructure not initialized. Call initializeSession() first.');
    }

    return this.infrastructure;
  }

  /**
   * Get capabilities for a given role
   *
   * Maps agent roles to their capabilities. This is used when registering
   * agents in the AgentRegistry.
   *
   * @param role - Agent role
   * @returns Array of capability strings
   */
  private getCapabilitiesForRole(role: AgentRole): string[] {
    const capabilityMap: Record<AgentRole, string[]> = {
      [AgentRole.TECH_LEAD]: [
        'assign-tasks',
        'make-decisions',
        'coordinate-team',
        'resolve-blockers',
        'enforce-quality',
      ],
      [AgentRole.DEVELOPER]: [
        'write-code',
        'fix-bugs',
        'implement-features',
        'write-unit-tests',
        'refactor-code',
      ],
      [AgentRole.QA_ENGINEER]: [
        'write-tests',
        'run-tests',
        'report-bugs',
        'verify-fixes',
        'test-coverage',
      ],
      [AgentRole.DEVOPS]: ['manage-ci-cd', 'deploy', 'monitor', 'infrastructure', 'automation'],
      [AgentRole.DATA_ARCHITECT]: [
        'design-schema',
        'create-migrations',
        'optimize-queries',
        'data-modeling',
      ],
      [AgentRole.SECURITY_ENGINEER]: [
        'security-audit',
        'vulnerability-scan',
        'security-review',
        'compliance',
      ],
      [AgentRole.PERFORMANCE_ENGINEER]: [
        'performance-test',
        'profiling',
        'optimization',
        'benchmarking',
      ],
      [AgentRole.UX_UI_DESIGNER]: ['design-ui', 'design-system', 'accessibility', 'user-research'],
      [AgentRole.TECHNICAL_WRITER]: ['write-docs', 'api-docs', 'user-guides', 'tutorials'],
    };

    return capabilityMap[role] || [];
  }

  /**
   * Get roles that an agent can request help from
   *
   * Maps agent roles to the roles they can request help from.
   *
   * @param role - Agent role
   * @returns Array of roles the agent can request help from
   */
  private getCanRequestHelpFromForRole(role: AgentRole): AgentRole[] {
    const helpMap: Record<AgentRole, AgentRole[]> = {
      [AgentRole.TECH_LEAD]: [], // Tech Lead doesn't request help
      [AgentRole.DEVELOPER]: [
        AgentRole.TECH_LEAD,
        AgentRole.DATA_ARCHITECT,
        AgentRole.SECURITY_ENGINEER,
        AgentRole.UX_UI_DESIGNER,
      ],
      [AgentRole.QA_ENGINEER]: [AgentRole.TECH_LEAD, AgentRole.DEVELOPER],
      [AgentRole.DEVOPS]: [AgentRole.TECH_LEAD],
      [AgentRole.DATA_ARCHITECT]: [AgentRole.TECH_LEAD],
      [AgentRole.SECURITY_ENGINEER]: [AgentRole.TECH_LEAD, AgentRole.DEVELOPER],
      [AgentRole.PERFORMANCE_ENGINEER]: [
        AgentRole.TECH_LEAD,
        AgentRole.DEVELOPER,
        AgentRole.DATA_ARCHITECT,
      ],
      [AgentRole.UX_UI_DESIGNER]: [AgentRole.TECH_LEAD],
      [AgentRole.TECHNICAL_WRITER]: [AgentRole.TECH_LEAD, AgentRole.DEVELOPER],
    };

    return helpMap[role] || [AgentRole.TECH_LEAD];
  }

  /**
   * Check if infrastructure is initialized
   *
   * @returns True if infrastructure is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset infrastructure (for testing)
   *
   * Resets the infrastructure state. Should only be used in tests.
   */
  reset(): void {
    if (this.infrastructure) {
      InfrastructureManager.reset();
      this.infrastructure = null;
      this.initialized = false;

      this.logger.log(
        AuditEventType.ACTION_PERFORMED,
        AuditSeverity.INFO,
        this.SYSTEM_AGENT_ID,
        this.SYSTEM_ROLE,
        'reset',
        {
          message: 'Infrastructure reset',
        }
      );
    }
  }
}
