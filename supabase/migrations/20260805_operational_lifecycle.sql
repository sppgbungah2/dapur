-- Run once in Supabase SQL Editor. DATE must remain a PostgreSQL date, not timestamptz.
alter table public.bast_docs add column if not exists is_locked boolean not null default false;
alter table public.bast_docs add column if not exists vehicle_number text;
alter table public.bast_docs add column if not exists comments text;
alter table public.surat_jalan_docs add column if not exists is_locked boolean not null default false;
alter table public.surat_jalan_docs add column if not exists vehicle_number text;
alter table public.organoleptik_docs add column if not exists is_locked boolean not null default false;
alter table public.sops add column if not exists is_locked boolean not null default false;

-- Required by the idempotent upserts used when admin initializes a date.
create unique index if not exists bast_docs_id_key on public.bast_docs (id);
create unique index if not exists surat_jalan_docs_id_key on public.surat_jalan_docs (id);
create unique index if not exists organoleptik_docs_id_key on public.organoleptik_docs (id);
create unique index if not exists sops_id_key on public.sops (id);

-- Replace authenticated with the app's intended role if you use a stricter role model.
grant select, insert, update on public.bast_docs, public.surat_jalan_docs, public.organoleptik_docs, public.sops to authenticated;
