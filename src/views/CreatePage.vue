<script setup lang="ts">
import { IonPage } from '@ionic/vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import IconButton from '@/components/IconButton.vue';
import ScreenScroll from '@/components/ScreenScroll.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import Sigil from '@/components/Sigil.vue';
import TopBar from '@/components/TopBar.vue';
import { pillBtn } from '@/components/pillBtn';
import { SERVICES } from '@/data/mock';
import { usePlaylistsStore } from '@/stores/playlists';
import type { ServiceKey } from '@/types';

const router = useRouter();
const playlists = usePlaylistsStore();
const name = ref('sunday roast');
const hues: [number, number, number] = [16, 200, 60];
const busy = ref(false);
const error = ref<string | null>(null);

const disabled = computed(() => !name.value.trim() || busy.value);
const buttonStyle = computed(() => ({
  ...pillBtn(true),
  width: '100%',
  height: '50px',
  fontSize: '15px',
  ...(disabled.value
    ? {
        background: 'var(--chip-strong)',
        color: 'var(--muted-2)',
        cursor: busy.value ? 'wait' : 'not-allowed',
      }
    : {}),
}));

async function onCreate() {
  if (disabled.value) return;
  busy.value = true;
  error.value = null;
  try {
    const created = await playlists.create(name.value.trim());
    if (created?.id) router.push(`/p/${created.id}`);
    else router.push('/');
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
      <TopBar title="new group">
        <template #left>
          <IconButton name="close" @click="router.push('/')" />
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
            what do you call this <i style="color: var(--accent)">circle</i>?
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
            v-model="name"
            placeholder="e.g. kitchen residency"
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
              :style="{
                all: 'unset',
                cursor: 'pointer',
                flex: 1,
                textAlign: 'center',
                padding: '14px 8px',
                borderRadius: '12px',
                background: k === 'spotify' ? 'var(--accent-soft)' : 'var(--surface)',
                border:
                  k === 'spotify'
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

        <div style="padding: 32px 22px 0">
          <button :disabled="disabled" :style="buttonStyle" @click="onCreate">
            {{ busy ? 'creating…' : 'create group' }}
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
            :style="{
              textAlign: 'center',
              marginTop: '14px',
              fontFamily: 'Inter',
              fontSize: '12px',
              color: 'var(--muted)',
            }"
          >
            already invited?
            <span style="color: var(--accent); font-weight: 600">paste an invite link</span>
          </div>
        </div>
      </ScreenScroll>
    </div>
  </ion-page>
</template>
