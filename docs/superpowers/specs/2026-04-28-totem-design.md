# Totem — Design Spec

**Date:** 2026-04-28
**Status:** Approved (brainstorm) → ready for implementation planning
**Project:** `~/www/cmrd/apps/totem`

## Table of Contents

- [What is Totem?](#what-is-totem)
- [Product decisions (settled in brainstorm)](#product-decisions-settled-in-brainstorm)
- [1. Architecture Overview](#1-architecture-overview)
  - [Components](#components)
  - [Why this shape works](#why-this-shape-works)
- [2. Data Model](#2-data-model)
  - [Tables](#tables)
  - [Key design choices](#key-design-choices)
  - [RLS philosophy](#rls-philosophy)
  - [Deliberately not in v1](#deliberately-not-in-v1)
- [3. Key Flows](#3-key-flows)
  - [Flow A — Sign-in](#flow-a--sign-in)
  - [Flow B — Create playlist + share invite](#flow-b--create-playlist--share-invite)
  - [Flow C — Join via invite](#flow-c--join-via-invite)
  - [Flow D — Share-sheet ingestion (the interesting one)](#flow-d--share-sheet-ingestion-the-interesting-one)
  - [Flow E — Connect service for mirroring (OAuth)](#flow-e--connect-service-for-mirroring-oauth)
  - [Flow F — Mirror sync](#flow-f--mirror-sync)
  - [Flow G — Push notifications](#flow-g--push-notifications)
- [4. Error Handling & Edge Cases](#4-error-handling--edge-cases)
  - [External API failures](#external-api-failures)
  - [Auth / token failures](#auth--token-failures)
  - [Concurrency](#concurrency)
  - [Track not available on a mirror's service](#track-not-available-on-a-mirrors-service)
  - [Client-side / iOS](#client-side--ios)
  - [User lifecycle](#user-lifecycle)
- [5. Testing Strategy](#5-testing-strategy)
  - [Layer 1 — RLS policies (security-critical, fully automated)](#layer-1--rls-policies-security-critical-fully-automated)
  - [Layer 2 — Edge Functions (Deno test, mocked externals)](#layer-2--edge-functions-deno-test-mocked-externals)
  - [Layer 3 — Service contract tests (separate CI lane, runs nightly)](#layer-3--service-contract-tests-separate-ci-lane-runs-nightly)
  - [Layer 4 — Client unit tests (Vitest)](#layer-4--client-unit-tests-vitest)
  - [Layer 5 — End-to-end (Playwright on PWA build)](#layer-5--end-to-end-playwright-on-pwa-build)
  - [Layer 6 — iOS-only manual gates](#layer-6--ios-only-manual-gates)
  - [TDD posture](#tdd-posture)
  - [Deliberately not tested](#deliberately-not-tested)
- [6. Phased Rollout](#6-phased-rollout)
- [7. Open Questions (parking lot)](#7-open-questions-parking-lot)

## What is Totem?

Totem is an iOS app that lets a small group of friends co-curate music playlists together, even when each friend uses a different music service (Spotify, Apple Music, YouTube Music). Friends share a single private playlist via an invite link; anyone in the playlist can add tracks by sharing them from their native music app via the iOS share sheet. Optionally, each user can mirror the shared playlist into their own service so it shows up natively in Spotify / Apple Music / YouTube Music and plays as a continuous playlist there.

Totem itself is intentionally not a music player — playback is always handled by deep-linking out to the native music app. Totem is a **shared metadata layer + cross-service translator** sitting on top of whatever services the friend group already uses.

## Product decisions (settled in brainstorm)

| Decision | Choice |
|---|---|
| Central activity | Co-curate playlists together (multi-contributor, like a shared Google Doc) |
| Playback | Deep-link to native music apps — Totem is not a player |
| Mirroring | Optional, opt-in per user per service. Default: app-only, no native mirror |
| Track addition | iOS share-sheet ingestion via a native Share Extension |
| Access model | Private invite-link only — no friend graph, no profiles, no discovery |
| Permissions within a playlist | Flat — every member can add, remove, reorder anything |
| Sync behavior | Pull-to-refresh + push notifications. No live socket layer in v1 |
| Day-1 services | Spotify, Apple Music, YouTube Music (ingest + mirror for all three) |
| Track resolution | Songlink/Odesli (api.song.link) — no in-house catalog |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| Client | Ionic + Capacitor + Vue |

---

## 1. Architecture Overview

```
┌──────────────────────────────────────┐         ┌─────────────────────┐
│  iOS App (Ionic + Capacitor + Vue)   │         │   Songlink/Odesli   │
│  ┌─────────────────┐ ┌─────────────┐ │         │   (api.song.link)   │
│  │   Main App      │ │   Share     │ │         └──────────▲──────────┘
│  │   (WebView UI)  │ │   Extension │ │                    │
│  └────────┬────────┘ └──────┬──────┘ │                    │
│           │   App Group     │        │                    │ resolve URL
│           └────────┬────────┘        │                    │ → canonical
└────────────────────┼─────────────────┘                    │
                     │ HTTPS / JWT                          │
                     ▼                                      │
┌────────────────────────────────────────────────┐          │
│                    Supabase                     │          │
│  ┌───────────┐  ┌──────────┐  ┌─────────────┐  │          │
│  │ Postgres  │  │   Auth   │  │    Edge     │──┼──────────┘
│  │  + RLS    │  │ (Apple)  │  │  Functions  │  │
│  └─────┬─────┘  └──────────┘  └──────┬──────┘  │
└────────┼─────────────────────────────┼─────────┘
         │ trigger on insert            │
         │                              ├──► Spotify Web API
         │                              ├──► Apple Music API
         │                              └──► YouTube Data API
         │
         └──► APNs (push) — via Edge Function
```

### Components

- **iOS App (Ionic + Capacitor + Vue)** — single Capacitor project housing two iOS targets: the main app (a Vue SPA running in a WebView) and a Share Extension (small native Swift target that receives URLs from other apps' share sheets and writes them to a shared App Group container, then opens the main app or queues for next launch).
- **Supabase** — managed Postgres + Auth + Edge Functions. Row-level security (RLS) enforces "user must be a member of playlist" on every query; no separate authorization layer is needed in app-server code.
- **Edge Functions** — short-lived Deno functions for operations Postgres can't do directly: calling Songlink to resolve a URL, holding service OAuth flows, executing mirror sync against Spotify / Apple Music / YouTube Music, sending APNs pushes.
- **Songlink/Odesli** — third-party track-resolution API. Free for low volume, paid above. Single source of truth for cross-service catalog mapping; Totem never maintains its own catalog.
- **Native music services** — Spotify, Apple Music, YouTube Music. Totem talks to them only through Edge Functions for mirroring writes. Playback is always via deep-link from the client.

### Why this shape works

- Authorization lives entirely in Postgres RLS — one rule (`is_playlist_member()`) covers nearly every access check.
- Mirror sync runs server-side (Edge Functions) so a token revoked on one device doesn't break sync from another.
- Songlink absorbs the entire cross-service catalog problem.
- Push notifications fire from a Postgres trigger → Edge Function on `playlist_tracks` insert, so they reflect actual writes regardless of how a track was added.

---

## 2. Data Model

```
auth.users (Supabase managed)
    └── profiles (1:1)
            ├── playlist_members ─── playlists ─── playlist_tracks ─── tracks
            ├── service_connections (one per user per service)
            ├── mirror_targets (per user, per playlist, per service)
            └── device_tokens
```

### Tables

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | Display name, avatar; 1:1 with `auth.users` | `id`, `display_name` |
| `playlists` | Playlist metadata + invite token | `id`, `name`, `description`, `created_by`, `invite_token` (rotatable) |
| `playlist_members` | Membership (flat, no roles) | `(playlist_id, user_id)` PK, `joined_at` |
| `tracks` | **Canonical** track — resolved via Songlink at add-time | `id`, `isrc`, `title`, `artist`, `album`, `artwork_url`, `spotify_id`, `apple_music_id`, `youtube_music_id`, `songlink_url` |
| `playlist_tracks` | Items in a playlist | `(playlist_id, track_id, id)`, `added_by`, `added_at`, `position` (sparse float for cheap reorders) |
| `service_connections` | OAuth tokens for mirroring | `(user_id, service)` UNIQUE, `access_token` (encrypted via pgsodium), `refresh_token`, `expires_at` |
| `mirror_targets` | "Mirror playlist X to my service Y" | `(user_id, playlist_id, service)` UNIQUE, `native_playlist_id`, `last_synced_at`, `last_sync_error` |
| `device_tokens` | APNs tokens per device | `user_id`, `apns_token` |
| `mirror_track_errors` | Per-track mirror failures, surfaced in UI | `mirror_target_id`, `track_id`, `error_type` |

### Key design choices

1. **`tracks` is global, not per-playlist.** Two playlists referencing "Blue Monday" use the same row. On a new URL share, the Edge Function asks Songlink, then upserts by ISRC (or by service-id match if no ISRC). One canonical record, multiple service IDs on it.
2. **`position` is a sparse float**, not an integer. To insert track A between B (pos=2.0) and C (pos=3.0), set A.pos=2.5. No re-numbering pass on insert. A periodic renormalize job runs if positions get too tightly packed.
3. **`invite_token` is rotatable per-playlist** (single token, not per-invite). Simple v1: if compromised, owner rotates. No per-link revocation in v1.
4. **OAuth tokens are encrypted at rest** via Supabase's pgsodium extension — RLS alone doesn't protect against a compromised service-role key.
5. **`mirror_track_errors`** lets the UI show "1 track couldn't be added to your Spotify playlist" instead of failing silently.

### RLS philosophy

One helper function — `is_playlist_member(playlist_id, auth.uid())` — drives almost every RLS policy:

- `playlists`: SELECT/UPDATE allowed if member; INSERT requires the inserting user to also be added to `playlist_members` in the same transaction (RPC).
- `playlist_tracks`: ALL operations allowed if member of the parent playlist (flat permissions).
- `service_connections`, `mirror_targets`, `device_tokens`: only the owning user.
- `tracks`: SELECT to all authenticated; INSERT/UPDATE only via service-role (Edge Functions, never client).

### Deliberately not in v1

- No comments / reactions table
- No "now playing" / live-listening table
- No friend-graph or follower tables
- No public/discoverable playlists

---

## 3. Key Flows

### Flow A — Sign-in

1. Tap "Sign in with Apple" → Capacitor's SiwA plugin returns identity token.
2. Client calls `supabase.auth.signInWithIdToken({ provider: 'apple', token })`.
3. Supabase Auth creates row in `auth.users`. Trigger creates `profiles` row using the name from Apple's identity token (only available on first sign-in — must capture it).
4. Client stores the Supabase JWT; subsequent requests are RLS-authenticated.

### Flow B — Create playlist + share invite

1. User taps "+" → enters name → client calls RPC `create_playlist(name, description)`.
2. RPC inserts row in `playlists` (with random `invite_token`) and adds creator to `playlist_members` in one transaction.
3. Client renders share sheet with URL: `https://app.totem.example/i/<invite_token>` (Universal Link → opens app).

### Flow C — Join via invite

1. User taps invite URL → iOS Universal Link opens app at `/i/<token>`.
2. Client calls RPC `join_playlist_by_token(token)`. RPC validates token, inserts `playlist_members` row, returns playlist details.
3. UI navigates to the playlist screen.

### Flow D — Share-sheet ingestion (the interesting one)

```
User in Spotify ──► iOS Share Sheet ──► "Add to Totem"
                                             │
                                             ▼
                                   Share Extension (Swift)
                                             │ writes URL + playlist_id
                                             ▼
                                   App Group container
                                             │ (also wakes main app silently
                                             │  via Background Tasks if possible,
                                             │  otherwise queues for next open)
                                             ▼
                                   Main app reads queue
                                             │
                                             ▼
                          POST /functions/v1/ingest-track
                                  { url, playlist_id }
                                             │
                                             ▼
                           Edge Function (server-side):
                             1. Validate user is member of playlist (RLS)
                             2. Songlink lookup → canonical track + all service IDs
                             3. UPSERT into `tracks` by ISRC (or service-id fallback)
                             4. INSERT into `playlist_tracks` with position = max+1
                             5. Trigger fires → push notifications + mirror sync
```

**Subtleties:**

- The Share Extension is a separate process. It *could* call the Edge Function directly. We don't, because (a) it can't render UI to pick *which* playlist beyond a tiny native list, and (b) we want all sync to happen with the user's authenticated session in the main app. So the extension just queues; the main app drains.
- If the user has only one playlist, the extension can pre-select it. Otherwise the extension renders a minimal native list (Swift, not WebView).
- Songlink occasionally fails or rate-limits. On failure, we still create a `tracks` row with just the original service ID + URL; resolution can be retried later by a cron job.

### Flow E — Connect service for mirroring (OAuth)

1. User opens a playlist → "Mirror this to my Spotify" → app opens an in-app browser to `/functions/v1/oauth-start?service=spotify&playlist_id=...`.
2. Edge Function generates state, redirects to Spotify's OAuth consent URL.
3. User consents → Spotify redirects to `/functions/v1/oauth-callback?code=...&state=...`.
4. Edge Function exchanges code → access + refresh tokens. Upserts `service_connections` (encrypted via pgsodium).
5. Same Edge Function creates a new playlist on Spotify (using the access token), gets back the native playlist ID, and inserts into `mirror_targets`.
6. Triggers a backfill: enqueue all current `playlist_tracks` for sync.
7. Closes browser, returns user to playlist screen.

### Flow F — Mirror sync

Triggered on `playlist_tracks` insert/delete. A Postgres trigger calls `pg_notify`; an Edge Function listens and processes:

```
For each (playlist_id, change):
  Find all mirror_targets WHERE playlist_id = X AND enabled = true
  For each target:
    Refresh OAuth token if expired
    On insert:
      service_track_id = track.<service>_id  // already on canonical record
      if null:
        record mirror_track_errors row, skip
      else:
        call service.add_to_playlist(target.native_playlist_id, service_track_id)
    On delete:
      call service.remove_from_playlist(target.native_playlist_id, service_track_id)
    Update last_synced_at on success, last_sync_error on failure
```

Failures are non-fatal — the user's app keeps working; the mirror falls behind and surfaces a warning badge.

### Flow G — Push notifications

Same trigger as mirror sync. For an insert:

- Find all `playlist_members` for the playlist except the actor.
- Look up their `device_tokens`.
- Edge Function POSTs to APNs: "Bob added 'Blue Monday' to Late Night Vibes."

---

## 4. Error Handling & Edge Cases

The interesting failures aren't crashes — they're partial successes that need graceful degradation.

### External API failures

| What fails | Behavior |
|---|---|
| **Songlink unavailable / rate-limited** | Edge Function still creates the `tracks` row using the source service's ID + URL only. A nightly cron job re-attempts resolution for tracks with missing sibling-service IDs. The track is usable in-app immediately (deep-link to source service works); cross-service mirrors degrade until resolution completes. |
| **Spotify / Apple Music / YouTube write failure** | Logged in `mirror_track_errors` (per-track) or `mirror_targets.last_sync_error` (per-target). UI shows a warning badge on the playlist. Sync retries with exponential backoff (15min → 1hr → 6hr). After 3 days, surfaces "your Spotify mirror is broken — reconnect?" prompt. |
| **APNs delivery failure** | APNs gives back a token-status code. On `Unregistered` (user uninstalled or revoked), delete the `device_tokens` row. On transient failures, retry once. No user-facing UI. |

### Auth / token failures

- **OAuth refresh token revoked** (user deauthorized in service settings): mirror sync hits 401 → mark `service_connections.expires_at = null` and `mirror_targets.last_sync_error = 'reauth_required'`. UI shows reconnect prompt. Other playlists' mirrors for the same user-service pair all fail simultaneously — one prompt, not N.
- **Apple Music developer token rotation**: the server-side MusicKit token is rotated in Edge Function env; clients fetch a per-session user token via Apple's flow. Rotation is invisible to users.
- **Supabase session expiry**: standard JWT refresh; client falls back to re-auth if refresh fails.

### Concurrency

- **Sparse `position` collision**: if two users insert at the same slot simultaneously, both write the same float. Resolved by a periodic renormalize pass that re-spaces positions to evenly-distributed integers when collisions or excessive density (~< 1e-6 gap) are detected. UI sort tiebreaker is `added_at` so visual ordering stays stable.
- **Concurrent add/remove**: flat permissions means no coordination needed. Last write wins. If user A removes a track while user B is mirroring it server-side, the mirror op completes with the now-removed track in B's mirror; the next sync cycle removes it cleanly.
- **Same track added twice**: allowed. Two `playlist_tracks` rows pointing at the same `track_id` is legal (matches Spotify/Apple Music behavior — playlists can have duplicates). UI shows them as separate entries with different `added_by` / `added_at`.

### Track not available on a mirror's service

- Songlink-resolved track has e.g. `spotify_id = null`. When mirroring to Spotify, sync skips the track and writes a `mirror_track_errors` row.
- Playlist UI shows a small "not on Spotify" badge on the track for users mirroring to Spotify. Deep-link play still works (opens the source service).

### Client-side / iOS

- **Share Extension memory limit (~120MB)**: extension does no Songlink call, no image processing — just writes URL + chosen `playlist_id` to App Group, then exits. All heavy work is in the main app.
- **Share Extension can't reach network** (rare; corp Wi-Fi quirks): URL is queued in App Group; main app drains queue on next launch.
- **Universal Link tapped but app not installed**: `https://app.totem.example/i/<token>` resolves to a small web page with App Store download CTA + "After installing, tap the invite again." Token survives because it's still in the URL.
- **Push permission denied**: app falls back to in-app unread badge per playlist (`last_seen_at` per `playlist_members` row vs `playlist_tracks.added_at`).

### User lifecycle

- **Leaving a playlist with a mirror enabled**: server deletes `playlist_members` row + `mirror_targets` row. For v1, the native mirror playlist on the user's service is left intact ("frozen snapshot") — user can manually delete it on their service if they want.
- **Account deletion**: cascade `playlist_members` rows. Playlists where deleted user was the last member are also deleted. `tracks` are global and never deleted by user action. OAuth refresh tokens are deleted; native mirror playlists are left alone.

---

## 5. Testing Strategy

The test stack mirrors the architecture layers. Some things are cheap to test exhaustively; some are expensive and get manual gates instead.

### Layer 1 — RLS policies (security-critical, fully automated)

Every RLS policy gets a pgTAP test asserting both the positive ("Alice can read playlists she's a member of") and negative ("Alice cannot read playlists she isn't a member of") case. These run in CI against a Dockerized Postgres + Supabase image.

Why first-class: an RLS bug here is a privacy breach, not a functional bug. Worth 100% coverage.

### Layer 2 — Edge Functions (Deno test, mocked externals)

Each function gets a unit test suite using `deno test`:

- **`ingest-track`**: feed it various URL shapes (Spotify, Apple Music, YouTube Music, malformed), assert correct `tracks` UPSERT and `playlist_tracks` insert. Songlink mocked with recorded fixtures.
- **`oauth-callback`**: feed mock OAuth responses, assert `service_connections` row created with encrypted tokens.
- **`mirror-sync`**: feed mock service responses (success, 401 reauth, 404 track-not-found, 429 rate-limit), assert correct DB updates + retry behavior.
- **`push-notify`**: assert correct APNs payload + that the actor is excluded from the recipient list.

External APIs are always mocked here — the unit tests must run offline in CI.

### Layer 3 — Service contract tests (separate CI lane, runs nightly)

A small suite hits the *real* Songlink, Spotify sandbox, and (where possible) Apple Music sandbox to detect API drift. Failures don't block PRs but page if they break overnight. This is the "did the vendor change something" canary.

### Layer 4 — Client unit tests (Vitest)

Vue components + Pinia stores tested with mocked Supabase client. Focus on logic-heavy code (composables for queue draining, position calculations, mirror status display) — not on snapshot tests for UI.

### Layer 5 — End-to-end (Playwright on PWA build)

Happy paths only — no exhaustive matrix:

1. Sign in → create playlist → invite link generated.
2. Second user joins via link → sees playlist.
3. Add track via simulated URL POST → both users see it after refresh.
4. Connect mirror → mock service responds → mirror status shows green.

Run against a disposable Supabase project. ~5-minute total budget.

### Layer 6 — iOS-only manual gates

Things not feasible to test in CI but executed before each TestFlight build:

- Share Extension on real device: share from Spotify, Apple Music, YouTube Music apps; verify track appears.
- Universal Link tapped from Messages, Mail, Safari with app installed and uninstalled.
- Push notification received with app foregrounded / backgrounded / killed.
- Sign in with Apple flow (sandbox + production).
- Mirror flow against the developer's real Spotify / Apple Music / YouTube accounts.

### TDD posture

Edge Functions and RLS policies are written test-first — the contracts are crisp and the test cost is low. Client UI is written code-first with tests added for non-trivial logic. Native Share Extension is small enough that XCTest is overhead; covered by the manual gate.

### Deliberately not tested

- Cross-service mirror correctness over weeks of real usage — that's a beta cohort thing, not a CI thing.
- Songlink response stability for obscure tracks — captured as anecdotes if reported.
- iOS version compatibility beyond the deployment target — assume current iOS only for v1.

---

## 6. Phased Rollout

| Phase | Goal | Scope |
|---|---|---|
| **v0 — Internal demo** | Prove the matching loop works end-to-end | One service (Spotify) ingest + mirror. No Share Extension — paste-link only. No push. SiwA + create/join playlist. Two testers can co-curate. |
| **v1 — TestFlight** | Shippable MVP | All 3 services for ingest + mirror. Share Extension. Push notifications. Pull-to-refresh. Mirror error surfacing. RLS audit. |
| **v1.1 — App Store launch** | Polish to "I'd recommend it to a friend" | Notification grouping, artwork, reorder gestures, "leave playlist" UX, account deletion flow, privacy nutrition labels, in-app rate prompt. |
| **v2 — Optional upgrades** | When data tells you what's needed | Supabase Realtime live updates, web PWA build, Tidal / Deezer / Amazon Music ingest, mirror-on-create option, per-invite revocable tokens. |

Splitting v0 from v1 matters: v0 lets us see whether the catalog/matching/mirror loop is *actually useful in practice* before investing in the Share Extension's native code.

---

## 7. Open Questions (parking lot)

These don't block the spec but need answers before / during implementation:

1. **Universal Link domain** — need a domain you control with `apple-app-site-association` hosted at the root. Suggest `totem.cmrd.dev` or similar.
2. **Songlink pricing tier** — free tier is ~10 req/sec; if exceeded, paid plan (~$50/mo) or self-host their open-source resolver.
3. **Apple Developer Program enrollment** — required for Sign in with Apple, MusicKit, Push notifications, App Store. ($99/yr.)
4. **Supabase region** — pick one close to the friend group; affects latency for Edge Functions.
5. **Analytics & crash reporting** — PostHog + Sentry is the pragmatic default; or skip both for v0.
6. **Privacy policy + nutrition labels** — required for App Store submission. Data collected: email/name via SiwA-relay-or-real, OAuth tokens for connected services, playlist content.
7. **App icon + visual design language** — out of scope for the brainstorm; a separate design pass.
8. **Branding around the name "Totem"** — bundle ID (suggest `dev.cmrd.totem`), App Group identifier (`group.dev.cmrd.totem`), App Store listing copy.
