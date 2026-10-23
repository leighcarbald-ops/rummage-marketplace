-- Read-only authorization audit. Run in Supabase SQL Editor.
-- Returns policy definitions and role privileges, never customer records.
-- Review output before applying any security migration.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where (schemaname = 'public' and tablename in ('profiles','items'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select table_schema, table_name, column_name, privilege_type, grantee
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('profiles','items')
  and column_name in ('is_admin','seller_approved','status','owner_id')
  and grantee in ('authenticated','anon','PUBLIC')
order by table_name, column_name, grantee, privilege_type;

select table_schema, table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles','items')
  and column_name in ('is_admin','seller_approved','status','owner_id')
order by table_name, column_name;
