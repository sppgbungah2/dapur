import React, { useState, useEffect } from 'react';
import { 
  Calendar, CheckCircle2, Shield, Eye, Loader2, Save, Printer, 
  LayoutDashboard, Users, CheckSquare, Award, Trash2, BookOpen, AlertCircle, FileText, ChevronLeft, ChevronRight, Check, X, Database
} from 'lucide-react';
import { DayMenu, UserRole, Division, SOPDocument, TaskItem } from '../types';
import { DEFAULT_PORTIONS, PortionConfig } from './PortionMasterView';
import { SisaStokItem, OrderRequestItem, VolunteerComplaintItem } from './MockModules';
import PerencanaanMenuPorsi from "./PerencanaanMenuPorsi";
import FullDocumentBundlePDF from "./FullDocumentBundlePDF";
import { supabase, isSupabaseConfigured, getLocalDateString } from '../lib/supabase';
import { setOperationalLock, publishOperationalDocuments, initializeOperationalDocuments, autoSignOperationalDocuments } from '../lib/operationalLifecycle';
import PortionMasterView from './PortionMasterView';
import SignatureImportView from './SignatureImportView';
import { DELIVERY_TARGETS, getActiveDeliveryTargets, getDeliveryDetails } from '../utils/deliveryMaster';

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
  onSelectDate?: (date: string) => void;
  boronganMode?: boolean;
}

export default function DashboardAdminView({
  selectedDate,
  allDayMenus,
  sops = [],
  setSops,
  onSaveMenu,
  onGenerateSOPs,
  onGoToTab,
  shippingDocs = [],
  setShippingDocs,
  orderRequests,
  setOrderRequests,
  keluhanList,
  setKeluhanList,
  onSaveSopsToCloud,
  onSelectDate,
  boronganMode = false
}: DashboardAdminViewProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSetMasterOpen, setIsSetMasterOpen] = useState(false);
  const [masterDate, setMasterDate] = useState(selectedDate);
  const [portions, setPortions] = useState<PortionConfig>({ ...DEFAULT_PORTIONS });
  const [selectedBundleDate, setSelectedBundleDate] = useState<string | null>(null);

  // For the monthly calendar view
  const [currentMonth, setCurrentMonth] = useState(new Date(`${selectedDate || getLocalDateString()}T00:00:00`));
  const [monthlyData, setMonthlyData] = useState<Record<string, any>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [processingDate, setProcessingDate] = useState<string | null>(null);

  const waitForInitializedDocuments = async (date: string) => {
    if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
    const { data: portionData, error: portionError } = await supabase.from('master_porsi').select('portions').eq('date', date).maybeSingle();
    if (portionError) throw portionError;
    const expectedShipments = getActiveDeliveryTargets(portionData?.portions || DEFAULT_PORTIONS).length;
    let counts = { sj: 0, bast: 0, orlep: 0, sop: 0 };
    for (let attempt = 0; attempt < 8; attempt++) {
      const [sj, bast, orlep, sop] = await Promise.all([
        supabase.from('surat_jalan_docs').select('id', { count: 'exact', head: true }).eq('date', date),
        supabase.from('bast_docs').select('id', { count: 'exact', head: true }).eq('date', date),
        supabase.from('organoleptik_docs').select('id', { count: 'exact', head: true }).eq('date', date),
        supabase.from('sops').select('id', { count: 'exact', head: true }).eq('date', date)
      ]);
      const error = [sj, bast, orlep, sop].find(result => result.error)?.error;
      if (error) throw error;
      counts = { sj: sj.count || 0, bast: bast.count || 0, orlep: orlep.count || 0, sop: sop.count || 0 };
      if (counts.sj >= expectedShipments && counts.bast >= expectedShipments && counts.orlep >= expectedShipments && counts.sop >= 7) return counts;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`Dokumen belum lengkap: Surat Jalan ${counts.sj}/${expectedShipments}, BAST ${counts.bast}/${expectedShipments}, Organoleptik ${counts.orlep}/${expectedShipments}, SOP ${counts.sop}/7. Klik “Lengkapi Dokumen” untuk mencoba inisiasi ulang.`);
  };

  const syncSignedDocumentsToApp = async (date: string) => {
    if (!supabase) return;
    const [sj, bast, orlep, sop] = await Promise.all([
      supabase.from('surat_jalan_docs').select('*').eq('date', date),
      supabase.from('bast_docs').select('*').eq('date', date),
      supabase.from('organoleptik_docs').select('*').eq('date', date),
      supabase.from('sops').select('*').eq('date', date)
    ]);
    const error = [sj, bast, orlep, sop].find(result => result.error)?.error;
    if (error) throw error;
    const documents = [
      ...(sj.data || []).map((doc: any) => ({ id: doc.id, type: 'surat_jalan', date: doc.date, status: doc.status, is_locked: !!doc.is_locked, vehicleNumber: doc.vehicle_number || '', imageUrl: doc.photo_url || '', comments: doc.comments || '', uploadedBy: doc.uploaded_by || '', receiverName: doc.sj_kepada || '', sjNo: doc.sj_no, sjKepada: doc.sj_kepada, sjDriver: doc.sj_driver, sjWaktu: doc.sj_waktu, items: doc.items || [], sjRows: typeof doc.sj_rows === 'string' ? JSON.parse(doc.sj_rows) : doc.sj_rows || [], sjSignatureAslap: doc.sj_signature_aslap, sjSignatureReceiver: doc.sj_signature_receiver })),
      ...(bast.data || []).map((doc: any) => ({ id: doc.id, type: 'serah_terima', date: doc.date, status: doc.status, is_locked: !!doc.is_locked, vehicleNumber: doc.vehicle_number || '', imageUrl: doc.photo_url || '', comments: doc.comments || '', uploadedBy: doc.uploaded_by || '', receiverName: doc.bast_penerima || doc.bast_sekolah || '', bastNo: doc.bast_no, bastDriver: doc.bast_driver, bastSekolah: doc.bast_sekolah, bastPenerima: doc.bast_penerima, bastBarang: doc.bast_barang, bastJumlah: doc.bast_jumlah, bastWaktu: doc.bast_waktu, items: doc.items || [], bastSignatureDriver: doc.bast_signature_driver, bastSignatureReceiver: doc.bast_signature_receiver })),
      ...(orlep.data || []).map((doc: any) => ({ id: doc.id, type: 'organoleptik', date: doc.date, status: doc.status, is_locked: !!doc.is_locked, imageUrl: doc.photo_url || '', comments: doc.notes || doc.orlep_kritik || '', uploadedBy: doc.uploaded_by || '', orlepJam: doc.orlep_jam, orlepPanelis: doc.orlep_panelis || doc.tester_name, orlepDesa: doc.orlep_desa, orlepMenu: doc.orlep_menu || doc.menu_name, orlepKritik: doc.orlep_kritik, organoleptikSuhu: doc.organoleptik_suhu, orlepGrid: typeof doc.orlep_grid === 'string' ? JSON.parse(doc.orlep_grid) : doc.orlep_grid, orlepSignature: doc.orlep_signature }))
    ];
    setShippingDocs(prev => [...prev.filter(doc => doc.date !== date), ...documents]);
    if (setSops) {
      const updatedById = new Map((sop.data || []).map((doc: any) => [doc.id, doc]));
      setSops(prev => prev.map(item => {
        const doc = updatedById.get(item.id);
        return doc ? { ...item, status: doc.status, isLocked: !!doc.is_locked, signerSupervisor: doc.signer_supervisor, signatureSupervisorUrl: doc.signature_supervisor_url, signedSupervisorAt: doc.signed_supervisor_at, signerCoordinator: doc.signer_coordinator, signatureCoordinatorUrl: doc.signature_coordinator_url, signedCoordinatorAt: doc.signed_coordinator_at } : item;
      }));
    }
  };

  const handleBulkInitialize = async (date: string) => {
    if (!isSupabaseConfigured || !supabase) return setLockMessage('Supabase belum dikonfigurasi.');
    setProcessingDate(date);
    setLockMessage(`Menginisiasi seluruh berkas ${date} di Supabase...`);
    try {
      const { data: menu, error } = await supabase.from('day_menus').select('menu_list').eq('date', date).maybeSingle();
      if (error) throw error;
      const menuList = Array.isArray(menu?.menu_list) ? menu.menu_list : [];
      if (!menuList.length) throw new Error('Menu untuk tanggal ini belum diimpor.');
      await initializeOperationalDocuments(date, menuList, 'admin@sppg.com');
      await waitForInitializedDocuments(date);
      const { data: portionData } = await supabase.from('master_porsi').select('portions').eq('date', date).maybeSingle();
      const expectedShipments = getActiveDeliveryTargets(portionData?.portions || DEFAULT_PORTIONS).length;
      setLockMessage(`Seluruh draft Surat Jalan (${expectedShipments}), BAST (${expectedShipments}), Organoleptik (${expectedShipments}), dan SOP (7) ${date} sudah lengkap di Supabase.`);
      await fetchMonthlyData(currentMonth);
    } catch (err) {
      setLockMessage(`Inisiasi masal gagal: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProcessingDate(null);
    }
  };

  const handleAutoSign = async (date: string) => {
    if (!confirm(`Paraf otomatis dan kunci seluruh dokumen ${date}? Tindakan ini membuat stempel resmi tampil dan dokumen tidak dapat diedit.`)) return;
    setProcessingDate(date);
    setLockMessage(`Memproses paraf, stempel, dan sinkronisasi Supabase untuk ${date}...`);
    try {
      await autoSignOperationalDocuments(date);
      // Memberi waktu singkat pada cache/realtime Supabase, kemudian memuat ulang status dari sumber utama.
      await new Promise(resolve => setTimeout(resolve, 350));
      await syncSignedDocumentsToApp(date);
      setLockMessage(`Paraf otomatis, stempel resmi, dan status Terkunci berhasil tersinkronisasi untuk ${date}.`);
      await fetchMonthlyData(currentMonth);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setLockMessage(`Paraf otomatis gagal: ${detail}${detail.includes('TTD') ? ' Lengkapi atau unggah ulang baris lokasi/divisi tersebut melalui Impor Masal TTD.' : ''}`);
    } finally {
      setProcessingDate(null);
    }
  };

  const handleLockSelectedDate = async () => {
    if (!confirm(`Kunci seluruh dokumen ${selectedDate}? Form dan TTD tidak dapat diubah.`)) return;
    try {
      await setOperationalLock(selectedDate, true);
      setLockMessage(`Dokumen ${selectedDate} berhasil dikunci.`);
      await fetchMonthlyData(currentMonth);
    } catch (err) {
      setLockMessage(`Gagal mengunci dokumen: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePublishSelectedDate = async () => {
    try {
      await publishOperationalDocuments(selectedDate);
      setLockMessage(`Berkas ${selectedDate} diterbitkan dan siap diisi pengguna lapangan.`);
      await fetchMonthlyData(currentMonth);
    } catch (err) {
      setLockMessage(`Gagal menerbitkan berkas: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const fetchMonthlyData = async (date: Date) => {
    setLoadingMonth(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

      let menus: any[] = [];
      let portionsData: any[] = [];
      let docs: any[] = [];
      let sopData: any[] = [];

if (isSupabaseConfigured && supabase) {
        const [resMenus, resPortions, resSops, resSj, resBast, resOrlep] = await Promise.allSettled([
          supabase.from('day_menus').select('*').gte('date', startDate).lte('date', endDate),
          supabase.from('master_porsi').select('date, portions').gte('date', startDate).lte('date', endDate),
          supabase.from('sops').select('date, status, is_locked, signature_supervisor_url, signature_coordinator_url, is_checked_all').gte('date', startDate).lte('date', endDate),
          supabase.from('surat_jalan_docs').select('date, is_locked, sj_signature_receiver, sj_signature_aslap').gte('date', startDate).lte('date', endDate),
          supabase.from('bast_docs').select('date, is_locked, bast_signature_receiver, status').gte('date', startDate).lte('date', endDate),
          supabase.from('organoleptik_docs').select('date, is_locked, orlep_signature, status').gte('date', startDate).lte('date', endDate)
        ]);
        
        menus = resMenus.status === 'fulfilled' && resMenus.value.data ? resMenus.value.data : [];
        portionsData = resPortions.status === 'fulfilled' && resPortions.value.data ? resPortions.value.data : [];
        sopData = resSops.status === 'fulfilled' && resSops.value.data ? resSops.value.data : [];
        
        const sjData = resSj.status === 'fulfilled' && resSj.value.data ? resSj.value.data : [];
        const bastData = resBast.status === 'fulfilled' && resBast.value.data ? resBast.value.data : [];
        const orlepData = resOrlep.status === 'fulfilled' && resOrlep.value.data ? resOrlep.value.data : [];
        
        docs = [
           ...sjData.map(d => ({ date: d.date, type: 'surat_jalan', isLocked: d.is_locked, sjSignatureReceiver: d.sj_signature_receiver })),
           ...bastData.map(d => ({ date: d.date, type: 'serah_terima', isLocked: d.is_locked, bastSignatureReceiver: d.bast_signature_receiver })),
           ...orlepData.map(d => ({ date: d.date, type: 'organoleptik', isLocked: d.is_locked, orlepSignature: d.orlep_signature }))
        ];
      } else {
        menus = allDayMenus.filter(m => m.date.startsWith(`${year}-${String(month).padStart(2, '0')}`));
        docs = shippingDocs.filter(d => d.date.startsWith(`${year}-${String(month).padStart(2, '0')}`));
        sopData = sops.filter(d => d.date.startsWith(`${year}-${String(month).padStart(2, '0')}`));
      }

      const aggregated: Record<string, any> = {};
      const daysInMonth = new Date(year, month, 0).getDate();
      
      for (let i = 1; i <= daysInMonth; i++) {
        const dStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        const dayMenu = menus.find(m => m.date === dStr);
        const dayPorsi = portionsData.find(p => p.date === dStr);
        
        const daySj = docs.filter(d => d.type === 'surat_jalan' && d.date === dStr);
        const dayBast = docs.filter(d => d.type === 'serah_terima' && d.date === dStr);
        const dayOrlep = docs.filter(d => d.type === 'organoleptik' && d.date === dStr);
        const daySop = sopData.filter(d => d.date === dStr);

        let totalPM = 0;
        if (dayPorsi && dayPorsi.portions) {
          const p = dayPorsi.portions;
          totalPM = DELIVERY_TARGETS.reduce((total, target) => total + getDeliveryDetails(target, p).total, 0);
        }

        // Calculate expected shipments based on configured portions
        let expectedShipments = 0;
        if (dayPorsi && dayPorsi.portions) {
          const p = dayPorsi.portions;
          expectedShipments = getActiveDeliveryTargets(p).length;
        }
        
        // If no portions configured for the day, maybe default to 6 to show they are missing, 
        // or default to 0 if we assume nothing should be shipped. Let's use 6 as default expected if portions exist.
        if (totalPM === 0) expectedShipments = 0; // Don't expect docs if 0 portions


        const checkDocStatus = (arr: any[], sigField: string, expectedCount: number = 6) => {
          if (arr.length === 0) return 'Belum Ada';
          if (expectedCount === 0) return `${arr.length} Dokumen`; // Shows what's there even if unexpected
          const allSigned = arr.every(d => d[sigField] && String(d[sigField]).length > 10);
          if (arr.length < expectedCount) {
             return `${arr.length}/${expectedCount} Dokumen`;
          }
          return allSigned ? 'Lengkap & TTD' : 'Lengkap';
        };

        const sjStatus = checkDocStatus(daySj, 'sjSignatureReceiver', expectedShipments);
        const bastStatus = checkDocStatus(dayBast, 'bastSignatureReceiver', expectedShipments);
        const orlepStatus = checkDocStatus(dayOrlep, 'orlepSignature', expectedShipments);

        let sopStatus = 'Belum Ada';
        if (daySop.length > 0) {
          const expectedSOPCount = 7; // Divisi Masak, Pemorsian, Driver, Cuci, Kebersihan, Keamanan, Stocking
          const allSigned = daySop.every(s => 
            s.signature_supervisor_url && String(s.signature_supervisor_url).length > 10 &&
            s.signature_coordinator_url && String(s.signature_coordinator_url).length > 10
          );
          if (daySop.length < expectedSOPCount) {
             sopStatus = `${daySop.length}/${expectedSOPCount} Dokumen`;
          } else {
             sopStatus = allSigned ? 'Lengkap & TTD' : 'Lengkap';
          }
        }

        const isSjComplete = sjStatus.startsWith('Lengkap');
        const isBastComplete = bastStatus.startsWith('Lengkap');
        const isOrlepComplete = orlepStatus.startsWith('Lengkap');
        const isSopComplete = sopStatus.startsWith('Lengkap');
        const hasAllDocuments = daySj.length >= expectedShipments && dayBast.length >= expectedShipments && dayOrlep.length >= expectedShipments && daySop.length >= 7;
        const hasAnyDocument = daySj.length + dayBast.length + dayOrlep.length + daySop.length > 0;
        const isComplete = isSjComplete && isBastComplete && isOrlepComplete && isSopComplete;
        const isLocked = [...daySj, ...dayBast, ...dayOrlep, ...daySop].length > 0 && [...daySj, ...dayBast, ...dayOrlep, ...daySop].every((d: any) => d.isLocked || d.is_locked);
        const isAutoSigned = isLocked && isComplete && sjStatus === 'Lengkap & TTD' && bastStatus === 'Lengkap & TTD' && orlepStatus === 'Lengkap & TTD' && sopStatus === 'Lengkap & TTD';

        aggregated[dStr] = {
          menu: dayMenu ? (dayMenu.menu_list ? dayMenu.menu_list.join(', ') : (dayMenu.menuList ? dayMenu.menuList.join(', ') : '')) : '-',
          pm: totalPM,
          sj: sjStatus,
          bast: bastStatus,
          orlep: orlepStatus,
          sop: sopStatus,
          isComplete,
          hasAllDocuments,
          hasAnyDocument,
          isAutoSigned,
          lifecycleStatus: isAutoSigned ? 'Lengkap & TTD' : isLocked ? 'Terkunci (Locked)' : hasAllDocuments ? 'Siap Paraf Otomatis' : hasAnyDocument ? 'Dokumen Belum Lengkap' : 'Belum Diinisiasi',
          detailStatus: {
            sj: sjStatus,
            bast: bastStatus,
            orlep: orlepStatus,
            sop: sopStatus
          }
        };
      }
      setMonthlyData(aggregated);
    } catch (e) {
      console.warn("Failed to fetch monthly data", e);
    } finally {
      setLoadingMonth(false);
    }
  };

  useEffect(() => {
    fetchMonthlyData(currentMonth);
  }, [currentMonth]);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'Lengkap & TTD') {
      return <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><Check className="inline w-3 h-3 mr-1"/>Lengkap & TTD</span>;
    }
    if (status === 'Lengkap') {
      return <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap">Lengkap</span>;
    }
    if (status.includes('/')) {
      return <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap">{status}</span>;
    }
    return <span className="bg-neutral-100 text-neutral-400 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"><X className="inline w-3 h-3 mr-1"/>Belum Ada</span>;
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
                {boronganMode ? 'Borongan Dokumen' : 'Dashboard Admin Utama'}
              </h1>
              {!boronganMode && <><button onClick={handleLockSelectedDate} className="mt-3 rounded-lg bg-amber-400 px-3 py-2 text-xs font-extrabold text-neutral-900 hover:bg-amber-300">Rekap & Kunci Dokumen {selectedDate}</button>
              <button onClick={handlePublishSelectedDate} className="mt-3 ml-2 rounded-lg bg-blue-400 px-3 py-2 text-xs font-extrabold text-neutral-900 hover:bg-blue-300">Terbitkan Berkas {selectedDate}</button></>}
              {lockMessage && <p className="mt-2 text-xs font-semibold">{lockMessage}</p>}
              <p className="text-emerald-100 text-xs mt-1 font-light max-w-xl">
                {boronganMode ? 'Impor master untuk banyak tanggal, inisiasi seluruh berkas sekali klik, kemudian paraf otomatis memakai URL TTD yang Anda unggah.' : 'Selamat datang kembali. Di sini Anda dapat memantau kelengkapan dokumen operasional, membuat draf tugas, menyetujui anggaran belanja, serta menganalisis efisiensi dapur.'}
              </p>
            </div>
            
            {/* Quick Action Buttons */}
            {!boronganMode && <div className="flex items-center gap-2 flex-wrap">
              {isSetMasterOpen && (
                <input 
                  type="date"
                  value={masterDate}
                  onChange={(e) => setMasterDate(e.target.value)}
                  className="bg-emerald-900 border border-emerald-500/50 text-white text-xs font-bold px-3 py-2 rounded-xl focus:outline-none"
                />
              )}
              <button
                onClick={() => setIsSetMasterOpen(!isSetMasterOpen)}
                className="bg-emerald-700 hover:bg-emerald-600 active:scale-95 border border-emerald-500/30 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Database className="w-4 h-4" />
                {isSetMasterOpen ? 'Tutup Set Master' : 'Set Master'}
              </button>
            </div>}
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 shadow-xs animate-slide-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {lockMessage && boronganMode && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">{lockMessage}</div>}

      {boronganMode && <><PortionMasterView selectedDate={selectedDate} allDayMenus={allDayMenus} importOnly /><SignatureImportView /></>}

      {/* Set Master Expanded Section */}
      {!boronganMode && isSetMasterOpen && (
        <div className="animate-fade-in border border-emerald-200 bg-emerald-50/30 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-emerald-100 shadow-sm w-fit">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <label className="text-xs font-bold text-neutral-700">Tanggal Master:</label>
            <input 
              type="date"
              value={masterDate}
              onChange={(e) => setMasterDate(e.target.value)}
              className="text-sm border-none bg-transparent outline-none font-mono text-emerald-800 font-bold"
            />
          </div>
          <PerencanaanMenuPorsi 
            selectedDate={masterDate} 
            onSuccess={msg => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3500); setIsSetMasterOpen(false); fetchMonthlyData(currentMonth); }} 
            onGenerateSOPs={onGenerateSOPs!} 
            shippingDocs={shippingDocs} 
            setShippingDocs={setShippingDocs} 
            allDayMenus={allDayMenus} 
            onSaveMenu={onSaveMenu!} 
            onSavePortions={(p) => { setPortions(p); }}
          />
        </div>
      )}

      {/* Monthly Recap Table */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-3xs overflow-hidden">
        <div className="p-5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-700" />
              Daftar Rekapitulasi
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Menampilkan seluruh konfigurasi porsi yang telah disimpan di cloud untuk berbagai tanggal.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors cursor-pointer">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-extrabold text-neutral-800 uppercase tracking-widest min-w-32 text-center">
              {currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors cursor-pointer">
              <ChevronRight className="w-5 h-5" />
            </button>
            <button onClick={() => fetchMonthlyData(currentMonth)} className="p-2 ml-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer" title="Refresh Data">
              <Loader2 className={`w-4 h-4 ${loadingMonth ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 border-b border-neutral-200 font-bold whitespace-nowrap">Tanggal</th>
                <th className="px-4 py-3 border-b border-neutral-200 font-bold min-w-48">Menu</th>
                <th className="px-4 py-3 border-b border-neutral-200 font-bold">PM</th>
                <th className="px-4 py-3 border-b border-neutral-200 font-bold">Surat Jalan</th>
                <th className="px-4 py-3 border-b border-neutral-200 font-bold">BAST</th>
                <th className="px-4 py-3 border-b border-neutral-200 font-bold">Organoleptik</th>
                <th className="px-4 py-3 border-b border-neutral-200 font-bold">SOP</th>
                <th className="px-4 py-3 border-b border-neutral-200 font-bold">{boronganMode ? 'Aksi Borongan' : 'Rekap Dokumen'}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-neutral-100">
              {loadingMonth ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-neutral-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
                    Memuat data...
                  </td>
                </tr>
              ) : Object.keys(monthlyData).length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-neutral-500">
                    Tidak ada data untuk bulan ini.
                  </td>
                </tr>
              ) : (
                Object.keys(monthlyData).map(date => {
                  const data = monthlyData[date];
                  return (
                    <tr key={date} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-neutral-900 whitespace-nowrap">{date}</td>
                      <td className="px-4 py-3 text-neutral-600 truncate max-w-[200px]" title={data.menu}>{data.menu}</td>
                      <td className="px-4 py-3 font-bold text-neutral-800">{data.pm > 0 ? `${data.pm} Porsi` : '-'}</td>
                      <td className="px-4 py-3"><StatusBadge status={data.sj} /></td>
                      <td className="px-4 py-3"><StatusBadge status={data.bast} /></td>
                      <td className="px-4 py-3"><StatusBadge status={data.orlep} /></td>
                      <td className="px-4 py-3"><StatusBadge status={data.sop} /></td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            if (boronganMode) {
                              if (data.isAutoSigned) { onSelectDate?.(date); setSelectedBundleDate(date); }
                              else if (!data.hasAllDocuments) void handleBulkInitialize(date);
                              else if (data.isComplete) void handleAutoSign(date);
                              return;
                            }
                            onSelectDate?.(date); setSelectedBundleDate(date);
                          }}
                          disabled={processingDate === date}
                          className={`font-bold px-3 py-1.5 rounded-xl shadow-xs text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                            data.isComplete 
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                              : 'bg-amber-500 hover:bg-amber-600 text-white'
                          } ${processingDate === date ? 'opacity-70 cursor-wait' : ''}`}
                          title={boronganMode ? 'Inisiasi semua berkas atau paraf otomatis' : 'Unduh / Cetak Kumpulan Semua Dokumen Bundle PDF (Surat Jalan, BAST, Organoleptik, SOP)'}
                        >
                          {processingDate === date ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : boronganMode && !data.hasAllDocuments ? <FileText className="w-3.5 h-3.5" /> : boronganMode && data.isAutoSigned ? <Printer className="w-3.5 h-3.5" /> : boronganMode ? <Check className="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />}
                          <span>{processingDate === date ? 'Menyinkronkan...' : boronganMode ? (data.lifecycleStatus === 'Belum Diinisiasi' ? 'Inisiasi Masal' : data.isAutoSigned ? 'Lengkap & Terbit' : !data.hasAllDocuments ? 'Lengkapi Dokumen' : data.isComplete ? 'Paraf Otomatis' : data.lifecycleStatus) : data.lifecycleStatus}</span>
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

      {/* Full Document Bundle PDF Preview Modal */}
      {selectedBundleDate && (
        <FullDocumentBundlePDF
          selectedDate={selectedBundleDate}
          allDayMenus={allDayMenus}
          sops={sops}
          shippingDocs={shippingDocs}
          onClose={() => setSelectedBundleDate(null)}
        />
      )}
    </div>
  );
}
