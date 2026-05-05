<script setup lang="ts">
import { IonPage, onIonViewWillEnter } from '@ionic/vue';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import ScreenScroll from '@/components/ScreenScroll.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import TopBar from '@/components/TopBar.vue';
import { SERVICES } from '@/data/mock';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { usePlaylistsStore } from '@/stores/playlists';
import type { ServiceKey } from '@/types';

interface MirrorTarget {
  id: string;
  service: ServiceKey;
  enabled: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

const router = useRouter();
const route = useRoute();
const playlists = usePlaylistsStore();
const targets = ref<Record<string, MirrorTarget>>({});
const busy = ref(false);
const error = ref<string | null>(null);

const playlistId = computed(() => route.params.playlistId as string);
const playlist = computed(
  () => playlists.playlists.find((g) => g.id === playlistId.value) ?? playlists.playlists[0],
);

const v0Implemented: ServiceKey[] = ['spotify'];
function isImplemented(k: ServiceKey) {
  return v0Implemented.includes(k);
}

function relSync(iso: string | null): string {
  if (!iso) return 'no syncs yet';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'synced just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `synced ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `synced ${h}h ago`;
  const d = Math.floor(h / 24);
  return `synced ${d}d ago`;
}

function statusLabel(k: ServiceKey): string {
  const t = targets.value[k];
  if (!t) return isImplemented(k) ? 'tap to mirror' : 'coming in v1';
  if (t.last_sync_error) return `error: ${t.last_sync_error}`;
  if (!t.enabled) return 'disabled — tap to re-enable';
  return relSync(t.last_synced_at);
}

async function loadTargets() {
  if (!playlistId.value) return;
  const { data, error: err } = await supabase
    .from('mirror_targets')
    .select('id, service, enabled, last_synced_at, last_sync_error')
    .eq('playlist_id', playlistId.value);
  if (err) {
    error.value = err.message;
    return;
  }
  targets.value = Object.fromEntries(
    (data ?? []).map((t) => [t.service, t as MirrorTarget]),
  );
}

async function pick(k: ServiceKey) {
  if (!isImplemented(k)) return;
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    const existing = targets.value[k];
    if (existing) {
      await supabase
        .from('mirror_targets')
        .update({ enabled: !existing.enabled })
        .eq('id', existing.id);
      await loadTargets();
    } else {
      await connectService(k);
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function connectService(k: ServiceKey) {
  if (k !== 'spotify') return;
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) throw new Error('Not signed in');
  const url =
    `${env.supabaseUrl}/functions/v1/oauth-start` +
    `?playlist_id=${playlistId.value}&jwt=${encodeURIComponent(sess.session.access_token)}`;

  if (Capacitor.isNativePlatform()) {
    const sub = await Browser.addListener('browserFinished', async () => {
      await sub.remove();
      await loadTargets();
    });
    await Browser.open({ url });
  } else {
    // Web: open the OAuth flow in a new tab. The callback page closes itself.
    const popup = window.open(url, '_blank');
    if (popup) {
      const interval = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(interval);
          loadTargets();
        }
      }, 800);
    }
  }
}

onIonViewWillEnter(async () => {
  if (!playlists.loaded) await playlists.loadList().catch(() => {});
  await loadTargets();
});
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
        overflow: hidden;
      "
    >
      <TopBar title="mirror settings">
        <template #left>
          <IconButton name="close" @click="router.push(`/p/${playlist?.id ?? ''}`)" />
        </template>
      </TopBar>

      <ScreenScroll>
        <div style="padding: 4px 22px 0">
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontSize: '24px',
              color: 'var(--ink)',
              lineHeight: 1.2,
              letterSpacing: '-0.3px',
            }"
          >
            keep <i style="color: var(--accent)">{{ playlist?.name }}</i> in your own service
          </div>
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '13px',
              color: 'var(--muted)',
              marginTop: '8px',
              lineHeight: 1.4,
            }"
          >
            Totem can copy this shared list into a private playlist on the service you
            actually listen on. New tracks added by friends sync automatically.
          </div>
        </div>

        <div style="padding: 20px 16px 0">
          <button
            v-for="(s, k) in SERVICES"
            :key="k"
            @click="pick(k as ServiceKey)"
            :disabled="!isImplemented(k as ServiceKey) || busy"
            :style="{
              all: 'unset',
              cursor: isImplemented(k as ServiceKey) ? 'pointer' : 'not-allowed',
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px',
              borderRadius: '14px',
              background: 'var(--surface)',
              border: targets[k]?.enabled
                ? '1.5px solid var(--accent)'
                : '0.5px solid var(--divider)',
              opacity: isImplemented(k as ServiceKey) ? 1 : 0.55,
              marginBottom: '8px',
            }"
          >
            <ServiceGlyph :service="k as ServiceKey" :size="28" :color="s.color" />
            <div style="flex: 1; text-align: left">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--ink)',
                }"
              >{{ s.name }}</div>
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '11.5px',
                  color: 'var(--muted)',
                  marginTop: '1px',
                }"
              >{{ statusLabel(k as ServiceKey) }}</div>
            </div>
            <div
              :style="{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                border: targets[k]?.enabled ? 'none' : '1.5px solid var(--divider-strong)',
                background: targets[k]?.enabled ? 'var(--accent)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }"
            >
              <Icon v-if="targets[k]?.enabled" name="check" :size="14" />
            </div>
          </button>
        </div>

        <div
          v-if="error"
          :style="{
            margin: '12px 16px 0',
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent)',
            fontFamily: 'Inter',
            fontSize: '12px',
            color: 'var(--accent)',
          }"
        >{{ error }}</div>

        <div
          :style="{
            padding: '20px 22px',
            fontFamily: 'Inter',
            fontSize: '11px',
            color: 'var(--muted-2)',
            lineHeight: 1.5,
          }"
        >
          Totem isn't a player. Tracks always open in the service of your choice.
          Mirroring is a courtesy copy — you keep ownership of the playlist on your end.
          <br /><br />
          v0 mirrors to Spotify only; Apple Music and YouTube Music are coming.
        </div>
      </ScreenScroll>
    </div>
  </ion-page>
</template>
