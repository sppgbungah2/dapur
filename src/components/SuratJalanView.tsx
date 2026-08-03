import React, { useState, useEffect } from 'react';
import { 
  Truck, Calendar, Plus, Trash2, CheckCircle2, ChevronRight, 
  ArrowLeft, Printer, ShieldAlert, Check, X, UserCheck,
  Search, Filter, Eye, BarChart3
} from 'lucide-react';
import { DayMenu, UserRole, DRIVERS_LIST } from '../types';
import { supabase, isSupabaseConfigured, UserProfile } from '../lib/supabase';
import { DEFAULT_PORTIONS, PortionConfig } from './PortionMasterView';
import { getRecipientName, getDefaultReceiptTime } from '../presetData';
import SignaturePad from './SignaturePad';

interface SuratJalanViewProps {
  shippingDocs: any[];
  setShippingDocs: React.Dispatch<React.SetStateAction<any[]>>;
  selectedDate: string;
  loggedInUser?: UserProfile | null;
  currentUserRole: UserRole;
  allDayMenus?: DayMenu[];
}

export default function SuratJalanView({
  shippingDocs,
  setShippingDocs,
  selectedDate,
  loggedInUser,
  currentUserRole,
  allDayMenus = []
}: SuratJalanViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDoc, setActiveDoc] = useState<any | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dashboard & Rekapitulasi States
  const [filterSchool, setFilterSchool] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<'selected' | 'all'>('selected');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Signature state for active sheet
  const [activeSigRequest, setActiveSigRequest] = useState<{
    targetField: 'sjSignatureAslap' | 'sjSignatureReceiver';
    title: string;
    suggestedName: string;
  } | null>(null);

  const getPenerimaLocation = (email: string): string => {
    const e = email.toLowerCase().trim();
    if (e === 'ma@qomaruddin.com') return "MA Assa'adah";
    if (e === 'smk@qomaruddin.com') return "SMK Assa'adah";
    if (e === 'sma@qomaruddin.com') return "SMA Assa'adah";
    if (e === 'mts@qomaruddin.com') return "MTS Assa'adah II";
    if (e === 'sukowati@qomaruddin.com') return "Desa Sukowati";
    if (e === 'sidokumpul@qomaruddin.com') return "Desa Sidokumpul";
    return "";
  };

  const restrictedLocation = loggedInUser?.email ? getPenerimaLocation(loggedInUser.email) : "";
  const isAdminOrAslap = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.ASLAP || (loggedInUser?.email && ['maghfur@qomaruddin.com', 'rifkah@qomaruddin.com', 'fajar@qomaruddin.com', 'sam@qomaruddin.com', 'maghfurmunif@gmail.com', 'punkysme@gmail.com', 'ketua@sppg.com'].includes(loggedInUser.email.toLowerCase().trim()));
  const isAkunUtama = currentUserRole === UserRole.ADMIN || (loggedInUser?.email && ['punkysme@gmail.com', 'ketua@sppg.com'].includes(loggedInUser.email.toLowerCase().trim()));

  // Daily list of docs for selected date (for releasing check)
  const dateDocs = shippingDocs.filter(d => d.type === 'surat_jalan' && d.date === selectedDate);

  // Full dataset for filters & rekapitulasi
  const allSjDocs = shippingDocs.filter(d => d.type === 'surat_jalan');

  // Filtered list based on role and choices
  const filteredDocs = allSjDocs.filter(doc => {
    // 1. Role boundaries
    if (restrictedLocation && doc.sjKepada !== restrictedLocation) return false;
    
    // For non-admin (driver/penerima), we ONLY show current date
    if (!isAdminOrAslap && doc.date !== selectedDate) return false;

    // 2. Admin filters
    if (isAdminOrAslap) {
      const matchesDate = filterDate === 'all' || doc.date === selectedDate;
      const matchesSchool = filterSchool === 'all' || doc.sjKepada === filterSchool;
      const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
      if (!matchesDate || !matchesSchool || !matchesStatus) return false;
    }

    // 3. Search text
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchesSearch = (
        (doc.sjKepada && doc.sjKepada.toLowerCase().includes(s)) ||
        (doc.sjNo && doc.sjNo.toLowerCase().includes(s)) ||
        (doc.sjDriver && doc.sjDriver.toLowerCase().includes(s)) ||
        (doc.date && doc.date.includes(s))
      );
      if (!matchesSearch) return false;
    }

    return true;
  });

  // Keep activeDoc in sync with updated shippingDocs from parent state
  useEffect(() => {
    if (activeDoc) {
      const latest = shippingDocs.find(d => d.id === activeDoc.id);
      if (latest && JSON.stringify(latest) !== JSON.stringify(activeDoc)) {
        setActiveDoc(latest);
      }
    }
  }, [shippingDocs]);

  // Auto select for Penerima if exists
  useEffect(() => {
    if (restrictedLocation) {
      const allSuratJalanForDate = shippingDocs.filter(d => d.type === 'surat_jalan' && d.date === selectedDate);
      if (allSuratJalanForDate.length > 0 && !activeDoc) {
        const matched = allSuratJalanForDate.find(d => d.sjKepada === restrictedLocation);
        if (matched) {
          setActiveDoc(matched);
        }
      }
    }
  }, [restrictedLocation, shippingDocs, selectedDate, activeDoc]);

  const getIndonesianDateText = (dateStr: string) => {
    if (!dateStr) return { dayName: 'Rabu', dateNum: '15', monthName: 'Juli', yearNum: '2026' };
    const dateObj = new Date(dateStr);
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = parseInt(parts[1]) - 1;
      const d = parseInt(parts[2]);
      const localDate = new Date(parseInt(y), m, d);
      return {
        dayName: dayNames[localDate.getDay()],
        dateNum: d.toString(),
        monthName: monthNames[m],
        yearNum: y
      };
    }
    return {
      dayName: dayNames[dateObj.getDay()] || 'Rabu',
      dateNum: dateObj.getDate().toString() || '15',
      monthName: monthNames[dateObj.getMonth()] || 'Juli',
      yearNum: dateObj.getFullYear().toString() || '2026'
    };
  };

  const generateAbbrev = (schoolName: string) => {
    const upper = (schoolName || '').toUpperCase();
    if (upper.includes('SMA')) return 'SMA';
    if (upper.includes('SMK')) return 'SMK';
    if (upper.includes('MTS') || upper.includes('TSANAWIYAH')) return 'MTS';
    if (upper.includes('MA')) return 'MA';
    if (upper.includes('SIDOKUMPUL')) return 'DS_SDK';
    if (upper.includes('SUKOWATI')) return 'DS_SKW';
    if (upper.includes('DESA')) return 'DESA';
    return 'LBG';
  };

  // Auto initialize Surat Jalan for 6 locations
  const handleInitializeSuratJalan = async () => {
    const existing = shippingDocs.filter(d => d.type === 'surat_jalan' && d.date === selectedDate);
    if (existing.length > 0) {
      setErrorMsg('Berkas Surat Jalan untuk tanggal ini sudah diinisialisasi dan tidak dapat dibuat lagi.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if (!isAkunUtama) {
      setErrorMsg('Hanya Akun Utama (Administrator) yang dapat menginisialisasi berkas Surat Jalan baru.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    // 1. Fetch portions dynamically from Supabase or localStorage
    let portions: PortionConfig = { ...DEFAULT_PORTIONS };
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('master_porsi')
          .select('portions')
          .eq('date', selectedDate)
          .maybeSingle();
        
        if (error) {
          console.warn("Could not load portions from Supabase for Surat Jalan, trying local cache:", error);
        } else if (data && data.portions) {
          portions = data.portions as PortionConfig;
        } else {
          // Check master template from cloud
          const { data: tplData } = await supabase
            .from('master_porsi')
            .select('portions')
            .eq('date', '1970-01-01')
            .maybeSingle();

          if (tplData && tplData.portions) {
            portions = tplData.portions as PortionConfig;
          } else {
            const saved = localStorage.getItem(`sppg_portions_${selectedDate}`);
            if (saved) {
              portions = JSON.parse(saved);
            } else {
              const globalSaved = localStorage.getItem('sppg_global_master_portions');
              if (globalSaved) portions = JSON.parse(globalSaved);
            }
          }
        }
      } else {
        const saved = localStorage.getItem(`sppg_portions_${selectedDate}`);
        if (saved) {
          portions = JSON.parse(saved);
        } else {
          const globalSaved = localStorage.getItem('sppg_global_master_portions');
          if (globalSaved) portions = JSON.parse(globalSaved);
        }
      }
    } catch (err) {
      console.error("Error loading portion master data for Surat Jalan initialization:", err);
    }

    const schools = [
      "MA Assa'adah",
      "MTS Assa'adah II",
      "SMA Assa'adah",
      "SMK Assa'adah",
      "Desa Sidokumpul",
      "Desa Sukowati"
    ];

    const getPortionCount = (schName: string) => {
      if (schName === "MA Assa'adah") {
        return (portions.MA?.guru || 0) + (portions.MA?.siswa || 0);
      }
      if (schName === "MTS Assa'adah II") {
        return (portions["MTS II"]?.guru || 0) + (portions["MTS II"]?.siswa || 0);
      }
      if (schName === "SMA Assa'adah") {
        return (portions.SMA?.guru || 0) + (portions.SMA?.siswa || 0);
      }
      if (schName === "SMK Assa'adah") {
        return (portions.SMK?.guru || 0) + (portions.SMK?.siswa || 0);
      }
      if (schName === "Desa Sukowati") {
        return (portions.Sukowati?.besar || 0) + (portions.Sukowati?.kecil || 0);
      }
      if (schName === "Desa Sidokumpul") {
        return (portions.Sidokumpul?.besar || 0) + (portions.Sidokumpul?.kecil || 0);
      }
      return 265; // absolute default
    };

    const getPortionBreakdown = (schName: string) => {
      if (schName === "MA Assa'adah") {
        return `(Siswa: ${portions.MA?.siswa || 0}, Guru: ${portions.MA?.guru || 0})`;
      }
      if (schName === "MTS Assa'adah II") {
        return `(Siswa: ${portions["MTS II"]?.siswa || 0}, Guru: ${portions["MTS II"]?.guru || 0})`;
      }
      if (schName === "SMA Assa'adah") {
        return `(Siswa: ${portions.SMA?.siswa || 0}, Guru: ${portions.SMA?.guru || 0})`;
      }
      if (schName === "SMK Assa'adah") {
        return `(Siswa: ${portions.SMK?.siswa || 0}, Guru: ${portions.SMK?.guru || 0})`;
      }
      if (schName === "Desa Sukowati") {
        return `(Porsi Besar: ${portions.Sukowati?.besar || 0}, Porsi Kecil: ${portions.Sukowati?.kecil || 0})`;
      }
      if (schName === "Desa Sidokumpul") {
        return `(Porsi Besar: ${portions.Sidokumpul?.besar || 0}, Porsi Kecil: ${portions.Sidokumpul?.kecil || 0})`;
      }
      return '';
    };

    const parts = selectedDate.split('-');
    const year = parts[0] || '2026';
    const month = parts[1] || '07';
    const day = parts[2] || '15';

    const newDocs = schools.map((sch, idx) => {
      const abbrev = generateAbbrev(sch);
      const sjNoStr = `${day}/${abbrev}/SJ/MBGQOM/${month}/${year}`;
      const isDesa = sch.toLowerCase().includes('desa');
      const docQty = getPortionCount(sch);
      const breakdownStr = getPortionBreakdown(sch);
      
      let sjRows = [];
      if (sch === "MA Assa'adah") {
        const g = portions.MA?.guru || 0;
        const s = portions.MA?.siswa || 0;
        const tot = g + s;
        sjRows = [
          { id: '1', jenis: 'Porsi Guru', porsi: g, alatSebelum: g, alatSesudah: g, keterangan: 'Hangat & Lengkap' },
          { id: '2', jenis: 'Porsi Siswa', porsi: s, alatSebelum: s, alatSesudah: s, keterangan: 'Hangat & Lengkap' },
          { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: tot, alatSebelum: 0, alatSesudah: 0, keterangan: 'Karton Utuh' }
        ];
      } else if (sch === "MTS Assa'adah II") {
        const g = portions["MTS II"]?.guru || 0;
        const s = portions["MTS II"]?.siswa || 0;
        const tot = g + s;
        sjRows = [
          { id: '1', jenis: 'Porsi Guru', porsi: g, alatSebelum: g, alatSesudah: g, keterangan: 'Hangat & Lengkap' },
          { id: '2', jenis: 'Porsi Siswa', porsi: s, alatSebelum: s, alatSesudah: s, keterangan: 'Hangat & Lengkap' },
          { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: tot, alatSebelum: 0, alatSesudah: 0, keterangan: 'Karton Utuh' }
        ];
      } else if (sch === "SMA Assa'adah") {
        const g = portions.SMA?.guru || 0;
        const s = portions.SMA?.siswa || 0;
        const tot = g + s;
        sjRows = [
          { id: '1', jenis: 'Porsi Guru', porsi: g, alatSebelum: g, alatSesudah: g, keterangan: 'Hangat & Lengkap' },
          { id: '2', jenis: 'Porsi Siswa', porsi: s, alatSebelum: s, alatSesudah: s, keterangan: 'Hangat & Lengkap' },
          { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: tot, alatSebelum: 0, alatSesudah: 0, keterangan: 'Karton Utuh' }
        ];
      } else if (sch === "SMK Assa'adah") {
        const g = portions.SMK?.guru || 0;
        const s = portions.SMK?.siswa || 0;
        const tot = g + s;
        sjRows = [
          { id: '1', jenis: 'Porsi Guru', porsi: g, alatSebelum: g, alatSesudah: g, keterangan: 'Hangat & Lengkap' },
          { id: '2', jenis: 'Porsi Siswa', porsi: s, alatSebelum: s, alatSesudah: s, keterangan: 'Hangat & Lengkap' },
          { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: tot, alatSebelum: 0, alatSesudah: 0, keterangan: 'Karton Utuh' }
        ];
      } else if (sch === "Desa Sukowati") {
        const b = portions.Sukowati?.besar || 0;
        const k = portions.Sukowati?.kecil || 0;
        const tot = b + k;
        sjRows = [
          { id: '1', jenis: 'Porsi Kecil', porsi: k, alatSebelum: k, alatSesudah: k, keterangan: 'Hangat & Lengkap' },
          { id: '2', jenis: 'Porsi Besar', porsi: b, alatSebelum: b, alatSesudah: b, keterangan: 'Hangat & Lengkap' },
          { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: tot, alatSebelum: 0, alatSesudah: 0, keterangan: 'Karton Utuh' }
        ];
      } else if (sch === "Desa Sidokumpul") {
        const b = portions.Sidokumpul?.besar || 0;
        const k = portions.Sidokumpul?.kecil || 0;
        const tot = b + k;
        sjRows = [
          { id: '1', jenis: 'Porsi Kecil', porsi: k, alatSebelum: k, alatSesudah: k, keterangan: 'Hangat & Lengkap' },
          { id: '2', jenis: 'Porsi Besar', porsi: b, alatSebelum: b, alatSesudah: b, keterangan: 'Hangat & Lengkap' },
          { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: tot, alatSebelum: 0, alatSesudah: 0, keterangan: 'Karton Utuh' }
        ];
      } else {
        sjRows = [
          { id: '1', jenis: 'Porsi Guru', porsi: 15, alatSebelum: 15, alatSesudah: 15, keterangan: 'Hangat & Lengkap' },
          { id: '2', jenis: 'Porsi Siswa', porsi: 120, alatSebelum: 120, alatSesudah: 120, keterangan: 'Hangat & Lengkap' },
          { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: 135, alatSebelum: 0, alatSesudah: 0, keterangan: 'Karton Utuh' }
        ];
      }
      
      return {
        id: `sj-${selectedDate}-${idx}-${Date.now()}`,
        type: 'surat_jalan',
        date: selectedDate,
        vehicleNumber: 'W 8006 EG',
        imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
        comments: `Dokumen surat jalan pengiriman logistik untuk ${sch} ${breakdownStr}.`,
        uploadedBy: loggedInUser?.email || 'driver@sppg.com',
        uploadedAt: new Date().toISOString(),
        receiverName: getRecipientName(sch),
        status: 'Aktif',
        sjNo: sjNoStr,
        sjKepada: sch,
        sjWaktu: getDefaultReceiptTime(sch),
        sjDriver: loggedInUser?.role === UserRole.DRIVER ? loggedInUser.fullName : DRIVERS_LIST[0],
        sjRows,
        sjSignatureAslap: '',
        sjSignatureReceiver: ''
      };
    });

    setShippingDocs(prev => [...newDocs, ...prev]);
    setSuccessMsg('Berhasil menginisialisasi 6 Berkas Surat Jalan harian dengan data porsi riil!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Update a single field on the active document
  const handleFieldChange = (field: string, value: any) => {
    if (!activeDoc) return;
    const updated = { ...activeDoc, [field]: value };
    setActiveDoc(updated);
    
    // Save to parent list
    setShippingDocs(prev => prev.map(d => d.id === activeDoc.id ? updated : d));
  };

  // Update rows on Surat Jalan table
  const handleRowChange = (rowId: string, cell: string, value: any) => {
    if (!activeDoc) return;
    const updatedRows = (activeDoc.sjRows || []).map((row: any) => {
      if (row.id === rowId) {
        return { ...row, [cell]: value };
      }
      return row;
    });
    handleFieldChange('sjRows', updatedRows);
  };

  // Add custom row to Surat Jalan table
  const handleAddRow = () => {
    if (!activeDoc) return;
    const newRow = {
      id: `row-${Date.now()}`,
      jenis: 'Menu Tambahan / Alat Kirim',
      porsi: 0,
      alatSebelum: 0,
      alatSesudah: 0,
      keterangan: 'Kondisi Baik'
    };
    handleFieldChange('sjRows', [...(activeDoc.sjRows || []), newRow]);
  };

  // Delete a row from Surat Jalan table
  const handleDeleteRow = (rowId: string) => {
    if (!activeDoc) return;
    const updatedRows = (activeDoc.sjRows || []).filter((row: any) => row.id !== rowId);
    handleFieldChange('sjRows', updatedRows);
  };

  // Finalize / Lock Surat Jalan document
  const handleFinalize = () => {
    if (!activeDoc) return;
    if (!activeDoc.sjSignatureAslap || !activeDoc.sjSignatureReceiver) {
      setErrorMsg('Gagal mengunci! Tanda tangan Penanggung Jawab Dapur (Aslap) dan Penerima wajib dilengkapi terlebih dahulu.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if (confirm('Apakah Anda yakin ingin mengunci Surat Jalan ini secara permanen? Setelah dikunci, data tidak dapat diubah lagi.')) {
      const updated = { ...activeDoc, status: 'Selesai' };
      setActiveDoc(updated);
      setShippingDocs(prev => prev.map(d => d.id === activeDoc.id ? updated : d));
      setSuccessMsg('Berkas Surat Jalan berhasil ditandatangani, disahkan, dan direkap permanen!');
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // Delete a single Surat Jalan doc
  const handleDeleteDoc = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Apakah Anda yakin ingin menghapus lembar Surat Jalan ini?')) {
      setShippingDocs(prev => prev.filter(d => d.id !== docId));
      setSuccessMsg('Berkas Surat Jalan berhasil dihapus.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const dateText = getIndonesianDateText(selectedDate);

  // Compute grand totals
  const totalPorsi = activeDoc?.sjRows?.reduce((acc: number, r: any) => acc + (parseInt(r.porsi) || 0), 0) || 0;
  const totalAlatSebelum = activeDoc?.sjRows?.reduce((acc: number, r: any) => acc + (parseInt(r.alatSebelum) || 0), 0) || 0;
  const totalAlatSesudah = activeDoc?.sjRows?.reduce((acc: number, r: any) => acc + (parseInt(r.alatSesudah) || 0), 0) || 0;

  // If viewing a document in full-depth
  if (activeDoc) {
    const isLocked = activeDoc.status === 'Selesai';
    const isFieldReadOnly = isLocked || currentUserRole === UserRole.PENERIMA;
    return (
      <div className="space-y-6 animate-fade-in" id="sj-printed-view">
        {/* Sticky Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-200 shadow-3xs print:hidden">
          {!restrictedLocation && (
            <button
              onClick={() => setActiveDoc(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors bg-white px-3 py-2 rounded-xl border border-neutral-200 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Board
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 px-3.5 py-2 rounded-xl border border-neutral-200 cursor-pointer shadow-3xs"
            >
              <Printer className="h-4 w-4" />
              Cetak / Simpan PDF
            </button>

            {!isLocked && (
              <button
                onClick={handleFinalize}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-950 px-4 py-2 rounded-xl cursor-pointer shadow-sm transition-transform active:scale-[0.98]"
              >
                <Check className="h-4 w-4" />
                Kunci & Rekap Surat Jalan
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse print:hidden">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 print:hidden">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            {successMsg}
          </div>
        )}

        {/* Paper Facsimile Document */}
        <div className="bg-white p-8 md:p-12 rounded-3xl border border-neutral-300 shadow-md max-w-4xl mx-auto font-sans relative overflow-hidden print:border-0 print:shadow-none print:p-0">
          
          {/* Selesai / Terkunci Stamp Accent */}
          {isLocked && (
            <div className="absolute top-10 right-10 border-4 border-emerald-600 text-emerald-600 rounded-xl px-4 py-1.5 font-mono text-xs font-black tracking-widest uppercase rotate-12 select-none z-10 opacity-80 print:top-6 print:right-6">
              ✓ REKAP PERMANEN & SAH
            </div>
          )}

          {/* Document Header */}
          <div className="flex items-center justify-between gap-4 border-b-4 border-double border-neutral-900 pb-4">
            <img 
              src="https://www.bgn.go.id/logo-bgn.png" 
              alt="Logo BGN" 
              className="h-16 w-16 md:h-20 md:w-20 object-contain select-none shrink-0" 
              referrerPolicy="no-referrer"
            />
            <div className="text-center flex-1 space-y-1">
              <h3 className="font-extrabold text-neutral-950 text-xs md:text-sm tracking-wide uppercase">
                YAYASAN PONDOK PESANTREN QOMARUDDIN
              </h3>
              <h2 className="font-black text-neutral-900 text-lg md:text-xl tracking-wider uppercase font-display">
                UNIT DAPUR SPPG BUNGAH 2
              </h2>
              <p className="text-[9px] md:text-[10px] text-neutral-500 italic leading-tight">
                Jl. Raya Bungah No.12, Bungah, Gresik, Jawa Timur — Telp: (031) 3949012
              </p>
            </div>
            <img 
              src="https://qomaruddin.com/wp-content/uploads/2019/02/cropped-logo-qomaruddin-1-192x192.png" 
              alt="Logo PP Qomaruddin" 
              className="h-16 w-16 md:h-20 md:w-20 object-contain select-none shrink-0 border border-neutral-100 p-0.5 rounded-full" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                // In case of any loading failure, fall back to a high quality alternative
                e.currentTarget.src = "https://www.bgn.go.id/logo-bgn.png";
              }}
            />
          </div>

          <div className="text-center my-6 space-y-1">
            <h1 className="font-black text-lg text-neutral-950 tracking-wider underline">
              SURAT JALAN LOGISTIK
            </h1>
            <div className="flex justify-center items-center gap-1.5 text-xs font-semibold">
              <span className="text-neutral-500 uppercase text-[9px] tracking-wider">No. Dokumen:</span>
              {isFieldReadOnly ? (
                <span className="font-mono font-bold text-neutral-850">{activeDoc.sjNo}</span>
              ) : (
                <input
                  type="text"
                  value={activeDoc.sjNo || ''}
                  onChange={(e) => handleFieldChange('sjNo', e.target.value)}
                  className="font-mono font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden px-1 w-64 text-center text-xs"
                  placeholder="Isi No Surat Jalan..."
                />
              )}
            </div>
          </div>

          {/* Form Fields Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 border-y border-neutral-300 py-6 mb-6">
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-450 uppercase w-32 shrink-0">Kepada Yth. (Sekolah/Desa):</span>
                {isFieldReadOnly ? (
                  <span className="text-xs font-extrabold text-neutral-850">{activeDoc.sjKepada}</span>
                ) : (
                  <select
                    value={activeDoc.sjKepada || ''}
                    onChange={(e) => {
                      const newTarget = e.target.value;
                      if (!activeDoc) return;
                      const updated = {
                        ...activeDoc,
                        sjKepada: newTarget,
                        sjWaktu: getDefaultReceiptTime(newTarget),
                        receiverName: getRecipientName(newTarget)
                      };
                      setActiveDoc(updated);
                      setShippingDocs(prev => prev.map(d => d.id === activeDoc.id ? updated : d));
                    }}
                    className="text-xs font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full"
                  >
                    <option value="MA Assa'adah">MA Assa'adah</option>
                    <option value="MTS Assa'adah II">MTS Assa'adah II</option>
                    <option value="SMA Assa'adah">SMA Assa'adah</option>
                    <option value="SMK Assa'adah">SMK Assa'adah</option>
                    <option value="Desa Sidokumpul">Desa Sidokumpul</option>
                    <option value="Desa Sukowati">Desa Sukowati</option>
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-450 uppercase w-32 shrink-0">Waktu Kirim:</span>
                {isFieldReadOnly ? (
                  <span className="text-xs font-extrabold text-neutral-850">{activeDoc.sjWaktu}</span>
                ) : (
                  <input
                    type="text"
                    value={activeDoc.sjWaktu || ''}
                    onChange={(e) => handleFieldChange('sjWaktu', e.target.value)}
                    className="text-xs font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full px-1"
                  />
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-450 uppercase w-32 shrink-0">Pengemudi (Driver):</span>
                {isFieldReadOnly ? (
                  <span className="text-xs font-bold text-neutral-800">{activeDoc.sjDriver}</span>
                ) : (
                  <select
                    value={activeDoc.sjDriver || ''}
                    onChange={(e) => handleFieldChange('sjDriver', e.target.value)}
                    className="text-xs font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full px-1 bg-transparent"
                  >
                    <option value="">Pilih Driver...</option>
                    {DRIVERS_LIST.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-450 uppercase w-32 shrink-0">No Kendaraan:</span>
                {isFieldReadOnly ? (
                  <span className="text-xs font-mono font-bold text-neutral-850">{activeDoc.vehicleNumber}</span>
                ) : (
                  <input
                    type="text"
                    value={activeDoc.vehicleNumber || ''}
                    onChange={(e) => handleFieldChange('vehicleNumber', e.target.value.toUpperCase())}
                    className="text-xs font-mono font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full px-1 uppercase"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Interactive Goods Table */}
          <div className="space-y-2 mb-6">
            <span className="text-[10px] font-bold text-neutral-400 uppercase block">Rincian Muatan Barang Kiriman:</span>
            <div className="border border-neutral-950 overflow-hidden rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-950 text-[10px] font-bold text-center">
                    <th className="p-2.5 border-r border-neutral-950 w-10 text-center">No</th>
                    <th className="p-2.5 border-r border-neutral-950 text-left">Jenis Barang / Logistik</th>
                    <th className="p-2.5 border-r border-neutral-950 w-24">Jumlah Porsi</th>
                    <th className="p-2.5 border-r border-neutral-950 w-20">Alat (Bfr)</th>
                    <th className="p-2.5 border-r border-neutral-950 w-20">Alat (Aft)</th>
                    <th className="p-2.5 border-r border-neutral-950">Keterangan</th>
                    {!isFieldReadOnly && <th className="p-2.5 w-12 text-center print:hidden">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-950 text-center text-neutral-850">
                  {(activeDoc.sjRows || []).map((row: any, idx: number) => (
                    <tr key={row.id}>
                      <td className="p-2 border-r border-neutral-950 font-mono text-neutral-400 text-center">{idx + 1}</td>
                      <td className="p-1 border-r border-neutral-950 text-left font-medium">
                        {isFieldReadOnly ? (
                          <span className="px-1.5">{row.jenis}</span>
                        ) : (
                          <input
                            type="text"
                            value={row.jenis}
                            onChange={(e) => handleRowChange(row.id, 'jenis', e.target.value)}
                            className="w-full border-0 focus:ring-1 focus:ring-emerald-700 rounded px-1.5 py-1 text-xs"
                          />
                        )}
                      </td>
                      <td className="p-1 border-r border-neutral-950 font-semibold text-neutral-800">
                        {isFieldReadOnly ? (
                          <span>{row.porsi}</span>
                        ) : (
                          <input
                            type="number"
                            value={row.porsi}
                            onChange={(e) => handleRowChange(row.id, 'porsi', parseInt(e.target.value) || 0)}
                            className="w-full border-0 focus:ring-1 focus:ring-emerald-700 text-center rounded py-1 text-xs font-semibold"
                          />
                        )}
                      </td>
                      <td className="p-1 border-r border-neutral-950">
                        {isFieldReadOnly ? (
                          <span>{row.alatSebelum}</span>
                        ) : (
                          <input
                            type="number"
                            value={row.alatSebelum}
                            onChange={(e) => handleRowChange(row.id, 'alatSebelum', parseInt(e.target.value) || 0)}
                            className="w-full border-0 focus:ring-1 focus:ring-emerald-700 text-center rounded py-1 text-xs"
                          />
                        )}
                      </td>
                      <td className="p-1 border-r border-neutral-950">
                        {isFieldReadOnly ? (
                          <span>{row.alatSesudah}</span>
                        ) : (
                          <input
                            type="number"
                            value={row.alatSesudah}
                            onChange={(e) => handleRowChange(row.id, 'alatSesudah', parseInt(e.target.value) || 0)}
                            className="w-full border-0 focus:ring-1 focus:ring-emerald-700 text-center rounded py-1 text-xs"
                          />
                        )}
                      </td>
                      <td className="p-1 border-r border-neutral-950 text-left">
                        {isFieldReadOnly ? (
                          <span className="px-1.5">{row.keterangan}</span>
                        ) : (
                          <input
                            type="text"
                            value={row.keterangan}
                            onChange={(e) => handleRowChange(row.id, 'keterangan', e.target.value)}
                            className="w-full border-0 focus:ring-1 focus:ring-emerald-700 rounded px-1.5 py-1 text-xs"
                          />
                        )}
                      </td>
                      {!isFieldReadOnly && (
                        <td className="p-1 text-center print:hidden">
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            className="text-neutral-400 hover:text-red-600 p-1 rounded-sm cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  
                  {/* Grand Totals Row */}
                  <tr className="bg-neutral-50/50 font-black border-t-2 border-neutral-950 text-neutral-950">
                    <td className="p-2.5 border-r border-neutral-950 text-center" colSpan={2}>GRAND TOTAL</td>
                    <td className="p-2.5 border-r border-neutral-950 font-mono">{totalPorsi} Box</td>
                    <td className="p-2.5 border-r border-neutral-950 font-mono">{totalAlatSebelum} Koli</td>
                    <td className="p-2.5 border-r border-neutral-950 font-mono">{totalAlatSesudah} Koli</td>
                    <td className="p-2.5 text-left italic font-normal text-neutral-500" colSpan={isFieldReadOnly ? 1 : 2}>
                      Beban alat terpenuhi otomatis.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {!isFieldReadOnly && (
              <button
                onClick={handleAddRow}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 self-start mt-1 print:hidden"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Baris Barang Baru
              </button>
            )}
          </div>

          <div className="space-y-2 mb-8">
            <span className="text-[10px] font-bold text-neutral-400 uppercase block">Catatan Driver / Aslap:</span>
            {isLocked ? (
              <p className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-xs text-neutral-700 italic font-mono leading-relaxed">
                "{activeDoc.comments}"
              </p>
            ) : (
              <textarea
                value={activeDoc.comments || ''}
                onChange={(e) => handleFieldChange('comments', e.target.value)}
                rows={3}
                className="w-full text-xs font-mono text-neutral-700 p-3 bg-neutral-50 hover:bg-neutral-100 focus:bg-white rounded-xl border border-neutral-200 focus:border-emerald-600 focus:outline-hidden resize-none"
                placeholder="Tulis catatan operasional logistik lainnya..."
              />
            )}
          </div>

          {/* Signatures Section */}
          <div className="grid grid-cols-2 gap-8 text-center text-xs mt-8 pt-6 border-t border-neutral-200">
            {/* Penganggung Jawab Dapur (Aslap) */}
            <div className="space-y-4 flex flex-col items-center">
              <span className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider block">
                PENGANGGUNG JAWAB DAPUR<br /><span className="text-[8px] text-neutral-400">(Asisten Lapangan)</span>
              </span>

              <div className="w-48 h-24 border border-dashed border-neutral-300 rounded-xl bg-neutral-50/50 flex flex-col items-center justify-center relative overflow-hidden group">
                {activeDoc.sjSignatureAslap ? (
                  <>
                    <img
                      src={activeDoc.sjSignatureAslap}
                      alt="Ttd Aslap"
                      className="max-h-full max-w-full object-contain"
                    />
                    {!isLocked && isAdminOrAslap && (
                      <button
                        onClick={() => handleFieldChange('sjSignatureAslap', '')}
                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer print:hidden"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </>
                ) : (
                  isAdminOrAslap ? (
                    <button
                      onClick={() => setActiveSigRequest({
                        targetField: 'sjSignatureAslap',
                        title: 'Tanda Tangan Penanggung Jawab Dapur (Aslap)',
                        suggestedName: loggedInUser?.fullName || 'Ahmad Maghfur'
                      })}
                      className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 flex flex-col items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
                    >
                      <UserCheck className="h-4 w-4" />
                      Klik Bubuhkan Ttd
                    </button>
                  ) : (
                    <span className="text-[10px] text-neutral-400 italic font-medium">Belum ditandatangani</span>
                  )
                )}
              </div>

              <div className="border-b border-neutral-900 w-44 font-bold text-neutral-900 uppercase">
                {activeDoc.sjSignatureAslap ? 'Ahmad Maghfur' : 'Ahmad Maghfur (Aslap)'}
              </div>
            </div>

            {/* Penerima Sekolah */}
            <div className="space-y-4 flex flex-col items-center">
              <span className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider block">
                PENERIMA SEKOLAH / ASRAMA<br /><span className="text-[8px] text-neutral-400">(Seksi Humas/Logistik)</span>
              </span>

              <div className="w-48 h-24 border border-dashed border-neutral-300 rounded-xl bg-neutral-50/50 flex flex-col items-center justify-center relative overflow-hidden group">
                {activeDoc.sjSignatureReceiver ? (
                  <>
                    <img
                      src={activeDoc.sjSignatureReceiver}
                      alt="Ttd Receiver"
                      className="max-h-full max-w-full object-contain"
                    />
                    {!isLocked && (currentUserRole === UserRole.PENERIMA || currentUserRole === UserRole.ADMIN || isAdminOrAslap) && (
                      <button
                        onClick={() => handleFieldChange('sjSignatureReceiver', '')}
                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer print:hidden"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </>
                ) : (
                  (currentUserRole === UserRole.PENERIMA || currentUserRole === UserRole.ADMIN || isAdminOrAslap) ? (
                    <button
                      onClick={() => setActiveSigRequest({
                        targetField: 'sjSignatureReceiver',
                        title: `Tanda Tangan Penerima (${getRecipientName(activeDoc.sjKepada)})`,
                        suggestedName: activeDoc.receiverName || getRecipientName(activeDoc.sjKepada)
                      })}
                      className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 flex flex-col items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
                    >
                      <UserCheck className="h-4 w-4" />
                      Klik Bubuhkan Ttd
                    </button>
                  ) : (
                    <span className="text-[10px] text-neutral-400 italic font-medium">Belum ditandatangani</span>
                  )
                )}
              </div>

              <div className="border-b border-neutral-900 w-44 font-bold text-neutral-900 uppercase">
                {activeDoc.receiverName || getRecipientName(activeDoc.sjKepada)} ({activeDoc.sjKepada})
              </div>
            </div>
          </div>

        </div>

        {/* Signature Drawer Pad overlay */}
        {activeSigRequest && (
          <SignaturePad
            title={activeSigRequest.title}
            suggestedName={activeSigRequest.suggestedName}
            onSave={(signatureDataUrl) => {
              handleFieldChange(activeSigRequest.targetField, signatureDataUrl);
              setActiveSigRequest(null);
            }}
            onCancel={() => setActiveSigRequest(null)}
          />
        )}
      </div>
    );
  }

  // Dashboard / List View
  const totalSJ = filteredDocs.length;
  const completedSJ = filteredDocs.filter(d => d.status === 'Selesai').length;
  const activeSJ = filteredDocs.filter(d => d.status === 'Aktif').length;
  
  let totalSigsNeeded = totalSJ * 2;
  let filledSigs = 0;
  filteredDocs.forEach(d => {
    if (d.sjSignatureAslap) filledSigs++;
    if (d.sjSignatureReceiver) filledSigs++;
  });
  const complianceScore = totalSigsNeeded > 0 ? Math.round((filledSigs / totalSigsNeeded) * 100) : 100;

  return (
    <div className="space-y-6 animate-fade-in" id="sj-dashboard">
      
      {/* 1. Header & Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold font-sans text-neutral-900 flex items-center gap-2 tracking-tight">
              <Truck className="h-6 w-6 text-emerald-800 shrink-0" />
              Arsip &amp; Rekapitulasi Surat Jalan Logistik
            </h2>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
              SOP-Aligned
            </span>
          </div>
          <p className="text-xs text-neutral-500">Lembar legalisasi perjalanan logistik dwi-harian, mencakup porsi koli boks hidangan, berat muatan, dan otorisasi tanda tangan.</p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* 2. Admin Analytics Scorecard (Only visible for Admins / Aslaps) */}
      {isAdminOrAslap && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-3xs flex flex-col justify-between">
            <span className="text-neutral-400 font-bold text-[10px] block uppercase tracking-wider">Total Surat Jalan</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-neutral-800">{totalSJ}</span>
              <span className="text-[10px] text-neutral-400 font-mono">Berkas</span>
            </div>
          </div>
          
          <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 flex flex-col justify-between">
            <span className="text-emerald-850 font-extrabold text-[10px] block uppercase tracking-wider">Terkunci &amp; Sah</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-800">{completedSJ}</span>
              <span className="text-[10px] text-emerald-500 font-mono font-bold">Lengkap</span>
            </div>
          </div>

          <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 flex flex-col justify-between">
            <span className="text-amber-850 font-extrabold text-[10px] block uppercase tracking-wider">Sedang Berjalan</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-amber-700">{activeSJ}</span>
              <span className="text-[10px] text-amber-500 font-mono font-bold">Aktif</span>
            </div>
          </div>

          <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 flex flex-col justify-between">
            <span className="text-indigo-850 font-extrabold text-[10px] block uppercase tracking-wider">Otorisasi Tanda Tangan</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-indigo-800">{complianceScore}%</span>
              <span className="text-[10px] text-indigo-500 font-mono font-bold">Ttd Sah</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Advanced Filtering Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-3xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-3">
          <h3 className="font-bold text-neutral-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-emerald-800" />
            Panel Filter Rekapitulasi &amp; Kontrol Surat Jalan
          </h3>

          {/* Toggle View Mode Buttons (only for admin/aslap) */}
          {isAdminOrAslap && (
            <div className="flex bg-neutral-100 rounded-lg p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${viewMode === 'table' ? 'bg-white text-emerald-900 shadow-2xs' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                Tampilan Tabel
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white text-emerald-900 shadow-2xs' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                Tampilan Kartu
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search bar input */}
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-neutral-400 text-xs">🔍</span>
            <input 
              type="text" 
              placeholder="Cari No SJ, Driver, Tujuan..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-neutral-200 rounded-xl text-xs bg-neutral-50/50 outline-hidden focus:bg-white focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          {/* School filter */}
          <select
            value={filterSchool}
            onChange={e => setFilterSchool(e.target.value)}
            disabled={!!restrictedLocation}
            className="border border-neutral-200 bg-neutral-50/50 rounded-xl px-3 py-1.5 text-xs outline-hidden focus:bg-white focus:ring-1 focus:ring-emerald-700 disabled:opacity-65"
          >
            <option value="all">Semua Lembaga / Desa (6 Lokasi)</option>
            <option value="MA Assa'adah">MA Assa'adah</option>
            <option value="MTS Assa'adah II">MTS Assa'adah II</option>
            <option value="SMA Assa'adah">SMA Assa'adah</option>
            <option value="SMK Assa'adah">SMK Assa'adah</option>
            <option value="Desa Sidokumpul">Desa Sidokumpul</option>
            <option value="Desa Sukowati">Desa Sukowati</option>
          </select>

          {/* Status selection */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-neutral-200 bg-neutral-50/50 rounded-xl px-3 py-1.5 text-xs outline-hidden focus:bg-white focus:ring-1 focus:ring-emerald-700"
          >
            <option value="all">Semua Status Berkas</option>
            <option value="Aktif">Sedang Berjalan (Aktif)</option>
            <option value="Selesai">Terkunci &amp; Sah (Selesai)</option>
          </select>

          {/* Date range constraint filter */}
          {isAdminOrAslap ? (
            <select
              value={filterDate}
              onChange={e => setFilterDate(e.target.value as any)}
              className="border border-neutral-200 bg-neutral-50/50 rounded-xl px-3 py-1.5 text-xs outline-hidden focus:bg-white focus:ring-1 focus:ring-emerald-700"
            >
              <option value="selected">Tanggal Terpilih ({selectedDate})</option>
              <option value="all">Semua Tanggal (Arsip Historis)</option>
            </select>
          ) : (
            <div className="bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-1.5 text-xs text-neutral-500 font-mono font-bold flex items-center justify-center">
              📅 Hari Ini: {selectedDate}
            </div>
          )}
        </div>
      </div>

      {/* 4. Release check or Records display */}
      {dateDocs.length === 0 && filterDate === 'selected' ? (
        <div className="p-16 border border-neutral-200 rounded-3xl bg-white text-center space-y-4 max-w-2xl mx-auto shadow-2xs">
          <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto animate-bounce" />
          <div className="space-y-1.5">
            <h4 className="text-neutral-700 font-bold text-sm">Surat Jalan Belum Dirilis</h4>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Berkas digital Surat Jalan pengiriman logistik untuk 6 lokasi sasaran belum diinisialisasi untuk tanggal {selectedDate}.
            </p>
          </div>
          {isAkunUtama && (
            <button
              onClick={handleInitializeSuratJalan}
              className="bg-emerald-800 hover:bg-emerald-950 text-white text-xs font-bold px-6 py-3 rounded-xl text-center inline-flex items-center gap-2 cursor-pointer shadow-sm active:scale-[0.98] transition-transform"
            >
              <Plus className="h-4 w-4" />
              Inisialisasi 6 Berkas Surat Jalan Sekarang
            </button>
          )}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-16 text-center text-xs text-neutral-400 space-y-2 bg-white rounded-3xl border border-neutral-100 shadow-2xs">
          <ShieldAlert className="h-10 w-10 text-neutral-300 mx-auto" />
          <p className="font-bold text-neutral-600 text-sm">Tidak Ada Arsip Surat Jalan yang Cocok</p>
          <p className="max-w-xs mx-auto text-neutral-400">Silakan sesuaikan filter pencarian atau hubungi Aslap dapur untuk menerbitkan.</p>
        </div>
      ) : isAdminOrAslap && viewMode === 'table' ? (
        /* --- HIGH-DENSITY ANALYTICAL TABLE VIEW --- */
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-3xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-5">Hari, Tanggal</th>
                  <th className="py-4 px-5">Nomor Surat Jalan</th>
                  <th className="py-4 px-5">Tujuan Pengiriman</th>
                  <th className="py-4 px-5">Driver</th>
                  <th className="py-4 px-5">Waktu Kirim</th>
                  <th className="py-4 px-5 text-center">Ttd Aslap</th>
                  <th className="py-4 px-5 text-center">Ttd Penerima</th>
                  <th className="py-4 px-5 text-center">Status</th>
                  <th className="py-4 px-5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {filteredDocs.map((doc) => {
                  const hasAslapSig = !!doc.sjSignatureAslap;
                  const hasReceiverSig = !!doc.sjSignatureReceiver;
                  const isDone = doc.status === 'Selesai';
                  const parts = doc.date.split('-');
                  const dateTextLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : doc.date;
                  
                  return (
                    <tr key={doc.id} className="hover:bg-neutral-50/30 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-neutral-900 font-mono">
                        {dateTextLabel}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-neutral-500 text-[11px] font-semibold">
                        {doc.sjNo}
                      </td>
                      <td className="py-3.5 px-5 font-extrabold text-neutral-800">
                        {doc.sjKepada}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-neutral-700">
                        {doc.sjDriver}
                      </td>
                      <td className="py-3.5 px-5 font-mono">
                        {doc.sjWaktu}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {hasAslapSig ? (
                          <span className="text-[9px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-bold font-mono">SIGNED ✓</span>
                        ) : (
                          <span className="text-[9px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full font-bold font-mono">PENDING ✗</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {hasReceiverSig ? (
                          <span className="text-[9px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-bold font-mono">SIGNED ✓</span>
                        ) : (
                          <span className="text-[9px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full font-bold font-mono">PENDING ✗</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold border ${
                          isDone
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {isDone ? 'TERKUNCI' : 'AKTIF'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isDone && (
                            <button
                              onClick={(e) => handleDeleteDoc(doc.id, e)}
                              className="text-neutral-400 hover:text-red-600 p-1 rounded transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setActiveDoc(doc)}
                            className="text-white bg-emerald-800 hover:bg-emerald-950 font-semibold px-3 py-1 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer shadow-3xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Buka
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* --- HIGH-QUALITY GRID CARDS VIEW --- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDocs.map((doc) => {
            const hasAslapSig = !!doc.sjSignatureAslap;
            const hasReceiverSig = !!doc.sjSignatureReceiver;
            const isDone = doc.status === 'Selesai';
            
            return (
              <div
                key={doc.id}
                onClick={() => setActiveDoc(doc)}
                className="bg-white hover:border-emerald-600 border border-neutral-200/80 rounded-2xl p-5 shadow-3xs cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group flex flex-col justify-between min-h-[185px]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] text-neutral-400 font-mono block uppercase tracking-wider">TUJUAN PENGIRIMAN</span>
                      <h4 className="font-bold text-sm text-neutral-850 group-hover:text-emerald-800 transition-colors">
                        {doc.sjKepada}
                      </h4>
                    </div>
                    
                    <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold border ${
                      isDone
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {isDone ? 'TERKUNCI' : 'AKTIF'}
                    </span>
                  </div>

                  <p className="text-[10px] font-mono text-neutral-500 mt-2 block overflow-hidden text-ellipsis whitespace-nowrap">
                    No: {doc.sjNo}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Muatan: <strong className="text-neutral-700">{(doc.sjRows || []).length} Item Logistik</strong> | Driver: {doc.sjDriver}
                  </p>
                  <span className="text-[9.5px] font-mono text-neutral-400 mt-0.5 block">
                    Tanggal: {doc.date}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[10px] text-neutral-500">
                    <span>Tanda Tangan:</span>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={hasAslapSig ? 'text-emerald-700' : 'text-neutral-400'}>Aslap {hasAslapSig ? '✓' : '✗'}</span>
                      <span>•</span>
                      <span className={hasReceiverSig ? 'text-emerald-700' : 'text-neutral-400'}>Penerima {hasReceiverSig ? '✓' : '✗'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    {!isDone && (
                      <button
                        onClick={(e) => handleDeleteDoc(doc.id, e)}
                        className="text-neutral-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                        title="Hapus berkas Surat Jalan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    
                    <span className="text-[9px] text-emerald-800 font-extrabold uppercase tracking-wider flex items-center gap-0.5 ml-auto">
                      {isDone ? 'Buka Berkas 📄' : 'Kelola & Isi ✍️'} 
                      <ChevronRight className="h-3 w-3 translate-x-0 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
