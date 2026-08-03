import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, Save, Plus, CheckCircle, FileText, 
  Search, Info, Trash2, ShieldCheck, Printer, Calendar, 
  ArrowLeft, ArrowRight, Download, RefreshCw, Layers, X
} from 'lucide-react';
import { StockItem } from '../types';
import { KedatanganBarangItem, SavedReport } from './IncomingGoodsView';

interface StockOpnameViewProps {
  selectedDate: string;
  isInitialFetchDone: boolean;
  stockMap: Record<string, StockItem[]>;
  setStockMap: React.Dispatch<React.SetStateAction<Record<string, StockItem[]>>>;
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

// 14 Categories as specified in the original app
const STOCK_CATEGORIES = [
  'Bumbu', 'Saus', 'Pertepungan', 'Makanan Pokok', 'Susu', 'Minyak', 
  'Air', 'Plastik', 'Chiller', 'Frezer', 'Lauk', 'Buah', 'Sayur', 'Lain-Lain'
];

const defaultStockTemplate: Omit<StockItem, 'id'>[] = [
  { category: 'Bumbu', name: 'Kunyit bubuk Desaku', stokAwal: 10, barangMasuk: 5, stokAkhir: 15, uom: 'Sachet' },
  { category: 'Bumbu', name: 'Gula Pasir Rose Brand', stokAwal: 50, barangMasuk: 10, stokAkhir: 60, uom: 'Kg' },
  { category: 'Bumbu', name: 'Gula Merah Saringan', stokAwal: 2.2, barangMasuk: 0, stokAkhir: 2.2, uom: 'Kg' },
  { category: 'Bumbu', name: 'Garam Beriodium Garamku', stokAwal: 30, barangMasuk: 10, stokAkhir: 40, uom: 'Pack' },
  { category: 'Saus', name: 'Kecap Manis ABC', stokAwal: 5, barangMasuk: 2, stokAkhir: 7, uom: 'Jerigen 5L' },
  { category: 'Saus', name: 'Saus Sambal Asli ABC', stokAwal: 4, barangMasuk: 1, stokAkhir: 5, uom: 'Jerigen 5L' },
  { category: 'Pertepungan', name: 'Tepung Terigu Segitiga Biru', stokAwal: 25, barangMasuk: 25, stokAkhir: 50, uom: 'Kg' },
  { category: 'Pertepungan', name: 'Tepung Maizena Kunci', stokAwal: 6, barangMasuk: 2, stokAkhir: 8, uom: 'Dus' },
  { category: 'Makanan Pokok', name: 'Beras Premium Cianjur', stokAwal: 15, barangMasuk: 15, stokAkhir: 30, uom: 'Zak' },
  { category: 'Makanan Pokok', name: 'Mie Kering Telur Enak', stokAwal: 5, barangMasuk: 5, stokAkhir: 10, uom: 'Dus' },
  { category: 'Susu', name: 'SKM Carnation Original', stokAwal: 20, barangMasuk: 24, stokAkhir: 44, uom: 'Kaleng' },
  { category: 'Minyak', name: 'Minyak Goreng Bimoli Klasik', stokAwal: 12, barangMasuk: 12, stokAkhir: 24, uom: 'Pouch 2L' },
  { category: 'Air', name: 'Air Mineral Club Tanggung', stokAwal: 10, barangMasuk: 20, stokAkhir: 30, uom: 'Karton' },
  { category: 'Plastik', name: 'Kantong Plastik Kresek Putih 15', stokAwal: 8, barangMasuk: 4, stokAkhir: 12, uom: 'Pack' },
  { category: 'Plastik', name: 'Plastic Wrap Hygiene Roll', stokAwal: 3, barangMasuk: 1, stokAkhir: 4, uom: 'Roll' },
  { category: 'Chiller', name: 'Bawang Merah Kupas Segar', stokAwal: 5, barangMasuk: 5, stokAkhir: 10, uom: 'Kg' },
  { category: 'Chiller', name: 'Bawang Putih Kupas Segar', stokAwal: 4, barangMasuk: 4, stokAkhir: 8, uom: 'Kg' },
  { category: 'Frezer', name: 'Daging Sapi Giling Porsi', stokAwal: 10, barangMasuk: 10, stokAkhir: 20, uom: 'Kg' },
  { category: 'Frezer', name: 'Fillet Dada Ayam Segar', stokAwal: 15, barangMasuk: 15, stokAkhir: 30, uom: 'Kg' },
  { category: 'Lauk', name: 'Telur Ayam Broiler', stokAwal: 3, barangMasuk: 5, stokAkhir: 8, uom: 'Peti' },
  { category: 'Lauk', name: 'Tempe Papan Bungkus Daun', stokAwal: 20, barangMasuk: 30, stokAkhir: 50, uom: 'Pcs' },
  { category: 'Buah', name: 'Semangka Merah Tanpa Biji', stokAwal: 15, barangMasuk: 15, stokAkhir: 30, uom: 'Kg' },
  { category: 'Buah', name: 'Melon Orange Manis', stokAwal: 10, barangMasuk: 10, stokAkhir: 20, uom: 'Kg' },
  { category: 'Sayur', name: 'Wortel Lokal Bersepat', stokAwal: 12, barangMasuk: 8, stokAkhir: 20, uom: 'Kg' },
  { category: 'Sayur', name: 'Kubis/Kol Putih Bulat', stokAwal: 10, barangMasuk: 10, stokAkhir: 20, uom: 'Kg' },
  { category: 'Lain-Lain', name: 'Sabun Cuci Piring Mama Lemon', stokAwal: 5, barangMasuk: 5, stokAkhir: 10, uom: 'Pouch' }
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

export default function StockOpnameView({
  selectedDate,
  isInitialFetchDone,
  stockMap,
  setStockMap,
  kedatanganMap,
  savedReports,
  addSavedReport,
  triggerSuccessMsg,
  successMsg,
  isSupabaseConfigured
}: StockOpnameViewProps) {
  const activeDate = selectedDate || '2026-06-16';

  // State
  const [localStockDate, setLocalStockDate] = useState<string>(activeDate);
  const [stockTab, setStockTab] = useState<'rekap' | 'detail'>('rekap');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Semua');
  
  // Adding custom stock item form state
  const [isAddingStockItem, setIsAddingStockItem] = useState(false);
  const [newStockName, setNewStockName] = useState('');
  const [newStockCat, setNewStockCat] = useState('Bumbu');
  const [newStockUom, setNewStockUom] = useState('Kg');
  const [newStockExpiredDate, setNewStockExpiredDate] = useState('');

  // PDF Print Facsimile Modal State
  const [showPrintView, setShowPrintView] = useState(false);

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

  // Helper: Get yesterday's Stock Akhir for an item
  const getYesterdayStokAkhir = (itemName: string, dateStr: string): number | null => {
    const yesterdayDate = getYesterdayDateStr(dateStr);
    const yesterdayList = stockMap[yesterdayDate];
    if (yesterdayList && yesterdayList.length > 0) {
      const match = yesterdayList.find(it => it.name.toLowerCase() === itemName.toLowerCase());
      if (match) return match.stokAkhir;
    }
    return null;
  };

  // Helper: Calculate computed values for a stock item
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
    if (!stockMap[targetDate]) {
      // Create initial list from default template
      const initial = defaultStockTemplate.map((item, idx) => {
        // Calculate dynamic initial stock awal if yesterday has a recorded end stock
        const yesterdayAkhir = getYesterdayStokAkhir(item.name, targetDate);
        const derivedStokAwal = yesterdayAkhir !== null ? yesterdayAkhir : item.stokAwal;
        
        return {
          ...item,
          id: `st-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          stokAwal: derivedStokAwal,
          stokAkhir: derivedStokAwal + item.barangMasuk // Maintain math integrity initially
        };
      }) as StockItem[];

      setStockMap(prev => {
        if (prev[targetDate]) return prev;
        return {
          ...prev,
          [targetDate]: initial
        };
      });
    }
  }, [localStockDate, isInitialFetchDone, stockMap, setStockMap]);

  // Current active date's stock items
  const activeStockList = stockMap[localStockDate] || [];

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
        // Keep Stok Akhir updated in line with balance formula if they want,
        // or just update Barang Masuk and let the user adjust Stok Akhir as needed
        return { 
          ...item, 
          barangMasuk: procQty
        };
      }
      return item;
    });

    if (matchCount === 0) {
      alert(`Tidak ada bahan logistik yang cocok ditemukan pada laporan Penerimaan Barang untuk tanggal ${localStockDate}.`);
      return;
    }

    setStockMap(prev => ({
      ...prev,
      [localStockDate]: updatedList
    }));
    triggerSuccessMsg(`Sukses menyinkronkan data! Berhasil mengimpor kuantitas Barang Masuk untuk ${matchCount} bahan berdasarkan laporan Penerimaan/Pembelanjaan hari ini.`);
  };

  // Inline Handlers
  const handleUpdateStockField = (id: string, field: 'barangMasuk' | 'stokAkhir' | 'expiredDate', value: any) => {
    setStockMap(prev => {
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
      id: `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category: newStockCat,
      name: newStockName.trim(),
      stokAwal: stokAwalVal,
      barangMasuk: 0,
      stokAkhir: stokAwalVal,
      uom: newStockUom,
      expiredDate: newStockExpiredDate || undefined
    };

    setStockMap(prev => {
      const currentList = prev[localStockDate] || [];
      return {
        ...prev,
        [localStockDate]: [...currentList, newItem]
      };
    });

    setNewStockName('');
    setNewStockUom('Kg');
    setNewStockExpiredDate('');
    setIsAddingStockItem(false);
    triggerSuccessMsg(`Bahan "${newItem.name}" berhasil ditambahkan ke kategori ${newItem.category}.`);
  };

  const handleRemoveStockItem = (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus "${name}" dari catatan Stock Opname hari ini?`)) {
      setStockMap(prev => {
        const currentList = prev[localStockDate] || [];
        return {
          ...prev,
          [localStockDate]: currentList.filter(item => item.id !== id)
        };
      });
      triggerSuccessMsg(`Bahan "${name}" berhasil dihapus.`);
    }
  };

  const exportStockToCSV = (dateStr: string, items: StockItem[]) => {
    const filename = `Laporan_Stock_Opname_${dateStr}.csv`;
    const headers = [
      'Kategori', 
      'Nama Bahan', 
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
      else if (item.stokAkhir <= 10) status = 'Menipis';

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

    addSavedReport(dateStr, 'stock', filename, items.length, headers, rows);
    downloadCSV(filename, headers, rows);
  };

  // Sync to Next Day (Carry Over)
  const handleSyncToNextDay = () => {
    const nextDateStr = getYesterdayDateStr(localStockDate); // Wait, next day is localStockDate + 1 day
    const currentDateObj = new Date(localStockDate);
    currentDateObj.setDate(currentDateObj.getDate() + 1);
    const actualNextDateStr = currentDateObj.toISOString().split('T')[0];

    setStockMap(prev => {
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
            id: `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

    triggerSuccessMsg(`Sukses menyalin stok! Nilai Stok Akhir hari ini berhasil di-carry-over menjadi Stok Awal untuk esok hari tanggal ${actualNextDateStr}.`);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-emerald-700" />
            Stock Opname Mandiri Terintegrasi (14 Kategori)
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Monitoring stok awal, barang masuk, barang keluar otomatis, dan pencatatan fisik stok akhir harian.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              triggerSuccessMsg(`Laporan Stock Opname tanggal ${localStockDate} berhasil diekspor ke Excel!`);
              exportStockToCSV(localStockDate, activeStockList);
            }}
            className="bg-emerald-700 hover:bg-emerald-850 text-white text-xs font-bold px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Download className="h-4 w-4" /> Ekspor Excel
          </button>
          
          <button
            onClick={() => setShowPrintView(true)}
            className="bg-stone-850 hover:bg-black text-white text-xs font-bold px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs active:scale-[0.98] cursor-pointer"
          >
            <Printer className="h-4 w-4" /> Cetak PDF / Laporan
          </button>

          <button
            onClick={() => setIsAddingStockItem(!isAddingStockItem)}
            className="bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-semibold px-3 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isAddingStockItem ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} 
            {isAddingStockItem ? 'Batal' : 'Tambah Bahan'}
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
          📝 Detail Stok Harian ({localStockDate})
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="h-4 w-4 animate-bounce" /> {successMsg}
        </div>
      )}

      {stockTab === 'rekap' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const datesWithData = Array.from(new Set([
                ...Object.keys(stockMap),
                '2026-06-16',
                '2026-06-17',
                '2026-06-18',
                '2026-06-19',
                '2026-06-20'
              ])).sort().reverse();

              return datesWithData.map(date => {
                const items = stockMap[date] || [];
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
                  <div key={date} className="bg-white border border-neutral-200 rounded-xl shadow-2xs hover:border-emerald-400 hover:shadow-xs transition-all p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="bg-neutral-100 text-neutral-800 text-[10px] font-black px-2 py-0.5 rounded font-mono">
                          {date}
                        </span>
                        <span className="text-xs font-black text-neutral-500">{dayName}</span>
                      </div>
                      <h3 className="text-sm font-bold text-neutral-800">
                        Stock Opname Dapur SPPG
                      </h3>
                      <p className="text-[11px] text-neutral-500 line-clamp-2">
                        {total > 0 
                          ? `Monitoring ${total} bahan pangan logistik. Total Barang Masuk hari ini sebanyak ${totalMasuk.toFixed(1)} unit.`
                          : 'Belum ada data stock opname harian yang dicatat.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-center py-2 border-y border-neutral-100">
                      <div className="bg-neutral-50 rounded p-1.5">
                        <span className="text-[8px] text-neutral-500 block font-bold">BAHAN</span>
                        <span className="text-xs font-extrabold text-neutral-800 font-mono">{total}</span>
                      </div>
                      <div className="bg-emerald-50 rounded p-1.5">
                        <span className="text-[8px] text-emerald-700 block font-bold">MASUK</span>
                        <span className="text-xs font-extrabold text-emerald-950 font-mono">{totalMasuk.toFixed(0)}</span>
                      </div>
                      <div className="bg-amber-50 rounded p-1.5">
                        <span className="text-[8px] text-amber-700 block font-bold">KELUAR (EST)</span>
                        <span className="text-xs font-extrabold text-amber-950 font-mono">{totalKeluar.toFixed(0)}</span>
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
                          triggerSuccessMsg(`Laporan Stock Opname ${date} berhasil diunduh!`);
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

          {/* Saved Reports Section for Stock Opname */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-3 mt-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-emerald-800" />
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 font-mono">Laporan Stock Opname Tersimpan</h3>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-bold px-2.5 py-0.5 rounded-full">
                {savedReports.filter(r => r.module === 'stock').length} File
              </span>
            </div>
            {savedReports.filter(r => r.module === 'stock').length === 0 ? (
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
                    {savedReports.filter(r => r.module === 'stock').map(rep => (
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
                <span className="text-xs font-black text-neutral-700 font-mono">TANGGAL OPNAME:</span>
                <input
                  type="date"
                  value={localStockDate}
                  onChange={e => setLocalStockDate(e.target.value)}
                  className="bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-extrabold text-neutral-800 outline-none focus:ring-1 focus:ring-emerald-700 font-mono cursor-pointer"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAutoImportFromProcurement}
                  className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                  title="Tarik otomatis barang masuk dari penerimaan belanja logistik hari ini"
                >
                  <RefreshCw className="h-3.5 w-3.5 animate-spin-hover" />
                  Tarik Kuantitas dari Pembelanjaan
                </button>

                <button
                  type="button"
                  onClick={handleSyncToNextDay}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                  title="Simpan & carry-over semua Stok Akhir hari ini menjadi Stok Awal besok"
                >
                  <Save className="h-3.5 w-3.5" />
                  Carry Over Stok Akhir ke Besok
                </button>
              </div>
            </div>

            {/* Formula Warning Panel */}
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

          {/* Form Add Custom Stock Item */}
          {isAddingStockItem && (
            <form onSubmit={handleCreateStockItem} className="bg-neutral-50 p-4 rounded-xl border border-neutral-250 space-y-4">
              <h3 className="text-xs font-bold font-mono text-emerald-900 uppercase tracking-wider">Formulir Tambah Bahan Baru</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Bahan</label>
                  <input
                    type="text"
                    required
                    value={newStockName}
                    onChange={e => setNewStockName(e.target.value)}
                    placeholder="Contoh: Gula Merah Batang"
                    className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Kategori</label>
                  <select
                    value={newStockCat}
                    onChange={e => setNewStockCat(e.target.value)}
                    className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  >
                    {STOCK_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">UoM (Satuan)</label>
                  <input
                    type="text"
                    required
                    value={newStockUom}
                    onChange={e => setNewStockUom(e.target.value)}
                    placeholder="Contoh: Kg, Sachet, Roll, Pcs"
                    className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Tanggal Expired</label>
                  <input
                    type="date"
                    value={newStockExpiredDate}
                    onChange={e => setNewStockExpiredDate(e.target.value)}
                    className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white text-neutral-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingStockItem(false)}
                  className="px-3 py-1.5 border border-neutral-300 text-neutral-700 text-xs rounded font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-800 text-white rounded text-xs font-bold"
                >
                  Simpan Bahan
                </button>
              </div>
            </form>
          )}

          {/* Search and Category Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-neutral-400 uppercase mb-1 select-none">Filter Kategori</label>
              <div className="relative">
                <Layers className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                <select
                  value={selectedCategoryFilter}
                  onChange={e => setSelectedCategoryFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-700 font-medium text-neutral-750"
                >
                  <option value="Semua">Semua Kategori (14 Kategori)</option>
                  {STOCK_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[9px] font-bold text-neutral-400 uppercase mb-1 select-none">Cari Nama Bahan</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Ketik kata kunci nama bahan logistik..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-700 text-neutral-800"
                />
              </div>
            </div>
          </div>

          {/* Stock Table List */}
          <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] text-neutral-500 font-extrabold uppercase tracking-wider select-none">
                    <th className="p-3">Nama Bahan</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3 text-right">Stok Awal (Kemarin)</th>
                    <th className="p-3 text-right">Barang Masuk (Pembelanjaan)</th>
                    <th className="p-3 text-right text-amber-700">Barang Keluar (Rumus)</th>
                    <th className="p-3 text-right text-emerald-800">Stok Akhir (Fisik)</th>
                    <th className="p-3 text-center">Satuan</th>
                    <th className="p-3">Tanggal Expired</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-neutral-400 font-medium">
                        Tidak ada data stock opname harian untuk filter pencarian ini.
                      </td>
                    </tr>
                  ) : (
                    filteredStockItems.map(item => {
                      const { stokAwal, barangKeluar, isDerivedFromYesterday } = getComputedItemValues(item, localStockDate);
                      
                      // Auto procurement match indicator
                      const procQty = getSuggestedProcurementQty(item.name);

                      return (
                        <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                          {/* Name */}
                          <td className="p-3 font-semibold text-neutral-900 capitalize">
                            {item.name}
                            {procQty > 0 && (
                              <span className="block text-[9px] text-indigo-700 font-bold mt-0.5">
                                📥 Ada pembelanjaan: {procQty} {item.uom}
                              </span>
                            )}
                          </td>

                          {/* Category */}
                          <td className="p-3">
                            <span className="bg-slate-100 text-slate-800 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border border-slate-200/60 font-mono">
                              {item.category}
                            </span>
                          </td>

                          {/* Stok Awal (Yesterday) - Read Only */}
                          <td className="p-3 text-right font-mono font-bold text-neutral-700">
                            <div className="flex flex-col items-end">
                              <span>{stokAwal}</span>
                              {isDerivedFromYesterday ? (
                                <span className="text-[8px] text-emerald-600 font-bold">Dari Kemarin</span>
                              ) : (
                                <span className="text-[8px] text-neutral-400">Nilai Default</span>
                              )}
                            </div>
                          </td>

                          {/* Barang Masuk (Pembelanjaan) - Admin Input */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                step="any"
                                value={item.barangMasuk}
                                onChange={e => handleUpdateStockField(item.id, 'barangMasuk', e.target.value)}
                                className="w-16 text-right font-mono font-semibold border border-neutral-300 rounded px-1.5 py-0.5 text-xs bg-white text-neutral-800"
                              />
                              {procQty > 0 && item.barangMasuk !== procQty && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStockField(item.id, 'barangMasuk', procQty)}
                                  className="text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold px-1 py-0.5 rounded"
                                  title="Pakai nilai pembelanjaan"
                                >
                                  Gunakan
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Barang Keluar - Calculated Automatically */}
                          <td className="p-3 text-right font-mono font-black text-amber-700 bg-amber-50/20">
                            {barangKeluar >= 0 ? barangKeluar.toFixed(1) : '0.0'}
                          </td>

                          {/* Stok Akhir (Fisik) - Admin Input */}
                          <td className="p-3 text-right bg-emerald-50/10">
                            <input
                              type="number"
                              step="any"
                              value={item.stokAkhir}
                              onChange={e => handleUpdateStockField(item.id, 'stokAkhir', e.target.value)}
                              className="w-16 text-right font-mono font-bold border border-emerald-300 rounded px-1.5 py-0.5 text-xs bg-emerald-50/20 text-emerald-950 focus:border-emerald-600 outline-none"
                            />
                          </td>

                          {/* UoM */}
                          <td className="p-3 text-center text-neutral-500 font-medium">
                            {item.uom}
                          </td>

                          {/* Expired Date */}
                          <td className="p-3">
                            <input
                              type="date"
                              value={item.expiredDate || ''}
                              onChange={e => handleUpdateStockField(item.id, 'expiredDate', e.target.value)}
                              className="text-[10px] font-mono border border-neutral-200 rounded p-0.5 bg-white text-neutral-800 cursor-pointer"
                            />
                          </td>

                          {/* Remove Button */}
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveStockItem(item.id, item.name)}
                              className="p-1 text-neutral-400 hover:text-red-650 rounded hover:bg-neutral-50 transition-colors"
                              title="Hapus Bahan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PDF Print Facsimile Modal */}
      {showPrintView && (
        <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="stock-opname-print-overlay">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-neutral-200 shadow-2xl overflow-hidden my-8">
            {/* Modal Toolbar */}
            <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-emerald-450" />
                <div>
                  <h3 className="font-bold text-sm">Lembar Ekspor PDF Laporan Stock Opname Dapur</h3>
                  <p className="text-[10px] text-neutral-450">Pilih "Save as PDF" di dialog print untuk menyimpan dokumen resmi bertanda tangan digital.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-850 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Ekspor / Cetak Sekarang (PDF)
                </button>
                <button
                  onClick={() => setShowPrintView(false)}
                  className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div className="p-8 md:p-12 bg-white space-y-6 text-black print-area" id="printable-sop-sheet">
              {/* Kop Surat Resmi Yayasan & BGN */}
              <div className="border-b-4 border-double border-neutral-900 pb-4 flex items-center justify-between gap-4">
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
                        const fallback = parent.querySelector('.bgn-fallback-so');
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                  <div className="bgn-fallback-so hidden h-16 w-16 rounded-full border-2 border-emerald-900 bg-emerald-800 text-white flex-col items-center justify-center text-center p-1 font-bold text-[8px] uppercase tracking-tighter shrink-0">
                    <span className="font-black text-[10px]">BGN</span>
                    <span>BADAN GIZI</span>
                  </div>
                </div>

                {/* Center Title */}
                <div className="text-center flex-1 space-y-0.5">
                  <h1 className="text-base sm:text-lg font-extrabold tracking-wider text-neutral-950 uppercase">
                    YAYASAN PONDOK PESANTREN QOMARUDDIN
                  </h1>
                  <h2 className="text-xs sm:text-sm font-black text-neutral-900 uppercase">
                    SATUAN PELAYANAN PROGRAM GIZI (SPPG) BUNGAH 2
                  </h2>
                  <p className="text-[10px] text-neutral-500 font-sans">
                    Jl. Raya Bungah No.1, Bungah, Gresik, Jawa Timur • Telp: (031) 3949012
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
                        const fallback = parent.querySelector('.qom-fallback-so');
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                  <div className="qom-fallback-so hidden h-16 w-16 rounded-full border-2 border-emerald-900 bg-emerald-900 text-white flex-col items-center justify-center text-center p-1 font-bold text-[8px] uppercase tracking-tighter shrink-0">
                    <span className="font-black text-[9px]">PPQ</span>
                    <span>QOMARUDDIN</span>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-1">
                <h3 className="text-base font-black uppercase tracking-widest text-neutral-950 underline">LAPORAN MONITORING & STOCK OPNAME BULANAN/HARIAN</h3>
                <p className="text-xs text-neutral-600">Sistem Penjaminan Mutu & Logistik Bahan Gizi Dapur SPPG</p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <div className="space-y-1.5">
                  <p className="flex justify-between border-b border-neutral-200 pb-1">
                    <span className="text-neutral-500 font-semibold">Hari / Tanggal Laporan:</span> 
                    <span className="font-extrabold text-neutral-850 font-mono">
                      {new Date(localStockDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </p>
                  <p className="flex justify-between border-b border-neutral-200 pb-1">
                    <span className="text-neutral-500 font-semibold">Kategori Stok:</span> 
                    <span className="font-extrabold text-neutral-850">14 Kategori Terpadu</span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="flex justify-between border-b border-neutral-200 pb-1">
                    <span className="text-neutral-500 font-semibold">Penyusun:</span> 
                    <span className="font-extrabold text-neutral-850">Staf Logistik / Admin Dapur</span>
                  </p>
                  <p className="flex justify-between border-b border-neutral-200 pb-1">
                    <span className="text-neutral-500 font-semibold">Tembusan:</span> 
                    <span className="font-extrabold text-neutral-850">Koordinator Lapangan / Ahli Gizi</span>
                  </p>
                </div>
              </div>

              {/* Table of Items */}
              <div className="border border-neutral-300 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs print-table">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-800 font-bold uppercase text-[9px] tracking-wider font-mono">
                      <th className="p-2 border-r border-neutral-300 text-center w-8">No</th>
                      <th className="p-2 border-r border-neutral-300">Nama Bahan</th>
                      <th className="p-2 border-r border-neutral-300">Kategori</th>
                      <th className="p-2 border-r border-neutral-300 text-right">Stok Awal</th>
                      <th className="p-2 border-r border-neutral-300 text-right">Masuk</th>
                      <th className="p-2 border-r border-neutral-300 text-right">Keluar</th>
                      <th className="p-2 border-r border-neutral-300 text-right font-black">Stok Akhir</th>
                      <th className="p-2 border-r border-neutral-300 text-center">Satuan</th>
                      <th className="p-2">Expired</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-300">
                    {activeStockList.map((item, idx) => {
                      const { stokAwal, barangKeluar } = getComputedItemValues(item, localStockDate);
                      return (
                        <tr key={item.id} className="hover:bg-neutral-50/50">
                          <td className="p-2 border-r border-neutral-300 text-center font-mono text-neutral-500">{idx + 1}</td>
                          <td className="p-2 border-r border-neutral-300 font-bold text-neutral-900 capitalize">{item.name}</td>
                          <td className="p-2 border-r border-neutral-300 font-semibold font-mono text-[10px]">{item.category}</td>
                          <td className="p-2 border-r border-neutral-300 text-right font-mono">{stokAwal}</td>
                          <td className="p-2 border-r border-neutral-300 text-right font-mono">{item.barangMasuk}</td>
                          <td className="p-2 border-r border-neutral-300 text-right font-mono text-amber-900">{barangKeluar >= 0 ? barangKeluar.toFixed(1) : '0'}</td>
                          <td className="p-2 border-r border-neutral-300 text-right font-mono font-bold">{item.stokAkhir}</td>
                          <td className="p-2 border-r border-neutral-300 text-center font-mono text-[10px]">{item.uom}</td>
                          <td className="p-2 font-mono text-[10px] text-neutral-600">{item.expiredDate || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 text-xs pt-12">
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
                onClick={() => setShowPrintView(false)}
                className="px-4 py-2 border border-neutral-250 hover:bg-neutral-100 text-neutral-600 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Tutup Pratinjau
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-neutral-900 hover:bg-black text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print / Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
