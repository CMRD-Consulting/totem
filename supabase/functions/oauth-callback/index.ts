// Spotify OAuth callback — exchanges code, creates a mirror playlist on Spotify,
// persists tokens + mirror_target. Returns a small HTML page that closes the
// in-app browser when running inside Capacitor.

import { exchangeCode, getCurrentUser, createPlaylist } from "../_shared/spotify.ts";
import { supabaseAsUser, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";
import { OAUTH_STATE_MAX_AGE_MS } from "../_shared/oauthState.ts";

/** Look up a state row by token, enforcing the freshness window. The row is
 * deleted as a side effect — state tokens are single-use, so even if the
 * caller's flow fails after this point the token can't be replayed. */
export async function consumeStateToken(
  admin: ReturnType<typeof supabaseAdmin>,
  stateToken: string,
): Promise<{ jwt: string; playlist_id: string | null } | null> {
  const { data: row } = await admin
    .from("oauth_states")
    .select("jwt, playlist_id, created_at")
    .eq("state_token", stateToken)
    .maybeSingle();
  if (!row) return null;
  // Best-effort delete — if it fails (e.g. row already gone), proceed
  // anyway. The created_at check below is the authoritative freshness gate.
  await admin.from("oauth_states").delete().eq("state_token", stateToken);
  const age = Date.now() - new Date(row.created_at).getTime();
  if (age > OAUTH_STATE_MAX_AGE_MS) return null;
  return { jwt: row.jwt, playlist_id: row.playlist_id };
}

const REQUIRED_SCOPES = ["playlist-modify-private", "playlist-modify-public"];

/** Build a small HTML page the in-app browser can render. */
function htmlPage(opts: { title: string; body: string; close?: boolean }): Response {
  return corsResponse(
    `<!doctype html><html><body style="font-family: -apple-system, sans-serif; padding: 40px; text-align: center; max-width: 480px; margin: 0 auto; line-height: 1.5;">
      <h2 style="font-weight: 600; margin-bottom: 16px;">${opts.title}</h2>
      <div style="color: #555;">${opts.body}</div>
      ${opts.close ? '<script>setTimeout(() => window.close(), 600);</script>' : ''}
    </body></html>`,
    { headers: { "Content-Type": "text/html" }, status: 200 },
  );
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // Spotify can hand us an error directly via ?error= when the user denies.
  const userDenied = url.searchParams.get("error");
  if (userDenied) {
    return htmlPage({
      title: "Mirror not connected",
      body: `Spotify reported "${userDenied}". You can close this window and try again.`,
    });
  }
  if (!code || !state) return corsResponse("Missing code or state", { status: 400 });

  const admin = supabaseAdmin();
  const resolved = await consumeStateToken(admin, state);
  if (!resolved) {
    return htmlPage({
      title: "OAuth state expired",
      body: "The Spotify sign-in link is no longer valid (single-use, 10 minute window). Start the connect flow again from the app.",
    });
  }
  const playlist_id: string | undefined = resolved.playlist_id ?? undefined;
  const jwt = resolved.jwt;

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;

  // Step 1: code → tokens.
  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri);
  } catch (err) {
    console.error("exchangeCode failed", err);
    return htmlPage({
      title: "Couldn't finish Spotify sign-in",
      body: `Token exchange failed: ${(err as Error).message}.`,
    });
  }

  // Step 2: verify the granted scopes include what we need to write playlists.
  // Spotify quietly downgrades scopes when the user doesn't grant all requested.
  const granted = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
  const missing = REQUIRED_SCOPES.filter((s) => !granted.includes(s));
  if (missing.length > 0) {
    return htmlPage({
      title: "Mirror needs more permission",
      body: `Spotify didn't grant: <code>${missing.join(", ")}</code>. ` +
        `Try the connect flow again and approve the playlist-modify scope.`,
    });
  }

  // Step 3: who is this Spotify user?
  let spotifyUser;
  try {
    spotifyUser = await getCurrentUser(tokens.access_token);
  } catch (err) {
    console.error("getCurrentUser failed", err);
    return htmlPage({
      title: "Couldn't read your Spotify profile",
      body: (err as Error).message,
    });
  }

  // Step 4: confirm the Totem playlist exists + the user can see it.
  const userClient = supabaseAsUser(jwt);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return htmlPage({
      title: "Session expired",
      body: "Sign in again, then re-try the mirror connect.",
    });
  }

  // Always persist the OAuth tokens — both the per-playlist (Mirror page) and
  // connection-only (Settings "Connect Spotify") flows want this row.
  // admin client was already created above for consumeStateToken.
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

  // Connection-only flow: no playlist_id in state means the user is just
  // setting up Spotify in Settings. Stop here — no native playlist, no
  // mirror_target. Future mirror creation reuses these tokens directly.
  if (!playlist_id) {
    return htmlPage({
      title: "Spotify connected",
      body:
        `You're connected as <b>${spotifyUser.id}</b>. New playlists you join can now mirror to your Spotify automatically.`,
      close: true,
    });
  }

  // Per-playlist flow: create the native Spotify playlist + mirror_target row.
  const { data: playlistRow } = await userClient
    .from("playlists")
    .select("id, name, description")
    .eq("id", playlist_id)
    .single();
  if (!playlistRow) {
    return htmlPage({
      title: "Playlist not found",
      body: "Either it was deleted or you're no longer a member.",
    });
  }

  let spotifyPlaylist;
  try {
    spotifyPlaylist = await createPlaylist(
      tokens.access_token,
      spotifyUser.id,
      `Totem: ${playlistRow.name}`,
      playlistRow.description ?? "Mirrored from Totem",
    );
  } catch (err) {
    const msg = (err as Error).message;
    console.error("createPlaylist failed", msg);
    // Spotify returns 403 from createPlaylist for two common reasons:
    //   1. The Spotify app is in Development Mode and this user isn't on
    //      the Users-and-Access allowlist. Most likely cause for new apps.
    //   2. The token genuinely lacks playlist-modify scope (caught above).
    if (msg.includes("403")) {
      return htmlPage({
        title: "Spotify rejected the request",
        body:
          "Spotify returned 403 Forbidden. The most common cause is " +
          "<b>Development Mode restriction</b> — open developer.spotify.com → " +
          "your app → Users and Access, and add this Spotify account's email." +
          `<br><br><pre style="text-align: left; background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 11px; line-height: 1.4;">${
            JSON.stringify(spotifyUser, null, 2)
          }</pre>`,
      });
    }
    return htmlPage({
      title: "Couldn't create mirror playlist",
      body: msg,
    });
  }

  await admin.from("mirror_targets").insert({
    user_id: user.id,
    playlist_id: playlist_id,
    service: "spotify",
    native_playlist_id: spotifyPlaylist.id,
  });

  // v0 limitation: existing playlist tracks are not backfilled into the new
  // Spotify mirror — only future inserts will sync via the trigger.
  return htmlPage({
    title: "Mirror connected",
    body:
      `New tracks added by anyone in <b>${playlistRow.name}</b> will now appear in your Spotify.` +
      `<br><br><pre style="text-align: left; background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 11px; line-height: 1.4;">${
        JSON.stringify(spotifyUser, null, 2)
      }</pre>`,
    close: true,
  });
});
