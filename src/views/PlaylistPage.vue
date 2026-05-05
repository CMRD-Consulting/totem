<script setup lang="ts">
import { IonActionSheet, IonModal, IonPage, onIonViewWillEnter } from '@ionic/vue';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ActivityRow from '@/components/ActivityRow.vue';
import Avatar from '@/components/Avatar.vue';
import AvatarStack from '@/components/AvatarStack.vue';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import PasteLinkSheet from '@/components/PasteLinkSheet.vue';
import ScreenScroll from '@/components/ScreenScroll.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import Sigil from '@/components/Sigil.vue';
import TopBar from '@/components/TopBar.vue';
import TrackRow from '@/components/TrackRow.vue';
import { pillBtn } from '@/components/pillBtn';
import { ACTIVITY, SERVICES } from '@/data/mock';
import { supabase } from '@/lib/supabase';
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
const route = useRoute();
const playlists = usePlaylistsStore();
const auth = useAuthStore();
const tab = ref<'songs' | 'activity' | 'members'>('songs');
const shareSheetOpen = ref(false);
const actionSheetOpen = ref(false);
const myMirrors = ref<MyMirror[]>([]);

const playlistId = computed(() => route.params.playlistId as string);
const playlist = computed(
  () => playlists.playlists.find((g) => g.id === playlistId.value) ?? playlists.playlists[0],
);
const tracks = computed(() => playlists.tracksByPlaylistId[playlistId.value] ?? []);

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

async function onActionPicked(ev: CustomEvent) {
  const data = (ev.detail.data as string) ?? 'cancel';
  if (!playlist.value || data === 'cancel') return;
  try {
    if (data === 'rotate') {
      const newToken = await playlists.rotateInvite(playlist.value.id);
      window.alert(`New invite link generated. Code: TOTEM-${newToken.slice(0, 6).toUpperCase()}`);
    } else if (data === 'leave') {
      if (!window.confirm(`Leave "${playlist.value.name}"?`)) return;
      await playlists.leave(playlist.value.id);
      router.replace('/');
    } else if (data === 'delete') {
      if (
        !window.confirm(
          `Delete "${playlist.value.name}"? This removes the playlist for everyone.`,
        )
      ) {
        return;
      }
      await playlists.deletePlaylist(playlist.value.id);
      router.replace('/');
    }
  } catch (e) {
    window.alert((e as Error).message);
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
          <IconButton name="back" @click="router.push('/')" />
        </template>
        <template #right>
          <IconButton name="more" @click="actionSheetOpen = true" />
        </template>
      </TopBar>

      <ScreenScroll :pad-bottom="120">
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

          <!-- Action bar -->
          <div style="display: flex; gap: 8px; margin-top: 16px">
            <button :style="pillBtn(true)" @click="shareSheetOpen = true">
              <Icon name="plus" :size="15" />
              <span>add a song</span>
            </button>
            <button :style="pillBtn(false)" @click="router.push(`/p/${playlist.id}/invite`)">
              <Icon name="share" :size="15" />
            </button>
            <button :style="pillBtn(false)" @click="router.push(`/p/${playlist.id}/mirror`)">
              <Icon name="link" :size="15" />
            </button>
          </div>

          <!-- Mirror status — live from mirror_targets, scoped to me by RLS -->
          <div
            v-if="primaryMirror"
            @click="router.push(`/p/${playlist.id}/mirror`)"
            style="
              margin-top: 14px;
              padding: 10px 12px;
              background: var(--chip);
              border-radius: 10px;
              display: flex;
              align-items: center;
              gap: 10px;
              cursor: pointer;
            "
          >
            <ServiceGlyph
              :service="primaryMirror.service"
              :size="16"
              :color="SERVICES[primaryMirror.service].color"
            />
            <div
              :style="{
                flex: 1,
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
            <Icon
              v-if="primaryMirror.enabled && !primaryMirror.last_sync_error"
              name="check"
              :size="14"
              color="var(--accent)"
            />
            <Icon v-else name="chevron" :size="14" color="var(--muted-2)" />
          </div>
          <div
            v-else
            @click="router.push(`/p/${playlist.id}/mirror`)"
            style="
              margin-top: 14px;
              padding: 10px 12px;
              background: var(--chip);
              border-radius: 10px;
              display: flex;
              align-items: center;
              gap: 10px;
              cursor: pointer;
            "
          >
            <Icon name="link" :size="16" color="var(--muted)" />
            <div
              :style="{
                flex: 1,
                fontFamily: 'Inter',
                fontSize: '12px',
                color: 'var(--muted)',
              }"
            >mirror this playlist into your own service</div>
            <Icon name="chevron" :size="14" color="var(--muted-2)" />
          </div>
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
              { k: 'activity', label: 'activity', n: null },
              { k: 'members', label: 'friends', n: playlist.members.length },
            ]"
            :key="t.k"
            @click="tab = (t.k as 'songs' | 'activity' | 'members')"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              padding: '10px 12px',
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
            @tap="router.push(`/p/${playlist.id}/t/${t.id}`)"
          />
          <div
            v-if="tracks.length === 0"
            :style="{
              padding: '30px 22px',
              textAlign: 'center',
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '17px',
              color: 'var(--muted)',
              lineHeight: 1.4,
            }"
          >
            no songs yet — <br />
            paste a link to start the mixtape.
          </div>
        </template>

        <!-- Activity -->
        <div v-else-if="tab === 'activity'" style="padding: 12px 22px">
          <ActivityRow v-for="a in ACTIVITY" :key="a.id" :item="a" />
        </div>

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
      </ScreenScroll>
    </div>

    <!-- Paste-link sheet — sits over the playlist instead of replacing it. -->
    <ion-modal
      :is-open="shareSheetOpen"
      :initial-breakpoint="0.85"
      :breakpoints="[0, 0.85]"
      :handle="true"
      @did-dismiss="shareSheetOpen = false"
    >
      <PasteLinkSheet
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
  </ion-page>
</template>
