<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Pixel diameter — defaults match what JoinPage previously inlined. */
    size?: number;
    /** Optional caption rendered below the spinner. */
    label?: string;
  }>(),
  { size: 28, label: '' },
);
</script>

<template>
  <div
    role="status"
    :aria-label="label || 'Loading'"
    style="
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 16px;
    "
  >
    <div
      :style="{
        width: size + 'px',
        height: size + 'px',
        borderRadius: '50%',
        border: '2px solid var(--divider)',
        borderTopColor: 'var(--accent)',
        animation: 'totem-spin 0.8s linear infinite',
      }"
    />
    <div
      v-if="label"
      :style="{
        fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
        fontStyle: 'italic',
        fontSize: '14px',
        color: 'var(--muted)',
      }"
    >{{ label }}</div>
  </div>
</template>

<style scoped>
@keyframes totem-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
