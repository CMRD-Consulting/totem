const APPLE_MUSIC_API = "https://api.music.apple.com/v1";

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const lines = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(lines);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : data;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** Mint a MusicKit developer token (valid up to 6 months; we use 30 days). */
export async function createDeveloperToken(): Promise<string> {
  const teamId = Deno.env.get("APPLE_MUSIC_TEAM_ID");
  const keyId = Deno.env.get("APPLE_MUSIC_KEY_ID");
  const privateKey = Deno.env.get("APPLE_MUSIC_PRIVATE_KEY");
  if (!teamId || !keyId || !privateKey) {
    throw new Error("Apple Music credentials not configured");
  }

  const header = base64UrlEncode(JSON.stringify({ alg: "ES256", kid: keyId }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + 60 * 60 * 24 * 30,
  }));
  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(privateKey.replace(/\\n/g, "\n"));
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  const sigBytes = new Uint8Array(signature);
  return `${signingInput}.${base64UrlEncode(sigBytes)}`;
}

function appleHeaders(developerToken: string, userToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${developerToken}`,
    "Music-User-Token": userToken,
    "Content-Type": "application/json",
  };
}

export async function getStorefront(
  developerToken: string,
  userToken: string,
): Promise<string> {
  const res = await fetch(`${APPLE_MUSIC_API}/me/storefront`, {
    headers: appleHeaders(developerToken, userToken),
  });
  if (!res.ok) throw new Error(`Apple Music storefront ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const storefront = data.data?.[0]?.id;
  if (!storefront) throw new Error("Apple Music storefront not found");
  return storefront;
}

export async function createLibraryPlaylist(
  developerToken: string,
  userToken: string,
  name: string,
  description: string,
): Promise<{ id: string }> {
  const res = await fetch(`${APPLE_MUSIC_API}/me/library/playlists`, {
    method: "POST",
    headers: appleHeaders(developerToken, userToken),
    body: JSON.stringify({
      attributes: { name, description },
      relationships: { tracks: { data: [] } },
    }),
  });
  if (!res.ok) {
    throw new Error(`Apple Music createPlaylist ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const playlistId = data.data?.[0]?.id;
  if (!playlistId) throw new Error("Apple Music playlist id missing");
  return { id: playlistId };
}

export async function addTrackToPlaylist(
  developerToken: string,
  userToken: string,
  playlistId: string,
  appleMusicTrackId: string,
): Promise<void> {
  const res = await fetch(
    `${APPLE_MUSIC_API}/me/library/playlists/${playlistId}/tracks`,
    {
      method: "POST",
      headers: appleHeaders(developerToken, userToken),
      body: JSON.stringify({
        data: [{ id: appleMusicTrackId, type: "songs" }],
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Apple Music add track ${res.status}: ${await res.text()}`);
  }
}

export async function addTracksToPlaylist(
  developerToken: string,
  userToken: string,
  playlistId: string,
  appleMusicTrackIds: string[],
): Promise<number> {
  const unique = Array.from(new Set(appleMusicTrackIds));
  for (const trackId of unique) {
    await addTrackToPlaylist(developerToken, userToken, playlistId, trackId);
  }
  return unique.length;
}

export async function removeTrackFromPlaylist(
  developerToken: string,
  userToken: string,
  playlistId: string,
  appleMusicTrackId: string,
): Promise<void> {
  const res = await fetch(
    `${APPLE_MUSIC_API}/me/library/playlists/${playlistId}/tracks`,
    {
      method: "DELETE",
      headers: appleHeaders(developerToken, userToken),
      body: JSON.stringify({
        data: [{ id: appleMusicTrackId, type: "songs" }],
      }),
    },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Apple Music remove track ${res.status}: ${await res.text()}`);
  }
}

/** Apple user tokens expire ~6 months; we store a far-future expires_at. */
export function appleTokenExpiry(): string {
  return new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
}
