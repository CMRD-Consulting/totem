<script setup lang="ts">
import {
  IonContent,
  IonModal,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
  useIonRouter,
} from '@ionic/vue';
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ActivityRow from '@/components/ActivityRow.vue';
import AvatarStack from '@/components/AvatarStack.vue';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import LogoMark from '@/components/LogoMark.vue';
import SectionHeader from '@/components/SectionHeader.vue';
import Sigil from '@/components/Sigil.vue';
import Spinner from '@/components/Spinner.vue';
import TopBar from '@/components/TopBar.vue';
import Wordmark from '@/components/Wordmark.vue';
import CreatePage from '@/views/CreatePage.vue';
import SettingsPage from '@/views/SettingsPage.vue';
import { usePlaylistsStore } from '@/stores/playlists';

const router = useRouter();
const route = useRoute();
const ionRouter = useIonRouter();
const playlists = usePlaylistsStore();

function openPlaylist(id: string) {
  // Explicit forward push so IonRouterOutlet animates left-slide.
  ionRouter.navigate(`/p/${id}`, 'forward', 'push');
}

const settingsOpen = ref(false);
const createOpen = ref(false);

// One-time pull-to-refresh hint. Self-dismisses on first user pull or after
// a few interactions. Stored in localStorage so it's gone the next session.
const showPullHint = ref(false);
const PULL_HINT_KEY = 'totem.pullHint.v1';
onMounted(() => {
  if (typeof window !== 'undefined' && !window.localStorage.getItem(PULL_HINT_KEY)) {
    showPullHint.value = true;
  }
});
function dismissPullHint() {
  showPullHint.value = false;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PULL_HINT_KEY, '1');
  }
}
// Imperative focus hook on CreatePage — fired after the modal animation
// completes (@did-present), matching the pattern PlaylistPage uses for the
// PasteLinkSheet so iOS reliably raises the keyboard.
const createPageRef = ref<{ focus: () => void } | null>(null);
// Pointing this at the router-outlet (rather than this page's IonPage) makes
// the entire app surface participate in the iOS card-stack recession when the
// settings modal slides up.
const presentingElement = ref<HTMLElement | null>(null);
onMounted(() => {
  presentingElement.value = document.querySelector('ion-router-outlet');
});

// Cross-modal hand-off: when something else (e.g. Mirror modal's "Connect
// Spotify in Settings" button) routes to /?openSettings=1, open Settings
// here and clear the query param so a refresh / back nav doesn't reopen.
watch(
  () => route.query.openSettings,
  (v) => {
    if (v) {
      settingsOpen.value = true;
      router.replace({ query: { ...route.query, openSettings: undefined } });
    }
  },
  { immediate: true },
);

onIonViewWillEnter(() => {
  playlists.loadList().catch(() => {});
  playlists.loadRecentActivity().catch(() => {});
});

async function onRefresh(event: CustomEvent) {
  try {
    await Promise.all([
      playlists.loadList(),
      playlists.loadRecentActivity(),
    ]);
  } finally {
    (event.target as HTMLIonRefresherElement).complete();
    // First successful pull dismisses the hint — they've discovered it.
    dismissPullHint();
  }
}

function onSettings() {
  settingsOpen.value = true;
}

function onCreate() {
  createOpen.value = true;
}
</script>

<template>
  <ion-page>
    <div
      class="totem-app"
      style="
        width: 100%;
        height: 100%;
        background: var(--bg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      "
    >
      <TopBar>
        <template #left>
          <IconButton name="settings" label="Settings" @click="onSettings" />
        </template>
        <template #right>
          <IconButton name="plus" label="New playlist" accent @click="onCreate" />
        </template>
      </TopBar>

      <ion-content
        class="totem-content"
        :scroll-y="true"
        :style="{
          '--background': 'var(--bg)',
          '--padding-bottom': '40px',
        }"
      >
        <ion-refresher slot="fixed" @ion-refresh="onRefresh">
          <ion-refresher-content
            pulling-icon="dots"
            refreshing-spinner="crescent"
          />
        </ion-refresher>
        <div :style="{ padding: '8px 22px 22px', display: 'flex', alignItems: 'center', gap: '14px' }">
          <LogoMark :size="80" />
          <div>
            <Wordmark :size="42" />
            <div
              :style="{
                fontFamily: 'Inter',
                fontSize: '13px',
                color: 'var(--muted)',
                marginTop: '10px',
                lineHeight: 1.4,
                maxWidth: '280px',
              }"
            >
              Shared playlists across Spotify, Apple Music, and YouTube Music.
              With the people you'd burn a CD for.
            </div>
          </div>
        </div>

        <!-- First-launch pull-to-refresh hint. Dismissed on first pull or
             explicit tap. Subtle italic-serif so it doesn't dominate. -->
        <div
          v-if="showPullHint && playlists.loaded && playlists.playlists.length > 0"
          @click="dismissPullHint"
          :style="{
            margin: '0 22px 12px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'var(--chip)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
            fontStyle: 'italic',
            fontSize: '12px',
            color: 'var(--muted)',
          }"
        >
          <span>↓ pull down to refresh</span>
        </div>

        <SectionHeader>your playlists</SectionHeader>

        <!-- Initial load — show spinner while playlists fetch. Once loaded,
             swap to the actual list / empty state below. -->
        <div v-if="!playlists.loaded && playlists.loading" style="padding: 24px 0">
          <Spinner :size="28" />
        </div>

        <!-- First-run welcome: only when the user has zero playlists. The
             dashed "start a new playlist" row remains as the action; this
             warms it up. -->
        <div
          v-if="playlists.loaded && playlists.playlists.length === 0"
          :style="{
            margin: '0 22px 14px',
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'var(--chip)',
            border: '0.5px solid var(--divider)',
          }"
        >
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '17px',
              color: 'var(--ink)',
              lineHeight: 1.3,
            }"
          >start your first mixtape.</div>
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '12.5px',
              color: 'var(--muted)',
              marginTop: '4px',
              lineHeight: 1.4,
            }"
          >make a playlist for your group, or paste an invite link a friend sent you.</div>
        </div>

        <div style="padding: 0 14px">
          <button
            v-for="g in playlists.playlists"
            :key="g.id"
            type="button"
            :aria-label="`Open playlist ${g.name}`"
            @click="openPlaylist(g.id)"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              boxSizing: 'border-box',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px',
              background: 'var(--surface)',
              borderRadius: '14px',
              marginBottom: '8px',
              boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
              border: '0.5px solid var(--divider)',
            }"
          >
            <Sigil :seeds="g.trackSeeds" :hues="g.sigil" :size="48" :radius="9" />
            <div style="flex: 1; min-width: 0">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '15px',
                  color: 'var(--ink)',
                  letterSpacing: '-0.1px',
                }"
              >{{ g.name }}</div>
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '12px',
                  color: 'var(--muted)',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }"
              >
                <span style="font-variant-numeric: tabular-nums">
                  {{ g.tracks }} songs
                </span>
                <span>·</span>
                <span>{{ g.members.length }} friends</span>
              </div>
            </div>
            <AvatarStack
              :ids="g.members.filter((m) => m !== 'you')"
              :size="20"
              :max="3"
            />
          </button>

          <button
            type="button"
            aria-label="Start a new playlist"
            @click="onCreate"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              boxSizing: 'border-box',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px',
              borderRadius: '14px',
              border: '1px dashed var(--divider-strong)',
              color: 'var(--muted)',
              marginTop: '4px',
            }"
          >
            <div
              style="
                width: 48px;
                height: 48px;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--chip);
              "
            >
              <Icon name="plus" :size="20" />
            </div>
            <div style="flex: 1">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--ink)',
                }"
              >start a new playlist</div>
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '12px',
                  color: 'var(--muted)',
                  marginTop: '2px',
                }"
              >or join with an invite link</div>
            </div>
            <Icon name="chevron" :size="18" />
          </button>
        </div>

        <template v-if="playlists.recentActivity.length > 0">
          <SectionHeader :style-override="{ marginTop: '24px' }">recent activity</SectionHeader>
          <div style="padding: 0 22px">
            <ActivityRow
              v-for="a in playlists.recentActivity.slice(0, 8)"
              :key="a.id"
              :item="a"
            />
          </div>
        </template>
      </ion-content>
    </div>

    <!-- Settings card modal — slides up over Hub with iOS-style card recession. -->
    <ion-modal
      :is-open="settingsOpen"
      :presenting-element="presentingElement ?? undefined"
      @did-dismiss="settingsOpen = false"
    >
      <SettingsPage @close="settingsOpen = false" />
    </ion-modal>

    <!-- Create card modal — focus the name input only after the slide-up
         animation completes; firing earlier loses to the transition and iOS
         won't raise the keyboard reliably. -->
    <ion-modal
      :is-open="createOpen"
      :presenting-element="presentingElement ?? undefined"
      @did-present="createPageRef?.focus()"
      @did-dismiss="createOpen = false"
    >
      <CreatePage ref="createPageRef" @close="createOpen = false" />
    </ion-modal>
  </ion-page>
</template>
