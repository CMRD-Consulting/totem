// create-mirror-target: given a (playlist_id, service), reuse the user's
// existing service_connections row to create a native playlist on Spotify and
// insert a mirror_targets row. Decoupled from OAuth — the user must already
// have a connection (set up via Settings "Connect Spotify"). The Mirror page
// flow keeps using oauth-callback's per-playlist path; this function is what
// JoinPage and any future UI calls when the connection already exists.
//
// Idempotent: if a mirror_target already exists for (user, playlist, service),
// returns it instead of creating a second native playlist.

import {
  createPlaylist,
  refreshAccessToken,
} from "../_shared/spotify.ts";
import { supabaseAdmin, supabaseAsUser } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";

interface Payload {
  playlist_id: string;
  service: "spotify" | "apple_music" | "youtube_music";
}

function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now() + 60_000;
}

function jsonResponse(body: unknown, status: number): Response {
  return corsResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return corsResponse("Method not allowed", { status: 405 });

  // verify_jwt is false so preflights work; enforce auth here.
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return jsonResponse({ error: "unauthenticated" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  let payload: Payload;
  try {
    payload = await req.json() as Payload;
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }
  if (!payload.playlist_id || !payload.service) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }
  if (payload.service !== "spotify") {
    // v0: Apple Music + YouTube Music aren't implemented yet on the backend.
    return jsonResponse({ error: "unsupported_service" }, 400);
  }

  const userClient = supabaseAsUser(jwt);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: "session_invalid" }, 401);

  const admin = supabaseAdmin();

  // Idempotency: if a target already exists, return it. Avoids creating a
  // second "Totem: <name>" playlist on Spotify when the user retries.
  const { data: existing } = await admin
    .from("mirror_targets")
    .select("id, native_playlist_id")
    .eq("user_id", user.id)
    .eq("playlist_id", payload.playlist_id)
    .eq("service", payload.service)
    .maybeSingle();
  if (existing) {
    return jsonResponse({
      ok: true,
      mirror_target_id: existing.id,
      native_playlist_id: existing.native_playlist_id,
      reused: true,
    }, 200);
  }

  // The whole point of this function: reuse a connection instead of OAuth.
  const { data: conn } = await admin
    .from("service_connections")
    .select("access_token, refresh_token, expires_at, service_user_id")
    .eq("user_id", user.id)
    .eq("service", payload.service)
    .maybeSingle();
  if (!conn) {
    return jsonResponse({ error: "no_connection" }, 400);
  }

  // Refresh if the access_token is at/near expiry. Same 60s buffer as
  // mirror-sync uses, so behavior is consistent across functions.
  let accessToken = conn.access_token;
  if (isTokenExpired(conn.expires_at) && conn.refresh_token) {
    try {
      const fresh = await refreshAccessToken(conn.refresh_token);
      accessToken = fresh.access_token;
      await admin.from("service_connections")
        .update({
          access_token: fresh.access_token,
          expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("service", payload.service);
    } catch (err) {
      return jsonResponse({
        error: "refresh_failed",
        message: (err as Error).message,
      }, 502);
    }
  }

  // Read the playlist via the user's RLS-scoped client — confirms membership
  // before we go talk to Spotify.
  const { data: playlistRow } = await userClient
    .from("playlists")
    .select("id, name, description")
    .eq("id", payload.playlist_id)
    .single();
  if (!playlistRow) {
    return jsonResponse({ error: "playlist_not_found" }, 404);
  }

  let spotifyPlaylist: { id: string };
  try {
    spotifyPlaylist = await createPlaylist(
      accessToken,
      conn.service_user_id,
      `Totem: ${playlistRow.name}`,
      playlistRow.description ?? "Mirrored from Totem",
    );
  } catch (err) {
    const msg = (err as Error).message;
    console.error("createPlaylist failed", msg);
    return jsonResponse({ error: "create_failed", message: msg }, 502);
  }

  const { data: target, error: insErr } = await admin
    .from("mirror_targets")
    .insert({
      user_id: user.id,
      playlist_id: payload.playlist_id,
      service: payload.service,
      native_playlist_id: spotifyPlaylist.id,
    })
    .select("id, native_playlist_id")
    .single();
  if (insErr || !target) {
    return jsonResponse({
      error: "insert_failed",
      message: insErr?.message ?? "unknown",
    }, 500);
  }

  return jsonResponse({
    ok: true,
    mirror_target_id: target.id,
    native_playlist_id: target.native_playlist_id,
  }, 200);
});
