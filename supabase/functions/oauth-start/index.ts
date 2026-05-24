// Spotify OAuth — kicks off the authorize redirect.
//
// State handling (v1): the OAuth `state` round-trip now carries a random
// single-use token instead of a base64'd JSON blob containing the user's
// JWT. The actual jwt + playlist_id are stored server-side in oauth_states
// and looked up by token in oauth-callback. This keeps the JWT off the
// Spotify redirect URL (browser history, URL logging, referrers).

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";
import {
  generateStateToken,
  OAUTH_STATE_MAX_AGE_MS,
} from "../_shared/oauthState.ts";

const SPOTIFY_AUTHORIZE = "https://accounts.spotify.com/authorize";
const SCOPES =
  "playlist-modify-private playlist-modify-public user-read-private user-read-email";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const playlistId = url.searchParams.get("playlist_id"); // optional
  const userJwt = url.searchParams.get("jwt");
  if (!userJwt) {
    return corsResponse("Missing jwt", { status: 400 });
  }

  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  if (!clientId) return corsResponse("SPOTIFY_CLIENT_ID not set", { status: 500 });

  const admin = supabaseAdmin();

  // Opportunistic cleanup: sweep rows older than the single-use window.
  // oauth-start is the only writer to this table, so this is the natural
  // place to run it — no separate cron job needed.
  await admin
    .from("oauth_states")
    .delete()
    .lt("created_at", new Date(Date.now() - OAUTH_STATE_MAX_AGE_MS).toISOString());

  const stateToken = generateStateToken();
  const { error: insErr } = await admin.from("oauth_states").insert({
    state_token: stateToken,
    jwt: userJwt,
    playlist_id: playlistId,
  });
  if (insErr) {
    return corsResponse(`Failed to record state: ${insErr.message}`, { status: 500 });
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;
  const authorizeUrl = new URL(SPOTIFY_AUTHORIZE);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", SCOPES);
  authorizeUrl.searchParams.set("state", stateToken);

  return Response.redirect(authorizeUrl.toString(), 302);
});
