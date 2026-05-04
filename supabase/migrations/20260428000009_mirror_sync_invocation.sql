-- Update the playlist_tracks change trigger to also POST to the mirror-sync
-- Edge Function via pg_net. The pg_notify call is preserved for any future
-- LISTEN-style consumer.
--
-- Two GUCs need to be set on the database (one-time, via SQL editor on the
-- remote project) for the HTTP webhook to fire:
--   alter database postgres set app.mirror_sync_url to 'https://<ref>.supabase.co/functions/v1/mirror-sync';
--   alter database postgres set app.service_role_key to '<service-role-key>';

create extension if not exists pg_net;

create or replace function public.notify_playlist_track_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  payload jsonb;
  fn_url text := current_setting('app.mirror_sync_url', true);
  service_key text := current_setting('app.service_role_key', true);
begin
  if tg_op = 'INSERT' then
    payload := jsonb_build_object(
      'op', 'insert',
      'playlist_track_id', new.id,
      'playlist_id', new.playlist_id,
      'track_id', new.track_id,
      'added_by', new.added_by
    );
  elsif tg_op = 'DELETE' then
    payload := jsonb_build_object(
      'op', 'delete',
      'playlist_track_id', old.id,
      'playlist_id', old.playlist_id,
      'track_id', old.track_id
    );
  end if;

  perform pg_notify('playlist_track_changes', payload::text);

  if fn_url is not null and service_key is not null then
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_key,
        'Content-Type',  'application/json'
      ),
      body := payload
    );
  end if;

  return coalesce(new, old);
end;
$$;
