begin;
select plan(3);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com');

set local role service_role;
insert into public.service_connections
  (user_id, service, access_token, refresh_token, expires_at, service_user_id)
values
  ('00000000-0000-0000-0000-000000000001', 'spotify',
   'enc-access', 'enc-refresh', now() + interval '1 hour', 'spotify-user-1');

-- Alice sees own
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select is(
  (select count(*) from public.service_connections),
  1::bigint,
  'user reads own service_connections'
);

-- Bob does not see Alice's
reset role; reset request.jwt.claim.sub;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select is(
  (select count(*) from public.service_connections),
  0::bigint,
  'user cannot read another user service_connections'
);

-- Bob cannot insert as Alice
select throws_ok(
  $sql$ insert into public.service_connections
        (user_id, service, access_token, refresh_token, expires_at, service_user_id)
        values ('00000000-0000-0000-0000-000000000001', 'spotify', 'x','y', now(), 'z') $sql$,
  '42501',
  null,
  'user cannot insert service_connections for another user'
);

select * from finish();
rollback;
