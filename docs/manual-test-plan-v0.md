# Totem v0 — Manual Test Plan

Run before each TestFlight build. Two real iOS devices required (Alice + Bob),
both with Spotify Premium accounts, both signed in to different Apple IDs.

## Table of Contents

- [A. Auth](#a-auth)
- [B. Create + Invite](#b-create--invite)
- [C. Join](#c-join)
- [D. Paste-link Ingest](#d-paste-link-ingest)
- [E. Spotify Mirror](#e-spotify-mirror)
- [F. Edge Cases](#f-edge-cases)

## A. Auth

1. [ ] Alice taps "Sign in with Apple" on a fresh install → consent screen
       appears → grants → lands on Hub screen with empty "your groups" list.
2. [ ] Sign out (settings icon top-left → confirm), sign back in → no consent
       screen, lands on Hub with prior data.

## B. Create + Invite

3. [ ] Alice taps "+", names a playlist "Test1", taps "create group" → lands
       on the playlist detail screen.
4. [ ] Alice taps the share icon in the action bar → invite screen shows
       a QR + a TOTEM-XXXXXX code.
5. [ ] Alice taps "share…" → iOS share sheet shows
       "Join Test1 on Totem" with URL `https://totem.cmrd.dev/i/<token>`.
6. [ ] Alice sends URL via Messages to Bob.

## C. Join

7. [ ] Bob (uninstalled) taps invite link → Safari opens placeholder page or
       App Store listing.
8. [ ] Bob installs app, taps invite link from Messages → app opens straight
       to the join flow → after Sign in with Apple, lands on Test1 detail.
9. [ ] Bob (installed, signed-in) taps a different invite from Alice → joins
       instantly without re-signing-in.

## D. Paste-link Ingest

10. [ ] Alice taps "add a song" on Test1 → paste-link sheet appears.
11. [ ] Alice pastes `https://open.spotify.com/track/1AhDOtG9vPSOmsWgNW0BEY`
        → "send to group" → "resolving…" → returns to playlist with a track
        row showing artwork, title "Blue Monday", artist "New Order",
        "added by Alice".
12. [ ] Bob pulls to refresh on Test1 → sees the same track.

## E. Spotify Mirror

13. [ ] Alice opens mirror settings (link icon in playlist action bar) → taps
        Spotify tile → in-app browser opens Spotify consent → grants →
        browser closes → tile shows "synced just now".
14. [ ] Open Spotify app → look in Library → playlist "Totem: Test1" exists.
15. [ ] Alice pastes another track in Totem → wait 30s → check Spotify
        Library playlist → second track appears.
16. [ ] Bob also connects mirror → verify Bob has his own "Totem: Test1" in
        his Spotify (different account) with the existing tracks NOT yet
        present (v0 does not backfill — known limitation).
17. [ ] Alice pastes a third track → both Alice and Bob see it appear in
        their respective Spotify mirrors within a minute.

## F. Edge Cases

18. [ ] Paste a non-URL string → "send to group" stays disabled.
19. [ ] Paste a malformed Spotify URL → error message shown in the paste sheet.
20. [ ] Force-quit app while ingest is in flight → on relaunch, check track is
        either fully there or not at all (no partial state visible).
21. [ ] Paste a track that has no Spotify ID (Apple-Music-only release) →
        track row appears in Totem but does NOT mirror to Spotify; check
        `mirror_track_errors` row in Supabase Studio shows
        `track_not_on_spotify`.
22. [ ] Tap the Apple Music or YouTube Music tile in mirror settings →
        nothing happens (disabled, "coming in v1" status).
