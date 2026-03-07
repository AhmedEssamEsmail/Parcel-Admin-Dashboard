/**
 * Graceful shutdown handler for the application.
 * Tracks active requests and ensures they complete before shutdown.
 */

type ShutdownConfig = {
  timeout?: number; // Timeout in milliseconds (default: 30000)
  onShutdownStart?: () => void;
  onShutdownComplete?: () => void;
};

class ShutdownManager {
  private activeRequests = new Set<Promise<unknown>>();
  private isShuttingDown = false;
  private timeout: number;
  private onShutdownStart?: () => void;
  private onShutdownComplete?: () => void;

  constructor(config: ShutdownConfig = {}) {
    this.timeout = config.timeout ?? 30000; // 30 seconds default
    this.onShutdownStart = config.onShutdownStart;
    this.onShutdownComplete = config.onShutdownComplete;
  }

  /**
   * Track a request promise
   */
  trackRequest<T>(promise: Promise<T>): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Server is shutting down, cannot accept new requests');
    }

    this.activeRequests.add(promise);

    promise
      .finally(() => {
        this.activeRequests.delete(promise);
      })
      .catch(() => {
        // Ignore errors, just ensure cleanup
      });

    return promise;
  }

  /**
   * Check if server is shutting down
   */
  isShutdown(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Initiate graceful shutdown
   */
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log('[Shutdown] Already shutting down, ignoring signal:', signal);
      return;
    }

    this.isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}, starting graceful shutdown...`);
    console.log(`[Shutdown] Active requests: ${this.activeRequests.size}`);

    if (this.onShutdownStart) {
      this.onShutdownStart();
    }

    // Wait for active requests to complete or timeout
    const shutdownPromise = Promise.all(Array.from(this.activeRequests));

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log(
          `[Shutdown] Timeout reached (${this.timeout}ms), forcing shutdown with ${this.activeRequests.size} active requests`
        );
        resolve();
      }, this.timeout);
    });

    await Promise.race([shutdownPromise, timeoutPromise]);

    console.log('[Shutdown] All requests completed or timeout reached');

    if (this.onShutdownComplete) {
      this.onShutdownComplete();
    }

    console.log('[Shutdown] Graceful shutdown complete');
    process.exit(0);
  }

  /**
   * Register signal handlers for graceful shutdown
   */
  registerHandlers(): void {
    process.on('SIGTERM', () => {
      void this.shutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      void this.shutdown('SIGINT');
    });

    console.log('[Shutdown] Graceful shutdown handlers registered');
  }
}

// Export singleton instance
export const shutdownManager = new ShutdownManager();

/**
 * Initialize graceful shutdown handling
 */
export function initGracefulShutdown(config?: ShutdownConfig): ShutdownManager {
  const manager = new ShutdownManager(config);
  manager.registerHandlers();
  return manager;
}
