import { createRouter, createWebHistory } from '@ionic/vue-router';
import {
  actionSheetController,
  alertController,
  modalController,
  popoverController,
} from '@ionic/vue';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import HubPage from '@/views/HubPage.vue';
import PlaylistPage from '@/views/PlaylistPage.vue';
import SignInPage from '@/views/SignInPage.vue';
import JoinPage from '@/views/JoinPage.vue';
import AddFromSharePage from '@/views/AddFromSharePage.vue';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
  }
}

const routes: Array<RouteRecordRaw> = [
  { path: '/sign-in', name: 'sign-in', component: SignInPage, meta: { public: true } },
  { path: '/', name: 'hub', component: HubPage },
  // /create is now a card modal hosted by HubPage. Redirect deep links so they
  // land on Hub (where the user can tap "+" to open the modal).
  { path: '/create', redirect: '/' },
  { path: '/p/:playlistId', name: 'playlist', component: PlaylistPage },
  // The track sheet, invite card, and mirror card are all overlays hosted by
  // PlaylistPage. Redirect deep links to the playlist where the user can open
  // the right overlay manually.
  {
    path: '/p/:playlistId/t/:trackId',
    redirect: (to) => `/p/${to.params.playlistId}`,
  },
  {
    path: '/p/:playlistId/invite',
    redirect: (to) => `/p/${to.params.playlistId}`,
  },
  {
    path: '/p/:playlistId/mirror',
    redirect: (to) => `/p/${to.params.playlistId}`,
  },
  // Legacy: /p/:playlistId/share-sheet was a route in earlier iterations; the
  // paste-link UI is now an IonModal hosted by PlaylistPage so the playlist
  // stays visible underneath. Redirect old URLs back to the playlist.
  {
    path: '/p/:playlistId/share-sheet',
    redirect: (to) => `/p/${to.params.playlistId}`,
  },
  { path: '/i/:token', name: 'join', component: JoinPage },
  // Settings is now a card modal hosted by HubPage. Keep the URL as a redirect
  // so any deep links (or stale shortcuts) land on Hub instead of 404'ing.
  { path: '/settings', redirect: '/' },
  {
    path: '/add-from-share',
    name: 'add-from-share',
    component: AddFromSharePage,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Dismiss every open Ionic overlay (modal, action sheet, popover, alert) before
// any navigation. Without this, sheets like PlaylistPage's PasteLinkSheet sit
// on top of body — not inside the router-outlet — so a route change leaves
// them lingering over the new page.
async function dismissAllOverlays() {
  const controllers = [
    modalController,
    actionSheetController,
    popoverController,
    alertController,
  ];
  await Promise.all(
    controllers.map(async (c) => {
      while (await c.getTop()) {
        await c.dismiss().catch(() => {});
      }
    }),
  );
}

router.beforeEach(async (to) => {
  await dismissAllOverlays();
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
