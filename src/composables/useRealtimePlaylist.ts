import type { RealtimeChannel } from '@supabase/supabase-js';
import { onIonViewWillEnter, onIonViewWillLeave } from '@ionic/vue';
import type { Ref } from 'vue';
import { watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { usePlaylistsStore } from '@/stores/playlists';

/**
 * Subscribe to playlist_tracks INSERT/UPDATE/DELETE events for the given
 * playlistId and reload tracks on each event. RLS filters at the server
 * level so only members of the playlist receive events.
 *
 * Lifecycle is bound to Ionic's view-enter/view-leave hooks rather than
 * onMounted/onUnmounted — Ionic keeps pages alive in the navigation stack
 * (so the same page instance can re-enter), and an unmount-only cleanup
 * would leak channels across navigations.
 */
export function useRealtimePlaylist(playlistId: Ref<string | undefined>) {
  const playlists = usePlaylistsStore();
  let channel: RealtimeChannel | null = null;

  function teardown() {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  }

  function setup(id: string) {
    teardown();
    channel = supabase
      .channel(`playlist-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playlist_tracks',
          filter: `playlist_id=eq.${id}`,
        },
        () => {
          // Refetch on any change. Smart-merging by op type would be slightly
          // more efficient but adds reconciliation complexity (e.g., a row I
          // optimistically inserted vs. the realtime echo of the same insert).
          playlists.loadTracks(id).catch(() => {});
        },
      )
      .subscribe();
  }

  onIonViewWillEnter(() => {
    if (playlistId.value) setup(playlistId.value);
  });
  onIonViewWillLeave(teardown);

  // Resubscribe if the route param changes mid-session (e.g., user navigates
  // to a different playlist without leaving the view stack).
  watch(playlistId, (id, prev) => {
    if (id && id !== prev) setup(id);
  });
}
