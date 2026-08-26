/**
 * Every provider SDK sends its API key as a raw HTTP header value, which must
 * be Latin1/ByteString-safe. A key corrupted by a copy-paste into .env.local
 * (autocorrect turning a "-" into a smart-dash or bullet, a stray invisible
 * character, etc.) fails deep inside the SDK with an opaque "Cannot convert
 * argument to a ByteString" error that gives no hint it's actually the key.
 * Call this right after reading the env var so the real cause is obvious.
 */
export function assertHeaderSafe(envVarName: string, value: string): void {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 255) {
      throw new Error(
        `${envVarName} contains a non-ASCII character at position ${i} (code point ${code}) — ` +
          `this usually means the value got corrupted during copy-paste into .env.local ` +
          `(e.g. a "-" turned into a smart-dash or bullet). Re-type or re-paste it from a ` +
          `plain-text source rather than a rich-text one.`
      );
    }
  }
}
