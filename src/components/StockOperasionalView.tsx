import React, { useState, useEffect } from 'react';
import { 
  Archive, Save, Plus, CheckCircle, FileText, 
  Search, Info, Trash2, ShieldCheck, Printer, Calendar, 
  ArrowLeft, ArrowRight, Download, RefreshCw, Layers, X
} from 'lucide-react';
import { StockItem } from '../types';
import { KedatanganBarangItem, SavedReport } from './IncomingGoodsView';

interface StockOperasionalViewProps {
  selectedDate: string;
  isInitialFetchDone: boolean;
  operasionalMap: Record<string, StockItem[]>;
  setOperasionalMap: React.Dispatch<React.SetStateAction<Record<string, StockItem[]>>>;
  kedatanganMap: Record<string, KedatanganBarangItem[]>;
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

const OPERASIONAL_CATEGORIES = ['ATK', 'Kebersihan', 'Air', 'APD', 'Lain-Lain'];

const defaultOperasionalTemplate: Omit<StockItem, 'id'>[] = [
  { category: 'Kebersihan', name: 'Sabun Cuci Piring Mama Lemon', stokAwal: 3, barangMasuk: 2, stokAkhir: 5, uom: 'Jerigen' },
  { category: 'ATK', name: 'Buku Catatan Laporan Harian', stokAwal: 2, barangMasuk: 5, stokAkhir: 7, uom: 'Pcs' },
  { category: 'ATK', name: 'Bulpen Standard Hitam', stokAwal: 10, barangMasuk: 12, stokAkhir: 22, uom: 'Box' },
  { category: 'Air', name: 'Galon Air Minum Isi Ulang', stokAwal: 5, barangMasuk: 10, stokAkhir: 15, uom: 'Galon' },
  { category: 'APD', name: 'Masker Sensi Earloop 3-ply', stokAwal: 2, barangMasuk: 3, stokAkhir: 5, uom: 'Box' },
  { category: 'APD', name: 'Sarung Tangan Plastik Higienis', stokAwal: 4, barangMasuk: 4, stokAkhir: 8, uom: 'Box' }
];

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

export default function StockOperasionalView({
  selectedDate,
  isInitialFetchDone,
  operasionalMap,
  setOperasionalMap,
  kedatanganMap,
  savedReports,
  addSavedReport,
  triggerSuccessMsg,
  successMsg,
  isSupabaseConfigured
}: StockOperasionalViewProps) {
  const activeDate = selectedDate || '2026-06-16';

  // State
  const [localStockDate, setLocalStockDate] = useState<string>(activeDate);
  const [stockTab, setStockTab] = useState<'rekap' | 'detail'>('rekap');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Semua');
  
  // Adding custom stock item form state
  const [isAddingStockItem, setIsAddingStockItem] = useState(false);
  const [newStockName, setNewStockName] = useState('');
  const [newStockCat, setNewStockCat] = useState('ATK');
  const [newStockUom, setNewStockUom] = useState('Pcs');
  const [newStockExpiredDate, setNewStockExpiredDate] = useState('');

  // PDF Print Facsimile Modal State
  const [showPrintView, setShowPrintView] = useState(false);

  // Expired column toggle state
  const [showExpiredColumn, setShowExpiredColumn] = useState(false);

  // Sync state when selectedDate prop changes
  useEffect(() => {
    if (selectedDate) {
      setLocalStockDate(selectedDate);
    }
  }, [selectedDate]);

  // Helper: Get yesterday's date string
  const getYesterdayDateStr = (dateStr: string): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  // Helper: Get yesterday's Stok Akhir for an item
  const getYesterdayStokAkhir = (itemName: string, dateStr: string): number | null => {
    const yesterdayDate = getYesterdayDateStr(dateStr);
    const yesterdayList = operasionalMap[yesterdayDate];
    if (yesterdayList && yesterdayList.length > 0) {
      const match = yesterdayList.find(it => it.name.toLowerCase() === itemName.toLowerCase());
      if (match) return match.stokAkhir;
    }
    return null;
  };

  // Helper: Calculate computed values for an item
  const getComputedItemValues = (item: StockItem, dateStr: string) => {
    // 1. Stok Awal = Yesterday's Stok Akhir. If none exists, fallback to item's stored stokAwal
    const yesterdayAkhir = getYesterdayStokAkhir(item.name, dateStr);
    const stokAwal = yesterdayAkhir !== null ? yesterdayAkhir : item.stokAwal;

    // 2. Barang Keluar = Stok Awal + Barang Masuk - Stok Akhir
    const barangKeluar = stokAwal + item.barangMasuk - item.stokAkhir;

    return {
      stokAwal,
      barangKeluar,
      isDerivedFromYesterday: yesterdayAkhir !== null
    };
  };

  // Ensure initial data exists for localStockDate
  useEffect(() => {
    if (!isInitialFetchDone) return;

    const targetDate = localStockDate || '2026-06-16';
    if (!operasionalMap[targetDate]) {
      // Create initial list from default template
      const initial = defaultOperasionalTemplate.map((item, idx) => {
        // Calculate dynamic initial stock awal if yesterday has a recorded end stock
        const yesterdayAkhir = getYesterdayStokAkhir(item.name, targetDate);
        const derivedStokAwal = yesterdayAkhir !== null ? yesterdayAkhir : item.stokAwal;
        
        return {
          ...item,
          id: `op-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          stokAwal: derivedStokAwal,
          stokAkhir: derivedStokAwal + item.barangMasuk // Maintain math integrity initially
        };
      }) as StockItem[];

      setOperasionalMap(prev => {
        if (prev[targetDate]) return prev;
        return {
          ...prev,
          [targetDate]: initial
        };
      });
    }
  }, [localStockDate, isInitialFetchDone, operasionalMap, setOperasionalMap]);

  // Current active date's stock items
  const activeStockList = operasionalMap[localStockDate] || [];

  // Filter items
  const filteredStockItems = activeStockList.filter(item => {
    const matchesCategory = selectedCategoryFilter === 'Semua' || item.category === selectedCategoryFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Procurement Matching Helper: Search quantities from kedatanganMap (pembelanjaan)
  const getSuggestedProcurementQty = (itemName: string): number => {
    const incomingList = kedatanganMap[localStockDate];
    if (incomingList && incomingList.length > 0) {
      const match = incomingList.filter(it => 
        it.name.toLowerCase().includes(itemName.toLowerCase()) || 
        itemName.toLowerCase().includes(it.name.toLowerCase())
      );
      return match.reduce((sum, it) => sum + it.qty, 0);
    }
    return 0;
  };

  // Sync entire active stock list to find and import matching "Barang Masuk" quantities from "Pembelanjaan"
  const handleAutoImportFromProcurement = () => {
    let matchCount = 0;
    const updatedList = activeStockList.map(item => {
      const procQty = getSuggestedProcurementQty(item.name);
      if (procQty > 0) {
        matchCount++;
        return { 
          ...item, 
          barangMasuk: procQty
        };
      }
      return item;
    });

    if (matchCount === 0) {
      alert(`Tidak ada barang operasional yang cocok ditemukan pada laporan Penerimaan Barang untuk tanggal ${localStockDate}.`);
      return;
    }

    setOperasionalMap(prev => ({
      ...prev,
      [localStockDate]: updatedList
    }));
    triggerSuccessMsg(`Sukses menyinkronkan data! Berhasil mengimpor kuantitas Barang Masuk untuk ${matchCount} barang operasional berdasarkan laporan Penerimaan/Pembelanjaan hari ini.`);
  };

  // Inline Handlers
  const handleUpdateStockField = (id: string, field: 'barangMasuk' | 'stokAkhir' | 'expiredDate', value: any) => {
    setOperasionalMap(prev => {
      const currentList = prev[localStockDate] || [];
      const updated = currentList.map(item => {
        if (item.id === id) {
          const processedVal = field === 'expiredDate' ? value : (parseFloat(value) || 0);
          return {
            ...item,
            [field]: processedVal
          };
        }
        return item;
      });
      return {
        ...prev,
        [localStockDate]: updated
      };
    });
  };

  const handleCreateStockItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStockName.trim()) return;

    // Get current stock awal dynamically from yesterday if available
    const yesterdayAkhir = getYesterdayStokAkhir(newStockName.trim(), localStockDate);
    const stokAwalVal = yesterdayAkhir !== null ? yesterdayAkhir : 0;

    const newItem: StockItem = {
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category: newStockCat,
      name: newStockName.trim(),
      stokAwal: stokAwalVal,
      barangMasuk: 0,
      stokAkhir: stokAwalVal,
      uom: newStockUom,
      expiredDate: newStockExpiredDate || undefined
    };

    setOperasionalMap(prev => {
      const currentList = prev[localStockDate] || [];
      return {
        ...prev,
        [localStockDate]: [...currentList, newItem]
      };
    });

    setNewStockName('');
    setNewStockUom('Pcs');
    setNewStockExpiredDate('');
    setIsAddingStockItem(false);
    triggerSuccessMsg(`Barang operasional "${newItem.name}" berhasil ditambahkan ke kategori ${newItem.category}.`);
  };

  const handleRemoveStockItem = (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus "${name}" dari catatan Stok Operasional hari ini?`)) {
      setOperasionalMap(prev => {
        const currentList = prev[localStockDate] || [];
        return {
          ...prev,
          [localStockDate]: currentList.filter(item => item.id !== id)
        };
      });
      triggerSuccessMsg(`Barang "${name}" berhasil dihapus.`);
    }
  };

  const exportStockToCSV = (dateStr: string, items: StockItem[]) => {
    const filename = `Laporan_Stok_Operasional_${dateStr}.csv`;
    const headers = [
      'Kategori', 
      'Nama Barang', 
      'Stok Awal (Yesterday)', 
      'Barang Masuk (Procurement)', 
      'Barang Keluar (Calculated)', 
      'Stok Akhir (Physical)', 
      'Satuan (UoM)', 
      'Tanggal Expired', 
      'Status Threshold'
    ];

    const rows = items.map(item => {
      const { stokAwal, barangKeluar } = getComputedItemValues(item, dateStr);
      let status = 'Aman';
      if (item.stokAkhir <= 0) status = 'Habis';
      else if (item.stokAkhir <= 5) status = 'Menipis';

      return [
        item.category,
        item.name,
        String(stokAwal),
        String(item.barangMasuk),
        String(barangKeluar),
        String(item.stokAkhir),
        item.uom,
        item.expiredDate || '-',
        status
      ];
    });

    addSavedReport(dateStr, 'operasional', filename, items.length, headers, rows);
    downloadCSV(filename, headers, rows);
  };

  // Sync to Next Day (Carry Over)
  const handleSyncToNextDay = () => {
    const currentDateObj = new Date(localStockDate);
    currentDateObj.setDate(currentDateObj.getDate() + 1);
    const actualNextDateStr = currentDateObj.toISOString().split('T')[0];

    setOperasionalMap(prev => {
      const todayList = prev[localStockDate] || [];
      const nextDayList = prev[actualNextDateStr] || [];
      const updatedNextDayList = [...nextDayList];

      todayList.forEach(todayItem => {
        const computed = getComputedItemValues(todayItem, localStockDate);
        const idx = updatedNextDayList.findIndex(nItem => 
          nItem.name.toLowerCase() === todayItem.name.toLowerCase()
        );

        if (idx !== -1) {
          const nextItem = updatedNextDayList[idx];
          updatedNextDayList[idx] = {
            ...nextItem,
            stokAwal: todayItem.stokAkhir, // carry over
            stokAkhir: todayItem.stokAkhir + nextItem.barangMasuk
          };
        } else {
          updatedNextDayList.push({
            id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            category: todayItem.category,
            name: todayItem.name,
            stokAwal: todayItem.stokAkhir,
            barangMasuk: 0,
            stokAkhir: todayItem.stokAkhir,
            uom: todayItem.uom,
            expiredDate: todayItem.expiredDate
          });
        }
      });

      return {
        ...prev,
        [actualNextDateStr]: updatedNextDayList
      };
    });

    exportStockToCSV(localStockDate, activeStockList);
    triggerSuccessMsg(`Sukses Carry-Over! Stok Akhir hari ini berhasil disalin sebagai Stok Awal esok hari (${actualNextDateStr}). Laporan Excel juga berhasil diekspor.`);
  };

  // Navigate dates
  const handleNavigateDate = (direction: 'prev' | 'next') => {
    const d = new Date(localStockDate);
    d.setDate(d.getDate() + (direction === 'prev' ? -1 : 1));
    setLocalStockDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6 animate-fadeIn">
      
      {/* Header and Control Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Archive className="h-6 w-6 text-emerald-700" />
            <h2 className="text-xl font-bold font-sans text-neutral-800">
              Stok Operasional Mandiri (ATK, APD, Kebersihan, Air, & Lain-Lain)
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
              Automated Math
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Manajemen inventaris sarana &amp; alat non-food pondok pesantren gizi dengan rumus penarikan stok otomatis terintegrasi.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              exportStockToCSV(localStockDate, activeStockList);
              triggerSuccessMsg(`Laporan Stok Operasional ${localStockDate} berhasil diekspor ke Excel!`);
            }}
            className="bg-emerald-700 hover:bg-emerald-850 text-white text-xs font-bold px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Download className="h-4 w-4" /> Ekspor Excel
          </button>

          <button
            type="button"
            onClick={() => setShowPrintView(true)}
            className="bg-stone-850 hover:bg-black text-white text-xs font-bold px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs active:scale-[0.98] cursor-pointer"
          >
            <Printer className="h-4 w-4" /> Cetak PDF / Laporan
          </button>

          <button
            type="button"
            onClick={() => setIsAddingStockItem(!isAddingStockItem)}
            className="bg-neutral-850 hover:bg-neutral-950 text-white text-xs font-semibold px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isAddingStockItem ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} 
            {isAddingStockItem ? 'Batal' : 'Tambah Barang'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setStockTab('rekap')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            stockTab === 'rekap' ? 'border-emerald-700 text-emerald-800 font-extrabold' : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          📊 Semua Hari (Rekap Kartu)
        </button>
        <button
          onClick={() => setStockTab('detail')}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            stockTab === 'detail' ? 'border-emerald-700 text-emerald-800 font-extrabold' : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          📝 Detail Stok Harian (${localStockDate})
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-lg text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" /> {successMsg}
        </div>
      )}

      {stockTab === 'rekap' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const datesWithData = Array.from(new Set([
                ...Object.keys(operasionalMap),
                '2026-06-16',
                '2026-06-17',
                '2026-06-18',
                '2026-06-19',
                '2026-06-20'
              ])).sort().reverse();

              return datesWithData.map(date => {
                const items = operasionalMap[date] || [];
                const total = items.length;
                const totalMasuk = items.reduce((acc, it) => acc + (it.barangMasuk || 0), 0);
                
                // Calculate dynamic stock awal & keluar for stats
                let totalKeluar = 0;
                items.forEach(it => {
                  const { stokAwal } = getComputedItemValues(it, date);
                  const keluar = stokAwal + it.barangMasuk - it.stokAkhir;
                  totalKeluar += Math.max(0, keluar);
                });

                // Day label
                const daysInIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const parsedDate = new Date(date);
                const dayName = isNaN(parsedDate.getTime()) ? 'Hari' : daysInIndo[parsedDate.getDay()];

                return (
                  <div key={date} className="bg-white border border-neutral-200 rounded-xl shadow-2xs hover:border-emerald-400 hover:shadow-xs transition-all p-5 flex flex-col justify-between space-y-4 animate-fadeIn">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="bg-neutral-100 text-neutral-800 text-[10px] font-black px-2 py-0.5 rounded font-mono">
                          {date}
                        </span>
                        <span className="text-xs font-black text-neutral-500">{dayName}</span>
                      </div>
                      <h3 className="text-sm font-bold text-neutral-800">
                        Stok Operasional SPPG
                      </h3>
                      <p className="text-[11px] text-neutral-500 line-clamp-2">
                        {total > 0 
                          ? `Monitoring ${total} sarana operasional. Total Barang Masuk hari ini sebanyak ${totalMasuk.toFixed(1)} unit.`
                          : 'Belum ada data stok operasional harian yang dicatat.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-center py-2 border-y border-neutral-100">
                      <div className="bg-neutral-50 rounded p-1.5">
                        <span className="text-[8px] text-neutral-500 block font-bold">BARANG</span>
                        <span className="text-xs font-extrabold text-neutral-800 font-mono">${total}</span>
                      </div>
                      <div className="bg-emerald-50 rounded p-1.5">
                        <span className="text-[8px] text-emerald-700 block font-bold">MASUK</span>
                        <span className="text-xs font-extrabold text-emerald-950 font-mono">${totalMasuk.toFixed(0)}</span>
                      </div>
                      <div className="bg-amber-50 rounded p-1.5">
                        <span className="text-[8px] text-amber-700 block font-bold">KELUAR (EST)</span>
                        <span className="text-xs font-extrabold text-amber-950 font-mono">${totalKeluar.toFixed(0)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                      <button
                        onClick={() => {
                          setLocalStockDate(date);
                          setStockTab('detail');
                        }}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg transition-colors flex-1 text-center cursor-pointer font-sans"
                      >
                        Buka Detail
                      </button>
                      <button
                        onClick={() => {
                          exportStockToCSV(date, items);
                          triggerSuccessMsg(`Laporan Stok Operasional ${date} berhasil diunduh!`);
                        }}
                        className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-2.5 py-1.5 rounded-lg transition-colors border border-stone-200 cursor-pointer"
                        title="Unduh Excel"
                      >
                        📥 Excel
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Saved Reports Section for Stock Operasional */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-3 mt-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-emerald-800" />
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 font-mono">Laporan Stok Operasional Tersimpan</h3>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold px-2.5 py-0.5 rounded-full">
                {savedReports.filter(r => r.module === 'operasional').length} File
              </span>
            </div>
            {savedReports.filter(r => r.module === 'operasional').length === 0 ? (
              <p className="text-[11px] text-neutral-450 italic py-4 text-center">Belum ada laporan Excel yang disimpan atau diunduh.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-[9px] text-neutral-400 font-bold uppercase">
                      <th className="p-2">Nama File Excel</th>
                      <th className="p-2">Tanggal Laporan</th>
                      <th className="p-2 text-center">Jumlah Item</th>
                      <th className="p-2">Waktu Tersimpan</th>
                      <th className="p-2 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {savedReports.filter(r => r.module === 'operasional').map((rep, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50">
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
                            📥 Unduh Excel
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
          {/* Quick Date Picker & Sync Actions */}
          <div className="bg-emerald-50/40 p-4 border border-emerald-100 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-700" />
                <span className="text-xs font-black text-neutral-700 font-mono">TANGGAL OPERASIONAL:</span>
                <input
                  type="date"
                  value={localStockDate}
                  onChange={e => setLocalStockDate(e.target.value)}
                  className="bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-extrabold text-neutral-800 outline-hidden focus:ring-1 focus:ring-emerald-700 font-mono cursor-pointer"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAutoImportFromProcurement}
                  className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  title="Tarik otomatis barang operasional yang masuk hari ini berdasarkan form Penerimaan"
                >
                  <RefreshCw className="h-3.5 w-3.5 animate-spin-hover" />
                  Tarik Kuantitas dari Pembelanjaan
                </button>

                <button
                  type="button"
                  onClick={handleSyncToNextDay}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  title="Simpan & carry-over semua Stok Akhir hari ini menjadi Stok Awal besok"
                >
                  <Save className="h-3.5 w-3.5" />
                  Carry Over Stok Akhir ke Besok
                </button>
              </div>
            </div>

            {/* Formula Panel */}
            <div className="bg-white p-3 rounded-lg border border-emerald-150 text-[11px] text-neutral-600 flex flex-col md:flex-row md:items-center justify-between gap-2 leading-relaxed">
              <div>
                <span className="font-extrabold text-emerald-900">💡 Alur Rumus Otomatis:</span>{' '}
                Stok Awal ditarik otomatis dari Stok Akhir kemarin. Admin hanya perlu menginput{' '}
                <strong className="text-neutral-900">Barang Masuk</strong> dan{' '}
                <strong className="text-neutral-900">Stok Akhir (Fisik)</strong>.{' '}
                <strong className="text-emerald-950 font-mono">
                  Barang Keluar = Stok Awal + Barang Masuk - Stok Akhir
                </strong>.
              </div>
              <span className="bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded text-[9px] uppercase tracking-wider self-start md:self-auto font-mono">
                Admin-Only Input
              </span>
            </div>
          </div>

          {/* Form Adding Item */}
          {isAddingStockItem && (
            <form onSubmit={handleCreateStockItem} className="p-4 border border-emerald-100 bg-emerald-50/10 rounded-xl space-y-4">
              <h3 className="font-bold text-xs text-emerald-900 uppercase tracking-widest flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Tambah Sarana / Alat Operasional Baru
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Barang</label>
                  <input
                    type="text"
                    required
                    value={newStockName}
                    onChange={e => setNewStockName(e.target.value)}
                    placeholder="Contoh: Masker Medis Sensi 3-Ply"
                    className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Kategori</label>
                  <select
                    value={newStockCat}
                    onChange={e => setNewStockCat(e.target.value)}
                    className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs outline-hidden font-medium text-neutral-700"
                  >
                    {OPERASIONAL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Satuan (UoM)</label>
                  <input
                    type="text"
                    required
                    value={newStockUom}
                    onChange={e => setNewStockUom(e.target.value)}
                    placeholder="Box / Pcs / Galon"
                    className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Tanggal Kedaluwarsa / Expired (Opsional)</label>
                  <input
                    type="date"
                    value={newStockExpiredDate}
                    onChange={e => setNewStockExpiredDate(e.target.value)}
                    className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs outline-hidden focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
                <div className="flex items-end justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingStockItem(false)}
                    className="px-3 py-2 border border-neutral-200 hover:bg-neutral-50 rounded-lg text-xs font-semibold text-neutral-500 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-950 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Simpan &amp; Tambahkan
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-neutral-50/50 p-4 rounded-xl border border-neutral-100">
            {/* Category Filter */}
            <div className="md:col-span-4">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full text-xs border border-neutral-200 rounded-lg p-2 bg-white shadow-2xs outline-hidden font-medium text-neutral-700"
              >
                <option value="Semua">Semua Kategori</option>
                {OPERASIONAL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="md:col-span-5 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari barang operasional berdasarkan nama..."
                className="w-full text-xs pl-9 pr-4 py-2 border border-neutral-200 rounded-lg bg-white shadow-2xs outline-hidden focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            {/* Expired Column Toggle Checkbox */}
            <div className="md:col-span-3 flex items-center justify-end">
              <label className="flex items-center gap-1.5 text-xs text-neutral-600 font-bold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showExpiredColumn}
                  onChange={(e) => setShowExpiredColumn(e.target.checked)}
                  className="rounded border-neutral-300 text-emerald-700 focus:ring-emerald-700 h-3.5 w-3.5 cursor-pointer"
                />
                Tampilkan Expired Date
              </label>
            </div>
          </div>

          {/* Main Table */}
          <div className="border border-neutral-100 rounded-xl overflow-hidden shadow-3xs bg-white">
            <table className="w-full text-left text-xs text-neutral-600 border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] font-black text-neutral-500 uppercase tracking-wider select-none">
                  <th className="p-3">Nama Barang / Kategori</th>
                  <th className="p-3 text-center w-28 bg-blue-50/20 text-blue-900 font-extrabold">1. Stok Awal (Kemarin)</th>
                  <th className="p-3 text-center w-28 bg-emerald-50/20 text-emerald-900 font-extrabold">2. Barang Masuk</th>
                  <th className="p-3 text-center w-28 bg-neutral-100/50 text-neutral-800 font-extrabold">3. Stok Akhir (Riil)</th>
                  <th className="p-3 text-center w-28 bg-amber-50/30 text-amber-950 font-extrabold">4. Barang Keluar (Pakai)</th>
                  <th className="p-3">UoM</th>
                  {showExpiredColumn && <th className="p-3">Expired Date</th>}
                  <th className="p-3 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={showExpiredColumn ? 8 : 7} className="p-10 text-center italic text-neutral-400">
                      Tidak ada barang operasional yang sesuai dengan kriteria pencarian atau kategori ini.
                    </td>
                  </tr>
                ) : (
                  filteredStockItems.map((item) => {
                    const { stokAwal, barangKeluar, isDerivedFromYesterday } = getComputedItemValues(item, localStockDate);
                    const isWarningThreshold = item.stokAkhir <= 0;
                    const isLowStock = item.stokAkhir > 0 && item.stokAkhir <= 5;

                    return (
                      <tr key={item.id} className={`hover:bg-neutral-50/40 transition-colors ${
                        isWarningThreshold ? 'bg-red-50/15' : isLowStock ? 'bg-amber-50/15' : ''
                      }`}>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <strong className="text-neutral-900 font-bold text-xs">{item.name}</strong>
                            <div className="flex gap-1.5 items-center mt-1">
                              <span className="text-[9px] bg-slate-100 text-slate-800 uppercase px-1.5 py-0.5 font-bold rounded">
                                {item.category}
                              </span>
                              {isWarningThreshold && (
                                <span className="text-[8px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded uppercase">
                                  HABIS
                                </span>
                              )}
                              {isLowStock && (
                                <span className="text-[8px] bg-amber-500 text-white font-black px-1.5 py-0.5 rounded uppercase">
                                  MENIPIS
                                </span>
                              )}
                              {isDerivedFromYesterday && (
                                <span className="text-[8px] bg-blue-50 text-blue-700 border border-blue-200 font-extrabold px-1.5 py-0.5 rounded">
                                  Carry Over
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Stok Awal */}
                        <td className="p-3 text-center bg-blue-50/10 font-mono font-bold text-blue-900">
                          {stokAwal}
                        </td>

                        {/* Barang Masuk */}
                        <td className="p-3 text-center bg-emerald-50/10">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.barangMasuk}
                            onChange={(e) => handleUpdateStockField(item.id, 'barangMasuk', e.target.value)}
                            className="w-20 border border-emerald-200 text-center font-mono font-bold text-emerald-800 p-1.5 rounded bg-white shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                          />
                        </td>

                        {/* Stok Akhir Riil */}
                        <td className="p-3 text-center bg-neutral-100/10">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.stokAkhir}
                            onChange={(e) => handleUpdateStockField(item.id, 'stokAkhir', e.target.value)}
                            className={`w-20 border text-center font-mono font-bold p-1.5 rounded bg-white shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden ${
                              isWarningThreshold ? 'border-red-300 text-red-600 focus:ring-red-600' :
                              isLowStock ? 'border-amber-300 text-amber-600 focus:ring-amber-600' :
                              'border-neutral-250 text-neutral-800'
                            }`}
                          />
                        </td>

                        {/* Barang Keluar */}
                        <td className={`p-3 text-center bg-amber-50/10 font-mono font-black ${
                          barangKeluar < 0 ? 'text-rose-600 font-extrabold' : 'text-neutral-800'
                        }`}>
                          {barangKeluar} {barangKeluar < 0 ? '(Anomaly)' : ''}
                        </td>

                        {/* UoM */}
                        <td className="p-3 font-semibold text-neutral-500 font-mono select-none">
                          {item.uom}
                        </td>

                        {/* Optional Expired Date */}
                        {showExpiredColumn && (
                          <td className="p-3">
                            <input
                              type="date"
                              value={item.expiredDate || ''}
                              onChange={(e) => handleUpdateStockField(item.id, 'expiredDate', e.target.value)}
                              className="border border-neutral-200 rounded p-1 text-xs text-neutral-600 outline-hidden font-mono focus:ring-1 focus:ring-emerald-700"
                            />
                          </td>
                        )}

                        {/* Actions */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRemoveStockItem(item.id, item.name)}
                              className="p-1 hover:bg-rose-50 text-neutral-400 hover:text-red-600 rounded transition-colors"
                              title="Hapus Barang"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mathematical SOP Explanation */}
          <div className="bg-amber-50/40 border border-amber-200 p-4 rounded-xl space-y-2">
            <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-widest flex items-center gap-1.5 select-none">
              <Info className="h-4 w-4 shrink-0 text-amber-600" />
              Penjelasan Rumus SOP Inventaris Dapur &amp; Sarana (Mathematical SOP)
            </h4>
            <p className="text-neutral-600 text-xs leading-relaxed">
              Pencatatan inventaris harian menggunakan perhitungan matematis yang mengikat integritas data ketersediaan barang:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="bg-white p-3 rounded-lg border border-amber-100/50">
                <span className="block text-[9px] font-bold text-neutral-400 uppercase">1. Stok Awal Hari Ini</span>
                <span className="text-xs font-bold text-neutral-800 font-mono mt-0.5 block">Diambil Otomatis dari Stok Akhir Kemarin</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-amber-100/50">
                <span className="block text-[9px] font-bold text-neutral-400 uppercase">2. Barang Keluar (Terpakai)</span>
                <span className="text-xs font-bold text-neutral-800 font-mono mt-0.5 block">Stok Awal + Barang Masuk - Stok Akhir</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-amber-100/50">
                <span className="block text-[9px] font-bold text-neutral-400 uppercase">3. Integritas Besok</span>
                <span className="text-xs font-bold text-neutral-800 font-mono mt-0.5 block">Stok Akhir Riil Dikunci Jadi Stok Awal Esok Hari</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT VIEW FACSIMILE MODAL */}
      {showPrintView && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" id="stock-operasional-print-overlay">
          <div className="bg-white rounded-3xl shadow-2xl border border-neutral-100 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200 flex justify-between items-center shrink-0 no-print">
              <div className="flex items-center gap-2 text-neutral-800">
                <Printer className="h-5 w-5 text-neutral-600" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">Ekspor PDF Lembar Stok Operasional Dapur</h3>
              </div>
              <button
                onClick={() => setShowPrintView(false)}
                className="p-1.5 hover:bg-neutral-200 rounded-lg text-neutral-500 cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto grow p-8 bg-neutral-100/50 flex justify-center">
              <div className="bg-white p-12 w-[21cm] min-h-[29.7cm] shadow-md border border-neutral-200 text-neutral-800 relative text-xs font-serif leading-relaxed print-area" id="printable-stock-operasional">
                
                {/* Header Kop Surat Resmi Yayasan & BGN */}
                <div className="border-b-4 border-double border-black pb-4 mb-6 flex items-center justify-between gap-4">
                  {/* Logo BGN Left */}
                  <div className="flex items-center justify-center shrink-0 w-16 h-16 md:w-20 md:h-20">
                    <img 
                      src="https://www.bgn.go.id/logo-bgn.png" 
                      alt="Logo BGN" 
                      className="max-h-20 max-w-20 object-contain select-none shrink-0" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const fallback = parent.querySelector('.bgn-fallback-sop');
                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                    <div className="bgn-fallback-sop hidden h-16 w-16 rounded-full border-2 border-emerald-900 bg-emerald-800 text-white flex-col items-center justify-center text-center p-1 font-bold text-[8px] uppercase tracking-tighter shrink-0">
                      <span className="font-black text-[10px]">BGN</span>
                      <span>BADAN GIZI</span>
                    </div>
                  </div>

                  {/* Header Title Center */}
                  <div className="text-center flex-1 space-y-0.5">
                    <h2 className="text-base sm:text-lg font-black font-sans uppercase tracking-wider text-black">
                      YAYASAN PONDOK PESANTREN QOMARUDDIN
                    </h2>
                    <h1 className="text-sm sm:text-base font-black font-sans uppercase text-emerald-850 tracking-wide">
                      SATUAN PELAYANAN PROGRAM GIZI (SPPG) BUNGAH 2
                    </h1>
                    <p className="text-[10px] font-sans font-bold text-neutral-800 uppercase">
                      INVENTARIS & STOK OPERASIONAL NON-BAHAN PANGAN DAPUR MBG
                    </p>
                    <p className="text-[9px] font-sans text-neutral-500 italic">
                      Jl. Raya Bungah No. 1, Sampurnan, Bungah, Kabupaten Gresik, Jawa Timur 61152 • Telp: (031) 3949012
                    </p>
                  </div>

                  {/* Logo Qomaruddin Right */}
                  <div className="flex items-center justify-center shrink-0 w-16 h-16 md:w-20 md:h-20">
                    <img 
                      src="https://qomaruddin.com/wp-content/uploads/2019/02/cropped-logo-qomaruddin-1-192x192.png" 
                      alt="Logo PP Qomaruddin" 
                      className="max-h-20 max-w-20 object-contain select-none shrink-0 border border-neutral-200 rounded-full p-0.5" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const fallback = parent.querySelector('.qom-fallback-sop');
                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                    <div className="qom-fallback-sop hidden h-16 w-16 rounded-full border-2 border-emerald-900 bg-emerald-900 text-white flex-col items-center justify-center text-center p-1 font-bold text-[8px] uppercase tracking-tighter shrink-0">
                      <span className="font-black text-[9px]">PPQ</span>
                      <span>QOMARUDDIN</span>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 mb-4 border border-neutral-200 p-3 rounded bg-neutral-50/50 font-sans">
                  <div>
                    <p className="text-[10px] font-black uppercase text-neutral-400">Parameter Berkas</p>
                    <table className="w-full mt-1 text-[11px] leading-relaxed">
                      <tbody>
                        <tr>
                          <td className="font-medium text-neutral-500 py-0.5">Tanggal Laporan</td>
                          <td className="font-bold text-neutral-900">: {localStockDate.split('-').reverse().join('/')}</td>
                        </tr>
                        <tr>
                          <td className="font-medium text-neutral-500 py-0.5">Module</td>
                          <td className="font-bold text-neutral-900">: STOK OPERASIONAL MANDIRI</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-neutral-400">Statistik Data</p>
                    <table className="w-full mt-1 text-[11px]">
                      <tbody>
                        <tr>
                          <td className="font-medium text-neutral-500 py-0.5">Total Personel Dapur</td>
                          <td className="font-extrabold text-neutral-900">: SOP-COMPLIANT SYSTEM</td>
                        </tr>
                        <tr>
                          <td className="font-medium text-neutral-500 py-0.5">Jumlah Item Terdaftar</td>
                          <td className="font-extrabold text-emerald-700">: {activeStockList.length} Item Barang</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table list */}
                <table className="w-full text-left text-[11px] border border-neutral-300 border-collapse font-sans mb-8">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-300 text-[10px] font-bold text-neutral-600 uppercase">
                      <th className="p-2 border-r border-neutral-300 w-10 text-center">No</th>
                      <th className="p-2 border-r border-neutral-300">Nama Barang</th>
                      <th className="p-2 border-r border-neutral-300">Kategori</th>
                      <th className="p-2 border-r border-neutral-300 text-center">1. Stok Awal</th>
                      <th className="p-2 border-r border-neutral-300 text-center">2. Masuk</th>
                      <th className="p-2 border-r border-neutral-300 text-center">3. Stok Akhir (Riil)</th>
                      <th className="p-2 border-r border-neutral-300 text-center">4. Keluar (Terpakai)</th>
                      <th className="p-2 text-center">Satuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {activeStockList.map((item, idx) => {
                      const { stokAwal, barangKeluar } = getComputedItemValues(item, localStockDate);
                      return (
                        <tr key={item.id}>
                          <td className="p-2 border-r border-neutral-300 text-center text-neutral-400 font-bold">{idx + 1}</td>
                          <td className="p-2 border-r border-neutral-300 font-bold text-neutral-900">{item.name}</td>
                          <td className="p-2 border-r border-neutral-300 text-neutral-500">{item.category}</td>
                          <td className="p-2 border-r border-neutral-300 text-center font-mono text-neutral-700">{stokAwal}</td>
                          <td className="p-2 border-r border-neutral-300 text-center font-mono text-emerald-700 font-bold">{item.barangMasuk}</td>
                          <td className="p-2 border-r border-neutral-300 text-center font-mono text-neutral-800 font-extrabold">{item.stokAkhir}</td>
                          <td className="p-2 border-r border-neutral-300 text-center font-mono text-amber-800 font-bold">{barangKeluar}</td>
                          <td className="p-2 text-center text-neutral-500 font-mono">{item.uom}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 pt-8 font-sans border-t border-neutral-200">
                  <div className="text-center space-y-2">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Disiapkan Oleh,</p>
                    <p className="text-xs font-extrabold text-neutral-700">Koordinator Sarana &amp; Operasional</p>
                    <div className="h-16 flex items-center justify-center">
                      <div className="text-[10px] text-neutral-400 border border-dashed border-neutral-300 px-4 py-2 rounded">
                        Otorisasi Sistem Digital
                      </div>
                    </div>
                    <p className="font-extrabold text-xs text-neutral-800 underline">Moh. Sholeh</p>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Disetujui Oleh,</p>
                    <p className="text-xs font-extrabold text-neutral-700">Ketua SPPG</p>
                    <div className="h-16 flex items-center justify-center">
                      <div className="text-[10px] text-neutral-400 border border-dashed border-neutral-300 px-4 py-2 rounded">
                        Otorisasi Sistem Digital
                      </div>
                    </div>
                    <p className="font-extrabold text-xs text-neutral-800 underline">M. Fajrul Falah</p>
                  </div>
                </div>

              </div>
            </div>

            <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setShowPrintView(false)}
                className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100 rounded-lg text-xs font-bold text-neutral-700 cursor-pointer"
              >
                Kembali
              </button>
              <button
                onClick={() => window.print()}
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Printer className="h-4 w-4" /> Cetak Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
