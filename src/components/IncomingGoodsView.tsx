import React, { useState, useEffect } from 'react';
import { 
  Truck, Save, Clipboard, X, Plus, CheckCircle, FileText, 
  Search, Info, Trash2, ShieldCheck, ClipboardCheck 
} from 'lucide-react';

export interface KedatanganBarangItem {
  id: string;
  name: string;
  qty: number;
  uom: string;
  supplier: string;
  checker: 'LENGKAP' | 'KURANG' | 'BATAL';
  input: 'SUDAH' | 'BELUM';
  specification: string;
}

export interface SavedReport {
  id: string;
  date: string;
  module: 'stock' | 'operasional' | 'kedatangan';
  timestamp: string;
  fileName: string;
  itemCount: number;
  headers: string[];
  rows: string[][];
}

interface IncomingGoodsViewProps {
  selectedDate: string;
  isInitialFetchDone: boolean;
  kedatanganMap: Record<string, KedatanganBarangItem[]>;
  setKedatanganMap: React.Dispatch<React.SetStateAction<Record<string, KedatanganBarangItem[]>>>;
  savedReports: SavedReport[];
  addSavedReport: (
    date: string, 
    module: 'stock' | 'operasional' | 'kedatangan', 
    fileName: string, 
    itemCount: number, 
    headers: string[], 
    rows: string[][]
  ) => void;
  triggerSuccessMsg: (msg: string) => void;
  successMsg: string | null;
  isSupabaseConfigured: boolean;
}

// Inline implementation of downloadCSV helper to make this component completely robust
function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const cleanVal = (val: string) => {
    let clean = val || '';
    clean = clean.replace(/"/g, '""');
    if (clean.includes(',') || clean.includes('\n') || clean.includes('"')) {
      return `"${clean}"`;
    }
    return clean;
  };

  const csvContent = [
    headers.map(cleanVal).join(','),
    ...rows.map(row => row.map(cleanVal).join(','))
  ].join('\n');

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// SOP templates for when a date doesn't have initial data yet
function getSopTemplateForDate(dateStr: string): Omit<KedatanganBarangItem, 'id'>[] {
  // Simple templates for initial values
  return [
    {
      name: 'Beras Premium Sentra Ramos',
      qty: 150,
      uom: 'kg',
      supplier: 'Sedayu Logistik',
      checker: 'LENGKAP',
      input: 'SUDAH',
      specification: 'Beras pulen, patahan maksimal 5%, bersih dari kutu, batu, kulit ari padi. Kemasan utuh 25kg.'
    },
    {
      name: 'Ayam Frozen Halal',
      qty: 45,
      uom: 'kg',
      supplier: 'Mitra Unggas Gresik',
      checker: 'LENGKAP',
      input: 'SUDAH',
      specification: 'Kondisi beku (freezer) -18°C, bersih dari darah berlebih, tidak berbau busuk, potongan paha/dada.'
    },
    {
      name: 'Sawi Hijau Organik',
      qty: 12,
      uom: 'kg',
      supplier: 'Kebun Gizi Ponpes',
      checker: 'LENGKAP',
      input: 'SUDAH',
      specification: 'Segar baru petik, warna hijau cerah, minim lubang hama, tidak layu, bebas pestisida kimia.'
    },
    {
      name: 'Minyak Goreng Sawit',
      qty: 4,
      uom: 'L',
      supplier: 'Sule Swalayan',
      checker: 'LENGKAP',
      input: 'SUDAH',
      specification: 'Kemasan jerigen rapat, warna kuning keemasan jernih, tidak tengik, merk Bimoli/Filma.'
    },
    {
      name: 'Tempe Papan Ponpes',
      qty: 25,
      uom: 'pcs',
      supplier: 'UKM Tempe Bungah',
      checker: 'LENGKAP',
      input: 'SUDAH',
      specification: 'Kerapatan jamur putih merata, tekstur padat tidak lembek, aroma khas tempe segar, bungkus daun pisang.'
    }
  ];
}

export default function IncomingGoodsView({
  selectedDate,
  isInitialFetchDone,
  kedatanganMap,
  setKedatanganMap,
  savedReports,
  addSavedReport,
  triggerSuccessMsg,
  successMsg,
  isSupabaseConfigured
}: IncomingGoodsViewProps) {
  const activeDate = selectedDate || '2026-06-16';
  const itemsList = kedatanganMap[activeDate] || [];

  // Local States
  const [localKdDate, setLocalKdDate] = useState<string>(activeDate);
  const [isAddingKedatangan, setIsAddingKedatangan] = useState(false);
  const [kdTab, setKdTab] = useState<'rekap' | 'detail'>('rekap');
  const [newKdName, setNewKdName] = useState('');
  const [newKdQty, setNewKdQty] = useState('');
  const [newKdUom, setNewKdUom] = useState('kg');
  const [newKdSupplier, setNewKdSupplier] = useState('');
  const [newKdChecker, setNewKdChecker] = useState<'LENGKAP' | 'KURANG' | 'BATAL'>('LENGKAP');
  const [newKdInput, setNewKdInput] = useState<'SUDAH' | 'BELUM'>('SUDAH');
  const [newKdSpec, setNewKdSpec] = useState('');
  const [kdSearchTerm, setKdSearchTerm] = useState('');
  const [activeKdSpecItem, setActiveKdSpecItem] = useState<KedatanganBarangItem | null>(null);
  const [showSopPrintView, setShowSopPrintView] = useState(false);

  // Sync state date when selectedDate prop changes
  useEffect(() => {
    if (selectedDate) {
      setLocalKdDate(selectedDate);
    }
  }, [selectedDate]);

  // Ensure initial data exists for localKdDate
  useEffect(() => {
    if (!isInitialFetchDone) return;

    const targetDate = localKdDate || '2026-06-16';
    if (!kedatanganMap[targetDate]) {
      const initial = getSopTemplateForDate(targetDate).map((item, idx) => ({
        ...item,
        id: `kd-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`
      })) as KedatanganBarangItem[];

      setKedatanganMap(prev => {
        if (prev[targetDate]) return prev;
        return {
          ...prev,
          [targetDate]: initial
        };
      });
    }
  }, [localKdDate, isInitialFetchDone, kedatanganMap, setKedatanganMap]);

  const activeDateItems = kedatanganMap[localKdDate || '2026-06-16'] || [];
  const filteredList = activeDateItems.filter(item => 
    item.name.toLowerCase().includes(kdSearchTerm.toLowerCase()) ||
    item.supplier.toLowerCase().includes(kdSearchTerm.toLowerCase())
  );

  // Statistics
  const totalItems = activeDateItems.length;
  const lengkapCount = activeDateItems.filter(i => i.checker === 'LENGKAP').length;
  const kurangCount = activeDateItems.filter(i => i.checker === 'KURANG').length;
  const batalCount = activeDateItems.filter(i => i.checker === 'BATAL').length;
  const inputCount = activeDateItems.filter(i => i.input === 'SUDAH').length;

  const handleAddIncoming = () => {
    if (!newKdName.trim()) {
      alert('Nama barang wajib diisi!');
      return;
    }
    const qtyNum = parseFloat(newKdQty) || 0;
    const newItem: KedatanganBarangItem = {
      id: `kd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newKdName.trim(),
      qty: qtyNum,
      uom: newKdUom,
      supplier: newKdSupplier.trim() || 'Supplier Umum',
      checker: newKdChecker,
      input: newKdInput,
      specification: newKdSpec.trim() || 'Tidak ada spesifikasi khusus.'
    };

    const targetDate = localKdDate || '2026-06-16';
    setKedatanganMap(prev => {
      const current = prev[targetDate] || [];
      return {
        ...prev,
        [targetDate]: [newItem, ...current]
      };
    });

    // Reset Form
    setNewKdName('');
    setNewKdQty('');
    setNewKdSupplier('');
    setNewKdSpec('');
    setIsAddingKedatangan(false);
    triggerSuccessMsg(`Sukses mencatat kedatangan barang: ${newKdName}`);
  };

  const handleUpdateChecker = (id: string, value: 'LENGKAP' | 'KURANG' | 'BATAL') => {
    const targetDate = localKdDate || '2026-06-16';
    setKedatanganMap(prev => {
      const current = prev[targetDate] || [];
      const updated = current.map(item => 
        item.id === id ? { ...item, checker: value } : item
      );
      return {
        ...prev,
        [targetDate]: updated
      };
    });
    triggerSuccessMsg(`Status pemeriksaan barang diperbarui.`);
  };

  const handleToggleInput = (id: string) => {
    const targetDate = localKdDate || '2026-06-16';
    setKedatanganMap(prev => {
      const current = prev[targetDate] || [];
      const updated = current.map(item => 
        item.id === id ? { ...item, input: item.input === 'SUDAH' ? 'BELUM' as const : 'SUDAH' as const } : item
      );
      return {
        ...prev,
        [targetDate]: updated
      };
    });
    triggerSuccessMsg(`Status input inventori diperbarui.`);
  };

  const handleDeleteItem = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus catatan kedatangan barang ini?')) {
      const targetDate = localKdDate || '2026-06-16';
      setKedatanganMap(prev => {
        const current = prev[targetDate] || [];
        return {
          ...prev,
          [targetDate]: current.filter(item => item.id !== id)
        };
      });
      triggerSuccessMsg(`Catatan kedatangan berhasil dihapus.`);
    }
  };

  const exportKedatanganToCSV = (dateStr: string, items: KedatanganBarangItem[]) => {
    const filename = `Laporan_Kedatangan_Barang_${dateStr}.csv`;
    const headers = ['Nama Barang', 'Jumlah', 'Satuan (UoM)', 'Supplier', 'Hasil Pemeriksaan Fisik', 'Status Input Inventori', 'Spesifikasi'];
    const rows = items.map(item => [
      item.name,
      String(item.qty),
      item.uom,
      item.supplier,
      item.checker,
      item.input,
      item.specification || ''
    ]);
    
    addSavedReport(dateStr, 'kedatangan', filename, items.length, headers, rows);
    downloadCSV(filename, headers, rows);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
            <Truck className="h-6 w-6 text-emerald-700" />
            Penerimaan & Kedatangan Barang Logistik
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Pengecekan kesesuaian bumbu, sayur, daging, dan gas yang dikirim supplier SPPG.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              triggerSuccessMsg(`Berhasil merekam data pemeriksaan fisik tanggal ${localKdDate} ke sistem database logistik SPPG dan mengunduh Excel!`);
              exportKedatanganToCSV(localKdDate, activeDateItems);
            }}
            className="bg-emerald-700 hover:bg-emerald-850 text-white text-xs font-bold px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Save className="h-4 w-4" /> Simpan & Ekspor Excel
          </button>
          
          <button
            onClick={() => setShowSopPrintView(true)}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 text-xs font-bold px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs active:scale-[0.98] cursor-pointer"
          >
            <Clipboard className="h-4 w-4 text-stone-600" /> Cetak / Print SOP
          </button>

          <button
            onClick={() => setIsAddingKedatangan(!isAddingKedatangan)}
            className="bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-semibold px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isAddingKedatangan ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} 
            {isAddingKedatangan ? 'Batal' : 'Tambah Barang'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setKdTab('rekap')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            kdTab === 'rekap' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          📊 Semua Hari (Rekap Kartu)
        </button>
        <button
          onClick={() => setKdTab('detail')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            kdTab === 'detail' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          📝 Detail Pemeriksaan Harian ({localKdDate})
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="h-4 w-4 animate-bounce" /> {successMsg}
        </div>
      )}

      {kdTab === 'rekap' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const datesWithData = Array.from(new Set([
                ...Object.keys(kedatanganMap),
                '2026-06-16',
                '2026-06-17',
                '2026-06-18',
                '2026-06-19',
                '2026-06-20'
              ])).sort().reverse();

              return datesWithData.map(date => {
                const items = kedatanganMap[date] || [];
                const total = items.length;
                const lengkap = items.filter(i => i.checker === 'LENGKAP').length;
                const kurang = items.filter(i => i.checker === 'KURANG').length;
                const batal = items.filter(i => i.checker === 'BATAL').length;

                // Day label
                const daysInIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const parsedDate = new Date(date);
                const dayName = isNaN(parsedDate.getTime()) ? 'Hari' : daysInIndo[parsedDate.getDay()];

                return (
                  <div key={date} className="bg-white border border-neutral-200 rounded-xl shadow-2xs hover:border-emerald-400 hover:shadow-xs transition-all p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="bg-neutral-100 text-neutral-800 text-[10px] font-black px-2 py-0.5 rounded font-mono">
                          {date}
                        </span>
                        <span className="text-xs font-black text-neutral-500">{dayName}</span>
                      </div>
                      <h3 className="text-sm font-bold text-neutral-800">
                        Penerimaan Logistik SPPG
                      </h3>
                      <p className="text-[11px] text-neutral-500 line-clamp-2">
                        {total > 0 
                          ? `Menerima ${total} item logistik dari supplier (e.g. ${items.slice(0, 2).map(i => i.name).join(', ')}).`
                          : 'Belum ada item logistik yang dicatat untuk hari ini.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-center py-2 border-y border-neutral-100">
                      <div className="bg-emerald-50 rounded p-1.5">
                        <span className="text-[8px] text-emerald-700 block font-bold">LENGKAP</span>
                        <span className="text-xs font-extrabold text-emerald-950 font-mono">{lengkap}</span>
                      </div>
                      <div className="bg-amber-50 rounded p-1.5">
                        <span className="text-[8px] text-amber-700 block font-bold">KURANG</span>
                        <span className="text-xs font-extrabold text-amber-950 font-mono">{kurang}</span>
                      </div>
                      <div className="bg-red-50 rounded p-1.5">
                        <span className="text-[8px] text-red-700 block font-bold">BATAL</span>
                        <span className="text-xs font-extrabold text-red-950 font-mono">{batal}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                      <button
                        onClick={() => {
                          setLocalKdDate(date);
                          setKdTab('detail');
                        }}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg transition-colors flex-1 text-center cursor-pointer"
                      >
                        Buka Detail
                      </button>
                      <button
                        onClick={() => {
                          exportKedatanganToCSV(date, items);
                          triggerSuccessMsg(`Laporan logistik untuk ${date} berhasil diunduh!`);
                        }}
                        className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-2.5 py-1.5 rounded-lg transition-colors border border-stone-200 cursor-pointer"
                        title="Unduh Excel"
                      >
                        📥 Unduh Excel
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Saved Reports Section for Kedatangan Barang */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-3 mt-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-emerald-800" />
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 font-mono">Daftar Laporan Kedatangan Barang Tersimpan</h3>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold px-2.5 py-0.5 rounded-full">
                {savedReports.filter(r => r.module === 'kedatangan').length} File
              </span>
            </div>
            {savedReports.filter(r => r.module === 'kedatangan').length === 0 ? (
              <p className="text-[11px] text-neutral-450 italic py-4 text-center">Belum ada laporan Excel yang disimpan atau diunduh.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-[9px] text-neutral-400 font-bold uppercase">
                      <th className="p-2">Nama File Excel</th>
                      <th className="p-2">Tanggal Kedatangan</th>
                      <th className="p-2 text-center">Jumlah Item</th>
                      <th className="p-2">Waktu Tersimpan</th>
                      <th className="p-2 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {savedReports.filter(r => r.module === 'kedatangan').map(rep => (
                      <tr key={rep.id} className="hover:bg-neutral-50/50">
                        <td className="p-2 font-mono text-emerald-900 font-semibold">{rep.fileName}</td>
                        <td className="p-2 font-bold text-neutral-700">{rep.date}</td>
                        <td className="p-2 text-center font-semibold font-mono">{rep.itemCount}</td>
                        <td className="p-2 text-neutral-500">{rep.timestamp}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              downloadCSV(rep.fileName, rep.headers, rep.rows);
                              triggerSuccessMsg(`Laporan "${rep.fileName}" berhasil diunduh kembali!`);
                            }}
                            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all"
                          >
                            📥 Download Excel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* Stats Summary Panel */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-neutral-50/50 p-3 rounded-xl border border-neutral-100 text-center">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Total Item</p>
              <p className="text-xl font-black text-neutral-800 mt-0.5">{totalItems}</p>
            </div>
            <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100 text-center">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Lengkap</p>
              <p className="text-xl font-black text-emerald-800 mt-0.5">{lengkapCount}</p>
            </div>
            <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-100 text-center">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Kurang</p>
              <p className="text-xl font-black text-neutral-800 mt-0.5">{kurangCount}</p>
            </div>
            <div className="bg-red-50/40 p-3 rounded-xl border border-red-100 text-center">
              <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Batal / Ditolak</p>
              <p className="text-xl font-black text-red-600 mt-0.5">{batalCount}</p>
            </div>
            <div className="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 text-center col-span-2 md:col-span-1">
              <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Sudah Input Stok</p>
              <p className="text-xl font-black text-neutral-800 mt-0.5">{inputCount} <span className="text-xs font-normal text-neutral-400">/ {totalItems}</span></p>
            </div>
          </div>

          {/* Add Form Component */}
          {isAddingKedatangan && (
            <div className="p-5 border border-emerald-100 rounded-xl bg-emerald-50/10 space-y-4">
              <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-1.5 border-b border-neutral-100 pb-2">
                <Plus className="h-4 w-4 text-emerald-700" /> Form Pencatatan Barang Kedatangan Baru
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Nama Barang / Bahan *</label>
                  <input
                    type="text"
                    value={newKdName}
                    onChange={(e) => setNewKdName(e.target.value)}
                    placeholder="Contoh: ayam potong, beras, dll"
                    className="w-full p-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-800 bg-white text-neutral-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Jumlah *</label>
                    <input
                      type="number"
                      value={newKdQty}
                      onChange={(e) => setNewKdQty(e.target.value)}
                      placeholder="Contoh: 265"
                      className="w-full p-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-800 bg-white text-neutral-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Satuan</label>
                    <select
                      value={newKdUom}
                      onChange={(e) => setNewKdUom(e.target.value)}
                      className="w-full p-2.5 border border-neutral-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-800 text-neutral-800"
                    >
                      <option value="kg">kg</option>
                      <option value="pcs">pcs</option>
                      <option value="L">Liter</option>
                      <option value="Galon">Galon</option>
                      <option value="rtg">Renteng</option>
                      <option value="karung">Karung</option>
                      <option value="ikat">Ikat</option>
                      <option value="pack">Pack</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Nama Supplier</label>
                  <input
                    type="text"
                    value={newKdSupplier}
                    onChange={(e) => setNewKdSupplier(e.target.value)}
                    placeholder="Contoh: SULE, SIDAYU, PAK MAFTUH"
                    className="w-full p-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-800 bg-white text-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Hasil Pemeriksaan Fisik</label>
                  <select
                    value={newKdChecker}
                    onChange={(e) => setNewKdChecker(e.target.value as any)}
                    className="w-full p-2.5 border border-neutral-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-800 font-semibold text-neutral-800"
                  >
                    <option value="LENGKAP">✅ LENGKAP & SESUAI</option>
                    <option value="KURANG">⚠️ JUMLAH KURANG</option>
                    <option value="BATAL">❌ BATAL TERIMA / DITOLAK</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Status Input Inventori</label>
                  <select
                    value={newKdInput}
                    onChange={(e) => setNewKdInput(e.target.value as any)}
                    className="w-full p-2.5 border border-neutral-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-800 font-semibold text-neutral-800"
                  >
                    <option value="BELUM">⏳ BELUM DI-INPUT</option>
                    <option value="SUDAH">🟢 SUDAH DI-INPUT</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Spesifikasi Standard Mutu Gizi & Organoleptik</label>
                  <textarea
                    rows={3}
                    value={newKdSpec}
                    onChange={(e) => setNewKdSpec(e.target.value)}
                    placeholder="Deskripsikan kriteria fisik bahan yang lolos standar mutu (contoh: warna, kebersihan, kemasan, tekstur, dll)"
                    className="w-full p-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-800 font-mono text-[11px] bg-white text-neutral-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingKedatangan(false)}
                  className="px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 font-medium text-neutral-600 text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleAddIncoming}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-xs transition-colors"
                >
                  Simpan Catatan
                </button>
              </div>
            </div>
          )}

          {/* Search Toolbar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={kdSearchTerm}
                onChange={(e) => setKdSearchTerm(e.target.value)}
                placeholder="Cari nama bahan, atau supplier..."
                className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-800 bg-white text-neutral-800"
              />
            </div>
          </div>

          {/* Items Table/Grid list */}
          <div className="border border-neutral-100 rounded-xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50/75 border-b border-neutral-150 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Nama Bahan</th>
                    <th className="p-4 text-right">Jumlah</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Pemeriksaan Fisik</th>
                    <th className="p-4 text-center">Spesifikasi Mutu</th>
                    <th className="p-4 text-center">Inventori</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-neutral-400 font-medium">
                        Tidak ada data kedatangan barang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="p-4 font-bold text-neutral-900 capitalize">
                          {item.name}
                        </td>
                        <td className="p-4 text-right font-mono font-semibold text-neutral-850">
                          {item.qty} <span className="text-[10px] text-neutral-450 font-normal lowercase">{item.uom}</span>
                        </td>
                        <td className="p-4 font-semibold text-emerald-950">
                          {item.supplier}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdateChecker(item.id, 'LENGKAP')}
                              className={`px-2 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all border ${
                                item.checker === 'LENGKAP'
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                                  : 'bg-white hover:bg-neutral-50 text-neutral-500 border-neutral-200'
                              }`}
                            >
                              LENGKAP
                            </button>
                            <button
                              onClick={() => handleUpdateChecker(item.id, 'KURANG')}
                              className={`px-2 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all border ${
                                item.checker === 'KURANG'
                                  ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                                  : 'bg-white hover:bg-neutral-50 text-neutral-500 border-neutral-200'
                              }`}
                            >
                              KURANG
                            </button>
                            <button
                              onClick={() => handleUpdateChecker(item.id, 'BATAL')}
                              className={`px-2 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all border ${
                                item.checker === 'BATAL'
                                  ? 'bg-red-600 border-red-600 text-white shadow-2xs'
                                  : 'bg-white hover:bg-neutral-50 text-neutral-500 border-neutral-200'
                              }`}
                            >
                              BATAL
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setActiveKdSpecItem(item)}
                            className="text-emerald-850 hover:text-emerald-950 font-bold flex items-center gap-1 mx-auto hover:underline"
                          >
                            <Info className="h-3.5 w-3.5" /> Detail Mutu
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleInput(item.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border transition-all ${
                              item.input === 'SUDAH'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : 'bg-neutral-100 text-neutral-500 border-neutral-250'
                            }`}
                          >
                            {item.input}
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-650 rounded-lg hover:bg-neutral-50 transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Specification Modal */}
      {activeKdSpecItem && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-neutral-150 max-w-lg w-full overflow-hidden shadow-xl">
            <div className="bg-neutral-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-450" />
                <h4 className="font-bold text-sm">Spesifikasi Standard Mutu Gizi & Organoleptik</h4>
              </div>
              <button 
                onClick={() => setActiveKdSpecItem(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-neutral-400 uppercase">Nama Bahan / Komoditas</p>
                <h5 className="text-lg font-black text-neutral-800 capitalize flex items-center gap-1.5">
                  {activeKdSpecItem.name} 
                  <span className="text-xs font-normal text-neutral-500 font-mono font-bold">({activeKdSpecItem.qty} {activeKdSpecItem.uom})</span>
                </h5>
              </div>
              
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-2">
                <p className="text-[10px] font-bold text-neutral-500 uppercase">Kriteria Lolos Standard Uji Organoleptik (Fisik)</p>
                <p className="text-xs text-neutral-700 leading-relaxed font-mono bg-white p-3 rounded-lg border border-neutral-100 whitespace-pre-wrap">
                  {activeKdSpecItem.specification}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                <div className="bg-emerald-50/30 p-2.5 rounded-lg border border-emerald-100/50">
                  <p className="text-[9px] font-bold text-emerald-700 uppercase">Status Fisik</p>
                  <p className="font-black text-emerald-900 mt-0.5">{activeKdSpecItem.checker}</p>
                </div>
                <div className="bg-indigo-50/30 p-2.5 rounded-lg border border-indigo-100/50">
                  <p className="text-[9px] font-bold text-indigo-700 uppercase">Sistem Inventori</p>
                  <p className="font-black text-indigo-900 mt-0.5">{activeKdSpecItem.input === 'SUDAH' ? 'SUDAH DIINPUT' : 'BELUM DIINPUT'}</p>
                </div>
              </div>
            </div>

            <div className="bg-neutral-50 p-4 border-t border-neutral-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveKdSpecItem(null)}
                className="px-4 py-2 bg-emerald-850 hover:bg-emerald-950 text-white rounded-lg font-bold text-xs transition-colors"
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOP Print Facsimile Modal */}
      {showSopPrintView && (
        <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-neutral-200 shadow-2xl overflow-hidden my-8">
            {/* Modal Toolbar */}
            <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-emerald-450" />
                <div>
                  <h3 className="font-bold text-sm">Lembar SOP Cetak Pemeriksaan Fisik</h3>
                  <p className="text-[10px] text-neutral-450">Klik tombol print untuk mengunduh pdf / cetak fisik</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5 rotate-45" /> Cetak Sekarang (Print)
                </button>
                <button
                  onClick={() => setShowSopPrintView(false)}
                  className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Facsimile Area */}
            <div className="p-8 md:p-12 bg-white space-y-6 text-black" id="printable-sop-sheet">
              {/* Kop Surat */}
              <div className="border-b-4 border-double border-neutral-900 pb-4 flex items-center justify-between">
                <div className="text-left space-y-1">
                  <h1 className="text-xl font-extrabold tracking-wider text-neutral-950">YAYASAN PONDOK PESANTREN QOMARUDDIN</h1>
                  <h2 className="text-sm font-bold text-neutral-800">DAPUR BERSAMA MBG - SPPG BUNGAH 2</h2>
                  <p className="text-[10px] text-neutral-500 font-mono">Jl. Raya Bungah No.1, Bungah, Gresik, Jawa Timur</p>
                </div>
                <div className="text-right border border-neutral-300 p-2 rounded-lg bg-neutral-50">
                  <p className="text-[9px] font-bold text-neutral-450 uppercase">KODE DOKUMEN</p>
                  <p className="text-xs font-black text-neutral-850 font-mono">SOP/LOG/MBG-{localKdDate.replace(/-/g, '')}</p>
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-1">
                <h3 className="text-base font-black uppercase tracking-widest text-neutral-950 underline">LEMBAR SOP PEMERIKSAAN KEDATANGAN BARANG</h3>
                <p className="text-xs text-neutral-600">Sistem Penjaminan Mutu & Logistik Dapur Terpadu SPPG</p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <div className="space-y-1.5">
                  <p className="flex justify-between border-b border-neutral-200 pb-1"><span className="text-neutral-500 font-semibold">Hari / Tanggal SOP:</span> <span className="font-extrabold text-neutral-850 font-mono">{new Date(localKdDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                  <p className="flex justify-between border-b border-neutral-200 pb-1"><span className="text-neutral-500 font-semibold">Tujuan Distribusi:</span> <span className="font-extrabold text-neutral-850">Assa'adah & Desa Sekitar</span></p>
                </div>
                <div className="space-y-1.5">
                  <p className="flex justify-between border-b border-neutral-200 pb-1"><span className="text-neutral-500 font-semibold">Status SOP:</span> <span className="font-extrabold text-emerald-800 uppercase font-mono">TERVERIFIKASI LOGISTIK</span></p>
                  <p className="flex justify-between border-b border-neutral-200 pb-1"><span className="text-neutral-500 font-semibold">Unit Pemeriksa:</span> <span className="font-extrabold text-neutral-850">Aslap & Staf Gudang</span></p>
                </div>
              </div>

              {/* Checklist Table */}
              <div className="border border-neutral-300 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-800 font-bold uppercase text-[9px] tracking-wider font-mono">
                      <th className="p-3 border-r border-neutral-300 text-center w-10">No</th>
                      <th className="p-3 border-r border-neutral-300">Nama Bahan / Komoditas</th>
                      <th className="p-3 border-r border-neutral-300 text-right w-24">Jumlah</th>
                      <th className="p-3 border-r border-neutral-300">Supplier</th>
                      <th className="p-3 border-r border-neutral-300 text-center w-28">Status Fisik</th>
                      <th className="p-3">Kriteria Standard Mutu Organoleptik</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-300">
                    {activeDateItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-neutral-50/50">
                        <td className="p-3 border-r border-neutral-300 text-center font-mono text-neutral-500">{idx + 1}</td>
                        <td className="p-3 border-r border-neutral-300 font-bold text-neutral-900 capitalize">{item.name}</td>
                        <td className="p-3 border-r border-neutral-300 text-right font-mono font-bold">{item.qty} {item.uom}</td>
                        <td className="p-3 border-r border-neutral-300 font-semibold text-neutral-700">{item.supplier}</td>
                        <td className="p-3 border-r border-neutral-300 text-center">
                          <span className={`px-2 py-1 rounded text-[9px] font-black tracking-wide uppercase ${
                            item.checker === 'LENGKAP'
                              ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                              : item.checker === 'KURANG'
                              ? 'bg-amber-100 text-amber-950 border border-amber-300'
                              : 'bg-red-100 text-red-950 border border-red-300'
                          }`}>
                            {item.checker}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[10px] text-neutral-600 leading-relaxed whitespace-pre-wrap">{item.specification}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary of Checklist */}
              <div className="grid grid-cols-3 gap-4 text-xs pt-2">
                <div className="border border-neutral-200 p-3 rounded-lg bg-emerald-50/20">
                  <p className="font-bold text-emerald-800">Lengkap & Sesuai: {lengkapCount} Item</p>
                  <p className="text-[10px] text-neutral-500 mt-1">Diterima utuh & masuk ke penyimpanan/cooler.</p>
                </div>
                <div className="border border-neutral-200 p-3 rounded-lg bg-amber-50/20">
                  <p className="font-bold text-amber-800">Jumlah Kurang: {kurangCount} Item</p>
                  <p className="text-[10px] text-neutral-500 mt-1">Dicatat di formulir komplain / diklaim ke supplier.</p>
                </div>
                <div className="border border-neutral-200 p-3 rounded-lg bg-red-50/20">
                  <p className="font-bold text-red-800">Batal / Ditolak: {batalCount} Item</p>
                  <p className="text-[10px] text-neutral-500 mt-1">Retur langsung ke supplier / pembatalan pengiriman.</p>
                </div>
              </div>

              {/* SOP Sign-off signatures */}
              <div className="grid grid-cols-2 gap-8 text-xs pt-8">
                <div className="text-center space-y-12">
                  <p className="font-bold text-neutral-600">Pihak Pemeriksa (Staf Logistik Dapur),</p>
                  <div className="h-16 flex items-center justify-center">
                    <span className="text-neutral-300 italic text-[11px] font-mono border-b border-dashed border-neutral-300 pb-2 px-8">[ Tanda Tangan Logistik ]</span>
                  </div>
                  <p className="font-black text-neutral-800 underline">Staf Gudang Dapur SPPG</p>
                </div>
                <div className="text-center space-y-12">
                  <p className="font-bold text-neutral-600">Mengetahui (Asisten Lapangan),</p>
                  <div className="h-16 flex items-center justify-center">
                    <span className="text-neutral-300 italic text-[11px] font-mono border-b border-dashed border-neutral-300 pb-2 px-8">[ Tanda Tangan Aslap ]</span>
                  </div>
                  <p className="font-black text-neutral-800 underline">Koordinator Aslap SPPG 2</p>
                </div>
              </div>
            </div>

            {/* Footer Toolbar */}
            <div className="bg-neutral-50 p-4 border-t border-neutral-100 flex justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => setShowSopPrintView(false)}
                className="px-4 py-2 border border-neutral-250 hover:bg-neutral-100 text-neutral-600 rounded-lg font-bold text-xs transition-colors"
              >
                Tutup Pratinjau
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-neutral-900 hover:bg-black text-white rounded-lg font-bold text-xs transition-colors"
              >
                Print SOP (A4 / PDF)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
