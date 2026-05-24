-- Trigger: fire backfill-mirror-target whenever a new mirror_target is
-- inserted. The function reads every existing playlist_track for the target's
-- playlist and pushes the ones with a Spotify id into the native playlist on
-- the user's account.
--
-- Closes v0 limitation #4: previously, mirroring a playlist after tracks
-- already existed left those tracks orphaned on Totem — only future inserts
-- propagated. Now connecting mirror to an already-populated playlist
-- backfills the existing songs as a one-shot at target-creation time.
--
-- Requires one new GUC on the database:
--   alter database postgres
--     set app.backfill_mirror_target_url to
--       'https://<ref>.supabase.co/functions/v1/backfill-mirror-target';
-- (app.service_role_key is already set by the mirror-sync migration.)
--
-- Skips silently if the GUC isn't set so local dev doesn't break — pg_net
-- would otherwise raise on a null URL.

create or replace function public.invoke_backfill_mirror_target()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  fn_url text := current_setting('app.backfill_mirror_target_url', true);
  service_key text := current_setting('app.service_role_key', true);
  payload jsonb;
begin
  if fn_url is null or service_key is null then
    return new;
  end if;

  payload := jsonb_build_object(
    'mirror_target_id',   new.id,
    'user_id',            new.user_id,
    'playlist_id',        new.playlist_id,
    'native_playlist_id', new.native_playlist_id,
    'service',            new.service
  );

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_key,
      'Content-Type',  'application/json'
    ),
    body := payload
  );

  return new;
end;
$$;

create trigger on_mirror_target_inserted
after insert on public.mirror_targets
for each row execute function public.invoke_backfill_mirror_target();
