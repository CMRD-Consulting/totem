import { ref } from 'vue';
import { fromMusicService, type MusicService } from '@/lib/serviceKey';
import { supabase } from '@/lib/supabase';
import type { ServiceKey } from '@/types';

export function useMirrorErrors(playlistId: () => string | undefined) {
  const errorsByTrackId = ref<Record<string, string>>({});
  const errorCount = ref(0);
  const reauthServices = ref<ServiceKey[]>([]);

  async function load() {
    const id = playlistId();
    if (!id) {
      errorsByTrackId.value = {};
      errorCount.value = 0;
      reauthServices.value = [];
      return;
    }

    const { data: targets } = await supabase
      .from('mirror_targets')
      .select('id, service, last_sync_error')
      .eq('playlist_id', id);

    reauthServices.value = (targets ?? [])
      .filter((target) => target.last_sync_error === 'reauth_required')
      .map((target) => fromMusicService(target.service as MusicService));

    const targetIds = (targets ?? []).map((target) => target.id);
    if (!targetIds.length) {
      errorsByTrackId.value = {};
      errorCount.value = 0;
      return;
    }

    const { data: errors } = await supabase
      .from('mirror_track_errors')
      .select('track_id, error_type')
      .in('mirror_target_id', targetIds);

    const nextErrors: Record<string, string> = {};
    for (const row of errors ?? []) {
      nextErrors[row.track_id] = row.error_type;
    }
    errorsByTrackId.value = nextErrors;
    errorCount.value = Object.keys(nextErrors).length;
  }

  function mirrorErrorForTrack(trackId: string): string | null {
    return errorsByTrackId.value[trackId] ?? null;
  }

  return {
    errorCount,
    reauthServices,
    load,
    mirrorErrorForTrack,
  };
}
