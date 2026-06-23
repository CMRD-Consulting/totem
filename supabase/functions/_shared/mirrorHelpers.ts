import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  addTracksToPlaylist as addAppleTracks,
  addTrackToPlaylist as addAppleTrack,
  createDeveloperToken,
  createLibraryPlaylist,
  removeTrackFromPlaylist as removeAppleTrack,
} from "./appleMusic.ts";
import {
  isReauthError,
  isTokenExpired,
  type MusicService,
  TRACK_ID_COLUMN,
  TRACK_NOT_ON_ERROR,
} from "./musicService.ts";
import {
  addTrackToPlaylist as addSpotifyTrack,
  addTracksToPlaylist as addSpotifyTracks,
  createPlaylist as createSpotifyPlaylist,
  refreshAccessToken as refreshSpotifyToken,
  removeTrackFromPlaylist as removeSpotifyTrack,
} from "./spotify.ts";
import {
  addVideoToPlaylist as addYouTubeVideo,
  addVideosToPlaylist as addYouTubeVideos,
  createPlaylist as createYouTubePlaylist,
  refreshAccessToken as refreshYouTubeToken,
  removeVideoFromPlaylist as removeYouTubeVideo,
} from "./youtube.ts";

interface ServiceConnection {
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  service_user_id: string;
}

export async function refreshConnectionToken(
  admin: SupabaseClient,
  userId: string,
  service: MusicService,
  conn: ServiceConnection,
): Promise<string> {
  if (service === "apple_music") return conn.access_token;
  if (!isTokenExpired(conn.expires_at) || !conn.refresh_token) {
    return conn.access_token;
  }

  try {
    const fresh = service === "spotify"
      ? await refreshSpotifyToken(conn.refresh_token)
      : await refreshYouTubeToken(conn.refresh_token);
    await admin.from("service_connections")
      .update({
        access_token: fresh.access_token,
        expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("service", service);
    return fresh.access_token;
  } catch (err) {
    const message = (err as Error).message;
    if (isReauthError(message)) {
      await admin.from("mirror_targets")
        .update({ last_sync_error: "reauth_required" })
        .eq("user_id", userId)
        .eq("service", service);
    }
    throw err;
  }
}

export async function createNativePlaylist(
  service: MusicService,
  accessToken: string,
  serviceUserId: string,
  name: string,
  description: string,
): Promise<{ id: string }> {
  if (service === "spotify") {
    return createSpotifyPlaylist(accessToken, serviceUserId, name, description);
  }
  if (service === "youtube_music") {
    return createYouTubePlaylist(accessToken, name, description);
  }
  const developerToken = await createDeveloperToken();
  return createLibraryPlaylist(developerToken, accessToken, name, description);
}

export async function syncTrackChange(
  service: MusicService,
  op: "insert" | "delete",
  accessToken: string,
  nativePlaylistId: string,
  serviceTrackId: string,
): Promise<void> {
  if (service === "spotify") {
    if (op === "insert") {
      await addSpotifyTrack(accessToken, nativePlaylistId, serviceTrackId);
    } else {
      await removeSpotifyTrack(accessToken, nativePlaylistId, serviceTrackId);
    }
    return;
  }
  if (service === "youtube_music") {
    if (op === "insert") {
      await addYouTubeVideo(accessToken, nativePlaylistId, serviceTrackId);
    } else {
      await removeYouTubeVideo(accessToken, nativePlaylistId, serviceTrackId);
    }
    return;
  }
  const developerToken = await createDeveloperToken();
  if (op === "insert") {
    await addAppleTrack(developerToken, accessToken, nativePlaylistId, serviceTrackId);
  } else {
    await removeAppleTrack(developerToken, accessToken, nativePlaylistId, serviceTrackId);
  }
}

export async function backfillTracks(
  service: MusicService,
  accessToken: string,
  nativePlaylistId: string,
  serviceTrackIds: string[],
): Promise<number> {
  if (serviceTrackIds.length === 0) return 0;
  if (service === "spotify") {
    return addSpotifyTracks(accessToken, nativePlaylistId, serviceTrackIds);
  }
  if (service === "youtube_music") {
    return addYouTubeVideos(accessToken, nativePlaylistId, serviceTrackIds);
  }
  const developerToken = await createDeveloperToken();
  return addAppleTracks(developerToken, accessToken, nativePlaylistId, serviceTrackIds);
}

export function trackIdFromRow(
  service: MusicService,
  track: Record<string, string | null>,
): string | null {
  const column = TRACK_ID_COLUMN[service];
  return track[column] ?? null;
}

export function trackNotOnError(service: MusicService): string {
  return TRACK_NOT_ON_ERROR[service];
}
