import { reactive } from 'vue';
import { TRACKS } from '@/data/mock';
import type { ThemeKey, Track } from '@/types';

interface AppState {
  /** Mock track data for demo / activity feed fallback. Real tracks live in the playlists Pinia store. */
  tracks: Track[];
  meId: string;
  theme: ThemeKey;
  accent: string;
}

export const state = reactive<AppState>({
  tracks: [...TRACKS],
  meId: 'you',
  theme: 'midnight',
  accent: '#d62e2e',
});

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
