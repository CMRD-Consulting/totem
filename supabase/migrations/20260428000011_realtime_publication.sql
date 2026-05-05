-- Opt playlist_tracks into the Realtime publication so client subscriptions
-- receive INSERT/UPDATE/DELETE events. RLS on the table still applies — only
-- members of a playlist will receive events for it.

alter publication supabase_realtime add table public.playlist_tracks;
