<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    seed: number;
    size?: number;
    radius?: number;
  }>(),
  { size: 44, radius: 6 },
);

const h1 = computed(() => (props.seed * 47) % 360);
const h2 = computed(() => (props.seed * 113 + 90) % 360);
const h3 = computed(() => (props.seed * 211 + 200) % 360);
const angle = computed(() => (props.seed * 30) % 360);
const sx = computed(() => (props.seed * 7) % 100);
const sy = computed(() => (props.seed * 13) % 100);
</script>

<template>
  <div
    :style="{
      width: size + 'px',
      height: size + 'px',
      borderRadius: radius + 'px',
      background: `linear-gradient(${angle}deg, hsl(${h1} 60% 55%), hsl(${h2} 55% 45%) 60%, hsl(${h3} 70% 35%))`,
      flexShrink: 0,
      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.08)',
      position: 'relative',
      overflow: 'hidden',
    }"
  >
    <div
      :style="{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at ${sx}% ${sy}%, rgba(255,255,255,0.35), transparent 50%)`,
      }"
    />
  </div>
</template>
