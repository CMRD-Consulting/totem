<script setup lang="ts">
import Icon from "@/components/Icon.vue";
import {
  EMOJI_REACTION_SECTIONS,
  filterEmojiSections,
} from "@/data/reactionEmojis";
import { IonModal } from "@ionic/vue";
import { computed, ref, watch } from "vue";

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ close: []; pick: [emoji: string] }>();

const search = ref("");

watch(
  () => props.isOpen,
  (open) => {
    if (open) search.value = "";
  },
);

const filtered = computed(() =>
  filterEmojiSections(search.value, EMOJI_REACTION_SECTIONS),
);

function select(c: string) {
  emit("pick", c);
}

function onModalDismiss() {
  emit("close");
}
</script>

<template>
  <ion-modal
    :is-open="isOpen"
    :breakpoints="[0, 0.93]"
    :initial-breakpoint="0.93"
    :expand-to-scroll="false"
    @did-dismiss="onModalDismiss"
  >
    <div class="reaction-tray-root">
      <div class="reaction-tray-search">
        <div class="reaction-tray-search-field">
          <Icon name="search" :size="18" color="var(--muted-2)" />
          <input
            v-model="search"
            type="search"
            enterkeyhint="search"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            placeholder="Search emoji"
            class="reaction-tray-input"
          />
        </div>
      </div>

      <div class="reaction-tray-scroll">
        <div class="reaction-tray-body">
          <template v-if="filtered.length === 0">
            <p class="reaction-tray-empty">No emoji match “{{ search }}”</p>
          </template>
          <template v-else>
            <section
              v-for="(sec, si) in filtered"
              :key="si + sec.title"
              class="reaction-tray-section"
            >
              <h2 class="reaction-tray-heading">
                {{ sec.title }}
              </h2>
              <div class="reaction-tray-grid">
                <button
                  v-for="(it, ii) in sec.items"
                  :key="it.c + '-' + ii"
                  type="button"
                  class="reaction-tray-cell"
                  :aria-label="`React with ${it.c}`"
                  @click="select(it.c)"
                >
                  {{ it.c }}
                </button>
              </div>
            </section>
          </template>
        </div>
      </div>
    </div>
  </ion-modal>
</template>

<style scoped>
.reaction-tray-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  box-sizing: border-box;
  padding-bottom: env(safe-area-inset-bottom);
}

.reaction-tray-search {
  flex-shrink: 0;
  padding: 6px 16px 12px;
  border-bottom: 0.5px solid var(--divider);
  background: var(--surface);
}

.reaction-tray-search-field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--chip-strong);
  border: 0.5px solid var(--divider);
}

.reaction-tray-input {
  all: unset;
  flex: 1;
  min-width: 0;
  font-family: Inter, system-ui, sans-serif;
  font-size: 15px;
  color: var(--ink);
}

.reaction-tray-input::placeholder {
  color: var(--muted-2);
}

.reaction-tray-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.reaction-tray-body {
  padding: 14px 16px 20px;
}

.reaction-tray-empty {
  margin: 28px 0;
  font-family: Inter, system-ui, sans-serif;
  font-size: 14px;
  color: var(--muted);
  text-align: center;
}

.reaction-tray-section {
  margin-bottom: 22px;
}

.reaction-tray-section:last-child {
  margin-bottom: 0;
}

.reaction-tray-heading {
  margin: 0 0 10px;
  padding: 0 2px;
  font-family: Inter, system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-2);
  letter-spacing: 0.02em;
}

.reaction-tray-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 3px;
}

.reaction-tray-cell {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  line-height: 1;
  border-radius: 10px;
}

.reaction-tray-cell:active {
  background: var(--chip-strong);
}
</style>
