begin;
grant usage on schema dapur_db to authenticated;
create or replace function dapur_db.daily_stock_role() returns text
language sql stable security invoker set search_path = pg_catalog as $$
  select case when auth.uid() is null then null
    when lower(auth.jwt()->>'email') = any(array[
      'maghfurmunif@gmail.com','punkysme@gmail.com','maghfur@qomaruddin.com',
      'rifkah@qomaruddin.com','fajar@qomaruddin.com','sam@qomaruddin.com','ketua@sppg.com'
    ]) or auth.uid()::text = 'd5454d9d-1d50-4baa-b5b9-f8693694db4a' then 'admin'
    when lower(auth.jwt()->>'email') ~ '^(chef|gizi|stocking|persiapan|masak|pemorsian|cuci|kebersihan|keamanan|kemanan|aslap|akuntan|driver)@(qomaruddin\.com|sppg\.com)$'
      then 'staff' else null end;
$$;

create table if not exists dapur_db.daily_stock_opname (
  date date primary key,
  revision integer not null default 1,
  items jsonb not null,
  updated_by uuid not null
);
alter table dapur_db.daily_stock_opname enable row level security;
revoke all on dapur_db.daily_stock_opname from public,anon,authenticated;

create or replace function dapur_db.daily_stock_month(p_month date) returns jsonb
language plpgsql security definer set search_path=pg_catalog,dapur_db as $$
declare first_day date := date_trunc('month',p_month)::date; result jsonb; access_role text := dapur_db.daily_stock_role();
begin
  if access_role is null or p_month is null then raise exception 'Akses stok ditolak.'; end if;
  select coalesce(jsonb_agg(to_jsonb(d) order by d.date),'[]'::jsonb) into result
  from dapur_db.daily_stock_opname d
  where (d.date >= first_day and d.date < first_day + interval '1 month')
    or d.date = (select max(date) from dapur_db.daily_stock_opname where date < first_day);
  return jsonb_build_object('admin',access_role='admin','docs',result);
end $$;

create or replace function dapur_db.save_daily_stock(p_date date,p_revision integer,p_items jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,dapur_db as $$
declare previous dapur_db.daily_stock_opname%rowtype; saved dapur_db.daily_stock_opname%rowtype;
  warehouse text; row_data jsonb; field_name text; amount numeric;
begin
  if dapur_db.daily_stock_role() is distinct from 'admin' then raise exception 'Hanya admin yang dapat mengisi stok opname.'; end if;
  if p_date is null or p_revision is null or p_revision < 0 or jsonb_typeof(p_items) is distinct from 'object'
    or jsonb_typeof(p_items->'kering') is distinct from 'array' or jsonb_typeof(p_items->'basah') is distinct from 'array' then
    raise exception 'Data kedua gudang tidak valid.';
  end if;
  foreach warehouse in array array['kering','basah'] loop
    if exists(select 1 from jsonb_array_elements(p_items->warehouse) r
      group by lower(btrim(r->>'name')),lower(btrim(r->>'uom')) having count(*) > 1) then
      raise exception 'Barang dengan nama dan satuan yang sama tercatat dua kali.';
    end if;
    if exists(select 1 from jsonb_array_elements(p_items->warehouse) r group by r->>'id' having count(*) > 1) then
      raise exception 'ID baris berulang.';
    end if;
    for row_data in select value from jsonb_array_elements(p_items->warehouse) loop
      if coalesce(btrim(row_data->>'name'),'')='' or coalesce(btrim(row_data->>'uom'),'')=''
        or coalesce(row_data->>'id','')='' or jsonb_typeof(row_data->'note') is distinct from 'string' then
        raise exception 'Nama, satuan, ID, atau keterangan tidak valid.';
      end if;
      foreach field_name in array array['stock','incoming','usage','physical'] loop
        if field_name='physical' and row_data->'physical'='""'::jsonb then continue; end if;
        if jsonb_typeof(row_data->field_name) is distinct from 'number' then raise exception 'Jumlah wajib berupa angka.'; end if;
        amount := (row_data->>field_name)::numeric;
        if amount < 0 or amount >= 1000000000000000 or amount <> round(amount,3) then raise exception 'Jumlah tidak valid.'; end if;
      end loop;
      if (row_data->>'stock')::numeric + (row_data->>'incoming')::numeric < (row_data->>'usage')::numeric then
        raise exception 'Pemakaian melebihi stok dan barang datang.';
      end if;
    end loop;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('daily_stock_' || p_date::text,0));
  select * into previous from dapur_db.daily_stock_opname where date=p_date for update;
  if found then
    -- A retry after a lost response returns the same saved document.
    if previous.items=p_items and previous.updated_by=auth.uid() then return to_jsonb(previous); end if;
    if previous.revision<>p_revision then raise exception 'Data tanggal ini telah diubah admin lain. Isian Anda tetap ada; buka ulang halaman untuk membandingkan sebelum menyimpan.'; end if;
    update dapur_db.daily_stock_opname set items=p_items,revision=revision+1,updated_by=auth.uid()
      where date=p_date returning * into saved;
  else
    if p_revision<>0 then raise exception 'Versi dokumen tidak sesuai.'; end if;
    insert into dapur_db.daily_stock_opname(date,items,updated_by) values(p_date,p_items,auth.uid()) returning * into saved;
  end if;
  return to_jsonb(saved);
end $$;
revoke all on function dapur_db.daily_stock_role(),dapur_db.daily_stock_month(date),dapur_db.save_daily_stock(date,integer,jsonb) from public;
grant execute on function dapur_db.daily_stock_role(),dapur_db.daily_stock_month(date),dapur_db.save_daily_stock(date,integer,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
