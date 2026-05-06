# Totem — iOS configuration steps

These are the manual Xcode / Apple Developer steps you need to run after a
fresh checkout to enable push notifications and the share extension. The
code is in tree; this is the configuration glue.

## Prerequisites

- A paid Apple Developer account
- Bundle id `dev.cmrd.totem` registered in Apple Developer → Identifiers
- Xcode 26.4+ installed and signed in to the same Apple ID

---

## 1. Push notifications

### 1a. Create an APNs Auth Key

1. Apple Developer → **Keys** → click `+`
2. Name: "Totem APNs Key"
3. Tick **Apple Push Notifications service (APNs)**
4. Continue → Register → **Download** the `.p8` file. Apple only lets you
   download it once; lose it and you generate a new one.
5. Note the 10-character **Key ID** Apple displays.

### 1b. Get your Team ID

Apple Developer → Membership → **Team ID** (10 chars, top of the page).

### 1c. Set the secrets on the send-push function

```bash
supabase secrets set \
  APNS_TEAM_ID=<your-team-id> \
  APNS_KEY_ID=<your-key-id> \
  APNS_AUTH_KEY="$(cat AuthKey_<key-id>.p8)" \
  APNS_BUNDLE_ID=dev.cmrd.totem \
  APNS_USE_SANDBOX=1   # 1 for development builds, omit for production
```

### 1d. Tell the trigger where to POST

Run once in the Supabase SQL editor:

```sql
alter database postgres
  set app.send_push_url to
    'https://<your-project-ref>.supabase.co/functions/v1/send-push';
```

(`app.service_role_key` and `app.mirror_sync_url` should already be set
from earlier slices.)

### 1e. Enable Push Notifications capability in Xcode

1. Open `ios/App/App.xcworkspace`
2. Select the **App** target → **Signing & Capabilities**
3. Click **+ Capability** → **Push Notifications**
4. Click **+ Capability** → **Background Modes** → tick **Remote notifications**

The `Info.plist` already declares `UIBackgroundModes: remote-notification`
from this commit. Xcode adds an entitlement file the first time you tick
Push Notifications.

### 1f. Deploy + test

```bash
supabase functions deploy send-push
supabase db push
pnpm exec cap sync ios
pnpm exec cap open ios
```

In Xcode: Run on a real device (push doesn't deliver to the simulator), sign
in to the app, accept the notification permission prompt. Have a friend
add a track; you should see the banner.

---

## 2. iOS Share Extension

The Swift + Storyboard + Info.plist files live at
`ios/App/ShareExtension/`. They aren't yet wired into the Xcode project —
that step is manual because `project.pbxproj` is fragile to hand-edit.

### 2a. Add the target in Xcode

1. Open `ios/App/App.xcworkspace`
2. **File → New → Target…**
3. Pick **iOS → Share Extension** → Next
4. Product Name: `ShareExtension`
5. Team: same as the App target
6. Bundle Identifier: `dev.cmrd.totem.ShareExtension`
7. Language: Swift, Project: **App**, Embed in Application: **App**
8. Click Finish, **Activate** the new scheme when prompted.

Xcode generates a `ShareExtension/` folder with placeholder files. Replace
them with the ones from this repo:

```bash
# From the repo root, after Xcode has created the target:
rm -rf ios/App/ShareExtension/ShareViewController.swift \
       ios/App/ShareExtension/Info.plist \
       ios/App/ShareExtension/MainInterface.storyboard
git checkout HEAD -- ios/App/ShareExtension/
```

In Xcode, in the Project navigator, **right-click the ShareExtension group
→ Add Files to "App"…** and re-add the three files (Swift, Info.plist,
storyboard) targeting the **ShareExtension** target only.

### 2b. Set the deployment target

Match the App target's iOS deployment target on the ShareExtension target
(usually iOS 14.0+). ShareExtension target → **General** → Deployment Info.

### 2c. Build + run

The share extension's bundle id must be `dev.cmrd.totem.ShareExtension` and
share the same Team ID as the App target. After a successful run, the
extension appears as **"Add to Totem"** in the iOS share sheet of any
app that exports a URL (Spotify, Apple Music, YouTube Music, Safari, etc.).

### 2d. How the handoff works

1. User taps Share in Spotify → picks "Add to Totem"
2. The extension's `ShareViewController` runs in its own process, reads
   the shared URL, builds `dev.cmrd.totem://share?url=…`, and asks iOS
   to open it.
3. iOS opens the main Totem app via the registered URL scheme (declared
   in `App/Info.plist` as `CFBundleURLTypes`).
4. Capacitor's `App.appUrlOpen` listener (in `src/main.ts`) catches the
   URL, parses out the inner `url` query param, and routes to
   `/add-from-share?url=…`.
5. The picker UI shows the user's playlists; tapping one fires
   `playlists.ingestUrl(playlistId, url)` and routes to the playlist.
   The optimistic resolving row appears immediately.

### Troubleshooting

- **Extension doesn't appear in share sheet**: open Settings → General
  → "More" in the share sheet → enable "Add to Totem". Sometimes iOS
  caches the share-target list; rebooting the device forces a refresh.
- **App opens but routes nowhere**: check that the URL scheme matches in
  three places — extension's deep-link string, main app's `Info.plist`
  `CFBundleURLSchemes`, and the listener's protocol check.
