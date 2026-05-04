<script setup lang="ts">
import { computed } from 'vue';
import { usersById } from '@/store/users';
import type { ActivityItem } from '@/types';
import Avatar from './Avatar.vue';

const props = defineProps<{ item: ActivityItem }>();
const friend = computed(() => usersById[props.item.who]);
</script>

<template>
  <div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0">
    <Avatar :id="item.who" :size="26" />
    <div style="flex: 1; min-width: 0">
      <div
        :style="{
          fontFamily: 'Inter',
          fontSize: '13px',
          color: 'var(--ink)',
          lineHeight: 1.35,
        }"
      >
        <span style="font-weight: 600">{{ friend?.name }}</span>
        <span v-if="item.kind === 'add'" style="color: var(--muted)"> added </span>
        <span v-else-if="item.kind === 'react'" style="color: var(--muted)">
          reacted {{ item.emoji }} to
        </span>
        <span v-else style="color: var(--muted)"> </span>
        <span
          :style="{
            fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: '14px',
          }"
        >{{ item.what }}</span>
        <span v-if="item.detail" style="color: var(--muted)"> — {{ item.detail }}</span>
      </div>
      <div
        :style="{
          fontFamily: '&quot;JetBrains Mono&quot;, ui-monospace, monospace',
          fontSize: '10px',
          color: 'var(--muted-2)',
          marginTop: '2px',
        }"
      >{{ item.when }}</div>
    </div>
  </div>
</template>
