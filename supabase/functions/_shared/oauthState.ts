// Shared helpers for the oauth_states server-side cache that replaces the
// v0 "JWT in base64 state" pattern. Split out of oauth-start so the
// oauth-callback test can import `generateStateToken` without spinning up
// the oauth-start Deno.serve listener (which would collide on port 8000).

/** Cryptographically random token used as the OAuth state value. 32 hex
 * chars = 128 bits of entropy, plenty for a single-use 10-minute window. */
export function generateStateToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Maximum age of an oauth_states row before it's considered stale and
 * rejected. Kept in sync between oauth-start (sweeps older rows on each
 * run) and oauth-callback (rejects rows past this age). */
export const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
