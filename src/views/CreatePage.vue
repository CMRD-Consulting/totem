<script setup lang="ts">
import { IonPage, useIonRouter } from '@ionic/vue';
import { computed, onMounted, ref } from 'vue';
import IconButton from '@/components/IconButton.vue';
import ScreenScroll from '@/components/ScreenScroll.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import Sigil from '@/components/Sigil.vue';
import ToggleRow from '@/components/ToggleRow.vue';
import TopBar from '@/components/TopBar.vue';
import { pillBtn } from '@/components/pillBtn';
import { SERVICES } from '@/data/mock';
import { toMusicService } from '@/lib/serviceKey';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { usePlaylistsStore } from '@/stores/playlists';
import type { ServiceKey } from '@/types';

const emit = defineEmits<{ close: [] }>();

const ionRouter = useIonRouter();
const playlists = usePlaylistsStore();
const auth = useAuthStore();

async function pickService(s: ServiceKey) {
  if (s === auth.preferredService) return;
  try {
    await auth.setPreferredService(s);
  } catch (e) {
    error.value = (e as Error).message;
  }
}
const name = ref('');
const nameInput = ref<HTMLInputElement | null>(null);
const hues: [number, number, number] = [16, 200, 60];
const busy = ref(false);
const error = ref<string | null>(null);

// Mirror toggle — defaults ON if the user's preferred service is connected.
const mirrorService = computed(() => auth.preferredService);
const mirrorConnected = ref(false);
const mirrorOn = ref(false);

const mirrorSublabel = computed(() =>
  mirrorConnected.value
    ? 'new tracks sync to your account'
    : `connect ${SERVICES[mirrorService.value].short} in Settings to enable`,
);

onMounted(async () => {
  await auth.loadProfile();
  const { data } = await supabase
    .from('service_connections')
    .select('service')
    .eq('service', toMusicService(mirrorService.value))
    .maybeSingle();
  mirrorConnected.value = !!data;
  mirrorOn.value = mirrorConnected.value;
});

// Imperative focus handle — the parent IonModal calls this on @did-present so
// focus lands only after the slide-up animation completes (firing earlier
// loses to the transition and iOS won't raise the keyboard).
function focus() {
  nameInput.value?.focus();
}
defineExpose({ focus });

const disabled = computed(() => !name.value.trim() || busy.value);
const buttonStyle = computed(() => ({
  ...pillBtn(true, disabled.value),
  width: '100%',
  height: '50px',
  fontSize: '15px',
  // pillBtn handles cursor: not-allowed when disabled. Override only the
  // busy case, which feels more like "wait" than "you can't do this".
  ...(busy.value ? { cursor: 'wait' as const } : {}),
}));

async function onCreate() {
  if (disabled.value) return;
  busy.value = true;
  error.value = null;
  try {
    const created = await playlists.create(name.value.trim());
    if (created?.id) {
      // Await mirror creation BEFORE navigating so the playlist's mirror
      // banner is populated on first render, not flickering in late.
      if (mirrorOn.value && mirrorConnected.value) {
        await playlists.ensureMirrorTarget(created.id, mirrorService.value);
      }
      // Route guard dismisses the modal as part of this navigation.
      ionRouter.navigate(`/p/${created.id}`, 'forward', 'push');
    } else {
      emit('close');
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

// Invite-token entry — accepts a full URL or a bare token.
const showJoinInput = ref(false);
const joinValue = ref('');

function extractToken(input: string): string {
  const trimmed = input.trim();
  // Try as URL: pull the segment after /i/ if present.
  try {
    const u = new URL(trimmed);
    const m = u.pathname.match(/\/i\/([^/?#]+)/);
    if (m) return m[1];
  } catch {
    // Not a URL — fall through and treat as bare token.
  }
  return trimmed;
}

const joinReady = computed(() => extractToken(joinValue.value).length > 0 && !busy.value);

async function onJoin() {
  if (!joinReady.value) return;
  busy.value = true;
  error.value = null;
  try {
    const token = extractToken(joinValue.value);
    const result = await playlists.joinByToken(token);
    if (result?.playlist_id) {
      if (mirrorOn.value && mirrorConnected.value) {
        await playlists.ensureMirrorTarget(result.playlist_id, mirrorService.value);
      }
      ionRouter.navigate(`/p/${result.playlist_id}`, 'forward', 'push');
    } else {
      emit('close');
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <ion-page>
    <div
      style="
        width: 100%;
        height: 100%;
        background: var(--bg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      "
    >
      <TopBar title="new playlist">
        <template #left>
          <IconButton name="close" label="Close" @click="emit('close')" />
        </template>
      </TopBar>

      <ScreenScroll>
        <div style="padding: 8px 22px 0; text-align: center">
          <div style="display: inline-block">
            <Sigil :hues="hues" :size="84" :radius="14" />
          </div>
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontSize: '26px',
              color: 'var(--ink)',
              marginTop: '16px',
              letterSpacing: '-0.3px',
              lineHeight: 1.1,
            }"
          >
            what do you call this <i style="color: var(--accent)">playlist</i>?
          </div>
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '12.5px',
              color: 'var(--muted)',
              marginTop: '8px',
              maxWidth: '280px',
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.4,
            }"
          >give it a name only your friends would understand.</div>
        </div>

        <div style="padding: 22px 22px 0">
          <input
            ref="nameInput"
            v-model="name"
            placeholder="e.g. kitchen residency"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            @keyup.enter="onCreate"
            :style="{
              all: 'unset',
              boxSizing: 'border-box',
              width: '100%',
              padding: '14px 16px',
              borderRadius: '14px',
              background: 'var(--surface)',
              border: '0.5px solid var(--divider)',
              fontFamily: 'Inter',
              fontSize: '16px',
              color: 'var(--ink)',
              fontWeight: 500,
            }"
          />
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '11px',
              color: 'var(--muted-2)',
              marginTop: '8px',
              paddingLeft: '4px',
            }"
          >you can change this anytime.</div>
        </div>

        <div style="padding: 22px 22px 0">
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '14px',
              color: 'var(--muted)',
              marginBottom: '8px',
            }"
          >your service</div>
          <div style="display: flex; gap: 8px">
            <button
              v-for="(s, k) in SERVICES"
              :key="k"
              type="button"
              :aria-pressed="auth.preferredService === k"
              @click="pickService(k as ServiceKey)"
              :style="{
                all: 'unset',
                cursor: 'pointer',
                flex: 1,
                textAlign: 'center',
                padding: '14px 8px',
                borderRadius: '12px',
                background: auth.preferredService === k ? 'var(--accent-soft)' : 'var(--surface)',
                border:
                  auth.preferredService === k
                    ? '1.5px solid var(--accent)'
                    : '0.5px solid var(--divider)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
              }"
            >
              <ServiceGlyph :service="k as ServiceKey" :size="22" :color="s.color" />
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                }"
              >{{ s.short }}</div>
            </button>
          </div>
        </div>

        <div style="padding: 18px 16px 0">
          <ToggleRow
            v-model="mirrorOn"
            :disabled="!mirrorConnected"
            :label="`Mirror to your ${SERVICES[mirrorService].short}`"
            :sublabel="mirrorSublabel"
          />
        </div>

        <div style="padding: 18px 22px 0">
          <button :disabled="disabled" :style="buttonStyle" @click="onCreate">
            {{ busy ? 'creating…' : 'create playlist' }}
          </button>
          <div
            v-if="error"
            :style="{
              marginTop: '12px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              fontFamily: 'Inter',
              fontSize: '12px',
              color: 'var(--accent)',
              textAlign: 'center',
            }"
          >{{ error }}</div>
          <div
            v-if="!showJoinInput"
            :style="{
              textAlign: 'center',
              marginTop: '14px',
              fontFamily: 'Inter',
              fontSize: '12px',
              color: 'var(--muted)',
            }"
          >
            already invited?
            <button
              @click="showJoinInput = true"
              style="
                all: unset;
                cursor: pointer;
                color: var(--accent);
                font-weight: 600;
              "
            >paste an invite link</button>
          </div>
          <div v-else style="margin-top: 18px">
            <input
              v-model="joinValue"
              type="url"
              inputmode="url"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="https://totem.cmrd.dev/i/…"
              :disabled="busy"
              @keyup.enter="onJoin"
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
            />
            <button
              @click="onJoin"
              :disabled="!joinReady"
              :style="{
                all: 'unset',
                cursor: !joinReady ? 'not-allowed' : 'pointer',
                boxSizing: 'border-box',
                width: '100%',
                height: '44px',
                borderRadius: '14px',
                background: joinReady ? 'var(--accent)' : 'var(--chip-strong)',
                color: joinReady ? '#fff' : 'var(--muted-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: '14px',
                marginTop: '10px',
              }"
            >{{ busy ? 'joining…' : 'join playlist' }}</button>
            <button
              @click="showJoinInput = false; joinValue = ''"
              style="
                all: unset;
                cursor: pointer;
                display: block;
                width: 100%;
                text-align: center;
                margin-top: 12px;
                font-family: Inter;
                font-size: 12px;
                color: var(--muted);
              "
            >back to create</button>
          </div>
        </div>
      </ScreenScroll>
    </div>
  </ion-page>
</template>
