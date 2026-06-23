import { exchangeCode as exchangeSpotifyCode, getCurrentUser as getSpotifyUser, createPlaylist as createSpotifyPlaylist } from "../_shared/spotify.ts";
import { exchangeCode as exchangeYouTubeCode, getCurrentChannel, createPlaylist as createYouTubePlaylist } from "../_shared/youtube.ts";
import { supabaseAsUser, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";
import { OAUTH_STATE_MAX_AGE_MS } from "../_shared/oauthState.ts";
import { parseMusicService, type MusicService } from "../_shared/musicService.ts";

export async function consumeStateToken(
  admin: ReturnType<typeof supabaseAdmin>,
  stateToken: string,
): Promise<{ jwt: string; playlist_id: string | null; service: MusicService } | null> {
  const { data: row } = await admin
    .from("oauth_states")
    .select("jwt, playlist_id, service, created_at")
    .eq("state_token", stateToken)
    .maybeSingle();
  if (!row) return null;
  await admin.from("oauth_states").delete().eq("state_token", stateToken);
  const age = Date.now() - new Date(row.created_at).getTime();
  if (age > OAUTH_STATE_MAX_AGE_MS) return null;
  const service = parseMusicService(row.service) ?? "spotify";
  return { jwt: row.jwt, playlist_id: row.playlist_id, service };
}

const SPOTIFY_REQUIRED_SCOPES = ["playlist-modify-private", "playlist-modify-public"];

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

function serviceLabel(service: MusicService): string {
  if (service === "youtube_music") return "YouTube Music";
  return "Spotify";
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const userDenied = url.searchParams.get("error");
  if (userDenied) {
    return htmlPage({
      title: "Mirror not connected",
      body: `The provider reported "${userDenied}". You can close this window and try again.`,
    });
  }
  if (!code || !state) return corsResponse("Missing code or state", { status: 400 });

  const admin = supabaseAdmin();
  const resolved = await consumeStateToken(admin, state);
  if (!resolved) {
    return htmlPage({
      title: "OAuth state expired",
      body: "The sign-in link is no longer valid (single-use, 10 minute window). Start the connect flow again from the app.",
    });
  }

  const { jwt, playlist_id, service } = resolved;
  const label = serviceLabel(service);
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;

  let tokens: { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
  try {
    tokens = service === "youtube_music"
      ? await exchangeYouTubeCode(code, redirectUri)
      : await exchangeSpotifyCode(code, redirectUri);
  } catch (err) {
    console.error("token exchange failed", err);
    return htmlPage({
      title: `Couldn't finish ${label} sign-in`,
      body: `Token exchange failed: ${(err as Error).message}.`,
    });
  }

  if (service === "spotify") {
    const granted = (tokens.scope ?? "").split(/\s+/).filter(Boolean);
    const missing = SPOTIFY_REQUIRED_SCOPES.filter((scope) => !granted.includes(scope));
    if (missing.length > 0) {
      return htmlPage({
        title: "Mirror needs more permission",
        body: `Spotify didn't grant: <code>${missing.join(", ")}</code>. Try again and approve playlist-modify.`,
      });
    }
  }

  let serviceUserId: string;
  let serviceUserLabel: string;
  try {
    if (service === "youtube_music") {
      const channel = await getCurrentChannel(tokens.access_token);
      serviceUserId = channel.id;
      serviceUserLabel = channel.title;
    } else {
      const spotifyUser = await getSpotifyUser(tokens.access_token);
      serviceUserId = spotifyUser.id;
      serviceUserLabel = spotifyUser.display_name ?? spotifyUser.id;
    }
  } catch (err) {
    console.error("profile read failed", err);
    return htmlPage({
      title: `Couldn't read your ${label} profile`,
      body: (err as Error).message,
    });
  }

  const userClient = supabaseAsUser(jwt);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return htmlPage({
      title: "Session expired",
      body: "Sign in again, then re-try the mirror connect.",
    });
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await admin.from("service_connections").upsert({
    user_id: user.id,
    service,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: expiresAt,
    service_user_id: serviceUserId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,service" });

  if (!playlist_id) {
    return htmlPage({
      title: `${label} connected`,
      body: `You're connected as <b>${serviceUserLabel}</b>. New playlists you join can now mirror automatically.`,
      close: true,
    });
  }

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

  let nativePlaylist: { id: string };
  try {
    nativePlaylist = service === "youtube_music"
      ? await createYouTubePlaylist(
        tokens.access_token,
        `Totem: ${playlistRow.name}`,
        playlistRow.description ?? "Mirrored from Totem",
      )
      : await createSpotifyPlaylist(
        tokens.access_token,
        serviceUserId,
        `Totem: ${playlistRow.name}`,
        playlistRow.description ?? "Mirrored from Totem",
      );
  } catch (err) {
    const msg = (err as Error).message;
    console.error("createPlaylist failed", msg);
    return htmlPage({
      title: "Couldn't create mirror playlist",
      body: msg,
    });
  }

  await admin.from("mirror_targets").insert({
    user_id: user.id,
    playlist_id,
    service,
    native_playlist_id: nativePlaylist.id,
  });

  return htmlPage({
    title: "Mirror connected",
    body: `New tracks added to <b>${playlistRow.name}</b> will now appear in your ${label}.`,
    close: true,
  });
});
