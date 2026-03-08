export enum AgentRole {
  TECH_LEAD = 'tech-lead',
  DEVELOPER = 'developer',
  QA_ENGINEER = 'qa-engineer',
  DEVOPS = 'devops',
  DATA_ARCHITECT = 'data-architect',
  UX_UI_DESIGNER = 'ux-ui-designer',
  SECURITY_ENGINEER = 'security-engineer',
  TECHNICAL_WRITER = 'technical-writer',
  PERFORMANCE_ENGINEER = 'performance-engineer',
}

export interface AgentDefinition {
  role: AgentRole;
  displayName: string;
  customAgentName: string;
  version: string;
  capabilities: string[];
  responsibilities: string[];
  canRequestHelpFrom: AgentRole[];
  mustNotifyOn: string[];
  systemPromptPath: string;
  toolPermissions: string[];
  fileAccessPatterns?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAgentDefinition(definition: unknown): ValidationResult {
  const errors: string[] = [];

  // Type guard: ensure definition is an object
  if (typeof definition !== 'object' || definition === null) {
    errors.push('Definition must be an object');
    return { valid: false, errors };
  }

  const def = definition as Record<string, unknown>;

  // Check required fields
  if (!def.role) errors.push('Missing required field: role');
  if (!def.displayName) errors.push('Missing required field: displayName');
  if (!def.customAgentName) errors.push('Missing required field: customAgentName');
  if (!def.version) errors.push('Missing required field: version');
  if (!def.capabilities) errors.push('Missing required field: capabilities');
  if (!def.responsibilities) errors.push('Missing required field: responsibilities');
  if (!def.canRequestHelpFrom) errors.push('Missing required field: canRequestHelpFrom');
  if (!def.mustNotifyOn) errors.push('Missing required field: mustNotifyOn');
  if (!def.systemPromptPath) errors.push('Missing required field: systemPromptPath');
  if (!def.toolPermissions) errors.push('Missing required field: toolPermissions');

  // Validate role
  if (def.role && !Object.values(AgentRole).includes(def.role as AgentRole)) {
    errors.push(`Invalid role: ${def.role}`);
  }

  // Validate version format (semver)
  if (def.version && typeof def.version === 'string' && !/^\d+\.\d+\.\d+$/.test(def.version)) {
    errors.push(`Invalid version format: ${def.version}. Must be semver (e.g., 1.0.0)`);
  }

  // Validate arrays are not empty
  if (Array.isArray(def.capabilities) && def.capabilities.length === 0) {
    errors.push('capabilities array cannot be empty');
  }
  if (Array.isArray(def.responsibilities) && def.responsibilities.length === 0) {
    errors.push('responsibilities array cannot be empty');
  }
  if (Array.isArray(def.toolPermissions) && def.toolPermissions.length === 0) {
    errors.push('toolPermissions array cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
