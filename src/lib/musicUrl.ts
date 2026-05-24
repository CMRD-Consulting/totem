// Shared helpers for detecting music-service URLs and rendering them
// compactly. Used by PasteLinkSheet (modal-driven add) and the inline
// empty-state on PlaylistPage so both surfaces apply the same rules.

const MUSIC_HOSTS = new Set([
  'open.spotify.com',
  'spotify.link',
  'music.apple.com',
  'itunes.apple.com',
  'music.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

/** True if `s` looks like a Spotify/Apple/YouTube music link or spotify URI. */
export function isMusicUrl(s: string): boolean {
  const trimmed = s.trim();
  if (/^spotify:(track|album|playlist):/i.test(trimmed)) return true;
  try {
    const u = new URL(trimmed);
    return MUSIC_HOSTS.has(u.hostname.replace(/^www\./, ''));
  } catch {
    return false;
  }
}

/** Drop scheme/www and truncate so the URL fits a one-line UI chip. */
export function shortUrl(s: string): string {
  let pretty = s.replace(/^https?:\/\/(www\.)?/, '');
  if (pretty.length > 38) pretty = pretty.slice(0, 36) + '…';
  return pretty;
}

/**
 * Read the OS clipboard and return its contents iff it's a music URL.
 *
 * navigator.clipboard.readText works in iOS 14.5+ WKWebView. On first call
 * the user may see a system "Allow paste?" prompt; denials surface as
 * promise rejections, which we silently swallow so the absence of a
 * suggestion is the only visible effect.
 */
export async function peekMusicClipboard(): Promise<string | null> {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    return text && isMusicUrl(text) ? text : null;
  } catch {
    return null;
  }
}
