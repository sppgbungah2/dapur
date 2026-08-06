-- Jalankan di Supabase SQL Editor sebelum memakai fitur paraf otomatis Borongan.
create table if not exists public.borongan_signatories (
  date text primary key,
  signatories jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.borongan_signatories enable row level security;

drop policy if exists "borongan_signatories_authenticated" on public.borongan_signatories;
create policy "borongan_signatories_authenticated"
on public.borongan_signatories for all to authenticated
using (true) with check (true);

grant select, insert, update on public.borongan_signatories to authenticated;
