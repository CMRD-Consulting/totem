import {
  appleTokenExpiry,
  createDeveloperToken,
  createLibraryPlaylist,
  getStorefront,
} from "../_shared/appleMusic.ts";
import { supabaseAdmin, supabaseAsUser } from "../_shared/supabaseAdmin.ts";
import { corsResponse, handlePreflight } from "../_shared/cors.ts";

interface Payload {
  user_token: string;
  playlist_id?: string;
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
  if (req.method !== "POST") return corsResponse("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return jsonResponse({ error: "unauthenticated" }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "");

  let payload: Payload;
  try {
    payload = await req.json() as Payload;
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }
  if (!payload.user_token?.trim()) {
    return jsonResponse({ error: "missing_user_token" }, 400);
  }

  const userClient = supabaseAsUser(jwt);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: "session_invalid" }, 401);

  const admin = supabaseAdmin();
  const userToken = payload.user_token.trim();
  const developerToken = await createDeveloperToken();

  let storefront: string;
  try {
    storefront = await getStorefront(developerToken, userToken);
  } catch (err) {
    return jsonResponse({ error: "apple_profile_failed", message: (err as Error).message }, 502);
  }

  await admin.from("service_connections").upsert({
    user_id: user.id,
    service: "apple_music",
    access_token: userToken,
    refresh_token: null,
    expires_at: appleTokenExpiry(),
    service_user_id: storefront,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,service" });

  if (!payload.playlist_id) {
    return jsonResponse({ ok: true, service_user_id: storefront }, 200);
  }

  const { data: playlistRow } = await userClient
    .from("playlists")
    .select("id, name, description")
    .eq("id", payload.playlist_id)
    .single();
  if (!playlistRow) {
    return jsonResponse({ error: "playlist_not_found" }, 404);
  }

  const { data: existing } = await admin
    .from("mirror_targets")
    .select("id, native_playlist_id")
    .eq("user_id", user.id)
    .eq("playlist_id", payload.playlist_id)
    .eq("service", "apple_music")
    .maybeSingle();
  if (existing) {
    return jsonResponse({
      ok: true,
      mirror_target_id: existing.id,
      native_playlist_id: existing.native_playlist_id,
      reused: true,
    }, 200);
  }

  let nativePlaylist: { id: string };
  try {
    nativePlaylist = await createLibraryPlaylist(
      developerToken,
      userToken,
      `Totem: ${playlistRow.name}`,
      playlistRow.description ?? "Mirrored from Totem",
    );
  } catch (err) {
    return jsonResponse({ error: "create_failed", message: (err as Error).message }, 502);
  }

  const { data: target, error: insErr } = await admin
    .from("mirror_targets")
    .insert({
      user_id: user.id,
      playlist_id: payload.playlist_id,
      service: "apple_music",
      native_playlist_id: nativePlaylist.id,
    })
    .select("id, native_playlist_id")
    .single();
  if (insErr || !target) {
    return jsonResponse({ error: "insert_failed", message: insErr?.message ?? "unknown" }, 500);
  }

  return jsonResponse({
    ok: true,
    mirror_target_id: target.id,
    native_playlist_id: target.native_playlist_id,
  }, 200);
});
