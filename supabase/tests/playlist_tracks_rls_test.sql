begin;
select plan(4);

-- Setup
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com');

set local role service_role;
insert into public.playlists (id, name, created_by, invite_token)
values ('00000000-0000-0000-0000-000000000010', 'P1',
        '00000000-0000-0000-0000-000000000001', 'tok');
insert into public.playlist_members (playlist_id, user_id) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001');
insert into public.tracks (id, title, artist) values
  ('00000000-0000-0000-0000-000000000020', 'Blue Monday', 'New Order');

-- Member can INSERT
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into public.playlist_tracks (playlist_id, track_id, added_by, position)
values ('00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000020',
        '00000000-0000-0000-0000-000000000001',
        1.0);

select is(
  (select count(*) from public.playlist_tracks where playlist_id = '00000000-0000-0000-0000-000000000010'),
  1::bigint,
  'member can INSERT playlist_track'
);

-- Member can SELECT
select is(
  (select position from public.playlist_tracks where playlist_id = '00000000-0000-0000-0000-000000000010'),
  1.0::double precision,
  'member can SELECT playlist_track'
);

-- Non-member cannot SELECT
reset role; reset request.jwt.claim.sub;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select is(
  (select count(*) from public.playlist_tracks where playlist_id = '00000000-0000-0000-0000-000000000010'),
  0::bigint,
  'non-member cannot SELECT playlist_track'
);

-- Non-member cannot INSERT (added_by must match auth.uid; even if forged, RLS check fails)
select throws_ok(
  $sql$ insert into public.playlist_tracks (playlist_id, track_id, added_by, position)
        values ('00000000-0000-0000-0000-000000000010',
                '00000000-0000-0000-0000-000000000020',
                '00000000-0000-0000-0000-000000000002',
                2.0) $sql$,
  '42501',
  null,
  'non-member cannot INSERT playlist_track'
);

select * from finish();
rollback;
