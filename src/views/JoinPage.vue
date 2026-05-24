<script setup lang="ts">
import { IonPage } from '@ionic/vue';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ToggleRow from '@/components/ToggleRow.vue';
import Wordmark from '@/components/Wordmark.vue';
import { pillBtn } from '@/components/pillBtn';
import { SERVICES } from '@/data/mock';
import { supabase } from '@/lib/supabase';
import { usePlaylistsStore } from '@/stores/playlists';
import type { ServiceKey } from '@/types';

interface Preview {
  playlist_id: string;
  name: string;
  member_count: number;
  already_member: boolean;
}

const router = useRouter();
const route = useRoute();
const playlists = usePlaylistsStore();

type Status = 'loading' | 'preview' | 'joining' | 'error';
const status = ref<Status>('loading');
const preview = ref<Preview | null>(null);
const error = ref<string | null>(null);

// Mirror toggle state. v0 only mirrors to Spotify; once Apple/YouTube ship,
// this reads `auth.preferredService` and the toggle label updates accordingly.
const mirrorService: ServiceKey = 'spotify';
const mirrorConnected = ref(false);
const mirrorOn = ref(false);

const token = route.params.token as string;

const toggleSublabel = computed(() =>
  mirrorConnected.value
    ? 'new tracks sync to your account'
    : `connect ${SERVICES[mirrorService].short} in Settings to enable`,
);

onMounted(async () => {
  try {
    // Run preview + connection check in parallel — preview blocks the UI,
    // connection check just gates the toggle, no need to wait serially.
    const [previewResult] = await Promise.all([
      playlists.previewInvite(token),
      checkConnection(),
    ]);
    if (!previewResult) throw new Error('No preview returned');
    preview.value = previewResult;
    // If the user is already a member of this playlist, skip the preview
    // entirely and send them straight in. Re-clicking an invite link is
    // common (e.g. from a notification) and shouldn't show a confirmation.
    if (previewResult.already_member) {
      router.replace(`/p/${previewResult.playlist_id}`);
      return;
    }
    // Default the toggle ON if the user's already connected, OFF if not.
    mirrorOn.value = mirrorConnected.value;
    status.value = 'preview';
  } catch (e) {
    status.value = 'error';
    error.value = (e as Error).message;
  }
});

async function checkConnection() {
  const { data } = await supabase
    .from('service_connections')
    .select('service')
    .eq('service', mirrorService)
    .maybeSingle();
  mirrorConnected.value = !!data;
}

async function onJoin() {
  if (!preview.value) return;
  status.value = 'joining';
  error.value = null;
  try {
    const result = await playlists.joinByToken(token);
    if (!result?.playlist_id) throw new Error('No playlist returned from join');
    // Await the mirror creation so the playlist page's loadMyMirrors() picks
    // it up on first load — otherwise the banner pops in a beat late and the
    // "auto-mirror" UX feels broken.
    if (mirrorOn.value && mirrorConnected.value) {
      await playlists.ensureMirrorTarget(result.playlist_id, mirrorService);
    }
    router.replace(`/p/${result.playlist_id}`);
  } catch (e) {
    status.value = 'preview';
    error.value = (e as Error).message;
  }
}

function onDecline() {
  router.replace('/');
}
</script>

<template>
  <ion-page>
    <div
      style="
        width: 100%;
        height: 100%;
        background: var(--bg);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0 32px;
        box-sizing: border-box;
        overflow: hidden;
      "
    >
      <div style="text-align: center; max-width: 320px; width: 100%">
        <Wordmark :size="48" />

        <!-- Loading: resolving the invite token -->
        <template v-if="status === 'loading'">
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '20px',
              color: 'var(--muted)',
              marginTop: '24px',
              lineHeight: 1.35,
            }"
          >loading invite…</div>
          <div
            :style="{
              marginTop: '20px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '2px solid var(--divider)',
              borderTopColor: 'var(--accent)',
              animation: 'totem-spin 0.8s linear infinite',
              marginLeft: 'auto',
              marginRight: 'auto',
            }"
          />
        </template>

        <!-- Preview: confirm before joining -->
        <template v-else-if="status === 'preview' || status === 'joining'">
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '12px',
              color: 'var(--muted-2)',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginTop: '28px',
            }"
          >you're invited to</div>
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontSize: '32px',
              color: 'var(--ink)',
              marginTop: '6px',
              lineHeight: 1.1,
              letterSpacing: '-0.4px',
            }"
          >{{ preview?.name }}</div>
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '13px',
              color: 'var(--muted)',
              marginTop: '8px',
              fontVariantNumeric: 'tabular-nums',
            }"
          >{{ preview?.member_count }} {{ preview?.member_count === 1 ? 'friend' : 'friends' }} so far</div>

          <div style="margin-top: 24px; text-align: left">
            <ToggleRow
              v-model="mirrorOn"
              :disabled="!mirrorConnected"
              :label="`Mirror to your ${SERVICES[mirrorService].short}`"
              :sublabel="toggleSublabel"
            />
          </div>

          <div
            v-if="error"
            :style="{
              marginTop: '14px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              fontFamily: 'Inter',
              fontSize: '12px',
              color: 'var(--accent)',
              textAlign: 'center',
            }"
          >{{ error }}</div>

          <button
            @click="onJoin"
            :disabled="status === 'joining'"
            :style="{
              ...pillBtn(true),
              width: '100%',
              height: '50px',
              fontSize: '15px',
              marginTop: '18px',
              cursor: status === 'joining' ? 'wait' : 'pointer',
              opacity: status === 'joining' ? 0.7 : 1,
            }"
          >{{ status === 'joining' ? 'joining…' : 'join playlist' }}</button>

          <button
            @click="onDecline"
            :disabled="status === 'joining'"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              display: 'block',
              width: '100%',
              textAlign: 'center',
              marginTop: '14px',
              fontFamily: 'Inter',
              fontSize: '13px',
              color: 'var(--muted)',
              padding: '8px 0',
            }"
          >no thanks</button>
        </template>

        <!-- Error: invalid token / network / RPC failure -->
        <template v-else>
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '12px',
              color: 'var(--muted-2)',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginTop: '36px',
            }"
          >invite</div>
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '28px',
              color: 'var(--ink)',
              marginTop: '6px',
              lineHeight: 1.1,
              letterSpacing: '-0.3px',
            }"
          >couldn't open this invite.</div>
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '13px',
              color: 'var(--muted)',
              marginTop: '10px',
              lineHeight: 1.5,
            }"
          >the link might be stale, or the playlist may have been deleted. you can ask whoever sent it to share again.</div>

          <!-- Raw error kept for debuggability — small, muted, beneath the
               friendly framing so it doesn't dominate. -->
          <div
            :style="{
              fontFamily: '&quot;JetBrains Mono&quot;, ui-monospace, monospace',
              fontSize: '10.5px',
              color: 'var(--muted-2)',
              marginTop: '18px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'var(--chip)',
              lineHeight: 1.4,
              wordBreak: 'break-word',
              textAlign: 'left',
            }"
          >{{ error }}</div>

          <button
            @click="onDecline"
            :style="{
              ...pillBtn(true),
              width: '100%',
              height: '46px',
              fontSize: '14px',
              marginTop: '24px',
            }"
          >back to your playlists</button>
        </template>
      </div>
    </div>
  </ion-page>
</template>

<style scoped>
@keyframes totem-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>