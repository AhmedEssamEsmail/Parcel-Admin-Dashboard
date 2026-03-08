#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Infrastructure Initialization Script
 *
 * This script initializes the multi-agent infrastructure on Kiro startup.
 * It performs the following tasks:
 * 1. Initialize InfrastructureManager
 * 2. Register workflow rules
 * 3. Register quality gates
 * 4. Validate configuration
 * 5. Run health checks
 *
 * Usage:
 *   npm run init-infrastructure
 *   or
 *   tsx multi-agent-system/scripts/initialize-infrastructure.ts
 */

import { InfrastructureManager } from '../lib/infrastructure-manager';
import { WorkflowEngine } from '../lib/workflow-engine';
import { QualityGatesSystem } from '../lib/quality-gates';
import { AgentRole } from '../lib/agent-definition-schema';
import { WorkItem } from '../lib/shared-context-types';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Log with color
 */
function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Log section header
 */
function logSection(title: string): void {
  console.log('');
  log(`${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
  console.log('');
}

/**
 * Log success
 */
function logSuccess(message: string): void {
  log(`✅ ${message}`, 'green');
}

/**
 * Log error
 */
function logError(message: string): void {
  log(`❌ ${message}`, 'red');
}

/**
 * Log warning
 */
function logWarning(message: string): void {
  log(`⚠️  ${message}`, 'yellow');
}

/**
 * Log info
 */
function logInfo(message: string): void {
  log(`ℹ️  ${message}`, 'blue');
}

/**
 * Step 1: Initialize Infrastructure
 */
async function initializeInfrastructure(): Promise<InfrastructureManager> {
  logSection('Step 1: Initialize Infrastructure');

  try {
    const startTime = Date.now();
    const infrastructure = await InfrastructureManager.getInitializedInstance();
    const duration = Date.now() - startTime;

    logSuccess(`Infrastructure initialized in ${duration}ms`);

    // Verify initialization time meets performance requirement (<100ms)
    if (duration > 100) {
      logWarning(`Initialization took ${duration}ms (target: <100ms)`);
    }

    return infrastructure;
  } catch (error) {
    logError(`Failed to initialize infrastructure: ${error}`);
    throw error;
  }
}

/**
 * Step 2: Register Workflow Rules
 */
function registerWorkflowRules(workflowEngine: WorkflowEngine): void {
  logSection('Step 2: Register Workflow Rules');

  try {
    // Note: Predefined rules are already registered in WorkflowEngine constructor
    // This section documents them and allows for custom rules

    const predefinedRules = [
      'feature-complete-to-qa',
      'test-failure-to-bugfix',
      'schema-change-to-architect',
      'migration-complete-to-devops',
      'quality-gate-failure-to-owner',
      'task-blocked-to-tech-lead',
    ];

    logInfo('Predefined workflow rules:');
    predefinedRules.forEach((ruleId) => {
      logSuccess(`  - ${ruleId}`);
    });

    const totalRules = workflowEngine.getRules().length;
    logSuccess(`Total workflow rules registered: ${totalRules}`);
  } catch (error) {
    logError(`Failed to register workflow rules: ${error}`);
    throw error;
  }
}

/**
 * Step 3: Register Quality Gates
 */
function registerQualityGates(qualityGates: QualityGatesSystem): void {
  logSection('Step 3: Register Quality Gates');

  try {
    // Register standard quality gates

    // Gate 1: Build
    qualityGates.registerGate({
      id: 'build',
      name: 'Build',
      description: 'Verify project builds successfully',
      requiredFor: [AgentRole.DEVELOPER, AgentRole.DATA_ARCHITECT, AgentRole.UX_UI_DESIGNER],
      blocker: true,
      timeout: 60000,
      check: async (workItem: WorkItem) => {
        try {
          execSync('npm run build', { stdio: 'pipe', encoding: 'utf-8' });
          return true;
        } catch {
          return false;
        }
      },
    });
    logSuccess('  - build gate registered');

    // Gate 2: Type Check
    qualityGates.registerGate({
      id: 'type-check',
      name: 'Type Check',
      description: 'Verify TypeScript types are correct',
      requiredFor: [AgentRole.DEVELOPER, AgentRole.DATA_ARCHITECT],
      blocker: true,
      timeout: 30000,
      check: async (workItem: WorkItem) => {
        try {
          execSync('npm run type-check', { stdio: 'pipe', encoding: 'utf-8' });
          return true;
        } catch {
          return false;
        }
      },
    });
    logSuccess('  - type-check gate registered');

    // Gate 3: Lint
    qualityGates.registerGate({
      id: 'lint',
      name: 'Lint',
      description: 'Verify code meets linting standards',
      requiredFor: [AgentRole.DEVELOPER, AgentRole.DATA_ARCHITECT, AgentRole.UX_UI_DESIGNER],
      blocker: false,
      timeout: 30000,
      check: async (workItem: WorkItem) => {
        try {
          execSync('npm run lint', { stdio: 'pipe', encoding: 'utf-8' });
          return true;
        } catch {
          return false;
        }
      },
    });
    logSuccess('  - lint gate registered');

    // Gate 4: Unit Tests
    qualityGates.registerGate({
      id: 'test',
      name: 'Unit Tests',
      description: 'Verify all unit tests pass',
      requiredFor: [AgentRole.DEVELOPER, AgentRole.QA_ENGINEER],
      blocker: true,
      timeout: 120000,
      check: async (workItem: WorkItem) => {
        try {
          execSync('npm run test:run', { stdio: 'pipe', encoding: 'utf-8' });
          return true;
        } catch {
          return false;
        }
      },
    });
    logSuccess('  - test gate registered');

    // Gate 5: Integration Tests
    qualityGates.registerGate({
      id: 'integration-test',
      name: 'Integration Tests',
      description: 'Verify integration tests pass',
      requiredFor: [AgentRole.DEVELOPER, AgentRole.QA_ENGINEER, AgentRole.DEVOPS],
      blocker: true,
      timeout: 180000,
      check: async (workItem: WorkItem) => {
        try {
          execSync('npm run test:integration', { stdio: 'pipe', encoding: 'utf-8' });
          return true;
        } catch {
          return false;
        }
      },
    });
    logSuccess('  - integration-test gate registered');

    // Gate 6: Test Coverage
    qualityGates.registerGate({
      id: 'coverage',
      name: 'Test Coverage',
      description: 'Verify test coverage >= 60%',
      requiredFor: [AgentRole.DEVELOPER, AgentRole.QA_ENGINEER],
      blocker: false,
      timeout: 120000,
      check: async (workItem: WorkItem) => {
        try {
          const output = execSync('npm run test:coverage', {
            stdio: 'pipe',
            encoding: 'utf-8',
          });

          const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);
          if (coverageMatch) {
            const coverage = parseFloat(coverageMatch[1]);
            return coverage >= 60;
          }

          return true;
        } catch {
          return false;
        }
      },
    });
    logSuccess('  - coverage gate registered');

    const totalGates = qualityGates.getAllGates().length;
    logSuccess(`Total quality gates registered: ${totalGates}`);
  } catch (error) {
    logError(`Failed to register quality gates: ${error}`);
    throw error;
  }
}

/**
 * Step 4: Validate Configuration
 */
function validateConfiguration(): void {
  logSection('Step 4: Validate Configuration');

  try {
    // Check environment variables
    logInfo('Checking environment variables...');

    const optionalEnvVars = ['ENABLE_MULTI_AGENT_INFRASTRUCTURE', 'MULTI_AGENT_LOG_LEVEL'];

    optionalEnvVars.forEach((envVar) => {
      if (process.env[envVar]) {
        logSuccess(`  - ${envVar}: ${process.env[envVar]}`);
      } else {
        logInfo(`  - ${envVar}: not set (using default)`);
      }
    });

    // Check file paths
    logInfo('Checking file paths...');

    const requiredPaths = [
      'package.json',
      'tsconfig.json',
      'multi-agent-system/lib/infrastructure-manager.ts',
      'multi-agent-system/lib/workflow-engine.ts',
      'multi-agent-system/lib/quality-gates.ts',
    ];

    let allPathsExist = true;
    requiredPaths.forEach((path) => {
      if (existsSync(path)) {
        logSuccess(`  - ${path}`);
      } else {
        logError(`  - ${path} (not found)`);
        allPathsExist = false;
      }
    });

    if (!allPathsExist) {
      throw new Error('Some required files are missing');
    }

    // Check command availability
    logInfo('Checking command availability...');

    const commands = ['build', 'type-check', 'lint', 'test:run', 'test:integration'];

    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    commands.forEach((name) => {
      if (packageJson.scripts && packageJson.scripts[name]) {
        logSuccess(`  - ${name}`);
      } else {
        logWarning(`  - ${name} (not found in package.json)`);
      }
    });

    logSuccess('Configuration validation complete');
  } catch (error) {
    logError(`Configuration validation failed: ${error}`);
    throw error;
  }
}

/**
 * Step 5: Run Health Check
 */
async function runHealthCheck(infrastructure: InfrastructureManager): Promise<void> {
  logSection('Step 5: Run Health Check');

  try {
    const status = infrastructure.getStatus();

    logInfo('Infrastructure Status:');
    logInfo(`  Message Bus:`);
    logInfo(`    - Queue Depth: ${status.messageBus.queueDepth}`);
    logInfo(`    - Dead Letter Queue: ${status.messageBus.deadLetterQueueSize}`);

    logInfo(`  Agent Registry:`);
    logInfo(`    - Total Agents: ${status.agentRegistry.totalAgents}`);
    logInfo(`    - Active Agents: ${status.agentRegistry.activeAgents}`);

    logInfo(`  Shared Context:`);
    logInfo(`    - Work Items: ${status.sharedContext.workItems}`);
    logInfo(`    - File Locks: ${status.sharedContext.fileLocks}`);

    logInfo(`  Workflow Engine:`);
    logInfo(`    - Rules Registered: ${status.workflowEngine.rulesRegistered}`);

    logInfo(`  Quality Gates:`);
    logInfo(`    - Gates Registered: ${status.qualityGates.gatesRegistered}`);

    logInfo(`  Agent Hierarchy:`);
    logInfo(`    - Total Agents: ${status.agentHierarchy.totalAgents}`);
    logInfo(`    - Root Agents: ${status.agentHierarchy.rootAgents}`);
    logInfo(`    - Max Depth: ${status.agentHierarchy.maxDepth}`);
    logInfo(`    - Avg Children: ${status.agentHierarchy.avgChildren.toFixed(2)}`);

    // Verify components are initialized
    const checks = [
      { name: 'MessageBus', condition: status.messageBus !== undefined },
      { name: 'AgentRegistry', condition: status.agentRegistry !== undefined },
      { name: 'SharedContext', condition: status.sharedContext !== undefined },
      { name: 'WorkflowEngine', condition: status.workflowEngine.rulesRegistered >= 6 },
      { name: 'QualityGates', condition: status.qualityGates.gatesRegistered >= 6 },
      { name: 'AgentHierarchy', condition: status.agentHierarchy !== undefined },
    ];

    logInfo('Component Health:');
    let allHealthy = true;
    checks.forEach(({ name, condition }) => {
      if (condition) {
        logSuccess(`  - ${name}: healthy`);
      } else {
        logError(`  - ${name}: unhealthy`);
        allHealthy = false;
      }
    });

    if (!allHealthy) {
      throw new Error('Some components are unhealthy');
    }

    logSuccess('Health check passed');
  } catch (error) {
    logError(`Health check failed: ${error}`);
    throw error;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    log('', 'reset');
    log('╔════════════════════════════════════════════════════════════╗', 'cyan');
    log('║                                                            ║', 'cyan');
    log('║     Multi-Agent Infrastructure Initialization Script      ║', 'bright');
    log('║                                                            ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════╝', 'cyan');
    log('', 'reset');

    const startTime = Date.now();

    // Step 1: Initialize infrastructure
    const infrastructure = await initializeInfrastructure();

    // Step 2: Register workflow rules
    const workflowEngine = infrastructure.getWorkflowEngine();
    registerWorkflowRules(workflowEngine);

    // Step 3: Register quality gates
    const qualityGates = infrastructure.getQualityGates();
    registerQualityGates(qualityGates);

    // Step 4: Validate configuration
    validateConfiguration();

    // Step 5: Run health check
    await runHealthCheck(infrastructure);

    const totalDuration = Date.now() - startTime;

    // Final summary
    logSection('Initialization Complete');
    logSuccess(`Infrastructure initialized successfully in ${totalDuration}ms`);
    logInfo('The multi-agent system is ready to use.');
    log('', 'reset');

    process.exit(0);
  } catch (error) {
    log('', 'reset');
    logSection('Initialization Failed');
    logError(`Error: ${error instanceof Error ? error.message : String(error)}`);

    if (error instanceof Error && error.stack) {
      logInfo('Stack trace:');
      console.error(error.stack);
    }

    log('', 'reset');
    logInfo('Please check the error messages above and try again.');
    log('', 'reset');

    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { main };
