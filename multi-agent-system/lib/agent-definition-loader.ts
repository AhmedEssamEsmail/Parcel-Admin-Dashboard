import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  AgentRole,
  type AgentDefinition,
  validateAgentDefinition,
} from './agent-definition-schema';
import { AGENT_DEFINITIONS } from './roles';

/**
 * Agent Definition Loader
 *
 * Loads agent definitions from .md files in .kiro/agents/ directory.
 * Provides caching and validation for agent definitions.
 */

interface LoaderCache {
  definitions: Map<AgentRole, AgentDefinition>;
  lastLoaded: Date;
}

export class AgentDefinitionLoader {
  private cache: LoaderCache | null = null;
  private readonly agentsDir: string;
  private readonly version = '1.0.0';

  constructor(agentsDir: string = '.kiro/agents') {
    this.agentsDir = agentsDir;
  }

  /**
   * Load a single agent definition by role name
   */
  async loadDefinition(role: AgentRole): Promise<AgentDefinition> {
    // Check cache first
    if (this.cache && this.cache.definitions.has(role)) {
      return this.cache.definitions.get(role)!;
    }

    // Load from static definitions
    const staticDef = AGENT_DEFINITIONS[role];
    if (!staticDef) {
      throw new Error(`Unknown agent role: ${role}`);
    }

    // Create full definition with version
    const definition: AgentDefinition = {
      ...staticDef,
      version: this.version,
    };

    // Validate the definition
    const validation = validateAgentDefinition(definition);
    if (!validation.valid) {
      throw new Error(`Invalid agent definition for ${role}: ${validation.errors.join(', ')}`);
    }

    // Verify system prompt file exists
    try {
      const promptPath = join(process.cwd(), definition.systemPromptPath);
      await readFile(promptPath, 'utf-8');
    } catch {
      throw new Error(`System prompt file not found for ${role}: ${definition.systemPromptPath}`);
    }

    return definition;
  }

  /**
   * Load all agent definitions
   */
  async loadAllDefinitions(): Promise<Map<AgentRole, AgentDefinition>> {
    // Return cached definitions if available
    if (this.cache) {
      return new Map(this.cache.definitions);
    }

    const definitions = new Map<AgentRole, AgentDefinition>();

    // Load all roles
    for (const role of Object.values(AgentRole)) {
      try {
        const definition = await this.loadDefinition(role);
        definitions.set(role, definition);
      } catch (err) {
        console.error(`Failed to load definition for ${role}:`, err);
        throw err;
      }
    }

    // Cache the loaded definitions
    this.cache = {
      definitions,
      lastLoaded: new Date(),
    };

    return new Map(definitions);
  }

  /**
   * Validate an agent definition
   */
  validateDefinition(definition: unknown): { valid: boolean; errors: string[] } {
    return validateAgentDefinition(definition);
  }

  /**
   * Reload all definitions (clears cache and reloads)
   */
  async reloadDefinitions(): Promise<Map<AgentRole, AgentDefinition>> {
    this.cache = null;
    return this.loadAllDefinitions();
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { cached: boolean; lastLoaded?: Date; count: number } {
    if (!this.cache) {
      return { cached: false, count: 0 };
    }

    return {
      cached: true,
      lastLoaded: this.cache.lastLoaded,
      count: this.cache.definitions.size,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache = null;
  }
}

// Export singleton instance
export const agentDefinitionLoader = new AgentDefinitionLoader();
