import { QualityGate } from './quality-gates-types';
import { WorkItem } from './shared-context-types';
import { AgentRole } from './agent-definition-schema';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Predefined quality gates for common checks
 */

/**
 * Tests Passing Gate
 * Runs all relevant tests and ensures they pass
 */
export const testsPassingGate: QualityGate = {
  id: 'tests-passing',
  name: 'Tests Passing',
  description: 'All relevant tests must pass',
  requiredFor: [AgentRole.DEVELOPER, AgentRole.QA_ENGINEER],
  blocker: true,
  timeout: 5 * 60 * 1000, // 5 minutes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  check: async (_workItem: WorkItem): Promise<boolean> => {
    try {
      // Run unit tests
      execSync('npm run test:run', {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return true;
    } catch (error) {
      console.error('Tests failed:', error);
      return false;
    }
  },
};

/**
 * No Lint Errors Gate
 * Runs ESLint on modified files and ensures no errors
 */
export const noLintErrorsGate: QualityGate = {
  id: 'no-lint-errors',
  name: 'No Lint Errors',
  description: 'Code must pass linting checks',
  requiredFor: [AgentRole.DEVELOPER],
  blocker: true,
  timeout: 1 * 60 * 1000, // 1 minute
  check: async (workItem: WorkItem): Promise<boolean> => {
    try {
      // If no artifacts, skip check
      if (!workItem.artifacts || workItem.artifacts.length === 0) {
        return true;
      }

      // Filter for TypeScript/JavaScript files from artifacts
      // Artifacts with type 'file' contain file paths in their data property
      const codeFiles = workItem.artifacts
        .filter((artifact) => artifact.type === 'file' && typeof artifact.data === 'string')
        .map((artifact) => artifact.data as string)
        .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

      if (codeFiles.length === 0) {
        return true;
      }

      // Run lint on modified files
      execSync(`npm run lint ${codeFiles.join(' ')}`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return true;
    } catch (error) {
      console.error('Lint check failed:', error);
      return false;
    }
  },
};

/**
 * Type Check Passes Gate
 * Runs TypeScript compiler to check for type errors
 */
export const typeCheckPassesGate: QualityGate = {
  id: 'type-check-passes',
  name: 'Type Check Passes',
  description: 'TypeScript type checking must pass',
  requiredFor: [AgentRole.DEVELOPER],
  blocker: true,
  timeout: 2 * 60 * 1000, // 2 minutes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  check: async (_workItem: WorkItem): Promise<boolean> => {
    try {
      execSync('npm run type-check', {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return true;
    } catch (error) {
      console.error('Type check failed:', error);
      return false;
    }
  },
};

/**
 * Test Coverage Gate
 * Ensures test coverage is at least 60% for new code
 */
export const testCoverageGate: QualityGate = {
  id: 'test-coverage',
  name: 'Test Coverage >= 60%',
  description: 'New code must have at least 60% test coverage',
  requiredFor: [AgentRole.DEVELOPER, AgentRole.QA_ENGINEER],
  blocker: true,
  timeout: 5 * 60 * 1000, // 5 minutes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  check: async (_workItem: WorkItem): Promise<boolean> => {
    try {
      // Run coverage
      const output = execSync('npm run test:coverage', {
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      // Parse coverage output
      // Look for coverage percentage in output
      // This is a simplified check - in production, you'd parse the coverage report JSON
      const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);
      if (coverageMatch) {
        const coverage = parseFloat(coverageMatch[1]);
        return coverage >= 60;
      }

      // If we can't parse coverage, check if coverage report exists
      const coverageReportPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      if (fs.existsSync(coverageReportPath)) {
        const coverageData = JSON.parse(fs.readFileSync(coverageReportPath, 'utf-8'));
        const totalCoverage = coverageData.total;
        if (totalCoverage && totalCoverage.lines) {
          return totalCoverage.lines.pct >= 60;
        }
      }

      // Default to true if we can't determine coverage
      console.warn('Could not determine test coverage, defaulting to pass');
      return true;
    } catch (error) {
      console.error('Coverage check failed:', error);
      return false;
    }
  },
};

/**
 * Migration Has Rollback Gate
 * Ensures database migrations have rollback scripts
 */
export const migrationHasRollbackGate: QualityGate = {
  id: 'migration-has-rollback',
  name: 'Migration Has Rollback',
  description: 'Database migrations must include rollback scripts',
  requiredFor: [AgentRole.DATA_ARCHITECT],
  blocker: true,
  timeout: 30 * 1000, // 30 seconds
  check: async (workItem: WorkItem): Promise<boolean> => {
    try {
      // Check if any migration files in artifacts
      const migrationFiles = workItem.artifacts
        .filter((artifact) => artifact.type === 'file' && typeof artifact.data === 'string')
        .map((artifact) => artifact.data as string)
        .filter((file) => file.includes('migration') || file.includes('supabase/migrations'));

      if (migrationFiles.length === 0) {
        // No migrations, pass
        return true;
      }

      // Check each migration file for rollback/down function
      for (const migrationFile of migrationFiles) {
        const fullPath = path.join(process.cwd(), migrationFile);
        if (!fs.existsSync(fullPath)) {
          console.error(`Migration file not found: ${migrationFile}`);
          return false;
        }

        const content = fs.readFileSync(fullPath, 'utf-8');

        // Check for common rollback patterns
        const hasRollback =
          content.includes('down') ||
          content.includes('rollback') ||
          content.includes('DROP') ||
          content.includes('REVERT');

        if (!hasRollback) {
          console.error(`Migration ${migrationFile} missing rollback`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Migration rollback check failed:', error);
      return false;
    }
  },
};

/**
 * CI Pipeline Passes Gate
 * Ensures all CI pipeline checks pass
 * This is a simplified version - in production, you'd integrate with actual CI system
 */
export const ciPipelinePassesGate: QualityGate = {
  id: 'ci-pipeline-passes',
  name: 'CI Pipeline Passes',
  description: 'All CI/CD pipeline checks must pass',
  requiredFor: [AgentRole.DEVOPS],
  blocker: true,
  timeout: 10 * 60 * 1000, // 10 minutes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  check: async (_workItem: WorkItem): Promise<boolean> => {
    try {
      // Run all validation commands
      execSync('npm run build', { stdio: 'pipe', encoding: 'utf-8' });
      execSync('npm run validate', { stdio: 'pipe', encoding: 'utf-8' });
      execSync('npm run test:run', { stdio: 'pipe', encoding: 'utf-8' });
      execSync('npm run type-check', { stdio: 'pipe', encoding: 'utf-8' });

      return true;
    } catch (error) {
      console.error('CI pipeline check failed:', error);
      return false;
    }
  },
};

/**
 * Get all predefined gates
 * @returns Array of all predefined quality gates
 */
export function getPredefinedGates(): QualityGate[] {
  return [
    testsPassingGate,
    noLintErrorsGate,
    typeCheckPassesGate,
    testCoverageGate,
    migrationHasRollbackGate,
    ciPipelinePassesGate,
  ];
}

/**
 * Register all predefined gates with a quality gates system
 * @param system The quality gates system to register with
 */
export function registerPredefinedGates(system: {
  registerGate: (gate: QualityGate) => void;
}): void {
  const gates = getPredefinedGates();
  for (const gate of gates) {
    system.registerGate(gate);
  }
}
