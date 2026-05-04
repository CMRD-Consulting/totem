<script setup lang="ts">
import { computed } from 'vue';
import Avatar from './Avatar.vue';

const props = withDefaults(
  defineProps<{
    ids: string[];
    size?: number;
    max?: number;
  }>(),
  { size: 22, max: 4 },
);

const shown = computed(() => props.ids.slice(0, props.max));
const overflow = computed(() => props.ids.length - shown.value.length);
</script>

<template>
  <div style="display: inline-flex; align-items: center">
    <div
      v-for="(id, i) in shown"
      :key="id"
      :style="{ marginLeft: i === 0 ? 0 : -size * 0.35 + 'px' }"
    >
      <Avatar :id="id" :size="size" ring />
    </div>
    <div
      v-if="overflow > 0"
      :style="{
        marginLeft: -size * 0.35 + 'px',
        width: size + 'px',
        height: size + 'px',
        borderRadius: '50%',
        background: 'var(--ink)',
        color: 'var(--surface)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: size * 0.36 + 'px',
        boxShadow: '0 0 0 2px var(--surface)',
      }"
    >+{{ overflow }}</div>
  </div>
</template>
