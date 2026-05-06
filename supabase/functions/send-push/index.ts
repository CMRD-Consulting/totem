// send-push: handles a playlist_track INSERT webhook fired by the pg_net
// trigger and pushes a notification to every member of the playlist except
// the adder.
//
// Looks up the track's title + artist + adder display name to build the
// notification copy ("Maya added Ribs — Lorde"), then fans out one APNs
// HTTP/2 POST per device token. Stale tokens (BadDeviceToken / Unregistered)
// are removed from device_tokens so they don't accumulate.

import { sendApnsPush } from "../_shared/apns.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";

interface Payload {
  op: "insert" | "delete";
  playlist_track_id: string;
  playlist_id: string;
  track_id: string;
  added_by: string;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return corsResponse("Method not allowed", { status: 405 });

  const payload = (await req.json()) as Payload;
  // Only push on inserts. Deletes don't earn a notification in v0.
  if (payload.op !== "insert") return corsResponse("ignored", { status: 200 });

  const admin = supabaseAdmin();

  // Fetch the track row + adder profile + playlist name in one round-trip
  // via PostgREST embeds. The trigger payload carries the playlist_track row
  // id as playlist_track_id; we use that as the join key.
  const { data: row, error: rowErr } = await admin
    .from("playlist_tracks")
    .select(`
      added_by,
      track:tracks ( title, artist ),
      playlist:playlists ( id, name ),
      adder:profiles!playlist_tracks_added_by_fkey ( display_name )
    `)
    .eq("id", payload.playlist_track_id)
    .maybeSingle();
  if (rowErr || !row) return corsResponse("playlist_track not found", { status: 404 });

  const adderName =
    (row.adder as unknown as { display_name: string } | null)?.display_name ?? "Someone";
  const track = row.track as unknown as { title: string; artist: string } | null;
  const playlistName =
    (row.playlist as unknown as { name: string } | null)?.name ?? "a playlist";
  if (!track) return corsResponse("track missing", { status: 404 });

  // Members of the playlist, minus the adder.
  const { data: members } = await admin
    .from("playlist_members")
    .select("user_id")
    .eq("playlist_id", payload.playlist_id)
    .neq("user_id", payload.added_by);

  const recipientIds = (members ?? []).map((m) => m.user_id);
  if (!recipientIds.length) return corsResponse("no recipients", { status: 200 });

  // All iOS device tokens for those users.
  const { data: tokenRows } = await admin
    .from("device_tokens")
    .select("user_id, token")
    .in("user_id", recipientIds)
    .eq("platform", "ios");

  const tokens = tokenRows ?? [];
  if (!tokens.length) return corsResponse("no tokens", { status: 200 });

  const title = `${adderName} added "${track.title}"`;
  const body = `${track.artist} · in ${playlistName}`;

  const results: { token: string; ok: boolean; error?: string }[] = [];
  const stale: string[] = [];
  for (const t of tokens) {
    const err = await sendApnsPush(t.token, {
      title,
      body,
      data: { playlist_id: payload.playlist_id },
    });
    if (err) {
      results.push({ token: t.token.slice(0, 8) + "…", ok: false, error: err });
      // Apple says BadDeviceToken / Unregistered means stop sending — clean up.
      if (err.includes("BadDeviceToken") || err.includes("Unregistered")) {
        stale.push(t.token);
      }
    } else {
      results.push({ token: t.token.slice(0, 8) + "…", ok: true });
    }
  }

  if (stale.length) {
    await admin.from("device_tokens").delete().in("token", stale);
  }

  return corsResponse(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
