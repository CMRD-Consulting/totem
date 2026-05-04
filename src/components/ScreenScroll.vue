<script setup lang="ts">
withDefaults(defineProps<{ padBottom?: number }>(), { padBottom: 100 });
</script>

<template>
  <div
    class="totem-scroll"
    :style="{
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      paddingBottom: padBottom + 'px',
    }"
  >
    <slot />
  </div>
</template>
