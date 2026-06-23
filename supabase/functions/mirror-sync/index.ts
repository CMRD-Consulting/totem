import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";
import { MUSIC_SERVICES, type MusicService } from "../_shared/musicService.ts";
import {
  refreshConnectionToken,
  syncTrackChange,
  trackIdFromRow,
  trackNotOnError,
} from "../_shared/mirrorHelpers.ts";

export { isTokenExpired } from "../_shared/musicService.ts";

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
    .select("spotify_id, apple_music_id, youtube_music_id")
    .eq("id", payload.track_id)
    .single();
  if (trackErr || !track) return corsResponse("Track not found", { status: 404 });

  const { data: targets, error: targetsErr } = await admin
    .from("mirror_targets")
    .select("id, user_id, native_playlist_id, service")
    .eq("playlist_id", payload.playlist_id)
    .eq("enabled", true);
  if (targetsErr) return corsResponse(targetsErr.message, { status: 500 });
  if (!targets?.length) return corsResponse("No mirror targets", { status: 200 });

  const results: { target: string; ok: boolean; error?: string }[] = [];

  for (const target of targets) {
    const service = target.service as MusicService;
    if (!MUSIC_SERVICES.includes(service)) {
      results.push({ target: target.id, ok: false, error: "unsupported_service" });
      continue;
    }

    const serviceTrackId = trackIdFromRow(service, track);
    if (!serviceTrackId) {
      await admin.from("mirror_track_errors").insert({
        mirror_target_id: target.id,
        track_id: payload.track_id,
        error_type: trackNotOnError(service),
      });
      results.push({ target: target.id, ok: false, error: trackNotOnError(service) });
      continue;
    }

    const { data: conn } = await admin
      .from("service_connections")
      .select("access_token, refresh_token, expires_at, service_user_id")
      .eq("user_id", target.user_id)
      .eq("service", service)
      .single();
    if (!conn) {
      results.push({ target: target.id, ok: false, error: "no_connection" });
      continue;
    }

    let accessToken: string;
    try {
      accessToken = await refreshConnectionToken(admin, target.user_id, service, conn);
    } catch (err) {
      const msg = (err as Error).message;
      await admin.from("mirror_targets")
        .update({ last_sync_error: `refresh_failed: ${msg}` })
        .eq("id", target.id);
      results.push({ target: target.id, ok: false, error: "refresh_failed" });
      continue;
    }

    try {
      await syncTrackChange(
        service,
        payload.op,
        accessToken,
        target.native_playlist_id,
        serviceTrackId,
      );
      await admin.from("mirror_targets")
        .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
        .eq("id", target.id);
      results.push({ target: target.id, ok: true });
    } catch (err) {
      const msg = (err as Error).message;
      const syncError = /401|403|invalid_grant/i.test(msg) ? "reauth_required" : msg;
      await admin.from("mirror_targets")
        .update({ last_sync_error: syncError })
        .eq("id", target.id);
      results.push({ target: target.id, ok: false, error: syncError });
    }
  }

  return corsResponse(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
