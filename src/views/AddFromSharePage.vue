<script setup lang="ts">
import {
  IonContent,
  IonPage,
  onIonViewWillEnter,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AlbumArt from '@/components/AlbumArt.vue';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import Sigil from '@/components/Sigil.vue';
import TopBar from '@/components/TopBar.vue';
import { usePlaylistsStore } from '@/stores/playlists';

const router = useRouter();
const route = useRoute();
const playlists = usePlaylistsStore();
const sending = ref<string | null>(null);

const incomingUrl = computed(() => (route.query.url as string) ?? '');

const isLikelyMusicUrl = computed(() => {
  const v = incomingUrl.value.trim();
  if (!v) return false;
  if (/^spotify:(track|album|playlist):/i.test(v)) return true;
  try {
    const u = new URL(v);
    const host = u.hostname.replace(/^www\./, '');
    return [
      'open.spotify.com',
      'spotify.link',
      'music.apple.com',
      'itunes.apple.com',
      'music.youtube.com',
      'youtube.com',
      'm.youtube.com',
      'youtu.be',
    ].includes(host);
  } catch {
    return false;
  }
});

function shortUrl(s: string): string {
  let pretty = s.replace(/^https?:\/\/(www\.)?/, '');
  if (pretty.length > 48) pretty = pretty.slice(0, 46) + '…';
  return pretty;
}

onIonViewWillEnter(() => {
  if (!playlists.loaded) playlists.loadList().catch(() => {});
});

async function pickPlaylist(playlistId: string) {
  if (!incomingUrl.value || sending.value) return;
  sending.value = playlistId;
  try {
    // Fire-and-forget; the resolving row will appear on the destination page.
    playlists.ingestUrl(playlistId, incomingUrl.value);
    router.replace(`/p/${playlistId}`);
  } finally {
    sending.value = null;
  }
}

function dismiss() {
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
        overflow: hidden;
      "
    >
      <TopBar title="add to a playlist">
        <template #left>
          <IconButton name="close" label="Close" @click="dismiss" />
        </template>
      </TopBar>

      <ion-content
        :scroll-y="true"
        :style="{ '--background': 'var(--bg)', '--padding-bottom': '40px' }"
      >
        <!-- URL preview card -->
        <div style="padding: 8px 16px 0">
          <div
            v-if="isLikelyMusicUrl"
            style="
              padding: 12px 14px;
              background: var(--surface);
              border-radius: 14px;
              border: 0.5px solid var(--divider);
              display: flex;
              align-items: center;
              gap: 12px;
            "
          >
            <AlbumArt :seed="incomingUrl.length" :size="40" :radius="6" />
            <div style="flex: 1; min-width: 0">
              <div
                :style="{
                  fontFamily: '&quot;JetBrains Mono&quot;, monospace',
                  fontSize: '10px',
                  color: 'var(--muted-2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                }"
              >shared link</div>
              <div
                :style="{
                  fontFamily: '&quot;JetBrains Mono&quot;, ui-monospace, monospace',
                  fontSize: '12px',
                  color: 'var(--ink)',
                  marginTop: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }"
              >{{ shortUrl(incomingUrl) }}</div>
            </div>
          </div>
          <div
            v-else
            :style="{
              padding: '12px 14px',
              background: 'var(--accent-soft)',
              borderRadius: '14px',
              border: '1px solid var(--accent)',
              fontFamily: 'Inter',
              fontSize: '12.5px',
              color: 'var(--accent)',
              lineHeight: 1.4,
            }"
          >
            That doesn't look like a Spotify, Apple Music, or YouTube Music
            link. Totem can only resolve those right now.
          </div>
        </div>

        <!-- Picker prompt -->
        <div
          v-if="isLikelyMusicUrl"
          :style="{
            padding: '20px 22px 8px',
            fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
            fontStyle: 'italic',
            fontSize: '17px',
            color: 'var(--muted)',
          }"
        >which playlist?</div>

        <!-- Playlist list -->
        <div v-if="isLikelyMusicUrl" style="padding: 0 14px">
          <button
            v-for="g in playlists.playlists"
            :key="g.id"
            type="button"
            :aria-label="`Add to ${g.name}`"
            @click="pickPlaylist(g.id)"
            :disabled="sending !== null"
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
              border: '0.5px solid var(--divider)',
              marginBottom: '8px',
              opacity: sending && sending !== g.id ? 0.5 : 1,
              transition: 'opacity 0.18s',
            }"
          >
            <Sigil :seeds="g.trackSeeds" :hues="g.sigil" :size="44" :radius="9" />
            <div style="flex: 1; min-width: 0; text-align: left">
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
                }"
              >{{ g.tracks }} songs · {{ g.members.length }} friends</div>
            </div>
            <Icon
              v-if="sending === g.id"
              name="check"
              :size="20"
              color="var(--accent)"
            />
            <Icon v-else name="chevron" :size="18" color="var(--muted-2)" />
          </button>

          <div
            v-if="playlists.playlists.length === 0"
            :style="{
              padding: '24px 8px',
              textAlign: 'center',
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '17px',
              color: 'var(--muted)',
              lineHeight: 1.4,
            }"
          >
            no playlists yet. <br />
            create one first, then come back.
          </div>
        </div>
      </ion-content>
    </div>
  </ion-page>
</template>
