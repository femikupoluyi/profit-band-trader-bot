
export interface ExecutionResults {
  total: number;
  successful: number;
  failed: number;
  failureReasons: Record<string, number>;
}

export class ExecutionResultsTracker {
  private results: ExecutionResults;

  constructor() {
    this.results = {
      total: 0,
      successful: 0,
      failed: 0,
      failureReasons: {}
    };
  }

  initializeResults(totalSignals: number): void {
    this.results = {
      total: totalSignals,
      successful: 0,
      failed: 0,
      failureReasons: {}
    };
  }

  recordSuccess(): void {
    this.results.successful++;
  }

  recordFailure(reason: string): void {
    this.results.failed++;
    const failureReason = reason || 'Unknown error';
    this.results.failureReasons[failureReason] = (this.results.failureReasons[failureReason] || 0) + 1;
  }

  getResults(): ExecutionResults {
    return { ...this.results };
  }

  logSummary(): void {
    console.log('\n📊 ===== SIGNAL EXECUTION SUMMARY =====');
    console.log('📈 Execution Results:', this.results);
    console.log('📋 Failure Breakdown:', this.results.failureReasons);
  }
}
