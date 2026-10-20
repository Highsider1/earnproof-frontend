/**
 * Request sequencing to prevent out-of-order responses from overwriting fresh state.
 *
 * When multiple requests to the same resource are made in sequence:
 * - Request A sent at t=0
 * - Request B sent at t=100
 * - Response B arrives at t=200
 * - Response A arrives at t=500 (late)
 *
 * We must ensure Response A doesn't overwrite Response B's result.
 *
 * Each logical request stream gets a monotonic sequence number. Response
 * handlers check if the response is still current before applying state.
 */

export interface SequencedRequest<T> {
  id: number;
  result: T;
  timestamp: number;
}

/**
 * Request sequencer for a particular resource.
 * Tracks the latest request ID and validates responses against it.
 */
export class RequestSequencer {
  private nextId = 0;
  private latestId = -1;
  private latestResult: unknown = undefined;
  private latestTimestamp = 0;

  /**
   * Generate a new request ID for a fresh request.
   * Returns the ID that should be included with the response.
   */
  beginRequest(): number {
    return this.nextId++;
  }

  /**
   * Check if a response with the given ID is still current.
   * Use this to determine whether to apply the response result to state.
   */
  isCurrent(id: number): boolean {
    return id >= this.latestId;
  }

  /**
   * Record a successful response, updating the latest state.
   * Returns true if the response was newer than the current one, false if stale.
   */
  recordResponse<T>(id: number, result: T, timestamp = Date.now()): boolean {
    if (id < this.latestId) {
      // Stale response, ignore it
      return false;
    }

    if (id === this.latestId && timestamp < this.latestTimestamp) {
      // Same request ID but older timestamp, probably a race condition
      return false;
    }

    // This is the new latest response
    this.latestId = id;
    this.latestResult = result;
    this.latestTimestamp = timestamp;
    return true;
  }

  /**
   * Get the current result (for testing or inspection).
   */
  getLatestResult(): unknown {
    return this.latestResult;
  }

  /**
   * Reset the sequencer (for logout, cache invalidation, etc.).
   */
  reset(): void {
    this.latestId = -1;
    this.latestResult = undefined;
    this.latestTimestamp = 0;
  }
}

/**
 * Convenience wrapper for resources that need strong ordering guarantees.
 * Encapsulates sequencing logic with result caching.
 */
export class SequencedResource<T> {
  private sequencer = new RequestSequencer();
  private cache: T | undefined;

  /**
   * Begin a new request, getting an ID to track.
   */
  beginRequest(): number {
    return this.sequencer.beginRequest();
  }

  /**
   * Check if a response ID is current before applying it.
   */
  isCurrent(id: number): boolean {
    return this.sequencer.isCurrent(id);
  }

  /**
   * Record a response. Returns true if accepted (and state should update).
   */
  recordResponse(id: number, result: T): boolean {
    if (this.sequencer.recordResponse(id, result)) {
      this.cache = result;
      return true;
    }
    return false;
  }

  /**
   * Get cached result.
   */
  getCache(): T | undefined {
    return this.cache;
  }

  /**
   * Clear cache and reset sequencer.
   */
  invalidate(): void {
    this.sequencer.reset();
    this.cache = undefined;
  }
}
