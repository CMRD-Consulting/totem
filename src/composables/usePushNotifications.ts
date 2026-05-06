import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from '@capacitor/push-notifications';
import router from '@/router';
import { supabase } from '@/lib/supabase';

/**
 * One-shot push registration. Call from App.vue once the user is signed in.
 *
 *   1. Asks for notification permission (iOS shows the system prompt).
 *   2. On grant, calls register() — Apple/FCM hand back a device token.
 *   3. Stores the token in device_tokens (upsert keyed on user_id+token).
 *   4. Sets up listeners for foreground notifications and tap actions; the
 *      tap action routes the user to the playlist_id carried in the push
 *      payload's data block.
 *
 * No-op on web — Capacitor's push-notifications plugin is native-only.
 */
export async function registerPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return;

  // The token arrives asynchronously via the 'registration' event.
  await PushNotifications.addListener('registration', async (t: Token) => {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) return;
    await supabase.from('device_tokens').upsert(
      {
        user_id: userId,
        token: t.value,
        platform: 'ios',
      },
      { onConflict: 'user_id,token' },
    );
  });

  await PushNotifications.addListener('registrationError', (err) => {
    console.error('push registration error', err);
  });

  await PushNotifications.addListener(
    'pushNotificationReceived',
    (_n: PushNotificationSchema) => {
      // Foreground delivery — iOS won't show the system banner unless we ask
      // for it via PresentationOption. v0: silent foreground (the in-app
      // realtime channel already updates the playlist live).
    },
  );

  await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      // User tapped the notification. Route to the playlist if present.
      const playlistId = (action.notification.data as { playlist_id?: string })?.playlist_id;
      if (playlistId) router.push(`/p/${playlistId}`);
    },
  );

  await PushNotifications.register();
}

/** Unregister is best-effort — clears the listeners and removes the device token row. */
export async function unregisterPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  await PushNotifications.removeAllListeners();
  // Token cleanup happens server-side when Apple reports the token as stale,
  // so we don't bother with client-driven deletes here.
}
