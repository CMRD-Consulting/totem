import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";
import { parseMusicService, type MusicService } from "../_shared/musicService.ts";
import {
  backfillTracks,
  refreshConnectionToken,
  trackIdFromRow,
  trackNotOnError,
} from "../_shared/mirrorHelpers.ts";

interface Payload {
  mirror_target_id: string;
  user_id: string;
  playlist_id: string;
  native_playlist_id: string;
  service: string;
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

  const service = parseMusicService(payload.service);
  if (!service) {
    return jsonResponse({ ok: true, skipped: "unsupported_service" }, 200);
  }

  const admin = supabaseAdmin();

  const { data: conn } = await admin
    .from("service_connections")
    .select("access_token, refresh_token, expires_at, service_user_id")
    .eq("user_id", payload.user_id)
    .eq("service", service)
    .single();
  if (!conn) {
    await admin.from("mirror_targets")
      .update({ last_sync_error: "backfill: no_connection" })
      .eq("id", payload.mirror_target_id);
    return jsonResponse({ error: "no_connection" }, 400);
  }

  let accessToken: string;
  try {
    accessToken = await refreshConnectionToken(admin, payload.user_id, service, conn);
  } catch (err) {
    const msg = `backfill: refresh_failed: ${(err as Error).message}`;
    await admin.from("mirror_targets")
      .update({ last_sync_error: msg })
      .eq("id", payload.mirror_target_id);
    return jsonResponse({ error: "refresh_failed" }, 502);
  }

  const { data: ptRows, error: ptErr } = await admin
    .from("playlist_tracks")
    .select("track_id")
    .eq("playlist_id", payload.playlist_id);
  if (ptErr) {
    return jsonResponse({ error: "read_failed", message: ptErr.message }, 500);
  }
  const trackIds = (ptRows ?? []).map((row) => row.track_id);

  const pushable: string[] = [];
  const unavailable: string[] = [];
  if (trackIds.length > 0) {
    const { data: tracks, error: tracksErr } = await admin
      .from("tracks")
      .select("id, spotify_id, apple_music_id, youtube_music_id")
      .in("id", trackIds);
    if (tracksErr) {
      return jsonResponse({ error: "read_failed", message: tracksErr.message }, 500);
    }
    for (const track of tracks ?? []) {
      const serviceTrackId = trackIdFromRow(service, track);
      if (serviceTrackId) {
        pushable.push(serviceTrackId);
      } else {
        unavailable.push(track.id);
      }
    }
  }

  if (unavailable.length > 0) {
    await admin.from("mirror_track_errors").insert(
      unavailable.map((track_id) => ({
        mirror_target_id: payload.mirror_target_id,
        track_id,
        error_type: trackNotOnError(service),
      })),
    );
  }

  let pushed = 0;
  if (pushable.length > 0) {
    try {
      pushed = await backfillTracks(
        service,
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
