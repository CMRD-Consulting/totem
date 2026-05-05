<script setup lang="ts">
import { IonPage } from '@ionic/vue';
import { onIonViewWillEnter } from '@ionic/vue';
import { useRouter } from 'vue-router';
import ActivityRow from '@/components/ActivityRow.vue';
import AvatarStack from '@/components/AvatarStack.vue';
import Icon from '@/components/Icon.vue';
import IconButton from '@/components/IconButton.vue';
import LogoMark from '@/components/LogoMark.vue';
import ScreenScroll from '@/components/ScreenScroll.vue';
import SectionHeader from '@/components/SectionHeader.vue';
import Sigil from '@/components/Sigil.vue';
import TopBar from '@/components/TopBar.vue';
import Wordmark from '@/components/Wordmark.vue';
import { ACTIVITY } from '@/data/mock';
import { useAuthStore } from '@/stores/auth';
import { usePlaylistsStore } from '@/stores/playlists';

const router = useRouter();
const playlists = usePlaylistsStore();
const auth = useAuthStore();

onIonViewWillEnter(() => {
  playlists.loadList().catch(() => {});
});

async function onSettings() {
  // Stub: settings page TBD. For now, the settings icon signs out.
  if (window.confirm('Sign out?')) {
    await auth.signOut();
    playlists.reset();
    router.replace('/sign-in');
  }
}
</script>

<template>
  <ion-page>
    <div
      class="totem-app"
      style="
        width: 100%;
        height: 100%;
        background: var(--bg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      "
    >
      <TopBar>
        <template #left>
          <IconButton name="settings" @click="onSettings" />
        </template>
        <template #right>
          <IconButton name="plus" accent @click="router.push('/create')" />
        </template>
      </TopBar>

      <ScreenScroll>
        <div :style="{ padding: '8px 22px 22px', display: 'flex', alignItems: 'flex-start', gap: '14px' }">
          <LogoMark :size="64" />
          <div>
            <Wordmark :size="42" />
            <div
              :style="{
                fontFamily: 'Inter',
                fontSize: '13px',
                color: 'var(--muted)',
                marginTop: '10px',
                lineHeight: 1.4,
                maxWidth: '280px',
              }"
            >
              Shared playlists across Spotify, Apple Music, and YouTube Music.
              With the people you'd burn a CD for.
            </div>
          </div>
        </div>

        <SectionHeader>your groups</SectionHeader>
        <div style="padding: 0 14px">
          <div
            v-for="g in playlists.groups"
            :key="g.id"
            @click="router.push(`/p/${g.id}`)"
            :style="{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px',
              background: 'var(--surface)',
              borderRadius: '14px',
              marginBottom: '8px',
              cursor: 'pointer',
              boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
              border: '0.5px solid var(--divider)',
            }"
          >
            <Sigil :seeds="g.trackSeeds" :hues="g.sigil" :size="48" :radius="9" />
            <div style="flex: 1; min-width: 0">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '15px',
                  color: 'var(--ink)',
                  letterSpacing: '-0.1px',
                }"
              >{{ g.name }}</div>
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '12px',
                  color: 'var(--muted)',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }"
              >
                <span style="font-variant-numeric: tabular-nums">
                  {{ g.tracks }} songs
                </span>
                <span>·</span>
                <span>{{ g.members.length }} friends</span>
              </div>
            </div>
            <AvatarStack
              :ids="g.members.filter((m) => m !== 'you')"
              :size="20"
              :max="3"
            />
          </div>

          <div
            @click="router.push('/create')"
            :style="{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px',
              borderRadius: '14px',
              border: '1px dashed var(--divider-strong)',
              cursor: 'pointer',
              color: 'var(--muted)',
              marginTop: '4px',
            }"
          >
            <div
              style="
                width: 48px;
                height: 48px;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: var(--chip);
              "
            >
              <Icon name="plus" :size="20" />
            </div>
            <div style="flex: 1">
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: 'var(--ink)',
                }"
              >start a new group</div>
              <div
                :style="{
                  fontFamily: 'Inter',
                  fontSize: '12px',
                  color: 'var(--muted)',
                  marginTop: '2px',
                }"
              >or join with an invite link</div>
            </div>
            <Icon name="chevron" :size="18" />
          </div>
        </div>

        <SectionHeader :style-override="{ marginTop: '24px' }">recent activity</SectionHeader>
        <div style="padding: 0 22px">
          <ActivityRow v-for="a in ACTIVITY.slice(0, 4)" :key="a.id" :item="a" />
        </div>
      </ScreenScroll>
    </div>
  </ion-page>
</template>
