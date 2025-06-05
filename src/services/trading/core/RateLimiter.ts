
export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly timeWindow: number;

  constructor(maxRequests: number = 10, timeWindowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
  }

  async waitForPermission(): Promise<void> {
    const now = Date.now();
    
    // Remove old requests outside the time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.timeWindow - (now - oldestRequest) + 100; // Add small buffer
      
      console.log(`⏳ Rate limit reached, waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForPermission(); // Recursive call after waiting
    }
    
    this.requests.push(now);
  }

  getStatus(): { requestsInWindow: number; maxRequests: number; timeWindow: number } {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    return {
      requestsInWindow: this.requests.length,
      maxRequests: this.maxRequests,
      timeWindow: this.timeWindow
    };
  }
}
