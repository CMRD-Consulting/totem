<script setup lang="ts">
import { IonPage } from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import Wordmark from '@/components/Wordmark.vue';
import { usePlaylistsStore } from '@/stores/playlists';

const router = useRouter();
const route = useRoute();
const playlists = usePlaylistsStore();
const status = ref<'joining' | 'error'>('joining');
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const result = await playlists.joinByToken(route.params.token as string);
    if (result?.playlist_id) {
      router.replace(`/p/${result.playlist_id}`);
    } else {
      throw new Error('No playlist returned from join');
    }
  } catch (e) {
    status.value = 'error';
    error.value = (e as Error).message;
  }
});
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
        align-items: center;
        justify-content: center;
        padding: 0 32px;
        box-sizing: border-box;
        overflow: hidden;
      "
    >
      <div style="text-align: center; max-width: 320px">
        <Wordmark :size="48" />

        <template v-if="status === 'joining'">
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontStyle: 'italic',
              fontSize: '20px',
              color: 'var(--muted)',
              marginTop: '24px',
              lineHeight: 1.35,
            }"
          >joining the playlist…</div>
          <div
            :style="{
              marginTop: '20px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '2px solid var(--divider)',
              borderTopColor: 'var(--accent)',
              animation: 'totem-spin 0.8s linear infinite',
              marginLeft: 'auto',
              marginRight: 'auto',
            }"
          />
        </template>

        <template v-else>
          <div
            :style="{
              marginTop: '24px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              fontFamily: 'Inter',
              fontSize: '13px',
              color: 'var(--accent)',
              lineHeight: 1.4,
            }"
          >{{ error }}</div>
          <button
            @click="router.replace('/')"
            :style="{
              marginTop: '20px',
              all: 'unset',
              cursor: 'pointer',
              padding: '12px 18px',
              borderRadius: '14px',
              background: 'var(--ink)',
              color: 'var(--surface)',
              fontFamily: 'Inter',
              fontWeight: 600,
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }"
          >
            <Icon name="back" :size="14" />
            back to your playlists
          </button>
        </template>
      </div>
    </div>
  </ion-page>
</template>

<style scoped>
@keyframes totem-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
