<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Avatar from '@/components/Avatar.vue';
import Icon from '@/components/Icon.vue';
import Sigil from '@/components/Sigil.vue';
import { usePlaylistsStore } from '@/stores/playlists';

const props = defineProps<{ groupId: string; isOpen: boolean }>();
const emit = defineEmits<{ close: []; sent: [] }>();

const playlists = usePlaylistsStore();

const url = ref('');
const note = ref('');
const busy = ref(false);
const saved = ref(false);
const error = ref<string | null>(null);

const group = computed(() => playlists.groups.find((g) => g.id === props.groupId));

const isLikelyUrl = computed(() => /^https?:\/\//i.test(url.value.trim()));

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
    }
  },
);

async function send() {
  if (!isLikelyUrl.value || !props.groupId || busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    await playlists.ingestUrl(props.groupId, url.value.trim());
    saved.value = true;
    setTimeout(() => emit('sent'), 700);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
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

    <!-- Target group preview -->
    <div
      v-if="group"
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
      <Sigil :seeds="group.trackSeeds" :hues="group.sigil" :size="40" :radius="8" />
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
        >{{ group.name }}</div>
      </div>
      <span
        :style="{
          fontFamily: 'Inter',
          fontSize: '11px',
          color: 'var(--muted)',
          fontVariantNumeric: 'tabular-nums',
        }"
      >{{ group.members.length }} friends</span>
    </div>

    <!-- URL input -->
    <div style="padding: 16px 16px 0">
      <input
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
          sent to {{ group?.name }}
        </template>
        <template v-else-if="busy">resolving…</template>
        <template v-else>send to group</template>
      </button>
    </div>
  </div>
</template>
