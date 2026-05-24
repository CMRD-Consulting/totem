// Spotify OAuth — kicks off the authorize redirect.
//
// v0 simplification: the user JWT is stuffed into the OAuth `state` parameter
// to round-trip back through Spotify. v1 should swap this for a server-side
// nonce → state cache table to avoid passing user credentials through a third
// party. Acceptable for v0 because state stays HTTPS-only and the JWT is short-lived.

import { corsResponse, handlePreflight } from "../_shared/cors.ts";

const SPOTIFY_AUTHORIZE = "https://accounts.spotify.com/authorize";
const SCOPES =
  "playlist-modify-private playlist-modify-public user-read-private user-read-email";

Deno.serve((req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const playlistId = url.searchParams.get("playlist_id"); // optional — see below
  const userJwt = url.searchParams.get("jwt");
  if (!userJwt) {
    return corsResponse("Missing jwt", { status: 400 });
  }

  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  if (!clientId) return corsResponse("SPOTIFY_CLIENT_ID not set", { status: 500 });

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;
  // playlist_id is optional. Two callers today:
  //   - Mirror page: passes a playlist_id, expects a mirror_target row created
  //     in the callback for that playlist.
  //   - Settings "Connect Spotify": no playlist_id, just stores the OAuth
  //     tokens in service_connections so future per-playlist mirror creation
  //     can skip the OAuth step entirely.
  const stateBody: Record<string, string> = { jwt: userJwt };
  if (playlistId) stateBody.playlist_id = playlistId;
  const state = btoa(JSON.stringify(stateBody));

  const authorizeUrl = new URL(SPOTIFY_AUTHORIZE);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", SCOPES);
  authorizeUrl.searchParams.set("state", state);

  return Response.redirect(authorizeUrl.toString(), 302);
});
