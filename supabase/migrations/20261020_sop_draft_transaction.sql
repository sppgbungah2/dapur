-- Apply to the application's dapur_db schema before deploying the new editor.
-- No existing SOP or task content is replaced by this migration.
begin;

alter table dapur_db.sops add column if not exists is_locked boolean not null default false;
alter table dapur_db.sops add column if not exists admin_edited boolean not null default false;

create or replace function dapur_db.save_sop(
  p_document jsonb,
  p_tasks jsonb,
  p_expected_updated_at timestamptz default null,
  p_create_only boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, dapur_db
as $$
declare
  previous dapur_db.sops%rowtype;
  saved dapur_db.sops%rowtype;
  task_table text;
  doc_id text := p_document->>'id';
  doc_date text := p_document->>'date';
  doc_division text := p_document->>'division';
  doc_status text := p_document->>'status';
  old_instructions jsonb;
  new_instructions jsonb;
  edited boolean := false;
  exists_already boolean;
  written integer;
begin
  if coalesce(doc_id, '') = '' or coalesce(doc_division, '') = ''
     or coalesce(doc_date, '') !~ '^\d{4}-\d{2}-\d{2}$'
     or doc_status is null or doc_status not in ('draft', 'aktif', 'selesai')
     or p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'Data SOP tidak valid.';
  end if;
  task_table := case doc_division
    when 'Stocking (Persiapan)' then 'sop_tasks_stocking'
    when 'Masak' then 'sop_tasks_masak'
    when 'Pemorsian' then 'sop_tasks_pemorsian'
    when 'Driver' then 'sop_tasks_driver'
    when 'Cuci' then 'sop_tasks_cuci'
    when 'Kebersihan' then 'sop_tasks_kebersihan'
    when 'Keamanan' then 'sop_tasks_keamanan'
    else null
  end;
  if task_table is null then raise exception 'Divisi SOP tidak dikenal.'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_tasks) t
    where coalesce(t->>'id', '') = '' or btrim(coalesce(t->>'text', '')) = ''
      or coalesce(t->>'category', '') not in ('persiapan', 'aktif', 'penutup')
  ) or (select count(distinct t->>'id') from jsonb_array_elements(p_tasks) t) <> jsonb_array_length(p_tasks) then
    raise exception 'Instruksi kosong, kategori salah, atau ID tugas berulang.';
  end if;
  if doc_status <> 'draft' and jsonb_array_length(p_tasks) = 0 then
    raise exception 'SOP terbit harus memiliki minimal satu tugas.';
  end if;

  -- Serialize concurrent creates and saves for the same date and division.
  perform pg_advisory_xact_lock(hashtextextended(doc_date || ':' || doc_division, 0));
  if p_create_only and exists (
    select 1 from dapur_db.sops where date::text = doc_date and division = doc_division
  ) then
    raise exception 'SOP sudah ada. Generate ulang tidak boleh menimpa edit admin.';
  end if;
  select * into previous from dapur_db.sops where id = doc_id for update;
  exists_already := found;
  if exists_already then
    if previous.date::text <> doc_date or previous.division <> doc_division then
      raise exception 'Tanggal dan divisi SOP tidak boleh diubah.';
    end if;
    if previous.is_locked or previous.status = 'selesai' then
      raise exception 'SOP sudah dikunci.';
    end if;
    if previous.updated_at is distinct from p_expected_updated_at then
      raise exception 'SOP berubah di sesi lain. Salin edit Anda, lalu muat ulang sebelum menyimpan.';
    end if;
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_array(text, category) order by sort_order, id), ''[]''::jsonb) from dapur_db.%I where sop_id = $1',
      task_table
    ) into old_instructions using doc_id;
    select coalesce(jsonb_agg(jsonb_build_array(t->>'text', t->>'category') order by ordinal), '[]'::jsonb)
      into new_instructions from jsonb_array_elements(p_tasks) with ordinality as item(t, ordinal);
    edited := previous.admin_edited or old_instructions is distinct from new_instructions;
    if previous.status = 'draft' and doc_status <> 'draft' and not edited then
      raise exception 'Admin harus mengedit instruksi draft sebelum menerbitkan SOP.';
    end if;
  elsif not p_create_only or doc_status <> 'draft' then
    raise exception 'Generate draft SOP terlebih dahulu.';
  end if;
  if doc_status = 'selesai' and (
    coalesce(p_document->>'signature_supervisor_url', '') = ''
    or coalesce(p_document->>'signature_coordinator_url', '') = ''
  ) then raise exception 'Kedua tanda tangan wajib diisi sebelum mengunci SOP.'; end if;

  -- jsonb_populate_record supports both legacy TEXT dates and PostgreSQL DATE.
  select * into saved from jsonb_populate_record(
    null::dapur_db.sops,
    p_document || jsonb_build_object(
      'created_at', case when exists_already then previous.created_at else clock_timestamp() end,
      'updated_at', clock_timestamp(), 'admin_edited', edited,
      'is_locked', coalesce(previous.is_locked, false)
    )
  );
  insert into dapur_db.sops (
    id, date, division, creator_role, creator_name, is_checked_all,
    signer_supervisor, signature_supervisor_url, signed_supervisor_at,
    signer_coordinator, signature_coordinator_url, signed_coordinator_at,
    status, created_at, updated_at, admin_edited, is_locked
  ) values (
    saved.id, saved.date, saved.division, saved.creator_role, saved.creator_name, saved.is_checked_all,
    saved.signer_supervisor, saved.signature_supervisor_url, saved.signed_supervisor_at,
    saved.signer_coordinator, saved.signature_coordinator_url, saved.signed_coordinator_at,
    saved.status, saved.created_at, saved.updated_at, saved.admin_edited, saved.is_locked
  ) on conflict (id) do update set
    creator_role = excluded.creator_role, creator_name = excluded.creator_name,
    is_checked_all = excluded.is_checked_all, signer_supervisor = excluded.signer_supervisor,
    signature_supervisor_url = excluded.signature_supervisor_url, signed_supervisor_at = excluded.signed_supervisor_at,
    signer_coordinator = excluded.signer_coordinator, signature_coordinator_url = excluded.signature_coordinator_url,
    signed_coordinator_at = excluded.signed_coordinator_at, status = excluded.status,
    updated_at = excluded.updated_at, admin_edited = excluded.admin_edited;

  execute format(
    'insert into dapur_db.%1$I (id, sop_id, text, completed, category, sort_order)
     select t->>''id'', $1, t->>''text'', coalesce((t->>''completed'')::boolean, false),
            t->>''category'', (ordinal - 1)::integer
     from jsonb_array_elements($2) with ordinality as item(t, ordinal)
     on conflict (id) do update set text = excluded.text, completed = excluded.completed,
       category = excluded.category, sort_order = excluded.sort_order
     where %1$I.sop_id = excluded.sop_id', task_table
  ) using doc_id, p_tasks;
  get diagnostics written = row_count;
  if written <> jsonb_array_length(p_tasks) then
    raise exception 'ID tugas dimiliki SOP lain. Penyimpanan dibatalkan.';
  end if;
  execute format(
    'delete from dapur_db.%I where sop_id = $1 and id not in (select t->>''id'' from jsonb_array_elements($2) t)',
    task_table
  ) using doc_id, p_tasks;
  return to_jsonb(saved);
end;
$$;

revoke all on function dapur_db.save_sop(jsonb, jsonb, timestamptz, boolean) from public;
grant execute on function dapur_db.save_sop(jsonb, jsonb, timestamptz, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
