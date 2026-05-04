import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { registerProfile } from '@/store/users';
import type { Group, ServiceKey, Track } from '@/types';

interface PlaylistRow {
  id: string;
  name: string;
  description: string | null;
  invite_token: string;
  created_at: string;
  members: { user_id: string; profiles: { display_name: string } | null }[];
  tracks: { count: number }[];
}

interface PlaylistTrackRow {
  id: string;
  position: number;
  added_at: string;
  added_by: string;
  track: {
    id: string;
    title: string;
    artist: string;
    album: string | null;
    artwork_url: string | null;
    spotify_id: string | null;
    apple_music_id: string | null;
    youtube_music_id: string | null;
  };
  added_by_profile: { display_name: string } | null;
}

function hashSeed(s: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yest';
  return `${d}d`;
}

function pickService(t: PlaylistTrackRow['track']): ServiceKey {
  if (t.spotify_id) return 'spotify';
  if (t.apple_music_id) return 'apple';
  if (t.youtube_music_id) return 'youtube';
  return 'spotify';
}

function rowToGroup(row: PlaylistRow, meId: string | undefined): Group {
  const memberIds = row.members.map((m) => m.user_id);
  const ordered = meId
    ? [meId, ...memberIds.filter((id) => id !== meId)]
    : memberIds;
  return {
    id: row.id,
    name: row.name,
    code: 'TOTEM-' + row.invite_token.slice(0, 6).toUpperCase(),
    inviteToken: row.invite_token,
    members: ordered,
    tracks: row.tracks[0]?.count ?? 0,
    sigil: [
      hashSeed(row.id, 1) % 360,
      hashSeed(row.id, 2) % 360,
      hashSeed(row.id, 3) % 360,
    ] as [number, number, number],
  };
}

function rowToTrack(row: PlaylistTrackRow): Track {
  return {
    id: row.id,
    title: row.track.title,
    artist: row.track.artist,
    album: row.track.album ?? '',
    adder: row.added_by,
    added: relTime(row.added_at),
    service: pickService(row.track),
    reactions: [],
    seed: hashSeed(row.track.id, 0),
    artworkUrl: row.track.artwork_url ?? undefined,
  };
}

export const usePlaylistsStore = defineStore('playlists', () => {
  const groups = ref<Group[]>([]);
  const tracksByPlaylistId = ref<Record<string, Track[]>>({});
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

  async function loadTracks(playlistId: string) {
    const { data, error: err } = await supabase
      .from('playlist_tracks')
      .select(
        `
        id, position, added_at, added_by,
        track:tracks ( id, title, artist, album, artwork_url, spotify_id, apple_music_id, youtube_music_id ),
        added_by_profile:profiles!playlist_tracks_added_by_fkey ( display_name )
      `,
      )
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true });

    if (err) throw err;
    const rows = (data ?? []) as unknown as PlaylistTrackRow[];

    for (const row of rows) {
      if (row.added_by_profile?.display_name) {
        registerProfile(row.added_by, row.added_by_profile.display_name);
      }
    }

    tracksByPlaylistId.value[playlistId] = rows.map(rowToTrack);
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

  async function ingestUrl(playlistId: string, url: string) {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) throw new Error('Not signed in');
    const res = await fetch(`${env.supabaseUrl}/functions/v1/ingest-track`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sess.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ playlist_id: playlistId, url }),
    });
    if (!res.ok) throw new Error(await res.text());
    await loadTracks(playlistId);
  }

  function reset() {
    groups.value = [];
    tracksByPlaylistId.value = {};
    loaded.value = false;
    error.value = null;
  }

  const isEmpty = computed(() => loaded.value && groups.value.length === 0);

  return {
    groups,
    tracksByPlaylistId,
    loaded,
    loading,
    error,
    isEmpty,
    loadList,
    loadTracks,
    create,
    joinByToken,
    ingestUrl,
    reset,
  };
});
