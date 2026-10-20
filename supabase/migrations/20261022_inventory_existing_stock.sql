-- Carry the last saved stock balance forward once; never add old receipts again.
begin;
do $$
declare
  source record;
  item_id uuid;
  amount numeric;
  started_at timestamptz := date_trunc('minute', clock_timestamp());
begin
  if to_regclass('dapur_db.stock_opname_docs') is null then return; end if;
  lock table dapur_db.inventory_items, dapur_db.inventory_movements in share row exclusive mode;
  for source in
    select distinct on (lower(btrim(entry->>'name')), lower(btrim(entry->>'uom')))
      entry, d.date as source_date
    from dapur_db.stock_opname_docs d
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(d.items::jsonb) = 'array' then d.items::jsonb else '[]'::jsonb end
    ) with ordinality as entries(entry, position)
    where d.date::text <= (clock_timestamp() at time zone 'Asia/Jakarta')::date::text
      and coalesce(btrim(entry->>'name'),'') <> ''
      and coalesce(btrim(entry->>'uom'),'') <> ''
    order by lower(btrim(entry->>'name')), lower(btrim(entry->>'uom')), d.date desc, position desc
  loop
    -- An invalid latest balance must not silently fall back to an older quantity.
    if coalesce(source.entry->>'stokAkhir','') !~ '^[0-9]+([.][0-9]{1,3})?$' then continue; end if;
    amount := (source.entry->>'stokAkhir')::numeric;
    if amount >= 1000000000000000 then continue; end if;
    item_id := null;
    insert into dapur_db.inventory_items(id,name,category,uom,opening_at)
      values(gen_random_uuid(),btrim(source.entry->>'name'),
        coalesce(nullif(btrim(source.entry->>'category'),''),'Lainnya'),
        btrim(source.entry->>'uom'),started_at)
      on conflict do nothing returning id into item_id;
    if item_id is not null then
      insert into dapur_db.inventory_movements(
        id,item_id,kind,quantity,delta,occurred_at,recorded_by,actor_email,note,request
      ) values(item_id,item_id,'opening',amount,amount,started_at,
        '00000000-0000-0000-0000-000000000000','migrasi-stok-lama',
        'Saldo bawaan dari stok akhir tersimpan tanggal ' || source.source_date::text,
        jsonb_build_object('source','stock_opname_docs','date',source.source_date,'item',source.entry));
    end if;
  end loop;
end $$;
commit;
