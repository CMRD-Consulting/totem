import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { env } from '@/lib/env';
import { authorizeAppleMusic } from '@/lib/appleMusicAuth';
import { toMusicService, type MusicService } from '@/lib/serviceKey';
import { supabase } from '@/lib/supabase';
import type { ServiceKey } from '@/types';

async function sessionToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Not signed in');
  return data.session.access_token;
}

function oauthStartUrl(service: MusicService, jwt: string, playlistId?: string): string {
  const params = new URLSearchParams({
    jwt,
    service,
  });
  if (playlistId) params.set('playlist_id', playlistId);
  return `${env.supabaseUrl}/functions/v1/oauth-start?${params.toString()}`;
}

async function openOAuthUrl(url: string, onDone: () => Promise<void>): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const sub = await Browser.addListener('browserFinished', async () => {
      await sub.remove();
      await onDone();
    });
    await Browser.open({ url });
    return;
  }
  const popup = window.open(url, '_blank');
  if (!popup) {
    window.location.href = url;
    return;
  }
  const interval = window.setInterval(() => {
    if (popup.closed) {
      window.clearInterval(interval);
      onDone();
    }
  }, 800);
}

export async function connectOAuthService(
  serviceKey: ServiceKey,
  options?: { playlistId?: string; onComplete?: () => Promise<void> },
): Promise<void> {
  const service = toMusicService(serviceKey);
  if (service === 'apple_music') {
    await connectAppleMusic(options?.playlistId);
    await options?.onComplete?.();
    return;
  }
  const jwt = await sessionToken();
  const url = oauthStartUrl(service, jwt, options?.playlistId);
  await openOAuthUrl(url, async () => {
    await options?.onComplete?.();
  });
}

export async function connectAppleMusic(playlistId?: string): Promise<void> {
  const jwt = await sessionToken();
  const devRes = await fetch(`${env.supabaseUrl}/functions/v1/apple-music-developer-token`, {
    headers: { apikey: env.supabaseAnonKey },
  });
  if (!devRes.ok) {
    throw new Error(await devRes.text());
  }
  const { developer_token: developerToken } = await devRes.json() as { developer_token: string };
  const userToken = await authorizeAppleMusic(developerToken);
  const res = await fetch(`${env.supabaseUrl}/functions/v1/connect-apple-music`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      apikey: env.supabaseAnonKey,
    },
    body: JSON.stringify({
      user_token: userToken,
      playlist_id: playlistId,
    }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}
