import { reactive } from 'vue';
import { GROUPS, TRACKS } from '@/data/mock';
import type { Group, ThemeKey, Track } from '@/types';

interface AppState {
  groups: Group[];
  tracks: Track[];
  meId: string;
  theme: ThemeKey;
  accent: string;
}

export const state = reactive<AppState>({
  groups: [...GROUPS],
  tracks: [...TRACKS],
  meId: 'you',
  theme: 'midnight',
  accent: '#d62e2e',
});

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

export function addGroup(g: Group) {
  state.groups = [g, ...state.groups];
}
