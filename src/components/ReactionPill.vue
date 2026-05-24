<script setup lang="ts">
defineProps<{
  emoji: string;
  count: number;
  mine?: boolean;
}>();
</script>

<template>
  <button
    :style="{
      all: 'unset',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px 3px 7px',
      borderRadius: '999px',
      background: mine ? 'var(--accent-soft)' : 'var(--chip)',
      boxShadow: mine
        ? 'inset 0 0 0 1px var(--accent)'
        : 'inset 0 0 0 0.5px rgba(0,0,0,0.06)',
      fontSize: '11px',
      fontFamily: 'Inter, system-ui',
      fontWeight: 600,
      color: mine ? 'var(--accent)' : 'var(--muted)',
      lineHeight: 1,
    }"
  >
    <span style="font-size: 10px">{{ emoji }}</span>
    <span style="font-variant-numeric: tabular-nums">{{ count }}</span>
  </button>
</template>
