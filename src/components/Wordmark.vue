<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number;
    color?: string;
  }>(),
  { size: 22, color: 'currentColor' },
);
</script>

<template>
  <span
    :style="{
      fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
      fontStyle: 'italic',
      fontSize: size + 'px',
      fontWeight: 400,
      color,
      letterSpacing: '-0.5px',
      lineHeight: 1,
    }"
  >totem<span :style="{ color: 'var(--accent)' }">.</span></span>
</template>
