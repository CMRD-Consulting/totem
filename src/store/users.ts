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
  const existing = usersById[id];
  if (existing) {
    // Already known — refresh name-derived fields in place so future renders
    // pick up the new display_name. Preserves hue (deterministic from id)
    // and service (mock friends seed real-looking values we don't want to
    // overwrite with the hardcoded fallback below).
    existing.name = displayName;
    existing.initial = (displayName.trim()[0] ?? '?').toUpperCase();
    return;
  }
  usersById[id] = {
    id,
    name: displayName,
    hue: hueFromId(id),
    service: 'spotify',
    initial: (displayName.trim()[0] ?? '?').toUpperCase(),
  };
}
