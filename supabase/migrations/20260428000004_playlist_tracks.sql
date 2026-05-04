create table public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete restrict,
  added_by uuid not null references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  position double precision not null
);

create index playlist_tracks_playlist_position_idx
  on public.playlist_tracks(playlist_id, position);

alter table public.playlist_tracks enable row level security;

create policy "members read tracks"
  on public.playlist_tracks for select
  using (public.is_playlist_member(playlist_id, auth.uid()));

create policy "members insert tracks"
  on public.playlist_tracks for insert
  with check (
    public.is_playlist_member(playlist_id, auth.uid())
    and added_by = auth.uid()
  );

create policy "members delete tracks"
  on public.playlist_tracks for delete
  using (public.is_playlist_member(playlist_id, auth.uid()));

create policy "members update position"
  on public.playlist_tracks for update
  using (public.is_playlist_member(playlist_id, auth.uid()))
  with check (public.is_playlist_member(playlist_id, auth.uid()));
