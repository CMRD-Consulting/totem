import type { ServiceKey } from '@/types';

export type MusicService = 'spotify' | 'apple_music' | 'youtube_music';

const TO_DB: Record<ServiceKey, MusicService> = {
  spotify: 'spotify',
  apple: 'apple_music',
  youtube: 'youtube_music',
};

const FROM_DB: Record<MusicService, ServiceKey> = {
  spotify: 'spotify',
  apple_music: 'apple',
  youtube_music: 'youtube',
};

export function toMusicService(key: ServiceKey): MusicService {
  return TO_DB[key];
}

export function fromMusicService(service: MusicService): ServiceKey {
  return FROM_DB[service];
}

export function isMusicService(value: string): value is MusicService {
  return value === 'spotify' || value === 'apple_music' || value === 'youtube_music';
}
