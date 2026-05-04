import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import HubPage from '@/views/HubPage.vue';
import CreatePage from '@/views/CreatePage.vue';
import PlaylistPage from '@/views/PlaylistPage.vue';
import TrackDetailPage from '@/views/TrackDetailPage.vue';
import InvitePage from '@/views/InvitePage.vue';
import MirrorPage from '@/views/MirrorPage.vue';
import ShareSheetPage from '@/views/ShareSheetPage.vue';
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
  { path: '/p/:groupId', name: 'playlist', component: PlaylistPage },
  {
    path: '/p/:groupId/t/:trackId',
    name: 'track',
    component: TrackDetailPage,
  },
  { path: '/p/:groupId/invite', name: 'invite', component: InvitePage },
  { path: '/p/:groupId/mirror', name: 'mirror', component: MirrorPage },
  {
    path: '/p/:groupId/share-sheet',
    name: 'share-sheet',
    component: ShareSheetPage,
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
