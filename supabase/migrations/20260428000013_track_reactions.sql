-- track_reactions: per-(track-in-playlist, user, emoji) row.
--
-- Composite primary key (playlist_track_id, user_id, emoji) means:
--   • toggling a reaction is a single insert-on-conflict or delete; no
--     read-then-decide round-trip
--   • the same user can react with multiple emoji on the same track
--   • two clients racing to add the same emoji can't double-insert
--
-- RLS: reactions are visible to anyone who can see the underlying
-- playlist_track (i.e., members of the playlist). Insert + delete are
-- self-only — you can only react/un-react as yourself.

create table public.track_reactions (
  playlist_track_id uuid not null
    references public.playlist_tracks(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (playlist_track_id, user_id, emoji)
);

create index track_reactions_playlist_track_idx
  on public.track_reactions(playlist_track_id);

alter table public.track_reactions enable row level security;

create policy "members read reactions"
  on public.track_reactions for select
  using (
    exists (
      select 1 from public.playlist_tracks pt
      where pt.id = track_reactions.playlist_track_id
        and public.is_playlist_member(pt.playlist_id, auth.uid())
    )
  );

create policy "members react as themselves"
  on public.track_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.playlist_tracks pt
      where pt.id = track_reactions.playlist_track_id
        and public.is_playlist_member(pt.playlist_id, auth.uid())
    )
  );

create policy "users delete own reactions"
  on public.track_reactions for delete
  using (user_id = auth.uid());

-- Add to Realtime publication so reactions land live for other members.
alter publication supabase_realtime add table public.track_reactions;
