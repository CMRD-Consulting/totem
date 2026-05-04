<script setup lang="ts">
import { computed } from 'vue';
import AlbumArt from './AlbumArt.vue';

const props = withDefaults(
  defineProps<{
    seeds?: number[];
    hues?: [number, number, number];
    size?: number;
    radius?: number;
  }>(),
  { size: 56, radius: 10 },
);

const list = computed(() => (props.seeds ?? []).slice(0, 4));
const useStripes = computed(
  () => (!props.seeds || props.seeds.length === 0) && !!props.hues,
);
const seg = computed(() => props.size / 3);

const wrapperStyle = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px',
  borderRadius: props.radius + 'px',
  overflow: 'hidden',
  flexShrink: 0,
  boxShadow:
    'inset 0 0 0 0.5px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)',
}));
</script>

<template>
  <!-- Empty group: 3-stripe fallback -->
  <div v-if="useStripes && hues" :style="wrapperStyle">
    <div
      :style="{
        height: seg + 'px',
        background: `linear-gradient(90deg, hsl(${hues[0]} 65% 55%), hsl(${hues[0]} 75% 45%))`,
      }"
    />
    <div
      :style="{
        height: seg + 'px',
        background: `linear-gradient(90deg, hsl(${hues[1]} 60% 50%), hsl(${hues[1]} 70% 40%))`,
      }"
    />
    <div
      :style="{
        height: seg + 'px',
        background: `linear-gradient(90deg, hsl(${hues[2]} 55% 40%), hsl(${hues[2]} 70% 30%))`,
      }"
    />
  </div>

  <!-- Single track: full art -->
  <div v-else-if="list.length === 1" :style="wrapperStyle">
    <AlbumArt :seed="list[0]" :size="size" :radius="0" />
  </div>

  <!-- 2 tracks: split vertically -->
  <div
    v-else-if="list.length === 2"
    :style="{
      ...wrapperStyle,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1px',
      background: 'rgba(0,0,0,0.18)',
    }"
  >
    <div v-for="(s, i) in list" :key="i" style="overflow: hidden">
      <AlbumArt :seed="s" :size="size" :radius="0" />
    </div>
  </div>

  <!-- 3 tracks: 1 large + 2 stacked -->
  <div
    v-else-if="list.length === 3"
    :style="{
      ...wrapperStyle,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '1px',
      background: 'rgba(0,0,0,0.18)',
    }"
  >
    <div style="grid-row: span 2; overflow: hidden">
      <AlbumArt :seed="list[0]" :size="size" :radius="0" />
    </div>
    <div style="overflow: hidden">
      <AlbumArt :seed="list[1]" :size="size / 2" :radius="0" />
    </div>
    <div style="overflow: hidden">
      <AlbumArt :seed="list[2]" :size="size / 2" :radius="0" />
    </div>
  </div>

  <!-- 4+ tracks: 2x2 mosaic -->
  <div
    v-else-if="list.length >= 4"
    :style="{
      ...wrapperStyle,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '1px',
      background: 'rgba(0,0,0,0.18)',
    }"
  >
    <div v-for="(s, i) in list" :key="i" style="overflow: hidden">
      <AlbumArt :seed="s" :size="size / 2" :radius="0" />
    </div>
  </div>
</template>
