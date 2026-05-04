import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { registerProfile } from '@/store/users';
import type { Group } from '@/types';

interface PlaylistRow {
  id: string;
  name: string;
  description: string | null;
  invite_token: string;
  created_at: string;
  members: { user_id: string; profiles: { display_name: string } | null }[];
  tracks: { count: number }[];
}

function hashSeed(s: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function rowToGroup(row: PlaylistRow, meId: string | undefined): Group {
  const memberIds = row.members.map((m) => m.user_id);
  // Hoist current user to the front so the design's "filter !== 'you'" logic stays consistent.
  const ordered = meId
    ? [meId, ...memberIds.filter((id) => id !== meId)]
    : memberIds;
  return {
    id: row.id,
    name: row.name,
    code: 'TOTEM-' + row.invite_token.slice(0, 6).toUpperCase(),
    members: ordered,
    tracks: row.tracks[0]?.count ?? 0,
    sigil: [
      hashSeed(row.id, 1) % 360,
      hashSeed(row.id, 2) % 360,
      hashSeed(row.id, 3) % 360,
    ] as [number, number, number],
  };
}

export const usePlaylistsStore = defineStore('playlists', () => {
  const groups = ref<Group[]>([]);
  const loaded = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function loadList() {
    loading.value = true;
    error.value = null;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const meId = sess.session?.user.id;

      const { data, error: err } = await supabase
        .from('playlists')
        .select(
          `
          id, name, description, invite_token, created_at,
          members:playlist_members ( user_id, profiles ( display_name ) ),
          tracks:playlist_tracks ( count )
        `,
        )
        .order('created_at', { ascending: false });

      if (err) throw err;
      const rows = (data ?? []) as unknown as PlaylistRow[];

      for (const row of rows) {
        for (const m of row.members) {
          if (m.profiles?.display_name) {
            registerProfile(m.user_id, m.profiles.display_name);
          }
        }
      }

      groups.value = rows.map((r) => rowToGroup(r, meId));
      loaded.value = true;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function create(name: string, description: string | null = null) {
    const { data, error: err } = await supabase.rpc('create_playlist', {
      p_name: name,
      p_description: description,
    });
    if (err) throw err;
    await loadList();
    return data?.[0] as { id: string; name: string; invite_token: string } | undefined;
  }

  async function joinByToken(token: string) {
    const { data, error: err } = await supabase.rpc('join_playlist_by_token', {
      p_token: token,
    });
    if (err) throw err;
    await loadList();
    return data?.[0] as { playlist_id: string; name: string } | undefined;
  }

  function reset() {
    groups.value = [];
    loaded.value = false;
    error.value = null;
  }

  const isEmpty = computed(() => loaded.value && groups.value.length === 0);

  return {
    groups,
    loaded,
    loading,
    error,
    isEmpty,
    loadList,
    create,
    joinByToken,
    reset,
  };
});
