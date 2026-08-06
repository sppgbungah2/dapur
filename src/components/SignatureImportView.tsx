import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSignature, Loader2, Upload } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Division } from '../types';
import { DELIVERY_TARGETS } from '../utils/deliveryMaster';

export type SignatureRecord = {
  documentType: 'SOP' | 'BAST' | 'SURAT_JALAN' | 'ORGANOLEPTIK';
  target: string;
  role: string;
  name: string;
  signatureUrl: string;
  status: string;
};

const normalize = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const get = (row: Record<string, unknown>, names: string[]) => Object.entries(row).find(([key]) => names.includes(normalize(key)))?.[1];
const dateValue = (value: unknown) => {
  const master = normalize(value);
  if (!master || ['master', 'default', 'masterttd', 'ttddefault'].includes(master)) return 'MASTER_DEFAULT';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  const text = String(value ?? '').trim();
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const id = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  return id ? `${id[3]}-${id[2].padStart(2, '0')}-${id[1].padStart(2, '0')}` : null;
};

const SOP_PRIMARY_ROLE: Record<Division, string> = {
  [Division.STOCKING]: 'Aslap',
  [Division.MASAK]: 'Chef',
  [Division.PEMORSIAN]: 'Ahli Gizi',
  [Division.DRIVER]: 'Aslap',
  [Division.CUCI]: 'Aslap',
  [Division.KEBERSIHAN]: 'Aslap',
  [Division.KEAMANAN]: 'Aslap'
};
const deliveryRows = (documentType: 'BAST' | 'SURAT_JALAN' | 'ORGANOLEPTIK', roles: string[]) => DELIVERY_TARGETS.flatMap(target => roles.map(role => ({ documentType, target, role })));

export default function SignatureImportView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const downloadTemplate = () => {
    const rows = [
      ...Object.values(Division).flatMap(target => [SOP_PRIMARY_ROLE[target], 'Koordinator'].map(role => ({ Tanggal: 'MASTER_DEFAULT', Dokumen: 'SOP', 'Target / Divisi': target, Peran: role, Nama: '', 'URL TTD': '', Status: 'Master Default' }))),
      ...deliveryRows('BAST', ['Driver', 'Penerima']).map(row => ({ Tanggal: 'MASTER_DEFAULT', Dokumen: row.documentType, 'Target / Divisi': row.target, Peran: row.role, Nama: '', 'URL TTD': '', Status: 'Master Default' })),
      ...deliveryRows('SURAT_JALAN', ['Aslap', 'Penerima']).map(row => ({ Tanggal: 'MASTER_DEFAULT', Dokumen: 'Surat Jalan', 'Target / Divisi': row.target, Peran: row.role, Nama: '', 'URL TTD': '', Status: 'Master Default' })),
      ...deliveryRows('ORGANOLEPTIK', ['Panelis']).map(row => ({ Tanggal: 'MASTER_DEFAULT', Dokumen: 'Organoleptik', 'Target / Divisi': row.target, Peran: row.role, Nama: '', 'URL TTD': '', Status: 'Master Default' }))
    ];
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 30 }, { wch: 55 }, { wch: 22 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'TTD Dokumen');
    XLSX.writeFile(book, 'Template_Impor_TTD_Borongan.xlsx');
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !supabase || !isSupabaseConfigured) return setMessage({ type: 'error', text: 'Supabase belum dikonfigurasi.' });
    setLoading(true); setMessage(null);
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: '' });
      // TTD Borongan adalah master bersama, bukan konfigurasi per tanggal.
      // Kolom Tanggal pada berkas lama tetap boleh ada, tetapi seluruh baris
      // selalu disimpan ke satu master agar tidak perlu unggah ulang tiap hari.
      const importedRecords: SignatureRecord[] = [];
      const errors: string[] = [];
      rows.forEach((row, index) => {
        const rawDoc = normalize(get(row, ['dokumen', 'jenisdokumen', 'documenttype']));
        const documentType = rawDoc === 'sop' ? 'SOP' : rawDoc === 'bast' ? 'BAST' : rawDoc === 'suratjalan' || rawDoc === 'sj' ? 'SURAT_JALAN' : rawDoc === 'organoleptik' || rawDoc === 'orlep' ? 'ORGANOLEPTIK' : null;
        const target = String(get(row, ['targetdivisi', 'target', 'divisi', 'lokasi']) ?? '').trim();
        const role = String(get(row, ['peran', 'role']) ?? '').trim();
        const name = String(get(row, ['nama', 'namapenandatangan']) ?? '').trim();
        const signatureUrl = String(get(row, ['urlttd', 'urltandatangan', 'signatureurl']) ?? '').trim();
        const status = String(get(row, ['status']) ?? '').trim();
        if (!documentType || !target || !role || !name || !signatureUrl) {
          errors.push(`Baris ${index + 2} belum lengkap.`); return;
        }
        const value: SignatureRecord = { documentType, target, role, name, signatureUrl, status };
        importedRecords.push(value);
      });
      if (errors.length) throw new Error(`${errors.slice(0, 5).join(' ')}${errors.length > 5 ? ` (+${errors.length - 5} lainnya)` : ''}`);
      if (!importedRecords.length) throw new Error('Tidak ada data TTD yang dapat diimpor.');
      const masterDate = 'MASTER_DEFAULT';
      const { data: current, error: fetchError } = await supabase.from('borongan_signatories').select('date, signatories').eq('date', masterDate).maybeSingle();
      if (fetchError) throw fetchError;
      const existingRecords = current?.signatories?.records || [];
      const merged = [...existingRecords, ...importedRecords].reduce((result: SignatureRecord[], row) => {
        const key = `${row.documentType}|${row.target}|${row.role}`.toLowerCase();
        const index = result.findIndex(item => `${item.documentType}|${item.target}|${item.role}`.toLowerCase() === key);
        if (index >= 0) result[index] = row; else result.push(row);
        return result;
      }, []);
      const { error } = await supabase.from('borongan_signatories').upsert({ date: masterDate, signatories: { records: merged }, updated_at: new Date().toISOString() }, { onConflict: 'date' });
      if (error) throw error;
      // Do not report success before the REST read confirms the write is visible to Supabase.
      let visible = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data, error: readError } = await supabase.from('borongan_signatories').select('date, signatories').eq('date', masterDate);
        if (readError) throw readError;
        visible = (data || []).every((item: any) => Array.isArray(item.signatories?.records) && item.signatories.records.length > 0);
        if (visible) break;
        await new Promise(resolve => setTimeout(resolve, 450));
      }
      if (!visible) throw new Error('Data TTD belum terlihat kembali dari Supabase. Coba unggah ulang setelah koneksi stabil.');
      setMessage({ type: 'success', text: `${importedRecords.length} baris TTD tersimpan sebagai Master Default dan akan dipakai untuk semua tanggal.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: `Impor TTD gagal: ${error?.message || 'berkas tidak dapat dibaca.'}` });
    } finally { setLoading(false); }
  };

  return <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="flex items-center gap-2 text-lg font-black text-violet-950"><FileSignature className="h-5 w-5 text-violet-600" /> Master TTD Default</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-violet-800">Unggah sekali sebagai master. Semua tanggal akan memakai TTD ini saat Paraf Otomatis. Kolom Tanggal pada berkas lama diabaikan; template memakai <strong>MASTER_DEFAULT</strong>.</p></div><div className="flex flex-wrap gap-2"><button onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-800"><Download className="h-4 w-4" /> Unduh Template TTD</button><input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={importFile} className="hidden"/><button onClick={() => inputRef.current?.click()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Upload className="h-4 w-4"/>}{loading ? 'Menyimpan Master...' : 'Unggah Master TTD'}</button></div></div>{message && <div className={`mt-4 rounded-xl border p-3 text-xs font-bold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{message.text}</div>}</div>;
}
