<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { SERVICES } from '@/data/mock';
import { state } from '@/store/state';
import { usersById } from '@/store/users';
import { useAuthStore } from '@/stores/auth';
import { usePlaylistsStore } from '@/stores/playlists';
import type { Track } from '@/types';
import AlbumArt from './AlbumArt.vue';
import Avatar from './Avatar.vue';
import Icon from './Icon.vue';
import ReactionPill from './ReactionPill.vue';
import ServiceGlyph from './ServiceGlyph.vue';

const props = withDefaults(
  defineProps<{
    track: Track;
    density?: 'cozy' | 'compact';
    /** 'full' renders the service glyph in brand color (green for Spotify,
     *  etc.) — matches the Friends tab. 'subtle' uses muted-2 for a quieter
     *  metadata look; 'off' hides it entirely. Default 'full' for visual
     *  consistency with member rows. */
    showService?: 'off' | 'subtle' | 'full';
  }>(),
  { density: 'cozy', showService: 'full' },
);

const emit = defineEmits<{
  tap: [];
  dismiss: [];
  openReactionPicker: [trackId: string];
}>();

const auth = useAuthStore();
const playlists = usePlaylistsStore();
const adder = computed(() => usersById[props.track.adder]);

// Real reactions live in the store keyed by playlist_track id; fall back to
// the (mock) Track.reactions array for non-DB tracks (mock demo data).
const reactions = computed(
  () => playlists.reactionsByTrackId[props.track.id] ?? props.track.reactions,
);
const myUserId = computed(() => auth.user?.id ?? state.meId);
const myReactions = computed(
  () =>
    new Set(
      reactions.value.filter((r) => r.by.includes(myUserId.value)).map((r) => r.e),
    ),
);
const padY = computed(() => (props.density === 'compact' ? 8 : 12));
// Minimum square size for art; `artSide` below is at least this (see ResizeObserver).
const artSize = computed(() => (props.density === 'compact' ? 38 : 64));

/** Square art side: at least `artSize`, otherwise the measured in-flow text
 *  column height. Flex + intrinsic img sizing would otherwise let huge
 *  artwork dictate row height (`min-height: auto`). */
const bodyRef = ref<HTMLElement | null>(null);
const artSide = ref(artSize.value);
let bodyRo: ResizeObserver | undefined;

function syncArtSide() {
  const el = bodyRef.value;
  if (!el) {
    artSide.value = artSize.value;
    return;
  }
  const h = el.getBoundingClientRect().height;
  artSide.value = Math.max(artSize.value, Math.ceil(h));
}

onMounted(() => {
  syncArtSide();
  bodyRo = new ResizeObserver(() => syncArtSide());
  if (bodyRef.value) bodyRo.observe(bodyRef.value);
});

onUnmounted(() => {
  bodyRo?.disconnect();
  bodyRo = undefined;
});

watch(artSize, syncArtSide);

// Show the "not on <your service>" badge only when:
//   • the row is a real track (no resolving/failed status)
//   • the track's serviceIds map is populated
//   • the viewer's preferred service has no id on this track
const notOnMyService = computed(() => {
  if (props.track.status) return false;
  const ids = props.track.serviceIds;
  if (!ids) return false;
  const me = auth.preferredService;
  return ids[me] === null;
});

function onReact(e: MouseEvent, emoji: string) {
  e.stopPropagation();
  // Real tracks → DB toggle. Pending/mock rows have no DB id; skip silently.
  if (!props.track.status) {
    playlists.toggleReaction(props.track.id, emoji).catch(() => {});
  }
}

function openReactionTray(e: MouseEvent) {
  e.stopPropagation();
  emit('openReactionPicker', props.track.id);
}

function onClickRow() {
  if (props.track.status === 'failed') {
    emit('dismiss');
  } else if (props.track.status === 'resolving') {
    // Non-interactive while in flight.
    return;
  } else {
    emit('tap');
  }
}
</script>

<template>
  <button
    type="button"
    :aria-label="
      track.status === 'failed'
        ? `Dismiss failed track ${track.title}`
        : track.status === 'resolving'
          ? `${track.title} is resolving`
          : `Open ${track.title} by ${track.artist}`
    "
    :disabled="track.status === 'resolving'"
    @click="onClickRow"
    :style="{
      all: 'unset',
      cursor: track.status === 'resolving' ? 'progress' : 'pointer',
      boxSizing: 'border-box',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: `${padY}px 18px`,
      borderBottom: '0.5px solid var(--divider)',
      opacity: track.status === 'resolving' ? 0.85 : 1,
    }"
  >
    <!-- Resolving: shimmering placeholder art -->
    <div
      v-if="track.status === 'resolving'"
      class="totem-shimmer"
      :style="{
        width: artSide + 'px',
        height: artSide + 'px',
        borderRadius: '5px',
        flexShrink: 0,
        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15)',
      }"
    />
    <!-- Failed: muted art with an X overlay -->
    <div
      v-else-if="track.status === 'failed'"
      :style="{
        width: artSide + 'px',
        height: artSide + 'px',
        borderRadius: '5px',
        flexShrink: 0,
        background: 'var(--chip-strong)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--accent)',
        boxShadow: 'inset 0 0 0 1px var(--accent)',
      }"
    >
      <Icon name="close" :size="20" color="var(--accent)" />
    </div>
    <AlbumArt
      v-else
      :seed="track.seed"
      :url="track.artworkUrl"
      :size="artSide"
      :radius="5"
    />

    <div
      ref="bodyRef"
      style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center"
    >
      <div
        :style="{
          fontFamily: 'Inter',
          fontWeight: 600,
          fontSize: '15px',
          color: track.status === 'failed' ? 'var(--accent)' : 'var(--ink)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          letterSpacing: '-0.1px',
          fontStyle: track.status === 'resolving' ? 'italic' : 'normal',
        }"
      >{{ track.title }}</div>
      <div
        :style="{
          fontFamily: 'Inter',
          fontSize: '12.5px',
          color: 'var(--muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginTop: '1px',
        }"
      >
        <template v-if="track.status === 'failed'">{{ track.errorMessage ?? 'unknown error' }}</template>
        <template v-else-if="track.status === 'resolving'">
          <span class="totem-resolving-dots">looking it up</span>
        </template>
        <template v-else>{{ track.artist }}</template>
      </div>

      <!-- Meta row only on normal tracks -->
      <div
        v-if="!track.status"
        style="
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 5px;
        "
      >
        <Avatar :id="track.adder" :size="14" />
        <span
          :style="{
            fontFamily: 'Inter',
            fontSize: '11px',
            color: 'var(--muted)',
            fontWeight: 500,
          }"
        >{{ adder?.name }}</span>
        <span style="font-family: Inter; font-size: 11px; color: var(--muted-2)">·</span>
        <span
          :style="{
            fontFamily: '&quot;JetBrains Mono&quot;, ui-monospace, monospace',
            fontSize: '10px',
            color: 'var(--muted-2)',
            fontFeatureSettings: '&quot;tnum&quot;',
          }"
        >{{ track.added }}</span>
        <template v-if="showService !== 'off'">
          <span style="font-family: Inter; font-size: 11px; color: var(--muted-2)">·</span>
          <span
            :style="{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              opacity: showService === 'full' ? 1 : 0.65,
            }"
          >
            <ServiceGlyph
              :service="track.service"
              :size="10"
              :color="
                showService === 'full'
                  ? SERVICES[track.service].color
                  : 'var(--muted-2)'
              "
            />
          </span>
        </template>
      </div>

      <!-- Service-availability badge — neutral, never anxious -->
      <div
        v-if="notOnMyService"
        :style="{
          marginTop: '6px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '2px 8px 2px 7px',
          borderRadius: '999px',
          background: 'var(--chip)',
          fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
          fontStyle: 'italic',
          fontSize: '11.5px',
          color: 'var(--muted)',
          lineHeight: 1.3,
        }"
      >
        <ServiceGlyph
          :service="auth.preferredService"
          :size="10"
          color="var(--muted-2)"
        />
        not on {{ SERVICES[auth.preferredService].short }}
      </div>

      <!-- Failed: tap-to-dismiss hint -->
      <div
        v-else-if="track.status === 'failed'"
        :style="{
          fontFamily: '&quot;JetBrains Mono&quot;, monospace',
          fontSize: '10px',
          color: 'var(--muted-2)',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          marginTop: '4px',
        }"
      >tap to dismiss</div>

      <!-- Reactions row — pills toggle DB reactions; add opens the playlist-level
           emoji tray (Slack-style sheet). -->
      <div
        v-if="!track.status"
        style="display: flex; gap: 4px; margin-top: 7px; flex-wrap: wrap; align-items: center"
      >
        <ReactionPill
          v-for="(r, i) in reactions"
          :key="i"
          :emoji="r.e"
          :count="r.by.length"
          :mine="myReactions.has(r.e)"
          @click="(e: MouseEvent) => onReact(e, r.e)"
        />

        <button
          type="button"
          aria-label="Add reaction"
          @click="openReactionTray"
          :style="{
            all: 'unset',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            height: '18px',
            padding: '0 8px 0 7px',
            borderRadius: '999px',
            background: 'var(--chip)',
            boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.06)',
          }"
        >
          <Icon name="add-reaction" :size="18" color="var(--muted)" />
        </button>
      </div>
    </div>
  </button>
</template>

<style scoped>
.totem-shimmer {
  background: linear-gradient(
    90deg,
    var(--chip) 0%,
    var(--chip-strong) 50%,
    var(--chip) 100%
  );
  background-size: 200% 100%;
  animation: totem-shimmer 1.4s ease-in-out infinite;
}

@keyframes totem-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.totem-resolving-dots::after {
  content: '…';
  animation: totem-dots 1.2s steps(4, end) infinite;
}

@keyframes totem-dots {
  0%,
  20% {
    content: '';
  }
  40% {
    content: '.';
  }
  60% {
    content: '..';
  }
  80%,
  100% {
    content: '…';
  }
}
</style>
