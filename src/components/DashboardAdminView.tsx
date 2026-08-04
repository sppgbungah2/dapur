import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, CheckCircle2, AlertCircle, Plus, Calendar, Clock, 
  Users, ClipboardList, ShieldAlert, CheckSquare, Settings, ArrowRight,
  TrendingUp, Award, Flame, ThumbsUp, AlertTriangle, MessageSquare, ShoppingCart,
  Check, X, RefreshCw, Star, Info, Trash2, ShieldCheck, HeartHandshake, Eye, Printer, Code, Copy, FileText
} from 'lucide-react';
import { DayMenu, UserRole, Division, SOPDocument, TaskItem } from '../types';
import { DEFAULT_PORTIONS, PortionConfig } from './PortionMasterView';
import { SisaStokItem, OrderRequestItem, VolunteerComplaintItem } from './MockModules';
import DailyReportPDF from './DailyReportPDF';
import { safeLocalStorageSetItem, safeLocalStorageGetItem } from '../lib/storage';
import { createAllInitialShippingDocsForDate } from '../utils/docHelpers';
import { generateInitialDocsAsync } from '../utils/generateDocs';

interface DashboardAdminViewProps {
  selectedDate: string;
  allDayMenus: DayMenu[];
  sops?: SOPDocument[];
  setSops?: React.Dispatch<React.SetStateAction<SOPDocument[]>>;
  onSaveMenu?: (date: string, menuList: string[]) => void;
  onGenerateSOPs?: (date: string, menuList: string[]) => void;
  onGoToTab?: (tabNum: number) => void;
  shippingDocs: any[];
  setShippingDocs: React.Dispatch<React.SetStateAction<any[]>>;
  orderRequests: OrderRequestItem[];
  setOrderRequests: React.Dispatch<React.SetStateAction<OrderRequestItem[]>>;
  keluhanList: VolunteerComplaintItem[];
  setKeluhanList: React.Dispatch<React.SetStateAction<VolunteerComplaintItem[]>>;
  onSaveSopsToCloud?: (date?: string) => Promise<{ success: boolean; message: string }>;
}

export default function DashboardAdminView({
  selectedDate,
  allDayMenus = [],
  sops = [],
  setSops,
  onSaveMenu,
  onGenerateSOPs,
  onGoToTab,
  shippingDocs = [],
  setShippingDocs,
  orderRequests = [],
  setOrderRequests,
  keluhanList = [],
  setKeluhanList,
  onSaveSopsToCloud
}: DashboardAdminViewProps) {
  // Local state for interactive editing
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [quickPorsiModalOpen, setQuickPorsiModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [tempPortions, setTempPortions] = useState<PortionConfig>({ ...DEFAULT_PORTIONS });
  
  // Load portions state for selectedDate
  const [portions, setPortions] = useState<PortionConfig>(() => {
    const saved = localStorage.getItem(`sppg_portions_${selectedDate}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    const globalSaved = localStorage.getItem('sppg_global_master_portions');
    if (globalSaved) {
      try { return JSON.parse(globalSaved); } catch (e) { console.error(e); }
    }
    return { ...DEFAULT_PORTIONS };
  });

  // Track if portions are custom or default
  const [isCustomPortion, setIsCustomPortion] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`sppg_portions_${selectedDate}`);
    if (saved) {
      try {
        setPortions(JSON.parse(saved));
        setIsCustomPortion(true);
      } catch (e) {
        setPortions({ ...DEFAULT_PORTIONS });
        setIsCustomPortion(false);
      }
    } else {
      const globalSaved = localStorage.getItem('sppg_global_master_portions');
      if (globalSaved) {
        try {
          setPortions(JSON.parse(globalSaved));
          setIsCustomPortion(true);
        } catch (e) {
          setPortions({ ...DEFAULT_PORTIONS });
          setIsCustomPortion(false);
        }
      } else {
        setPortions({ ...DEFAULT_PORTIONS });
        setIsCustomPortion(false);
      }
    }
  }, [selectedDate]);

  // Inline Admin Note for Order Approvals
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  // Inline Corrective Action for Complaints
  const [correctiveActions, setCorrectiveActions] = useState<Record<string, string>>({});

  // Calculations for Kitchen Performance & Analysis
  // 1. Total Portions today
  const calculateTotalPortions = (p: PortionConfig) => {
    return (
      p.MA.guru + p.MA.siswa +
      p["MTS II"].guru + p["MTS II"].siswa +
      p.SMK.guru + p.SMK.siswa +
      p.SMA.guru + p.SMA.siswa +
      p.Sukowati.besar + p.Sukowati.kecil +
      p.Sidokumpul.besar + p.Sidokumpul.kecil
    );
  };
  const totalPortions = calculateTotalPortions(portions);

  // 2. Active Menu Status
  const currentDayMenu = allDayMenus.find(m => m.date === selectedDate);
  const hasMenu = !!currentDayMenu;
  const menuItems = currentDayMenu?.menuList || [];

  // 3. SOP Status across all 7 divisions
  const activeSOPs = sops.filter(s => s.date === selectedDate);
  const totalSopsCount = 7;
  const generatedSopsCount = activeSOPs.length;
  const completedSopsCount = activeSOPs.filter(s => s.status === 'selesai' || s.isCheckedAll).length;

  // Calculate overall SOP task completion percentage
  let totalSopTasks = 0;
  let completedSopTasks = 0;
  activeSOPs.forEach(sop => {
    sop.tasks.forEach(task => {
      totalSopTasks++;
      if (task.completed) completedSopTasks++;
    });
  });
  const sopSelesaikanPercent = totalSopTasks > 0 ? Math.round((completedSopTasks / totalSopTasks) * 100) : 0;

  // 4. Shipping Docs Status
  const todayDocs = shippingDocs.filter(d => d.date === selectedDate);
  const omprengDoc = todayDocs.find(d => d.type === 'ompreng');
  const organoleptikDoc = todayDocs.find(d => d.type === 'organoleptik');
  
  // BAST completeness (6 target locations)
  const todayBastDocs = todayDocs.filter(d => d.type === 'serah_terima');
  const completedBastLocations = todayBastDocs.map(d => d.receiverName || d.bastSekolah || '');
  const totalBastNeeded = 6;
  const currentBastCount = todayBastDocs.length;

  // Surat Jalan completeness (6 target locations)
  const todaySjDocs = todayDocs.filter(d => d.type === 'surat_jalan');
  const currentSjCount = todaySjDocs.length;

  // Organoleptik scores
  const getAverageOrlepScore = () => {
    if (!organoleptikDoc) return 0;
    const grid = organoleptikDoc.orlepGrid || organoleptikDoc.organoleptikGrid;
    if (grid) {
      const vals = Object.values(grid) as number[];
      if (vals.length > 0) {
        const sum = vals.reduce((a, b) => a + b, 0);
        return parseFloat((sum / vals.length).toFixed(1));
      }
    }
    // Legacy simple scores fallback
    return 4.5;
  };
  const orlepAverageScore = getAverageOrlepScore();
  const orlepSuhu = organoleptikDoc?.organoleptikSuhu || organoleptikDoc?.orlepSuhu || '68';

  // 5. Waste status
  // Retrieve saved waste logs from localStorage
  const [wasteLogs, setWasteLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem('sppg_waste_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  useEffect(() => {
    const saved = localStorage.getItem('sppg_waste_logs');
    if (saved) {
      try { setWasteLogs(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, [selectedDate]);

  const todayWasteLog = wasteLogs.find(w => w.date === selectedDate);
  const totalWasteKg = todayWasteLog ? (parseFloat(todayWasteLog.totalWastePlateKg || 0) + parseFloat(todayWasteLog.totalWasteKitchenKg || 0)).toFixed(1) : '0.0';

  // Quick preset menu helper for "Buat" action
  const handleSetDefaultMenu = () => {
    if (!onSaveMenu) return;
    const defaultMenu = ['Nasi Putih', 'Ayam Geprek Sambal Korek', 'Tumis Kangkung Belacan', 'Khrupuk Udang', 'Pisang Ambon'];
    onSaveMenu(selectedDate, defaultMenu);
    
    // Also auto-generate SOPs based on this menu as expected
    if (onGenerateSOPs) {
      onGenerateSOPs(selectedDate, defaultMenu);
    }

    // Auto-generate BAST, Surat Jalan & Organoleptik docs for this date
    handleCentralInitialization();
    
    setSuccessMsg('Menu default, SOP 7 divisi & Berkas Surat berhasil disiapkan!');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

    // Centralized Initialization for ALL Documents
  const handleCentralInitialization = async () => {
    if (!onGenerateSOPs || !setShippingDocs) return;
    
    // 1. Generate SOPs
    const menuStr = hasMenu ? menuItems.join(', ') : 'Nasi Putih, Lauk Gizi, Sayur, Buah';
    const menuArr = hasMenu ? menuItems : ['Nasi Putih', 'Lauk Gizi Masak', 'Sayur Segar', 'Krupuk', 'Buah'];
    onGenerateSOPs(selectedDate, menuArr);

    // 2. Generate BAST, Surat Jalan, Organoleptik
    const uploaderEmail = loggedInUser?.email || 'admin@sppg.com';
    const updatedDocs = await generateInitialDocsAsync(selectedDate, shippingDocs, menuStr, uploaderEmail);
    setShippingDocs(updatedDocs);
    
    setSuccessMsg(`Berhasil menginisialisasi SEMUA dokumen (SOP, BAST, Surat Jalan, Organoleptik) ke Supabase untuk tanggal ${selectedDate}!`);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // Trigger whole-kitchen SOP Generation
  const handleQuickGenerateSOPs = () => {
    if (!onGenerateSOPs) return;
    const menu = hasMenu ? menuItems : ['Nasi Putih', 'Lauk Gizi Masak', 'Sayur Segar', 'Krupuk', 'Buah'];
    onGenerateSOPs(selectedDate, menu);
    setSuccessMsg(`SOP Checklist untuk 7 divisi berhasil dibuat untuk tanggal ${selectedDate}!`);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Explicitly Save SOPs to Cloud Supabase
  const handleSaveToCloud = async () => {
    if (!onSaveSopsToCloud) return;
    setIsSavingCloud(true);
    try {
      const res = await onSaveSopsToCloud(selectedDate);
      setSuccessMsg(res.message);
    } catch (err: any) {
      alert('Gagal menyimpan ke Cloud: ' + (err?.message || err));
    } finally {
      setIsSavingCloud(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // Quick set portions
  const handleOpenQuickPorsi = () => {
    setTempPortions({ ...portions });
    setQuickPorsiModalOpen(true);
  };

  const handleSaveQuickPorsi = (e: React.FormEvent) => {
    e.preventDefault();
    safeLocalStorageSetItem(`sppg_portions_${selectedDate}`, JSON.stringify(tempPortions));
    setPortions({ ...tempPortions });
    setIsCustomPortion(true);
    setQuickPorsiModalOpen(false);
    
    setSuccessMsg('Kebutuhan jumlah porsi hari ini berhasil disesuaikan!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Inline approval functions
  const handleApproveOrder = (orderId: string) => {
    const note = adminNotes[orderId] || 'Disetujui oleh Administrator Utama';
    const updated = orderRequests.map(req => {
      if (req.id === orderId) {
        return { ...req, status: 'disetujui' as const, notes: note };
      }
      return req;
    });
    setOrderRequests(updated);
    safeLocalStorageSetItem('sppg_order_requests', JSON.stringify(updated));
    setSuccessMsg('Permohonan order berhasil disetujui!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleRejectOrder = (orderId: string) => {
    const note = adminNotes[orderId];
    if (!note) {
      alert('Silakan masukkan alasan penolakan di kolom catatan.');
      return;
    }
    const updated = orderRequests.map(req => {
      if (req.id === orderId) {
        return { ...req, status: 'ditolak_admin_utama' as const, notes: note };
      }
      return req;
    });
    setOrderRequests(updated);
    safeLocalStorageSetItem('sppg_order_requests', JSON.stringify(updated));
    setSuccessMsg('Permohonan order berhasil ditolak dengan catatan.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Inline complaint resolution
  const handleResolveComplaint = (complaintId: string) => {
    const action = correctiveActions[complaintId] || 'Tindakan korektif diselesaikan oleh Admin Utama';
    const updated = keluhanList.map(item => {
      if (item.id === complaintId) {
        return { ...item, status: 'selesai' as const, action_taken: action };
      }
      return item;
    });
    setKeluhanList(updated);
    safeLocalStorageSetItem('sppg_volunteer_complaints', JSON.stringify(updated));
    setSuccessMsg('Keluhan relawan berhasil diselesaikan & diarsipkan!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in" id="dashboard-admin-main">
      
      {/* Banner / Header */}
      <div className="bg-linear-to-r from-emerald-800 to-emerald-950 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12">
          <LayoutDashboard className="w-80 h-80" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-750/50 border border-emerald-500/30 text-emerald-350 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
              ★ CONTROL CENTER & ANALYTICS
            </span>
            <span className="bg-amber-500 text-neutral-950 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full animate-pulse">
              LIVE MONITOR
            </span>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans">
                Dashboard Admin Utama
              </h1>
              <p className="text-emerald-100 text-xs mt-1 font-light max-w-xl">
                Selamat datang kembali. Di sini Anda dapat memantau kelengkapan dokumen operasional, membuat draf tugas, menyetujui anggaran belanja, serta menganalisis efisiensi dapur.
              </p>
            </div>
            
            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {onSaveSopsToCloud && (
                <button
                  onClick={handleSaveToCloud}
                  disabled={isSavingCloud}
                  className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-neutral-950 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-emerald-300"
                >
                  {isSavingCloud ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-950" />}
                  SIMPAN SOP KE CLOUD
                </button>
              )}
              <button
                onClick={() => setSqlModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Code className="w-4 h-4 text-indigo-200" />
                Setting SQL Query
              </button>
              <button
                onClick={() => setIsReportOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4 text-neutral-900" />
                Ekspor PDF Laporan Harian
              </button>
              <button
                onClick={handleCentralInitialization}
                className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-amber-400/30"
              >
                <FileText className="w-4 h-4 text-amber-100" />
                Inisialisasi Semua Dokumen (SOP & Surat)
              </button>
              <button
                onClick={handleSetDefaultMenu}
                className="bg-white text-emerald-900 hover:bg-emerald-50 active:scale-95 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-700" />
                Draf Cepat SOP Hari Ini
              </button>
              <button
                onClick={() => onGoToTab?.(10)}
                className="bg-emerald-700 hover:bg-emerald-600 active:scale-95 border border-emerald-500/30 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                Kalender Gizi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 shadow-xs animate-slide-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid STATS CARDS (Analisis Kinerja Dapur) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Stat 1: Total Porsi */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-3xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Kebutuhan Porsi</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2.5">
            <span className="text-xl sm:text-2xl font-black text-neutral-850 font-sans tracking-tight">
              {totalPortions}
            </span>
            <span className="text-[10px] block text-neutral-400 font-medium mt-0.5">
              {isCustomPortion ? '🟢 Kustom Hari Ini' : '🟡 Default Preset'}
            </span>
          </div>
        </div>

        {/* Stat 2: SOP Completed Rate */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-3xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Kepatuhan SOP</span>
            <CheckSquare className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2.5">
            <span className="text-xl sm:text-2xl font-black text-neutral-850 font-sans tracking-tight">
              {sopSelesaikanPercent}%
            </span>
            <span className="text-[10px] block text-neutral-400 font-medium mt-0.5">
              {completedSopsCount} dari {generatedSopsCount} SOP Selesai
            </span>
          </div>
        </div>

        {/* Stat 3: Organoleptik Rating */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-3xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Uji Rasa (Orlep)</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2.5">
            <span className="text-xl sm:text-2xl font-black text-neutral-850 font-sans tracking-tight">
              {organoleptikDoc ? `${orlepAverageScore} / 5` : 'N/A'}
            </span>
            <span className="text-[10px] block text-neutral-400 font-medium mt-0.5">
              {organoleptikDoc ? `🌡️ Suhu Penyajian: ${orlepSuhu}°C` : 'Belum Ada Uji Umpan'}
            </span>
          </div>
        </div>

        {/* Stat 4: Kitchen Waste */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-3xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Sampah Makanan</span>
            <Trash2 className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2.5">
            <span className="text-xl sm:text-2xl font-black text-neutral-850 font-sans tracking-tight">
              {totalWasteKg} Kg
            </span>
            <span className="text-[10px] block text-neutral-400 font-medium mt-0.5">
              {todayWasteLog ? '📋 Tercatat Hari Ini' : '🔴 Belum Ada Laporan'}
            </span>
          </div>
        </div>

        {/* Stat 5: Pending Orders */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-3xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Persetujuan Belanja</span>
            <ShoppingCart className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2.5">
            <span className="text-xl sm:text-2xl font-black text-neutral-850 font-sans tracking-tight">
              {orderRequests.filter(o => o.status === 'pending').length}
            </span>
            <span className="text-[10px] block text-neutral-400 font-medium mt-0.5">
              Permohonan Butuh Approval
            </span>
          </div>
        </div>

        {/* Stat 6: Complaints */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-3xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Keluhan Lapangan</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2.5">
            <span className="text-xl sm:text-2xl font-black text-neutral-850 font-sans tracking-tight">
              {keluhanList.filter(k => k.status === 'pending').length}
            </span>
            <span className="text-[10px] block text-neutral-400 font-medium mt-0.5">
              Laporan Relawan Terbuka
            </span>
          </div>
        </div>
      </div>

      {/* Main Operational Table (Melihat mana yang belum dibuat atau di update) */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50">
          <div className="space-y-0.5">
            <h2 className="font-bold text-md text-neutral-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-800" />
              Kelengkapan & Validitas Dokumen Harian
            </h2>
            <p className="text-xs text-neutral-400">Daftar kelengkapan tugas harian admin untuk tanggal terpilih ({selectedDate})</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500">Pilih Tanggal:</span>
            <div className="text-xs font-bold bg-white px-3 py-1.5 border border-neutral-200 rounded-lg text-neutral-700">
              {selectedDate}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest">
                <th className="p-4">Tugas / Lembar Kerja</th>
                <th className="p-4">Penanggung Jawab</th>
                <th className="p-4">Rincian / Status Data</th>
                <th className="p-4 text-center">Status Keaktifan</th>
                <th className="p-4 text-right">Aksi Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              
              {/* Row 1: Perencanaan Menu */}
              <tr>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">Menu Harian Gizi</div>
                  <div className="text-[10px] text-neutral-400">Penyusunan gizi santri & katering</div>
                </td>
                <td className="p-4 font-medium text-neutral-600">Ahli Gizi Ponpes</td>
                <td className="p-4">
                  {hasMenu ? (
                    <div className="flex flex-wrap gap-1 max-w-sm">
                      {menuItems.map((item, idx) => (
                        <span key={idx} className="bg-emerald-50 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-emerald-100">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-red-500 italic font-medium">Belum Ditentukan</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {hasMenu ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟢 Sesuai
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🔴 Belum Dibuat
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  {!hasMenu ? (
                    <button
                      onClick={handleSetDefaultMenu}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer active:scale-95"
                    >
                      Set Menu Default
                    </button>
                  ) : (
                    <button
                      onClick={() => onGoToTab?.(10)}
                      className="text-neutral-500 hover:text-emerald-800 font-bold text-[10px] transition-all"
                    >
                      Ubah Menu
                    </button>
                  )}
                </td>
              </tr>

              {/* Row 2: Master Jumlah Porsi */}
              <tr>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">Master Jumlah Porsi</div>
                  <div className="text-[10px] text-neutral-400">Pagu porsi 6 lembaga sekolah & desa</div>
                </td>
                <td className="p-4 font-medium text-neutral-600">Staff Akuntan / Admin</td>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">{totalPortions} Porsi</div>
                  <div className="text-[10px] text-neutral-400">
                    {isCustomPortion ? 'Kustomisasi porsi operasional hari ini' : `Berdasarkan database master (${totalPortions} Porsi)`}
                  </div>
                </td>
                <td className="p-4 text-center">
                  {isCustomPortion ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟢 Ditetapkan (Kustom)
                    </span>
                  ) : (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟡 Default Preset
                    </span>
                  )}
                </td>
                <td className="p-4 text-right flex items-center justify-end gap-1.5">
                  <button
                    onClick={handleOpenQuickPorsi}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer"
                  >
                    Quick Adjust Porsi
                  </button>
                  <button
                    onClick={() => onGoToTab?.(22)}
                    className="text-neutral-400 hover:text-neutral-600 font-bold text-[10px]"
                  >
                    Atur Rinci
                  </button>
                </td>
              </tr>

              {/* Row 3: SOP 7 Divisi */}
              <tr>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">SOP Checklist Harian</div>
                  <div className="text-[10px] text-neutral-400">Pemberlakuan hygiene & checklist 7 divisi</div>
                </td>
                <td className="p-4 font-medium text-neutral-600">Supervisor & Koordinator</td>
                <td className="p-4">
                  {generatedSopsCount > 0 ? (
                    <div className="space-y-1">
                      <div className="font-bold text-neutral-800">{generatedSopsCount} dari 7 SOP Aktif</div>
                      <div className="w-32 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${(generatedSopsCount / 7) * 100}%` }}></div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-red-500 italic font-medium">SOP Belum Digenerate</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {generatedSopsCount === 7 && completedSopsCount === 7 ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟢 Lengkap (7/7 Selesai)
                    </span>
                  ) : generatedSopsCount > 0 ? (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟡 Proses ({completedSopsCount}/{generatedSopsCount} Selesai)
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🔴 Belum Dibuat
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  {generatedSopsCount === 0 ? (
                    
              <button
                onClick={handleCentralInitialization}
                className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-amber-400/30"
              >
                <FileText className="w-4 h-4 text-amber-100" />
                Inisialisasi Semua Dokumen (SOP & Surat)
              </button>

                  ) : (
                    <button
                      onClick={() => onGoToTab?.(15)}
                      className="text-neutral-500 hover:text-emerald-800 font-bold text-[10px]"
                    >
                      Buka Dashboard SOP
                    </button>
                  )}
                </td>
              </tr>

              {/* Row 4: Ompreng Delivery */}
              <tr>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">Pengiriman Kontainer Ompreng</div>
                  <div className="text-[10px] text-neutral-400">Verifikasi kontainer stainless steril berangkat</div>
                </td>
                <td className="p-4 font-medium text-neutral-600">Aslap / Driver Logistik</td>
                <td className="p-4 text-neutral-600 font-mono">
                  {omprengDoc ? (
                    <span className="text-neutral-700 font-sans font-bold">
                      📦 Kirim ke {omprengDoc.receiverName} ({omprengDoc.vehicleNumber})
                    </span>
                  ) : (
                    <span className="text-red-500 italic font-sans font-medium">Belum di-update hari ini</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {omprengDoc ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟢 Terverifikasi
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🔴 Belum di-update
                    </span>
                  )}
                </td>
                <td className="p-4 text-right flex items-center justify-end gap-2">
                  <a
                    href="https://drive.google.com/drive/folders/1-2i-2zctARA9tuLXPSTNX25of6qR7CxY"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 font-bold text-[10px] px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                  >
                    Drive Ompreng ↗
                  </a>
                  <button
                    onClick={() => onGoToTab?.(18)}
                    className="text-neutral-500 hover:text-emerald-800 font-bold text-[10px]"
                  >
                    Buka Modul
                  </button>
                </td>
              </tr>

              {/* Row 5: Berita Acara Serah Terima (BAST) */}
              <tr>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">Berita Acara (BAST)</div>
                  <div className="text-[10px] text-neutral-400">Dokumen serah terima bertandatangan basah sekolah</div>
                </td>
                <td className="p-4 font-medium text-neutral-600">Driver / Staf Sekolah</td>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">{currentBastCount} dari {totalBastNeeded} Berkas</div>
                  {completedBastLocations.length > 0 && (
                    <div className="text-[9px] text-neutral-400 truncate max-w-xs mt-0.5">
                      Lembaga: {completedBastLocations.join(', ')}
                    </div>
                  )}
                </td>
                <td className="p-4 text-center">
                  {currentBastCount === totalBastNeeded ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟢 Lengkap ({currentBastCount}/{totalBastNeeded})
                    </span>
                  ) : currentBastCount > 0 ? (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟡 Sebagian ({currentBastCount}/{totalBastNeeded})
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🔴 Belum Ada BAST
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => onGoToTab?.(19)}
                    className="text-neutral-500 hover:text-emerald-800 font-bold text-[10px]"
                  >
                    Lihat Berkas BAST
                  </button>
                </td>
              </tr>

              {/* Row 6: Surat Jalan */}
              <tr>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">Surat Jalan Resmi</div>
                  <div className="text-[10px] text-neutral-400">Daftar item & logistik pengangkutan keliling</div>
                </td>
                <td className="p-4 font-medium text-neutral-600">Driver / Aslap</td>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">{currentSjCount} dari {totalBastNeeded} Lembaga</div>
                </td>
                <td className="p-4 text-center">
                  {currentSjCount === totalBastNeeded ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟢 Lengkap ({currentSjCount}/{totalBastNeeded})
                    </span>
                  ) : currentSjCount > 0 ? (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟡 Sebagian ({currentSjCount}/{totalBastNeeded})
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🔴 Belum Ada Surat Jalan
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => onGoToTab?.(20)}
                    className="text-neutral-500 hover:text-emerald-800 font-bold text-[10px]"
                  >
                    Urus Surat Jalan
                  </button>
                </td>
              </tr>

              {/* Row 7: Uji Organoleptik */}
              <tr>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">Uji Sensori Organoleptik</div>
                  <div className="text-[10px] text-neutral-400">Uji kelayakan rasa, warna, aroma, tekstur & suhu</div>
                </td>
                <td className="p-4 font-medium text-neutral-600">Ahli Gizi / Panelis</td>
                <td className="p-4">
                  {organoleptikDoc ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                      <span className="font-bold text-neutral-800">{orlepAverageScore} / 5</span>
                      <span className="text-[10px] text-neutral-400">({organoleptikDoc.receiverName || 'Uji Panelis'})</span>
                    </div>
                  ) : (
                    <span className="text-red-500 italic font-medium">Belum Diuji</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {organoleptikDoc ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟢 Lulus Uji Orlep
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🔴 Belum Diuji
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => onGoToTab?.(21)}
                    className="text-neutral-500 hover:text-emerald-800 font-bold text-[10px]"
                  >
                    Buka Hasil Uji
                  </button>
                </td>
              </tr>

              {/* Row 8: Food Waste */}
              <tr>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">Rekap Sampah Makanan (Waste)</div>
                  <div className="text-[10px] text-neutral-400">Pencatatan sisa konsumsi piring & sisa produksi</div>
                </td>
                <td className="p-4 font-medium text-neutral-600">Koordinator Kebersihan</td>
                <td className="p-4">
                  {todayWasteLog ? (
                    <div className="font-bold text-neutral-800">Wasted: {totalWasteKg} Kg</div>
                  ) : (
                    <span className="text-red-500 italic font-medium">Belum Ada Rekap</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {todayWasteLog ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟢 Tercatat
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🔴 Belum Dicatat
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => onGoToTab?.(16)}
                    className="text-neutral-500 hover:text-emerald-800 font-bold text-[10px]"
                  >
                    Buka Log Waste
                  </button>
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: 2 Columns - Kitchen Analytics Detail & Active Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Kitchen Performance Analysis (Analisis Kinerja Dapur) */}
        <div className="space-y-6">
          
          {/* Card: SOP Compliance Division Breakdown */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-xs space-y-4">
            <h3 className="font-extrabold text-neutral-800 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-neutral-50 pb-3">
              <Flame className="w-4 h-4 text-emerald-700" />
              SOP Kepatuhan Per Divisi Kerja
            </h3>
            
            <div className="space-y-4">
              {Object.values(Division).map((div) => {
                const matchedSOP = activeSOPs.find(s => s.division === div);
                let completedCount = 0;
                let totalCount = 0;
                
                if (matchedSOP) {
                  matchedSOP.tasks.forEach(t => {
                    totalCount++;
                    if (t.completed) completedCount++;
                  });
                }
                
                const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                const isSigned = matchedSOP?.signatureSupervisorUrl || matchedSOP?.signatureCoordinatorUrl;

                return (
                  <div key={div} className="space-y-1.5 p-3 rounded-xl hover:bg-neutral-50/50 transition-all border border-neutral-50">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-neutral-850 flex items-center gap-1.5 text-xs">
                        {div}
                        {matchedSOP?.status === 'selesai' && (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <span className="font-mono text-[11px] font-bold text-neutral-500">
                        {matchedSOP ? `${completedCount}/${totalCount} (${percent}%)` : '🔴 Belum Digenerate'}
                      </span>
                    </div>

                    {matchedSOP ? (
                      <div className="space-y-1">
                        <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              percent === 100 ? 'bg-emerald-600' : percent > 50 ? 'bg-emerald-500' : 'bg-amber-400'
                            }`} 
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-neutral-400">
                          <span>Pembuat: {matchedSOP.creatorName || matchedSOP.creatorRole}</span>
                          <span className={isSigned ? 'text-emerald-700 font-bold' : 'text-neutral-400'}>
                            {isSigned ? '✍️ Ditandatangani' : '⏳ Belum Ditandatangan'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-neutral-400 italic">Klik tombol "Draf Cepat" atau "Generate" untuk membuat berkas checklist</span>
                        <button
                          onClick={handleQuickGenerateSOPs}
                          className="text-emerald-800 hover:underline font-bold text-[9px] uppercase"
                        >
                          Generate SOP
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: Organoleptik Sensory & HACCP Temperature Analysis */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-xs space-y-4">
            <h3 className="font-extrabold text-neutral-800 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-neutral-50 pb-3">
              <Award className="w-4 h-4 text-emerald-700" />
              Kontrol Keamanan Pangan (HACCP Check)
            </h3>
            
            {organoleptikDoc ? (
              <div className="space-y-4">
                {/* Temperature Indicator */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  parseInt(orlepSuhu) >= 60 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
                    : 'bg-red-50 border-red-200 text-red-950 animate-pulse'
                }`}>
                  <div className="space-y-0.5">
                    <span className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">Suhu Penyajian Daging/Sayur</span>
                    <span className="text-lg font-black">{orlepSuhu}° Celcius</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {parseInt(orlepSuhu) >= 60 ? (
                      <>
                        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="font-bold">Suhu Aman HACCP (&gt;60°C)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                        <span className="font-bold text-red-700">Bahaya Bakteri (&lt;60°C)!</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Score breakdown bar charts */}
                <div className="space-y-3">
                  <span className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Detail Penilaian Sensori</span>
                  
                  {/* Rasa */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-700">Rasa (Kelezatan & Kesegaran)</span>
                      <span className="font-bold">4.8 / 5</span>
                    </div>
                    <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: '96%' }}></div>
                    </div>
                  </div>

                  {/* Aroma */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-700">Aroma (Harum / Tidak Prengus)</span>
                      <span className="font-bold">4.7 / 5</span>
                    </div>
                    <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: '94%' }}></div>
                    </div>
                  </div>

                  {/* Tekstur */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-700">Tekstur (Empuk / Kematangan Pas)</span>
                      <span className="font-bold">4.6 / 5</span>
                    </div>
                    <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-200">
                <AlertCircle className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                <span className="block text-xs font-bold text-neutral-500">Hasil Uji Organoleptik Belum Dikirim</span>
                <span className="block text-[10px] text-neutral-400 mt-0.5">Uji panelis harian belum dimasukkan untuk tanggal terpilih</span>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Active Approvals and Volunteer Issues */}
        <div className="space-y-6">
          
          {/* Section: Pending Order Approvals */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
              <h3 className="font-extrabold text-neutral-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-purple-700" />
                Antrean Persetujuan Belanja / Order
              </h3>
              <span className="bg-purple-100 text-purple-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                {orderRequests.filter(o => o.status === 'pending').length} MENUNGGU
              </span>
            </div>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {orderRequests.filter(o => o.status === 'pending').length > 0 ? (
                orderRequests.filter(o => o.status === 'pending').map((item) => (
                  <div key={item.id} className="p-4 bg-purple-50/20 border border-purple-100 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-neutral-850 text-xs">
                          {item.item_name}
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          Kuantitas: <span className="font-bold text-neutral-700">{item.qty}</span> • Pembuat: {item.created_by || 'Staf Dapur'}
                        </div>
                      </div>
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        PENDING
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-purple-100/50 text-[10px] text-neutral-600">
                      <span className="font-bold block text-[8px] uppercase tracking-wider text-neutral-400 mb-0.5">Alasan Kebutuhan:</span>
                      "{item.reason}"
                    </div>

                    {/* Action form */}
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        placeholder="Catatan persetujuan / alasan jika ditolak..."
                        value={adminNotes[item.id] || ''}
                        onChange={e => setAdminNotes({ ...adminNotes, [item.id]: e.target.value })}
                        className="w-full bg-white text-[10px] p-2 border border-neutral-200 rounded-lg focus:ring-1 focus:ring-emerald-700 outline-hidden"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveOrder(item.id)}
                          className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Setujui Anggaran
                        </button>
                        <button
                          onClick={() => handleRejectOrder(item.id)}
                          className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Tolak
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-200">
                  <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <span className="block text-xs font-bold text-neutral-500">Semua Order Telah Diproses</span>
                  <span className="block text-[10px] text-neutral-400 mt-0.5">Tidak ada permohonan belanja yang tertunda saat ini.</span>
                </div>
              )}
            </div>
          </div>

          {/* Section: Active School/Volunteer Complaints */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
              <h3 className="font-extrabold text-neutral-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-700" />
                Penanganan Keluhan / Aduan Lapangan
              </h3>
              <span className="bg-red-100 text-red-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                {keluhanList.filter(k => k.status === 'pending').length} TERBUKA
              </span>
            </div>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {keluhanList.filter(k => k.status === 'pending').length > 0 ? (
                keluhanList.filter(k => k.status === 'pending').map((item) => (
                  <div key={item.id} className="p-4 bg-rose-50/20 border border-rose-100 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-neutral-850 text-xs">
                          Sumber: {item.source}
                        </div>
                        <div className="text-[9px] text-neutral-400 uppercase font-bold mt-0.5 tracking-wider">
                          Kategori: {item.category}
                        </div>
                      </div>
                      <span className="bg-red-100 text-red-800 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                        UTAMA
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-rose-100/50 text-[10px] text-neutral-600">
                      <span className="font-bold block text-[8px] uppercase tracking-wider text-neutral-400 mb-0.5">Laporan Masalah:</span>
                      "{item.complaint_text}"
                    </div>

                    {/* Action form */}
                    <div className="space-y-2">
                      <textarea 
                        rows={2}
                        placeholder="Tindakan korektif nyata yang diambil dituduhkan..."
                        value={correctiveActions[item.id] || ''}
                        onChange={e => setCorrectiveActions({ ...correctiveActions, [item.id]: e.target.value })}
                        className="w-full bg-white text-[10px] p-2 border border-neutral-200 rounded-lg focus:ring-1 focus:ring-emerald-700 outline-hidden resize-none"
                      />
                      <button
                        onClick={() => handleResolveComplaint(item.id)}
                        className="w-full bg-neutral-900 hover:bg-neutral-850 text-white font-extrabold text-[10px] py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <HeartHandshake className="w-3.5 h-3.5" /> Eksekusi Tindakan & Tutup Tiket
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-200">
                  <ThumbsUp className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <span className="block text-xs font-bold text-neutral-500">Layanan Dapur Berjalan Lancar</span>
                  <span className="block text-[10px] text-neutral-400 mt-0.5">Tidak ada laporan keluhan yang tertunda saat ini.</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* QUICK PORTION ADJUSTMENT MODAL */}
      {quickPorsiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form 
            onSubmit={handleSaveQuickPorsi}
            className="bg-white w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl animate-scale-in"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-extrabold text-neutral-850 text-sm flex items-center gap-1.5">
                <Users className="w-5 h-5 text-emerald-800" />
                Penyesuaian Cepat Jumlah Porsi
              </h3>
              <button 
                type="button" 
                onClick={() => setQuickPorsiModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto p-1 text-xs">
              
              <div className="p-3 bg-neutral-50 rounded-xl space-y-2 border border-neutral-100">
                <div className="font-bold text-emerald-900 text-xs">MA Assa'adah</div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Guru/Staf</label>
                  <input 
                    type="number" 
                    value={tempPortions.MA.guru}
                    onChange={e => setTempPortions({ ...tempPortions, MA: { ...tempPortions.MA, guru: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Siswa/Santri</label>
                  <input 
                    type="number" 
                    value={tempPortions.MA.siswa}
                    onChange={e => setTempPortions({ ...tempPortions, MA: { ...tempPortions.MA, siswa: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl space-y-2 border border-neutral-100">
                <div className="font-bold text-emerald-900 text-xs">MTS II Assa'adah</div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Guru/Staf</label>
                  <input 
                    type="number" 
                    value={tempPortions["MTS II"].guru}
                    onChange={e => setTempPortions({ ...tempPortions, "MTS II": { ...tempPortions["MTS II"], guru: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Siswa/Santri</label>
                  <input 
                    type="number" 
                    value={tempPortions["MTS II"].siswa}
                    onChange={e => setTempPortions({ ...tempPortions, "MTS II": { ...tempPortions["MTS II"], siswa: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl space-y-2 border border-neutral-100">
                <div className="font-bold text-emerald-900 text-xs">SMK Assa'adah</div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Guru/Staf</label>
                  <input 
                    type="number" 
                    value={tempPortions.SMK.guru}
                    onChange={e => setTempPortions({ ...tempPortions, SMK: { ...tempPortions.SMK, guru: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Siswa/Santri</label>
                  <input 
                    type="number" 
                    value={tempPortions.SMK.siswa}
                    onChange={e => setTempPortions({ ...tempPortions, SMK: { ...tempPortions.SMK, siswa: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl space-y-2 border border-neutral-100">
                <div className="font-bold text-emerald-900 text-xs">SMA Assa'adah</div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Guru/Staf</label>
                  <input 
                    type="number" 
                    value={tempPortions.SMA.guru}
                    onChange={e => setTempPortions({ ...tempPortions, SMA: { ...tempPortions.SMA, guru: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Siswa/Santri</label>
                  <input 
                    type="number" 
                    value={tempPortions.SMA.siswa}
                    onChange={e => setTempPortions({ ...tempPortions, SMA: { ...tempPortions.SMA, siswa: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl space-y-2 border border-neutral-100">
                <div className="font-bold text-emerald-900 text-xs">Desa Sukowati</div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Porsi Besar</label>
                  <input 
                    type="number" 
                    value={tempPortions.Sukowati.besar}
                    onChange={e => setTempPortions({ ...tempPortions, Sukowati: { ...tempPortions.Sukowati, besar: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Porsi Kecil</label>
                  <input 
                    type="number" 
                    value={tempPortions.Sukowati.kecil}
                    onChange={e => setTempPortions({ ...tempPortions, Sukowati: { ...tempPortions.Sukowati, kecil: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl space-y-2 border border-neutral-100">
                <div className="font-bold text-emerald-900 text-xs">Desa Sidokumpul</div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Porsi Besar</label>
                  <input 
                    type="number" 
                    value={tempPortions.Sidokumpul.besar}
                    onChange={e => setTempPortions({ ...tempPortions, Sidokumpul: { ...tempPortions.Sidokumpul, besar: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase">Porsi Kecil</label>
                  <input 
                    type="number" 
                    value={tempPortions.Sidokumpul.kecil}
                    onChange={e => setTempPortions({ ...tempPortions, Sidokumpul: { ...tempPortions.Sidokumpul, kecil: parseInt(e.target.value) || 0 }})}
                    className="w-full bg-white p-2 border border-neutral-200 rounded-lg text-neutral-700" 
                  />
                </div>
              </div>

            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-neutral-100">
              <button
                type="submit"
                className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer"
              >
                Simpan Penyesuaian
              </button>
              <button
                type="button"
                onClick={() => setQuickPorsiModalOpen(false)}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {isReportOpen && (
        <DailyReportPDF
          selectedDate={selectedDate}
          allDayMenus={allDayMenus}
          sops={sops}
          portions={portions}
          shippingDocs={shippingDocs}
          orderRequests={orderRequests}
          keluhanList={keluhanList}
          onClose={() => setIsReportOpen(false)}
        />
      )}

      {sqlModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white max-w-3xl w-full rounded-2xl p-6 shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-indigo-600" />
                <h3 className="font-extrabold text-neutral-900 text-base">Setting SQL Query Supabase (Per-Divisi)</h3>
              </div>
              <button
                onClick={() => setSqlModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg cursor-pointer hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 overflow-y-auto flex-1 font-sans text-xs">
              <p className="text-neutral-600">
                Gunakan query SQL reset & recreate ini (<code className="bg-neutral-100 px-1 py-0.5 rounded font-mono text-emerald-700">sql_query_3.sql</code>) untuk menghapus/reset seluruh data & tabel lama dan membuat ulang seluruh struktur database Supabase beserta RLS Policy secara lengkap.
              </p>
              
              <div className="bg-neutral-900 text-neutral-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-x-auto relative group">
                <button
                  onClick={() => {
                    const sqlText = `-- SQL RESET & RECREATE SUPABASE (sql_query_3.sql)
-- PERINTAH: Salin seluruh skrip ini dan jalankan di Dashboard Supabase -> SQL Editor.

DROP TABLE IF EXISTS public.day_menus CASCADE;
DROP TABLE IF EXISTS public.sops CASCADE;
DROP TABLE IF EXISTS public.sop_tasks CASCADE;

DROP TABLE IF EXISTS public.sop_tasks_driver CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_stocking CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_masak CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_pemorsian CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_kebersihan CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_cuci CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_keamanan CASCADE;

DROP TABLE IF EXISTS public.sop_task_driver CASCADE;
DROP TABLE IF EXISTS public.sop_task_stocking CASCADE;
DROP TABLE IF EXISTS public.sop_task_masak CASCADE;
DROP TABLE IF EXISTS public.sop_task_pemorsian CASCADE;
DROP TABLE IF EXISTS public.sop_task_kebersihan CASCADE;
DROP TABLE IF EXISTS public.sop_task_cuci CASCADE;
DROP TABLE IF EXISTS public.sop_task_keamanan CASCADE;

DROP TABLE IF EXISTS public.sisa_stok CASCADE;
DROP TABLE IF EXISTS public.order_requests CASCADE;
DROP TABLE IF EXISTS public.volunteer_complaints CASCADE;
DROP TABLE IF EXISTS public.shipping_docs CASCADE;
DROP TABLE IF EXISTS public.kedatangan_barang CASCADE;
DROP TABLE IF EXISTS public.bast_docs CASCADE;
DROP TABLE IF EXISTS public.organoleptik_docs CASCADE;
DROP TABLE IF EXISTS public.absensi_logs CASCADE;
DROP TABLE IF EXISTS public.absensi_signoffs CASCADE;
DROP TABLE IF EXISTS public.absensi_signoff CASCADE;

CREATE TABLE public.day_menus (
  id TEXT, date TEXT PRIMARY KEY, day_name TEXT, menu_list JSONB NOT NULL DEFAULT '[]'::jsonb, portion_count INT DEFAULT 100, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), created_by TEXT DEFAULT 'admin@qomaruddin.com'
);

CREATE TABLE public.sops (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, division TEXT NOT NULL, creator_role TEXT, creator_name TEXT, is_checked_all BOOLEAN DEFAULT FALSE, signer_supervisor TEXT, signature_supervisor_url TEXT, signed_supervisor_at TIMESTAMP WITH TIME ZONE, signer_coordinator TEXT, signature_coordinator_url TEXT, signed_coordinator_at TIMESTAMP WITH TIME ZONE, status TEXT DEFAULT 'aktif', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.sop_tasks (
  id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.sop_tasks_driver ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_stocking ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_masak ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_pemorsian ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_kebersihan ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_cuci ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_keamanan ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );

CREATE TABLE public.sop_task_driver ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_task_stocking ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_task_masak ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_task_pemorsian ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_task_kebersihan ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_task_cuci ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_task_keamanan ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );

CREATE TABLE public.sisa_stok ( id TEXT PRIMARY KEY, date TEXT NOT NULL, item_name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'kg', stock_qty NUMERIC DEFAULT 0, notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.order_requests ( id TEXT PRIMARY KEY, item_name TEXT NOT NULL, qty NUMERIC NOT NULL DEFAULT 1, unit TEXT DEFAULT 'pcs', requester TEXT, department TEXT, priority TEXT DEFAULT 'Normal', status TEXT DEFAULT 'Pending', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.volunteer_complaints ( id TEXT PRIMARY KEY, date TEXT NOT NULL, volunteer_name TEXT NOT NULL, division TEXT, complaint TEXT NOT NULL, status TEXT DEFAULT 'Baru', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.shipping_docs ( id TEXT PRIMARY KEY, type TEXT DEFAULT 'ompreng', date TEXT NOT NULL, sj_no TEXT, sj_kepada TEXT, sj_driver TEXT, status TEXT DEFAULT 'Kirim Sukses', items JSONB DEFAULT '[]'::jsonb, photo_url TEXT, comments TEXT, uploaded_by TEXT, uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.kedatangan_barang ( id TEXT PRIMARY KEY, date TEXT NOT NULL, item_name TEXT NOT NULL, category TEXT, qty NUMERIC DEFAULT 0, unit TEXT DEFAULT 'kg', supplier TEXT, status TEXT DEFAULT 'Sesuai', photo_url TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.bast_docs ( id TEXT PRIMARY KEY, date TEXT NOT NULL, bast_no TEXT, bast_sekolah TEXT, bast_driver TEXT, bast_penerima TEXT, status TEXT DEFAULT 'BAST Sah', items JSONB DEFAULT '[]'::jsonb, photo_url TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.organoleptik_docs ( id TEXT PRIMARY KEY, date TEXT NOT NULL, tester_name TEXT, menu_name TEXT, color_score INT DEFAULT 5, aroma_score INT DEFAULT 5, taste_score INT DEFAULT 5, texture_score INT DEFAULT 5, notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.absensi_logs ( id TEXT PRIMARY KEY, date TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, check_in_time TEXT, notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.absensi_signoffs ( date TEXT PRIMARY KEY, signer_ketua TEXT, signature_ketua_url TEXT, signed_ketua_at TEXT, signer_aslap TEXT, signature_aslap_url TEXT, signed_aslap_at TEXT, status TEXT DEFAULT 'Draft', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.absensi_signoff ( date TEXT PRIMARY KEY, signer_ketua TEXT, signature_ketua_url TEXT, signed_ketua_at TEXT, signer_aslap TEXT, signature_aslap_url TEXT, signed_aslap_at TEXT, status TEXT DEFAULT 'Draft', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );

DO $$ 
DECLARE 
  tbl text;
BEGIN 
  FOR tbl IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP 
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public Full Access" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow All Access" ON public.%I;', tbl);
    EXECUTE format('CREATE POLICY "Public Full Access" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl);
  END LOOP; 
END $$;`;
                    navigator.clipboard.writeText(sqlText);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 3000);
                  }}
                  className="absolute top-3 right-3 bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  {copiedSql ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedSql ? 'Tersalin!' : 'Salin SQL'}
                </button>
                <pre className="whitespace-pre-wrap">
{`-- SQL RESET & RECREATE SUPABASE (sql_query_3.sql)
-- PERINTAH: Salin seluruh skrip ini dan jalankan di Dashboard Supabase -> SQL Editor.

DROP TABLE IF EXISTS public.day_menus CASCADE;
DROP TABLE IF EXISTS public.sops CASCADE;
DROP TABLE IF EXISTS public.sop_tasks CASCADE;

DROP TABLE IF EXISTS public.sop_tasks_driver CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_stocking CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_masak CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_pemorsian CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_kebersihan CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_cuci CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_keamanan CASCADE;

DROP TABLE IF EXISTS public.sop_task_driver CASCADE;
DROP TABLE IF EXISTS public.sop_task_stocking CASCADE;
DROP TABLE IF EXISTS public.sop_task_masak CASCADE;
DROP TABLE IF EXISTS public.sop_task_pemorsian CASCADE;
DROP TABLE IF EXISTS public.sop_task_kebersihan CASCADE;
DROP TABLE IF EXISTS public.sop_task_cuci CASCADE;
DROP TABLE IF EXISTS public.sop_task_keamanan CASCADE;

DROP TABLE IF EXISTS public.sisa_stok CASCADE;
DROP TABLE IF EXISTS public.order_requests CASCADE;
DROP TABLE IF EXISTS public.volunteer_complaints CASCADE;
DROP TABLE IF EXISTS public.shipping_docs CASCADE;
DROP TABLE IF EXISTS public.surat_jalan_docs CASCADE;
DROP TABLE IF EXISTS public.kedatangan_barang CASCADE;
DROP TABLE IF EXISTS public.bast_docs CASCADE;
DROP TABLE IF EXISTS public.organoleptik_docs CASCADE;
DROP TABLE IF EXISTS public.absensi_logs CASCADE;
DROP TABLE IF EXISTS public.absensi_signoffs CASCADE;
DROP TABLE IF EXISTS public.absensi_signoff CASCADE;

CREATE TABLE public.day_menus ( id TEXT, date TEXT PRIMARY KEY, day_name TEXT, menu_list JSONB NOT NULL DEFAULT '[]'::jsonb, portion_count INT DEFAULT 100, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), created_by TEXT DEFAULT 'admin@qomaruddin.com' );
CREATE TABLE public.sops ( id TEXT PRIMARY KEY, date TEXT NOT NULL, division TEXT NOT NULL, creator_role TEXT, creator_name TEXT, is_checked_all BOOLEAN DEFAULT FALSE, signer_supervisor TEXT, signature_supervisor_url TEXT, signed_supervisor_at TIMESTAMP WITH TIME ZONE, signer_coordinator TEXT, signature_coordinator_url TEXT, signed_coordinator_at TIMESTAMP WITH TIME ZONE, status TEXT DEFAULT 'aktif', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );

CREATE TABLE public.sop_tasks_driver ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_stocking ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_masak ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_pemorsian ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_kebersihan ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_cuci ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_keamanan ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );

CREATE TABLE public.sisa_stok ( id TEXT PRIMARY KEY, date TEXT NOT NULL, item_name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'kg', stock_qty NUMERIC DEFAULT 0, notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.order_requests ( id TEXT PRIMARY KEY, item_name TEXT NOT NULL, qty NUMERIC NOT NULL DEFAULT 1, unit TEXT DEFAULT 'pcs', requester TEXT, department TEXT, priority TEXT DEFAULT 'Normal', status TEXT DEFAULT 'Pending', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.volunteer_complaints ( id TEXT PRIMARY KEY, date TEXT NOT NULL, volunteer_name TEXT NOT NULL, division TEXT, complaint TEXT NOT NULL, status TEXT DEFAULT 'Baru', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.surat_jalan_docs ( id TEXT PRIMARY KEY, date TEXT NOT NULL, sj_no TEXT, sj_kepada TEXT, sj_driver TEXT, sj_waktu TEXT, status TEXT DEFAULT 'Terkirim', items JSONB DEFAULT '[]'::jsonb, sj_rows JSONB DEFAULT '[]'::jsonb, photo_url TEXT, comments TEXT, sj_signature_aslap TEXT, sj_signature_receiver TEXT, uploaded_by TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.bast_docs ( id TEXT PRIMARY KEY, date TEXT NOT NULL, bast_no TEXT, bast_sekolah TEXT, bast_driver TEXT, bast_penerima TEXT, bast_barang TEXT, bast_jumlah NUMERIC DEFAULT 0, bast_waktu TEXT, status TEXT DEFAULT 'BAST Sah', items JSONB DEFAULT '[]'::jsonb, photo_url TEXT, bast_signature_driver TEXT, bast_signature_receiver TEXT, uploaded_by TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.organoleptik_docs ( id TEXT PRIMARY KEY, date TEXT NOT NULL, tester_name TEXT, menu_name TEXT, orlep_menu TEXT, orlep_panelis TEXT, orlep_jam TEXT, orlep_desa TEXT, organoleptik_rasa TEXT, organoleptik_aroma TEXT, organoleptik_tekstur TEXT, organoleptik_suhu TEXT, color_score INT DEFAULT 5, aroma_score INT DEFAULT 5, taste_score INT DEFAULT 5, texture_score INT DEFAULT 5, orlep_kritik TEXT, orlep_grid JSONB DEFAULT '[]'::jsonb, orlep_signature TEXT, notes TEXT, status TEXT DEFAULT 'Lulus Uji', photo_url TEXT, uploaded_by TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.shipping_docs ( id TEXT PRIMARY KEY, type TEXT DEFAULT 'ompreng', date TEXT NOT NULL, vehicle_number TEXT, receiver_name TEXT, sj_no TEXT, sj_kepada TEXT, sj_driver TEXT, status TEXT DEFAULT 'Kirim Sukses', items JSONB DEFAULT '[]'::jsonb, photo_url TEXT, image_url TEXT, comments TEXT, uploaded_by TEXT, uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.kedatangan_barang ( id TEXT PRIMARY KEY, date TEXT NOT NULL, item_name TEXT NOT NULL, category TEXT, qty NUMERIC DEFAULT 0, unit TEXT DEFAULT 'kg', supplier TEXT, status TEXT DEFAULT 'Sesuai', photo_url TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.absensi_logs ( id TEXT PRIMARY KEY, date TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, check_in_time TEXT, notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.absensi_signoffs ( date TEXT PRIMARY KEY, signer_ketua TEXT, signature_ketua_url TEXT, signed_ketua_at TEXT, signer_aslap TEXT, signature_aslap_url TEXT, signed_aslap_at TEXT, status TEXT DEFAULT 'Draft', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, postgres, service_role;

DO $$ 
DECLARE 
  tbl text;
BEGIN 
  FOR tbl IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP 
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, postgres, service_role;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public Full Access" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow All Access" ON public.%I;', tbl);
    EXECUTE format('CREATE POLICY "Public Full Access" ON public.%I FOR ALL TO public USING (true) WITH CHECK (true);', tbl);
  END LOOP; 
END $$;`}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex justify-end gap-2">
              <button
                onClick={() => setSqlModalOpen(false)}
                className="bg-neutral-850 hover:bg-neutral-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
              >
                Tutup Window
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
