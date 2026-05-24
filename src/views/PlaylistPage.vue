<script setup lang="ts">
import {
  IonActionSheet,
  IonContent,
  IonModal,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  alertController,
  onIonViewDidEnter,
  onIonViewWillEnter,
  useIonRouter,
} from '@ionic/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Avatar from '@/components/Avatar.vue';
import AvatarStack from '@/components/AvatarStack.vue';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import PasteLinkSheet from '@/components/PasteLinkSheet.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import Sigil from '@/components/Sigil.vue';
import TopBar from '@/components/TopBar.vue';
import TrackRow from '@/components/TrackRow.vue';
import InvitePage from '@/views/InvitePage.vue';
import MirrorPage from '@/views/MirrorPage.vue';
import TrackDetailPage from '@/views/TrackDetailPage.vue';
import { peekMusicClipboard, shortUrl } from '@/lib/musicUrl';
import { pillBtn } from '@/components/pillBtn';
import { SERVICES } from '@/data/mock';
import { supabase } from '@/lib/supabase';
import { useRealtimePlaylist } from '@/composables/useRealtimePlaylist';
import { useAuthStore } from '@/stores/auth';
import { usePlaylistsStore } from '@/stores/playlists';
import { usersById } from '@/store/users';
import type { ServiceKey } from '@/types';

interface MyMirror {
  service: ServiceKey;
  enabled: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

const router = useRouter();
const ionRouter = useIonRouter();
const route = useRoute();
const playlists = usePlaylistsStore();
const auth = useAuthStore();

function goBack() {
  // 'back' direction tells IonRouterOutlet to animate the right-slide-out
  // pop, revealing Hub underneath — instead of treating Hub as a forward
  // push (which would be the default if we just called router.push('/')).
  if (ionRouter.canGoBack()) {
    ionRouter.back();
  } else {
    ionRouter.navigate('/', 'back', 'pop');
  }
}
const tab = ref<'songs' | 'members'>('songs');
const shareSheetOpen = ref(false);
const actionSheetOpen = ref(false);
const inviteOpen = ref(false);
const mirrorOpen = ref(false);
const trackOpenId = ref<string | null>(null);
const myMirrors = ref<MyMirror[]>([]);

// Used by card modals hosted on this page (Invite, eventually Mirror + Track)
// to give the iOS card-stack recession its target. Pointing at the router
// outlet means the whole app surface participates, not just this one page.
const presentingElement = ref<HTMLElement | null>(null);

// Inline empty-state add-track UI. Mirrors the input + clipboard chip pattern
// PasteLinkSheet uses, but lives directly in the empty playlist instead of
// requiring the "add a song" tap. Hidden whenever tracks.length > 0.
const emptyUrl = ref('');
const emptyClipboard = ref<string | null>(null);
const emptyUrlInput = ref<HTMLInputElement | null>(null);
const emptyIsLikelyUrl = computed(() =>
  /^https?:\/\//i.test(emptyUrl.value.trim()),
);
// Hide the chip the moment the user types — they're entering their own URL,
// the clipboard suggestion is no longer relevant.
watch(emptyUrl, (v) => {
  if (v) emptyClipboard.value = null;
});

function submitEmptyUrl() {
  if (!emptyIsLikelyUrl.value || !playlistId.value) return;
  // Fire-and-forget: ingestUrl pushes a 'resolving' pending row, so the
  // empty state vanishes immediately and the user sees the optimistic entry.
  // Failures surface as a 'failed' track row inside the list, not here.
  playlists.ingestUrl(playlistId.value, emptyUrl.value.trim());
  emptyUrl.value = '';
  emptyClipboard.value = null;
}

function pasteAndAddEmpty() {
  if (!emptyClipboard.value) return;
  emptyUrl.value = emptyClipboard.value;
  submitEmptyUrl();
}

onMounted(async () => {
  presentingElement.value = document.querySelector('ion-router-outlet');
  // Best-effort clipboard peek. Denied permissions resolve to null silently.
  emptyClipboard.value = await peekMusicClipboard();
});

// Autofocus the empty-state URL input once Ionic finishes the route
// transition. Firing earlier (in onIonViewWillEnter or onMounted) races the
// slide animation and iOS may swallow the keyboard request. The guard
// avoids a stray focus call when the playlist already has tracks.
onIonViewDidEnter(() => {
  if (tab.value === 'songs' && tracks.value.length === 0) {
    emptyUrlInput.value?.focus();
  }
});

const playlistId = computed(() => route.params.playlistId as string);
const playlist = computed(
  () => playlists.playlists.find((g) => g.id === playlistId.value) ?? playlists.playlists[0],
);
// Real tracks first, then any pending optimistic entries appended at the
// bottom (they sort by add-time which is "now"). Failed entries stay until
// dismissed; resolving entries vanish on success and are replaced by the
// real row coming back from loadTracks.
const tracks = computed(() => {
  const real = playlists.tracksByPlaylistId[playlistId.value] ?? [];
  const pending = playlists.pendingByPlaylistId[playlistId.value] ?? [];
  return [...real, ...pending];
});

// Pick the most useful mirror to spotlight: enabled spotify > any enabled > any.
// RLS scopes mirror_targets reads to user_id = auth.uid(), so this is "my" mirror.
const primaryMirror = computed<MyMirror | null>(() => {
  const list = myMirrors.value;
  if (!list.length) return null;
  return (
    list.find((m) => m.enabled && m.service === 'spotify') ||
    list.find((m) => m.enabled) ||
    list[0]
  );
});

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

async function loadMyMirrors() {
  if (!playlistId.value) return;
  const { data, error } = await supabase
    .from('mirror_targets')
    .select('service, enabled, last_synced_at, last_sync_error')
    .eq('playlist_id', playlistId.value);
  if (error) {
    myMirrors.value = [];
    return;
  }
  myMirrors.value = (data ?? []) as MyMirror[];
}

onIonViewWillEnter(async () => {
  if (!playlists.loaded) await playlists.loadList().catch(() => {});
  if (playlistId.value) {
    await Promise.all([
      playlists.loadTracks(playlistId.value).catch(() => {}),
      loadMyMirrors().catch(() => {}),
    ]);
  }
});

// Live updates: when a friend adds/removes a track, refetch automatically.
useRealtimePlaylist(playlistId);

watch(playlistId, async (id) => {
  if (!id) return;
  await Promise.all([
    playlists.loadTracks(id).catch(() => {}),
    loadMyMirrors().catch(() => {}),
  ]);
});

function onSent() {
  shareSheetOpen.value = false;
  if (playlistId.value) playlists.loadTracks(playlistId.value).catch(() => {});
}

async function onRefresh(event: CustomEvent) {
  try {
    if (playlistId.value) {
      await Promise.all([
        playlists.loadTracks(playlistId.value),
        loadMyMirrors(),
      ]);
    }
  } finally {
    (event.target as HTMLIonRefresherElement).complete();
  }
}

const pasteLinkSheetRef = ref<{ focus: () => void } | null>(null);

function onShareSheetPresented() {
  // Focus the URL input only after the modal's slide-up animation completes.
  pasteLinkSheetRef.value?.focus();
}

const isCreator = computed(
  () => !!playlist.value && !!auth.user && playlist.value.createdBy === auth.user.id,
);

const actionButtons = computed(() => {
  const buttons: { text: string; role?: 'destructive' | 'cancel'; data: string }[] = [];
  if (isCreator.value) {
    buttons.push({ text: 'Rotate invite link', data: 'rotate' });
    buttons.push({
      text: 'Delete playlist',
      role: 'destructive',
      data: 'delete',
    });
  } else {
    buttons.push({
      text: 'Leave playlist',
      role: 'destructive',
      data: 'leave',
    });
  }
  buttons.push({ text: 'Cancel', role: 'cancel', data: 'cancel' });
  return buttons;
});

/**
 * Themed Yes/Cancel confirmation. Replaces window.confirm so the prompt
 * matches Ionic's modal language (and so a native iOS app doesn't show a
 * browser-chrome dialog over the Capacitor view).
 */
async function confirmDestructive(
  header: string,
  message: string,
  destructiveLabel: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    alertController
      .create({
        header,
        message,
        buttons: [
          { text: 'Cancel', role: 'cancel', handler: () => resolve(false) },
          { text: destructiveLabel, role: 'destructive', handler: () => resolve(true) },
        ],
      })
      .then((alert) => {
        alert.onDidDismiss().then(() => resolve(false));
        alert.present();
      });
  });
}

async function onActionPicked(ev: CustomEvent) {
  const data = (ev.detail.data as string) ?? 'cancel';
  if (!playlist.value || data === 'cancel') return;
  try {
    if (data === 'rotate') {
      const newToken = await playlists.rotateInvite(playlist.value.id);
      await alertController
        .create({
          header: 'New invite link',
          message: `Code: TOTEM-${newToken.slice(0, 6).toUpperCase()}`,
          buttons: ['OK'],
        })
        .then((a) => a.present());
    } else if (data === 'leave') {
      const ok = await confirmDestructive(
        `Leave "${playlist.value.name}"?`,
        'You can rejoin anytime with the invite link.',
        'Leave',
      );
      if (!ok) return;
      await playlists.leave(playlist.value.id);
      router.replace('/');
    } else if (data === 'delete') {
      const ok = await confirmDestructive(
        `Delete "${playlist.value.name}"?`,
        'This removes the playlist for everyone. Cannot be undone.',
        'Delete',
      );
      if (!ok) return;
      await playlists.deletePlaylist(playlist.value.id);
      router.replace('/');
    }
  } catch (e) {
    await alertController
      .create({
        header: 'Something went wrong',
        message: (e as Error).message,
        buttons: ['OK'],
      })
      .then((a) => a.present());
  }
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
      <TopBar>
        <template #left>
          <IconButton name="back" label="Back to your playlists" @click="goBack" />
        </template>
        <template #right>
          <IconButton name="more" label="Playlist actions" @click="actionSheetOpen = true" />
        </template>
      </TopBar>

      <ion-content
        class="totem-content"
        :scroll-y="true"
        :style="{
          '--background': 'var(--bg)',
          '--padding-bottom': '120px',
        }"
      >
        <ion-refresher slot="fixed" @ion-refresh="onRefresh">
          <ion-refresher-content
            pulling-icon="dots"
            refreshing-spinner="crescent"
          />
        </ion-refresher>
        <!-- Cold page loads (refresh) mount this view before the playlists
             store has populated, so `playlist` is undefined for one tick.
             Gate the content so the template never dereferences undefined. -->
        <template v-if="playlist">
        <!-- Hero -->
        <div style="padding: 4px 22px 18px">
          <div style="display: flex; align-items: flex-end; gap: 14px">
            <Sigil
              :seeds="playlist.trackSeeds"
              :hues="playlist.sigil"
              :size="72"
              :radius="12"
            />
            <div style="flex: 1; padding-bottom: 4px">
              <div
                :style="{
                  fontFamily: '&quot;JetBrains Mono&quot;, monospace',
                  fontSize: '10px',
                  color: 'var(--muted-2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                }"
              >shared playlist</div>
              <div
                :style="{
                  fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
                  fontSize: '30px',
                  fontWeight: 400,
                  color: 'var(--ink)',
                  lineHeight: 1.05,
                  marginTop: '2px',
                  letterSpacing: '-0.5px',
                }"
              >{{ playlist.name }}</div>
            </div>
          </div>
          <div
            style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-top: 14px;
              flex-wrap: wrap;
            "
          >
            <AvatarStack
              :ids="playlist.members.filter((m) => m !== 'you')"
              :size="22"
              :max="5"
            />
            <span
              :style="{
                fontFamily: 'Inter',
                fontSize: '12px',
                color: 'var(--muted)',
                fontVariantNumeric: 'tabular-nums',
              }"
            >
              {{ playlist.members.length }} friends · {{ playlist.tracks }} songs
            </span>
          </div>

          <!-- Action bar — "add a song" is hidden when the playlist is empty
               because the songs tab's inline empty state already surfaces a
               URL input + paste-and-add chip. Two competing CTAs for the
               same action confused the empty case. -->
          <div style="display: flex; gap: 8px; margin-top: 16px">
            <button
              v-if="tracks.length > 0"
              :style="pillBtn(true)"
              @click="shareSheetOpen = true"
            >
              <Icon name="plus" :size="15" />
              <span>add a song</span>
            </button>
            <button :style="pillBtn(false)" @click="inviteOpen = true">
              <Icon name="share" :size="15" />
            </button>
            <button :style="pillBtn(false)" @click="mirrorOpen = true">
              <Icon name="link" :size="15" />
            </button>
          </div>

          <!-- Mirror status — live from mirror_targets, scoped to me by RLS.
               Rendered as a <button> so screen readers announce it as
               actionable, and the chevron is always present so the "tap to
               manage" affordance is consistent. -->
          <button
            v-if="primaryMirror"
            type="button"
            aria-label="Manage mirror settings"
            @click="mirrorOpen = true"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              boxSizing: 'border-box',
              width: '100%',
              marginTop: '14px',
              padding: '10px 12px',
              background: 'var(--chip)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }"
          >
            <ServiceGlyph
              :service="primaryMirror.service"
              :size="16"
              :color="SERVICES[primaryMirror.service].color"
            />
            <div
              :style="{
                flex: 1,
                textAlign: 'left',
                fontFamily: 'Inter',
                fontSize: '12px',
                color: 'var(--ink)',
              }"
            >
              <template v-if="primaryMirror.last_sync_error">
                <b>{{ SERVICES[primaryMirror.service].short }}</b> mirror
                <span style="color: var(--accent); font-weight: 500">
                  · {{ primaryMirror.last_sync_error }}
                </span>
              </template>
              <template v-else-if="!primaryMirror.enabled">
                <b>{{ SERVICES[primaryMirror.service].short }}</b> mirror
                <span style="color: var(--muted); font-weight: 400">
                  · disabled — tap to re-enable
                </span>
              </template>
              <template v-else>
                Mirroring to your <b>{{ SERVICES[primaryMirror.service].short }}</b>
                <span style="color: var(--muted); font-weight: 400">
                  · {{ relSync(primaryMirror.last_synced_at) }}
                </span>
              </template>
            </div>
            <!-- Status indicator (synced check / error) is now a separate
                 inline element from the always-present chevron — keeps the
                 "tap to manage" affordance consistent regardless of state. -->
            <Icon
              v-if="primaryMirror.enabled && !primaryMirror.last_sync_error"
              name="check"
              :size="14"
              color="var(--accent)"
            />
            <Icon name="chevron" :size="14" color="var(--muted-2)" />
          </button>
          <button
            v-else
            type="button"
            aria-label="Set up a mirror for this playlist"
            @click="mirrorOpen = true"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              boxSizing: 'border-box',
              width: '100%',
              marginTop: '14px',
              padding: '10px 12px',
              background: 'var(--chip)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }"
          >
            <Icon name="link" :size="16" color="var(--muted)" />
            <div
              :style="{
                flex: 1,
                textAlign: 'left',
                fontFamily: 'Inter',
                fontSize: '12px',
                color: 'var(--muted)',
              }"
            >mirror this playlist into your own service</div>
            <Icon name="chevron" :size="14" color="var(--muted-2)" />
          </button>
        </div>

        <!-- Tabs -->
        <div
          style="
            display: flex;
            gap: 4px;
            padding: 0 14px;
            border-bottom: 0.5px solid var(--divider);
          "
        >
          <button
            v-for="t in [
              { k: 'songs', label: 'songs', n: playlist.tracks },
              { k: 'members', label: 'friends', n: playlist.members.length },
            ]"
            :key="t.k"
            type="button"
            :aria-pressed="tab === t.k"
            @click="tab = (t.k as 'songs' | 'members')"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              padding: '14px 12px',
              fontFamily: 'Inter',
              fontSize: '13px',
              fontWeight: 600,
              color: tab === t.k ? 'var(--ink)' : 'var(--muted)',
              borderBottom:
                tab === t.k ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-0.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }"
          >
            {{ t.label }}
            <span
              v-if="t.n !== null"
              :style="{
                fontFamily: '&quot;JetBrains Mono&quot;, monospace',
                fontSize: '10px',
                color: 'var(--muted-2)',
                fontVariantNumeric: 'tabular-nums',
              }"
            >{{ t.n }}</span>
          </button>
        </div>

        <!-- Songs -->
        <template v-if="tab === 'songs'">
          <TrackRow
            v-for="t in tracks"
            :key="t.id"
            :track="t"
            @tap="trackOpenId = t.id"
            @dismiss="playlists.dismissPending(playlist.id, t.id)"
          />
          <div
            v-if="tracks.length === 0"
            :style="{ padding: '30px 22px 0', maxWidth: '420px', margin: '0 auto' }"
          >
            <div
              :style="{
                textAlign: 'center',
                fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
                fontStyle: 'italic',
                fontSize: '17px',
                color: 'var(--muted)',
                lineHeight: 1.4,
                marginBottom: '20px',
              }"
            >
              no songs yet — <br />
              paste a link to start the mixtape.
            </div>

            <input
              ref="emptyUrlInput"
              v-model="emptyUrl"
              type="url"
              inputmode="url"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="https://open.spotify.com/track/…"
              @keyup.enter="submitEmptyUrl"
              :style="{
                all: 'unset',
                boxSizing: 'border-box',
                width: '100%',
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'var(--surface)',
                border: '0.5px solid var(--divider)',
                fontFamily: '&quot;JetBrains Mono&quot;, ui-monospace, monospace',
                fontSize: '13px',
                color: 'var(--ink)',
              }"
            />

            <!-- Clipboard chip — shown only when the input is empty AND the
                 clipboard contains a music URL. Tapping it fills + sends. -->
            <button
              v-if="!emptyUrl && emptyClipboard"
              @click="pasteAndAddEmpty"
              :style="{
                all: 'unset',
                cursor: 'pointer',
                boxSizing: 'border-box',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginTop: '10px',
              }"
            >
              <Icon name="copy" :size="14" color="var(--accent)" />
              <div style="flex: 1; min-width: 0; text-align: left">
                <div
                  :style="{
                    fontFamily: 'Inter',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    color: 'var(--accent)',
                  }"
                >paste &amp; add</div>
                <div
                  :style="{
                    fontFamily: '&quot;JetBrains Mono&quot;, ui-monospace, monospace',
                    fontSize: '11px',
                    color: 'var(--muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '1px',
                  }"
                >{{ shortUrl(emptyClipboard) }}</div>
              </div>
              <Icon name="arrow-out" :size="14" color="var(--accent)" />
            </button>

            <!-- Submit — always visible so the goal of the empty state is
                 obvious. Disabled state communicated via opacity (not just
                 color shift) so colorblind users get a non-color signal. -->
            <button
              :disabled="!emptyIsLikelyUrl"
              @click="submitEmptyUrl"
              :style="{
                all: 'unset',
                cursor: emptyIsLikelyUrl ? 'pointer' : 'not-allowed',
                opacity: emptyIsLikelyUrl ? 1 : 0.5,
                boxSizing: 'border-box',
                width: '100%',
                height: '46px',
                borderRadius: '14px',
                background: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Inter',
                fontWeight: 700,
                fontSize: '14px',
                marginTop: '10px',
                transition: 'opacity 0.2s',
              }"
            >add to playlist</button>
          </div>
        </template>

        <!-- Members -->
        <div v-else style="padding: 8px 14px">
          <div
            v-for="m in playlist.members"
            :key="m"
            style="display: flex; align-items: center; gap: 12px; padding: 10px 8px"
          >
            <Avatar :id="m" :size="36" />
            <div style="flex: 1">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--ink)',
                }"
              >
                {{ usersById[m]?.name }}
                <span v-if="m === 'you'" style="color: var(--muted); font-weight: 400">
                  (you)
                </span>
              </div>
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '11.5px',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  marginTop: '1px',
                }"
              >
                <ServiceGlyph
                  :service="usersById[m]?.service ?? 'spotify'"
                  :size="10"
                  :color="SERVICES[usersById[m]?.service ?? 'spotify'].color"
                />
                <span>listens on {{ SERVICES[usersById[m]?.service ?? 'spotify'].short }}</span>
              </div>
            </div>
            <Icon name="more" :size="16" color="var(--muted-2)" />
          </div>
        </div>
        </template>
      </ion-content>
    </div>

    <!-- Add card modal — same iOS card-recession style as Invite/Mirror/etc.
         Was a draggable sheet; switched to card for consistency with the
         rest of the modal trays in the app. -->
    <ion-modal
      :is-open="shareSheetOpen"
      :presenting-element="presentingElement ?? undefined"
      @did-present="onShareSheetPresented"
      @did-dismiss="shareSheetOpen = false"
    >
      <PasteLinkSheet
        ref="pasteLinkSheetRef"
        :playlist-id="playlistId"
        :is-open="shareSheetOpen"
        @close="shareSheetOpen = false"
        @sent="onSent"
      />
    </ion-modal>

    <ion-action-sheet
      :is-open="actionSheetOpen"
      :buttons="actionButtons"
      :header="playlist?.name"
      @did-dismiss="actionSheetOpen = false; onActionPicked($event as CustomEvent)"
    />

    <!-- Invite card modal — slides up over the playlist with iOS-style card recession. -->
    <ion-modal
      :is-open="inviteOpen"
      :presenting-element="presentingElement ?? undefined"
      @did-dismiss="inviteOpen = false"
    >
      <InvitePage :playlist-id="playlistId" @close="inviteOpen = false" />
    </ion-modal>

    <!-- Mirror card modal — same card-recession style as Invite. -->
    <ion-modal
      :is-open="mirrorOpen"
      :presenting-element="presentingElement ?? undefined"
      @did-dismiss="mirrorOpen = false"
    >
      <MirrorPage :playlist-id="playlistId" @close="mirrorOpen = false" />
    </ion-modal>

    <!-- Track card modal — was a sheet with breakpoints; switched to card
         for consistency with the rest of the modal trays. -->
    <ion-modal
      :is-open="trackOpenId !== null"
      :presenting-element="presentingElement ?? undefined"
      @did-dismiss="trackOpenId = null"
    >
      <TrackDetailPage
        v-if="trackOpenId"
        :playlist-id="playlistId"
        :track-id="trackOpenId"
        @close="trackOpenId = null"
      />
    </ion-modal>
  </ion-page>
</template>
