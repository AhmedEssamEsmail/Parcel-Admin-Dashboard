/**
 * Session Manager
 *
 * Manages agent sessions with timeout handling, resource cleanup, and metrics tracking.
 *
 * Features:
 * - Session tracking with metadata (agentId, role, startTime, timeout)
 * - Timeout management with automatic termination
 * - Resource cleanup on session end (file locks, hierarchy, registry)
 * - Session metrics (messages received/sent, escalations)
 * - Manual termination support
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */

import type { AgentRole } from './agent-definition-schema';
import type { InfrastructureManager } from './infrastructure-manager';

/**
 * Session metadata
 */
export interface SessionMetadata {
  agentId: string;
  role: AgentRole;
  startTime: Date;
  timeoutMs?: number;
  parentAgentId?: string;
}

/**
 * Session metrics
 */
export interface SessionMetrics {
  messagesReceived: number;
  messagesSent: number;
  escalations: number;
  filesLocked: number;
  tasksCompleted: number;
}

/**
 * Active session
 */
interface ActiveSession {
  metadata: SessionMetadata;
  metrics: SessionMetrics;
  timeoutTimer?: NodeJS.Timeout;
  onTimeout?: (agentId: string) => void;
  onFail?: (agentId: string, error: Error) => void;
}

/**
 * Session Manager
 *
 * Manages agent sessions with timeout handling and resource cleanup.
 */
export class SessionManager {
  private sessions: Map<string, ActiveSession> = new Map();
  private infrastructure: InfrastructureManager;

  constructor(infrastructure: InfrastructureManager) {
    this.infrastructure = infrastructure;
  }

  /**
   * Create a new agent session
   *
   * @param metadata - Session metadata
   * @param onTimeout - Callback invoked when session times out
   * @param onFail - Callback invoked when session fails
   * @returns Session ID
   *
   * Requirement 12.1: Track active agent sessions with metadata
   */
  createSession(
    metadata: SessionMetadata,
    onTimeout?: (agentId: string) => void,
    onFail?: (agentId: string, error: Error) => void
  ): string {
    const { agentId, timeoutMs } = metadata;

    // Check if session already exists
    if (this.sessions.has(agentId)) {
      throw new Error(`Session already exists for agent ${agentId}`);
    }

    // Create session
    const session: ActiveSession = {
      metadata,
      metrics: {
        messagesReceived: 0,
        messagesSent: 0,
        escalations: 0,
        filesLocked: 0,
        tasksCompleted: 0,
      },
      onTimeout,
      onFail,
    };

    // Set timeout timer if specified
    // Requirement 12.2: Set timeout timer for agents spawned with timeout parameter
    if (timeoutMs && timeoutMs > 0) {
      session.timeoutTimer = setTimeout(() => {
        this.handleTimeout(agentId);
      }, timeoutMs);
    }

    this.sessions.set(agentId, session);

    return agentId;
  }

  /**
   * Handle session timeout
   *
   * Requirement 12.2: Terminate agent session on timeout and invoke onAgentFail
   */
  private handleTimeout(agentId: string): void {
    const session = this.sessions.get(agentId);

    if (!session) {
      return;
    }

    // Invoke timeout callback
    if (session.onTimeout) {
      try {
        session.onTimeout(agentId);
      } catch (error) {
        console.error(`Error in timeout callback for agent ${agentId}:`, error);
      }
    }

    // Cleanup resources
    this.cleanupSession(agentId);
  }

  /**
   * End a session normally
   *
   * @param agentId - Agent ID
   *
   * Requirement 12.3: Clear timeout timer on agent session end
   * Requirement 12.4: Release all file locks on session end
   * Requirement 12.5: Remove agent from hierarchy on session end
   */
  endSession(agentId: string): void {
    const session = this.sessions.get(agentId);

    if (!session) {
      return;
    }

    // Clear timeout timer
    // Requirement 12.3: Clear timeout timer on agent session end
    if (session.timeoutTimer) {
      clearTimeout(session.timeoutTimer);
      session.timeoutTimer = undefined;
    }

    // Cleanup resources
    this.cleanupSession(agentId);
  }

  /**
   * Terminate a session manually
   *
   * @param agentId - Agent ID
   * @param reason - Termination reason
   *
   * Requirement 12.6: Implement terminateAgent for manual termination
   */
  terminateSession(agentId: string, reason?: string): void {
    const session = this.sessions.get(agentId);

    if (!session) {
      return;
    }

    // Clear timeout timer
    if (session.timeoutTimer) {
      clearTimeout(session.timeoutTimer);
      session.timeoutTimer = undefined;
    }

    // Invoke fail callback if provided
    if (session.onFail) {
      try {
        const error = new Error(reason || 'Session terminated manually');
        session.onFail(agentId, error);
      } catch (error) {
        console.error(`Error in fail callback for agent ${agentId}:`, error);
      }
    }

    // Cleanup resources
    this.cleanupSession(agentId);
  }

  /**
   * Cleanup session resources
   *
   * Requirement 12.4: Release all file locks on session end
   * Requirement 12.5: Remove agent from hierarchy on session end
   */
  private cleanupSession(agentId: string): void {
    const session = this.sessions.get(agentId);

    if (!session) {
      return;
    }

    try {
      // Get infrastructure components
      const sharedContext = this.infrastructure.getSharedContext();
      const agentRegistry = this.infrastructure.getAgentRegistry();

      // Requirement 12.4: Release all file locks held by agent
      const locks = sharedContext.getAgentLocks(agentId);
      for (const lock of locks) {
        sharedContext.releaseFileLock(agentId, lock.filePath);
      }

      // Requirement 12.5: Update agent status to 'offline' in registry
      try {
        agentRegistry.updateStatus(agentId, 'offline');
      } catch {
        // Agent might not be registered, ignore error
      }

      // Note: Hierarchy removal is handled by the hierarchy tracking system
      // when it detects an agent going offline

      // Remove session
      this.sessions.delete(agentId);
    } catch (cleanupError) {
      console.error(`Error cleaning up session for agent ${agentId}:`, cleanupError);
      // Still remove the session even if cleanup fails
      this.sessions.delete(agentId);
    }
  }

  /**
   * Get session metadata
   *
   * @param agentId - Agent ID
   * @returns Session metadata or undefined if not found
   */
  getSessionMetadata(agentId: string): SessionMetadata | undefined {
    const session = this.sessions.get(agentId);
    return session?.metadata;
  }

  /**
   * Get session metrics
   *
   * @param agentId - Agent ID
   * @returns Session metrics or undefined if not found
   *
   * Requirement 12.7: Track session metrics (messages received/sent, escalations)
   */
  getSessionMetrics(agentId: string): SessionMetrics | undefined {
    const session = this.sessions.get(agentId);
    return session ? { ...session.metrics } : undefined;
  }

  /**
   * Increment message received count
   *
   * @param agentId - Agent ID
   *
   * Requirement 12.7: Track messages received per session
   */
  incrementMessagesReceived(agentId: string): void {
    const session = this.sessions.get(agentId);
    if (session) {
      session.metrics.messagesReceived++;
    }
  }

  /**
   * Increment message sent count
   *
   * @param agentId - Agent ID
   *
   * Requirement 12.7: Track messages sent per session
   */
  incrementMessagesSent(agentId: string): void {
    const session = this.sessions.get(agentId);
    if (session) {
      session.metrics.messagesSent++;
    }
  }

  /**
   * Increment escalation count
   *
   * @param agentId - Agent ID
   *
   * Requirement 12.7: Track escalations per session
   */
  incrementEscalations(agentId: string): void {
    const session = this.sessions.get(agentId);
    if (session) {
      session.metrics.escalations++;
    }
  }

  /**
   * Increment files locked count
   *
   * @param agentId - Agent ID
   */
  incrementFilesLocked(agentId: string): void {
    const session = this.sessions.get(agentId);
    if (session) {
      session.metrics.filesLocked++;
    }
  }

  /**
   * Increment tasks completed count
   *
   * @param agentId - Agent ID
   */
  incrementTasksCompleted(agentId: string): void {
    const session = this.sessions.get(agentId);
    if (session) {
      session.metrics.tasksCompleted++;
    }
  }

  /**
   * Check if a session exists
   *
   * @param agentId - Agent ID
   * @returns True if session exists
   */
  hasSession(agentId: string): boolean {
    return this.sessions.has(agentId);
  }

  /**
   * Get all active sessions
   *
   * @returns Array of session metadata
   */
  getAllSessions(): SessionMetadata[] {
    return Array.from(this.sessions.values()).map((session) => session.metadata);
  }

  /**
   * Get session count
   *
   * @returns Number of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get sessions by role
   *
   * @param role - Agent role
   * @returns Array of session metadata
   */
  getSessionsByRole(role: AgentRole): SessionMetadata[] {
    return Array.from(this.sessions.values())
      .filter((session) => session.metadata.role === role)
      .map((session) => session.metadata);
  }

  /**
   * Get total metrics across all sessions
   *
   * @returns Aggregated metrics
   */
  getTotalMetrics(): SessionMetrics {
    const total: SessionMetrics = {
      messagesReceived: 0,
      messagesSent: 0,
      escalations: 0,
      filesLocked: 0,
      tasksCompleted: 0,
    };

    const sessions = Array.from(this.sessions.values());
    for (const session of sessions) {
      total.messagesReceived += session.metrics.messagesReceived;
      total.messagesSent += session.metrics.messagesSent;
      total.escalations += session.metrics.escalations;
      total.filesLocked += session.metrics.filesLocked;
      total.tasksCompleted += session.metrics.tasksCompleted;
    }

    return total;
  }

  /**
   * Clear all sessions (for testing)
   */
  clear(): void {
    // Clear all timeout timers
    const sessions = Array.from(this.sessions.values());
    for (const session of sessions) {
      if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer);
      }
    }

    this.sessions.clear();
  }

  /**
   * Get session statistics
   *
   * @returns Session statistics
   */
  getStats(): {
    activeSessions: number;
    byRole: Record<string, number>;
    totalMetrics: SessionMetrics;
    averageSessionDuration: number;
  } {
    const byRole: Record<string, number> = {};
    let totalDuration = 0;
    const now = new Date();

    const sessions = Array.from(this.sessions.values());
    for (const session of sessions) {
      const role = session.metadata.role;
      byRole[role] = (byRole[role] || 0) + 1;

      const duration = now.getTime() - session.metadata.startTime.getTime();
      totalDuration += duration;
    }

    const averageSessionDuration = this.sessions.size > 0 ? totalDuration / this.sessions.size : 0;

    return {
      activeSessions: this.sessions.size,
      byRole,
      totalMetrics: this.getTotalMetrics(),
      averageSessionDuration,
    };
  }
}
