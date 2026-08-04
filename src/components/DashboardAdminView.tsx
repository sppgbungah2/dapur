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
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  onSaveSopsToCloud
}: DashboardAdminViewProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSetMasterOpen, setIsSetMasterOpen] = useState(false);
  const [masterDate, setMasterDate] = useState(selectedDate);
  const [portions, setPortions] = useState<PortionConfig>({ ...DEFAULT_PORTIONS });
  const [selectedBundleDate, setSelectedBundleDate] = useState<string | null>(null);

  // For the monthly calendar view
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate || new Date().toISOString()));
  const [monthlyData, setMonthlyData] = useState<Record<string, any>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);

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
          supabase.from('sops').select('date, status, signature_supervisor_url, signature_coordinator_url, is_checked_all').gte('date', startDate).lte('date', endDate),
          supabase.from('surat_jalan_docs').select('date, sj_signature_receiver, sj_signature_aslap').gte('date', startDate).lte('date', endDate),
          supabase.from('bast_docs').select('date, bast_signature_receiver, status').gte('date', startDate).lte('date', endDate),
          supabase.from('organoleptik_docs').select('date, orlep_signature, status').gte('date', startDate).lte('date', endDate)
        ]);
        
        menus = resMenus.status === 'fulfilled' && resMenus.value.data ? resMenus.value.data : [];
        portionsData = resPortions.status === 'fulfilled' && resPortions.value.data ? resPortions.value.data : [];
        sopData = resSops.status === 'fulfilled' && resSops.value.data ? resSops.value.data : [];
        
        const sjData = resSj.status === 'fulfilled' && resSj.value.data ? resSj.value.data : [];
        const bastData = resBast.status === 'fulfilled' && resBast.value.data ? resBast.value.data : [];
        const orlepData = resOrlep.status === 'fulfilled' && resOrlep.value.data ? resOrlep.value.data : [];
        
        docs = [
           ...sjData.map(d => ({ date: d.date, type: 'surat_jalan', sjSignatureReceiver: d.sj_signature_receiver })),
           ...bastData.map(d => ({ date: d.date, type: 'serah_terima', bastSignatureReceiver: d.bast_signature_receiver })),
           ...orlepData.map(d => ({ date: d.date, type: 'organoleptik', orlepSignature: d.orlep_signature }))
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
          totalPM = ((p.MA?.siswa || 0) + (p.MA?.guru || 0)) +
                    ((p["MTS II"]?.siswa || 0) + (p["MTS II"]?.guru || 0)) +
                    ((p.SMK?.siswa || 0) + (p.SMK?.guru || 0)) +
                    ((p.SMA?.siswa || 0) + (p.SMA?.guru || 0)) +
                    ((p.Sukowati?.besar || 0) + (p.Sukowati?.kecil || 0)) +
                    ((p.Sidokumpul?.besar || 0) + (p.Sidokumpul?.kecil || 0));
        }

        // Calculate expected shipments based on configured portions
        let expectedShipments = 0;
        if (dayPorsi && dayPorsi.portions) {
          const p = dayPorsi.portions;
          if ((p.MA?.siswa || 0) > 0 || (p.MA?.guru || 0) > 0) expectedShipments++;
          if ((p["MTS II"]?.siswa || 0) > 0 || (p["MTS II"]?.guru || 0) > 0) expectedShipments++;
          if ((p.SMK?.siswa || 0) > 0 || (p.SMK?.guru || 0) > 0) expectedShipments++;
          if ((p.SMA?.siswa || 0) > 0 || (p.SMA?.guru || 0) > 0) expectedShipments++;
          if ((p.Sukowati?.besar || 0) > 0 || (p.Sukowati?.kecil || 0) > 0) expectedShipments++;
          if ((p.Sidokumpul?.besar || 0) > 0 || (p.Sidokumpul?.kecil || 0) > 0) expectedShipments++;
        }
        
        // If no portions configured for the day, maybe default to 6 to show they are missing, 
        // or default to 0 if we assume nothing should be shipped. Let's use 6 as default expected if portions exist.
        if (expectedShipments === 0 && totalPM > 0) expectedShipments = 6;
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
        const isComplete = isSjComplete && isBastComplete && isOrlepComplete && isSopComplete;

        aggregated[dStr] = {
          menu: dayMenu ? (dayMenu.menu_list ? dayMenu.menu_list.join(', ') : (dayMenu.menuList ? dayMenu.menuList.join(', ') : '')) : '-',
          pm: totalPM,
          sj: sjStatus,
          bast: bastStatus,
          orlep: orlepStatus,
          sop: sopStatus,
          isComplete,
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
                Dashboard Admin Utama
              </h1>
              <p className="text-emerald-100 text-xs mt-1 font-light max-w-xl">
                Selamat datang kembali. Di sini Anda dapat memantau kelengkapan dokumen operasional, membuat draf tugas, menyetujui anggaran belanja, serta menganalisis efisiensi dapur.
              </p>
            </div>
            
            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
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
            </div>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 shadow-xs animate-slide-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Set Master Expanded Section */}
      {isSetMasterOpen && (
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
                <th className="px-4 py-3 border-b border-neutral-200 font-bold">Rekap Dokumen</th>
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
                          onClick={() => setSelectedBundleDate(date)}
                          className={`font-bold px-3 py-1.5 rounded-xl shadow-xs text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                            data.isComplete 
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                              : 'bg-amber-500 hover:bg-amber-600 text-white'
                          }`}
                          title="Unduh / Cetak Kumpulan Semua Dokumen Bundle PDF (Surat Jalan, BAST, Organoleptik, SOP)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Rekap PDF {data.isComplete ? '' : ' (Draft)'}</span>
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
