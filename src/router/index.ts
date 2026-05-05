import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import HubPage from '@/views/HubPage.vue';
import CreatePage from '@/views/CreatePage.vue';
import PlaylistPage from '@/views/PlaylistPage.vue';
import TrackDetailPage from '@/views/TrackDetailPage.vue';
import InvitePage from '@/views/InvitePage.vue';
import MirrorPage from '@/views/MirrorPage.vue';
import SignInPage from '@/views/SignInPage.vue';
import JoinPage from '@/views/JoinPage.vue';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
  }
}

const routes: Array<RouteRecordRaw> = [
  { path: '/sign-in', name: 'sign-in', component: SignInPage, meta: { public: true } },
  { path: '/', name: 'hub', component: HubPage },
  { path: '/create', name: 'create', component: CreatePage },
  { path: '/p/:playlistId', name: 'playlist', component: PlaylistPage },
  {
    path: '/p/:playlistId/t/:trackId',
    name: 'track',
    component: TrackDetailPage,
  },
  { path: '/p/:playlistId/invite', name: 'invite', component: InvitePage },
  { path: '/p/:playlistId/mirror', name: 'mirror', component: MirrorPage },
  // Legacy: /p/:playlistId/share-sheet was a route in earlier iterations; the
  // paste-link UI is now an IonModal hosted by PlaylistPage so the playlist
  // stays visible underneath. Redirect old URLs back to the playlist.
  {
    path: '/p/:playlistId/share-sheet',
    redirect: (to) => `/p/${to.params.playlistId}`,
  },
  { path: '/i/:token', name: 'join', component: JoinPage },
  { path: '/settings', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (auth.loading) await auth.init();
  if (!auth.user && !to.meta.public) {
    return { path: '/sign-in', query: { redirect: to.fullPath } };
  }
  if (auth.user && to.path === '/sign-in') {
    return { path: '/' };
  }
});

export default router;
