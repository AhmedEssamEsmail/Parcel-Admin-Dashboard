/**
 * Infrastructure Manager - Singleton that manages all multi-agent infrastructure
 *
 * This is the central point for accessing MessageBus, AgentRegistry, SharedContext,
 * WorkflowEngine, QualityGates, and AgentInvocationManager.
 */

import { MessageBus } from './message-bus';
import { AgentRegistry } from './agent-registry';
import { SharedContextManager } from './shared-context';
import { WorkflowEngine } from './workflow-engine';
import { QualityGatesSystem } from './quality-gates';
import { AgentInvocationManager } from './agent-invocation';
import { AgentDefinitionLoader } from './agent-definition-loader';
import { AgentHierarchy } from './agent-hierarchy';
import { getLogger } from './logger';

export class InfrastructureManager {
  private static instance: InfrastructureManager | null = null;
  private static initPromise: Promise<void> | null = null;

  private messageBus: MessageBus;
  private agentRegistry: AgentRegistry;
  private sharedContext: SharedContextManager;
  private workflowEngine: WorkflowEngine;
  private qualityGates: QualityGatesSystem;
  private invocationManager: AgentInvocationManager;
  private definitionLoader: AgentDefinitionLoader;
  private agentHierarchy: AgentHierarchy;
  private isInitialized = false;

  private constructor() {
    const logger = getLogger();
    const startTime = Date.now();
    logger.info('Infrastructure', 'Initializing multi-agent infrastructure...');

    try {
      // Initialize core components with error handling
      const mbStart = Date.now();
      this.messageBus = new MessageBus();
      logger.logInfrastructureInit('MessageBus', Date.now() - mbStart);

      const arStart = Date.now();
      this.agentRegistry = new AgentRegistry();
      logger.logInfrastructureInit('AgentRegistry', Date.now() - arStart);

      const scStart = Date.now();
      this.sharedContext = new SharedContextManager();
      logger.logInfrastructureInit('SharedContextManager', Date.now() - scStart);

      const dlStart = Date.now();
      this.definitionLoader = new AgentDefinitionLoader();
      logger.logInfrastructureInit('AgentDefinitionLoader', Date.now() - dlStart);

      const ahStart = Date.now();
      this.agentHierarchy = new AgentHierarchy(this.messageBus);
      logger.logInfrastructureInit('AgentHierarchy', Date.now() - ahStart);

      // Initialize coordination components
      const weStart = Date.now();
      this.workflowEngine = new WorkflowEngine(this.messageBus, this.agentRegistry);
      logger.logInfrastructureInit('WorkflowEngine', Date.now() - weStart);

      const qgStart = Date.now();
      this.qualityGates = new QualityGatesSystem();
      logger.logInfrastructureInit('QualityGatesSystem', Date.now() - qgStart);

      // BUG FIX #4: Initialize invocation manager with hierarchy manager
      const imStart = Date.now();
      this.invocationManager = new AgentInvocationManager(
        this.agentRegistry,
        this.definitionLoader,
        this.messageBus,
        this.sharedContext,
        this.agentHierarchy // Pass AgentHierarchy to AgentInvocationManager
      );
      logger.logInfrastructureInit('AgentInvocationManager', Date.now() - imStart);

      const totalTime = Date.now() - startTime;
      logger.logInfrastructureInit('Complete', totalTime, 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.logError('Infrastructure', 'CRITICAL: Infrastructure initialization failed', error, {
        timestamp: new Date().toISOString(),
        context: 'constructor',
      });

      // Re-throw with more context
      throw new Error(`Infrastructure initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Initialize async components (must be called after getInstance)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const logger = getLogger();
    try {
      // Initialize AgentRegistry (loads agent definitions)
      await this.agentRegistry.initialize();
      this.isInitialized = true;
      logger.info('Infrastructure', 'Async initialization complete');
    } catch (error) {
      logger.error('Infrastructure', 'Async initialization failed', error);
      throw error;
    }
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): InfrastructureManager {
    if (!InfrastructureManager.instance) {
      InfrastructureManager.instance = new InfrastructureManager();
    }
    return InfrastructureManager.instance;
  }

  /**
   * Get the singleton instance and ensure it's initialized
   */
  static async getInitializedInstance(): Promise<InfrastructureManager> {
    const instance = InfrastructureManager.getInstance();

    if (!InfrastructureManager.initPromise) {
      InfrastructureManager.initPromise = instance.initialize();
    }

    await InfrastructureManager.initPromise;
    return instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static reset(): void {
    if (InfrastructureManager.instance) {
      InfrastructureManager.instance.cleanup();
      InfrastructureManager.instance = null;
    }
  }

  /**
   * Get MessageBus instance
   */
  getMessageBus(): MessageBus {
    return this.messageBus;
  }

  /**
   * Get AgentRegistry instance
   */
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }

  /**
   * Get SharedContextManager instance
   */
  getSharedContext(): SharedContextManager {
    return this.sharedContext;
  }

  /**
   * Get WorkflowEngine instance
   */
  getWorkflowEngine(): WorkflowEngine {
    return this.workflowEngine;
  }

  /**
   * Get QualityGatesSystem instance
   */
  getQualityGates(): QualityGatesSystem {
    return this.qualityGates;
  }

  /**
   * Get AgentInvocationManager instance
   */
  getInvocationManager(): AgentInvocationManager {
    return this.invocationManager;
  }

  /**
   * Get AgentDefinitionLoader instance
   */
  getDefinitionLoader(): AgentDefinitionLoader {
    return this.definitionLoader;
  }

  /**
   * Get AgentHierarchy instance
   */
  getAgentHierarchy(): AgentHierarchy {
    return this.agentHierarchy;
  }

  /**
   * Get infrastructure status
   */
  getStatus(): {
    messageBus: { queueDepth: number; deadLetterQueueSize: number };
    agentRegistry: { totalAgents: number; activeAgents: number };
    sharedContext: { workItems: number; fileLocks: number };
    workflowEngine: { rulesRegistered: number };
    qualityGates: { gatesRegistered: number };
    agentHierarchy: {
      totalAgents: number;
      rootAgents: number;
      maxDepth: number;
      avgChildren: number;
    };
  } {
    // Calculate total file locks across all agents
    const allAgents = this.agentRegistry.getAllAgents();
    const totalFileLocks = allAgents.reduce((count, agent) => {
      return count + this.sharedContext.getAgentLocks(agent.id).length;
    }, 0);

    // Get hierarchy statistics
    const hierarchyStats = this.agentHierarchy.getHierarchyStats();

    return {
      messageBus: {
        queueDepth: this.messageBus.getQueueSize(),
        deadLetterQueueSize: this.messageBus.getDeadLetterQueue().length,
      },
      agentRegistry: {
        totalAgents: this.agentRegistry.getAllAgents().length,
        activeAgents: this.agentRegistry.getAllAgents().filter((a) => a.status !== 'offline')
          .length,
      },
      sharedContext: {
        workItems: this.sharedContext.getAllWorkItems().length,
        fileLocks: totalFileLocks,
      },
      workflowEngine: {
        rulesRegistered: this.workflowEngine.getRules().length,
      },
      qualityGates: {
        gatesRegistered: this.qualityGates.getAllGates().length,
      },
      agentHierarchy: {
        totalAgents: hierarchyStats.totalAgents,
        rootAgents: hierarchyStats.rootAgents,
        maxDepth: hierarchyStats.maxDepth,
        avgChildren: hierarchyStats.avgChildren,
      },
    };
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    const logger = getLogger();
    logger.info('Infrastructure', 'Cleaning up infrastructure...');

    // Clear agent registry
    const agents = this.agentRegistry.getAllAgents();
    for (const agent of agents) {
      this.agentRegistry.unregisterAgent(agent.id);
    }

    // Clear shared context
    this.sharedContext.clear();

    // Clear invocation manager
    this.invocationManager.clear();

    // Clear agent hierarchy
    this.agentHierarchy.clear();

    logger.info('Infrastructure', 'Cleanup complete');
  }
}
