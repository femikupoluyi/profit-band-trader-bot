import { StaleDataCleanupOrchestrator } from './cleanup/StaleDataCleanupOrchestrator';

/**
 * REFACTORED: Simplified StaleDataCleanupService 
 * Now delegates to StaleDataCleanupOrchestrator for better separation of concerns
 * @deprecated Use StaleDataCleanupOrchestrator directly for new implementations
 */
export class StaleDataCleanupService {
  private orchestrator: StaleDataCleanupOrchestrator;

  constructor(userId: string) {
    this.orchestrator = new StaleDataCleanupOrchestrator(userId);
  }

  /**
   * Clean up stale data that doesn't match current configuration
   * @deprecated Use orchestrator.executeCleanup() directly
   */
  async cleanupStaleData(): Promise<void> {
    await this.orchestrator.executeCleanup();
  }
}