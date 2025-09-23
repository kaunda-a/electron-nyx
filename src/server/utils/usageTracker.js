/**
 * Usage Tracker for monitoring Inngest executions and LLM usage
 */
class UsageTracker {
  constructor() {
    this.usage = {
      inngest: {
        executions: 0,
        errors: 0
      },
      openrouter: {
        requests: 0,
        tokens: 0,
        errors: 0,
        costs: 0
      },
      google: {
        requests: 0,
        tokens: 0,
        errors: 0,
        costs: 0
      }
    };
  }
  
  /**
   * Track Inngest execution
   * @param {boolean} success - Whether execution was successful
   */
  trackInngestExecution(success = true) {
    this.usage.inngest.executions++;
    if (!success) {
      this.usage.inngest.errors++;
    }
  }
  
  /**
   * Track OpenRouter usage
   * @param {number} tokens - Number of tokens used
   * @param {number} cost - Cost in USD
   */
  trackOpenRouterUsage(tokens, cost) {
    this.usage.openrouter.requests++;
    this.usage.openrouter.tokens += tokens;
    this.usage.openrouter.costs += cost;
  }
  
  /**
   * Track Google Gemini usage
   * @param {number} tokens - Number of tokens used
   * @param {number} cost - Cost in USD
   */
  trackGoogleUsage(tokens, cost) {
    this.usage.google.requests++;
    this.usage.google.tokens += tokens;
    this.usage.google.costs += cost;
  }
  
  /**
   * Track OpenRouter error
   */
  trackOpenRouterError() {
    this.usage.openrouter.errors++;
  }
  
  /**
   * Track Google Gemini error
   */
  trackGoogleError() {
    this.usage.google.errors++;
  }
  
  /**
   * Get usage report
   * @returns {Object} Usage report
   */
  getUsageReport() {
    return {
      ...this.usage,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }
  
  /**
   * Reset usage counters
   */
  reset() {
    this.usage = {
      inngest: {
        executions: 0,
        errors: 0
      },
      openrouter: {
        requests: 0,
        tokens: 0,
        errors: 0,
        costs: 0
      },
      google: {
        requests: 0,
        tokens: 0,
        errors: 0,
        costs: 0
      }
    };
  }
}

module.exports = { UsageTracker };