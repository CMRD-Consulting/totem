import { resolveSonglink, SonglinkResult } from "../_shared/songlink.ts";
import { supabaseAsUser, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";

interface TrackRow {
  isrc: string | null;
  title: string;
  artist: string;
  album: string | null;
  artwork_url: string | null;
  duration_ms: number | null;
  spotify_id: string | null;
  apple_music_id: string | null;
  youtube_music_id: string | null;
  songlink_url: string | null;
}

export function resolveTrackRow(s: SonglinkResult): TrackRow {
  return {
    isrc: s.isrc ?? null,
    title: s.title,
    artist: s.artist,
    album: s.album ?? null,
    artwork_url: s.artworkUrl ?? null,
    duration_ms: s.durationMs ?? null,
    spotify_id: s.spotifyId ?? null,
    apple_music_id: s.appleMusicId ?? null,
    youtube_music_id: s.youtubeMusicId ?? null,
    songlink_url: s.songlinkUrl ?? null,
  };
}

async function findExistingTrackId(
  admin: ReturnType<typeof supabaseAdmin>,
  row: TrackRow,
): Promise<string | null> {
  const candidates: { col: string; val: string }[] = [];
  if (row.isrc) candidates.push({ col: "isrc", val: row.isrc });
  if (row.spotify_id) candidates.push({ col: "spotify_id", val: row.spotify_id });
  if (row.apple_music_id) candidates.push({ col: "apple_music_id", val: row.apple_music_id });
  if (row.youtube_music_id) candidates.push({ col: "youtube_music_id", val: row.youtube_music_id });

  for (const c of candidates) {
    const { data, error } = await admin
      .from("tracks")
      .select("id")
      .eq(c.col, c.val)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;
  }
  return null;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return corsResponse("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return corsResponse("Unauthorized", { status: 401 });
  }
  const jwt = authHeader.slice(7);

  const body = await req.json().catch(() => null);
  if (!body?.url || !body?.playlist_id) {
    return corsResponse("Missing url or playlist_id", { status: 400 });
  }

  // Membership check via user-scoped client (RLS enforces it).
  const userClient = supabaseAsUser(jwt);
  const { data: membership } = await userClient
    .from("playlist_members")
    .select("playlist_id")
    .eq("playlist_id", body.playlist_id)
    .maybeSingle();
  if (!membership) {
    return corsResponse("Not a member of this playlist", { status: 403 });
  }

  // Resolve via Songlink.
  let songlink: SonglinkResult;
  try {
    songlink = await resolveSonglink(body.url);
  } catch (err) {
    console.error("Songlink failed", err);
    return corsResponse(
      `Could not resolve URL: ${(err as Error).message}`,
      { status: 502 },
    );
  }

  const trackRow = resolveTrackRow(songlink);
  const admin = supabaseAdmin();

  let trackId = await findExistingTrackId(admin, trackRow);
  if (!trackId) {
    const { data, error } = await admin.from("tracks").insert(trackRow).select("id").single();
    if (error) {
      console.error("track insert failed", error);
      return corsResponse(`Track insert failed: ${error.message}`, { status: 500 });
    }
    trackId = data.id;
  }

  // Determine next position (max + 1).
  const { data: maxRow } = await admin
    .from("playlist_tracks")
    .select("position")
    .eq("playlist_id", body.playlist_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? 0) + 1.0;

  // Get the user id from JWT.
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return corsResponse("Unauthorized", { status: 401 });

  const { error: insertErr } = await admin.from("playlist_tracks").insert({
    playlist_id: body.playlist_id,
    track_id: trackId,
    added_by: user.id,
    position: nextPosition,
  });
  if (insertErr) {
    console.error("playlist_track insert failed", insertErr);
    return corsResponse(`Insert failed: ${insertErr.message}`, { status: 500 });
  }

  return corsResponse(JSON.stringify({ track_id: trackId }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
