<script setup lang="ts">
import type { CSSProperties } from 'vue';

defineProps<{
  styleOverride?: CSSProperties;
}>();
</script>

<template>
  <div
    :style="{
      padding: '14px 22px 8px',
      fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
      fontStyle: 'italic',
      fontSize: '17px',
      color: 'var(--muted)',
      letterSpacing: 0,
      ...(styleOverride ?? {}),
    }"
  >
    <slot />
  </div>
</template>
