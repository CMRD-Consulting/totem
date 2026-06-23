import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { env } from '@/lib/env';
import { toMusicService } from '@/lib/serviceKey';
import { supabase } from '@/lib/supabase';
import { registerProfile } from '@/store/users';
import type { ActivityItem, Playlist, Reaction, ServiceKey, Track } from '@/types';

interface PlaylistRow {
  id: string;
  name: string;
  description: string | null;
  invite_token: string;
  created_by: string;
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

interface ActivityFeedRow {
  id: string;
  added_at: string;
  added_by: string;
  track: { title: string; artist: string } | null;
  playlist: { name: string } | null;
  added_by_profile: { display_name: string } | null;
}

interface ReactionRow {
  playlist_track_id: string;
  user_id: string;
  emoji: string;
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

function rowToPlaylist(row: PlaylistRow, meId: string | undefined): Playlist {
  const memberIds = row.members.map((m) => m.user_id);
  const ordered = meId
    ? [meId, ...memberIds.filter((id) => id !== meId)]
    : memberIds;
  return {
    id: row.id,
    name: row.name,
    code: 'TOTEM-' + row.invite_token.slice(0, 6).toUpperCase(),
    inviteToken: row.invite_token,
    createdBy: row.created_by,
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
    serviceIds: {
      spotify: row.track.spotify_id,
      apple: row.track.apple_music_id,
      youtube: row.track.youtube_music_id,
    },
  };
}

export const usePlaylistsStore = defineStore('playlists', () => {
  const playlists = ref<Playlist[]>([]);
  const tracksByPlaylistId = ref<Record<string, Track[]>>({});
  // Client-only optimistic entries during ingest. Keyed by playlist id; each
  // entry carries status='resolving'|'failed' and is rendered alongside real
  // tracks until either the DB row appears (success → entry is removed) or
  // the user dismisses the failure.
  const pendingByPlaylistId = ref<Record<string, Track[]>>({});
  // Reactions keyed by playlist_track_id → array of {emoji, by[user_id]}.
  // Kept separate from Track objects so realtime updates don't have to walk
  // the per-playlist track list to find the right row.
  const reactionsByTrackId = ref<Record<string, Reaction[]>>({});
  const recentActivity = ref<ActivityItem[]>([]);
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
          id, name, description, invite_token, created_by, created_at,
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

      playlists.value = rows.map((r) => rowToPlaylist(r, meId));
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
    // Refresh reactions in tandem so the row's reaction pills come from a
    // consistent snapshot.
    await loadReactions(playlistId);
  }

  /** Load all reactions for a playlist, grouped by playlist_track_id + emoji. */
  async function loadReactions(playlistId: string) {
    // Use the embedded select to scope to playlist_tracks.playlist_id without
    // a separate IN clause. The !inner join filters out reactions on tracks
    // that don't belong to the given playlist.
    const { data, error: err } = await supabase
      .from('track_reactions')
      .select(
        `
        playlist_track_id, user_id, emoji,
        playlist_track:playlist_tracks!inner ( playlist_id )
      `,
      )
      .eq('playlist_track.playlist_id', playlistId);

    if (err) throw err;
    const rows = (data ?? []) as unknown as ReactionRow[];

    const byTrack: Record<string, Map<string, string[]>> = {};
    for (const r of rows) {
      const map = (byTrack[r.playlist_track_id] ??= new Map());
      const arr = map.get(r.emoji) ?? [];
      arr.push(r.user_id);
      map.set(r.emoji, arr);
    }
    // Materialize: for each track, replace the live array — assignment instead
    // of mutation keeps Vue's reactivity granularity at the row level.
    for (const tid of Object.keys(byTrack)) {
      const reactions: Reaction[] = [];
      byTrack[tid].forEach((users, emoji) => {
        reactions.push({ e: emoji, by: users });
      });
      reactionsByTrackId.value[tid] = reactions;
    }
    // Tracks with no reactions: clear stale entries in case a reaction was
    // removed since last load.
    const seen = new Set(Object.keys(byTrack));
    for (const existing of Object.keys(reactionsByTrackId.value)) {
      const t = (tracksByPlaylistId.value[playlistId] ?? []).find((x) => x.id === existing);
      if (t && !seen.has(existing)) {
        reactionsByTrackId.value[existing] = [];
      }
    }
  }

  /** Add my reaction to a track. Idempotent — relies on PK. */
  async function addReaction(playlistTrackId: string, emoji: string) {
    const { data: sess } = await supabase.auth.getSession();
    const meId = sess.session?.user.id;
    if (!meId) throw new Error('Not signed in');
    // Optimistic merge into local state.
    const list = reactionsByTrackId.value[playlistTrackId] ?? [];
    const existing = list.find((r) => r.e === emoji);
    if (existing) {
      if (!existing.by.includes(meId)) existing.by = [...existing.by, meId];
    } else {
      reactionsByTrackId.value[playlistTrackId] = [
        ...list,
        { e: emoji, by: [meId] },
      ];
    }
    const { error } = await supabase.from('track_reactions').insert({
      playlist_track_id: playlistTrackId,
      user_id: meId,
      emoji,
    });
    // 23505 (unique violation) = already reacted; treat as success since
    // optimistic merge above already covered it.
    if (error && (error as { code?: string }).code !== '23505') throw error;
  }

  /** Remove my reaction from a track. */
  async function removeReaction(playlistTrackId: string, emoji: string) {
    const { data: sess } = await supabase.auth.getSession();
    const meId = sess.session?.user.id;
    if (!meId) throw new Error('Not signed in');
    // Optimistic remove.
    const list = reactionsByTrackId.value[playlistTrackId] ?? [];
    const next = list
      .map((r) =>
        r.e === emoji ? { ...r, by: r.by.filter((u) => u !== meId) } : r,
      )
      .filter((r) => r.by.length > 0);
    reactionsByTrackId.value[playlistTrackId] = next;

    const { error } = await supabase
      .from('track_reactions')
      .delete()
      .eq('playlist_track_id', playlistTrackId)
      .eq('user_id', meId)
      .eq('emoji', emoji);
    if (error) throw error;
  }

  /** Convenience: toggle based on whether I'm currently in the by[] list. */
  async function toggleReaction(playlistTrackId: string, emoji: string) {
    const { data: sess } = await supabase.auth.getSession();
    const meId = sess.session?.user.id;
    if (!meId) return;
    const existing = (reactionsByTrackId.value[playlistTrackId] ?? []).find(
      (r) => r.e === emoji,
    );
    if (existing && existing.by.includes(meId)) {
      await removeReaction(playlistTrackId, emoji);
    } else {
      await addReaction(playlistTrackId, emoji);
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

  async function previewInvite(token: string) {
    const { data, error: err } = await supabase.rpc('preview_invite', {
      p_token: token,
    });
    if (err) throw err;
    return data?.[0] as
      | {
          playlist_id: string;
          name: string;
          member_count: number;
          already_member: boolean;
        }
      | undefined;
  }

  /**
   * Calls the create-mirror-target Edge Function. Idempotent — if a target
   * already exists for (user, playlist, service), the server returns it
   * instead of creating a second native playlist on Spotify. Awaiting this
   * before navigating to a playlist ensures the mirror banner picks up on
   * first load instead of flickering in late.
   */
  async function ensureMirrorTarget(
    playlistId: string,
    service: ServiceKey = 'spotify',
  ): Promise<void> {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return;
    try {
      await fetch(`${env.supabaseUrl}/functions/v1/create-mirror-target`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sess.session.access_token}`,
          apikey: env.supabaseAnonKey,
        },
        body: JSON.stringify({
          playlist_id: playlistId,
          service: toMusicService(service),
        }),
      });
    } catch {
      // Non-fatal — callers redirect anyway and the user can retry from
      // the playlist's Mirror modal if it didn't take.
    }
  }

  /**
   * Kicks off ingestion with an optimistic 'resolving' track row, then
   * resolves it inline:
   *   success → remove the pending entry + reload real tracks (DB row visible)
   *   failure → mutate the pending entry to status='failed' so the row
   *             persists in the UI for the user to retry/dismiss.
   *
   * Returns the pending id so callers can later look it up if needed; the
   * function itself doesn't throw — failures live on the pending entry.
   */
  async function ingestUrl(playlistId: string, url: string): Promise<string> {
    const { data: sess } = await supabase.auth.getSession();
    const session = sess.session;
    if (!session) {
      const id = pushPending(playlistId, url, undefined);
      markPendingFailed(playlistId, id, 'Not signed in');
      return id;
    }
    const meId = session.user.id;
    const pendingId = pushPending(playlistId, url, meId);

    try {
      let res: Response;
      try {
        res = await fetch(`${env.supabaseUrl}/functions/v1/ingest-track`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            apikey: env.supabaseAnonKey,
          },
          body: JSON.stringify({ playlist_id: playlistId, url }),
        });
      } catch (e) {
        markPendingFailed(
          playlistId,
          pendingId,
          `Couldn't reach the server. ${(e as Error).message}`,
        );
        return pendingId;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const msg =
          res.status === 404
            ? 'ingest-track edge function not deployed.'
            : `${res.status}: ${text || res.statusText}`;
        markPendingFailed(playlistId, pendingId, msg);
        return pendingId;
      }

      // Success: drop the pending row + reload tracks so the real one shows.
      removePending(playlistId, pendingId);
      await loadTracks(playlistId);
    } catch (e) {
      markPendingFailed(playlistId, pendingId, (e as Error).message);
    }
    return pendingId;
  }

  function pushPending(playlistId: string, url: string, addedBy: string | undefined): string {
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const seed = hashSeed(id, 0);
    const entry: Track = {
      id,
      title: 'resolving…',
      artist: extractHost(url),
      album: '',
      adder: addedBy ?? 'you',
      added: 'now',
      service: 'spotify',
      reactions: [],
      seed,
      status: 'resolving',
      sourceUrl: url,
    };
    const list = pendingByPlaylistId.value[playlistId] ?? [];
    pendingByPlaylistId.value[playlistId] = [...list, entry];
    return id;
  }

  function markPendingFailed(playlistId: string, pendingId: string, msg: string) {
    const list = pendingByPlaylistId.value[playlistId] ?? [];
    pendingByPlaylistId.value[playlistId] = list.map((t) =>
      t.id === pendingId
        ? { ...t, status: 'failed', errorMessage: msg, title: 'couldn’t add' }
        : t,
    );
  }

  function removePending(playlistId: string, pendingId: string) {
    const list = pendingByPlaylistId.value[playlistId] ?? [];
    pendingByPlaylistId.value[playlistId] = list.filter((t) => t.id !== pendingId);
  }

  /** Public dismiss — used by the row's tap handler when status === 'failed'. */
  function dismissPending(playlistId: string, pendingId: string) {
    removePending(playlistId, pendingId);
  }

  function extractHost(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url.slice(0, 40);
    }
  }

  /**
   * Load recent track adds across every playlist the user belongs to.
   * RLS on playlist_tracks scopes the result to playlists I'm a member of,
   * so no explicit user_id filter is needed.
   */
  async function loadRecentActivity(limit = 12) {
    const { data, error: err } = await supabase
      .from('playlist_tracks')
      .select(
        `
        id, added_at, added_by,
        track:tracks ( title, artist ),
        playlist:playlists ( name ),
        added_by_profile:profiles!playlist_tracks_added_by_fkey ( display_name )
      `,
      )
      .order('added_at', { ascending: false })
      .limit(limit);

    if (err) throw err;
    const rows = (data ?? []) as unknown as ActivityFeedRow[];

    for (const row of rows) {
      if (row.added_by_profile?.display_name) {
        registerProfile(row.added_by, row.added_by_profile.display_name);
      }
    }

    recentActivity.value = rows
      .filter((r) => r.track)
      .map<ActivityItem>((r) => ({
        id: r.id,
        kind: 'add',
        who: r.added_by,
        what: r.track!.title,
        detail: r.playlist
          ? `${r.track!.artist} · in ${r.playlist.name}`
          : r.track!.artist,
        when: relTime(r.added_at),
      }));
  }

  async function leave(playlistId: string) {
    const { data: sess } = await supabase.auth.getSession();
    const meId = sess.session?.user.id;
    if (!meId) throw new Error('Not signed in');
    const { error: err } = await supabase
      .from('playlist_members')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('user_id', meId);
    if (err) throw err;
    playlists.value = playlists.value.filter((p) => p.id !== playlistId);
    delete tracksByPlaylistId.value[playlistId];
  }

  async function rotateInvite(playlistId: string) {
    const { data, error: err } = await supabase.rpc('rotate_invite_token', {
      p_playlist_id: playlistId,
    });
    if (err) throw err;
    const newToken = data as string;
    // Patch the in-memory copy so the InvitePage reflects the new code immediately.
    const i = playlists.value.findIndex((p) => p.id === playlistId);
    if (i !== -1) {
      playlists.value[i] = {
        ...playlists.value[i],
        inviteToken: newToken,
        code: 'TOTEM-' + newToken.slice(0, 6).toUpperCase(),
      };
    }
    return newToken;
  }

  async function deletePlaylist(playlistId: string) {
    const { error: err } = await supabase.rpc('delete_playlist', {
      p_playlist_id: playlistId,
    });
    if (err) throw err;
    playlists.value = playlists.value.filter((p) => p.id !== playlistId);
    delete tracksByPlaylistId.value[playlistId];
  }

  function reset() {
    playlists.value = [];
    tracksByPlaylistId.value = {};
    pendingByPlaylistId.value = {};
    reactionsByTrackId.value = {};
    recentActivity.value = [];
    loaded.value = false;
    error.value = null;
  }

  const isEmpty = computed(() => loaded.value && playlists.value.length === 0);

  return {
    playlists,
    tracksByPlaylistId,
    pendingByPlaylistId,
    reactionsByTrackId,
    recentActivity,
    loaded,
    loading,
    error,
    isEmpty,
    loadList,
    loadTracks,
    loadReactions,
    loadRecentActivity,
    create,
    joinByToken,
    previewInvite,
    ensureMirrorTarget,
    ingestUrl,
    dismissPending,
    addReaction,
    removeReaction,
    toggleReaction,
    leave,
    rotateInvite,
    deletePlaylist,
    reset,
  };
});
