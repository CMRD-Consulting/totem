create function public.create_playlist(p_name text, p_description text default null)
returns table (id uuid, name text, invite_token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_playlist_id uuid;
  v_token text := replace(replace(replace(encode(gen_random_bytes(16), 'base64'), '+', '-'), '/', '_'), '=', '');
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.playlists (name, description, created_by, invite_token)
  values (p_name, p_description, v_user_id, v_token)
  returning playlists.id into v_playlist_id;

  insert into public.playlist_members (playlist_id, user_id)
  values (v_playlist_id, v_user_id);

  return query
    select v_playlist_id, p_name, v_token;
end;
$$;

create function public.join_playlist_by_token(p_token text)
returns table (playlist_id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_playlist record;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select pl.id, pl.name into v_playlist
  from public.playlists pl
  where pl.invite_token = p_token;

  if v_playlist.id is null then
    raise exception 'invalid invite token' using errcode = '22023';
  end if;

  insert into public.playlist_members (playlist_id, user_id)
  values (v_playlist.id, v_user_id)
  on conflict do nothing;

  return query select v_playlist.id, v_playlist.name;
end;
$$;

grant execute on function public.create_playlist(text, text) to authenticated;
grant execute on function public.join_playlist_by_token(text) to authenticated;
