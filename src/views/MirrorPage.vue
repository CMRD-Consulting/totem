<script setup lang="ts">
import Icon from "@/components/Icon.vue";
import IconButton from "@/components/IconButton.vue";
import ScreenScroll from "@/components/ScreenScroll.vue";
import ServiceGlyph from "@/components/ServiceGlyph.vue";
import TopBar from "@/components/TopBar.vue";
import { SERVICES } from "@/data/mock";
import { fromMusicService, type MusicService } from "@/lib/serviceKey";
import { supabase } from "@/lib/supabase";
import { usePlaylistsStore } from "@/stores/playlists";
import type { ServiceKey } from "@/types";
import { IonPage, useIonRouter } from "@ionic/vue";
import { computed, onMounted, ref } from "vue";

interface MirrorTarget {
  id: string;
  service: ServiceKey;
  enabled: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

const props = defineProps<{ playlistId: string }>();
const emit = defineEmits<{ close: [] }>();

const playlists = usePlaylistsStore();
const ionRouter = useIonRouter();
const targets = ref<Record<string, MirrorTarget>>({});
const connectedServices = ref<Set<ServiceKey>>(new Set());
const busy = ref(false);
const error = ref<string | null>(null);
// Separate from generic error: surfaced when the user tries to mirror but
// hasn't connected the target service yet. Drives the "Connect in Settings"
// CTA below the service list.
const needsConnection = ref<ServiceKey | null>(null);

const playlist = computed(
  () =>
    playlists.playlists.find((g) => g.id === props.playlistId) ??
    playlists.playlists[0],
);

function isImplemented(_key: ServiceKey) {
  return true;
}

function relSync(iso: string | null): string {
  if (!iso) return "no syncs yet";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "synced just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `synced ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `synced ${h}h ago`;
  const d = Math.floor(h / 24);
  return `synced ${d}d ago`;
}

function statusLabel(k: ServiceKey): string {
  const t = targets.value[k];
  if (!t) {
    return connectedServices.value.has(k)
      ? "tap to mirror"
      : `connect ${SERVICES[k].short} in Settings first`;
  }
  if (t.last_sync_error === "reauth_required") {
    return "reconnect in Settings";
  }
  if (t.last_sync_error) return `error: ${t.last_sync_error}`;
  if (!t.enabled) return "disabled — tap to re-enable";
  return relSync(t.last_synced_at);
}

async function loadTargets() {
  if (!props.playlistId) return;
  const { data, error: err } = await supabase
    .from("mirror_targets")
    .select("id, service, enabled, last_synced_at, last_sync_error")
    .eq("playlist_id", props.playlistId);
  if (err) {
    error.value = err.message;
    return;
  }
  targets.value = Object.fromEntries(
    (data ?? []).map((target) => [
      fromMusicService(target.service as MusicService),
      { ...target, service: fromMusicService(target.service as MusicService) } as MirrorTarget,
    ]),
  );
}

async function loadConnections() {
  const { data } = await supabase
    .from("service_connections")
    .select("service");
  connectedServices.value = new Set(
    (data ?? []).map((connection) => fromMusicService(connection.service as MusicService)),
  );
}

async function pick(k: ServiceKey) {
  if (!isImplemented(k)) return;
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  needsConnection.value = null;
  try {
    const existing = targets.value[k];
    if (existing) {
      // Manage flow: toggle enabled.
      await supabase
        .from("mirror_targets")
        .update({ enabled: !existing.enabled })
        .eq("id", existing.id);
      await loadTargets();
    } else if (connectedServices.value.has(k)) {
      // Setup flow with existing connection: skip OAuth, reuse stored tokens.
      await playlists.ensureMirrorTarget(props.playlistId, k);
      await loadTargets();
    } else {
      // No connection yet — Settings is the single setup path. Surface a
      // dedicated state with a button instead of a passive error message.
      needsConnection.value = k;
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

/** Close this modal and route to Hub with a flag that opens Settings. The
 *  router guard dismisses overlays during navigation, so the close emit is
 *  technically redundant — kept explicit for clarity. */
function openSettingsFromHere() {
  emit("close");
  ionRouter.navigate("/?openSettings=1", "root", "replace");
}

// onMounted (not onIonViewWillEnter) because Mirror is now hosted inside an
// IonModal — the page lifecycle hooks tied to IonRouterOutlet won't fire.
onMounted(async () => {
  if (!playlists.loaded) await playlists.loadList().catch(() => {});
  await Promise.all([loadTargets(), loadConnections()]);
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
        overflow: hidden;
      "
    >
      <TopBar title="mirror settings">
        <template #left>
          <IconButton name="close" label="Close" @click="emit('close')" />
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
            keep <i style="color: var(--accent)">{{ playlist?.name }}</i> in
            your own service
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
            Totem can copy this shared list into a private playlist on the
            service you actually listen on. New tracks added by friends sync
            automatically.
          </div>
        </div>

        <div style="padding: 20px 16px 0">
          <button
            v-for="(s, k) in SERVICES"
            :key="k"
            @click="pick(k as ServiceKey)"
            :disabled="!isImplemented(k as ServiceKey) || busy"
            :style="{
              all: 'unset',
              cursor: isImplemented(k as ServiceKey)
                ? 'pointer'
                : 'not-allowed',
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px',
              borderRadius: '14px',
              background: 'var(--surface)',
              border: targets[k]?.enabled
                ? '1.5px solid var(--accent)'
                : '0.5px solid var(--divider)',
              opacity: isImplemented(k as ServiceKey) ? 1 : 0.55,
              marginBottom: '8px',
            }"
          >
            <ServiceGlyph
              :service="k as ServiceKey"
              :size="28"
              :color="s.color"
            />
            <div style="flex: 1; text-align: left">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--ink)',
                }"
              >
                {{ s.name }}
              </div>
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '11.5px',
                  color: 'var(--muted)',
                  marginTop: '1px',
                }"
              >
                {{ statusLabel(k as ServiceKey) }}
              </div>
            </div>
            <div
              :style="{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                border: targets[k]?.enabled
                  ? 'none'
                  : '1.5px solid var(--divider-strong)',
                background: targets[k]?.enabled
                  ? 'var(--accent)'
                  : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }"
            >
              <Icon v-if="targets[k]?.enabled" name="check" :size="14" />
            </div>
          </button>
        </div>

        <!-- Needs-connection CTA: actionable instead of passive. -->
        <button
          v-if="needsConnection"
          type="button"
          @click="openSettingsFromHere"
          :style="{
            all: 'unset',
            cursor: 'pointer',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '12px 16px 0',
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent)',
            width: 'calc(100% - 32px)',
          }"
        >
          <ServiceGlyph
            :service="needsConnection"
            :size="20"
            :color="SERVICES[needsConnection].color"
          />
          <div style="flex: 1; text-align: left">
            <div
              :style="{
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: '13.5px',
                color: 'var(--accent)',
              }"
            >Connect {{ SERVICES[needsConnection].short }} in Settings</div>
            <div
              :style="{
                fontFamily: 'Inter',
                fontSize: '11.5px',
                color: 'var(--accent)',
                opacity: 0.75,
                marginTop: '2px',
                lineHeight: 1.35,
              }"
            >one-time setup, then come back here to mirror</div>
          </div>
          <Icon name="chevron" :size="16" color="var(--accent)" />
        </button>

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
        >
          {{ error }}
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
          Totem isn't a player. Tracks always open in the service of your
          choice. Mirroring is a courtesy copy — you keep ownership of the
          playlist on your end.
        </div>
      </ScreenScroll>
    </div>
  </ion-page>
</template>
