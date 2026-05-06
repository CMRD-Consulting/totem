-- Update the playlist_tracks change trigger to also POST to the send-push
-- Edge Function via pg_net, alongside the existing mirror-sync call.
--
-- One additional GUC needs to be set on the database (one-time, via SQL editor):
--   alter database postgres set app.send_push_url to 'https://<ref>.supabase.co/functions/v1/send-push';
--
-- The existing app.service_role_key GUC is reused for auth.

create or replace function public.notify_playlist_track_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  payload jsonb;
  mirror_url text := current_setting('app.mirror_sync_url', true);
  push_url text := current_setting('app.send_push_url', true);
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

  if service_key is not null then
    if mirror_url is not null then
      perform net.http_post(
        url := mirror_url,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || service_key,
          'Content-Type',  'application/json'
        ),
        body := payload
      );
    end if;
    if push_url is not null then
      perform net.http_post(
        url := push_url,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || service_key,
          'Content-Type',  'application/json'
        ),
        body := payload
      );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;
