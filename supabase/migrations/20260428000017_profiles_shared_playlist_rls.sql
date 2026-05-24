-- Widen profile read access so members of the same playlist can see each
-- other. The original policy from 20260428000001_profiles.sql restricted
-- SELECT to `auth.uid() = id`, which made the playlist members list show
-- `profiles: null` for everyone except the viewer themselves.
--
-- New rule: a user can read profile X if (a) it's their own, OR (b) they
-- share at least one playlist with X. Same set of users you'd already see
-- via playlist_members — just letting their profile come along for the ride.

drop policy "users read own profile" on public.profiles;

create policy "users read profiles in shared playlists"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.playlist_members pm
      where pm.user_id = profiles.id
        and pm.playlist_id in (
          select playlist_id from public.playlist_members
          where user_id = auth.uid()
        )
    )
  );
