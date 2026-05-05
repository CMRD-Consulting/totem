<script setup lang="ts">
import { computed } from 'vue';
import { SERVICES } from '@/data/mock';
import { state, toggleReaction } from '@/store/state';
import { usersById } from '@/store/users';
import { useAuthStore } from '@/stores/auth';
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
    showService?: 'off' | 'subtle' | 'full';
  }>(),
  { density: 'cozy', showService: 'subtle' },
);

const emit = defineEmits<{ tap: []; dismiss: [] }>();

const auth = useAuthStore();
const adder = computed(() => usersById[props.track.adder]);
const myReactions = computed(
  () =>
    new Set(
      props.track.reactions
        .filter((r) => r.by.includes(state.meId))
        .map((r) => r.e),
    ),
);
const padY = computed(() => (props.density === 'compact' ? 8 : 12));
const artSize = computed(() => (props.density === 'compact' ? 38 : 44));

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
  toggleReaction(props.track.id, emoji);
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
  <div
    @click="onClickRow"
    :style="{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: `${padY}px 18px`,
      cursor: track.status === 'resolving' ? 'default' : 'pointer',
      borderBottom: '0.5px solid var(--divider)',
      opacity: track.status === 'resolving' ? 0.85 : 1,
    }"
  >
    <!-- Resolving: shimmering placeholder art -->
    <div
      v-if="track.status === 'resolving'"
      class="totem-shimmer"
      :style="{
        width: artSize + 'px',
        height: artSize + 'px',
        borderRadius: '5px',
        flexShrink: 0,
        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15)',
      }"
    />
    <!-- Failed: muted art with an X overlay -->
    <div
      v-else-if="track.status === 'failed'"
      :style="{
        width: artSize + 'px',
        height: artSize + 'px',
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
      :size="artSize"
      :radius="5"
    />

    <div style="flex: 1; min-width: 0">
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

      <!-- Reactions only on normal tracks -->
      <div
        v-if="!track.status && track.reactions.length > 0"
        style="display: flex; gap: 4px; margin-top: 7px; flex-wrap: wrap"
      >
        <ReactionPill
          v-for="(r, i) in track.reactions"
          :key="i"
          :emoji="r.e"
          :count="r.by.length"
          :mine="myReactions.has(r.e)"
          @click="(e: MouseEvent) => onReact(e, r.e)"
        />
      </div>
    </div>
  </div>
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
