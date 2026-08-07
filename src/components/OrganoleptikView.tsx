import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, Calendar, Plus, Trash2, CheckCircle2, ChevronRight, 
  ArrowLeft, Printer, ShieldAlert, Check, X, UserCheck, RefreshCw
} from 'lucide-react';
import { DayMenu, UserRole } from '../types';
import { UserProfile } from '../lib/supabase';
import DocumentDatePicker from './DocumentDatePicker';
import { getRecipientName, getDefaultReceiptTime } from '../presetData';
import SignaturePad from './SignaturePad';
import OfficialStamp from './OfficialStamp';

interface OrganoleptikViewProps {
  shippingDocs: any[];
  setShippingDocs: React.Dispatch<React.SetStateAction<any[]>>;
  selectedDate: string;
  loggedInUser?: UserProfile | null;
  currentUserRole: UserRole;
  allDayMenus?: DayMenu[];
  onSelectDate?: (date: string) => void;
}

export default function OrganoleptikView({
  shippingDocs,
  setShippingDocs,
  selectedDate,
  loggedInUser,
  currentUserRole,
  allDayMenus = [],
  onSelectDate
}: OrganoleptikViewProps) {
  const [activeDoc, setActiveDoc] = useState<any | null>(null);
  const [activeDateView, setActiveDateView] = useState<string | null>(null);
  const viewDate = activeDateView || selectedDate;
  const localSelectedDate = viewDate;
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter States for Panel Rekapitulasi & Kontrol
  const [filterPenerima, setFilterPenerima] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterSuhu, setFilterSuhu] = useState<string>('All');

  // Signature state for active sheet
  const [activeSigRequest, setActiveSigRequest] = useState<{
    targetField: 'orlepSignature';
    title: string;
    suggestedName: string;
  } | null>(null);

  // Filter Organoleptik docs for the selected date
  const dateDocs = shippingDocs.filter(d => d.type === 'organoleptik' && d.date === viewDate);

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
  const isAdminOrAslap = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.ASLAP;
  const isAkunUtama = currentUserRole === UserRole.ADMIN || (loggedInUser?.email && ['punkysme@gmail.com', 'ketua@sppg.com'].includes(loggedInUser.email.toLowerCase().trim()));
  const isPrimaryAdmin = isAkunUtama;

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
      const allOrlepForDate = shippingDocs.filter(d => d.type === 'organoleptik' && d.date === viewDate);
      if (allOrlepForDate.length > 0 && !activeDoc) {
        const matchingDoc = allOrlepForDate.find(d => d.orlepDesa === restrictedLocation);
        if (matchingDoc) {
          setActiveDoc(matchingDoc);
        } else {
          setActiveDoc(allOrlepForDate[0]);
        }
      }
    }
  }, [restrictedLocation, shippingDocs, viewDate, activeDoc]);

  useEffect(() => {
    if (isAdminOrAslap || activeDoc) return;
    const published = shippingDocs.filter(d => d.type === 'organoleptik' && d.date === viewDate && ['published', 'selesai', 'completed'].includes(String(d.status).toLowerCase()));
    const target = restrictedLocation ? published.find(d => d.orlepDesa === restrictedLocation) : published[0];
    if (target) setActiveDoc(target);
  }, [shippingDocs, viewDate, restrictedLocation, isAdminOrAslap, activeDoc]);

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

  // Auto initialize Organoleptik for today - Creates 6 documents for each recipient
  const handleInitializeOrganoleptik = () => {
    const initDate = viewDate;
    const existing = shippingDocs.filter(d => d.type === 'organoleptik' && d.date === initDate);
    if (existing.length > 0) {
      setErrorMsg('Berkas Uji Organoleptik untuk tanggal ini sudah diinisialisasi dan tidak dapat dibuat lagi.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if (!isAkunUtama) {
      setErrorMsg('Hanya Akun Utama (Administrator) yang dapat menginisialisasi berkas Uji Organoleptik baru.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    const currentDayMenu = allDayMenus.find(m => m.date === viewDate);
    const menuStr = currentDayMenu ? currentDayMenu.menuList.join(', ') : 'Nasi Krawu Bungah, Ayam Goreng Lengkuas, Tempe Bacem, Melon Segar';
    
    const RECIPIENTS_LIST = [
      "MA Assa'adah",
      "MTS Assa'adah II",
      "SMK Assa'adah",
      "SMA Assa'adah",
      "Desa Sukowati",
      "Desa Sidokumpul"
    ];

    const newDocs = RECIPIENTS_LIST.map((recipient, index) => ({
      id: `orlep-${selectedDate}-${index}-${Date.now()}`,
      type: 'organoleptik',
      date: selectedDate,
      vehicleNumber: 'W 1234 BGH',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      comments: `Hasil uji kelayakan sensorik rasa dan suhu CCP hidangan gizi untuk ${recipient}.`,
      uploadedBy: loggedInUser?.email || 'ahligizi@sppg.com',
      uploadedAt: new Date().toISOString(),
      receiverName: getRecipientName(recipient),
      status: 'Aktif',
      orlepJam: getDefaultReceiptTime(recipient),
      orlepPanelis: 'Panelis Organoleptik',
      orlepDesa: recipient,
      orlepMenu: menuStr,
      orlepKritik: 'Suhu hangat terjaga prima, rasa gurih seimbang, melon segar layak konsumsi.',
      organoleptikSuhu: '68',
      orlepGrid: {
        MP_rasa: 4, MP_warna: 4, MP_aroma: 4, MP_tekstur: 4,
        LH_rasa: 4, LH_warna: 4, LH_aroma: 4, LH_tekstur: 4,
        LN_rasa: 4, LN_warna: 4, LN_aroma: 4, LN_tekstur: 4,
        SY_rasa: 4, SY_warna: 4, SY_aroma: 4, SY_tekstur: 4,
        B_rasa: 5, B_warna: 5, B_aroma: 5, B_tekstur: 4,
      },
      orlepSignature: ''
    }));

    // Reinitialize clears old ones for that day
    setShippingDocs(prev => {
      const filteredPrev = prev.filter(d => !(d.type === 'organoleptik' && d.date === viewDate));
      return [...newDocs, ...filteredPrev];
    });

    setSuccessMsg('Berhasil menginisialisasi 6 Lembar Uji Organoleptik untuk seluruh penerima harian!');
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

  // Update individual cell rating on the grid
  const handleGridRatingChange = (compKey: string, score: number) => {
    if (!activeDoc) return;
    const currentGrid = activeDoc.orlepGrid || {};
    const updatedGrid = { ...currentGrid, [compKey]: score };
    handleFieldChange('orlepGrid', updatedGrid);
  };

  const createDefaultDigitalSignature = (name: string, role: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 300, 120);
      ctx.font = 'italic bold 20px "Brush Script MT", cursive, sans-serif';
      ctx.fillStyle = '#92400e';
      ctx.fillText(name, 20, 55);
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#b45309';
      ctx.fillText(`✓ VERIFIED DIGITAL SIGNATURE (${role})`, 20, 85);
      ctx.fillText(`TS: ${new Date().toLocaleString('id-ID')}`, 20, 100);
    }
    return canvas.toDataURL();
  };

  // Finalize / Lock Organoleptik document
  const handleFinalize = () => {
    if (!activeDoc) return;
    let sigOrlep = activeDoc.orlepSignature;

    if (!sigOrlep) {
      const confirmAutoSign = confirm(
        'PERINGATAN: Tanda tangan belum lengkap!\n\n' +
        '• TTD Penguji/Panelis Checker: Belum Ada\n\n' +
        'Apakah Anda ingin membubuhkan Tanda Tangan Digital Resmi & STEMPEL RESMI DAPUR otomatis dan mengunci dokumen Organoleptik ini sekarang?'
      );

      if (!confirmAutoSign) return;

      sigOrlep = createDefaultDigitalSignature(activeDoc.orlepPetugas || loggedInUser?.fullName || 'Panelis Qomaruddin', 'PANELIS CHECKER SENSORIK');
    } else {
      if (!confirm('Apakah Anda yakin ingin mengunci lembar uji organoleptik ini secara permanen? Setelah dikunci, data rekap tidak dapat diubah lagi.')) {
        return;
      }
    }

    const updated = { 
      ...activeDoc, 
      status: 'Terkunci',
      orlepSignature: sigOrlep
    };
    setActiveDoc(updated);
    setShippingDocs(prev => prev.map(d => d.id === activeDoc.id ? updated : d));
    setSuccessMsg('Berkas Uji Organoleptik berhasil ditandatangani, dibubuhi Stempel Resmi, dan terkunci permanen!');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleUnlock = () => {
    if (!activeDoc) return;
    if (confirm('Buka kunci dokumen Uji Organoleptik ini untuk pengeditan ulang?')) {
      const updated = { ...activeDoc, status: 'Aktif' };
      setActiveDoc(updated);
      setShippingDocs(prev => prev.map(d => d.id === activeDoc.id ? updated : d));
      setSuccessMsg('Kunci dokumen Organoleptik berhasil dibuka untuk diedit kembali.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  // Delete a single Organoleptik doc
  const handleDeleteDoc = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Apakah Anda yakin ingin menghapus lembar uji organoleptik ini?')) {
      setShippingDocs(prev => prev.filter(d => d.id !== docId));
      setSuccessMsg('Berkas Uji Organoleptik berhasil dihapus.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const dateText = getIndonesianDateText(selectedDate);

  // Find daily menu to map dish names dynamically to Organoleptik items
  const currentDayMenuForOrlep = allDayMenus.find(m => m.date === viewDate);
  const menuListForOrlep = currentDayMenuForOrlep?.menuList || [];

  // Components to be rated, mapping each to the corresponding daily menu item
  const evaluationComponents = [
    { code: 'MP', name: `Makanan Pokok (${menuListForOrlep[0] || 'Nasi Putih'})` },
    { code: 'LH', name: `Lauk Hewani (${menuListForOrlep[1] || 'Lauk Protein'})` },
    { code: 'LN', name: `Lauk Nabati (${menuListForOrlep[2] || 'Tahu/Tempe'})` },
    { code: 'SY', name: `Sayur Hidangan (${menuListForOrlep[3] || 'Sayuran'})` },
    { code: 'B', name: `Buah / Susu (${menuListForOrlep[4] || 'Buah/Susu'})` }
  ];

  // Recalculate average scores in real-time
  const getComponentAverage = (code: string) => {
    if (!activeDoc) return '0.0';
    const grid = activeDoc.orlepGrid || {};
    const rasa = grid[`${code}_rasa`] || 4;
    const warna = grid[`${code}_warna`] || 4;
    const aroma = grid[`${code}_aroma`] || 4;
    const tekstur = grid[`${code}_tekstur`] || 4;
    return ((rasa + warna + aroma + tekstur) / 4).toFixed(1);
  };

  const getOverallAverage = () => {
    if (!activeDoc) return '0.0';
    let sum = 0;
    evaluationComponents.forEach(comp => {
      sum += parseFloat(getComponentAverage(comp.code));
    });
    return (sum / evaluationComponents.length).toFixed(2);
  };

  // Retained for existing document data; the CCP temperature field is no longer shown in this form.
  const currentSuhu = parseFloat(activeDoc?.organoleptikSuhu || activeDoc?.orlepSuhu || '68') || 68;
  const isCriticalTempViolated = currentSuhu < 60;

  const renderScoreControl = (componentCode: string, criterion: string, score: number) => (
    <input
      type="number"
      min="1"
      max="5"
      step="1"
      value={score}
      aria-label={`Nilai ${criterion} ${componentCode}`}
      onChange={(e) => {
        const nextScore = Number(e.target.value);
        if (Number.isInteger(nextScore) && nextScore >= 1 && nextScore <= 5) {
          handleGridRatingChange(`${componentCode}_${criterion}`, nextScore);
        }
      }}
      className="w-16 bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-center text-xs font-bold text-neutral-800 focus:outline-emerald-500"
    />
  );

  // If viewing a document in full-depth
  if (activeDoc) {
    const isLocked = activeDoc.is_locked === true || activeDoc.isLocked === true || activeDoc.status === 'Selesai' || activeDoc.status === 'Terkunci';
    return (
      <div className="space-y-6 animate-fade-in" id="orlep-printed-view">
        {!isPrimaryAdmin && <DocumentDatePicker selectedDate={viewDate} onSelectDate={(date) => { setActiveDoc(null); setActiveDateView(date); onSelectDate?.(date); }} />}
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

            {!isLocked ? (
              <button
                onClick={handleFinalize}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-950 px-4 py-2 rounded-xl cursor-pointer shadow-sm transition-transform active:scale-[0.98]"
              >
                <Check className="h-4 w-4" />
                Kunci & Rekap Organoleptik
              </button>
            ) : (
              <button
                onClick={handleUnlock}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3.5 py-2 rounded-xl cursor-pointer shadow-3xs"
              >
                <RefreshCw className="h-4 w-4 text-amber-600" />
                Buka Kunci (Edit Dokumen)
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
              ✓ LULUS UJI SENSORIK
            </div>
          )}

          {/* Document Header */}
          <div className="flex items-center justify-between gap-4 border-b-4 border-double border-neutral-900 pb-4">
            <img 
              src="/logo%20yayasan.png"
              alt="Logo Yayasan Qomaruddin"
              className="h-16 w-16 md:h-20 md:w-20 object-contain select-none shrink-0" 
            />
            <div className="text-center flex-1 space-y-1">
              <h3 className="font-extrabold text-neutral-950 text-xs md:text-sm tracking-wide uppercase">
                YAYASAN PONDOK PESANTREN QOMARUDDIN
              </h3>
              <h2 className="font-black text-neutral-900 text-lg md:text-xl tracking-wider uppercase font-display">
                DAPUR SPPG GRESIK BUNGAH BUNGAH 2
              </h2>
              <p className="text-[9px] md:text-[10px] text-neutral-500 italic leading-tight">
                Jl. Raya Bungah No.1, Desa Bungah, Kecamatan Bungah, Kabupaten Gresik, Jawa Timur | email: sppgbungah2@gmail.com
              </p>
            </div>
            <img src="/logo%20sppg.png" alt="Logo SPPG" className="h-16 w-16 md:h-20 md:w-20 object-contain select-none shrink-0" />
          </div>

          <div className="text-center my-6 space-y-1">
            <h1 className="font-black text-lg text-neutral-950 tracking-wider underline">
              FORM PENGUJIAN ORGANOLEPTIK & SENSORIK
            </h1>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-extrabold">
              PENJAMINAN MUTU MAKANAN BERGIZI GRATIS SPPG
            </p>
          </div>

          {/* Standard Legend Card */}
          <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl mb-6">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Panduan Skor Penilaian Gizi & Rasa:</span>
            <div className="grid grid-cols-5 text-center text-[10px] font-extrabold text-neutral-600">
              <span className="border-r border-neutral-200">1: Sangat Buruk</span>
              <span className="border-r border-neutral-200">2: Kurang Suka</span>
              <span className="border-r border-neutral-200">3: Sedikit Suka</span>
              <span className="border-r border-neutral-200">4: Layak (SOP)</span>
              <span>5: Sangat Suka</span>
            </div>
          </div>

          {/* Form Fields Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 border-y border-neutral-300 py-6 mb-6">
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-450 uppercase w-36 shrink-0">Hari / Tanggal Uji:</span>
                <span className="text-xs font-extrabold text-neutral-800">{dateText.dayName}, {dateText.dateNum} {dateText.monthName} {dateText.yearNum}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-450 uppercase w-36 shrink-0">Jam Pengujian:</span>
                {isLocked ? (
                  <span className="text-xs font-extrabold text-neutral-850">{activeDoc.orlepJam}</span>
                ) : (
                  <input
                    type="text"
                    value={activeDoc.orlepJam || ''}
                    onChange={(e) => handleFieldChange('orlepJam', e.target.value)}
                    className="text-xs font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full px-1"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-450 uppercase w-36 shrink-0">Nama Panelis Checker:</span>
                {isLocked ? (
                  <span className="text-xs font-extrabold text-neutral-850">{activeDoc.orlepPanelis}</span>
                ) : (
                  <input
                    type="text"
                    value={activeDoc.orlepPanelis || ''}
                    onChange={(e) => handleFieldChange('orlepPanelis', e.target.value)}
                    className="text-xs font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full px-1"
                  />
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-neutral-450 uppercase w-36 shrink-0">Kecamatan / Desa:</span>
                {isLocked ? (
                  <span className="text-xs font-bold text-neutral-800">{activeDoc.orlepDesa}</span>
                ) : (
                  <input
                    type="text"
                    value={activeDoc.orlepDesa || ''}
                    onChange={(e) => handleFieldChange('orlepDesa', e.target.value)}
                    className="text-xs font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-full px-1"
                  />
                )}
              </div>

              <div className="hidden">
                <span className="text-[10px] font-bold text-neutral-450 uppercase w-36 shrink-0">Suhu CCP Hidangan:</span>
                {isLocked ? (
                  <span className={`text-xs font-mono font-black px-2 py-0.5 rounded border ${isCriticalTempViolated ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                    {currentSuhu} °C
                  </span>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="number"
                      value={activeDoc.organoleptikSuhu || ''}
                      onChange={(e) => handleFieldChange('organoleptikSuhu', e.target.value)}
                      className="text-xs font-mono font-bold text-neutral-850 border-b border-dashed border-neutral-300 focus:border-emerald-600 focus:outline-hidden w-16 px-1 text-center"
                      placeholder="68"
                    />
                    <span className="text-xs font-bold text-neutral-500">°C</span>
                    <span className="text-[9px] text-neutral-400">(Batas Kritis &gt;60°C)</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CCP Warning Alert if applicable */}
          {false && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 mb-6 animate-pulse">
              <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
              <div>
                <p className="font-extrabold uppercase text-red-900 tracking-wider text-[10px]">🚨 WARNING: Pelanggaran Batas Kritis CCP!</p>
                <p className="font-sans text-[11px] text-red-850 font-normal leading-normal mt-0.5">Suhu hidangan saat diuji berada di bawah batas kritis keselamatan pangan (&lt;60°C). Makanan wajib dipanaskan kembali sebelum didistribusikan ke santri!</p>
              </div>
            </div>
          )}

          <div className="space-y-2 mb-6">
            <span className="text-[10px] font-bold text-neutral-450 uppercase block">Menu Masakan Harian Yang Diuji:</span>
            {isLocked ? (
              <p className="font-extrabold text-neutral-900 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200 inline-block text-xs font-sans">
                {activeDoc.orlepMenu}
              </p>
            ) : (
              <textarea
                value={activeDoc.orlepMenu || ''}
                onChange={(e) => handleFieldChange('orlepMenu', e.target.value)}
                rows={2}
                className="w-full text-xs font-bold text-neutral-850 p-3 bg-neutral-50 hover:bg-neutral-100 focus:bg-white rounded-xl border border-neutral-200 focus:border-emerald-600 focus:outline-hidden resize-none"
                placeholder="Nasi Krawu Bungah, Ayam Goreng, Tempe Bacem, Melon..."
              />
            )}
          </div>

          {/* Interactive Evaluation Table */}
          <div className="space-y-3 mb-6">
            <span className="text-[10px] font-bold text-neutral-450 uppercase block">Tabel Penilaian Mutu Sensorik (Uji Panelis)</span>
            <div className="border border-neutral-300 overflow-x-auto rounded-xl shadow-3xs">
              <table className="min-w-[620px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-300 text-[10px] font-bold text-center text-neutral-700">
                    <th className="p-3 border-r border-neutral-300 text-left">Komponen Gizi Hidangan</th>
                    <th className="p-3 border-r border-neutral-300 w-24">Citarasa</th>
                    <th className="p-3 border-r border-neutral-300 w-24">Warna Alami</th>
                    <th className="p-3 border-r border-neutral-300 w-24">Aroma Harum</th>
                    <th className="p-3 border-r border-neutral-300 w-24">Tekstur Matang</th>
                    <th className="p-3">Rata-Rata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-center font-bold text-neutral-850">
                  {evaluationComponents.map(comp => {
                    const grid = activeDoc.orlepGrid || {};
                    const rasa = grid[`${comp.code}_rasa`] || 4;
                    const warna = grid[`${comp.code}_warna`] || 4;
                    const aroma = grid[`${comp.code}_aroma`] || 4;
                    const tekstur = grid[`${comp.code}_tekstur`] || 4;
                    const rowAvg = getComponentAverage(comp.code);
                    
                    return (
                      <tr key={comp.code} className="hover:bg-neutral-50/70">
                        <td className="p-3 border-r border-neutral-200 text-left font-black text-neutral-800">{comp.name}</td>
                        
                        {/* Rasa cell */}
                        <td className="p-2 border-r border-neutral-200">
                          {isLocked ? (
                            <span className="font-mono text-neutral-600">{rasa} / 5</span>
                          ) : (
                            renderScoreControl(comp.code, 'rasa', rasa)
                          )}
                        </td>

                        {/* Warna cell */}
                        <td className="p-2 border-r border-neutral-200">
                          {isLocked ? (
                            <span className="font-mono text-neutral-600">{warna} / 5</span>
                          ) : (
                            renderScoreControl(comp.code, 'warna', warna)
                          )}
                        </td>

                        {/* Aroma cell */}
                        <td className="p-2 border-r border-neutral-200">
                          {isLocked ? (
                            <span className="font-mono text-neutral-600">{aroma} / 5</span>
                          ) : (
                            renderScoreControl(comp.code, 'aroma', aroma)
                          )}
                        </td>

                        {/* Tekstur cell */}
                        <td className="p-2 border-r border-neutral-200">
                          {isLocked ? (
                            <span className="font-mono text-neutral-600">{tekstur} / 5</span>
                          ) : (
                            renderScoreControl(comp.code, 'tekstur', tekstur)
                          )}
                        </td>

                        <td className="p-3 font-black text-emerald-800 bg-emerald-50/40 text-center text-sm">{rowAvg}</td>
                      </tr>
                    );
                  })}
                  
                  {/* Overall score row */}
                  <tr className="bg-neutral-50 font-black border-t-2 border-neutral-300 text-neutral-950 text-center">
                    <td className="p-3 border-r border-neutral-300 text-left font-extrabold uppercase" colSpan={5}>SKOR INDEX ORGANOLEPTIK HARIAN</td>
                    <td className="p-3 font-mono text-base text-emerald-900 bg-emerald-100/40">{getOverallAverage()} / 5.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2 mb-8">
            <span className="text-[10px] font-bold text-neutral-400 uppercase block">Kritik, Saran & Rekomendasi Panelis Checker:</span>
            {isLocked ? (
              <p className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-xs text-neutral-750 italic font-sans leading-relaxed">
                "{activeDoc.orlepKritik}"
              </p>
            ) : (
              <textarea
                value={activeDoc.orlepKritik || ''}
                onChange={(e) => handleFieldChange('orlepKritik', e.target.value)}
                rows={3}
                className="w-full text-xs font-sans text-neutral-700 p-3 bg-neutral-50 hover:bg-neutral-100 focus:bg-white rounded-xl border border-neutral-200 focus:border-emerald-600 focus:outline-hidden resize-none"
                placeholder="Tulis kritik/saran mengenai citarasa, kematangan nasi, atau kesegaran melon..."
              />
            )}
          </div>

          <p className="text-[10px] text-neutral-500 font-sans leading-relaxed my-6">
            Pernyataan: Dengan menandatangani form ini, panelis menyatakan bahwa makanan tersebut di atas dinilai LAYAK KONSUMSI dan sesuai dengan standar gizi serta higienitas santri SPPG Bungah.
          </p>

          {/* Signatures Section */}
          <div className="grid grid-cols-1 pt-6 border-t border-neutral-200 text-xs font-sans relative">
            {isLocked && (
              <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                <OfficialStamp date={activeDoc.date} docNo={activeDoc.orlepNo} />
              </div>
            )}
            <div className="text-right space-y-4 pr-12 flex flex-col items-end">
              <p className="font-semibold text-neutral-600 text-right">
                Penguji / Panelis Checker,<br />
                <span className="text-neutral-450 block text-[8px] uppercase tracking-wider font-extrabold mt-0.5">Seksi Kontrol Kualitas Dapur 2</span>
              </p>

              <div className="w-48 h-24 border border-dashed border-neutral-300 rounded-xl bg-neutral-50/50 flex flex-col items-center justify-center relative overflow-hidden group">
                {activeDoc.orlepSignature ? (
                  <>
                    <img
                      src={activeDoc.orlepSignature}
                      alt="Ttd Panelis"
                      className="max-h-full max-w-full object-contain"
                    />
                    {!isLocked && (
                      <button
                        onClick={() => handleFieldChange('orlepSignature', '')}
                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer print:hidden"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setActiveSigRequest({
                      targetField: 'orlepSignature',
                      title: 'Tanda Tangan Penguji / Panelis',
                      suggestedName: activeDoc.orlepPanelis
                    })}
                    className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 flex flex-col items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
                  >
                    <UserCheck className="h-4 w-4" />
                    Klik Bubuhkan Ttd
                  </button>
                )}
              </div>

              <div className="border-b border-neutral-900 w-44 font-bold text-neutral-900 uppercase text-center">
                {activeDoc.orlepPanelis}
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

  // Filtered list for display in the grid
  const filteredDocs = dateDocs.filter(doc => {
    if (!isAdminOrAslap && !['published', 'selesai', 'completed'].includes(String(doc.status).toLowerCase())) return false;
    // 1. Filter Penerima
    if (filterPenerima !== 'All' && doc.orlepDesa !== filterPenerima) {
      return false;
    }
    // 2. Filter Status
    if (filterStatus !== 'All') {
      const isDone = doc.status === 'Selesai' || doc.status === 'Terkunci';
      if (filterStatus === 'Selesai' && !isDone) return false;
      if (filterStatus === 'Aktif' && isDone) return false;
    }
    // 3. Filter Suhu
    if (filterSuhu !== 'All') {
      const temp = parseFloat(doc.organoleptikSuhu || doc.orlepSuhu || '68') || 68;
      if (filterSuhu === 'Aman' && temp < 60) return false;
      if (filterSuhu === 'Kritis' && temp >= 60) return false;
    }
    return true;
  });

  const getRecipientSummary = (recipient: string) => {
    const doc = dateDocs.find(d => d.orlepDesa === recipient);
    if (!doc) {
      return {
        exists: false,
        status: 'Belum Diinisialisasi',
        score: '-',
        suhu: '-',
        isCritical: false,
        doc: null
      };
    }

    const isDone = doc.status === 'Selesai' || doc.status === 'Terkunci';
    
    let ratingText = '-';
    if (doc.orlepGrid) {
      let sum = 0;
      let cnt = 0;
      evaluationComponents.forEach(comp => {
        const rasa = doc.orlepGrid[`${comp.code}_rasa`] || 4;
        const warna = doc.orlepGrid[`${comp.code}_warna`] || 4;
        const aroma = doc.orlepGrid[`${comp.code}_aroma`] || 4;
        const tekstur = doc.orlepGrid[`${comp.code}_tekstur`] || 4;
        sum += (rasa + warna + aroma + tekstur) / 4;
        cnt++;
      });
      if (cnt > 0) ratingText = `${(sum / cnt).toFixed(2)}`;
    }

    const docTemp = parseFloat(doc.organoleptikSuhu || doc.orlepSuhu || '68') || 68;
    const isCritical = docTemp < 60;

    return {
      exists: true,
      status: isDone ? 'Terkunci' : 'Aktif',
      score: ratingText,
      suhu: `${docTemp}°C`,
      isCritical,
      doc
    };
  };

  const RECIPIENTS_LIST = [
    "MA Assa'adah",
    "MTS Assa'adah II",
    "SMK Assa'adah",
    "SMA Assa'adah",
    "Desa Sukowati",
    "Desa Sidokumpul"
  ];

  // Dashboard / List View
  const filteredDocsByDate = filteredDocs.filter(d => d.date === viewDate);
  // Grid of Date Cards View
  if (!activeDateView && isPrimaryAdmin) {
    const dates = [...(allDayMenus || [])].filter(menu => menu.date.startsWith(selectedDate.slice(0, 7))).sort((a,b) => a.date.localeCompare(b.date));
    
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-emerald-700 shrink-0" />
                Arsip Lembar Pengujian Organoleptik
              </h2>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
                SOP-Aligned
              </span>
            </div>
            <p className="text-sm text-neutral-500">Lembar kendali kualitas rasa, kematangan tekstur makanan, serta kepatuhan thermal suhu kritis CCP hidangan dapur sebelum didistribusikan.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {dates.map(mn => {
            const docsForDate = shippingDocs.filter(d => d.type === 'organoleptik').filter(d => d.date === mn.date);
            const totalDocs = docsForDate.length;
            const signedDocs = docsForDate.filter(d => d.orlepSignature).length;
            const hasDocs = totalDocs > 0;
            
            return (
              <div 
                key={mn.date}
                onClick={() => { setActiveDateView(mn.date); onSelectDate?.(mn.date); }}
                className="bg-white border border-neutral-200 hover:border-emerald-600 rounded-2xl p-5 shadow-3xs cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] text-neutral-400 font-mono block uppercase tracking-wider mb-1">
                    TANGGAL UJI
                  </span>
                  <h4 className="font-bold text-sm text-neutral-850 group-hover:text-emerald-800 transition-colors">
                    {mn.date}
                  </h4>
                  <p className="text-[10px] text-neutral-500 mt-2">
                    {hasDocs ? `${signedDocs} dari ${totalDocs} Form TTD Lengkap` : 'Organoleptik Belum Diinisiasi'}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 flex justify-end">
                  <span className="text-[10px] font-bold flex items-center gap-1 text-emerald-700">
                    Buka Detail <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6 animate-fade-in" id="orlep-dashboard">
      {!isPrimaryAdmin && <DocumentDatePicker selectedDate={viewDate} onSelectDate={(date) => { setActiveDateView(date); onSelectDate?.(date); }} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveDateView(null)}
              className="mr-2 p-1.5 bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-900 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Kembali ke Daftar Tanggal"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-emerald-700 shrink-0" />
              Detail Organoleptik: {viewDate}
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
              SOP-Aligned
            </span>
          </div>
          <p className="text-sm text-neutral-500">Lembar kendali kualitas rasa, kematangan tekstur makanan, serta kepatuhan thermal suhu kritis CCP hidangan dapur sebelum didistribusikan.</p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Primary SOP-Like Checklist Dashboard */}
      {dateDocs.length === 0 ? (
        <div className="p-16 border border-neutral-200 rounded-3xl bg-white text-center space-y-4 max-w-2xl mx-auto shadow-2xs">
          <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto animate-bounce" />
          <div className="space-y-1.5">
            <h4 className="text-neutral-700 font-bold text-sm">Lembar Uji Organoleptik Belum Dirilis</h4>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Lembar pengujian kelayakan rasa & thermal CCP belum diinisialisasi untuk tanggal {viewDate}.
            </p>
          </div>
          <p className="text-xs font-semibold text-amber-700">Inisiasi hanya dilakukan oleh Admin dari Dashboard Admin.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Panel Filter Rekapitulasi & Kontrol Organoleptik */}
          <div className="hidden bg-neutral-50/60 border border-neutral-200 rounded-3xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                  📋 Rekapitulasi & Kontrol Penerima Harian
                </h3>
                <p className="text-xs text-neutral-500 mt-1">Status real-time kepatuhan organoleptik & suhu CCP untuk seluruh 6 titik penerima gizi.</p>
              </div>
              
              {/* Macro Control: Bulk lock/finalize if signed */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const activeUnsigned = dateDocs.filter(d => d.status === 'Aktif' && !d.orlepSignature);
                    const activeSigned = dateDocs.filter(d => d.status === 'Aktif' && d.orlepSignature);
                    if (activeSigned.length === 0) {
                      alert('Tidak ada berkas bertandatangan yang dapat dikunci secara bulk. Silakan bubuhkan tanda tangan di masing-masing lembar terlebih dahulu.');
                      return;
                    }
                    if (confirm(`Apakah Anda yakin ingin mengunci ${activeSigned.length} berkas yang sudah bertandatangan secara masal? Berkas tanpa tanda tangan (${activeUnsigned.length}) akan dilewati.`)) {
                      setShippingDocs(prev => prev.map(d => {
                        if (d.type === 'organoleptik' && d.date === viewDate && d.status === 'Aktif' && d.orlepSignature) {
                          return { ...d, status: 'Selesai' };
                        }
                        return d;
                      }));
                      setSuccessMsg(`Berhasil mengunci secara bulk ${activeSigned.length} Berkas Uji Organoleptik harian!`);
                      setTimeout(() => setSuccessMsg(null), 3000);
                    }
                  }}
                  className="bg-emerald-800 hover:bg-emerald-950 text-white font-extrabold text-[10px] px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer shadow-3xs flex items-center gap-1 uppercase tracking-wider"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Kunci Masal Berkas Ber-Ttd
                </button>
              </div>
            </div>

            {/* Rekap Grid for the 6 recipients */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {RECIPIENTS_LIST.map((recipient) => {
                const info = getRecipientSummary(recipient);
                return (
                  <div 
                    key={recipient}
                    className="bg-white border border-neutral-200 hover:border-neutral-300 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all hover:shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <span className="text-[10px] text-neutral-400 font-mono font-bold block uppercase tracking-wider">PENERIMA</span>
                        <h4 className="font-bold text-xs text-neutral-800 line-clamp-1">{recipient}</h4>
                      </div>
                      {info.exists ? (
                        <span className={`px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-extrabold border ${
                          info.status === 'Terkunci'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {info.status}
                        </span>
                      ) : (
                        <span className="bg-neutral-100 text-neutral-400 border-neutral-200 border px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-extrabold">
                          Belum Ada
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-neutral-100 pt-2 font-sans">
                      <div>
                        <span className="text-neutral-400 block font-medium">Suhu CCP:</span>
                        {info.exists ? (
                          <span className={`font-mono font-black ${info.isCritical ? 'text-red-600' : 'text-emerald-800'}`}>
                            {info.suhu} {info.isCritical ? '⚠' : '✓'}
                          </span>
                        ) : (
                          <span className="text-neutral-300">-</span>
                        )}
                      </div>
                      <div>
                        <span className="text-neutral-400 block font-medium">Skor Mutu:</span>
                        {info.exists ? (
                          <strong className="text-neutral-700 font-mono">{info.score} <span className="text-[8px] text-neutral-400">/ 5</span></strong>
                        ) : (
                          <span className="text-neutral-300">-</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-50 flex items-center justify-between">
                      {info.exists ? (
                        <button
                          onClick={() => setActiveDoc(info.doc)}
                          className="text-emerald-800 hover:text-emerald-950 font-bold text-[10px] uppercase tracking-wider flex items-center gap-0.5 cursor-pointer ml-auto hover:underline"
                        >
                          Buka Form ✍️
                        </button>
                      ) : (
                        <span className="text-[9px] text-neutral-400 italic">Gunakan tombol Re-Inisialisasi</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Filter Controls Row */}
            <div className="bg-neutral-150/80 p-4 rounded-2xl flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px]">Filter Penerima:</span>
                <select
                  value={filterPenerima}
                  onChange={(e) => setFilterPenerima(e.target.value)}
                  className="bg-white border border-neutral-300 rounded-xl px-2.5 py-1.5 font-semibold text-neutral-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer"
                >
                  <option value="All">Semua Penerima ({dateDocs.length})</option>
                  {RECIPIENTS_LIST.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px]">Status Berkas:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white border border-neutral-300 rounded-xl px-2.5 py-1.5 font-semibold text-neutral-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer"
                >
                  <option value="All">Semua Status</option>
                  <option value="Aktif">Aktif (Draft)</option>
                  <option value="Selesai">Terkunci (Muted)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px]">Keamanan CCP:</span>
                <select
                  value={filterSuhu}
                  onChange={(e) => setFilterSuhu(e.target.value)}
                  className="bg-white border border-neutral-300 rounded-xl px-2.5 py-1.5 font-semibold text-neutral-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer"
                >
                  <option value="All">Semua Suhu</option>
                  <option value="Aman">✓ Aman (&gt;= 60°C)</option>
                  <option value="Kritis">⚠ Kritis (&lt; 60°C)</option>
                </select>
              </div>

              {(filterPenerima !== 'All' || filterStatus !== 'All' || filterSuhu !== 'All') && (
                <button
                  onClick={() => {
                    setFilterPenerima('All');
                    setFilterStatus('All');
                    setFilterSuhu('All');
                  }}
                  className="text-red-700 hover:text-red-900 font-bold ml-auto cursor-pointer flex items-center gap-1 transition-transform active:scale-[0.98]"
                >
                  <X className="h-3 w-3" />
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-800 text-xs uppercase tracking-wider">
                Lembar Pengujian Terfilter ({filteredDocsByDate.length} Berkas)
              </h3>
              {filteredDocsByDate.length < dateDocs.length && (
                <span className="text-[10px] text-neutral-400 italic">Menampilkan {filteredDocsByDate.length} dari total {dateDocs.length} berkas hari ini</span>
              )}
            </div>

            {filteredDocsByDate.length === 0 ? (
              <div className="p-12 border border-dashed border-neutral-200 rounded-2xl bg-white text-center text-neutral-400 text-xs">
                Tidak ada lembar pengujian yang cocok dengan kriteria filter aktif.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocsByDate.map((doc) => {
                  const hasSig = !!doc.orlepSignature;
                  const isDone = doc.status === 'Selesai' || doc.status === 'Terkunci';
                  
                  // Extract calculated rating score for preview
                  let ratingText = 'Belum Dinilai';
                  if (doc.orlepGrid) {
                    let sum = 0;
                    let cnt = 0;
                    evaluationComponents.forEach(comp => {
                      const rasa = doc.orlepGrid[`${comp.code}_rasa`] || 4;
                      const warna = doc.orlepGrid[`${comp.code}_warna`] || 4;
                      const aroma = doc.orlepGrid[`${comp.code}_aroma`] || 4;
                      const tekstur = doc.orlepGrid[`${comp.code}_tekstur`] || 4;
                      sum += (rasa + warna + aroma + tekstur) / 4;
                      cnt++;
                    });
                    if (cnt > 0) ratingText = `${(sum / cnt).toFixed(2)} / 5.00`;
                  }

                  const docTemp = parseFloat(doc.organoleptikSuhu || doc.orlepSuhu || '68');
                  const docCritical = docTemp < 60;
                  
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setActiveDoc(doc)}
                      className="bg-white hover:border-emerald-600 border border-neutral-200/80 rounded-2xl p-5 shadow-3xs cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group flex flex-col justify-between min-h-[175px]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] bg-neutral-100 text-neutral-800 border border-neutral-200 font-mono font-bold px-2 py-0.5 rounded-md block uppercase tracking-wider mb-2 w-max">
                              📍 {doc.orlepDesa || 'Umum'}
                            </span>
                            <span className="text-[9px] text-neutral-400 font-mono block uppercase tracking-wider">PANELIS PENGUJI</span>
                            <h4 className="font-bold text-sm text-neutral-800 group-hover:text-emerald-800 transition-colors">
                              {doc.orlepPanelis || 'Panelis Organoleptik'}
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

                        <p className="text-[10px] text-neutral-400 mt-3">
                          Suhu CCP: <span className={`font-mono font-bold ${docCritical ? 'text-red-700' : 'text-emerald-800'}`}>{docTemp} °C</span> {docCritical && '(DI BAWAH BATAS KRITIS!)'}
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-1">
                          Skor Penilaian: <strong className="text-neutral-700">{ratingText}</strong>
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[10px] text-neutral-500">
                          <span>Tanda Tangan Panelis:</span>
                          <span className={hasSig ? 'text-emerald-700 font-bold' : 'text-neutral-400 font-bold'}>
                            {hasSig ? '✓ SUDAH PARAF' : '✗ BELUM PARAF'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                          {!isDone && (
                            <button
                              onClick={(e) => handleDeleteDoc(doc.id, e)}
                              className="text-neutral-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                              title="Hapus berkas Organoleptik"
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
        </div>
      )}
    </div>
  );
}
