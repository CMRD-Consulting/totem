-- Admin RPCs: rotate_invite_token and delete_playlist.
--
-- Both are creator-only and run as security definer because base-table
-- policies don't grant the underlying privileges to clients (no DELETE on
-- playlists, no UPDATE on invite_token specifically). Putting these behind
-- RPCs keeps the schema's general "members can update playlist" policy
-- permissive for things like renames without leaking destructive actions.

create function public.rotate_invite_token(p_playlist_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_creator uuid;
  v_token text := replace(
    replace(
      replace(encode(gen_random_bytes(16), 'base64'), '+', '-'),
      '/', '_'
    ),
    '=', ''
  );
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select created_by into v_creator
  from public.playlists
  where id = p_playlist_id;

  if v_creator is null then
    raise exception 'playlist not found' using errcode = '22023';
  end if;

  if v_creator <> v_user_id then
    raise exception 'only the creator can rotate the invite link' using errcode = '42501';
  end if;

  update public.playlists
  set invite_token = v_token
  where id = p_playlist_id;

  return v_token;
end;
$$;

create function public.delete_playlist(p_playlist_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_creator uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select created_by into v_creator
  from public.playlists
  where id = p_playlist_id;

  if v_creator is null then
    raise exception 'playlist not found' using errcode = '22023';
  end if;

  if v_creator <> v_user_id then
    raise exception 'only the creator can delete the playlist' using errcode = '42501';
  end if;

  -- playlist_members + playlist_tracks both cascade, so a single delete
  -- on the parent row tears down the whole subgraph cleanly.
  delete from public.playlists where id = p_playlist_id;
end;
$$;

grant execute on function public.rotate_invite_token(uuid) to authenticated;
grant execute on function public.delete_playlist(uuid) to authenticated;
