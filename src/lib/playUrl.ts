import type { ServiceKey } from '@/types';

export function playUrlForService(
  service: ServiceKey,
  ids: Partial<Record<ServiceKey, string | null>>,
): string | null {
  const spotifyId = ids.spotify;
  const appleId = ids.apple;
  const youtubeId = ids.youtube;
  if (service === 'spotify' && spotifyId) {
    return `https://open.spotify.com/track/${spotifyId}`;
  }
  if (service === 'apple' && appleId) {
    return `https://music.apple.com/song/${appleId}`;
  }
  if (service === 'youtube' && youtubeId) {
    return `https://music.youtube.com/watch?v=${youtubeId}`;
  }
  if (spotifyId) return `https://open.spotify.com/track/${spotifyId}`;
  if (appleId) return `https://music.apple.com/song/${appleId}`;
  if (youtubeId) return `https://music.youtube.com/watch?v=${youtubeId}`;
  return null;
}
