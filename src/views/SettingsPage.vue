<script setup lang="ts">
import {
  IonContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  alertController,
  useIonRouter,
} from '@ionic/vue';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { computed, onMounted, ref, watch } from 'vue';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import SectionHeader from '@/components/SectionHeader.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import TopBar from '@/components/TopBar.vue';
import { pillBtn } from '@/components/pillBtn';
import { SERVICES } from '@/data/mock';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { state } from '@/store/state';
import { useAuthStore } from '@/stores/auth';
import { usePlaylistsStore } from '@/stores/playlists';
import type { ServiceKey, ThemeKey } from '@/types';

interface Connection {
  service: ServiceKey;
  service_user_id: string | null;
  updated_at: string;
}

const emit = defineEmits<{ close: [] }>();

const ionRouter = useIonRouter();
const auth = useAuthStore();
const playlists = usePlaylistsStore();
const connections = ref<Connection[]>([]);
const nameDraft = ref('');
const savingName = ref(false);
const error = ref<string | null>(null);

const themes: { key: ThemeKey; label: string; sub: string }[] = [
  { key: 'midnight', label: 'midnight', sub: 'dark, late' },
  { key: 'paper', label: 'paper', sub: 'warm light' },
  { key: 'cream', label: 'cream', sub: 'crisp light' },
];

async function loadConnections() {
  const { data } = await supabase
    .from('service_connections')
    .select('service, service_user_id, updated_at');
  connections.value = (data ?? []) as Connection[];
}

// onMounted (not onIonViewWillEnter) because Settings is now hosted inside an
// IonModal, not the IonRouterOutlet — the page lifecycle hooks don't fire here.
// IonModal destroys + recreates the contents on each open by default, so this
// runs every time the user taps the settings icon.
onMounted(async () => {
  await Promise.all([
    auth.loadProfile(),
    loadConnections(),
  ]);
  nameDraft.value = auth.profile?.display_name ?? '';
});

async function onRefresh(event: CustomEvent) {
  try {
    await Promise.all([auth.loadProfile(), loadConnections()]);
  } finally {
    (event.target as HTMLIonRefresherElement).complete();
  }
}

const nameDirty = computed(
  () => nameDraft.value.trim().length > 0 && nameDraft.value.trim() !== auth.profile?.display_name,
);

async function saveName() {
  if (!nameDirty.value || savingName.value) return;
  savingName.value = true;
  error.value = null;
  try {
    await auth.setDisplayName(nameDraft.value.trim());
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    savingName.value = false;
  }
}

async function pickService(s: ServiceKey) {
  if (s === auth.preferredService) return;
  try {
    await auth.setPreferredService(s);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function pickTheme(t: ThemeKey) {
  state.theme = t;
}

const spotifyConnected = computed(() =>
  connections.value.some((c) => c.service === 'spotify'),
);

// Connection-only OAuth: omit playlist_id so the callback writes
// service_connections only (no mirror_target). After completion, future
// per-playlist mirroring can reuse the stored tokens directly.
// Backfill: after the user connects Spotify, surface a button to mirror all
// the playlists they're already a member of (which existed before the
// connection and so don't have mirror_target rows yet). Computed against
// service_connections + playlist_members + mirror_targets via RLS reads.
const playlistsToBackfill = ref<string[]>([]);
const backfilling = ref(false);
const backfillProgress = ref(0);

async function refreshBackfillList() {
  if (!spotifyConnected.value) {
    playlistsToBackfill.value = [];
    return;
  }
  // RLS scopes both reads to the current user — no user_id filter needed.
  const [{ data: memberships }, { data: existing }] = await Promise.all([
    supabase.from('playlist_members').select('playlist_id'),
    supabase.from('mirror_targets').select('playlist_id').eq('service', 'spotify'),
  ]);
  const mirrored = new Set((existing ?? []).map((m) => m.playlist_id));
  const memberIds = (memberships ?? []).map((m) => m.playlist_id);
  playlistsToBackfill.value = memberIds.filter((id) => !mirrored.has(id));
}

watch(
  spotifyConnected,
  (connected) => {
    if (connected) refreshBackfillList();
    else playlistsToBackfill.value = [];
  },
  { immediate: true },
);

async function runBackfill() {
  if (backfilling.value || playlistsToBackfill.value.length === 0) return;
  backfilling.value = true;
  backfillProgress.value = 0;
  error.value = null;
  // Sequential, not parallel: this is a one-shot setup, latency is fine, and
  // we don't want to fan out N concurrent Spotify createPlaylist calls.
  for (const playlistId of playlistsToBackfill.value) {
    await playlists.ensureMirrorTarget(playlistId, 'spotify');
    backfillProgress.value++;
  }
  await refreshBackfillList();
  backfilling.value = false;
}

async function connectSpotify() {
  error.value = null;
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    error.value = 'Not signed in';
    return;
  }
  const url =
    `${env.supabaseUrl}/functions/v1/oauth-start` +
    `?jwt=${encodeURIComponent(sess.session.access_token)}`;

  if (Capacitor.isNativePlatform()) {
    const sub = await Browser.addListener('browserFinished', async () => {
      await sub.remove();
      await loadConnections();
    });
    await Browser.open({ url });
  } else {
    const popup = window.open(url, '_blank');
    if (popup) {
      const interval = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(interval);
          loadConnections();
        }
      }, 800);
    }
  }
}

async function onSignOut() {
  const alert = await alertController.create({
    header: 'Sign out?',
    message: 'You can sign back in anytime with the same provider.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Sign out',
        role: 'destructive',
        handler: async () => {
          await auth.signOut();
          playlists.reset();
          // 'root' direction resets the IonRouterOutlet stack to /sign-in.
          // The router beforeEach guard dismisses the Settings modal in the
          // same tick.
          ionRouter.navigate('/sign-in', 'root', 'replace');
        },
      },
    ],
  });
  await alert.present();
}

function relTime(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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
        overflow: hidden;
      "
    >
      <TopBar title="settings">
        <template #left>
          <IconButton name="close" label="Close settings" @click="emit('close')" />
        </template>
      </TopBar>

      <ion-content
        :scroll-y="true"
        :style="{ '--background': 'var(--bg)', '--padding-bottom': '40px' }"
      >
        <ion-refresher slot="fixed" @ion-refresh="onRefresh">
          <ion-refresher-content
            pulling-icon="dots"
            refreshing-spinner="crescent"
          />
        </ion-refresher>

        <!-- Profile -->
        <SectionHeader>your name</SectionHeader>
        <div style="padding: 0 22px">
          <input
            v-model="nameDraft"
            type="text"
            autocapitalize="words"
            autocomplete="name"
            :disabled="savingName"
            :style="{
              all: 'unset',
              boxSizing: 'border-box',
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--surface)',
              border: '0.5px solid var(--divider)',
              fontFamily: 'Inter',
              fontSize: '15px',
              color: 'var(--ink)',
              fontWeight: 500,
            }"
          />
          <button
            v-if="nameDirty"
            @click="saveName"
            :style="{
              ...pillBtn(true),
              width: '100%',
              height: '40px',
              fontSize: '13px',
              marginTop: '8px',
            }"
          >{{ savingName ? 'saving…' : 'save name' }}</button>
        </div>

        <!-- Preferred service -->
        <SectionHeader :style-override="{ marginTop: '20px' }">your service</SectionHeader>
        <div style="padding: 0 16px">
          <button
            v-for="(s, k) in SERVICES"
            :key="k"
            type="button"
            :aria-pressed="auth.preferredService === k"
            :aria-label="`Use ${s.name} as your preferred service`"
            @click="pickService(k as ServiceKey)"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--surface)',
              border: auth.preferredService === k
                ? '1.5px solid var(--accent)'
                : '0.5px solid var(--divider)',
              marginBottom: '8px',
            }"
          >
            <ServiceGlyph :service="k as ServiceKey" :size="22" :color="s.color" />
            <div
              :style="{
                flex: 1,
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--ink)',
                textAlign: 'left',
              }"
            >{{ s.name }}</div>
            <div
              v-if="auth.preferredService === k"
              :style="{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }"
            >
              <Icon name="check" :size="12" />
            </div>
          </button>
        </div>

        <!-- Theme -->
        <SectionHeader :style-override="{ marginTop: '20px' }">theme</SectionHeader>
        <div style="padding: 0 16px; display: flex; gap: 8px">
          <button
            v-for="t in themes"
            :key="t.key"
            type="button"
            :aria-pressed="state.theme === t.key"
            :aria-label="`Use ${t.label} theme — ${t.sub}`"
            @click="pickTheme(t.key)"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              flex: 1,
              boxSizing: 'border-box',
              padding: '14px 10px',
              borderRadius: '12px',
              background: 'var(--surface)',
              border: state.theme === t.key
                ? '1.5px solid var(--accent)'
                : '0.5px solid var(--divider)',
              textAlign: 'center',
            }"
          >
            <div
              :style="{
                fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
                fontStyle: 'italic',
                fontSize: '17px',
                color: 'var(--ink)',
              }"
            >{{ t.label }}</div>
            <div
              :style="{
                fontFamily: 'Inter',
                fontSize: '11px',
                color: 'var(--muted)',
                marginTop: '2px',
              }"
            >{{ t.sub }}</div>
          </button>
        </div>

        <!-- Connections -->
        <SectionHeader :style-override="{ marginTop: '24px' }">connected services</SectionHeader>
        <div style="padding: 0 22px">
          <button
            v-if="!spotifyConnected"
            @click="connectSpotify"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              boxSizing: 'border-box',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--surface)',
              border: '0.5px solid var(--divider)',
              marginBottom: '8px',
            }"
          >
            <ServiceGlyph service="spotify" :size="22" :color="SERVICES.spotify.color" />
            <div style="flex: 1; text-align: left">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--ink)',
                }"
              >Connect Spotify</div>
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '11.5px',
                  color: 'var(--muted)',
                  marginTop: '1px',
                }"
              >one-time setup so future playlists can mirror automatically</div>
            </div>
            <Icon name="chevron" :size="14" color="var(--muted-2)" />
          </button>
          <div
            v-if="!spotifyConnected"
            :style="{
              fontFamily: 'Inter',
              fontSize: '11.5px',
              color: 'var(--muted-2)',
              padding: '4px 4px 8px',
              lineHeight: 1.4,
            }"
          >
            Apple Music and YouTube Music are coming in v1.
          </div>

          <!-- Backfill: only shows when Spotify is connected AND there are
               playlists the user is in that don't yet have a mirror_target. -->
          <button
            v-if="spotifyConnected && playlistsToBackfill.length > 0"
            @click="runBackfill"
            :disabled="backfilling"
            :style="{
              all: 'unset',
              cursor: backfilling ? 'wait' : 'pointer',
              boxSizing: 'border-box',
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              marginBottom: '8px',
              opacity: backfilling ? 0.7 : 1,
            }"
          >
            <div
              :style="{
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: '13.5px',
                color: 'var(--accent)',
              }"
            >
              {{
                backfilling
                  ? `mirroring ${backfillProgress} of ${playlistsToBackfill.length}…`
                  : `Mirror ${playlistsToBackfill.length} existing ${
                      playlistsToBackfill.length === 1 ? 'playlist' : 'playlists'
                    } to Spotify`
              }}
            </div>
            <div
              v-if="!backfilling"
              :style="{
                fontFamily: 'Inter',
                fontSize: '11.5px',
                color: 'var(--accent)',
                opacity: 0.7,
                marginTop: '2px',
                lineHeight: 1.35,
              }"
            >one-time setup for playlists you joined before connecting</div>
          </button>
          <div
            v-for="c in connections"
            :key="c.service"
            style="
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 10px 0;
              border-bottom: 0.5px solid var(--divider);
            "
          >
            <ServiceGlyph
              :service="c.service"
              :size="18"
              :color="SERVICES[c.service].color"
            />
            <div style="flex: 1">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  color: 'var(--ink)',
                }"
              >{{ SERVICES[c.service].name }}</div>
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '11.5px',
                  color: 'var(--muted)',
                }"
              >
                {{ c.service_user_id ? `as ${c.service_user_id}` : 'connected' }}
                · refreshed {{ relTime(c.updated_at) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Sign out -->
        <div style="padding: 32px 22px 0">
          <button
            @click="onSignOut"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              width: '100%',
              boxSizing: 'border-box',
              height: '46px',
              borderRadius: '12px',
              background: 'transparent',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Inter',
              fontWeight: 600,
              fontSize: '14px',
            }"
          >sign out</button>
        </div>

        <!-- Error pill -->
        <div
          v-if="error"
          :style="{
            margin: '14px 22px 0',
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

        <div
          :style="{
            padding: '24px 22px 12px',
            fontFamily: 'Inter',
            fontSize: '11px',
            color: 'var(--muted-2)',
            textAlign: 'center',
            lineHeight: 1.5,
          }"
        >
          totem v0
        </div>
      </ion-content>
    </div>
  </ion-page>
</template>
