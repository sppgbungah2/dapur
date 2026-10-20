import React, { useEffect, useRef, useState } from 'react';
import { supabase, UserProfile } from '../lib/supabase';
import { cardBalance, dailyStockCsv, DailyStockDoc, DailyStockRow, nextDailyStock, stockDifference, validateDailyStock, Warehouse } from '../lib/dailyStock';

const input = 'w-full min-h-11 rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm disabled:bg-neutral-50';
const button = 'min-h-11 rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white disabled:opacity-50';
const warehouses: Warehouse[] = ['kering', 'basah'];

export default function DailyStockOpnameView({ selectedDate, loggedInUser }: { selectedDate: string; loggedInUser?: UserProfile | null }) {
  const [month, setMonth] = useState(selectedDate.slice(0, 7) || new Date().toISOString().slice(0, 7));
  const [docs, setDocs] = useState<DailyStockDoc[]>([]);
  const [editor, setEditor] = useState<DailyStockDoc | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const draftKey = `daily_stock_${loggedInUser?.id || 'user'}`;
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    (async () => {
      try {
        if (!supabase) throw new Error('Database belum terhubung.');
        const result = await supabase.rpc('daily_stock_month', { p_month: `${month}-01` });
        if (result.error) throw new Error(result.error.code === 'PGRST202' ? 'Jalankan migrasi daily_stock_opname pada server terlebih dahulu.' : result.error.message);
        if (!cancelled) { setDocs(result.data.docs); setAdmin(result.data.admin); }
      } catch (e: any) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [month]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty || saving) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);
  const change = (next: DailyStockDoc) => {
    setEditor(next); setDirty(true); setNotice('');
    try { sessionStorage.setItem(`${draftKey}_${next.date}`, JSON.stringify(next)); } catch { /* Editor retains the draft. */ }
  };
  const open = (date: string) => {
    const saved = docs.find(d => d.date === date);
    const previous = docs.filter(d => d.date < date).sort((a, b) => b.date.localeCompare(a.date))[0];
    let next = saved || { date, revision: 0, items: nextDailyStock(previous) };
    let recovered = false;
    try {
      const draft = JSON.parse(sessionStorage.getItem(`${draftKey}_${date}`) || 'null');
      if (draft?.date === date && draft.items?.kering && draft.items?.basah) { next = draft; recovered = true; }
    } catch { /* Ignore malformed local draft. */ }
    setEditor(structuredClone(next)); setDirty(recovered); setError('');
    setNotice(recovered ? 'Isian yang belum tersimpan dipulihkan.' : !saved && previous ? `Daftar barang dan stok awal disalin dari ${previous.date}. Silakan periksa sebelum menyimpan.` : '');
  };
  const update = (warehouse: Warehouse, id: string, patch: Partial<DailyStockRow>) => {
    if (editor) change({ ...editor, items: { ...editor.items, [warehouse]: editor.items[warehouse].map(r => r.id === id ? { ...r, ...patch } : r) } });
  };
  const save = async () => {
    if (!editor || busy.current) return;
    try {
      validateDailyStock(editor.items);
      busy.current = true; setSaving(true); setError('');
      if (!supabase) throw new Error('Database belum terhubung.');
      const result = await supabase.rpc('save_daily_stock', { p_date: editor.date, p_revision: editor.revision, p_items: editor.items });
      if (result.error) throw new Error(result.error.message);
      const saved = result.data as DailyStockDoc;
      setEditor(saved); setDocs(prev => [...prev.filter(d => d.date !== saved.date), saved]);
      setDirty(false); setNotice('Stok opname kedua gudang tersimpan.');
      try { sessionStorage.removeItem(`${draftKey}_${saved.date}`); } catch { /* Cloud copy is saved. */ }
    } catch (e: any) { setError(e.message); }
    finally { busy.current = false; setSaving(false); }
  };
  const download = () => {
    if (!editor) return;
    const url = URL.createObjectURL(new Blob([dailyStockCsv(editor)], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `Stock_Opname_${editor.date}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return <div className="max-w-7xl mx-auto space-y-5">
    <header><h2 className="text-2xl font-bold">Stock opname gudang</h2><p className="text-sm text-neutral-600 mt-2">Satu kartu per tanggal, berisi Gudang Kering dan Gudang Basah.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} Isian belum dihapus.</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{notice}</p>}
    {!editor ? <>
      <label className="block max-w-xs font-semibold">Bulan<input type="month" className={`${input} mt-1`} value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }} /></label>
      {loading ? <p>Memuat kartu harian...</p> : !error && <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">{Array.from({ length: days }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        const doc = docs.find(d => d.date === date);
        return <button key={date} onClick={() => open(date)} className="rounded-xl border border-neutral-200 bg-white p-4 text-left hover:border-emerald-600 focus:ring-2 focus:ring-emerald-600">
          <span className="block text-2xl font-bold">{i + 1}</span>
          <span className="block text-sm mt-2">{doc ? 'Tersimpan' : 'Belum diisi'}</span>
          {warehouses.map(w => <span key={w} className="block text-xs mt-1 capitalize">{w}: {doc?.items[w].length || 0} barang</span>)}
        </button>;
      })}</div>}
    </> : <>
      <div className="flex flex-wrap gap-3 items-center">
        <button disabled={saving} className="min-h-11 underline" onClick={() => { setEditor(null); setNotice(dirty ? 'Isian sementara disimpan di perangkat ini. Buka tanggal yang sama untuk melanjutkan.' : ''); }}>Kembali ke kartu bulanan</button>
        <h3 className="text-xl font-bold">{new Date(`${editor.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
        <span className="text-sm">{dirty ? 'Belum disimpan' : editor.revision ? 'Tersimpan' : 'Belum diisi'}</span>
      </div>
      <p className="text-sm text-neutral-600">Saldo kartu = stok gudang + barang datang − pemakaian. Selisih = fisik − saldo kartu (minus berarti kurang). Fisik boleh dikosongkan jika belum dihitung.</p>
      {warehouses.map(warehouse => <section key={warehouse} className="rounded-xl border bg-white p-4 space-y-3">
        <h3 className="text-lg font-bold">Gudang {warehouse === 'kering' ? 'Kering' : 'Basah'}</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm text-left"><thead className="bg-neutral-100"><tr>{['Nama bahan makanan', 'Satuan', 'Stok gudang (awal)', 'Barang datang', 'Pemakaian', 'Saldo kartu', 'Fisik', 'Selisih', 'Keterangan', ''].map((s, i) => <th key={i} className="p-2">{s}</th>)}</tr></thead>
          <tbody>{editor.items[warehouse].map((row, index) => <tr key={row.id} className="border-t">
            {(['name', 'uom', 'stock', 'incoming', 'usage'] as const).map(key => <td key={key} className="p-1"><input aria-label={`${warehouse} ${index + 1} ${key}`} className={`${input} ${key === 'name' ? 'min-w-40' : 'min-w-20'}`} disabled={!admin || saving} type={['name', 'uom'].includes(key) ? 'text' : 'number'} min="0" step="0.001" value={row[key]} onChange={e => update(warehouse, row.id, { [key]: ['name', 'uom'].includes(key) ? e.target.value : e.target.value === '' ? '' : Number(e.target.value) })} /></td>)}
            <td className="p-2 tabular-nums">{cardBalance(row)}</td>
            <td className="p-1"><input aria-label={`Fisik ${row.name || index + 1} ${warehouse}`} className={`${input} min-w-20`} disabled={!admin || saving} type="number" min="0" step="0.001" value={row.physical} onChange={e => update(warehouse, row.id, { physical: e.target.value === '' ? '' : Number(e.target.value) })} /></td>
            <td className="p-2 font-semibold tabular-nums">{stockDifference(row) === '' ? '—' : stockDifference(row)}</td>
            <td className="p-1"><input aria-label={`Keterangan ${row.name || index + 1} ${warehouse}`} className={`${input} min-w-40`} disabled={!admin || saving} value={row.note} onChange={e => update(warehouse, row.id, { note: e.target.value })} /></td>
            <td>{admin && <button aria-label={`Hapus ${row.name || 'baris'} ${warehouse}`} disabled={saving} className="min-h-11 px-2 text-red-700" onClick={() => change({ ...editor, items: { ...editor.items, [warehouse]: editor.items[warehouse].filter(r => r.id !== row.id) } })}>Hapus</button>}</td>
          </tr>)}</tbody></table></div>
        {!editor.items[warehouse].length && <p className="text-sm text-neutral-500">Belum ada barang.</p>}
        {admin && <button disabled={saving} className={button} onClick={() => change({ ...editor, items: { ...editor.items, [warehouse]: [...editor.items[warehouse], { id: crypto.randomUUID(), name: '', uom: 'Kg', stock: 0, incoming: 0, usage: 0, physical: '', note: '' }] } })}>Tambah barang</button>}
      </section>)}
      <div className="flex flex-wrap gap-3">{admin && <button disabled={saving} className={button} onClick={() => void save()}>{saving ? 'Menyimpan...' : 'Simpan stok opname'}</button>}<button className={button} onClick={download}>Unduh rekap CSV</button></div>
      {error && <button disabled={saving} className="min-h-11 underline" onClick={async () => {
        if (!supabase || !window.confirm('Ganti isian tanggal ini dengan data terakhir yang tersimpan di server? Unduh CSV dahulu jika ingin menyimpan salinan isian Anda.')) return;
        const result = await supabase.rpc('daily_stock_month', { p_month: `${month}-01` });
        if (result.error) { setError(result.error.message); return; }
        const saved = (result.data.docs as DailyStockDoc[]).find(d => d.date === editor.date);
        setDocs(result.data.docs);
        setEditor(saved || { date: editor.date, revision: 0, items: { kering: [], basah: [] } });
        setDirty(false); setError('');
        try { sessionStorage.removeItem(`${draftKey}_${editor.date}`); } catch { /* Server copy remains available. */ }
      }}>Muat ulang data tersimpan</button>}
    </>}
  </div>;
}
