const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_AUTH = "https://accounts.spotify.com/api/token";

export interface SpotifyTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  /** Space-separated scopes Spotify actually granted (may be a subset of
   *  what was requested if the user denied some). */
  scope?: string;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<SpotifyTokens> {
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")!;
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(SPOTIFY_AUTH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token exchange ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")!;
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(SPOTIFY_AUTH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Spotify refresh ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getCurrentUser(
  accessToken: string,
): Promise<{ id: string; display_name: string; email?: string }> {
  const res = await fetch(`${SPOTIFY_API}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Spotify /me ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function createPlaylist(
  accessToken: string,
  spotifyUserId: string,
  name: string,
  description: string,
): Promise<{ id: string }> {
  const res = await fetch(`${SPOTIFY_API}/users/${spotifyUserId}/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, description, public: false }),
  });
  if (!res.ok) throw new Error(`Spotify createPlaylist ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function addTrackToPlaylist(
  accessToken: string,
  spotifyPlaylistId: string,
  spotifyTrackId: string,
): Promise<void> {
  const uri = `spotify:track:${spotifyTrackId}`;
  const res = await fetch(`${SPOTIFY_API}/playlists/${spotifyPlaylistId}/tracks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: [uri] }),
  });
  if (!res.ok) throw new Error(`Spotify add track ${res.status}: ${await res.text()}`);
}

// Batched variant of addTrackToPlaylist used by the backfill function. Spotify
// accepts up to 100 URIs per call; we chunk to stay under that limit. Returns
// the count actually pushed (0 if the input was empty after dedup).
export async function addTracksToPlaylist(
  accessToken: string,
  spotifyPlaylistId: string,
  spotifyTrackIds: string[],
): Promise<number> {
  if (spotifyTrackIds.length === 0) return 0;
  // Dedupe — repeated URIs would create duplicate playlist entries on Spotify.
  const unique = Array.from(new Set(spotifyTrackIds));
  let pushed = 0;
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const uris = chunk.map((id) => `spotify:track:${id}`);
    const res = await fetch(`${SPOTIFY_API}/playlists/${spotifyPlaylistId}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris }),
    });
    if (!res.ok) {
      throw new Error(`Spotify add tracks ${res.status}: ${await res.text()}`);
    }
    pushed += chunk.length;
  }
  return pushed;
}

export async function removeTrackFromPlaylist(
  accessToken: string,
  spotifyPlaylistId: string,
  spotifyTrackId: string,
): Promise<void> {
  const uri = `spotify:track:${spotifyTrackId}`;
  const res = await fetch(`${SPOTIFY_API}/playlists/${spotifyPlaylistId}/tracks`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tracks: [{ uri }] }),
  });
  if (!res.ok) throw new Error(`Spotify remove track ${res.status}: ${await res.text()}`);
}
