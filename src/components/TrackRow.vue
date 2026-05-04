<script setup lang="ts">
import { computed } from 'vue';
import { friendsById, SERVICES } from '@/data/mock';
import { state, toggleReaction } from '@/store/state';
import type { Track } from '@/types';
import AlbumArt from './AlbumArt.vue';
import Avatar from './Avatar.vue';
import ReactionPill from './ReactionPill.vue';
import ServiceGlyph from './ServiceGlyph.vue';

const props = withDefaults(
  defineProps<{
    track: Track;
    density?: 'cozy' | 'compact';
    showService?: 'off' | 'subtle' | 'full';
  }>(),
  { density: 'cozy', showService: 'subtle' },
);

defineEmits<{ tap: [] }>();

const adder = computed(() => friendsById[props.track.adder]);
const myReactions = computed(
  () =>
    new Set(
      props.track.reactions
        .filter((r) => r.by.includes(state.meId))
        .map((r) => r.e),
    ),
);
const padY = computed(() => (props.density === 'compact' ? 8 : 12));
const artSize = computed(() => (props.density === 'compact' ? 38 : 44));

function onReact(e: MouseEvent, emoji: string) {
  e.stopPropagation();
  toggleReaction(props.track.id, emoji);
}
</script>

<template>
  <div
    @click="$emit('tap')"
    :style="{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: `${padY}px 18px`,
      cursor: 'pointer',
      borderBottom: '0.5px solid var(--divider)',
    }"
  >
    <AlbumArt :seed="track.seed" :url="track.artworkUrl" :size="artSize" :radius="5" />
    <div style="flex: 1; min-width: 0">
      <div
        :style="{
          fontFamily: 'Inter',
          fontWeight: 600,
          fontSize: '15px',
          color: 'var(--ink)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          letterSpacing: '-0.1px',
        }"
      >{{ track.title }}</div>
      <div
        :style="{
          fontFamily: 'Inter',
          fontSize: '12.5px',
          color: 'var(--muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginTop: '1px',
        }"
      >{{ track.artist }}</div>
      <div
        style="
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 5px;
        "
      >
        <Avatar :id="track.adder" :size="14" />
        <span
          :style="{
            fontFamily: 'Inter',
            fontSize: '11px',
            color: 'var(--muted)',
            fontWeight: 500,
          }"
        >{{ adder?.name }}</span>
        <span style="font-family: Inter; font-size: 11px; color: var(--muted-2)">·</span>
        <span
          :style="{
            fontFamily: '&quot;JetBrains Mono&quot;, ui-monospace, monospace',
            fontSize: '10px',
            color: 'var(--muted-2)',
            fontFeatureSettings: '&quot;tnum&quot;',
          }"
        >{{ track.added }}</span>
        <template v-if="showService !== 'off'">
          <span style="font-family: Inter; font-size: 11px; color: var(--muted-2)">·</span>
          <span
            :style="{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              opacity: showService === 'full' ? 1 : 0.65,
            }"
          >
            <ServiceGlyph
              :service="track.service"
              :size="10"
              :color="
                showService === 'full'
                  ? SERVICES[track.service].color
                  : 'var(--muted-2)'
              "
            />
          </span>
        </template>
      </div>
      <div
        v-if="track.reactions.length > 0"
        style="display: flex; gap: 4px; margin-top: 7px; flex-wrap: wrap"
      >
        <ReactionPill
          v-for="(r, i) in track.reactions"
          :key="i"
          :emoji="r.e"
          :count="r.by.length"
          :mine="myReactions.has(r.e)"
          @click="(e: MouseEvent) => onReact(e, r.e)"
        />
      </div>
    </div>
  </div>
</template>
