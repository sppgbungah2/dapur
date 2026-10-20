export type Warehouse = 'kering' | 'basah';
export interface DailyStockRow {
  id: string;
  name: string;
  uom: string;
  stock: number | '';
  incoming: number | '';
  usage: number | '';
  physical: number | '';
  note: string;
}
export interface DailyStockDoc {
  date: string;
  revision: number;
  items: Record<Warehouse, DailyStockRow[]>;
}
export const emptyStock = (): DailyStockDoc['items'] => ({ kering: [], basah: [] });
export const cardBalance = (r: DailyStockRow) => Math.round((Number(r.stock) + Number(r.incoming) - Number(r.usage)) * 1000) / 1000;
export const stockDifference = (r: DailyStockRow) => r.physical === '' ? '' : Math.round((Number(r.physical) - cardBalance(r)) * 1000) / 1000;
export function nextDailyStock(previous?: DailyStockDoc): DailyStockDoc['items'] {
  const copy = (warehouse: Warehouse) => (previous?.items[warehouse] || []).map(r => ({
    ...r, stock: r.physical === '' ? cardBalance(r) : r.physical,
    incoming: 0, usage: 0, physical: '' as const, note: ''
  }));
  return { kering: copy('kering'), basah: copy('basah') };
}
export function validateDailyStock(items: DailyStockDoc['items']) {
  for (const warehouse of ['kering', 'basah'] as const) {
    const names = new Set<string>();
    for (const row of items[warehouse]) {
      if (!row.name.trim() || !row.uom.trim()) throw new Error('Nama barang dan satuan wajib diisi.');
      const key = `${row.name.trim().toLowerCase()}|${row.uom.trim().toLowerCase()}`;
      if (names.has(key)) throw new Error(`${row.name} tercatat dua kali dalam gudang yang sama.`);
      names.add(key);
      for (const field of ['stock', 'incoming', 'usage', 'physical'] as const) {
        const value = row[field];
        if (value === '' && field === 'physical') continue;
        if (value === '' || !Number.isFinite(value) || Number(value) < 0 || Math.abs(Number(value) * 1000 - Math.round(Number(value) * 1000)) > 0.000001)
          throw new Error(`Periksa jumlah ${row.name}; gunakan angka 0 atau lebih, maksimal 3 desimal.`);
      }
      if (cardBalance(row) < 0) throw new Error(`Pemakaian ${row.name} melebihi stok dan barang datang.`);
    }
  }
}
export function dailyStockCsv(doc: DailyStockDoc) {
  const rows: unknown[][] = [['Tanggal', 'Gudang', 'Nama bahan makanan', 'Satuan', 'Stok gudang awal', 'Barang datang', 'Pemakaian', 'Saldo kartu stok', 'Fisik', 'Selisih', 'Keterangan']];
  for (const warehouse of ['kering', 'basah'] as const)
    for (const r of doc.items[warehouse]) rows.push([doc.date, warehouse, r.name, r.uom, r.stock, r.incoming, r.usage, cardBalance(r), r.physical, stockDifference(r), r.note]);
  return '\uFEFF' + rows.map(row => row.map(v => {
    let text = String(v ?? '');
    if (/^[=+@\t\r]|^-(?!\d)/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}
