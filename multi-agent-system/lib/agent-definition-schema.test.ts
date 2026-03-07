import { describe, it, expect } from 'vitest';
import {
  AgentRole,
  validateAgentDefinition,
  type AgentDefinition,
} from './agent-definition-schema';

describe('AgentDefinitionSchema', () => {
  const validDefinition: AgentDefinition = {
    role: AgentRole.DEVELOPER,
    displayName: 'Developer Agent',
    customAgentName: 'developer',
    version: '1.0.0',
    capabilities: ['write-code', 'fix-bugs'],
    responsibilities: ['code-quality', 'unit-tests'],
    canRequestHelpFrom: [AgentRole.TECH_LEAD],
    mustNotifyOn: ['feature-complete', 'blocked'],
    systemPromptPath: '.kiro/agents/developer.md',
    toolPermissions: ['read', 'write'],
  };

  describe('validateAgentDefinition', () => {
    it('should validate a correct agent definition', () => {
      const result = validateAgentDefinition(validDefinition);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when role is missing', () => {
      const invalid = { ...validDefinition, role: undefined };
      const result = validateAgentDefinition(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: role');
    });

    it('should fail when role is invalid', () => {
      const invalid = { ...validDefinition, role: 'invalid-role' };
      const result = validateAgentDefinition(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid role'))).toBe(true);
    });

    it('should fail when version format is invalid', () => {
      const invalid = { ...validDefinition, version: '1.0' };
      const result = validateAgentDefinition(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid version format'))).toBe(true);
    });

    it('should fail when capabilities array is empty', () => {
      const invalid = { ...validDefinition, capabilities: [] };
      const result = validateAgentDefinition(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('capabilities array cannot be empty');
    });

    it('should fail when multiple fields are missing', () => {
      const invalid = { role: AgentRole.DEVELOPER };
      const result = validateAgentDefinition(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
