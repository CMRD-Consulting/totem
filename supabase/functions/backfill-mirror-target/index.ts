// backfill-mirror-target: fires once when a new mirror_target row is inserted
// (via the AFTER INSERT trigger in 20260428000019_backfill_invocation.sql).
// Pushes every existing playlist_track that has a spotify_id into the newly
// created native Spotify playlist, so users connecting mirror to an
// already-populated playlist see their existing songs — not just future ones.
//
// Mirrors the patterns from mirror-sync (token refresh, error rows in
// mirror_track_errors, last_synced_at/last_sync_error on mirror_targets) and
// uses the chunked addTracksToPlaylist helper to stay under Spotify's
// 100-uris-per-call limit.
//
// Idempotency: the trigger fires on INSERT only, so under normal operation
// each target is backfilled exactly once. If invoked manually (debug retry),
// duplicates on Spotify are possible — Spotify allows them. v2 could add a
// `last_backfilled_at` column to short-circuit re-runs.

import {
  refreshAccessToken,
  addTracksToPlaylist,
} from "../_shared/spotify.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";

interface Payload {
  mirror_target_id: string;
  user_id: string;
  playlist_id: string;
  native_playlist_id: string;
  service: string;
}

export function isTokenExpired(expiresAt: string): boolean {
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
  if (req.method !== "POST") {
    return corsResponse("Method not allowed", { status: 405 });
  }

  let payload: Payload;
  try {
    payload = await req.json() as Payload;
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }
  if (
    !payload.mirror_target_id || !payload.user_id || !payload.playlist_id ||
    !payload.native_playlist_id
  ) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }
  // Only Spotify is implemented; if Apple Music / YouTube Music targets are
  // ever inserted, no-op rather than failing loudly so the trigger can be
  // shared across services.
  if (payload.service !== "spotify") {
    return jsonResponse({ ok: true, skipped: "unsupported_service" }, 200);
  }

  const admin = supabaseAdmin();

  // Pull tokens for the target's owner. mirror-sync uses the same shape.
  const { data: conn } = await admin
    .from("service_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", payload.user_id)
    .eq("service", "spotify")
    .single();
  if (!conn) {
    await admin.from("mirror_targets")
      .update({ last_sync_error: "backfill: no_connection" })
      .eq("id", payload.mirror_target_id);
    return jsonResponse({ error: "no_connection" }, 400);
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
        .eq("user_id", payload.user_id)
        .eq("service", "spotify");
    } catch (err) {
      const msg = `backfill: refresh_failed: ${(err as Error).message}`;
      await admin.from("mirror_targets")
        .update({ last_sync_error: msg })
        .eq("id", payload.mirror_target_id);
      return jsonResponse({ error: "refresh_failed" }, 502);
    }
  }

  // Read every track currently on the playlist. Two queries instead of a
  // PostgREST embed because supabase-js types the embed as an array even for
  // single-row !inner joins — fighting that adds cast noise without saving
  // a round-trip. Matches the read pattern from mirror-sync.
  const { data: ptRows, error: ptErr } = await admin
    .from("playlist_tracks")
    .select("track_id")
    .eq("playlist_id", payload.playlist_id);
  if (ptErr) {
    return jsonResponse({ error: "read_failed", message: ptErr.message }, 500);
  }
  const trackIds = (ptRows ?? []).map((r) => r.track_id);

  // Partition: songs with a spotify_id can be pushed; songs without get a
  // per-track error row (same shape mirror-sync uses for ongoing inserts).
  const pushable: string[] = [];
  const unavailable: string[] = [];
  if (trackIds.length > 0) {
    const { data: tracks, error: tracksErr } = await admin
      .from("tracks")
      .select("id, spotify_id")
      .in("id", trackIds);
    if (tracksErr) {
      return jsonResponse({ error: "read_failed", message: tracksErr.message }, 500);
    }
    for (const t of tracks ?? []) {
      if (t.spotify_id) {
        pushable.push(t.spotify_id);
      } else {
        unavailable.push(t.id);
      }
    }
  }

  if (unavailable.length > 0) {
    await admin.from("mirror_track_errors").insert(
      unavailable.map((track_id) => ({
        mirror_target_id: payload.mirror_target_id,
        track_id,
        error_type: "track_not_on_spotify",
      })),
    );
  }

  let pushed = 0;
  if (pushable.length > 0) {
    try {
      pushed = await addTracksToPlaylist(
        accessToken,
        payload.native_playlist_id,
        pushable,
      );
    } catch (err) {
      const msg = `backfill: ${(err as Error).message}`;
      await admin.from("mirror_targets")
        .update({ last_sync_error: msg })
        .eq("id", payload.mirror_target_id);
      return jsonResponse({ error: "push_failed", message: msg }, 502);
    }
  }

  await admin.from("mirror_targets")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: null,
    })
    .eq("id", payload.mirror_target_id);

  return jsonResponse({
    ok: true,
    pushed,
    skipped: unavailable.length,
  }, 200);
});
