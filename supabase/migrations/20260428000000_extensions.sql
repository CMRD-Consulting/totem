-- Required extensions for Totem.
-- pgcrypto: gen_random_bytes() for invite tokens; gen_random_uuid() is a builtin in PG 13+ but pgcrypto provides it too as a safety net.
-- pg_net: net.http_post() for invoking Edge Functions from triggers (used by T14 mirror-sync invocation).
--
-- On Supabase hosted, extensions are pre-installed in the `extensions` schema, which is not
-- guaranteed to be on the migration runner's search_path within a single push session. To make
-- unqualified calls like `gen_random_bytes(16)` (used in column defaults of later migrations)
-- resolve regardless of search_path, we install/relocate pgcrypto into the `public` schema.
-- pg_net is left in its installed schema (typically `extensions`), since callers schema-qualify it
-- via `net.http_post(...)`.

create extension if not exists pgcrypto;
do $$
begin
  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname <> 'public'
  ) then
    execute 'alter extension pgcrypto set schema public';
  end if;
end $$;

create extension if not exists pg_net;
