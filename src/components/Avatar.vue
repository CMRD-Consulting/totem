<script setup lang="ts">
import { computed } from 'vue';
import { usersById } from '@/store/users';

const props = withDefaults(
  defineProps<{
    id: string;
    size?: number;
    ring?: boolean;
  }>(),
  { size: 24, ring: false },
);

const friend = computed(
  () => usersById[props.id] ?? { name: '?', hue: 0, initial: '?' },
);
</script>

<template>
  <div
    :aria-label="friend.name"
    role="img"
    :style="{
      width: size + 'px',
      height: size + 'px',
      borderRadius: '50%',
      background: `linear-gradient(135deg, hsl(${friend.hue} 70% 60%), hsl(${(friend.hue + 40) % 360} 65% 45%))`,
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui',
      fontWeight: 600,
      fontSize: size * 0.42 + 'px',
      // line-height: 1 collapses the line box to the glyph height so flex
      // centering matches the letter's optical center. Default 1.2 leaves
      // descender space at the bottom and pushes the letter visibly upward.
      lineHeight: 1,
      letterSpacing: 0,
      flexShrink: 0,
      boxShadow: ring
        ? '0 0 0 2px var(--surface)'
        : 'inset 0 0 0 0.5px rgba(0,0,0,0.1)',
      userSelect: 'none',
    }"
  >
    {{ friend.initial }}
  </div>
</template>
