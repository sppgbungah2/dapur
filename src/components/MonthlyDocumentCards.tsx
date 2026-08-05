import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type DocumentTable = 'bast_docs' | 'surat_jalan_docs' | 'organoleptik_docs' | 'sops';

export default function MonthlyDocumentCards({ table, selectedDate, onSelectDate }: {
  table: DocumentTable; selectedDate: string; onSelectDate: (date: string) => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const month = selectedDate.slice(0, 7);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError(null);
      if (!isSupabaseConfigured || !supabase) {
        if (active) { setRows([]); setError('Supabase belum dikonfigurasi.'); setLoading(false); }
        return;
      }
      const start = `${month}-01`;
      const end = `${month}-31`;
      const { data, error: queryError } = await supabase.from(table).select('date,status,is_locked').gte('date', start).lte('date', end);
      if (!active) return;
      if (queryError) setError(queryError.message); else setRows(data || []);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [month, table]);

  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const statusFor = (date: string) => {
    const entries = rows.filter(row => row.date === date);
    if (!entries.length) return ['⚪', 'Belum Diinisiasi', 'border-neutral-200 bg-neutral-50 text-neutral-500'];
    if (entries.every(row => row.is_locked)) return ['🔒', 'Terkunci', 'border-neutral-800 bg-neutral-100 text-neutral-800'];
    if (entries.every(row => row.status === 'completed' || row.status === 'selesai')) return ['🟢', 'Lengkap / Terisi', 'border-emerald-300 bg-emerald-50 text-emerald-800'];
    if (entries.every(row => row.status === 'published')) return ['🔵', 'Diterbitkan', 'border-blue-300 bg-blue-50 text-blue-800'];
    return ['🟡', 'Draft / Diinisiasi', 'border-amber-300 bg-amber-50 text-amber-800'];
  };

  return <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs">
    <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-extrabold text-neutral-800">Dokumen per Hari — {month}</h3>{loading && <span className="text-xs text-neutral-400">Memuat…</span>}</div>
    {error && <p className="mb-3 text-xs font-semibold text-red-700">Gagal membaca status: {error}</p>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-10">
      {Array.from({ length: days }, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`;
        const [icon, label, style] = statusFor(date);
        return <button type="button" key={date} onClick={() => onSelectDate(date)} className={`rounded-xl border p-2 text-left transition hover:shadow-sm ${style}`}>
          <span className="block text-xs font-black">{index + 1} {icon}</span><span className="mt-1 block text-[9px] font-bold leading-tight">{label}</span>
        </button>;
      })}
    </div>
  </section>;
}
