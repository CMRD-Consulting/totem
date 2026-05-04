import { reactive } from 'vue';
import { friendsById as MOCK_FRIENDS } from '@/data/mock';
import type { Friend } from '@/types';

// A reactive lookup keyed by user id (mock string id OR real UUID).
// Mock friends seed it; real profiles register on load so design
// components (Avatar, ActivityRow) keep working unchanged.
export const usersById = reactive<Record<string, Friend>>({ ...MOCK_FRIENDS });

function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function registerProfile(id: string, displayName: string) {
  if (usersById[id]) return;
  usersById[id] = {
    id,
    name: displayName,
    hue: hueFromId(id),
    service: 'spotify',
    initial: (displayName.trim()[0] ?? '?').toUpperCase(),
  };
}
