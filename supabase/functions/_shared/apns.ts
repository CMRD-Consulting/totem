// APNs HTTP/2 helpers. Signs a provider JWT with ES256 over a .p8 EC private
// key (PKCS#8 PEM) and posts to api.push.apple.com.
//
// Required env vars:
//   APNS_TEAM_ID      — 10-char Apple Developer Team ID (Apple Developer → Membership)
//   APNS_KEY_ID       — 10-char Key ID for the .p8 (Apple Developer → Keys)
//   APNS_AUTH_KEY     — full .p8 contents including BEGIN/END PRIVATE KEY lines
//   APNS_BUNDLE_ID    — your iOS app bundle id (e.g., dev.cmrd.totem)
//   APNS_USE_SANDBOX  — '1' for development environment, '0' or unset for production

const APNS_PROD_HOST = "https://api.push.apple.com";
const APNS_DEV_HOST = "https://api.sandbox.push.apple.com";

let cachedJwt: { token: string; expiresAt: number } | null = null;

/** Decode a PEM-formatted PKCS#8 private key into a CryptoKey suitable for ES256 signing. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pkcs8 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pkcs8), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Mint (or reuse) a provider JWT. Apple permits up to 1h; we refresh after 50m. */
async function getProviderJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt - now > 60) return cachedJwt.token;

  const teamId = Deno.env.get("APNS_TEAM_ID");
  const keyId = Deno.env.get("APNS_KEY_ID");
  const pem = Deno.env.get("APNS_AUTH_KEY");
  if (!teamId || !keyId || !pem) {
    throw new Error("APNs not configured (APNS_TEAM_ID / APNS_KEY_ID / APNS_AUTH_KEY)");
  }

  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", kid: keyId })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ iss: teamId, iat: now })));
  const signingInput = `${header}.${payload}`;

  const key = await importPrivateKey(pem);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  const token = `${signingInput}.${b64url(sig)}`;
  cachedJwt = { token, expiresAt: now + 50 * 60 };
  return token;
}

interface PushPayload {
  title: string;
  body: string;
  /** Optional structured data forwarded to the client; goes into `aps` extras. */
  data?: Record<string, unknown>;
  /** Optional badge count. */
  badge?: number;
}

/** Send one push to one APNs device token. Returns null on success, or an error string. */
export async function sendApnsPush(
  deviceToken: string,
  payload: PushPayload,
): Promise<string | null> {
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  if (!bundleId) return "APNS_BUNDLE_ID not configured";
  const host = Deno.env.get("APNS_USE_SANDBOX") === "1" ? APNS_DEV_HOST : APNS_PROD_HOST;

  let jwt: string;
  try {
    jwt = await getProviderJwt();
  } catch (e) {
    return (e as Error).message;
  }

  const body = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
    },
    ...(payload.data ?? {}),
  };

  const res = await fetch(`${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      Authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.ok) return null;
  // Apple returns JSON like {"reason": "BadDeviceToken"} on 4xx.
  const text = await res.text();
  return `${res.status}: ${text || res.statusText}`;
}
