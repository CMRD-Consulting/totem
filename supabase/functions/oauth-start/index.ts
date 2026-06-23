import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";
import {
  generateStateToken,
  OAUTH_STATE_MAX_AGE_MS,
} from "../_shared/oauthState.ts";
import { parseMusicService, type MusicService } from "../_shared/musicService.ts";
import { youtubeAuthorizeUrl } from "../_shared/youtube.ts";

const SPOTIFY_AUTHORIZE = "https://accounts.spotify.com/authorize";
const SPOTIFY_SCOPES =
  "playlist-modify-private playlist-modify-public user-read-private user-read-email";

const OAUTH_SERVICES: MusicService[] = ["spotify", "youtube_music"];

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const playlistId = url.searchParams.get("playlist_id");
  const userJwt = url.searchParams.get("jwt");
  const service = parseMusicService(url.searchParams.get("service")) ?? "spotify";

  if (!userJwt) {
    return corsResponse("Missing jwt", { status: 400 });
  }
  if (!OAUTH_SERVICES.includes(service)) {
    return corsResponse(
      "Apple Music uses the in-app connect flow; pass service=spotify or service=youtube_music",
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();

  await admin
    .from("oauth_states")
    .delete()
    .lt("created_at", new Date(Date.now() - OAUTH_STATE_MAX_AGE_MS).toISOString());

  const stateToken = generateStateToken();
  const { error: insErr } = await admin.from("oauth_states").insert({
    state_token: stateToken,
    jwt: userJwt,
    playlist_id: playlistId,
    service,
  });
  if (insErr) {
    return corsResponse(`Failed to record state: ${insErr.message}`, { status: 500 });
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;

  if (service === "youtube_music") {
    const clientId = Deno.env.get("YOUTUBE_CLIENT_ID");
    if (!clientId) return corsResponse("YOUTUBE_CLIENT_ID not set", { status: 500 });
    const authorizeUrl = youtubeAuthorizeUrl(clientId, redirectUri, stateToken);
    return Response.redirect(authorizeUrl, 302);
  }

  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  if (!clientId) return corsResponse("SPOTIFY_CLIENT_ID not set", { status: 500 });

  const authorizeUrl = new URL(SPOTIFY_AUTHORIZE);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", SPOTIFY_SCOPES);
  authorizeUrl.searchParams.set("state", stateToken);

  return Response.redirect(authorizeUrl.toString(), 302);
});
