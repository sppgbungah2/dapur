import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Save, CheckCircle2, AlertCircle, RefreshCw, 
  School, Home, Sparkles, BarChart2, Check, Trash2, Edit, Search, Plus, ArrowRight
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { safeLocalStorageSetItem, safeLocalStorageGetItem } from '../lib/storage';

interface PortionMasterViewProps {
  selectedDate: string;
}

export interface PortionConfig {
  MA: { guru: number; siswa: number };
  "MTS II": { guru: number; siswa: number };
  SMK: { guru: number; siswa: number };
  SMA: { guru: number; siswa: number };
  Sukowati: { besar: number; kecil: number };
  Sidokumpul: { besar: number; kecil: number };
}

export const DEFAULT_PORTIONS: PortionConfig = {
  MA: { guru: 48, siswa: 207 },
  "MTS II": { guru: 45, siswa: 518 },
  SMK: { guru: 55, siswa: 567 },
  SMA: { guru: 50, siswa: 861 },
  Sukowati: { besar: 80, kecil: 40 },
  Sidokumpul: { besar: 95, kecil: 45 }
};

export default function PortionMasterView({ selectedDate }: PortionMasterViewProps) {
  const [portions, setPortions] = useState<PortionConfig>({ ...DEFAULT_PORTIONS });
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mode selection state: 'harian' (current active app date) or 'selanjutnya' (future / custom date)
  const [mode, setMode] = useState<'harian' | 'selanjutnya'>('harian');
  const [activeDate, setActiveDate] = useState<string>(selectedDate);
  const [allSavedPortions, setAllSavedPortions] = useState<Array<{ date: string; portions: PortionConfig; origin: 'cloud' | 'local' }>>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Helpers to calculate tomorrow and lusa
  const getNextDateStr = (daysAhead: number) => {
    try {
      const base = new Date(selectedDate || '2026-07-17');
      base.setDate(base.getDate() + daysAhead);
      return base.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  // Synchronize activeDate when main app's selectedDate changes, only if we are in 'harian' mode
  useEffect(() => {
    if (mode === 'harian') {
      setActiveDate(selectedDate);
    }
  }, [selectedDate, mode]);

  // Load portions whenever the activeDate changes
  useEffect(() => {
    loadPortions();
  }, [activeDate]);

  // Initial load of all saved portions list
  useEffect(() => {
    loadAllPortions();
  }, [activeDate]);

  // Load portions for the specific active date with global template fallback
  const loadPortions = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('master_porsi')
          .select('*')
          .eq('date', activeDate)
          .maybeSingle();

        if (error) {
          console.warn("Could not load master_porsi from Supabase (using local cache):", error);
          loadFromLocal();
        } else if (data && data.portions) {
          setPortions(data.portions as PortionConfig);
        } else {
          // No record exists for this specific date, try master template in cloud
          const { data: tplData } = await supabase
            .from('master_porsi')
            .select('*')
            .eq('date', '1970-01-01')
            .maybeSingle();

          if (tplData && tplData.portions) {
            setPortions(tplData.portions as PortionConfig);
          } else {
            loadFromLocal();
          }
        }
      } else {
        loadFromLocal();
      }
    } catch (err: any) {
      console.warn("Could not retrieve loadPortions:", err);
      loadFromLocal();
    } finally {
      setLoading(false);
    }
  };

  const loadFromLocal = () => {
    const key = `sppg_portions_${activeDate}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setPortions(JSON.parse(saved));
        return;
      } catch (e) {
        console.error('Error parsing local portions:', e);
      }
    }

    // Try global master default template set by admin
    const globalDefault = localStorage.getItem('sppg_global_master_portions');
    if (globalDefault) {
      try {
        setPortions(JSON.parse(globalDefault));
        return;
      } catch (e) {
        console.error('Error parsing global master portions:', e);
      }
    }

    setPortions({ ...DEFAULT_PORTIONS });
  };

  // Load all portions saved in the database & local storage to render the deck cards list
  const loadAllPortions = async () => {
    let cloudList: Array<{ date: string; portions: PortionConfig; origin: 'cloud' }> = [];
    
    // 1. Fetch from cloud
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('master_porsi')
          .select('*')
          .order('date', { ascending: false });
        
        if (error) {
          console.warn("Could not load master_porsi list from cloud:", error);
        } else if (data) {
          cloudList = data.map((item: any) => ({
            date: item.date,
            portions: item.portions as PortionConfig,
            origin: 'cloud' as const
          }));
        }
      }
    } catch (err) {
      console.warn("Could not loadAllPortions from cloud:", err);
    }

    // 2. Fetch from localStorage keys
    const localList: Array<{ date: string; portions: PortionConfig; origin: 'local' }> = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sppg_portions_')) {
          const dateStr = key.replace('sppg_portions_', '');
          const savedStr = localStorage.getItem(key);
          if (savedStr) {
            const parsed = JSON.parse(savedStr);
            localList.push({
              date: dateStr,
              portions: parsed as PortionConfig,
              origin: 'local' as const
            });
          }
        }
      }
    } catch (e) {
      console.warn("Could not read local storage portions:", e);
    }

    // Merge list, cloud overrides/takes precedence over local cache duplicates
    const mergedMap = new Map<string, { date: string; portions: PortionConfig; origin: 'cloud' | 'local' }>();
    localList.forEach(item => {
      mergedMap.set(item.date, item);
    });
    cloudList.forEach(item => {
      mergedMap.set(item.date, item);
    });

    const sorted = Array.from(mergedMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    setAllSavedPortions(sorted);
  };

  const handleInputChange = (
    recipient: keyof PortionConfig,
    field: 'guru' | 'siswa' | 'besar' | 'kecil',
    value: string
  ) => {
    const num = parseInt(value) || 0;
    setPortions(prev => {
      const updatedRecipient = { ...prev[recipient] } as any;
      updatedRecipient[field] = num;
      return {
        ...prev,
        [recipient]: updatedRecipient
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    // Save to local storage cache for active date AND as global master template
    const key = `sppg_portions_${activeDate}`;
    safeLocalStorageSetItem(key, JSON.stringify(portions));
    safeLocalStorageSetItem('sppg_global_master_portions', JSON.stringify(portions));

    try {
      if (isSupabaseConfigured && supabase) {
        const payload = {
          date: activeDate,
          portions: portions,
          created_by: 'admin@qomaruddin.com',
          created_at: new Date().toISOString()
        };

        const templatePayload = {
          date: '1970-01-01',
          portions: portions,
          created_by: 'admin@qomaruddin.com',
          created_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('master_porsi')
          .upsert([payload, templatePayload]);

        if (error) {
          throw error;
        }
        
        // Fire storage or window event to let other open views sync
        window.dispatchEvent(new Event('portionsUpdated'));

        setSuccessMsg(`Berhasil menyimpan & menetapkan master porsi permanen untuk tanggal ${activeDate} dan seluruh hari mendatang!`);
      } else {
        window.dispatchEvent(new Event('portionsUpdated'));
        setSuccessMsg(`Berhasil menyimpan & menetapkan master porsi permanen secara lokal (Offline mode).`);
      }
      
      // Reload both list and current selection
      await loadAllPortions();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.warn("Could not save master_porsi to Supabase:", err);
      setErrorMsg("Gagal menyimpan ke cloud: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePortion = async (dateToDelete: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus konfigurasi porsi untuk tanggal ${dateToDelete}?`)) {
      return;
    }

    try {
      localStorage.removeItem(`sppg_portions_${dateToDelete}`);

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('master_porsi')
          .delete()
          .eq('date', dateToDelete);

        if (error) throw error;
      }

      setSuccessMsg(`Data porsi untuk tanggal ${dateToDelete} berhasil dihapus.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      
      // Sync list
      await loadAllPortions();
      
      // If deleted activeDate, refresh it
      if (activeDate === dateToDelete) {
        loadPortions();
      }
    } catch (err: any) {
      console.warn("Could not delete portion:", err);
      setErrorMsg("Gagal menghapus data: " + (err.message || err));
    }
  };

  const handleLoadSavedToForm = (dateStr: string) => {
    setMode('selanjutnya');
    setActiveDate(dateStr);
    
    // Scroll smoothly to form
    const elem = document.getElementById('master-portions-form-container');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Helper calculation values for visualization
  const getSchoolTotal = (school: 'MA' | 'MTS II' | 'SMK' | 'SMA') => {
    return (portions[school]?.guru || 0) + (portions[school]?.siswa || 0);
  };

  const getVillageTotal = (village: 'Sukowati' | 'Sidokumpul') => {
    return (portions[village]?.besar || 0) + (portions[village]?.kecil || 0);
  };

  const getOverallTotal = () => {
    return (
      getSchoolTotal('MA') +
      getSchoolTotal('MTS II') +
      getSchoolTotal('SMK') +
      getSchoolTotal('SMA') +
      getVillageTotal('Sukowati') +
      getVillageTotal('Sidokumpul')
    );
  };

  const getSchoolGrandTotal = () => {
    return getSchoolTotal('MA') + getSchoolTotal('MTS II') + getSchoolTotal('SMK') + getSchoolTotal('SMA');
  };

  const getVillageGrandTotal = () => {
    return getVillageTotal('Sukowati') + getVillageTotal('Sidokumpul');
  };

  const formattedDate = (dateStr: string = activeDate) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Format full date label in Indonesian for cards
  const formatIndonesianDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      
      const dayName = weekdays[date.getDay()];
      const day = date.getDate();
      const monthName = months[date.getMonth()];
      const year = date.getFullYear();
      
      return `${dayName}, ${day} ${monthName} ${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Filter saved list based on query
  const filteredSavedPortions = allSavedPortions.filter(item => {
    const dStr = item.date.toLowerCase();
    const friendlyStr = formatIndonesianDate(item.date).toLowerCase();
    return dStr.includes(searchQuery.toLowerCase()) || friendlyStr.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-fade-in" id="master-portions-panel">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold font-sans text-neutral-900 flex items-center gap-2 tracking-tight">
              <Users className="h-6 w-6 text-emerald-800 shrink-0" />
              Master Database Jumlah Porsi Harian
            </h2>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
              Sistem Otomatisasi
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            Mengatur jumlah porsi siswa/guru dan warga desa untuk mengisi otomatis Surat Jalan &amp; BAST secara sinkron.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadPortions();
              loadAllPortions();
            }}
            disabled={loading}
            className="p-2 border border-neutral-200 rounded-xl bg-white text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-800 hover:bg-emerald-950 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-transform active:scale-[0.98] flex items-center gap-1.5"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : `Simpan Porsi (${formattedDate()})`}
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          {errorMsg}
        </div>
      )}

      {/* 2. DATE SELECTOR MODE OPTION */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-150 shadow-3xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-xs text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-emerald-800" />
              Pilihan Pengaturan Target Tanggal
            </h3>
            <p className="text-xs text-neutral-500">Tentukan apakah Anda ingin mengatur porsi hari ini atau mempersiapkan tanggal berikutnya.</p>
          </div>
          
          {/* Segmented Controls */}
          <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200 w-fit">
            <button
              onClick={() => {
                setMode('harian');
                setActiveDate(selectedDate);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'harian' 
                  ? 'bg-white text-emerald-800 shadow-3xs' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Set Porsi Harian ({selectedDate})
            </button>
            <button
              onClick={() => setMode('selanjutnya')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'selanjutnya' 
                  ? 'bg-white text-emerald-800 shadow-3xs' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Pilih Tanggal Selanjutnya
            </button>
          </div>
        </div>

        {/* Dynamic Panel depending on state */}
        {mode === 'harian' ? (
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black text-emerald-800 block uppercase tracking-wider mb-0.5">TERINTEGRASI HARI INI</span>
              <span className="text-xs font-semibold text-neutral-700">
                Porsi diatur untuk tanggal aktif utama: <strong className="font-mono text-emerald-900 bg-white border border-emerald-200 px-2 py-0.5 rounded ml-1">{formatIndonesianDate(selectedDate)}</strong>
              </span>
            </div>
            <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg">SYNCED</span>
          </div>
        ) : (
          <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-100/60 space-y-3">
            <span className="text-[10px] font-black text-amber-800 block uppercase tracking-wider">PILIH TANGGAL SELANJUTNYA</span>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const tom = getNextDateStr(1);
                  if (tom) setActiveDate(tom);
                }}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeDate === getNextDateStr(1)
                    ? 'bg-amber-800 border-amber-800 text-white shadow-3xs'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                Besok ({formattedDate(getNextDateStr(1))})
              </button>

              <button
                type="button"
                onClick={() => {
                  const lusa = getNextDateStr(2);
                  if (lusa) setActiveDate(lusa);
                }}
                className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeDate === getNextDateStr(2)
                    ? 'bg-amber-800 border-amber-800 text-white shadow-3xs'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                Lusa ({formattedDate(getNextDateStr(2))})
              </button>

              <div className="flex items-center gap-2 pl-2">
                <span className="text-xs text-neutral-500 font-medium">Kalender khusus:</span>
                <input
                  type="date"
                  value={activeDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setActiveDate(e.target.value);
                    }
                  }}
                  className="bg-white border border-neutral-200 text-xs font-bold font-mono text-neutral-700 px-3 py-1.5 rounded-lg focus:ring-1 focus:ring-amber-700 focus:border-amber-700 outline-hidden"
                />
              </div>
            </div>

            <p className="text-[10px] text-neutral-500 italic">
              * Perubahan pada tanggal esok atau selanjutnya akan tersimpan di cloud database sehingga ketika tanggal tersebut aktif, porsi akan otomatis sinkron.
            </p>
          </div>
        )}
      </div>

      {/* 3. Visual Distribution Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-150 shadow-3xs flex flex-col justify-between">
          <span className="text-neutral-400 font-bold text-[10px] block uppercase tracking-wider">Total Porsi Harian</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-neutral-900">{getOverallTotal()}</span>
            <span className="text-xs text-neutral-500 font-medium">Porsi / Box</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-bold block mt-1">✓ Terdistribusi di 6 lokasi</span>
        </div>

        <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-100 flex flex-col justify-between">
          <span className="text-emerald-800 font-extrabold text-[10px] block uppercase tracking-wider">Sektor Lembaga Sekolah</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-emerald-900">{getSchoolGrandTotal()}</span>
            <span className="text-xs text-emerald-700 font-medium">Box</span>
          </div>
          <span className="text-[10px] text-neutral-400 block mt-1">MA, MTS II, SMK, SMA</span>
        </div>

        <div className="bg-amber-50/45 p-5 rounded-2xl border border-amber-100 flex flex-col justify-between">
          <span className="text-amber-800 font-extrabold text-[10px] block uppercase tracking-wider">Sektor Penerima Desa</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-amber-900">{getVillageGrandTotal()}</span>
            <span className="text-xs text-amber-700 font-medium">Box</span>
          </div>
          <span className="text-[10px] text-neutral-400 block mt-1">Sukowati &amp; Sidokumpul</span>
        </div>

        <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200/80 flex flex-col justify-between">
          <span className="text-neutral-500 font-bold text-[10px] block uppercase tracking-wider">Tanggal Berlaku</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-neutral-800 font-mono">{formattedDate(activeDate)}</span>
          </div>
          <span className="text-[9px] text-neutral-400 block mt-1">Sesuai setelan target porsi aktif</span>
        </div>
      </div>

      {/* 4. Core Inputs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="master-portions-form-container">
        
        {/* Sektor Lembaga Sekolah */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-150 shadow-3xs space-y-6">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-800">
              <School className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-neutral-900">Porsi Lembaga Sekolah ({formattedDate(activeDate)})</h3>
              <p className="text-[11px] text-neutral-500">Masing-masing memiliki 2 klasifikasi porsi: Guru dan Siswa.</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* MA */}
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-neutral-800">MA Assa'adah</span>
                <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-neutral-200 text-neutral-600">
                  Total: {getSchoolTotal('MA')} Box
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Guru</label>
                  <input
                    type="number"
                    min="0"
                    value={portions.MA?.guru ?? 0}
                    onChange={e => handleInputChange('MA', 'guru', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Siswa</label>
                  <input
                    type="number"
                    min="0"
                    value={portions.MA?.siswa ?? 0}
                    onChange={e => handleInputChange('MA', 'siswa', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* MTS II */}
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-neutral-800">MTS Assa'adah II</span>
                <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-neutral-200 text-neutral-600">
                  Total: {getSchoolTotal('MTS II')} Box
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Guru</label>
                  <input
                    type="number"
                    min="0"
                    value={portions["MTS II"]?.guru ?? 0}
                    onChange={e => handleInputChange('MTS II', 'guru', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Siswa</label>
                  <input
                    type="number"
                    min="0"
                    value={portions["MTS II"]?.siswa ?? 0}
                    onChange={e => handleInputChange('MTS II', 'siswa', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* SMK */}
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-neutral-800">SMK Assa'adah</span>
                <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-neutral-200 text-neutral-600">
                  Total: {getSchoolTotal('SMK')} Box
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Guru</label>
                  <input
                    type="number"
                    min="0"
                    value={portions.SMK?.guru ?? 0}
                    onChange={e => handleInputChange('SMK', 'guru', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Siswa</label>
                  <input
                    type="number"
                    min="0"
                    value={portions.SMK?.siswa ?? 0}
                    onChange={e => handleInputChange('SMK', 'siswa', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* SMA */}
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-neutral-800">SMA Assa'adah</span>
                <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-neutral-200 text-neutral-600">
                  Total: {getSchoolTotal('SMA')} Box
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Guru</label>
                  <input
                    type="number"
                    min="0"
                    value={portions.SMA?.guru ?? 0}
                    onChange={e => handleInputChange('SMA', 'guru', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Siswa</label>
                  <input
                    type="number"
                    min="0"
                    value={portions.SMA?.siswa ?? 0}
                    onChange={e => handleInputChange('SMA', 'siswa', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Sektor Penerima Desa */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-150 shadow-3xs space-y-6">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-800">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-neutral-900">Porsi Warga Desa Sasaran ({formattedDate(activeDate)})</h3>
              <p className="text-[11px] text-neutral-500">Masing-masing memiliki 2 klasifikasi porsi: Porsi Besar dan Porsi Kecil.</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Sukowati */}
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-neutral-800">Desa Sukowati</span>
                <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-neutral-200 text-neutral-600">
                  Total: {getVillageTotal('Sukowati')} Box
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Besar</label>
                  <input
                    type="number"
                    min="0"
                    value={portions.Sukowati?.besar ?? 0}
                    onChange={e => handleInputChange('Sukowati', 'besar', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Kecil</label>
                  <input
                    type="number"
                    min="0"
                    value={portions.Sukowati?.kecil ?? 0}
                    onChange={e => handleInputChange('Sukowati', 'kecil', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Sidokumpul */}
            <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-neutral-800">Desa Sidokumpul</span>
                <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-neutral-200 text-neutral-600">
                  Total: {getVillageTotal('Sidokumpul')} Box
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Besar</label>
                  <input
                    type="number"
                    min="0"
                    value={portions.Sidokumpul?.besar ?? 0}
                    onChange={e => handleInputChange('Sidokumpul', 'besar', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Porsi Kecil</label>
                  <input
                    type="number"
                    min="0"
                    value={portions.Sidokumpul?.kecil ?? 0}
                    onChange={e => handleInputChange('Sidokumpul', 'kecil', e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-neutral-200 rounded-lg p-2.5 bg-white shadow-3xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* 5. CARDS DECK: DAFTAR PORSI (NEW REQUIREMENT) */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-150 shadow-3xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-emerald-800" />
              Daftar Rekapitulasi Porsi yang Terdaftar
            </h3>
            <p className="text-xs text-neutral-500">
              Menampilkan seluruh konfigurasi porsi yang telah disimpan baik di cloud maupun cache lokal untuk berbagai tanggal.
            </p>
          </div>

          {/* Search bar input */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Cari tanggal (Contoh: 2026-07)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-250 rounded-xl focus:bg-white focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 outline-hidden"
            />
          </div>
        </div>

        {filteredSavedPortions.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50">
            <Calendar className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-neutral-500">Tidak ada konfigurasi porsi yang ditemukan.</p>
            <p className="text-[10px] text-neutral-400 mt-1">Silakan simpan konfigurasi di atas untuk membuat porsi baru.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSavedPortions.map((item) => {
              const p = item.portions;
              const schoolSum = 
                ((p.MA?.siswa || 0) + (p.MA?.guru || 0)) + 
                ((p["MTS II"]?.siswa || 0) + (p["MTS II"]?.guru || 0)) +
                ((p.SMK?.siswa || 0) + (p.SMK?.guru || 0)) +
                ((p.SMA?.siswa || 0) + (p.SMA?.guru || 0));
              const villageSum = 
                ((p.Sukowati?.besar || 0) + (p.Sukowati?.kecil || 0)) +
                ((p.Sidokumpul?.besar || 0) + (p.Sidokumpul?.kecil || 0));
              const grandSum = schoolSum + villageSum;
              const isActive = item.date === activeDate;

              return (
                <div 
                  key={item.date} 
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 shadow-3xs ${
                    isActive 
                      ? 'border-emerald-700 bg-emerald-50/20 ring-1 ring-emerald-700' 
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-neutral-400 tracking-wider">
                        {item.date}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {item.origin === 'cloud' ? (
                          <span className="text-[8px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-250 px-1.5 py-0.5 rounded uppercase">
                            Cloud
                          </span>
                        ) : (
                          <span className="text-[8px] font-extrabold bg-blue-100 text-blue-800 border border-blue-250 px-1.5 py-0.5 rounded uppercase">
                            Local Cache
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[8px] font-extrabold bg-amber-100 text-amber-800 border border-amber-250 px-1.5 py-0.5 rounded uppercase">
                            Aktif
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="font-extrabold text-xs text-neutral-800 font-sans">
                      {formatIndonesianDate(item.date)}
                    </h4>

                    {/* Quick Stats list */}
                    <div className="pt-2 border-t border-neutral-100/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500 text-[11px] font-medium">Sektor Sekolah:</span>
                        <span className="text-neutral-800 text-[11px] font-bold font-mono">{schoolSum} Box</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500 text-[11px] font-medium">Sektor Penerima Desa:</span>
                        <span className="text-neutral-800 text-[11px] font-bold font-mono">{villageSum} Box</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-dashed border-neutral-150">
                        <span className="text-neutral-900 text-[11px] font-extrabold">Total Akumulasi:</span>
                        <span className="text-emerald-800 text-[11px] font-black font-mono">{grandSum} Box</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100/80">
                    <button
                      type="button"
                      onClick={() => handleLoadSavedToForm(item.date)}
                      className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-50 transition-colors cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Gunakan / Edit
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleDeletePortion(item.date)}
                      className="text-[10px] font-bold text-red-600 hover:text-red-800 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Synced Integration Notes */}
      <div className="bg-neutral-900 text-neutral-200 p-6 rounded-2xl border border-neutral-850 space-y-3">
        <h4 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          Koneksi Integrasi Otomatis (Real-Time)
        </h4>
        <p className="text-xs leading-relaxed text-neutral-400">
          Setiap perubahan porsi di atas yang disimpan akan digunakan secara instan pada saat pembuatan atau inisialisasi dokumen:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
          <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 space-y-1">
            <span className="font-extrabold text-emerald-400">📄 Berita Acara Serah Terima (BAST)</span>
            <p className="text-neutral-400 text-[11px]">
              Kuantitas boks makan harian otomatis mengambil total (Guru + Siswa atau Besar + Kecil) dari master data di atas sesuai tanggal.
            </p>
          </div>
          <div className="bg-neutral-850 p-4 rounded-xl border border-neutral-800 space-y-1">
            <span className="font-extrabold text-emerald-400">🚚 Surat Jalan Logistik</span>
            <p className="text-neutral-400 text-[11px]">
              Tabel rincian barang otomatis menyesuaikan jumlah kuantitas paket gizi, buah potong, dan susu UHT berdasarkan angka porsi di atas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
