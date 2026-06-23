declare global {
  interface Window {
    MusicKit?: {
      configure: (config: {
        developerToken: string;
        app: { name: string; build: string };
      }) => Promise<MusicKitInstance>;
    };
  }
}

interface MusicKitInstance {
  authorize: () => Promise<string>;
  musicUserToken: string;
}

const SCRIPT_SRC = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';

function loadMusicKitScript(): Promise<void> {
  if (window.MusicKit) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('MusicKit script failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('MusicKit script failed to load'));
    document.head.appendChild(script);
  });
}

export async function authorizeAppleMusic(developerToken: string): Promise<string> {
  await loadMusicKitScript();
  if (!window.MusicKit) {
    throw new Error('MusicKit is unavailable in this browser');
  }
  const music = await window.MusicKit.configure({
    developerToken,
    app: { name: 'Totem', build: '1.0.0' },
  });
  await music.authorize();
  if (!music.musicUserToken) {
    throw new Error('Apple Music did not return a user token');
  }
  return music.musicUserToken;
}
