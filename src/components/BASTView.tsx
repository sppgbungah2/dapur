import React, { useState, useEffect } from 'react';
import { 
  FileText, Calendar, Plus, Trash2, CheckCircle2, ChevronRight, 
  ArrowLeft, Printer, ShieldAlert, Check, X, UserCheck,
  Search, Filter, Eye, BarChart3
} from 'lucide-react';
import { DayMenu, UserRole, DRIVERS_LIST } from '../types';
import { supabase, isSupabaseConfigured, UserProfile } from '../lib/supabase';
import { DEFAULT_PORTIONS, PortionConfig } from './PortionMasterView';
import { getRecipientName, getDefaultReceiptTime } from '../presetData';
import SignaturePad from './SignaturePad';

interface BASTViewProps {
  shippingDocs: any[];
  setShippingDocs: React.Dispatch<React.SetStateAction<any[]>>;
  selectedDate: string;
  loggedInUser?: UserProfile | null;
  currentUserRole: UserRole;
  allDayMenus?: DayMenu[];
}

export default function BASTView({
  shippingDocs,
  setShippingDocs,
  selectedDate,
  loggedInUser,
  currentUserRole,
  allDayMenus = []
}: BASTViewProps) {
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
    targetField: 'bastSignatureDriver' | 'bastSignatureReceiver';
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
  const dateDocs = shippingDocs.filter(d => d.type === 'serah_terima' && d.date === selectedDate);

  // Full dataset for filters & rekapitulasi
  const allBastDocs = shippingDocs.filter(d => d.type === 'serah_terima');

  // Filtered list based on role and choices
  const filteredDocs = allBastDocs.filter(doc => {
    // 1. Role boundaries
    if (restrictedLocation && doc.bastSekolah !== restrictedLocation) return false;
    
    // For non-admin (driver/penerima), we ONLY show current date
    if (!isAdminOrAslap && doc.date !== selectedDate) return false;

    // 2. Admin filters
    if (isAdminOrAslap) {
      const matchesDate = filterDate === 'all' || doc.date === selectedDate;
      const matchesSchool = filterSchool === 'all' || doc.bastSekolah === filterSchool;
      const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
      if (!matchesDate || !matchesSchool || !matchesStatus) return false;
    }

    // 3. Search text
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchesSearch = (
        (doc.bastSekolah && doc.bastSekolah.toLowerCase().includes(s)) ||
        (doc.bastNo && doc.bastNo.toLowerCase().includes(s)) ||
        (doc.bastDriver && doc.bastDriver.toLowerCase().includes(s)) ||
        (doc.bastPenerima && doc.bastPenerima.toLowerCase().includes(s)) ||
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
      const allSerahTerimaForDate = shippingDocs.filter(d => d.type === 'serah_terima' && d.date === selectedDate);
      if (allSerahTerimaForDate.length > 0 && !activeDoc) {
        const matched = allSerahTerimaForDate.find(d => d.bastSekolah === restrictedLocation);
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

  // Auto initialize BAST for 6 locations
  const handleInitializeBAST = async () => {
    const existing = shippingDocs.filter(d => d.type === 'serah_terima' && d.date === selectedDate);
    if (existing.length > 0) {
      setErrorMsg('Berkas BAST untuk tanggal ini sudah diinisialisasi dan tidak dapat dibuat lagi.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if (!isAkunUtama) {
      setErrorMsg('Hanya Akun Utama (Administrator) yang dapat menginisialisasi berkas BAST baru.');
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
          console.warn("Could not load portions from Supabase for BAST, trying local cache:", error);
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
      console.error("Error loading portion master data for BAST initialization:", err);
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
      const bastNoStr = `${day}/${abbrev}/BAST/MBGQOM/${month}/${year}`;
      const isDesa = sch.toLowerCase().includes('desa');
      const docQty = getPortionCount(sch);
      const breakdownStr = getPortionBreakdown(sch);
      const defaultPenerima = getRecipientName(sch);
      const defaultWaktu = getDefaultReceiptTime(sch);
      
      return {
        id: `bast-${selectedDate}-${idx}-${Date.now()}`,
        type: 'serah_terima',
        date: selectedDate,
        vehicleNumber: 'W 1234 BGH',
        imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=500&auto=format&fit=crop&q=80',
        comments: `Dokumen serah terima makanan bergizi untuk ${sch} ${breakdownStr}.`,
        uploadedBy: loggedInUser?.email || 'driver@sppg.com',
        uploadedAt: new Date().toISOString(),
        receiverName: defaultPenerima,
        status: 'Aktif',
        bastNo: bastNoStr,
        bastDriver: loggedInUser?.role === UserRole.DRIVER ? loggedInUser.fullName : DRIVERS_LIST[0],
        bastSekolah: sch,
        bastPenerima: defaultPenerima,
        bastBarang: 'PAKET PROGRAM MAKAN BERGIZI GRATIS',
        bastJumlah: docQty,
        bastWaktu: defaultWaktu,
        bastSignatureDriver: '',
        bastSignatureReceiver: ''
      };
    });

    setShippingDocs(prev => [...newDocs, ...prev]);
    setSuccessMsg('Berhasil menginisialisasi 6 Berkas BAST harian dengan data porsi riil!');
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

  // Finalize / Lock BAST document
  const handleFinalize = () => {
    if (!activeDoc) return;
    if (!activeDoc.bastSignatureDriver || !activeDoc.bastSignatureReceiver) {
      setErrorMsg('Gagal mengunci! Tanda tangan Pengemudi dan Penerima wajib dilengkapi terlebih dahulu.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if (confirm('Apakah Anda yakin ingin mengunci rekap BAST ini secara permanen? Setelah dikunci, data tidak dapat diubah lagi.')) {
      const updated = { ...activeDoc, status: 'Selesai' };
      setActiveDoc(updated);
      setShippingDocs(prev => prev.map(d => d.id === activeDoc.id ? updated : d));
      setSuccessMsg('Berkas BAST berhasil ditandatangani, disahkan, dan direkap permanen!');
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // Delete a single BAST doc
  const handleDeleteDoc = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Apakah Anda yakin ingin menghapus lembar BAST ini?')) {
      setShippingDocs(prev => prev.filter(d => d.id !== docId));
      setSuccessMsg('Berkas BAST berhasil dihapus.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const dateText = getIndonesianDateText(selectedDate);

  // If viewing a document in full-depth
  if (activeDoc) {
    const isLocked = activeDoc.status === 'Selesai';
    const isFieldReadOnly = isLocked || currentUserRole === UserRole.PENERIMA;
    return (
      <div className="space-y-6 animate-fade-in" id="bast-printed-view">
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
                Kunci & Rekap BAST
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
              ✓ TERVERIFIKASI & SAH
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
              BERITA ACARA SERAH TERIMA (BAST)
            </h1>
            <div className="flex justify-center items-center gap-1.5 text-xs font-semibold">
              <span className="text-neutral-500 uppercase text-[9px] tracking-wider">No. Dokumen:</span>
              {isFieldReadOnly ? (
                <span className="font-mono font-bold text-neutral-850">{activeDoc.bastNo}</span>
              ) : (
                <input
                  type="text"
                  value={activeDoc.bastNo || ''}
                  onChange={(e) => handleFieldChange('bastNo', e.target.value)}
                  className="font-mono font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden px-1 w-64 text-center text-xs"
                  placeholder="Isi No BAST..."
                />
              )}
            </div>
          </div>

          <p className="text-xs text-neutral-800 leading-relaxed font-sans mb-6">
            Pada hari ini <strong className="text-neutral-900">{dateText.dayName}</strong>, tanggal <strong className="text-neutral-900">{dateText.dateNum} {dateText.monthName} {dateText.yearNum}</strong>, kami yang bertandatangan di bawah ini menyatakan telah melaksanakan serah terima paket makanan bergizi harian dengan rincian sebagai berikut:
          </p>

          {/* Form Fields Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 border-y border-neutral-300 py-6 mb-6">
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-400 uppercase w-32 shrink-0">Pihak I (Pengirim/Driver):</span>
                {isFieldReadOnly ? (
                  <span className="text-xs font-extrabold text-neutral-850">{activeDoc.bastDriver}</span>
                ) : (
                  <select
                    value={activeDoc.bastDriver || ''}
                    onChange={(e) => handleFieldChange('bastDriver', e.target.value)}
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
                <span className="text-[10px] font-bold text-neutral-400 uppercase w-32 shrink-0">No Plat Kendaraan:</span>
                {isFieldReadOnly ? (
                  <span className="text-xs font-extrabold text-neutral-850">{activeDoc.vehicleNumber}</span>
                ) : (
                  <input
                    type="text"
                    value={activeDoc.vehicleNumber || ''}
                    onChange={(e) => handleFieldChange('vehicleNumber', e.target.value.toUpperCase())}
                    className="text-xs font-mono font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full px-1 uppercase"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-400 uppercase w-32 shrink-0">Lembaga/Desa Sasaran:</span>
                {isFieldReadOnly ? (
                  <span className="text-xs font-extrabold text-neutral-850">{activeDoc.bastSekolah}</span>
                ) : (
                  <select
                    value={activeDoc.bastSekolah || ''}
                    onChange={(e) => {
                      const newSch = e.target.value;
                      if (!activeDoc) return;
                      const updated = {
                        ...activeDoc,
                        bastSekolah: newSch,
                        bastPenerima: getRecipientName(newSch),
                        bastWaktu: getDefaultReceiptTime(newSch),
                        receiverName: getRecipientName(newSch)
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
                <span className="text-[10px] font-bold text-neutral-400 uppercase w-32 shrink-0">Penerima Pihak II:</span>
                {isLocked ? (
                  <span className="text-xs font-extrabold text-neutral-850">{activeDoc.bastPenerima}</span>
                ) : (
                  <input
                    type="text"
                    value={activeDoc.bastPenerima || ''}
                    onChange={(e) => handleFieldChange('bastPenerima', e.target.value)}
                    className="text-xs font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full px-1"
                  />
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-400 uppercase w-32 shrink-0">Nama Komoditas/Barang:</span>
                {isFieldReadOnly ? (
                  <span className="text-xs font-bold text-neutral-800">{activeDoc.bastBarang}</span>
                ) : (
                  <input
                    type="text"
                    value={activeDoc.bastBarang || ''}
                    onChange={(e) => handleFieldChange('bastBarang', e.target.value)}
                    className="text-xs font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full px-1"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-400 uppercase w-32 shrink-0">Kuantitas (Jumlah Box):</span>
                {isFieldReadOnly ? (
                  <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{activeDoc.bastJumlah} Box / Porsi</span>
                ) : (
                  <input
                    type="number"
                    value={activeDoc.bastJumlah || ''}
                    onChange={(e) => handleFieldChange('bastJumlah', parseInt(e.target.value) || 0)}
                    className="text-xs font-mono font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full px-1"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-400 uppercase w-32 shrink-0">Jam Penyerahan:</span>
                {isLocked ? (
                  <span className="text-xs font-bold text-neutral-800">{activeDoc.bastWaktu}</span>
                ) : (
                  <input
                    type="text"
                    value={activeDoc.bastWaktu || ''}
                    onChange={(e) => handleFieldChange('bastWaktu', e.target.value)}
                    className="text-xs font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full px-1"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-8">
            <span className="text-[10px] font-bold text-neutral-400 uppercase block">Keterangan / Catatan Serah Terima:</span>
            {isLocked ? (
              <p className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-xs text-neutral-700 italic font-mono leading-relaxed">
                "{activeDoc.comments || activeDoc.comments}"
              </p>
            ) : (
              <textarea
                value={activeDoc.comments || ''}
                onChange={(e) => handleFieldChange('comments', e.target.value)}
                rows={3}
                className="w-full text-xs font-mono text-neutral-700 p-3 bg-neutral-50 hover:bg-neutral-100 focus:bg-white rounded-xl border border-neutral-200 focus:border-emerald-600 focus:outline-hidden resize-none"
                placeholder="Tulis catatan penunjang seperti kondisi boks, suhu koli saat diserahkan..."
              />
            )}
          </div>

          {/* Signatures Section */}
          <div className="grid grid-cols-2 gap-8 text-center text-xs mt-8 pt-6 border-t border-neutral-200">
            {/* Pihak Pertama (Driver) */}
            <div className="space-y-4 flex flex-col items-center">
              <span className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider block">
                PIHAK PERTAMA<br /><span className="text-[8px] text-neutral-400">(Driver Pengirim)</span>
              </span>

              <div className="w-48 h-24 border border-dashed border-neutral-300 rounded-xl bg-neutral-50/50 flex flex-col items-center justify-center relative overflow-hidden group">
                {activeDoc.bastSignatureDriver ? (
                  <>
                    <img
                      src={activeDoc.bastSignatureDriver}
                      alt="Ttd Driver"
                      className="max-h-full max-w-full object-contain"
                    />
                    {!isLocked && (
                      <button
                        onClick={() => handleFieldChange('bastSignatureDriver', '')}
                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer print:hidden"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setActiveSigRequest({
                      targetField: 'bastSignatureDriver',
                      title: 'Tanda Tangan Pihak Pertama (Driver)',
                      suggestedName: activeDoc.bastDriver
                    })}
                    className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 flex flex-col items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
                  >
                    <UserCheck className="h-4 w-4" />
                    Klik Bubuhkan Ttd
                  </button>
                )}
              </div>

              <div className="border-b border-neutral-900 w-44 font-bold text-neutral-900 uppercase">
                {activeDoc.bastDriver}
              </div>
            </div>

            {/* Pihak Kedua (Receiver) */}
            <div className="space-y-4 flex flex-col items-center">
              <span className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider block">
                PIHAK KEDUA<br /><span className="text-[8px] text-neutral-400">(Penerima Sekolah)</span>
              </span>

              <div className="w-48 h-24 border border-dashed border-neutral-300 rounded-xl bg-neutral-50/50 flex flex-col items-center justify-center relative overflow-hidden group">
                {activeDoc.bastSignatureReceiver ? (
                  <>
                    <img
                      src={activeDoc.bastSignatureReceiver}
                      alt="Ttd Receiver"
                      className="max-h-full max-w-full object-contain"
                    />
                    {!isLocked && (
                      <button
                        onClick={() => handleFieldChange('bastSignatureReceiver', '')}
                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer print:hidden"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setActiveSigRequest({
                      targetField: 'bastSignatureReceiver',
                      title: 'Tanda Tangan Pihak Kedua (Penerima)',
                      suggestedName: activeDoc.bastPenerima
                    })}
                    className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 flex flex-col items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
                  >
                    <UserCheck className="h-4 w-4" />
                    Klik Bubuhkan Ttd
                  </button>
                )}
              </div>

              <div className="border-b border-neutral-900 w-44 font-bold text-neutral-900 uppercase">
                {activeDoc.bastPenerima}
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
  const totalBAST = filteredDocs.length;
  const completedBAST = filteredDocs.filter(d => d.status === 'Selesai').length;
  const activeBAST = filteredDocs.filter(d => d.status === 'Aktif').length;
  
  let totalSigsNeeded = totalBAST * 2;
  let filledSigs = 0;
  filteredDocs.forEach(d => {
    if (d.bastSignatureDriver) filledSigs++;
    if (d.bastSignatureReceiver) filledSigs++;
  });
  const complianceScore = totalSigsNeeded > 0 ? Math.round((filledSigs / totalSigsNeeded) * 100) : 100;

  return (
    <div className="space-y-6 animate-fade-in" id="bast-dashboard">
      
      {/* 1. Header & Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold font-sans text-neutral-900 flex items-center gap-2 tracking-tight">
              <FileText className="h-6 w-6 text-emerald-800 shrink-0" />
              Arsip &amp; Rekapitulasi Berita Acara Serah Terima (BAST)
            </h2>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
              SOP-Aligned
            </span>
          </div>
          <p className="text-xs text-neutral-500">Pencatatan formalitas serah terima paket hidangan bergizi harian dari tim dapur kepada pihak lembaga sasaran.</p>
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
            <span className="text-neutral-400 font-bold text-[10px] block uppercase tracking-wider">Total Berkas BAST</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-neutral-800">{totalBAST}</span>
              <span className="text-[10px] text-neutral-400 font-mono">Berkas</span>
            </div>
          </div>
          
          <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 flex flex-col justify-between">
            <span className="text-emerald-850 font-extrabold text-[10px] block uppercase tracking-wider">Lembaga Terkunci &amp; Sah</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-800">{completedBAST}</span>
              <span className="text-[10px] text-emerald-500 font-mono font-bold">Lengkap</span>
            </div>
          </div>

          <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 flex flex-col justify-between">
            <span className="text-amber-850 font-extrabold text-[10px] block uppercase tracking-wider">Sedang Berjalan</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-amber-700">{activeBAST}</span>
              <span className="text-[10px] text-amber-500 font-mono font-bold">Aktif</span>
            </div>
          </div>

          <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 flex flex-col justify-between">
            <span className="text-indigo-850 font-extrabold text-[10px] block uppercase tracking-wider">Kelengkapan Tanda Tangan</span>
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
            Panel Filter Rekapitulasi &amp; Kontrol BAST
          </h3>

          {/* Toggle View Mode Buttons (only for admin/aslap) */}
          {isAdminOrAslap && (
            <div className="flex bg-neutral-100 rounded-lg p-0.5 text-[10px] font-bold">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${viewMode === 'table' ? 'bg-white text-emerald-900 shadow-2xs' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                Tampilan Tabel
              </button>
              <button
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
              placeholder="Cari No BAST, Driver, Penerima..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-neutral-200 rounded-xl text-xs bg-neutral-50/50 outline-hidden focus:bg-white focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          {/* School filter (Visible to everyone but only enabled for admin) */}
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
            <h4 className="text-neutral-700 font-bold text-sm">Arsip BAST Belum Dirilis untuk Hari Ini</h4>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Berkas digital Berita Acara Serah Terima makanan untuk 6 lokasi sasaran belum diinisialisasi untuk tanggal {selectedDate}.
            </p>
          </div>
          {isAkunUtama && (
            <button
              onClick={handleInitializeBAST}
              className="bg-emerald-800 hover:bg-emerald-950 text-white text-xs font-bold px-6 py-3 rounded-xl text-center inline-flex items-center gap-2 cursor-pointer shadow-sm active:scale-[0.98] transition-transform"
            >
              <Plus className="h-4 w-4" />
              Inisialisasi 6 Berkas BAST Sekarang
            </button>
          )}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-16 text-center text-xs text-neutral-400 space-y-2 bg-white rounded-3xl border border-neutral-100 shadow-2xs">
          <ShieldAlert className="h-10 w-10 text-neutral-300 mx-auto" />
          <p className="font-bold text-neutral-600 text-sm">Tidak Ada Arsip BAST yang Cocok</p>
          <p className="max-w-xs mx-auto text-neutral-400">Silakan sesuaikan filter pencarian atau inisialisasi dokumen baru jika diperlukan.</p>
        </div>
      ) : isAdminOrAslap && viewMode === 'table' ? (
        /* --- HIGH-DENSITY ANALYTICAL TABLE VIEW (Admin/Aslap Priority) --- */
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-3xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-5">Hari, Tanggal</th>
                  <th className="py-4 px-5">Nomor BAST</th>
                  <th className="py-4 px-5">Lembaga Sasaran</th>
                  <th className="py-4 px-5">Driver (Pihak I)</th>
                  <th className="py-4 px-5">Kuantitas</th>
                  <th className="py-4 px-5 text-center">Ttd Driver</th>
                  <th className="py-4 px-5 text-center">Ttd Penerima</th>
                  <th className="py-4 px-5 text-center">Status</th>
                  <th className="py-4 px-5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {filteredDocs.map((doc) => {
                  const hasDriverSig = !!doc.bastSignatureDriver;
                  const hasReceiverSig = !!doc.bastSignatureReceiver;
                  const isDone = doc.status === 'Selesai';
                  const parts = doc.date.split('-');
                  const dateTextLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : doc.date;
                  
                  return (
                    <tr key={doc.id} className="hover:bg-neutral-50/30 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-neutral-900 font-mono">
                        {dateTextLabel}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-neutral-500 text-[11px] font-semibold">
                        {doc.bastNo}
                      </td>
                      <td className="py-3.5 px-5 font-extrabold text-neutral-800">
                        {doc.bastSekolah}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-neutral-700">
                        {doc.bastDriver}
                      </td>
                      <td className="py-3.5 px-5 font-mono">
                        <span className="font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          {doc.bastJumlah} Box
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {hasDriverSig ? (
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
                              className="text-neutral-400 hover:text-red-650 p-1 rounded transition-colors"
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
            const hasDriverSig = !!doc.bastSignatureDriver;
            const hasReceiverSig = !!doc.bastSignatureReceiver;
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
                      <span className="text-[9px] text-neutral-400 font-mono block uppercase tracking-wider">BAST LOKASI</span>
                      <h4 className="font-bold text-sm text-neutral-850 group-hover:text-emerald-800 transition-colors">
                        {doc.bastSekolah}
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
                    No: {doc.bastNo}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Jumlah: <strong className="text-neutral-700">{doc.bastJumlah} Box</strong> | Driver: {doc.bastDriver}
                  </p>
                  <span className="text-[9.5px] font-mono text-neutral-400 mt-0.5 block">
                    Tanggal: {doc.date}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[10px] text-neutral-500">
                    <span>Tanda Tangan:</span>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className={hasDriverSig ? 'text-emerald-700' : 'text-neutral-400'}>Pihak I {hasDriverSig ? '✓' : '✗'}</span>
                      <span>•</span>
                      <span className={hasReceiverSig ? 'text-emerald-700' : 'text-neutral-400'}>Pihak II {hasReceiverSig ? '✓' : '✗'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    {!isDone && (
                      <button
                        onClick={(e) => handleDeleteDoc(doc.id, e)}
                        className="text-neutral-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                        title="Hapus berkas BAST"
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
