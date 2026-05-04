create function public.notify_playlist_track_change()
returns trigger
language plpgsql
as $$
declare
  payload jsonb;
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
  return coalesce(new, old);
end;
$$;

create trigger playlist_tracks_notify
after insert or delete on public.playlist_tracks
for each row execute function public.notify_playlist_track_change();
