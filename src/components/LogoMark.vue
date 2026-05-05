<script setup lang="ts">
import svg from '@/assets/totem-mark.svg?raw';

withDefaults(
  defineProps<{
    size?: number;
    color?: string;
  }>(),
  { size: 32, color: 'currentColor' },
);
</script>

<template>
  <span
    role="img"
    aria-label="Totem"
    :style="{
      display: 'inline-block',
      width: size + 'px',
      lineHeight: 0,
      color,
    }"
    v-html="svg"
  />
</template>
