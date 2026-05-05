<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Avatar from '@/components/Avatar.vue';
import Icon from '@/components/Icon.vue';
import Sigil from '@/components/Sigil.vue';
import { usePlaylistsStore } from '@/stores/playlists';

const props = defineProps<{ playlistId: string; isOpen: boolean }>();
const emit = defineEmits<{ close: []; sent: [] }>();

const playlists = usePlaylistsStore();

const url = ref('');
const note = ref('');
const busy = ref(false);
const saved = ref(false);
const error = ref<string | null>(null);
const urlInput = ref<HTMLInputElement | null>(null);
const clipboardSuggestion = ref<string | null>(null);

const playlist = computed(() => playlists.playlists.find((g) => g.id === props.playlistId));

const isLikelyUrl = computed(() => /^https?:\/\//i.test(url.value.trim()));

// Hosts we can resolve via Songlink → ingest. Spotify URI scheme is also valid.
const MUSIC_HOSTS = new Set([
  'open.spotify.com',
  'spotify.link',
  'music.apple.com',
  'itunes.apple.com',
  'music.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

function isMusicUrl(s: string): boolean {
  const trimmed = s.trim();
  if (/^spotify:(track|album|playlist):/i.test(trimmed)) return true;
  try {
    const u = new URL(trimmed);
    return MUSIC_HOSTS.has(u.hostname.replace(/^www\./, ''));
  } catch {
    return false;
  }
}

/** Display label: drop the scheme + truncate so the chip stays one line. */
function shortUrl(s: string): string {
  let pretty = s.replace(/^https?:\/\/(www\.)?/, '');
  if (pretty.length > 38) pretty = pretty.slice(0, 36) + '…';
  return pretty;
}

async function peekClipboard() {
  // navigator.clipboard.readText works in iOS 14.5+ WKWebView. On first call
  // the user may see a system "Allow paste?" prompt; we silently swallow
  // denials and just don't show the chip.
  try {
    const text = (await navigator.clipboard.readText()).trim();
    clipboardSuggestion.value = text && isMusicUrl(text) ? text : null;
  } catch {
    clipboardSuggestion.value = null;
  }
}

// Reset transient state every time the sheet opens.
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      url.value = '';
      note.value = '';
      saved.value = false;
      error.value = null;
      busy.value = false;
      clipboardSuggestion.value = null;
    }
  },
);

// Hide the suggestion the moment the user starts typing — it's no longer relevant.
watch(url, (v) => {
  if (v) clipboardSuggestion.value = null;
});

function send() {
  if (!isLikelyUrl.value || !props.playlistId || busy.value) return;
  // Fire-and-forget: kick off ingest, then close the sheet so the user sees
  // the resolving row appear in the playlist behind. Failures surface as a
  // 'failed' track row, not in the sheet (which by then is dismissed).
  playlists.ingestUrl(props.playlistId, url.value.trim());
  saved.value = true;
  setTimeout(() => emit('sent'), 250);
}

/** One-tap shortcut: fill the input with the clipboard URL AND fire send. */
function pasteAndAdd() {
  if (!clipboardSuggestion.value) return;
  url.value = clipboardSuggestion.value;
  send();
}

/** Imperative focus handle — called by the parent on IonModal @did-present
 *  so we focus only after the slide-up animation completes (firing earlier
 *  loses to the animation and iOS may not raise the keyboard).
 *  Also peeks at the clipboard while we're already in a user-gesture context. */
function focus() {
  urlInput.value?.focus();
  peekClipboard();
}

defineExpose({ focus });
</script>

<template>
  <div
    class="paste-link-sheet"
    style="
      background: var(--bg);
      padding: 8px 0 0;
      height: 100%;
      overflow-y: auto;
      box-sizing: border-box;
    "
  >
    <!-- Header -->
    <div
      style="
        padding: 4px 20px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
      "
    >
      <div
        style="
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: var(--ink);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--surface);
        "
      >
        <Icon name="totem" :size="18" />
      </div>
      <div style="flex: 1">
        <div
          :style="{
            fontFamily: 'Inter',
            fontWeight: 600,
            fontSize: '14px',
            color: 'var(--ink)',
          }"
        >Add a song</div>
        <div
          :style="{
            fontFamily: 'Inter',
            fontSize: '11.5px',
            color: 'var(--muted)',
          }"
        >paste a Spotify, Apple Music, or YouTube Music link</div>
      </div>
      <button
        @click="emit('close')"
        style="all: unset; cursor: pointer; color: var(--muted)"
      >
        <Icon name="close" :size="18" />
      </button>
    </div>

    <!-- Target playlist preview -->
    <div
      v-if="playlist"
      style="
        margin: 0 16px;
        padding: 10px 12px;
        background: var(--surface);
        border-radius: 12px;
        border: 0.5px solid var(--divider);
        display: flex;
        align-items: center;
        gap: 12px;
      "
    >
      <Sigil :seeds="playlist.trackSeeds" :hues="playlist.sigil" :size="40" :radius="8" />
      <div style="flex: 1; min-width: 0">
        <div
          :style="{
            fontFamily: '&quot;JetBrains Mono&quot;, monospace',
            fontSize: '10px',
            color: 'var(--muted-2)',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }"
        >sending to</div>
        <div
          :style="{
            fontFamily: 'Inter',
            fontWeight: 600,
            fontSize: '14px',
            color: 'var(--ink)',
            marginTop: '1px',
          }"
        >{{ playlist.name }}</div>
      </div>
      <span
        :style="{
          fontFamily: 'Inter',
          fontSize: '11px',
          color: 'var(--muted)',
          fontVariantNumeric: 'tabular-nums',
        }"
      >{{ playlist.members.length }} friends</span>
    </div>

    <!-- URL input -->
    <div style="padding: 16px 16px 0">
      <input
        ref="urlInput"
        v-model="url"
        type="url"
        inputmode="url"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="https://open.spotify.com/track/…"
        :style="{
          all: 'unset',
          boxSizing: 'border-box',
          width: '100%',
          padding: '14px 16px',
          borderRadius: '14px',
          background: 'var(--surface)',
          border: '0.5px solid var(--divider)',
          fontFamily: '&quot;JetBrains Mono&quot;, ui-monospace, monospace',
          fontSize: '13px',
          color: 'var(--ink)',
        }"
        @keyup.enter="send"
      />
    </div>

    <!-- Clipboard quick-paste — appears when the OS clipboard holds a music URL.
         One tap fills the input AND sends, skipping the manual paste + tap. -->
    <div v-if="!url && clipboardSuggestion" style="padding: 10px 16px 0">
      <button
        @click="pasteAndAdd"
        :style="{
          all: 'unset',
          cursor: 'pointer',
          boxSizing: 'border-box',
          width: '100%',
          padding: '10px 12px',
          borderRadius: '12px',
          background: 'var(--accent-soft)',
          border: '1px solid var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }"
      >
        <Icon name="copy" :size="14" color="var(--accent)" />
        <div style="flex: 1; min-width: 0; text-align: left">
          <div
            :style="{
              fontFamily: 'Inter',
              fontWeight: 600,
              fontSize: '12.5px',
              color: 'var(--accent)',
            }"
          >paste &amp; add</div>
          <div
            :style="{
              fontFamily: '&quot;JetBrains Mono&quot;, ui-monospace, monospace',
              fontSize: '11px',
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '1px',
            }"
          >{{ shortUrl(clipboardSuggestion) }}</div>
        </div>
        <Icon name="arrow-out" :size="14" color="var(--accent)" />
      </button>
    </div>

    <!-- Optional note -->
    <div style="padding: 8px 16px 0">
      <div
        style="
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 0.5px solid var(--divider);
          background: var(--surface);
        "
      >
        <Avatar id="you" :size="22" />
        <input
          v-model="note"
          placeholder="add a note (optional)…"
          :style="{
            all: 'unset',
            flex: 1,
            fontFamily: 'Inter',
            fontSize: '13px',
            color: 'var(--ink)',
          }"
        />
      </div>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      :style="{
        margin: '12px 16px 0',
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent)',
        fontFamily: 'Inter',
        fontSize: '12px',
        color: 'var(--accent)',
      }"
    >{{ error }}</div>

    <!-- Send -->
    <div
      style="
        padding: 14px 16px 22px;
        padding-bottom: calc(22px + var(--safe-bottom));
      "
    >
      <button
        :disabled="!isLikelyUrl || busy || saved"
        @click="send"
        :style="{
          all: 'unset',
          cursor: !isLikelyUrl || busy ? 'not-allowed' : 'pointer',
          width: '100%',
          boxSizing: 'border-box',
          height: '50px',
          borderRadius: '14px',
          background: saved
            ? '#5A7B4F'
            : !isLikelyUrl
              ? 'var(--chip-strong)'
              : 'var(--accent)',
          color: !isLikelyUrl && !saved ? 'var(--muted-2)' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontFamily: 'Inter',
          fontWeight: 700,
          fontSize: '15px',
          transition: 'background 0.2s',
        }"
      >
        <template v-if="saved">
          <Icon name="check" :size="18" />
          adding to {{ playlist?.name }}
        </template>
        <template v-else>send to playlist</template>
      </button>
    </div>
  </div>
</template>
