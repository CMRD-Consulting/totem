<script setup lang="ts">
defineProps<{
  title?: string;
  subtitle?: string;
}>();
</script>

<template>
  <div
    :style="{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 'calc(8px + var(--safe-top)) 18px 6px',
      position: 'sticky',
      top: 0,
      background: 'var(--bg)',
      zIndex: 5,
    }"
  >
    <div style="width: 36px; display: flex; justify-content: flex-start">
      <slot name="left" />
    </div>
    <div
      style="
        flex: 1;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
      "
    >
      <div
        v-if="title"
        :style="{
          fontFamily: 'Inter',
          fontWeight: 600,
          fontSize: '15px',
          color: 'var(--ink)',
          letterSpacing: '-0.1px',
        }"
      >{{ title }}</div>
      <div
        v-if="subtitle"
        :style="{
          fontFamily: 'Inter',
          fontSize: '11px',
          color: 'var(--muted)',
          fontFeatureSettings: '&quot;tnum&quot;',
        }"
      >{{ subtitle }}</div>
    </div>
    <div style="width: 36px; display: flex; justify-content: flex-end">
      <slot name="right" />
    </div>
  </div>
</template>
