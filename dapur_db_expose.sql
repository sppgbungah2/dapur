-- Run this in the Supabase Cloud SQL Editor for the Dapur project.
-- This does not copy or move data. It makes the existing dapur_db schema
-- available to PostgREST and grants the API roles access to existing tables.

create schema if not exists dapur_db;

grant usage on schema dapur_db to anon, authenticated;
grant select, insert, update, delete on all tables in schema dapur_db to anon, authenticated;
grant usage, select, update on all sequences in schema dapur_db to anon, authenticated;

alter default privileges in schema dapur_db
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema dapur_db
  grant usage, select, update on sequences to anon, authenticated;

-- Read-only verification of tables currently present in dapur_db.
select table_schema, table_name
from information_schema.tables
where table_schema = 'dapur_db'
  and table_type = 'BASE TABLE'
order by table_name;

-- Enable the two tables currently used by the app's realtime listener.
do $$
begin
  if to_regclass('dapur_db.sops') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'dapur_db'
         and tablename = 'sops'
     ) then
    alter publication supabase_realtime add table dapur_db.sops;
  end if;

  if to_regclass('dapur_db.day_menus') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'dapur_db'
         and tablename = 'day_menus'
     ) then
    alter publication supabase_realtime add table dapur_db.day_menus;
  end if;
end $$;
