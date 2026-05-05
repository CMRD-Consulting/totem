<script setup lang="ts">
import {
  IonContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import SectionHeader from '@/components/SectionHeader.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import TopBar from '@/components/TopBar.vue';
import { pillBtn } from '@/components/pillBtn';
import { SERVICES } from '@/data/mock';
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

const router = useRouter();
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

onIonViewWillEnter(async () => {
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

async function onSignOut() {
  if (!window.confirm('Sign out?')) return;
  await auth.signOut();
  playlists.reset();
  router.replace('/sign-in');
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
          <IconButton name="back" @click="router.push('/')" />
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
          <div
            v-if="connections.length === 0"
            :style="{
              fontFamily: 'Inter',
              fontSize: '12.5px',
              color: 'var(--muted)',
              padding: '4px 0 8px',
              lineHeight: 1.4,
            }"
          >
            no services connected yet. open a playlist and tap the link icon
            to mirror to your account.
          </div>
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
