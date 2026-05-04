create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  invite_token text not null unique default encode(gen_random_bytes(16), 'base64url'),
  created_at timestamptz not null default now()
);

create table public.playlist_members (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (playlist_id, user_id)
);

create index playlist_members_user_idx on public.playlist_members(user_id);

create function public.is_playlist_member(p_playlist_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.playlist_members
    where playlist_id = p_playlist_id and user_id = p_user_id
  );
$$;

alter table public.playlists enable row level security;
alter table public.playlist_members enable row level security;

create policy "members read playlist"
  on public.playlists for select
  using (public.is_playlist_member(id, auth.uid()));

create policy "members update playlist"
  on public.playlists for update
  using (public.is_playlist_member(id, auth.uid()))
  with check (public.is_playlist_member(id, auth.uid()));

create policy "members read membership"
  on public.playlist_members for select
  using (public.is_playlist_member(playlist_id, auth.uid()));

create policy "members can leave (delete own membership)"
  on public.playlist_members for delete
  using (user_id = auth.uid());

-- INSERT into playlists is performed via RPC (Task 9), which runs as security definer.
-- No client-side INSERT policy on playlists.
