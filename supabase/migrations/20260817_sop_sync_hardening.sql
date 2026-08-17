-- Harden the SOP synchronization path used by the daily initialization flow.
-- Safe to run repeatedly in the Supabase SQL Editor or through `supabase db push`.

alter table public.sops add column if not exists is_locked boolean not null default false;

create unique index if not exists day_menus_date_key on public.day_menus (date);
create unique index if not exists sops_id_key on public.sops (id);

-- Repair SOP Stocking rows that were previously generated from a complete
-- day_menus object and consequently contain serialized JSON in the task text.
update public.sop_tasks_stocking as task
set text = 'Menerima dan memeriksa kesegaran serta kelayakan bahan menu: '
  || coalesce(menu.menu_text, '') || '.'
from public.sops as sop
join lateral (
  select string_agg(value, ', ' order by ordinality) as menu_text
  from jsonb_array_elements_text(
    coalesce((
      select case when jsonb_typeof(dm.menu_list) = 'array' then dm.menu_list else '[]'::jsonb end
      from public.day_menus as dm where dm.date = sop.date
    ), '[]'::jsonb)
  ) with ordinality as entry(value, ordinality)
) as menu on true
where task.sop_id = sop.id
  and lower(sop.division) like '%stocking%'
  and task.text like 'Menerima dan memeriksa kesegaran serta kelayakan bahan menu:%';

grant select, insert, update, delete on public.day_menus, public.sops,
  public.sop_tasks_driver, public.sop_tasks_stocking, public.sop_tasks_masak,
  public.sop_tasks_pemorsian, public.sop_tasks_kebersihan, public.sop_tasks_cuci,
  public.sop_tasks_keamanan to authenticated;

-- The app writes only when a signed-in user is present. These policies make
-- that intended access explicit instead of relying on an accidental RLS state.
alter table public.day_menus enable row level security;
alter table public.sops enable row level security;

drop policy if exists "day_menus_authenticated_access" on public.day_menus;
create policy "day_menus_authenticated_access" on public.day_menus
  for all to authenticated using (true) with check (true);

drop policy if exists "sops_authenticated_access" on public.sops;
create policy "sops_authenticated_access" on public.sops
  for all to authenticated using (true) with check (true);

do $$
declare task_table text;
begin
  foreach task_table in array array[
    'sop_tasks_driver', 'sop_tasks_stocking', 'sop_tasks_masak',
    'sop_tasks_pemorsian', 'sop_tasks_kebersihan', 'sop_tasks_cuci',
    'sop_tasks_keamanan'
  ] loop
    execute format('alter table public.%I enable row level security', task_table);
    execute format('drop policy if exists "sop_tasks_authenticated_access" on public.%I', task_table);
    execute format('create policy "sop_tasks_authenticated_access" on public.%I for all to authenticated using (true) with check (true)', task_table);
  end loop;
end $$;
