/**
 * Retries a call once, after a short delay, if it fails with a transport-level
 * error (connection dropped, DNS hiccup, timeout) rather than a structured API
 * error response — a brief network blip shouldn't surface as a hard failure
 * to the student. Errors that clearly came back from the API itself (rate
 * limits, invalid requests, etc.) are not retried.
 */
export async function withNetworkRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const looksTransient = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network/i.test(message);
    if (!looksTransient) throw err;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return fn();
  }
}
