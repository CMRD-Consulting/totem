<script setup lang="ts">
import Icon from './Icon.vue';

withDefaults(
  defineProps<{
    name: string;
    size?: number;
    accent?: boolean;
  }>(),
  { size: 20, accent: false },
);

defineEmits<{ click: [] }>();
</script>

<template>
  <button
    @click="$emit('click')"
    :style="{
      all: 'unset',
      cursor: 'pointer',
      width: '36px',
      height: '36px',
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
