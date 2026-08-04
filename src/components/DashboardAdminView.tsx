import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, CheckCircle2, XCircle, AlertCircle, Plus, Calendar, Clock, 
  Users, ClipboardList, ShieldAlert, CheckSquare, Settings, ArrowRight,
  TrendingUp, Award, Flame, ThumbsUp, AlertTriangle, MessageSquare, ShoppingCart,
  Check, X, RefreshCw, Star, Info, Trash2, ShieldCheck, HeartHandshake, Eye, Printer, Code, Copy, FileText
} from 'lucide-react';
import { DayMenu, UserRole, Division, SOPDocument, TaskItem } from '../types';
import { DEFAULT_PORTIONS, PortionConfig } from './PortionMasterView';
import { SisaStokItem, OrderRequestItem, VolunteerComplaintItem } from './MockModules';
import DailyReportPDF from './DailyReportPDF';
import PerencanaanMenuPorsi from "./PerencanaanMenuPorsi";
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
  const [quickPorsiModalOpen, setQuickPorsiModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [tempPortions, setTempPortions] = useState<PortionConfig>({ ...DEFAULT_PORTIONS });
  
  // Load portions state for selectedDate
  const [portions, setPortions] = useState<PortionConfig>(() => {
    const saved = localStorage.getItem(`sppg_portions_${selectedDate}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.warn(e); }
    }
    const globalSaved = localStorage.getItem('sppg_global_master_portions');
    if (globalSaved) {
      try { return JSON.parse(globalSaved); } catch (e) { console.warn(e); }
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
  // Calculate signature completeness
  const sjDocs = todayDocs.filter(d => d.type === 'surat_jalan');
  const bastDocs = todayDocs.filter(d => d.type === 'serah_terima');
  const orlepDocs = todayDocs.filter(d => d.type === 'organoleptik');
  let totalSigs = 0;
  let completedSigs = 0;
  sjDocs.forEach(d => {
      totalSigs += 3;
      if (d.signatureSender) completedSigs++;
      if (d.signatureDriver) completedSigs++;
      if (d.signatureReceiver) completedSigs++;
  });
  bastDocs.forEach(d => {
      totalSigs += 2;
      if (d.signatureAdmin) completedSigs++;
      if (d.signatureReceiver) completedSigs++;
  });
  orlepDocs.forEach(d => {
      totalSigs += 2;
      if (d.signatureGizi) completedSigs++;
      if (d.signatureChef) completedSigs++;
  });
  const isSigsComplete = totalSigs > 0 && completedSigs === totalSigs;
  const completedBastLocations = todayBastDocs.map(d => d.receiverName || d.bastSekolah || '');
  const totalBastNeeded = 6;
  const currentBastCount = todayBastDocs.length;
  // Surat Jalan completeness (6 target locations)
  const todaySjDocs = todayDocs.filter(d => d.type === 'surat_jalan');
  const currentSjCount = todaySjDocs.length;

  const currentOrlepCount = orlepDocs.length;
  const totalOrlepNeeded = 3;
  const pendingOrders = orderRequests.filter(o => o.status === 'pending');
  const pendingComplaints = keluhanList.filter(k => k.status === 'pending');

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
  const [wasteLogs, setWasteLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem('sppg_waste_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.warn(e); }
    }
    return [];
  });
  const todayWasteLog = wasteLogs.find(w => w.date === selectedDate);
  const totalWasteKg = todayWasteLog ? (parseFloat(todayWasteLog.totalWastePlateKg || 0) + parseFloat(todayWasteLog.totalWasteKitchenKg || 0)).toFixed(1) : '0.0';

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
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in" id="dashboard-admin-main">

      <PerencanaanMenuPorsi 
        selectedDate={selectedDate} 
        onSuccess={msg => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3500); }} 
        onGenerateSOPs={onGenerateSOPs!} 
        shippingDocs={shippingDocs} 
        setShippingDocs={setShippingDocs} 
        allDayMenus={allDayMenus} 
        onSaveMenu={onSaveMenu!} 
      />
      
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
              {isSigsComplete && (
                <button
                  onClick={() => setIsReportOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-neutral-950 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-neutral-900" />
                  Cetak Rekap Dokumen
                </button>
              )}
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
                  <div className="font-bold text-neutral-800">Draf Menu Makan & Gizi</div>
                  <div className="text-[10px] text-neutral-400">Penyusunan menu, kalori, dan nutrisi harian</div>
                </td>
                <td className="p-4 font-medium text-neutral-600">Ahli Gizi / Chef</td>
                <td className="p-4">
                  {hasMenu ? (
                    <div className="font-medium text-neutral-800 text-xs">
                      {menuItems.slice(0, 2).join(', ')} {menuItems.length > 2 && <span className="text-[9px] text-neutral-400 ml-1">+{menuItems.length - 2} lagi</span>}
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
                      onClick={() => onGoToTab?.(10)}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer active:scale-95"
                    >
                      Buka Kalender Gizi
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
                  <div className="text-[10px] text-neutral-400">Pagu porsi operasional hari ini</div>
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
                      🔴 Kosong
                    </span>
                  )}
                </td>
                <td className="p-4 text-right flex items-center justify-end gap-2">
                  <button
                    onClick={() => onGoToTab?.(15)}
                    className="text-neutral-500 hover:text-emerald-800 font-bold text-[10px]"
                  >
                    Buka Dashboard SOP
                  </button>
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
                    className="text-neutral-400 hover:text-neutral-600 font-bold text-[10px]"
                  >
                    Atur Rinci
                  </button>
                </td>
              </tr>

              {/* Row 5: Kelengkapan Tanda Tangan PM */}
              <tr>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">Kelengkapan Tanda Tangan PM</div>
                  <div className="text-[10px] text-neutral-400">Persetujuan BAST, Surat Jalan & Organoleptik</div>
                </td>
                <td className="p-4 font-medium text-neutral-600">PM & Koordinator</td>
                <td className="p-4">
                  {totalSigs > 0 ? (
                    <div className="space-y-1">
                      <div className="font-bold text-neutral-800">{completedSigs} dari {totalSigs} TTD Aktif</div>
                      <div className="w-32 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${(completedSigs / totalSigs) * 100}%` }}></div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-red-500 italic font-medium">Belum Diinisiasi</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {isSigsComplete ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟢 Lengkap Selesai
                    </span>
                  ) : totalSigs > 0 ? (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟡 Menunggu ({totalSigs - completedSigs} lagi)
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🔴 Kosong
                    </span>
                  )}
                </td>
                <td className="p-4 text-right flex items-center justify-end gap-2">
                  <span className="text-[10px] text-neutral-400 italic">Lihat ditiap modul dokumen</span>
                </td>
              </tr>

              {/* Row 6: Berita Acara Serah Terima (BAST) */}
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
                <td className="p-4 text-right flex items-center justify-end gap-2">
                  <button
                    onClick={() => onGoToTab?.(19)}
                    className="text-neutral-500 hover:text-emerald-800 font-bold text-[10px]"
                  >
                    Lihat Berkas BAST
                  </button>
                </td>
              </tr>

              {/* Row 7: Surat Jalan */}
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
                <td className="p-4 text-right flex items-center justify-end gap-2">
                  <button
                    onClick={() => onGoToTab?.(21)}
                    className="text-neutral-500 hover:text-emerald-800 font-bold text-[10px]"
                  >
                    Lihat Surat Jalan
                  </button>
                </td>
              </tr>

              {/* Row 8: Uji Organoleptik */}
              <tr>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">Uji Organoleptik</div>
                  <div className="text-[10px] text-neutral-400">Pengecekan Rasa, Tekstur, Suhu & Visual (Target 3/hari)</div>
                </td>
                <td className="p-4 font-medium text-neutral-600">Ahli Gizi & Tester Independen</td>
                <td className="p-4">
                  <div className="font-bold text-neutral-800">{currentOrlepCount} dari {totalOrlepNeeded} Sampel</div>
                </td>
                <td className="p-4 text-center">
                  {currentOrlepCount >= totalOrlepNeeded ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟢 Lengkap ({currentOrlepCount}/{totalOrlepNeeded})
                    </span>
                  ) : currentOrlepCount > 0 ? (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🟡 Sebagian ({currentOrlepCount}/{totalOrlepNeeded})
                    </span>
                  ) : (
                    <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      🔴 Belum Uji Taste
                    </span>
                  )}
                </td>
                <td className="p-4 text-right flex items-center justify-end gap-2">
                  <button
                    onClick={() => onGoToTab?.(20)}
                    className="text-neutral-500 hover:text-emerald-800 font-bold text-[10px]"
                  >
                    Buka Hasil Uji
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Grid: 2 Columns - Kitchen Analytics Detail & Active Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Kitchen Performance Analysis */}
        <div className="space-y-6">
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
                        <span className="text-neutral-400 italic">Belum ada dokumen SOP. Buat melalui SOP Harian.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Approvals & Complaints */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-xs space-y-4">
            <h3 className="font-extrabold text-neutral-800 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-neutral-50 pb-3">
              <ShoppingCart className="w-4 h-4 text-emerald-700" />
              Persetujuan Order Belanja
            </h3>
            <div className="space-y-3">
              {pendingOrders.length === 0 ? (
                <div className="text-center py-6 text-neutral-400 text-xs italic bg-neutral-50 rounded-xl">
                  Tidak ada permohonan belanja yang menunggu persetujuan.
                </div>
              ) : (
                pendingOrders.map(order => (
                  <div key={order.id} className="border border-neutral-100 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-neutral-850">{order.item_name}</div>
                        <div className="text-[10px] text-neutral-500">{order.qty} • {order.category} • Oleh: {order.created_by || "Admin"}</div>
                      </div>
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Menunggu
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Catatan persetujuan / penolakan..." 
                        className="flex-1 text-xs px-3 py-1.5 border border-neutral-200 rounded-lg outline-hidden focus:border-emerald-500"
                        value={adminNotes[order.id] || ''}
                        onChange={e => setAdminNotes({...adminNotes, [order.id]: e.target.value})}
                      />
                      <button onClick={() => handleApproveOrder(order.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg cursor-pointer transition-colors" title="Setujui">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleRejectOrder(order.id)} className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-lg cursor-pointer transition-colors" title="Tolak">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-xs space-y-4">
            <h3 className="font-extrabold text-neutral-800 text-xs uppercase tracking-wider flex items-center gap-2 border-b border-neutral-50 pb-3">
              <MessageSquare className="w-4 h-4 text-emerald-700" />
              Keluhan Relawan Desa
            </h3>
            <div className="space-y-3">
              {pendingComplaints.length === 0 ? (
                <div className="text-center py-6 text-neutral-400 text-xs italic bg-neutral-50 rounded-xl">
                  Tidak ada keluhan baru dari relawan.
                </div>
              ) : (
                pendingComplaints.map(comp => (
                  <div key={comp.id} className="border border-neutral-100 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[10px] text-neutral-500">{comp.created_at} • {comp.category || "Umum"}</div>
                        <div className="font-bold text-neutral-850 mt-0.5">{comp.created_by || "Relawan"}</div>
                        <div className="text-xs text-neutral-700 mt-1 italic">"{comp.complaint_text}"</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Tindakan korektif yang dilakukan..." 
                        className="flex-1 text-xs px-3 py-1.5 border border-neutral-200 rounded-lg outline-hidden focus:border-emerald-500"
                        value={correctiveActions[comp.id] || ''}
                        onChange={e => setCorrectiveActions({...correctiveActions, [comp.id]: e.target.value})}
                      />
                      <button onClick={() => handleResolveComplaint(comp.id)} className="bg-neutral-850 hover:bg-neutral-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shrink-0">
                        Tandai Selesai
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Porsi Modal */}
      {quickPorsiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-emerald-900 p-5 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Quick Adjust Porsi Harian
              </h3>
              <button onClick={() => setQuickPorsiModalOpen(false)} className="text-white hover:text-emerald-200 transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveQuickPorsi} className="p-6 space-y-4">
              {Object.keys(tempPortions).map(key => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={tempPortions[key as keyof typeof tempPortions]}
                    onChange={(e) => setTempPortions({...tempPortions, [key]: parseInt(e.target.value) || 0})}
                    className="w-24 text-right px-3 py-2 border border-neutral-200 rounded-xl text-sm font-bold focus:border-emerald-500 outline-hidden"
                  />
                </div>
              ))}
              <div className="pt-4 border-t border-neutral-100 flex justify-end gap-2">
                <button type="button" onClick={() => setQuickPorsiModalOpen(false)} className="text-neutral-500 hover:text-neutral-700 font-bold text-xs px-4 py-2 cursor-pointer">Batal</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer">Simpan Porsi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

