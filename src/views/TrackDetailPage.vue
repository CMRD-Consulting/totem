<script setup lang="ts">
import { IonPage } from '@ionic/vue';
import { computed } from 'vue';
import AlbumArt from '@/components/AlbumArt.vue';
import Avatar from '@/components/Avatar.vue';
import AvatarStack from '@/components/AvatarStack.vue';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import ScreenScroll from '@/components/ScreenScroll.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import TopBar from '@/components/TopBar.vue';
import { SERVICES } from '@/data/mock';
import { state } from '@/store/state';
import { usePlaylistsStore } from '@/stores/playlists';
import { usersById } from '@/store/users';
import type { ServiceKey } from '@/types';

const props = defineProps<{ playlistId: string; trackId: string }>();
const emit = defineEmits<{ close: [] }>();

const playlists = usePlaylistsStore();

const track = computed(() => {
  // Prefer the live track from the playlists store; fall back to mock for demo data.
  const real = playlists.tracksByPlaylistId[props.playlistId]?.find(
    (t) => t.id === props.trackId,
  );
  return real ?? state.tracks.find((t) => t.id === props.trackId) ?? state.tracks[0];
});
const adder = computed(() => usersById[track.value.adder]);
const reactions = computed(
  () => playlists.reactionsByTrackId[track.value.id] ?? track.value.reactions,
);

const services: ServiceKey[] = ['spotify', 'apple', 'youtube'];
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
          <IconButton name="close" label="Close track" @click="emit('close')" />
        </template>
        <template #right>
          <IconButton name="more" label="More actions" />
        </template>
      </TopBar>

      <ScreenScroll :pad-bottom="140">
        <div style="padding: 12px 28px 8px; display: flex; justify-content: center">
          <AlbumArt :seed="track.seed" :url="track.artworkUrl" :size="240" :radius="14" />
        </div>
        <div style="padding: 20px 28px 0; text-align: center">
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontSize: '30px',
              color: 'var(--ink)',
              lineHeight: 1.05,
              letterSpacing: '-0.4px',
            }"
          >{{ track.title }}</div>
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '15px',
              color: 'var(--muted)',
              marginTop: '4px',
            }"
          >{{ track.artist }}</div>
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '12px',
              color: 'var(--muted-2)',
              marginTop: '2px',
              fontStyle: 'italic',
            }"
          >{{ track.album }}</div>
        </div>

        <div
          style="
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-top: 18px;
          "
        >
          <Avatar :id="track.adder" :size="20" />
          <span
            :style="{
              fontFamily: 'Inter',
              fontSize: '12.5px',
              color: 'var(--ink)',
            }"
          >
            <b>{{ adder?.name }}</b>
            <span style="color: var(--muted)"> added this · {{ track.added }}</span>
          </span>
        </div>

        <!-- Open in… -->
        <div style="padding: 24px 22px 0">
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '14px',
              color: 'var(--muted)',
              marginBottom: '8px',
            }"
          >open in…</div>
          <button
            v-for="s in services"
            :key="s"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              borderRadius: '12px',
              background: track.service === s ? 'var(--ink)' : 'var(--surface)',
              color: track.service === s ? 'var(--surface)' : 'var(--ink)',
              border: track.service === s ? 'none' : '0.5px solid var(--divider)',
              marginBottom: '8px',
            }"
          >
            <ServiceGlyph :service="s" :size="22" :color="SERVICES[s].color" />
            <div style="flex: 1">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '14px',
                }"
              >{{ SERVICES[s].name }}</div>
              <div
                v-if="track.service === s"
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '11px',
                  color: 'var(--surface)',
                  opacity: 0.7,
                  marginTop: '1px',
                  fontWeight: 500,
                }"
              >where {{ adder?.name }} added it from</div>
            </div>
            <Icon
              name="arrow-out"
              :size="16"
              :color="track.service === s ? 'var(--surface)' : 'var(--muted)'"
            />
          </button>
        </div>

        <div v-if="reactions.length > 0" style="padding: 20px 22px 0">
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '14px',
              color: 'var(--muted)',
              marginBottom: '10px',
            }"
          >reactions</div>
          <div
            style="
              padding: 10px 12px;
              background: var(--chip);
              border-radius: 10px;
            "
          >
            <div
              v-for="(r, i) in reactions"
              :key="i"
              style="display: flex; align-items: center; gap: 8px; padding: 4px 0"
            >
              <span style="font-size: 16px">{{ r.e }}</span>
              <AvatarStack :ids="r.by" :size="18" :max="4" />
              <span
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '11.5px',
                  color: 'var(--muted)',
                }"
              >
                {{ r.by.slice(0, 2).map((id) => usersById[id]?.name).join(', ') }}
                <template v-if="r.by.length > 2">+{{ r.by.length - 2 }}</template>
              </span>
            </div>
          </div>
        </div>
      </ScreenScroll>
    </div>
  </ion-page>
</template>
