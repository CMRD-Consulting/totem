import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import App from './App.vue'
import router from './router';

import { IonicVue } from '@ionic/vue';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
/* @import '@ionic/vue/css/palettes/dark.class.css'; */
import '@ionic/vue/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

const app = createApp(App)
  // Force iOS mode everywhere so page transitions are the consistent
  // left-slide / right-slide stack push, not Material's fade-through (which
  // is the auto default on non-iOS web). Card modal recession and sheet
  // modals still work the same; only page-level transitions change.
  .use(IonicVue, { mode: 'ios' })
  .use(createPinia())
  .use(router);

router.isReady().then(() => {
  app.mount('#app');
});

// Deep links — two flavors:
//
//   1. Universal Links (https://totem.cmrd.dev/i/<token>): tapping an invite
//      from Messages or Mail opens the app at the JoinPage path.
//
//   2. Custom-scheme links (dev.cmrd.totem://share?url=…): the iOS Share
//      Extension hands off shared URLs by calling the host app with this
//      scheme. We route to /add-from-share?url=… where the picker UI lets
//      the user choose a playlist + commits the ingest.
//
// Native only — browsers handle URL routing themselves.
if (Capacitor.isNativePlatform()) {
  CapApp.addListener('appUrlOpen', (event) => {
    try {
      const url = new URL(event.url);

      // Custom scheme — share extension handoff.
      if (url.protocol === 'dev.cmrd.totem:') {
        if (url.host === 'share') {
          const incoming = url.searchParams.get('url');
          if (incoming) {
            router.push({
              path: '/add-from-share',
              query: { url: incoming },
            });
          }
        }
        return;
      }

      // Universal Link — known app paths.
      if (url.pathname.startsWith('/i/') || url.pathname.startsWith('/p/')) {
        router.push(url.pathname + url.search);
      }
    } catch {
      // Ignore non-URL deep-link payloads.
    }
  });
}
