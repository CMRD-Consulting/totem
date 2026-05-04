<script setup lang="ts">
import { IonPage } from '@ionic/vue';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AlbumArt from '@/components/AlbumArt.vue';
import Avatar from '@/components/Avatar.vue';
import AvatarStack from '@/components/AvatarStack.vue';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import ScreenScroll from '@/components/ScreenScroll.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import TopBar from '@/components/TopBar.vue';
import { friendsById, SERVICES } from '@/data/mock';
import { state, toggleReaction } from '@/store/state';
import type { ServiceKey } from '@/types';

const router = useRouter();
const route = useRoute();

const track = computed(() => {
  const id = route.params.trackId as string;
  return state.tracks.find((t) => t.id === id) ?? state.tracks[0];
});
const adder = computed(() => friendsById[track.value.adder]);
const myReactions = computed(
  () =>
    new Set(
      track.value.reactions
        .filter((r) => r.by.includes(state.meId))
        .map((r) => r.e),
    ),
);

const quickReacts = ['🔥', '❤️', '😭', '👑', '💔', '🌙'];
const services: ServiceKey[] = ['spotify', 'apple', 'youtube'];
const groupId = computed(() => route.params.groupId as string);
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
          <IconButton name="back" @click="router.push(`/p/${groupId}`)" />
        </template>
        <template #right>
          <IconButton name="more" />
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
                  color: 'rgba(255,255,255,0.78)',
                  marginTop: '1px',
                  fontWeight: 500,
                }"
              >where {{ adder?.name }} added it from</div>
            </div>
            <Icon
              name="arrow-out"
              :size="16"
              :color="track.service === s ? 'rgba(255,255,255,0.7)' : 'var(--muted)'"
            />
          </button>
        </div>

        <!-- React -->
        <div style="padding: 20px 22px 0">
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '14px',
              color: 'var(--muted)',
              marginBottom: '10px',
            }"
          >react</div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap">
            <button
              v-for="e in quickReacts"
              :key="e"
              @click="toggleReaction(track.id, e)"
              :style="{
                all: 'unset',
                cursor: 'pointer',
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: myReactions.has(e) ? 'var(--accent-soft)' : 'var(--surface)',
                border: myReactions.has(e)
                  ? '1px solid var(--accent)'
                  : '0.5px solid var(--divider)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
              }"
            >{{ e }}</button>
          </div>
          <div
            v-if="track.reactions.length > 0"
            style="
              margin-top: 14px;
              padding: 10px 12px;
              background: var(--chip);
              border-radius: 10px;
            "
          >
            <div
              v-for="(r, i) in track.reactions"
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
                {{ r.by.slice(0, 2).map((id) => friendsById[id]?.name).join(', ') }}
                <template v-if="r.by.length > 2">+{{ r.by.length - 2 }}</template>
              </span>
            </div>
          </div>
        </div>
      </ScreenScroll>
    </div>
  </ion-page>
</template>
