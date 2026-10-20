import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, UserProfile } from '../lib/supabase';
import type { StockItem } from '../types';
import { InventorySnapshot, InventoryReport, inventoryRpc, inventoryReportDate, inventoryCsv, toInventoryTimestamp, wibInputTime } from '../lib/inventory';

type Mode = 'saldo' | 'in' | 'out' | 'count' | 'rekap' | 'riwayat';
interface Props { selectedDate: string; stockMap: Record<string, StockItem[]>; loggedInUser?: UserProfile | null; initialMode?: Mode; }
const field = 'w-full min-h-11 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-600';
const button = 'min-h-11 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const number = (n: number) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 3 });
const time = (s: string) => new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) + ' WIB';
const labels = { opening: 'Saldo awal', in: 'Masuk', out: 'Pengambilan', count: 'Hitung fisik', reversal: 'Pembatalan' };

function Report({ report }: { report: InventoryReport }) {
  return <div className="overflow-x-auto border rounded-xl"><table className="w-full min-w-[720px] text-sm text-left"><thead className="bg-neutral-100"><tr>{['Barang','Satuan','Stok awal','Masuk','Keluar','Penyesuaian','Saldo'].map(s => <th className="p-3" key={s}>{s}</th>)}</tr></thead><tbody>{report.rows.map(r => <tr key={r.id} className="border-t"><td className="p-3 font-semibold">{r.name}</td><td className="p-3">{r.uom}</td>{[r.opening,r.incoming,r.outgoing,r.adjustment,r.closing].map((n,i) => <td key={i} className="p-3 tabular-nums">{number(n)}</td>)}</tr>)}</tbody></table>{!report.rows.length && <p className="p-4">Belum ada stok pada periode ini.</p>}</div>;
}

export default function InventoryLedgerView({ selectedDate, loggedInUser, initialMode = 'saldo' }: Props) {
  const [date, setDate] = useState(selectedDate || inventoryReportDate(wibInputTime()));
  const [mode, setMode] = useState<Mode>(initialMode);
  const [data, setData] = useState<InventorySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ item: '', qty: '', at: '', person: loggedInUser?.fullName || '', supplier: '', note: '' });
  const [opening, setOpening] = useState({ name: '', category: 'Bumbu', uom: 'Kg', qty: '', at: wibInputTime(), note: '' });
  const [recapId, setRecapId] = useState('');
  const [recapNote, setRecapNote] = useState('');
  const [undo, setUndo] = useState<{ id: string; item: string; name: string; at: string; note: string } | null>(null);
  const busy = useRef(false);
  const request = useRef<{ key: string; id: string } | null>(null);
  const revision = useRef(0);
  const admin = data?.role === 'admin';
  const reload = useCallback(async () => {
    const version = ++revision.current;
    setLoading(true);
    try {
      const next = await inventoryRpc<InventorySnapshot>(supabase, 'inventory_snapshot', { p_date: date });
      if (version === revision.current) { setData(next); setError(''); }
    } catch (e: any) { if (version === revision.current) setError(e.message); }
    finally { if (version === revision.current) setLoading(false); }
  }, [date]);
  useEffect(() => { if (selectedDate) setDate(selectedDate); }, [selectedDate]);
  useEffect(() => { setMode(initialMode); }, [initialMode]);
  useEffect(() => { setRecapId(''); void reload(); const focus = () => { if (!busy.current) void reload(); }; window.addEventListener('focus', focus); return () => { ++revision.current; window.removeEventListener('focus', focus); }; }, [reload]);
  const save = async (name: string, args: Record<string, unknown>, message: string, done?: () => void) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(''); setNotice('');
    const key = JSON.stringify([name,args]);
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    try {
      await inventoryRpc(supabase, name, { ...args, p_id: request.current.id });
      request.current = null; done?.(); setNotice(message); await reload();
    } catch (e: any) { setError(e.message); }
    finally { busy.current = false; setSaving(false); }
  };
  const create = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      void save('inventory_create_item', { p_name: opening.name.trim(), p_category: opening.category, p_uom: opening.uom.trim(), p_quantity: Number(opening.qty), p_at: toInventoryTimestamp(opening.at), p_note: opening.note }, 'Barang tersimpan. Saldo dibawa terus ke hari berikutnya.', () => setOpening({ name: '', category: 'Bumbu', uom: 'Kg', qty: '', at: wibInputTime(), note: '' }));
    } catch (err: any) { setError(err.message); }
  };
  const record = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const at = form.at || wibInputTime();
      setForm(prev => ({ ...prev, at }));
      void save('inventory_record_movement', { p_item_id: form.item, p_kind: mode, p_quantity: Number(form.qty), p_at: toInventoryTimestamp(at), p_person: mode === 'out' ? form.person : '', p_supplier: mode === 'in' ? form.supplier : '', p_note: form.note }, `Transaksi tersimpan dalam rekap pemakaian ${inventoryReportDate(at)}.`, () => setForm(prev => ({ ...prev, qty: '', note: '', at: '' })));
    } catch (err: any) { setError(err.message); }
  };
  const download = (report: InventoryReport) => {
    const url = URL.createObjectURL(new Blob([inventoryCsv(report)], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `Rekap_Gudang_${report.report_date}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const current = data?.report.report_date === date ? data : null;
  const recap = current?.recaps.find(r => r.id === recapId);
  const report = recap || current?.report;
  const item = data?.items.find(i => i.id === form.item);
  const tabs: [Mode,string][] = [['saldo','Stok opname'], ['rekap','Rekap'], ['riwayat','Riwayat']];
  const choose = (next: Mode, id = '') => {
    setForm(prev => ({ ...prev, item: id, qty: '', note: '', at: '' }));
    setMode(next);
  };
  let hint = ''; try { hint = inventoryReportDate(form.at || wibInputTime()); } catch {}

  return <div className="max-w-7xl mx-auto space-y-5 text-neutral-800">
    <header className="flex flex-wrap justify-between items-start gap-4"><div><h2 className="text-2xl font-bold">Stok gudang & opname</h2><p className="text-sm mt-2 text-neutral-600">Stok awal + barang masuk − pengambilan + penyesuaian = saldo gudang.</p></div><button type="button" disabled={loading || saving} onClick={() => void reload()} className={button}>{loading ? 'Memuat...' : 'Muat ulang'}</button></header>
    <p className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-sm leading-relaxed">Cukup catat jumlah barang yang datang atau diambil. Saldo dihitung otomatis dan tetap dibawa ke hari berikutnya. Rekap bisa dilihat dan disimpan kapan saja.</p>
    {error && <p role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800">{error} Isian tidak dihapus bila gagal disimpan.</p>}
    {notice && <p role="status" className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">{notice}</p>}
    <div className="flex flex-wrap justify-between items-end gap-3"><nav aria-label="Bagian gudang" className="flex flex-wrap gap-2">{tabs.map(([key,label]) => <button type="button" key={key} onClick={() => setMode(key)} aria-pressed={mode === key} className={`min-h-11 rounded-lg px-4 border text-sm font-semibold ${mode === key ? 'bg-emerald-800 text-white' : 'bg-white'}`}>{label}</button>)}</nav><label className="text-sm font-semibold">Tanggal rekap pemakaian<input type="date" value={date} disabled={saving} onChange={e => { if (e.target.value) setDate(e.target.value); }} className={`${field} mt-1`} /></label></div>
    {data && mode === 'saldo' && <section className="space-y-4">
      <div className="flex flex-wrap gap-2">{admin && <button className={button} onClick={() => choose('in')}>Barang masuk</button>}<button className={button} onClick={() => choose('out')}>Ambil barang</button>{admin && <button className={button} onClick={() => choose('count')}>Penyesuaian</button>}</div>
      {current && <Report report={{ ...current.report, rows: current.report.rows.filter(i => `${i.name} ${i.category}`.toLowerCase().includes(search.toLowerCase())) }} />}
      <label className="block text-sm font-semibold">Cari barang<input value={search} onChange={e => setSearch(e.target.value)} className={`${field} mt-1`} /></label>
      <details className="rounded-xl border p-3"><summary className="cursor-pointer min-h-11 font-semibold">Lihat saldo gudang saat ini</summary><p className="text-sm text-neutral-600">Termasuk seluruh transaksi terbaru, terlepas dari tanggal rekap yang dipilih.</p>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[480px] text-left text-sm"><thead className="bg-neutral-100"><tr>{['Barang','Kategori','Saldo sekarang','Satuan'].map(t => <th key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{data.items.filter(i => `${i.name} ${i.category}`.toLowerCase().includes(search.toLowerCase())).map(i => <tr key={i.id} className="border-t"><td className="p-3 font-semibold">{i.name}</td><td className="p-3">{i.category}</td><td className={`p-3 font-bold ${Number(i.balance) === 0 ? 'text-red-700' : 'text-emerald-800'}`}>{number(i.balance)}</td><td className="p-3">{i.uom}</td></tr>)}</tbody></table>{!data.items.length && <p className="p-5">Belum ada barang. Admin dapat menambahkan barang beserta stok yang sudah tersedia.</p>}</div>
      </details>
      {admin && <details className="rounded-xl border bg-white p-5" open={!data.items.length}><summary className="font-bold min-h-11 cursor-pointer">Tambah barang baru</summary><p className="text-sm text-neutral-600 mb-4">Stok terakhir dari catatan lama dibawa otomatis saat pembaruan server. Form ini hanya untuk barang yang belum terdaftar. Isi 0 jika belum ada stoknya.</p>
        <form onSubmit={create}><fieldset disabled={saving} className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm">Nama barang<input required value={opening.name} onChange={e => setOpening({ ...opening, name: e.target.value })} className={field} /></label>
          <label className="text-sm">Kategori<input required value={opening.category} onChange={e => setOpening({ ...opening, category: e.target.value })} className={field} /></label>
          <label className="text-sm">Satuan tetap (Kg, liter, pcs...)<input required value={opening.uom} onChange={e => setOpening({ ...opening, uom: e.target.value })} className={field} /></label>
          <label className="text-sm">Jumlah fisik<input type="number" required min="0" step="0.001" value={opening.qty} onChange={e => setOpening({ ...opening, qty: e.target.value })} className={field} /></label>
          <label className="text-sm">Waktu saldo awal (WIB)<input type="datetime-local" required value={opening.at} onChange={e => setOpening({ ...opening, at: e.target.value })} className={field} /></label>
          <label className="text-sm">Catatan<input value={opening.note} onChange={e => setOpening({ ...opening, note: e.target.value })} className={field} /></label>
          <button className={button}>{saving ? 'Menyimpan...' : 'Simpan saldo awal'}</button>
        </fieldset></form>
      </details>}
    </section>}
    {data && ['in','out','count'].includes(mode) && <section className="p-5 rounded-xl border bg-white space-y-4">
      <button type="button" className="min-h-11 underline" onClick={() => setMode('saldo')}>Kembali ke stok opname</button>
      {mode !== 'out' && !admin ? <p>Hanya admin yang dapat mencatat penerimaan dan hitung fisik.</p> : <><h3 className="font-bold text-lg">{mode === 'in' ? 'Catat barang masuk' : mode === 'out' ? 'Catat pengambilan dapur' : 'Penyesuaian stok fisik'}</h3><p className="text-sm text-neutral-600">{mode === 'count' ? 'Masukkan jumlah fisik saat ini. Selisih dicatat sebagai penyesuaian dengan alasan, bukan pengambilan.' : mode === 'in' ? 'Isi jumlah yang baru datang saja. Contoh: stok 10 kg, datang 5 kg → isi 5; saldo menjadi 15 kg. Tambahan barang dapat dicatat kapan saja.' : 'Isi jumlah yang diambil. Saldo berkurang otomatis.'}</p>
      {!data.items.length ? <p>Tambahkan barang melalui halaman Stok opname terlebih dahulu.</p> : <form onSubmit={record}><fieldset disabled={saving} className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">Barang<select required value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} className={field}><option value="">Pilih barang</option>{data.items.map(i => <option key={i.id} value={i.id}>{i.name} — {number(i.balance)} {i.uom}</option>)}</select></label>
        <label className="text-sm">{mode === 'count' ? 'Jumlah fisik sekarang' : mode === 'in' ? 'Jumlah yang datang' : 'Jumlah yang diambil'} {item ? `(${item.uom})` : ''}<input required type="number" min={mode === 'count' ? '0' : '0.001'} step="0.001" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} className={field} /></label>
        <details className="sm:col-span-2"><summary className="cursor-pointer text-sm min-h-11">Ubah waktu pencatatan (opsional)</summary><label className="text-sm">Waktu kejadian (WIB)<input required type="datetime-local" value={form.at || wibInputTime()} onChange={e => setForm({ ...form, at: e.target.value })} className={field} /><span className="text-xs text-neutral-600">Masuk rekap {hint || '—'}.</span></label></details>
        {mode === 'in' && <label className="text-sm">Pemasok / asal barang (opsional)<input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} className={field} /></label>}
        {mode === 'out' && <label className="text-sm">Nama pengambil<input required value={form.person} onChange={e => setForm({ ...form, person: e.target.value })} className={field} /></label>}
        <label className="text-sm sm:col-span-2">{mode === 'count' ? 'Alasan / catatan hitung fisik (wajib)' : 'Keperluan / catatan'}<input required={mode === 'count'} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className={field} /></label>
        <button className={button}>{saving ? 'Menyimpan...' : 'Simpan transaksi'}</button>
      </fieldset></form>}</>}
    </section>}
    {data && mode === 'rekap' && <section className="space-y-4">
      <label className="block text-sm font-semibold">Versi rekap<select value={recapId} onChange={e => setRecapId(e.target.value)} className={`${field} mt-1`}><option value="">Data terkini</option>{current?.recaps.map(r => <option key={r.id} value={r.id}>Disimpan {time(r.created_at)}</option>)}</select></label>
      {report && <><p className="text-sm">Periode {time(report.start_at)} sampai {time(report.end_at)}.</p><p className="text-sm text-neutral-600">Stok awal mencakup saldo bawaan dan barang baru. {recap ? `Salinan tetap oleh ${recap.actor_email}. ${recap.note}` : 'Bisa diperiksa kapan saja. Pilih Data terkini untuk melihat tambahan transaksi, lalu simpan versi baru bila perlu.'}</p><Report report={report} /><button type="button" onClick={() => download(report)} className={button}>Unduh CSV</button>
        {admin && !recap && <div className="rounded-xl border p-4 bg-white space-y-3"><label className="block text-sm">Catatan rekap<input disabled={saving} value={recapNote} onChange={e => setRecapNote(e.target.value)} className={field} /></label><button disabled={saving || loading || !report.rows.length} type="button" className={button} onClick={() => void save('inventory_save_recap', { p_date: date, p_note: recapNote }, 'Rekap tersimpan. Transaksi selanjutnya tetap masuk buku stok.', () => setRecapNote(''))}>{saving ? 'Menyimpan...' : 'Simpan rekap admin'}</button></div>}</>}
    </section>}
    {data && mode === 'riwayat' && <section className="space-y-4"><p className="text-sm text-neutral-600">Riwayat periode pemakaian {date}. Koreksi menambah catatan baru, tanpa menghapus transaksi asli.</p><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[900px] text-sm text-left"><thead className="bg-neutral-100"><tr>{['Waktu kejadian','Barang / jenis','Perubahan','Pengambil / pemasok','Pencatat / waktu input','Catatan','Koreksi'].map(s => <th key={s} className="p-3">{s}</th>)}</tr></thead><tbody>{current?.movements.map(m => <tr key={m.id} className="border-t"><td className="p-3">{time(m.occurred_at)}</td><td className="p-3">{m.name}<span className="block text-xs">{labels[m.kind]}{m.reversed ? ' · dibatalkan' : ''}</span></td><td className="p-3 tabular-nums">{Number(m.delta) > 0 ? '+' : ''}{number(m.delta)} {m.uom}</td><td className="p-3">{m.person || m.supplier || '—'}</td><td className="p-3">{m.actor_email}<span className="block text-xs">{time(m.recorded_at)}</span></td><td className="p-3">{m.note}</td><td className="p-3">{admin && ['in','out'].includes(m.kind) && !m.reversed && <button disabled={saving} type="button" className="min-h-11 text-red-700 underline" onClick={() => setUndo({ id: m.id, item: m.item_id, name: m.name, at: new Date().toISOString(), note: '' })}>Batalkan</button>}</td></tr>)}</tbody></table>{current && !current.movements.length && <p className="p-4">Belum ada transaksi pada periode ini.</p>}</div>
      {undo && <form className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3" onSubmit={e => { e.preventDefault(); void save('inventory_record_movement', { p_item_id: undo.item, p_kind: 'reversal', p_quantity: 0, p_at: undo.at, p_reversed_id: undo.id, p_note: undo.note }, 'Pembatalan tercatat pada waktu koreksi.', () => setUndo(null)); }}><p>Batalkan transaksi {undo.name}? Koreksi dicatat sekarang.</p><label className="block text-sm">Alasan pembatalan<input required disabled={saving} value={undo.note} onChange={e => setUndo({ ...undo, note: e.target.value })} className={field} /></label><div className="flex gap-3"><button disabled={saving} className={button}>Konfirmasi pembatalan</button><button type="button" disabled={saving} onClick={() => setUndo(null)} className="min-h-11 underline">Kembali</button></div></form>}
    </section>}
  </div>;
}
