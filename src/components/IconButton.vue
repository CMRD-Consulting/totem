<script setup lang="ts">
import Icon from './Icon.vue';

withDefaults(
  defineProps<{
    name: string;
    /** Required for screen-reader users — the button has no visible text. */
    label: string;
    size?: number;
    accent?: boolean;
  }>(),
  { size: 20, accent: false },
);

defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    @click="$emit('click')"
    :style="{
      all: 'unset',
      cursor: 'pointer',
      // Visual size stays 36×36 (matches the existing layout density), but
      // padding extends the tappable area to 44×44 — Apple HIG minimum —
      // and a negative margin keeps surrounding flow unchanged.
      boxSizing: 'content-box',
      width: '36px',
      height: '36px',
      padding: '4px',
      margin: '-4px',
      borderRadius: '999px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: accent ? 'var(--accent)' : 'var(--ink)',
    }"
  >
    <Icon :name="name" :size="size" />
  </button>
</template>
