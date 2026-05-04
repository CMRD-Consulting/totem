<script setup lang="ts">
defineProps<{
  name: string;
  size?: number;
  color?: string;
}>();
</script>

<template>
  <svg
    v-if="name === 'plus'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
  <svg
    v-else-if="name === 'search'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
  <svg
    v-else-if="name === 'share'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </svg>
  <svg
    v-else-if="name === 'chevron'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="m9 6 6 6-6 6" />
  </svg>
  <svg
    v-else-if="name === 'back'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="m15 6-6 6 6 6" />
  </svg>
  <svg
    v-else-if="name === 'more'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </svg>
  <svg
    v-else-if="name === 'close'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M6 6l12 12M6 18 18 6" />
  </svg>
  <svg
    v-else-if="name === 'check'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="m5 12 5 5L20 7" />
  </svg>
  <svg
    v-else-if="name === 'people'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <circle cx="17" cy="7" r="2.5" />
    <path d="M15 14c2.8 0 5 2.2 5 5" />
  </svg>
  <svg
    v-else-if="name === 'link'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path
      d="M9 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M15 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"
    />
  </svg>
  <svg
    v-else-if="name === 'copy'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M4 16V6a2 2 0 0 1 2-2h10" />
  </svg>
  <svg
    v-else-if="name === 'settings'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
    />
  </svg>
  <svg
    v-else-if="name === 'arrow-out'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
  <svg
    v-else-if="name === 'totem'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="6" y="3" width="12" height="5" rx="1" />
    <rect x="4" y="9" width="16" height="5" rx="1" />
    <rect x="7" y="15" width="10" height="6" rx="1" />
  </svg>
  <svg
    v-else-if="name === 'qrcode'"
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color ?? 'currentColor'"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3M21 14v.01M14 21h.01M17 17v4M21 17v4M21 21h-4" />
  </svg>
</template>
