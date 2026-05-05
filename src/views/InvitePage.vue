<script setup lang="ts">
import { IonPage, onIonViewWillEnter } from '@ionic/vue';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import ScreenScroll from '@/components/ScreenScroll.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import Sigil from '@/components/Sigil.vue';
import TopBar from '@/components/TopBar.vue';
import { pillBtn } from '@/components/pillBtn';
import { SERVICES } from '@/data/mock';
import { usePlaylistsStore } from '@/stores/playlists';
import { usersById } from '@/store/users';
import type { ServiceKey } from '@/types';

const router = useRouter();
const route = useRoute();
const playlists = usePlaylistsStore();
const copied = ref(false);

const playlist = computed(() => {
  const id = route.params.playlistId as string;
  return playlists.playlists.find((g) => g.id === id) ?? playlists.playlists[0];
});

const inviteUrl = computed(() => {
  const token = playlist.value?.inviteToken ?? '';
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://totem.cmrd.dev';
  return `${origin}/i/${token}`;
});

onIonViewWillEnter(async () => {
  if (!playlists.loaded) await playlists.loadList().catch(() => {});
});

const cells = computed(() => buildQR(playlist.value?.id ?? ''));
const N = 21;

function buildQR(seed: string): boolean[][] {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i) * (i + 1);
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const grid: boolean[][] = [];
  for (let y = 0; y < N; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < N; x++) {
      const inFinder =
        (x < 7 && y < 7) || (x > N - 8 && y < 7) || (x < 7 && y > N - 8);
      const onFinder =
        inFinder &&
        (x === 0 ||
          x === 6 ||
          y === 0 ||
          y === 6 ||
          (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
          x === N - 7 ||
          x === N - 1 ||
          (x >= N - 5 && x <= N - 3 && y >= 2 && y <= 4) ||
          y === N - 7 ||
          y === N - 1 ||
          (x >= 2 && x <= 4 && y >= N - 5 && y <= N - 3));
      row.push(inFinder ? onFinder : rng() > 0.55);
    }
    grid.push(row);
  }
  return grid;
}

async function onCopy() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // Older browsers / blocked clipboards: fall through silently. The QR + code
    // are still visible on-screen.
  }
}

async function onShare() {
  if (!playlist.value) return;
  const payload = {
    title: `Join "${playlist.value.name}" on Totem`,
    url: inviteUrl.value,
    dialogTitle: 'Share invite',
  };
  if (Capacitor.isNativePlatform()) {
    await Share.share(payload);
  } else if (typeof navigator !== 'undefined' && 'share' in navigator) {
    await navigator.share({ title: payload.title, url: payload.url }).catch(() => {});
  } else {
    await onCopy();
  }
}

const serviceCount = (k: ServiceKey) =>
  playlist.value
    ? playlist.value.members.filter((m) => usersById[m]?.service === k).length
    : 0;
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
      <TopBar title="invite friends">
        <template #left>
          <IconButton name="close" @click="router.push(`/p/${playlist?.id}`)" />
        </template>
      </TopBar>

      <ScreenScroll>
        <div style="padding: 8px 22px 0; text-align: center">
          <div v-if="playlist" style="display: inline-block">
            <Sigil :seeds="playlist.trackSeeds" :hues="playlist.sigil" :size="68" :radius="12" />
          </div>
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontSize: '26px',
              color: 'var(--ink)',
              marginTop: '12px',
              letterSpacing: '-0.3px',
            }"
          >{{ playlist?.name }}</div>
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '12px',
              color: 'var(--muted)',
              marginTop: '4px',
            }"
          >anyone you invite can add tracks from any service</div>
        </div>

        <!-- QR -->
        <div style="padding: 24px 22px 0">
          <div
            style="
              background: var(--surface);
              border-radius: 18px;
              padding: 24px;
              border: 0.5px solid var(--divider);
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 14px;
            "
          >
            <div
              :style="{
                display: 'grid',
                gridTemplateColumns: `repeat(${N}, 1fr)`,
                gap: '1px',
                width: '168px',
                height: '168px',
                background: '#fff',
                padding: '6px',
                borderRadius: '8px',
                boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.1)',
                boxSizing: 'border-box',
              }"
            >
              <template v-for="(row, y) in cells" :key="y">
                <div
                  v-for="(on, x) in row"
                  :key="`${y}-${x}`"
                  :style="{
                    background: on ? '#1A1714' : 'transparent',
                    borderRadius: '1px',
                  }"
                />
              </template>
            </div>
            <div
              :style="{
                fontFamily: '&quot;JetBrains Mono&quot;, monospace',
                fontSize: '12.5px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'var(--chip)',
                color: 'var(--ink)',
                letterSpacing: '0.5px',
              }"
            >{{ playlist?.code }}</div>
            <div style="font-family: Inter; font-size: 11px; color: var(--muted)">
              expires in 24h · {{ playlist?.members.length ?? 0 }} friends in this playlist
            </div>
          </div>
        </div>

        <!-- Share actions -->
        <div style="padding: 18px 22px 0; display: flex; gap: 8px">
          <button @click="onCopy" :style="{ ...pillBtn(true), height: '44px' }">
            <template v-if="copied">
              <Icon name="check" :size="16" /> copied
            </template>
            <template v-else>
              <Icon name="copy" :size="16" /> copy link
            </template>
          </button>
          <button @click="onShare" :style="{ ...pillBtn(false), height: '44px', padding: '0 16px' }">
            <Icon name="share" :size="16" />
            <span style="margin-left: 4px">share…</span>
          </button>
        </div>

        <!-- Service mix -->
        <div style="padding: 24px 22px 0">
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '15px',
              color: 'var(--muted)',
              marginBottom: '8px',
            }"
          >your playlist's services</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap">
            <template v-for="(s, k) in SERVICES" :key="k">
              <div
                v-if="serviceCount(k as ServiceKey) > 0"
                :style="{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 11px',
                  borderRadius: '999px',
                  background: 'var(--chip)',
                  fontFamily: 'Inter',
                  fontSize: '12px',
                  color: 'var(--ink)',
                }"
              >
                <ServiceGlyph :service="k as ServiceKey" :size="13" :color="s.color" />
                <span>{{ s.short }}</span>
                <span style="font-variant-numeric: tabular-nums; color: var(--muted)">
                  · {{ serviceCount(k as ServiceKey) }}
                </span>
              </div>
            </template>
          </div>
        </div>
      </ScreenScroll>
    </div>
  </ion-page>
</template>
