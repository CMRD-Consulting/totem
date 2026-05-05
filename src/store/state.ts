import { reactive, watch } from 'vue';
import { TRACKS } from '@/data/mock';
import type { ThemeKey, Track } from '@/types';

interface AppState {
  /** Mock track data for demo / activity feed fallback. Real tracks live in the playlists Pinia store. */
  tracks: Track[];
  meId: string;
  theme: ThemeKey;
  accent: string;
}

const THEME_KEY = 'totem-theme';
const ACCENT_KEY = 'totem-accent';

function loadStoredTheme(): ThemeKey {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(THEME_KEY) : null;
  if (stored === 'paper' || stored === 'cream' || stored === 'midnight') return stored;
  return 'midnight';
}

function loadStoredAccent(): string {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(ACCENT_KEY) : null;
  return stored ?? '#d62e2e';
}

export const state = reactive<AppState>({
  tracks: [...TRACKS],
  meId: 'you',
  theme: loadStoredTheme(),
  accent: loadStoredAccent(),
});

// Persist theme + accent across reloads. Per-device preference; no DB sync.
if (typeof window !== 'undefined') {
  watch(
    () => state.theme,
    (v) => window.localStorage.setItem(THEME_KEY, v),
  );
  watch(
    () => state.accent,
    (v) => window.localStorage.setItem(ACCENT_KEY, v),
  );
}

// v0: reactions are an ephemeral client-only concept (no DB schema).
// This mutates whichever Track instance carries `trackId` in state.tracks.
// Real tracks loaded from the backend won't match — taps are visual no-ops on
// real tracks until v1 introduces a reactions table.
export function toggleReaction(trackId: string, emoji: string) {
  const t = state.tracks.find((x) => x.id === trackId);
  if (!t) return;
  const me = state.meId;
  const existing = t.reactions.find((r) => r.e === emoji);
  if (existing) {
    if (existing.by.includes(me)) {
      const newBy = existing.by.filter((b) => b !== me);
      if (newBy.length === 0) {
        t.reactions = t.reactions.filter((r) => r.e !== emoji);
      } else {
        existing.by = newBy;
      }
    } else {
      existing.by = [...existing.by, me];
    }
  } else {
    t.reactions = [...t.reactions, { e: emoji, by: [me] }];
  }
}
