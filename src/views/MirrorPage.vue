<script setup lang="ts">
import { IonPage } from '@ionic/vue';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import ScreenScroll from '@/components/ScreenScroll.vue';
import ServiceGlyph from '@/components/ServiceGlyph.vue';
import ToggleRow from '@/components/ToggleRow.vue';
import TopBar from '@/components/TopBar.vue';
import { SERVICES } from '@/data/mock';
import { state } from '@/store/state';
import type { ServiceKey } from '@/types';

const router = useRouter();
const route = useRoute();
const active = ref<ServiceKey | null>('spotify');
const autoSync = ref(true);
const notify = ref(false);
const hideMix = ref(false);

const group = computed(() => {
  const id = route.params.groupId as string;
  return state.groups.find((g) => g.id === id) ?? state.groups[0];
});

function pick(k: ServiceKey) {
  active.value = active.value === k ? null : k;
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
      <TopBar title="mirror settings">
        <template #left>
          <IconButton name="close" @click="router.push(`/p/${group.id}`)" />
        </template>
      </TopBar>

      <ScreenScroll>
        <div style="padding: 4px 22px 0">
          <div
            :style="{
              fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
              fontSize: '24px',
              color: 'var(--ink)',
              lineHeight: 1.2,
              letterSpacing: '-0.3px',
            }"
          >
            keep <i style="color: var(--accent)">{{ group.name }}</i> in your own service
          </div>
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '13px',
              color: 'var(--muted)',
              marginTop: '8px',
              lineHeight: 1.4,
            }"
          >
            Totem can copy this shared list into a private playlist on the service you
            actually listen on. New tracks added by friends sync automatically.
          </div>
        </div>

        <div style="padding: 20px 16px 0">
          <button
            v-for="(s, k) in SERVICES"
            :key="k"
            @click="pick(k as ServiceKey)"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px',
              borderRadius: '14px',
              background: 'var(--surface)',
              border:
                active === k
                  ? '1.5px solid var(--accent)'
                  : '0.5px solid var(--divider)',
              marginBottom: '8px',
            }"
          >
            <ServiceGlyph :service="k as ServiceKey" :size="28" :color="s.color" />
            <div style="flex: 1; text-align: left">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--ink)',
                }"
              >{{ s.name }}</div>
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '11.5px',
                  color: 'var(--muted)',
                  marginTop: '1px',
                }"
              >
                {{ active === k ? 'mirroring · synced 2m ago' : 'tap to mirror' }}
              </div>
            </div>
            <div
              :style="{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                border: active === k ? 'none' : '1.5px solid var(--divider-strong)',
                background: active === k ? 'var(--accent)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }"
            >
              <Icon v-if="active === k" name="check" :size="14" />
            </div>
          </button>
        </div>

        <div v-if="active" style="padding: 14px 16px 0">
          <ToggleRow
            label="Auto-sync new tracks"
            sublabel="when friends add songs they'll appear in your mirrored playlist within seconds"
            v-model="autoSync"
          />
          <ToggleRow
            label="Notify me on new adds"
            sublabel="a soft push when someone adds a song"
            v-model="notify"
          />
          <ToggleRow
            label="Hide in cross-service sharing"
            sublabel="don't tell other friends which service you use"
            v-model="hideMix"
          />
        </div>

        <div
          :style="{
            padding: '20px 22px',
            fontFamily: 'Inter',
            fontSize: '11px',
            color: 'var(--muted-2)',
            lineHeight: 1.5,
          }"
        >
          Totem isn't a player. Tracks always open in the service of your choice.
          Mirroring is a courtesy copy — you keep ownership of the playlist on your end.
        </div>
      </ScreenScroll>
    </div>
  </ion-page>
</template>
