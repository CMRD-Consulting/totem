export type MusicService = "spotify" | "apple_music" | "youtube_music";

export const MUSIC_SERVICES: MusicService[] = [
  "spotify",
  "apple_music",
  "youtube_music",
];

export const TRACK_ID_COLUMN: Record<MusicService, string> = {
  spotify: "spotify_id",
  apple_music: "apple_music_id",
  youtube_music: "youtube_music_id",
};

export const TRACK_NOT_ON_ERROR: Record<MusicService, string> = {
  spotify: "track_not_on_spotify",
  apple_music: "track_not_on_apple_music",
  youtube_music: "track_not_on_youtube_music",
};

export function parseMusicService(raw: string | null): MusicService | null {
  if (raw === "spotify" || raw === "apple_music" || raw === "youtube_music") {
    return raw;
  }
  return null;
}

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now() + 60_000;
}

export function isReauthError(message: string): boolean {
  return /401|403|invalid_grant|reauth|unauthorized|token.*revoked/i.test(message);
}
