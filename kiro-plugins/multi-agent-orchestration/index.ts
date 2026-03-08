/**
 * Kiro Multi-Agent Orchestration Plugin
 *
 * This plugin integrates the multi-agent orchestration infrastructure with Kiro's
 * agent lifecycle system. It provides:
 * - Infrastructure initialization on Kiro startup
 * - AgentContext injection for spawned agents
 * - Workflow and quality gate automation on agent completion
 * - Resource cleanup on agent failure
 *
 * The plugin can be enabled/disabled via the ENABLE_MULTI_AGENT_INFRASTRUCTURE
 * environment variable (default: enabled).
 */

import { KiroIntegration } from '../../multi-agent-system/lib/kiro-integration';
import { AgentContext } from '../../multi-agent-system/lib/agent-context';
import { AgentRole } from '../../multi-agent-system/lib/agent-definition-schema';

/**
 * Plugin configuration
 */
interface PluginConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Kiro Plugin Interface
 *
 * This interface defines the lifecycle hooks that Kiro calls during
 * agent execution.
 */
export interface KiroPlugin {
  name: string;
  version: string;
  description: string;
  onKiroStart(): Promise<void>;
  beforeAgentSpawn(
    agentId: string,
    role: string,
    config: Record<string, unknown>
  ): Promise<Record<string, unknown>>;
  afterAgentComplete(agentId: string, result: Record<string, unknown>): Promise<void>;
  onAgentFail(agentId: string, error: Error): Promise<void>;
}

/**
 * Multi-Agent Orchestration Plugin
 *
 * Implements the Kiro plugin interface to integrate the multi-agent
 * orchestration infrastructure with Kiro's agent system.
 */
class MultiAgentOrchestrationPlugin implements KiroPlugin {
  public readonly name = 'multi-agent-orchestration';
  public readonly version = '1.0.0';
  public readonly description =
    'Enables multi-agent orchestration with message passing, shared context, workflows, and quality gates';

  private kiroIntegration: KiroIntegration;
  private config: PluginConfig;

  constructor() {
    this.kiroIntegration = new KiroIntegration();
    this.config = this.loadConfig();
  }

  /**
   * Load plugin configuration from environment variables
   */
  private loadConfig(): PluginConfig {
    const enabled = process.env.ENABLE_MULTI_AGENT_INFRASTRUCTURE !== 'false';
    const logLevel = (process.env.MULTI_AGENT_LOG_LEVEL || 'info') as PluginConfig['logLevel'];

    return {
      enabled,
      logLevel,
    };
  }

  /**
   * Initialize infrastructure on Kiro startup
   *
   * This hook is called once when Kiro starts. It initializes the
   * InfrastructureManager and all its components.
   *
   * If the plugin is disabled via feature flag, this method does nothing.
   */
  async onKiroStart(): Promise<void> {
    if (!this.config.enabled) {
      this.log('info', 'Multi-agent infrastructure disabled via feature flag');
      return;
    }

    try {
      this.log('info', 'Initializing multi-agent infrastructure...');
      await this.kiroIntegration.initializeSession();
      this.log('info', 'Multi-agent infrastructure initialized successfully');
    } catch (error) {
      this.log(
        'error',
        `Failed to initialize multi-agent infrastructure: ${error instanceof Error ? error.message : String(error)}`
      );

      // Don't crash Kiro if infrastructure fails to initialize
      // Log the error and continue without infrastructure
      this.log('warn', 'Continuing without multi-agent infrastructure');
      this.config.enabled = false;
    }
  }

  /**
   * Create and inject AgentContext before agent spawns
   *
   * This hook is called by Kiro before spawning a new agent. It creates
   * an AgentContext instance and injects it into the agent's configuration.
   *
   * If the plugin is disabled, this method returns the original config unchanged.
   *
   * @param agentId - Unique identifier for the agent
   * @param role - Role of the agent (developer, qa-engineer, etc.)
   * @param config - Original agent configuration
   * @returns Modified config with AgentContext injected
   */
  async beforeAgentSpawn(
    agentId: string,
    role: string,
    config: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!this.config.enabled) {
      return config;
    }

    try {
      // Validate and convert role to AgentRole enum
      const agentRole = this.parseAgentRole(role);

      // Extract parent ID from config if available
      const parentId = config?.parentId as string | undefined;

      // Create AgentContext via KiroIntegration
      const agentContext = await this.kiroIntegration.onAgentSpawn(agentId, agentRole, parentId);

      this.log('debug', `AgentContext created for agent ${agentId} (${role})`);

      // Inject AgentContext into agent configuration
      // The agent can access it via config.agentContext
      return {
        ...config,
        agentContext,
        // Also make it available as a global for backward compatibility
        _multiAgentContext: agentContext,
      };
    } catch (error) {
      this.log(
        'error',
        `Failed to create AgentContext for agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`
      );

      // Return original config if AgentContext creation fails
      // This ensures the agent can still run without infrastructure
      return config;
    }
  }

  /**
   * Trigger workflows and quality gates after agent completes
   *
   * This hook is called by Kiro when an agent completes its task. It triggers
   * workflow automation and runs quality gates if applicable.
   *
   * If the plugin is disabled, this method does nothing.
   *
   * @param agentId - ID of the agent that completed
   * @param result - Result data from the agent's execution
   */
  async afterAgentComplete(agentId: string, result: Record<string, unknown>): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      this.log('debug', `Agent ${agentId} completed, triggering workflows and quality gates`);
      await this.kiroIntegration.onAgentComplete(agentId, result);
      this.log('debug', `Workflows and quality gates completed for agent ${agentId}`);
    } catch (error) {
      this.log(
        'error',
        `Failed to handle agent completion for ${agentId}: ${error instanceof Error ? error.message : String(error)}`
      );

      // Don't throw error - we don't want to fail the agent's completion
      // just because workflow/quality gate processing failed
    }
  }

  /**
   * Handle agent failure and cleanup resources
   *
   * This hook is called by Kiro when an agent fails or crashes. It updates
   * agent status, releases file locks, and cleans up resources.
   *
   * If the plugin is disabled, this method does nothing.
   *
   * @param agentId - ID of the agent that failed
   * @param error - Error that caused the failure
   */
  async onAgentFail(agentId: string, error: Error): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      this.log('debug', `Agent ${agentId} failed, cleaning up resources`);
      await this.kiroIntegration.onAgentFail(agentId, error);
      this.log('debug', `Resources cleaned up for failed agent ${agentId}`);
    } catch (cleanupError) {
      this.log(
        'error',
        `Failed to cleanup resources for failed agent ${agentId}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`
      );

      // Don't throw error - we don't want to fail the failure handler
    }
  }

  /**
   * Get direct access to KiroIntegration (for testing)
   *
   * @returns KiroIntegration instance
   */
  getKiroIntegration(): KiroIntegration {
    return this.kiroIntegration;
  }

  /**
   * Check if plugin is enabled
   *
   * @returns True if plugin is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Log message with configured log level
   */
  private log(level: PluginConfig['logLevel'], message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [MultiAgentPlugin] [${level.toUpperCase()}]`;
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Parse role string to AgentRole enum
   *
   * @param role - Role string (e.g., "developer", "qa-engineer")
   * @returns AgentRole enum value
   * @throws Error if role is invalid
   */
  private parseAgentRole(role: string): AgentRole {
    // Convert kebab-case to SCREAMING_SNAKE_CASE
    const normalizedRole = role.toUpperCase().replace(/-/g, '_');

    // Check if role exists in AgentRole enum
    if (Object.values(AgentRole).includes(normalizedRole as AgentRole)) {
      return normalizedRole as AgentRole;
    }

    // Fallback: try to find a matching role
    const roleMap: Record<string, AgentRole> = {
      'tech-lead': AgentRole.TECH_LEAD,
      tech_lead: AgentRole.TECH_LEAD,
      developer: AgentRole.DEVELOPER,
      'qa-engineer': AgentRole.QA_ENGINEER,
      qa_engineer: AgentRole.QA_ENGINEER,
      qa: AgentRole.QA_ENGINEER,
      devops: AgentRole.DEVOPS,
      'data-architect': AgentRole.DATA_ARCHITECT,
      data_architect: AgentRole.DATA_ARCHITECT,
      'security-engineer': AgentRole.SECURITY_ENGINEER,
      security_engineer: AgentRole.SECURITY_ENGINEER,
      security: AgentRole.SECURITY_ENGINEER,
      'performance-engineer': AgentRole.PERFORMANCE_ENGINEER,
      performance_engineer: AgentRole.PERFORMANCE_ENGINEER,
      performance: AgentRole.PERFORMANCE_ENGINEER,
      'ux-ui-designer': AgentRole.UX_UI_DESIGNER,
      ux_ui_designer: AgentRole.UX_UI_DESIGNER,
      designer: AgentRole.UX_UI_DESIGNER,
      'technical-writer': AgentRole.TECHNICAL_WRITER,
      technical_writer: AgentRole.TECHNICAL_WRITER,
      writer: AgentRole.TECHNICAL_WRITER,
    };

    const mappedRole = roleMap[role.toLowerCase()];
    if (mappedRole) {
      return mappedRole;
    }

    throw new Error(`Invalid agent role: ${role}`);
  }
}

/**
 * Plugin instance (singleton)
 */
const plugin = new MultiAgentOrchestrationPlugin();

/**
 * Export plugin for Kiro to load
 */
export default plugin;

/**
 * Export types for external use
 */
export type { MultiAgentOrchestrationPlugin, PluginConfig, AgentContext };
