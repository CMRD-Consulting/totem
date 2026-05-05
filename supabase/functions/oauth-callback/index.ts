// Spotify OAuth callback — exchanges code, creates a mirror playlist on Spotify,
// persists tokens + mirror_target. Returns a small HTML page that closes the
// in-app browser when running inside Capacitor.

import { exchangeCode, getCurrentUser, createPlaylist } from "../_shared/spotify.ts";
import { supabaseAsUser, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";

export function decodeState(state: string): { playlist_id: string; jwt: string } {
  return JSON.parse(atob(state));
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return corsResponse("Missing code or state", { status: 400 });

  const { playlist_id, jwt } = decodeState(state);
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;

  const tokens = await exchangeCode(code, redirectUri);
  const spotifyUser = await getCurrentUser(tokens.access_token);

  const userClient = supabaseAsUser(jwt);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return corsResponse("Unauthorized", { status: 401 });

  const { data: playlistRow } = await userClient
    .from("playlists")
    .select("id, name, description")
    .eq("id", playlist_id)
    .single();
  if (!playlistRow) return corsResponse("Playlist not accessible", { status: 403 });

  const spotifyPlaylist = await createPlaylist(
    tokens.access_token,
    spotifyUser.id,
    `Totem: ${playlistRow.name}`,
    playlistRow.description ?? "Mirrored from Totem",
  );

  const admin = supabaseAdmin();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await admin.from("service_connections").upsert({
    user_id: user.id,
    service: "spotify",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: expiresAt,
    service_user_id: spotifyUser.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,service" });

  await admin.from("mirror_targets").insert({
    user_id: user.id,
    playlist_id: playlist_id,
    service: "spotify",
    native_playlist_id: spotifyPlaylist.id,
  });

  // v0 limitation: existing playlist tracks are not backfilled into the new
  // Spotify mirror — only future inserts will sync via the trigger.
  return corsResponse(
    `<!doctype html><html><body style="font-family: -apple-system, sans-serif; padding: 40px; text-align: center;">
      <p>Mirror connected. You can close this window.</p>
      <script>window.close();</script>
    </body></html>`,
    { headers: { "Content-Type": "text/html" }, status: 200 },
  );
});
