-- A user's preferred listening service. Drives:
--   • the "not on your service" badge on TrackRow
--   • the default service tile selection on Mirror settings
--   • which service URL we send the user to when they tap a track
--
-- Default 'spotify' is conservative — Spotify mirroring is the only path
-- v0 actually supports end-to-end. Settings page lets users pick freely.

alter table public.profiles
  add column preferred_service public.music_service not null default 'spotify';
