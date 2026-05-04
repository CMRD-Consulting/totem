<script setup lang="ts">
import { IonPage } from '@ionic/vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AlbumArt from '@/components/AlbumArt.vue';
import Avatar from '@/components/Avatar.vue';
import Icon from '@/components/Icon.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import Sigil from '@/components/Sigil.vue';
import { SERVICES, TRACKS } from '@/data/mock';
import { state } from '@/store/state';

const router = useRouter();
const route = useRoute();
const note = ref('');
const saved = ref(false);

const initialId = computed(() => (route.params.groupId as string) || state.groups[0].id);
const picked = ref(initialId.value);

const sample = TRACKS[7]; // "Don't Save Me" — HAIM

function close() {
  router.push(`/p/${picked.value}`);
}

function send() {
  saved.value = true;
  setTimeout(() => router.push(`/p/${picked.value}`), 700);
}
</script>

<template>
  <ion-page>
    <div
      style="
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        animation: totem-fade-in 0.18s ease;
      "
    >
      <!-- Faux Spotify backdrop -->
      <div style="position: absolute; inset: 0; z-index: 0" @click="close">
        <div
          style="
            width: 100%;
            height: 100%;
            background: #121212;
            color: #fff;
            padding: calc(60px + var(--safe-top)) 18px 0;
            box-sizing: border-box;
            overflow: hidden;
          "
        >
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px">
            <ServiceGlyph service="spotify" :size="20" :color="SERVICES.spotify.color" />
            <span style="font-family: Inter; font-weight: 700; font-size: 14px">Spotify</span>
          </div>
          <div
            style="
              width: 200px;
              height: 200px;
              margin: 20px auto;
              border-radius: 6px;
              background: linear-gradient(135deg, #ffb672, #c9304e);
            "
          />
          <div
            style="
              text-align: center;
              font-family: Inter;
              font-size: 18px;
              font-weight: 700;
              margin-top: 18px;
            "
          >Don't Save Me</div>
          <div
            style="
              text-align: center;
              font-family: Inter;
              font-size: 13px;
              color: rgba(255, 255, 255, 0.6);
              margin-top: 4px;
            "
          >HAIM</div>
        </div>
        <div style="position: absolute; inset: 0; background: rgba(0, 0, 0, 0.45)" />
      </div>

      <!-- Sheet -->
      <div
        style="
          position: relative;
          z-index: 1;
          background: var(--bg);
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          padding: 8px 0 0;
          box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.2);
          animation: totem-slide-up 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
        "
      >
        <!-- Grabber -->
        <div style="display: flex; justify-content: center; padding: 6px 0 4px">
          <div
            style="
              width: 36px;
              height: 4px;
              border-radius: 2px;
              background: var(--divider-strong);
            "
          />
        </div>

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
            >Add to Totem</div>
            <div
              :style="{
                fontFamily: 'Inter',
                fontSize: '11.5px',
                color: 'var(--muted)',
              }"
            >From Spotify</div>
          </div>
          <button
            @click="close"
            style="all: unset; cursor: pointer; color: var(--muted)"
          >
            <Icon name="close" :size="18" />
          </button>
        </div>

        <!-- Track preview -->
        <div
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
          <AlbumArt :seed="sample.seed" :size="48" :radius="6" />
          <div style="flex: 1; min-width: 0">
            <div
              :style="{
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }"
            >{{ sample.title }}</div>
            <div style="font-family: Inter; font-size: 12px; color: var(--muted)">
              {{ sample.artist }}
            </div>
          </div>
          <ServiceGlyph service="spotify" :size="18" :color="SERVICES.spotify.color" />
        </div>

        <!-- Pick group -->
        <div
          :style="{
            padding: '16px 20px 6px',
            fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
            fontStyle: 'italic',
            fontSize: '14px',
            color: 'var(--muted)',
          }"
        >send to</div>
        <div style="padding: 0 16px">
          <button
            v-for="g in state.groups"
            :key="g.id"
            @click="picked = g.id"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: picked === g.id ? 'var(--accent-soft)' : 'transparent',
              border:
                picked === g.id
                  ? '1px solid var(--accent)'
                  : '1px solid transparent',
              marginBottom: '4px',
            }"
          >
            <Sigil :seeds="g.trackSeeds" :hues="g.sigil" :size="32" :radius="6" />
            <div style="flex: 1; text-align: left">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--ink)',
                }"
              >{{ g.name }}</div>
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '11.5px',
                  color: 'var(--muted)',
                }"
              >{{ g.members.length }} friends</div>
            </div>
            <Icon v-if="picked === g.id" name="check" :size="18" color="var(--accent)" />
          </button>
        </div>

        <!-- Note -->
        <div style="padding: 10px 16px 0">
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

        <!-- Send -->
        <div
          style="
            padding: 14px 16px 22px;
            padding-bottom: calc(22px + var(--safe-bottom));
          "
        >
          <button
            @click="send"
            :style="{
              all: 'unset',
              cursor: saved ? 'default' : 'pointer',
              width: '100%',
              boxSizing: 'border-box',
              height: '50px',
              borderRadius: '14px',
              background: saved ? '#5A7B4F' : 'var(--accent)',
              color: '#fff',
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
              sent to {{ state.groups.find((g) => g.id === picked)?.name }}
            </template>
            <template v-else>send to group</template>
          </button>
        </div>
      </div>
    </div>
  </ion-page>
</template>
