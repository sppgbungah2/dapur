import type { StockItem } from '../types';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  uom: string;
  balance: number;
  opening_at: string;
}
export interface InventoryMovement {
  id: string;
  item_id: string;
  name: string;
  uom: string;
  kind: 'opening' | 'in' | 'out' | 'count' | 'reversal';
  quantity: number;
  delta: number;
  occurred_at: string;
  recorded_at: string;
  actor_email: string;
  person: string;
  supplier: string;
  note: string;
  reversed: boolean;
}
export interface InventoryReportRow {
  id: string;
  name: string;
  category: string;
  uom: string;
  opening: number;
  incoming: number;
  outgoing: number;
  adjustment: number;
  closing: number;
}
export interface InventoryReport {
  report_date: string;
  start_at: string;
  end_at: string;
  period_end?: string;
  rows: InventoryReportRow[];
}
export interface InventoryRecap extends InventoryReport {
  id: string;
  created_at: string;
  actor_email: string;
  note: string;
}
export interface InventorySnapshot {
  role: 'admin' | 'staff';
  items: InventoryItem[];
  movements: InventoryMovement[];
  report: InventoryReport;
  recaps: InventoryRecap[];
}

export function wibInputTime(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(now).replace(' ', 'T');
}

export function toInventoryTimestamp(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Isi tanggal dan jam transaksi.');
  const date = new Date(`${local}:00+07:00`);
  if (Number.isNaN(date.getTime()) || wibInputTime(date) !== local) throw new Error('Tanggal atau jam tidak valid.');
  return date.toISOString();
}

export function inventoryReportDate(local: string): string {
  const timestamp = toInventoryTimestamp(local);
  // A warehouse day ends at 14:00 WIB (07:00 UTC).
  return new Date(Date.parse(timestamp) + 17 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function latestLegacyBalances(stockMap: Record<string, StockItem[]>) {
  const latest = new Map<string, StockItem & { date: string }>();
  for (const date of Object.keys(stockMap).sort()) {
    for (const item of stockMap[date] || []) {
      if (!item.name?.trim() || !item.uom?.trim() || !Number.isFinite(Number(item.stokAkhir)) || Number(item.stokAkhir) < 0) continue;
      latest.set(`${item.name.trim().toLowerCase()}|${item.uom.trim().toLowerCase()}`, { ...item, date });
    }
  }
  return [...latest.values()];
}

export async function inventoryRpc<T>(db: any, name: string, args: Record<string, unknown>): Promise<T> {
  if (!db) throw new Error('Supabase belum terhubung. Transaksi belum disimpan.');
  const { data, error } = await db.rpc(name, args);
  if (error) {
    if (['PGRST202', '42883', '42P01'].includes(error.code)) {
      throw new Error('Buku stok belum diaktifkan di server. Jalankan migrasi inventory_ledger terlebih dahulu.');
    }
    if (error.code === '23505') throw new Error('Barang dengan nama dan satuan tersebut, atau pembatalan transaksi ini, sudah tercatat. Muat ulang untuk memeriksa.');
    throw new Error(error.message || 'Transaksi gagal disimpan.');
  }
  return data as T;
}

export function inventoryCsv(report: InventoryReport): string {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[=+@\t\r]|^-(?!\d)/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = [
    ['Rekap pemakaian', report.report_date],
    ['Periode mulai (WIB)', wibInputTime(new Date(report.start_at))],
    ['Dicatat sampai (WIB)', wibInputTime(new Date(report.end_at))],
    ['Kategori', 'Barang', 'Satuan', 'Stok awal / aktivasi', 'Masuk', 'Keluar', 'Penyesuaian', 'Saldo'],
    ...report.rows.map(row => [row.category, row.name, row.uom, row.opening, row.incoming, row.outgoing, row.adjustment, row.closing])
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
