-- New append-only ledger. Legacy stock_opname_docs and kedatangan_barang remain unchanged.
begin;
grant usage on schema dapur_db to authenticated;

create table if not exists dapur_db.inventory_items (
  id uuid primary key,
  name text not null check (btrim(name) <> ''),
  category text not null,
  uom text not null check (btrim(uom) <> ''),
  opening_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create unique index if not exists inventory_items_name_unit_key
  on dapur_db.inventory_items (lower(btrim(name)), lower(btrim(uom)));

create table if not exists dapur_db.inventory_movements (
  id uuid primary key,
  item_id uuid not null references dapur_db.inventory_items(id),
  kind text not null check (kind in ('opening', 'in', 'out', 'count', 'reversal')),
  quantity numeric(18,3) not null check (quantity >= 0),
  delta numeric(18,3) not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  recorded_by uuid not null,
  actor_email text not null,
  person text not null default '',
  supplier text not null default '',
  note text not null default '',
  reversed_id uuid references dapur_db.inventory_movements(id),
  request jsonb not null,
  check (
    (kind in ('opening','in') and delta = quantity) or
    (kind = 'out' and delta = -quantity) or kind in ('count','reversal')
  )
);
create unique index if not exists inventory_single_opening
  on dapur_db.inventory_movements(item_id) where kind = 'opening';
create unique index if not exists inventory_single_reversal
  on dapur_db.inventory_movements(reversed_id) where reversed_id is not null;
create index if not exists inventory_movement_item_time
  on dapur_db.inventory_movements(item_id, occurred_at, recorded_at);
create index if not exists inventory_movement_time
  on dapur_db.inventory_movements(occurred_at);

create table if not exists dapur_db.inventory_recaps (
  id uuid primary key,
  report_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null,
  actor_email text not null,
  rows jsonb not null,
  note text not null default ''
);
create index if not exists inventory_recap_date on dapur_db.inventory_recaps(report_date, created_at);

alter table dapur_db.inventory_items enable row level security;
alter table dapur_db.inventory_movements enable row level security;
alter table dapur_db.inventory_recaps enable row level security;
revoke all on dapur_db.inventory_items, dapur_db.inventory_movements, dapur_db.inventory_recaps from anon, authenticated;

-- Match the existing application's trusted account mapping, using signed JWT claims.
create or replace function dapur_db.inventory_role() returns text
language sql stable security invoker set search_path = pg_catalog as $$
  select case when auth.uid() is null then null
    when lower(auth.jwt()->>'email') = any(array[
      'maghfurmunif@gmail.com','punkysme@gmail.com','maghfur@qomaruddin.com',
      'rifkah@qomaruddin.com','fajar@qomaruddin.com','sam@qomaruddin.com','ketua@sppg.com'
    ]) or auth.uid()::text = 'd5454d9d-1d50-4baa-b5b9-f8693694db4a' then 'admin'
    when lower(auth.jwt()->>'email') ~ '^(chef|gizi|stocking|persiapan|masak|pemorsian|cuci|kebersihan|keamanan|kemanan|aslap|akuntan|driver)@(qomaruddin\.com|sppg\.com)$'
      then 'staff' else null end;
$$;

create or replace function dapur_db.inventory_create_item(
  p_id uuid, p_name text, p_category text, p_uom text, p_quantity numeric, p_at timestamptz, p_note text default ''
) returns uuid language plpgsql security definer set search_path = pg_catalog, dapur_db as $$
declare
  request_data jsonb := jsonb_build_object('name', btrim(p_name), 'category', btrim(p_category),
    'uom', btrim(p_uom), 'quantity', p_quantity, 'at', p_at, 'note', btrim(p_note));
  previous dapur_db.inventory_movements%rowtype;
begin
  if dapur_db.inventory_role() is distinct from 'admin' then raise exception 'Hanya admin yang dapat mengaktifkan saldo awal.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into previous from dapur_db.inventory_movements where id = p_id;
  if found then
    if previous.request <> request_data or previous.recorded_by <> auth.uid() then raise exception 'ID permintaan sudah digunakan untuk data lain.'; end if;
    return p_id;
  end if;
  if p_id is null or coalesce(btrim(p_name),'') = '' or coalesce(btrim(p_uom),'') = ''
     or coalesce(btrim(p_category),'') = '' or p_quantity is null or p_quantity < 0
     or p_quantity::text in ('NaN','Infinity','-Infinity') or p_quantity <> round(p_quantity,3)
     or p_at is null or p_at > clock_timestamp() then raise exception 'Nama, kategori, satuan, saldo awal, atau waktu tidak valid.'; end if;
  insert into dapur_db.inventory_items(id,name,category,uom,opening_at)
    values(p_id,btrim(p_name),btrim(p_category),btrim(p_uom),p_at);
  insert into dapur_db.inventory_movements(id,item_id,kind,quantity,delta,occurred_at,recorded_by,actor_email,note,request)
    values(p_id,p_id,'opening',p_quantity,p_quantity,p_at,auth.uid(),auth.jwt()->>'email',btrim(p_note),request_data);
  return p_id;
end;
$$;

create or replace function dapur_db.inventory_record_movement(
  p_id uuid, p_item_id uuid, p_kind text, p_quantity numeric, p_at timestamptz,
  p_person text default '', p_supplier text default '', p_note text default '', p_reversed_id uuid default null
) returns uuid language plpgsql security definer set search_path = pg_catalog, dapur_db as $$
declare
  access_role text := dapur_db.inventory_role();
  item dapur_db.inventory_items%rowtype;
  previous dapur_db.inventory_movements%rowtype;
  original dapur_db.inventory_movements%rowtype;
  change numeric;
  balance numeric;
  request_data jsonb := jsonb_build_object('item',p_item_id,'kind',p_kind,'quantity',p_quantity,'at',p_at,
    'person',btrim(p_person),'supplier',btrim(p_supplier),'note',btrim(p_note),'reversed_id',p_reversed_id);
begin
  if access_role is null or (p_kind <> 'out' and access_role <> 'admin') then raise exception 'Anda tidak berhak mencatat transaksi ini.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into previous from dapur_db.inventory_movements where id = p_id;
  if found then
    if previous.request <> request_data or previous.recorded_by <> auth.uid() then raise exception 'ID permintaan sudah digunakan untuk data lain.'; end if;
    return p_id;
  end if;
  select * into item from dapur_db.inventory_items where id = p_item_id for update;
  if not found then raise exception 'Barang tidak ditemukan. Admin perlu mengaktifkan saldo awal dahulu.'; end if;
  if p_id is null or p_kind is null or p_kind not in ('in','out','count','reversal')
     or p_quantity is null or p_quantity < 0 or p_quantity::text in ('NaN','Infinity','-Infinity')
     or p_quantity <> round(p_quantity,3) or (p_kind in ('in','out') and p_quantity = 0)
     or p_at is null or p_at < item.opening_at or p_at > clock_timestamp() then
    raise exception 'Jumlah atau waktu transaksi tidak valid. Waktu harus setelah saldo awal dan tidak di masa depan.';
  end if;
  if p_kind = 'out' and coalesce(btrim(p_person),'') = '' then raise exception 'Nama pengambil wajib diisi.'; end if;
  if p_kind in ('count','reversal') and coalesce(btrim(p_note),'') = '' then raise exception 'Alasan koreksi wajib diisi.'; end if;
  if p_kind <> 'reversal' and p_reversed_id is not null then raise exception 'Referensi pembatalan tidak sesuai.'; end if;
  -- Backdated edits before a physical count would change the meaning of that count.
  if exists(select 1 from dapur_db.inventory_movements where item_id = p_item_id and kind = 'count' and occurred_at >= p_at) then
    raise exception 'Sudah ada hitung fisik setelah waktu ini. Catat koreksi pada waktu sekarang beserta alasannya.';
  end if;
  select coalesce(sum(delta),0) into balance from dapur_db.inventory_movements where item_id = p_item_id;
  if p_kind = 'count' then
    if exists(select 1 from dapur_db.inventory_movements where item_id = p_item_id and occurred_at > p_at) then
      raise exception 'Hitung fisik harus dicatat setelah transaksi terakhir.';
    end if;
    change := p_quantity - balance;
  elsif p_kind = 'reversal' then
    select * into original from dapur_db.inventory_movements where id = p_reversed_id and item_id = p_item_id;
    if not found or original.kind not in ('in','out') or original.occurred_at > p_at then raise exception 'Hanya barang masuk/keluar yang dapat dibatalkan setelah waktu transaksinya.'; end if;
    change := -original.delta;
  else change := case when p_kind = 'out' then -p_quantity else p_quantity end;
  end if;
  insert into dapur_db.inventory_movements(id,item_id,kind,quantity,delta,occurred_at,recorded_by,actor_email,person,supplier,note,reversed_id,request)
    values(p_id,p_item_id,p_kind,p_quantity,change,p_at,auth.uid(),auth.jwt()->>'email',
      btrim(p_person),btrim(p_supplier),btrim(p_note),p_reversed_id,request_data);
  if exists (
    select 1 from (
      select sum(delta) over(order by occurred_at, recorded_at, id rows unbounded preceding) as running
      from dapur_db.inventory_movements where item_id = p_item_id
    ) balances where running < 0
  ) then raise exception 'Stok tidak mencukupi pada waktu transaksi. Periksa jumlah dan waktu barang masuk/keluar.'; end if;
  return p_id;
end;
$$;

create or replace function dapur_db.inventory_report(p_date date, p_until timestamptz default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, dapur_db as $$
declare
  period_start timestamptz := ((p_date - 1) + time '14:00') at time zone 'Asia/Jakarta';
  period_end timestamptz := (p_date + time '14:00') at time zone 'Asia/Jakarta';
  cutoff timestamptz;
  report_rows jsonb;
begin
  if dapur_db.inventory_role() is null or p_date is null then raise exception 'Akses rekap ditolak.'; end if;
  cutoff := greatest(period_start, least(coalesce(p_until,clock_timestamp()),clock_timestamp(),period_end));
  select coalesce(jsonb_agg(to_jsonb(r) order by r.name,r.uom),'[]'::jsonb) into report_rows from (
    select i.id, i.name, i.category, i.uom,
      coalesce(sum(m.delta) filter(where m.occurred_at < period_start or m.kind = 'opening'),0) as opening,
      coalesce(sum(m.delta) filter(where m.kind = 'in' and m.occurred_at >= period_start),0) as incoming,
      coalesce(sum(-m.delta) filter(where m.kind = 'out' and m.occurred_at >= period_start),0) as outgoing,
      coalesce(sum(m.delta) filter(where m.kind in ('count','reversal') and m.occurred_at >= period_start),0) as adjustment,
      coalesce(sum(m.delta),0) as closing
    from dapur_db.inventory_items i
    left join dapur_db.inventory_movements m on m.item_id = i.id and m.occurred_at < cutoff
    where i.opening_at < cutoff group by i.id
  ) r;
  return jsonb_build_object('report_date',p_date,'start_at',period_start,'end_at',cutoff,'period_end',period_end,'rows',report_rows);
end;
$$;

create or replace function dapur_db.inventory_snapshot(p_date date) returns jsonb
language plpgsql security definer set search_path = pg_catalog, dapur_db as $$
declare products jsonb; history jsonb; recaps jsonb; role_name text := dapur_db.inventory_role();
begin
  if role_name is null then raise exception 'Akun ini tidak memiliki akses gudang.'; end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.name,r.uom),'[]'::jsonb) into products from (
    select i.*, coalesce(sum(m.delta),0) as balance from dapur_db.inventory_items i
    left join dapur_db.inventory_movements m on m.item_id = i.id group by i.id
  ) r;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.occurred_at desc,r.recorded_at desc),'[]'::jsonb) into history from (
    select m.*, i.name, i.uom,
      exists(select 1 from dapur_db.inventory_movements undo where undo.reversed_id = m.id) as reversed
    from dapur_db.inventory_movements m join dapur_db.inventory_items i on i.id = m.item_id
    where m.occurred_at >= ((p_date - 1) + time '14:00') at time zone 'Asia/Jakarta'
      and m.occurred_at < (p_date + time '14:00') at time zone 'Asia/Jakarta'
  ) r;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) into recaps
    from dapur_db.inventory_recaps r where report_date = p_date;
  return jsonb_build_object('role',role_name,'items',products,'movements',history,
    'report',dapur_db.inventory_report(p_date),'recaps',recaps);
end;
$$;

create or replace function dapur_db.inventory_save_recap(p_id uuid,p_date date,p_note text default '')
returns uuid language plpgsql security definer set search_path = pg_catalog, dapur_db as $$
declare report jsonb; previous dapur_db.inventory_recaps%rowtype;
begin
  if dapur_db.inventory_role() is distinct from 'admin' then raise exception 'Hanya admin yang dapat menyimpan rekap.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select * into previous from dapur_db.inventory_recaps where id = p_id;
  if found then
    if previous.report_date <> p_date or previous.created_by <> auth.uid() or previous.note <> btrim(p_note) then raise exception 'ID rekap sudah dipakai.'; end if;
    return p_id;
  end if;
  report := dapur_db.inventory_report(p_date);
  if (report->>'end_at')::timestamptz <= (report->>'start_at')::timestamptz then raise exception 'Periode rekap belum dimulai.'; end if;
  insert into dapur_db.inventory_recaps(id,report_date,start_at,end_at,created_by,actor_email,rows,note)
    values(p_id,p_date,(report->>'start_at')::timestamptz,(report->>'end_at')::timestamptz,
      auth.uid(),auth.jwt()->>'email',report->'rows',btrim(p_note));
  return p_id;
end;
$$;

revoke all on function dapur_db.inventory_role() from public;
revoke all on function dapur_db.inventory_create_item(uuid,text,text,text,numeric,timestamptz,text) from public;
revoke all on function dapur_db.inventory_record_movement(uuid,uuid,text,numeric,timestamptz,text,text,text,uuid) from public;
revoke all on function dapur_db.inventory_report(date,timestamptz) from public;
revoke all on function dapur_db.inventory_snapshot(date) from public;
revoke all on function dapur_db.inventory_save_recap(uuid,date,text) from public;
grant execute on function dapur_db.inventory_role(),
  dapur_db.inventory_create_item(uuid,text,text,text,numeric,timestamptz,text),
  dapur_db.inventory_record_movement(uuid,uuid,text,numeric,timestamptz,text,text,text,uuid),
  dapur_db.inventory_report(date,timestamptz), dapur_db.inventory_snapshot(date),
  dapur_db.inventory_save_recap(uuid,date,text) to authenticated;
notify pgrst, 'reload schema';
commit;
