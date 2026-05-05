# Totem — Visual & UI Design Prompt

> Paste this into Claude (or the `frontend-design` skill) when commissioning visual concepts, screen mockups, or a design system for the Totem iOS app. It is self-contained — a designer who has never seen the spec should be able to produce coherent work from this alone.

---

## Table of Contents

- [1. The product in one paragraph](#1-the-product-in-one-paragraph)
- [2. Who uses it and what they feel](#2-who-uses-it-and-what-they-feel)
- [3. Brand attributes](#3-brand-attributes)
- [4. Concrete screens to design](#4-concrete-screens-to-design)
- [5. UI problems specific to Totem (do not skip these)](#5-ui-problems-specific-to-totem-do-not-skip-these)
- [6. Visual direction](#6-visual-direction)
- [7. References to lean toward and away from](#7-references-to-lean-toward-and-away-from)
- [8. Specific anti-patterns to avoid](#8-specific-anti-patterns-to-avoid)
- [9. Deliverables expected](#9-deliverables-expected)
- [10. Out of scope for this design pass](#10-out-of-scope-for-this-design-pass)

## 1. The product in one paragraph

**Totem** is an iOS app that lets a small group of close friends co-curate a shared music playlist together — even when each friend uses a different streaming service (Spotify, Apple Music, YouTube Music). One person creates a playlist, shares an invite link, and from then on anyone in the group can add tracks by hitting the iOS share sheet from inside their own music app. Totem is **not a player** — tapping a track deep-links out to the friend's preferred service. Optionally each friend can mirror the shared list into their own service so it appears natively in Spotify / Apple Music / YouTube Music. Think *shared Google Doc, but for songs, across walled gardens.*

## 2. Who uses it and what they feel

- **Audience:** Tight friend groups (2–8 people) — couples, roommates, a band, a long-distance group of college friends. Not a social network. There is no discovery, no public profiles, no follower counts.
- **Emotional register:** Intimate, low-stakes, a little playful. Closer to *iMessage* and *Find My Friends* than to *Spotify* or *TikTok*. The app should feel like a private group chat made of songs, not a publishing platform.
- **Frequency:** Bursty. A user might add 6 tracks in five minutes after a road trip, then not open the app for a week. The home screen has to make "what did my people add since I was last here?" instantly answerable.

## 3. Brand attributes

Three adjectives, in priority order:

1. **Intimate** — small group, warm, low ceremony. No leaderboards, no streaks, no growth-hacky empty states.
2. **Cross-tribal** — must feel native to a Spotify diehard *and* an Apple Music diehard *and* a YouTube Music holdout. Cannot lean visually on any single service's aesthetic. Service logos appear, but as small functional chips, never as the dominant color.
3. **Quietly clever** — the magic of cross-service translation should feel effortless and a little delightful, never showy. Hide the machinery, surface the result.

## 4. Concrete screens to design

Design a cohesive set, not isolated mocks. The screens, in flow order:

1. **Sign-in** — single "Sign in with Apple" button. Almost no chrome.
2. **Playlists list (home)** — a list of the user's playlists with "what's new since you last looked" affordance, a clear "+" for create, and a way to join via invite. Treat this as the most-loaded screen.
3. **Empty state for new user** — when they have no playlists yet. Should make creating *or* joining feel equally inviting.
4. **Create playlist sheet** — name + optional description. Modal. Three taps max.
5. **Playlist detail** — the heart of the app. A scrolling list of tracks, each row showing: artwork, title, artist, who added it, when. Plus a way to surface the per-user mirror status, a way to share the invite link, and a way to add a track via paste-link (the share-extension flow happens outside the app, so paste-link is the in-app fallback).
6. **Track row variants** — design the row for: (a) normal track, (b) track that isn't available on the viewer's mirrored service, (c) track that's still resolving (Songlink lookup in flight), (d) track that failed to resolve.
7. **Invite share sheet** — the moment a creator hands out the invite link. Should feel like passing someone a key, not posting to the public.
8. **Join via invite preview** — when a user taps an invite link, before they commit, they see the playlist name, who's already in it, and a "Join" button.
9. **Mirror setup flow** — "Mirror this to my Spotify" → OAuth handoff → return state. Show the three states: not connected, connecting, connected (with a small "last synced 2 min ago"). Include an error state for "reconnect required."
10. **Playlist settings / member list** — see who's in, leave the playlist, rotate invite link, delete (creator only).
11. **Notification surfaces** — both the iOS push payload styling (system-rendered, but you can suggest copy: *"Bob added 'Blue Monday' to Late Night Vibes"*) and the in-app unread badge on a playlist row.

## 5. UI problems specific to Totem (do not skip these)

- **Multi-service track identity.** Every track in the list is the *same canonical song* with up to three deep-link destinations. A row needs to communicate "this song exists on Spotify and Apple Music but not YouTube Music" without becoming a logo soup. Consider: tiny service dots, a single primary-service indicator based on the viewer's preference, or surfacing service info only on tap.
- **Attribution is core, not decorative.** Knowing *who added this* is half the joy of the app. Avatars and "added by" text should feel first-class — not a tiny gray byline at the bottom. Group consecutive adds by the same person to reduce visual noise (like iMessage bubble grouping).
- **The mirror is per-viewer.** Two people looking at the same playlist see different mirror status because each has their own connection. Design this so it never reads as "playlist-wide health" — it's *your* mirror, not the playlist's mirror.
- **Ingestion happens outside the app.** The dominant flow is *user is in Spotify → share sheet → Totem*. The in-app "add track" affordance is a secondary fallback (paste a link). Don't design the in-app add as the hero — design the *receiving* experience instead: how does the playlist feel when fresh tracks land in it from elsewhere?
- **Pull-to-refresh is the sync model in v1.** No live sockets. The refresh gesture and its loading/refreshed states should feel intentional, not borrowed.
- **Service availability badges, not warnings.** "Not on Spotify" should read as a neutral fact, not a yellow caution triangle. Most tracks resolve fine; the few that don't shouldn't make the playlist feel broken.

## 6. Visual direction

- **Platform:** Native iOS feel. Built on Ionic, so use iOS-mode Ionic components (large titles, translucent toolbars, segment controls, action sheets, sheet modals with detents). Don't fight the platform — extend it.
- **Mode:** Design dark-mode-first. Dark is the natural mode for a music app and for late-night playlist building. Light mode should be a faithful translation, not an afterthought.
- **Typography:** SF Pro (or a near equivalent). Lean into iOS's typography scale — large titles, generous line-height, real hierarchy. No custom display font in v1.
- **Color:** Pick *one* warm, slightly unusual accent color — not Spotify green, not Apple Music red/pink, not YouTube red. Something like a muted amber, a deep coral, or a warm violet. The accent should feel like a private inside joke between the friend group, not a brand shout. Service colors only appear in tiny, functional contexts (chips, small icons).
- **Imagery:** Album artwork carries most of the visual weight. Treat it as such — generous corner radius, soft shadow, never cropped awkwardly. When artwork is missing, fall back to a tasteful generated tile (initials of artist + accent gradient), not a generic music note.
- **Motion:** Subtle. Spring-easing on sheet presentations, a gentle fade-in for newly-arrived tracks. No bouncy, no confetti, no Lottie celebrations.
- **Density:** Comfortable, not packed. This is an app for ~8 people sharing ~50 tracks at a time, not a 10,000-track library browser. Err on the side of breathable spacing.

## 7. References to lean toward and away from

- **Toward:** iMessage's intimate-feed feel; Find My Friends' "small group, warm color, no chrome" aesthetic; Things 3's typographic restraint; Marco Arment's Overcast in its respect for native iOS conventions; Letterboxd's "personal, social, but not a network" tone.
- **Away from:** Spotify's marketing-heavy home screen; Apple Music's editorial-first browse; TikTok's aggressive engagement loops; any UI that looks like it's trying to grow virally; any playlist app with a "trending" tab.

## 8. Specific anti-patterns to avoid

- Don't design a "discover" tab. There is no discovery in v1 and probably never.
- Don't design social-network artifacts: no like counts, no comment threads, no follow buttons, no notification badges that reward engagement.
- Don't centralize a service brand. If a Spotify user opens the app and feels like they're inside Spotify, the app has failed at being cross-tribal.
- Don't show empty states with "Pro tip!" or growth copy. Friends don't need to be onboarded by a coach.
- Don't use a generic "AI-app aesthetic" — no purple gradients, no glassy translucent everything, no oversized rounded corners on every surface, no "vibe" without function.

## 9. Deliverables expected

For each of the screens listed in section 4, produce: a high-fidelity mockup at iPhone 15 Pro dimensions (393×852 pt), in both dark and light mode, with realistic content (real-feeling track names, real-feeling friend names, real-feeling timestamps — not "Song Title 1" and "User A"). Plus:

- A small **design system extract**: color tokens, type scale, spacing scale, the 3 or 4 core component recipes (track row, playlist card, mirror chip, service indicator).
- One **motion note**: how a freshly-added track lands in the playlist when the user pulls to refresh.
- One **edge-case row**: a track that's still resolving from Songlink (loading shimmer, but not anxiety-inducing).

## 10. Out of scope for this design pass

- Marketing site, App Store screenshots, app icon (separate exercise).
- Apple Watch, iPad, web responsive — iPhone only for v0/v1.
- Any screen related to v2 features: Realtime live updates, comments, reactions, multi-tenant playlists.
- Settings beyond what's needed to demonstrate sign-out and account deletion.
