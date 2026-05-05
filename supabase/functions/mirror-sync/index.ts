// mirror-sync: handles a single playlist_track INSERT or DELETE webhook
// fired by a pg_net trigger and propagates the change to every enabled
// mirror_target on the affected playlist. Refreshes Spotify tokens 60s
// before expiry. Records per-target failures in mirror_track_errors and
// updates last_sync_error / last_synced_at on each mirror_target.

import {
  refreshAccessToken,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
} from "../_shared/spotify.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now() + 60_000;
}

interface Payload {
  op: "insert" | "delete";
  playlist_id: string;
  track_id: string;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") return corsResponse("Method not allowed", { status: 405 });

  const payload = await req.json() as Payload;
  const admin = supabaseAdmin();

  const { data: track, error: trackErr } = await admin
    .from("tracks")
    .select("spotify_id")
    .eq("id", payload.track_id)
    .single();
  if (trackErr || !track) return corsResponse("Track not found", { status: 404 });

  const { data: targets, error: targetsErr } = await admin
    .from("mirror_targets")
    .select("id, user_id, native_playlist_id")
    .eq("playlist_id", payload.playlist_id)
    .eq("service", "spotify")
    .eq("enabled", true);
  if (targetsErr) return corsResponse(targetsErr.message, { status: 500 });
  if (!targets?.length) return corsResponse("No mirror targets", { status: 200 });

  const results: { target: string; ok: boolean; error?: string }[] = [];

  for (const target of targets) {
    if (!track.spotify_id) {
      await admin.from("mirror_track_errors").insert({
        mirror_target_id: target.id,
        track_id: payload.track_id,
        error_type: "track_not_on_spotify",
      });
      results.push({ target: target.id, ok: false, error: "track_not_on_spotify" });
      continue;
    }

    const { data: conn } = await admin
      .from("service_connections")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", target.user_id)
      .eq("service", "spotify")
      .single();
    if (!conn) {
      results.push({ target: target.id, ok: false, error: "no_connection" });
      continue;
    }

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
          .eq("user_id", target.user_id)
          .eq("service", "spotify");
      } catch (err) {
        await admin.from("mirror_targets")
          .update({ last_sync_error: `refresh_failed: ${(err as Error).message}` })
          .eq("id", target.id);
        results.push({ target: target.id, ok: false, error: "refresh_failed" });
        continue;
      }
    }

    try {
      if (payload.op === "insert") {
        await addTrackToPlaylist(accessToken, target.native_playlist_id, track.spotify_id);
      } else {
        await removeTrackFromPlaylist(accessToken, target.native_playlist_id, track.spotify_id);
      }
      await admin.from("mirror_targets")
        .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
        .eq("id", target.id);
      results.push({ target: target.id, ok: true });
    } catch (err) {
      await admin.from("mirror_targets")
        .update({ last_sync_error: (err as Error).message })
        .eq("id", target.id);
      results.push({ target: target.id, ok: false, error: (err as Error).message });
    }
  }

  return corsResponse(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
