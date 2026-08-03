import React, { useState } from 'react';
import { 
  Calendar, Loader2, Sparkles, Plus, Trash2, Check, AlertCircle, RefreshCw, FilePlus, BookOpen, ChevronRight,
  Shield, UserCheck, Database, Link, AlertTriangle
} from 'lucide-react';
import { Division, UserRole, DayMenu, SOPDocument } from '../types';
import { DIVISION_CREATOR_MAP } from '../presetData';

interface SOPCreatorProps {
  selectedDate: string;
  dayMenu: DayMenu | null;
  sopsForDate: SOPDocument[];
  currentUserRole: UserRole;
  currentUsername: string;
  onSaveMenu: (date: string, menuList: string[]) => void;
  onGenerateSOPs: (date: string, menuList: string[]) => void;
  onUpdateSOP: (updatedSOP: SOPDocument) => void;
  allDayMenus: DayMenu[];
  onSelectDate: (date: string) => void;
  onDeleteMenu: (date: string) => void;
  onSetUserRole: (role: UserRole) => void;
  onBootstrapDb: () => Promise<void>;
  onSaveSopsToCloud?: (date?: string) => Promise<{ success: boolean; message: string }>;
}

const PRESET_SUGGESTIONS = [
  { name: 'Nasi Krawu Bungah', items: ['Nasi Putih', 'Krawu Ayam Bungah', 'Tempe Goreng Ketumbar', 'Kupasan Timun Segar', 'Sambal Serundeng', 'Pisang'] },
  { name: 'Soto Lamongan Mantap', items: ['Nasi Gurih', 'Soto Ayam Lamongan', 'Telur Asin Madura', 'Krupuk Bawang', 'Jeruk Manis'] },
  { name: 'Ayam Geprek Pedas', items: ['Nasi Putih', 'Ayam Geprek Sambal Korek', 'Tumis Kangkung Belacan', 'Khrupuk Udang', 'Pisang Ambon'] },
  { name: 'Rawon Sapi Tradisional', items: ['Nasi Putih', 'Rawon Daging Sapi', 'Mendol Tempe', 'Kecambah Segar & Nipis', 'Semangka Merah'] },
  { name: 'Gulai Bandeng Segar', items: ['Nasi Putih', 'Gulai Ikan Bandeng', 'Sayur Bobor Bayam Labu', 'Tahu Goreng Tepung', 'Melon Segar'] }
];

export default function SOPCreator({
  selectedDate,
  dayMenu,
  sopsForDate,
  currentUserRole,
  currentUsername,
  onSaveMenu,
  onGenerateSOPs,
  onUpdateSOP,
  allDayMenus,
  onSelectDate,
  onDeleteMenu,
  onSetUserRole,
  onBootstrapDb,
  onSaveSopsToCloud
}: SOPCreatorProps) {
  // Primary (H-0 / Current Edit Date) States
  const [editedMenuList, setEditedMenuList] = useState<string[]>(
    dayMenu ? [...dayMenu.menuList] : []
  );
  const [newItemText, setNewItemText] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Future Scheduling (Tomorrow & Subsequent Dates) States
  const [schedDate, setSchedDate] = useState(() => {
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [schedMenuList, setSchedMenuList] = useState<string[]>([]);
  const [schedItemText, setSchedItemText] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  // Admin and Seeding States
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  // Sync edited menu list when dayMenu changes
  React.useEffect(() => {
    if (dayMenu) {
      setEditedMenuList([...dayMenu.menuList]);
    } else {
      setEditedMenuList([]);
    }
  }, [dayMenu]);

  // Primary Handlers
  const handleAddMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    setEditedMenuList([...editedMenuList, newItemText.trim()]);
    setNewItemText('');
  };

  const handleRemoveMenuItem = (index: number) => {
    const updated = editedMenuList.filter((_, idx) => idx !== index);
    setEditedMenuList(updated);
  };

  const applyPresetToActive = (items: string[]) => {
    setEditedMenuList([...items]);
    setSuccessBanner('Template menu makanan gizi berhasil disalin ke draf aktif!');
    setTimeout(() => setSuccessBanner(null), 3000);
  };

  const handleSaveMenuAndInitialize = () => {
    if (editedMenuList.length === 0) {
      alert('Tulis/tambahkan minimal 1 menu makanan (misal: Nasi Putih) terlebih dahulu!');
      return;
    }
    
    setIsActivating(true);
    setTimeout(async () => {
      onSaveMenu(selectedDate, editedMenuList);
      onGenerateSOPs(selectedDate, editedMenuList);
      if (onSaveSopsToCloud) {
        const res = await onSaveSopsToCloud(selectedDate);
        setSuccessBanner(res.message);
      } else {
        setSuccessBanner(`Menu & SOP digital untuk tanggal ${selectedDate} berhasil dideploy ke Supabase!`);
      }
      setIsActivating(false);
      setTimeout(() => setSuccessBanner(null), 4000);
    }, 1000);
  };

  const handleExplicitCloudSave = async () => {
    if (!onSaveSopsToCloud) return;
    setIsActivating(true);
    try {
      const res = await onSaveSopsToCloud(selectedDate);
      setSuccessBanner(res.message);
    } catch (err: any) {
      alert('Gagal menyimpan ke Cloud: ' + (err?.message || err));
    } finally {
      setIsActivating(false);
      setTimeout(() => setSuccessBanner(null), 4000);
    }
  };

  // Scheduling (Future Date) Handlers
  const handleAddSchedItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedItemText.trim()) return;
    setSchedMenuList([...schedMenuList, schedItemText.trim()]);
    setSchedItemText('');
  };

  const handleRemoveSchedItem = (index: number) => {
    setSchedMenuList(schedMenuList.filter((_, idx) => idx !== index));
  };

  const applyPresetToSched = (items: string[]) => {
    setSchedMenuList([...items]);
  };

  const handleReleaseSchedMenu = () => {
    if (!schedDate) {
      alert('Tentukan tanggal penjadwalan terlebih dahulu!');
      return;
    }
    if (schedMenuList.length === 0) {
      alert('Masukkan minimal 1 hidangan untuk menu makanan terjadwal!');
      return;
    }

    setIsScheduling(true);
    setTimeout(() => {
      onSaveMenu(schedDate, schedMenuList);
      onGenerateSOPs(schedDate, schedMenuList);
      setIsScheduling(false);
      setSuccessBanner(`Penjadwalan Sukses! Menu & SOP untuk tanggal esok/selanjutnya (${schedDate}) berhasil ditambahkan ke database.`);
      setSchedMenuList([]);
      // Select the newly scheduled date
      onSelectDate(schedDate);
      setTimeout(() => setSuccessBanner(null), 5000);
    }, 1200);
  };

  // Database Seed Action
  const handleDatabaseSeed = async () => {
    if (!confirm('Apakah Anda ingin memicu ulang seeding dasar data memasak dapur? Seluruh draf, input tanda tangan, dan tabel akan diatur ulang ke data bawaan pesantren.')) {
      return;
    }
    setIsSeeding(true);
    try {
      await onBootstrapDb();
      setSuccessBanner('Hore! Database berhasil diseed instan dengan reset total, RLS aman.');
    } catch (err: any) {
      alert('Error saat seeding: ' + err.message);
    } finally {
      setIsSeeding(false);
      setTimeout(() => setSuccessBanner(null), 4000);
    }
  };

  // Responsibility Label Map
  const getCreatorLabelByRole = (role: UserRole) => {
    switch (role) {
      case UserRole.CHEF: return 'Stocking (Persiapan) & Masak';
      case UserRole.AHLI_GIZI: return 'Pemorsian';
      case UserRole.ASLAP: return 'Driver, Cuci, Kebersihan, & Keamanan';
      default: return 'Semua Divisi';
    }
  };

  // Indonesian Date Formatter
  const formatIndoDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[date.getDay()]}, ${parts[2]} ${months[date.getMonth()]} ${parts[0]}`;
  };

  return (
    <div className="space-y-6" id="sop-creator-root">
      
      {/* Toast Alert Success */}
      {successBanner && (
        <div id="success-banner-toast" className="bg-emerald-950 text-emerald-350 border-2 border-emerald-500 p-4 rounded-xl text-xs flex items-center gap-2.5 animate-bounce shadow-md">
          <Check className="h-5 w-5 text-emerald-400 shrink-0" />
          <div className="font-mono">
            <strong className="block uppercase tracking-wider text-[10px] text-emerald-500">SISTEM INTEGRASI SUPABASE</strong>
            <span>{successBanner}</span>
          </div>
        </div>
      )}



      {/* 2. REGULAR DRAFT CO-ORDINATOR HEADER BANNER */}
      <div className="bg-emerald-800 text-white p-5 rounded-2xl border border-emerald-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="bg-emerald-700/80 uppercase text-[10px] tracking-widest font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-600/30 font-mono">
            LOG MASUK: {currentUserRole}
          </span>
          <h2 className="text-xl font-bold font-display mt-2">
            Perancang SOP Dapur SPPG Qomaruddin
          </h2>
          <p className="text-xs text-emerald-100 max-w-xl mt-1">
            Berdasarkan hak akses Anda, Anda bertanggung jawab penuh untuk memantau/merilis SOP divisi <strong className="text-emerald-300 font-bold">{getCreatorLabelByRole(currentUserRole)}</strong>.
          </p>
        </div>
        <div className="bg-emerald-940 px-4 py-2.5 rounded-xl border border-emerald-700/40 font-mono text-[11px] space-y-0.5 select-none shrink-0 text-center">
          <span className="text-emerald-400 block uppercase font-bold text-[9px] tracking-wider">Menu Aktif Tanggal</span>
          <span className="text-white font-bold block">{formatIndoDate(selectedDate)}</span>
        </div>
      </div>

      {/* Main drafting grid split: Left (Menu Editor) & Right (SOP Generator Status) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: PRIMARY MENU MAKANAN (Input & Presets) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <h3 className="font-bold text-neutral-800 text-sm font-display flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-700" />
                Daftar Menu Hidangan Hari H
              </h3>
              <p className="text-[11px] text-neutral-500">Isi draf hidangan aktif untuk menyinkronkan butir checklist SOP pondok.</p>
            </div>
            
            {dayMenu && (
              <span className="bg-emerald-50 text-emerald-800 font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded">
                Terbit
              </span>
            )}
          </div>

          {/* Quick presets shortcut bar */}
          <div className="space-y-1.5 bg-neutral-50/70 p-3 rounded-xl border border-neutral-200/40">
            <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-black block font-mono">⚡ TEMPLAT CEPAT MENU GIZI SPPG:</span>
            <div className="flex flex-wrap gap-1">
              {PRESET_SUGGESTIONS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  id={`btn-preset-active-${idx}`}
                  onClick={() => applyPresetToActive(preset.items)}
                  className="bg-white hover:bg-emerald-800 hover:text-white text-neutral-700 border border-neutral-200 hover:border-emerald-700 text-[10px] font-bold px-2.5 py-1.5 rounded-md transition-all cursor-pointer"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleAddMenuItem} className="flex gap-2">
            <input
              type="text"
              id="input-add-menu-item-text"
              value={newItemText}
              onChange={e => setNewItemText(e.target.value)}
              className="flex-1 text-xs border border-neutral-200 bg-neutral-50/50 rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Tambahkan menu, e.g. Sambal Serundeng..."
            />
            <button
              type="submit"
              id="btn-add-menu-item"
              className="bg-emerald-800 hover:bg-emerald-950 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </button>
          </form>

          {editedMenuList.length === 0 ? (
            <div className="p-10 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/30 text-center text-xs text-neutral-400 space-y-1">
              <AlertCircle className="h-6 w-6 text-neutral-300 mx-auto" />
              <p className="font-semibold text-neutral-500">Belum Ada Menu Ditambahkan</p>
              <p className="text-[10px]">Ahli Gizi atau Tim Dapur wajib memasukkan rincian lauk pauk di atas terlebih dahulu.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {editedMenuList.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 border border-neutral-100 bg-neutral-50 rounded-lg text-xs font-sans group">
                  <span className="font-semibold text-neutral-800 flex items-center gap-2">
                    <span className="w-5 h-5 bg-neutral-200/60 font-mono text-[10px] text-neutral-600 rounded-full flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    {item}
                  </span>
                  <button
                    type="button"
                    id={`btn-remove-active-item-${idx}`}
                    onClick={() => handleRemoveMenuItem(idx)}
                    className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-neutral-100 pt-4 flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] text-neutral-400">
              *Diunggah oleh: {dayMenu ? dayMenu.createdBy : 'Draf belum disimpan'}
            </span>
            <div className="flex items-center gap-2">
              {onSaveSopsToCloud && (
                <button
                  type="button"
                  onClick={handleExplicitCloudSave}
                  disabled={isActivating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-95"
                >
                  {isActivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  SIMPAN SOP KE CLOUD
                </button>
              )}
              <button
                id="btn-release-sops"
                onClick={handleSaveMenuAndInitialize}
                className="bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform"
              >
                {dayMenu ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Ganti / Update SOP & Menu
                  </>
                ) : (
                  <>
                    <FilePlus className="h-3.5 w-3.5" />
                    Rilis SOP Tanggal Ini
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SOP GENERATOR WORKFLOW GRAPH */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-4">
          <div className="border-b border-neutral-100 pb-3">
            <h3 className="font-bold text-neutral-800 text-sm font-display flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              Alur Penerbitan Instan SOP Digital
            </h3>
            <p className="text-[11px] text-neutral-500">Alur pembuatan berkas checklist otomatis bagi pelaksana santri gizi pesantren.</p>
          </div>

          {sopsForDate.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 rounded-xl space-y-3 bg-neutral-50/20">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <p className="font-semibold text-neutral-700 text-sm">SOP Belum Dihasilkan untuk Tanggal Ini</p>
                <p className="max-w-[340px] mx-auto text-neutral-500">Mulai dengan melengkapi daftar menu makanan di sebelah kiri, kemudian ketuk tombol <strong>"Rilis SOP Tanggal Ini"</strong> berwarna hitam.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-xs text-emerald-800 font-sans flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-700" />
                <span>Format SOP digital 7 divisi saat ini aktif. Semua checklist harian disesuaikan instan berdasarkan menu porsi.</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { name: Division.STOCKING, role: UserRole.CHEF },
                  { name: Division.MASAK, role: UserRole.CHEF },
                  { name: Division.PEMORSIAN, role: UserRole.AHLI_GIZI },
                  { name: Division.DRIVER, role: UserRole.ASLAP },
                  { name: Division.CUCI, role: UserRole.ASLAP },
                  { name: Division.KEBERSIHAN, role: UserRole.ASLAP },
                  { name: Division.KEAMANAN, role: UserRole.ASLAP }
                ].map((row, id) => {
                  const creatorInfo = DIVISION_CREATOR_MAP[row.name];
                  const hasSOP = sopsForDate.find(s => s.division === row.name);
                  
                  return (
                    <div 
                      key={id} 
                      className={`p-3 border rounded-xl flex items-center justify-between ${
                        hasSOP ? 'bg-neutral-50/50 border-neutral-200/60' : 'bg-red-50/20 border-red-200/50'
                      }`}
                    >
                      <div className="space-y-1">
                        <strong className="block text-neutral-800 font-bold font-sans">{row.name.split(' ')[0]}</strong>
                        <span className="text-[10px] text-neutral-400 block uppercase font-mono">Dibuat oleh: {creatorInfo.label}</span>
                      </div>
                      
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${
                        hasSOP ? 'bg-emerald-100 text-emerald-800 text-emerald-900' : 'bg-red-100 text-red-800'
                      }`}>
                        {hasSOP ? 'AKTIF' : 'KOSONG'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. CORE NEW FEATURE: SCHEDULING INTERFACE FOR FUTURE DATES */}
      {currentUserRole === UserRole.ADMIN && (
        <div id="scheduler-panel" className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-4">
          <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-neutral-800 text-sm font-display flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-800" />
                📅 Penjadwalan & Atur Menu untuk Tanggal Selanjutnya
              </h3>
              <p className="text-[11px] text-neutral-500">
                Gunakan formulir penjadwalan ini untuk menerbitkan menu gizi dan merilis SOP cetak digital pesantren pada tanggal edaran masa depan.
              </p>
            </div>
            <span className="bg-emerald-50 text-[10px] text-emerald-800 uppercase tracking-wider font-extrabold px-2.5 py-1 rounded font-mono">
              FUTURE SCHEDULE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
            
            {/* Input Date and Preset */}
            <div className="md:col-span-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase mb-1 font-mono">1. Pilih Tanggal Selanjutnya</label>
                <input
                  type="date"
                  id="input-sched-date"
                  value={schedDate}
                  onChange={e => setSchedDate(e.target.value)}
                  className="w-full text-xs font-mono font-bold border border-neutral-200 bg-neutral-50 text-neutral-900 rounded-lg p-2.5"
                />
              </div>

              <div className="bg-neutral-50 p-4 border border-neutral-200/50 rounded-xl space-y-2">
                <strong className="text-[10px] text-neutral-500 uppercase font-bold block tracking-wider font-mono">PILIH TEMPLAT PRESET GIZI:</strong>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_SUGGESTIONS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      id={`btn-preset-sched-${idx}`}
                      onClick={() => applyPresetToSched(preset.items)}
                      className="bg-white hover:bg-emerald-800 hover:text-white border border-neutral-200 text-neutral-700 text-[10px] font-bold py-1.5 px-2 rounded transition-all text-left truncate"
                    >
                      ★ {preset.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Menu item drafting list for future date */}
            <div className="md:col-span-7 space-y-3 border-l border-neutral-100 pl-0 md:pl-6">
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1 font-mono">2. Susun Menu Makanan Terjadwal</label>
              
              <form onSubmit={handleAddSchedItem} className="flex gap-2">
                <input
                  type="text"
                  id="input-sched-item-text"
                  value={schedItemText}
                  onChange={e => setSchedItemText(e.target.value)}
                  className="flex-1 text-xs border border-neutral-200 bg-neutral-50 rounded-lg px-3 py-2"
                  placeholder="Masukkan lauk gizi untuk tanggal terpilih..."
                />
                <button
                  type="submit"
                  id="btn-add-sched-item"
                  className="bg-neutral-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Tambah
                </button>
              </form>

              {schedMenuList.length === 0 ? (
                <div className="p-8 border border-dashed border-neutral-200 rounded-xl text-center text-xs text-neutral-400">
                  Belum ada draf. Pilih salah satu preset di sebelah kiri atau ketik makanan mandiri di atas.
                </div>
              ) : (
                <div className="space-y-1 max-h-[140px] overflow-y-auto">
                  {schedMenuList.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border border-neutral-100 bg-neutral-50/70 rounded-lg text-xs">
                      <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                        <span className="w-4 h-4 bg-neutral-200 rounded-full flex items-center justify-center font-bold text-[9px] text-neutral-600">{idx+1}</span>
                        {item}
                      </span>
                      <button
                        type="button"
                        id={`btn-remove-sched-item-${idx}`}
                        className="p-1 text-neutral-400 hover:text-red-600 rounded"
                        onClick={() => handleRemoveSchedItem(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-right pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  id="btn-publish-sched-menu"
                  onClick={handleReleaseSchedMenu}
                  disabled={isScheduling}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-mono font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-1 ml-auto cursor-pointer"
                >
                  {isScheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Jadwalkan Menu & Kirim SOP Baru ({schedDate})
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. REKAPITULASI MENU PER TANGGAL SEKSI BARU WITH DELETE CONTROL */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-neutral-800 text-sm font-display flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-emerald-700" />
              Seksi Rekapitulasi Menu Makanan SPPG per Tanggal
            </h3>
            <p className="text-[11px] text-neutral-500 font-sans">
              Rangkuman menu sehat pesantren. Klik "Atur & Sunting" untuk memuat draf utama tanggal ke dasbor, atau hapus menu usang.
            </p>
          </div>
          <span className="text-[10px] bg-slate-100 text-slate-600 font-mono font-bold px-2.5 py-1 rounded-md">
            Total Hari Terbit: {allDayMenus.length}
          </span>
        </div>

        {allDayMenus.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-400">
            Tidak ada data rilis menu saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans text-neutral-700 border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  <th className="py-3 px-2">Tanggal Hidangan</th>
                  <th className="py-3 px-2">Rincian Menu Makanan Hari Tersebut</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {[...allDayMenus]
                  .sort((a, b) => b.date.localeCompare(a.date)) // Sort newest dates first
                  .map((menu) => {
                    const isActive = menu.date === selectedDate;
                    return (
                      <tr 
                        key={menu.date} 
                        className={`border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors ${
                          isActive ? 'bg-emerald-50/20 font-medium' : ''
                        }`}
                      >
                        <td className="py-3.5 px-2 font-display">
                          <span className="block font-bold text-neutral-800">
                            {formatIndoDate(menu.date)}
                          </span>
                          <span className="text-[9px] font-mono text-neutral-400">
                            ID/TGL: {menu.date}
                          </span>
                        </td>
                        <td className="py-3.5 px-2">
                          <div className="flex flex-wrap gap-1.5 max-w-xl">
                            {menu.menuList && menu.menuList.length > 0 ? (
                              menu.menuList.map((dish, i) => (
                                <span 
                                  key={i} 
                                  className="bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 text-[10px] px-2 py-0.5 rounded-md font-sans border border-neutral-200/40"
                                >
                                  {dish}
                                </span>
                              ))
                            ) : (
                              <span className="text-neutral-400 text-[11px] italic">Kosong & belum diinput</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-2 font-mono">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-600/10 text-emerald-850 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border border-emerald-500/20 animate-pulse">
                              <Check className="h-3 w-3 text-emerald-700" /> Aktif Diedit
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400">Tersimpan</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Delete Button - Allowed for Admin */}
                            {currentUserRole === UserRole.ADMIN && (
                              <button
                                type="button"
                                id={`btn-delete-menu-${menu.date}`}
                                onClick={() => onDeleteMenu(menu.date)}
                                className="p-1.5 text-neutral-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition-all border border-transparent hover:border-red-150 cursor-pointer"
                                title="Hapus Data Menu beserta SOP"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              id={`btn-select-menu-${menu.date}`}
                              onClick={() => {
                                onSelectDate(menu.date);
                                // Smooth scroll to top
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-emerald-850 text-white cursor-default shadow-xs'
                                  : 'bg-neutral-100 hover:bg-emerald-800 hover:text-white text-neutral-700 border border-neutral-200'
                              }`}
                            >
                              <span>Sunting</span>
                              <ChevronRight className="h-3 w-3 shrink-0" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
