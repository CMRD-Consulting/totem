-- preview_invite — resolve an invite token to a playlist's public-facing
-- display data WITHOUT consuming the invite or adding the caller to
-- playlist_members. Used by JoinPage to show a confirmation screen before
-- the user commits to joining.
--
-- security definer because the caller isn't yet a member, so RLS on
-- playlists/playlist_members would otherwise reject them. The token is the
-- access credential — possessing it is implicit authorization to see the
-- preview. We deliberately do NOT return tokens, member identities, or
-- anything else sensitive from this function.

create function public.preview_invite(p_token text)
returns table (
  playlist_id uuid,
  name text,
  member_count integer,
  already_member boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_playlist_id uuid;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select pl.id, pl.name into v_playlist_id, v_name
  from public.playlists pl
  where pl.invite_token = p_token;

  if v_playlist_id is null then
    raise exception 'invalid invite token' using errcode = '22023';
  end if;

  return query
    select
      v_playlist_id,
      v_name,
      (
        select count(*)::integer
        from public.playlist_members pm
        where pm.playlist_id = v_playlist_id
      ),
      exists (
        select 1
        from public.playlist_members pm
        where pm.playlist_id = v_playlist_id and pm.user_id = v_user_id
      );
end;
$$;

grant execute on function public.preview_invite(text) to authenticated;
