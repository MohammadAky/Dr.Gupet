/**
 * Single-flight gate: concurrent callers share one in-flight promise.
 * Used so that N parallel 401 responses trigger exactly one token refresh.
 */
export function createSingleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inflight: Promise<T> | null = null;
  return () => {
    if (!inflight) {
      inflight = fn().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };
}
