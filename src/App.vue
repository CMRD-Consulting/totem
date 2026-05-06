<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { watch } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { registerPushNotifications } from '@/composables/usePushNotifications';
import { useAuthStore } from '@/stores/auth';

useTheme();

// Register for push notifications once the user is authenticated. The
// composable is a no-op on web — Capacitor's push-notifications plugin is
// native-only. APNs delivery additionally requires APNS_* env vars on the
// send-push edge function and an APNs auth key; see docs/manual-test-plan-v0.md.
const auth = useAuthStore();
watch(
  () => auth.user,
  (u) => {
    if (u) registerPushNotifications().catch(() => {});
  },
  { immediate: true },
);
</script>
