import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DayMenu } from '../types';
import { Save, Loader2, Utensils, Users, CheckCircle, AlertTriangle, Calendar, Layers } from 'lucide-react';
import { updateExistingDocsWithPortions } from '../utils/generateDocs';

export interface PortionConfig {
  MA?: { siswa: number; guru: number };
  "MTS II"?: { siswa: number; guru: number };
  SMK?: { siswa: number; guru: number };
  SMA?: { siswa: number; guru: number };
  Sukowati?: { besar: number; kecil: number };
  Sidokumpul?: { besar: number; kecil: number };
}

export const DEFAULT_PORTIONS: PortionConfig = {
  MA: { siswa: 0, guru: 0 },
  "MTS II": { siswa: 0, guru: 0 },
  SMK: { siswa: 0, guru: 0 },
  SMA: { siswa: 0, guru: 0 },
  Sukowati: { besar: 0, kecil: 0 },
  Sidokumpul: { besar: 0, kecil: 0 }
};

interface PortionMasterViewProps {
  selectedDate: string;
  allDayMenus?: DayMenu[];
  shippingDocs?: any[];
  setShippingDocs?: React.Dispatch<React.SetStateAction<any[]>>;
  onSelectDate?: (date: string) => void;
}

export interface MasterPortionItem {
  date: string;
  portions: PortionConfig;
  updated_at?: string;
}

export default function PortionMasterView({
  selectedDate,
  allDayMenus = [],
  shippingDocs = [],
  setShippingDocs,
  onSelectDate
}: PortionMasterViewProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [menuText, setMenuText] = useState('');
  const [portions, setPortions] = useState<PortionConfig>(DEFAULT_PORTIONS);
  const [allMasterPortions, setAllMasterPortions] = useState<MasterPortionItem[]>([]);

  useEffect(() => {
    fetchData();
    fetchAllMasterPortions();
  }, [selectedDate]);

  const fetchAllMasterPortions = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data } = await supabase
        .from('master_porsi')
        .select('*')
        .order('date', { ascending: true });
      if (data) {
        setAllMasterPortions(data as MasterPortionItem[]);
      }
    } catch (err) {
      console.warn("Could not fetch all master portions:", err);
    }
  };

  const fetchData = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setMessage({ type: 'error', text: 'Supabase belum dikonfigurasi!' });
      return;
    }
    setLoading(true);
    try {
      // Fetch Menu
      const { data: menuData } = await supabase
        .from('day_menus')
        .select('*')
        .eq('date', selectedDate)
        .maybeSingle();

      if (menuData && menuData.menu_list) {
        setMenuText(menuData.menu_list.join('\n'));
      } else {
        const foundLocal = allDayMenus.find(m => m.date === selectedDate);
        if (foundLocal) {
          setMenuText(foundLocal.menuList.join('\n'));
        } else {
          setMenuText('');
        }
      }

      // Fetch Portions
      const { data: porsiData } = await supabase
        .from('master_porsi')
        .select('portions')
        .eq('date', selectedDate)
        .maybeSingle();

      if (porsiData && porsiData.portions) {
        setPortions(porsiData.portions as PortionConfig);
      } else {
        setPortions(DEFAULT_PORTIONS);
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Gagal mengambil data dari server.' });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPM = (p: PortionConfig) => {
    if (!p) return 0;
    const ma = (p.MA?.guru || 0) + (p.MA?.siswa || 0);
    const mts = (p["MTS II"]?.guru || 0) + (p["MTS II"]?.siswa || 0);
    const smk = (p.SMK?.guru || 0) + (p.SMK?.siswa || 0);
    const sma = (p.SMA?.guru || 0) + (p.SMA?.siswa || 0);
    const suko = (p.Sukowati?.besar || 0) + (p.Sukowati?.kecil || 0);
    const sido = (p.Sidokumpul?.besar || 0) + (p.Sidokumpul?.kecil || 0);
    return ma + mts + smk + sma + suko + sido;
  };

  const handleSave = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setSaving(true);
    setMessage(null);
    try {
      const menuList = menuText.split('\n').map(m => m.trim()).filter(m => m !== '');
      
      // Upsert Menu
      if (menuList.length > 0) {
        await supabase.from('day_menus').upsert({
          date: selectedDate,
          menu_list: menuList,
          created_by: 'Admin',
          updated_at: new Date().toISOString()
        }, { onConflict: 'date' });
      } else {
        await supabase.from('day_menus').delete().eq('date', selectedDate);
      }

      // Upsert Portions
      await supabase.from('master_porsi').upsert({
        date: selectedDate,
        portions: portions,
        updated_at: new Date().toISOString()
      }, { onConflict: 'date' });

      // Automatically update Surat Jalan & BAST documents if they exist for selectedDate
      if (setShippingDocs && shippingDocs.length > 0) {
        const updatedDocs = updateExistingDocsWithPortions(shippingDocs, selectedDate, portions, menuList);
        setShippingDocs(updatedDocs);
      }

      setMessage({ type: 'success', text: `Berhasil menyimpan & memperbarui Surat Jalan/BAST untuk tanggal ${selectedDate}` });
      fetchAllMasterPortions();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat menyimpan data.' });
    } finally {
      setSaving(false);
    }
  };


  const handlePortionChange = (school: keyof PortionConfig, type: string, value: string) => {
    const num = parseInt(value) || 0;
    setPortions(prev => ({
      ...prev,
      [school]: {
        ...(prev[school] as any),
        [type]: num
      }
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
              <Utensils className="w-6 h-6 text-emerald-600" />
              Set Master Menu & Porsi (PM)
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Atur Menu Harian dan Jumlah Porsi (Siswa/Guru) untuk tanggal <strong>{selectedDate}</strong>
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 text-sm font-bold ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Menu Section */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200 h-full">
                <h3 className="font-bold text-neutral-800 mb-4 flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-neutral-400" />
                  Menu Harian
                </h3>
                <textarea
                  value={menuText}
                  onChange={e => setMenuText(e.target.value)}
                  placeholder="Ketik menu harian di sini... (satu menu per baris)"
                  className="w-full h-64 bg-white border border-neutral-300 rounded-xl p-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                />
                <p className="text-xs text-neutral-500 mt-3">
                  Pisahkan setiap menu dengan baris baru (Enter). Menu ini akan muncul di form Organoleptik dan Daftar Rekapitulasi.
                </p>
              </div>
            </div>

            {/* Portions Section */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200">
                <h3 className="font-bold text-neutral-800 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-neutral-400" />
                  Jumlah Porsi (Portion Master)
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* MA */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                    <h4 className="font-black text-sm text-neutral-800 mb-3 border-b pb-2">MA</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Siswa</label>
                        <input type="number" min="0" value={portions.MA?.siswa || 0} onChange={e => handlePortionChange('MA', 'siswa', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Guru</label>
                        <input type="number" min="0" value={portions.MA?.guru || 0} onChange={e => handlePortionChange('MA', 'guru', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                    </div>
                  </div>

                  {/* MTS II */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                    <h4 className="font-black text-sm text-neutral-800 mb-3 border-b pb-2">MTS II</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Siswa</label>
                        <input type="number" min="0" value={portions['MTS II']?.siswa || 0} onChange={e => handlePortionChange('MTS II', 'siswa', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Guru</label>
                        <input type="number" min="0" value={portions['MTS II']?.guru || 0} onChange={e => handlePortionChange('MTS II', 'guru', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                    </div>
                  </div>

                  {/* SMK */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                    <h4 className="font-black text-sm text-neutral-800 mb-3 border-b pb-2">SMK</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Siswa</label>
                        <input type="number" min="0" value={portions.SMK?.siswa || 0} onChange={e => handlePortionChange('SMK', 'siswa', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Guru</label>
                        <input type="number" min="0" value={portions.SMK?.guru || 0} onChange={e => handlePortionChange('SMK', 'guru', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                    </div>
                  </div>

                  {/* SMA */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                    <h4 className="font-black text-sm text-neutral-800 mb-3 border-b pb-2">SMA</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Siswa</label>
                        <input type="number" min="0" value={portions.SMA?.siswa || 0} onChange={e => handlePortionChange('SMA', 'siswa', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Guru</label>
                        <input type="number" min="0" value={portions.SMA?.guru || 0} onChange={e => handlePortionChange('SMA', 'guru', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                    </div>
                  </div>

                  {/* Sukowati */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                    <h4 className="font-black text-sm text-neutral-800 mb-3 border-b pb-2">Ompreng Sukowati</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Ompreng Besar</label>
                        <input type="number" min="0" value={portions.Sukowati?.besar || 0} onChange={e => handlePortionChange('Sukowati', 'besar', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Ompreng Kecil</label>
                        <input type="number" min="0" value={portions.Sukowati?.kecil || 0} onChange={e => handlePortionChange('Sukowati', 'kecil', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                    </div>
                  </div>

                  {/* Sidokumpul */}
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                    <h4 className="font-black text-sm text-neutral-800 mb-3 border-b pb-2">Ompreng Sidokumpul</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Ompreng Besar</label>
                        <input type="number" min="0" value={portions.Sidokumpul?.besar || 0} onChange={e => handlePortionChange('Sidokumpul', 'besar', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">Ompreng Kecil</label>
                        <input type="number" min="0" value={portions.Sidokumpul?.kecil || 0} onChange={e => handlePortionChange('Sidokumpul', 'kecil', e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold text-neutral-800 focus:outline-emerald-500" />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid Listing of Real Master Portions in Database */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-200 space-y-4">
        <div className="flex items-center justify-between border-b pb-3 border-neutral-100">
          <h3 className="font-bold text-neutral-800 text-xs uppercase tracking-wider font-mono flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            📚 DAFTAR MASTER PORSI (PM) SAAT INI DI DATABASE ({allMasterPortions.length} Hari Terbit)
          </h3>
        </div>

        {allMasterPortions.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 text-xs italic bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
            Belum ada rekam porsi tersimpan di cloud database. Simpan form di atas untuk menerbitkan porsi tanggal {selectedDate}.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {allMasterPortions.map((mpItem) => {
              const totalPm = calculateTotalPM(mpItem.portions);
              const isSelected = mpItem.date === selectedDate;
              return (
                <div
                  key={mpItem.date}
                  onClick={() => onSelectDate && onSelectDate(mpItem.date)}
                  className={`border p-4 rounded-2xl shadow-xs flex flex-col justify-between transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-emerald-50/50 border-emerald-600 ring-2 ring-emerald-500/20'
                      : 'bg-white border-neutral-200 hover:border-emerald-500 hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-neutral-900 font-mono">
                        📅 {mpItem.date}
                      </span>
                      {isSelected && (
                        <span className="text-[9px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full uppercase">
                          Aktif
                        </span>
                      )}
                    </div>

                    <div className="my-3 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wide block font-semibold">Total Porsi PM</span>
                      <span className="text-lg font-black text-emerald-700">{totalPm} <span className="text-xs font-bold text-neutral-600">Porsi</span></span>
                    </div>

                    <div className="space-y-1 text-[11px] text-neutral-600 font-sans">
                      <div className="flex justify-between"><span>MA:</span><strong className="text-neutral-800">{(mpItem.portions?.MA?.siswa||0)+(mpItem.portions?.MA?.guru||0)}</strong></div>
                      <div className="flex justify-between"><span>MTS II:</span><strong className="text-neutral-800">{(mpItem.portions?.['MTS II']?.siswa||0)+(mpItem.portions?.['MTS II']?.guru||0)}</strong></div>
                      <div className="flex justify-between"><span>SMK:</span><strong className="text-neutral-800">{(mpItem.portions?.SMK?.siswa||0)+(mpItem.portions?.SMK?.guru||0)}</strong></div>
                      <div className="flex justify-between"><span>SMA:</span><strong className="text-neutral-800">{(mpItem.portions?.SMA?.siswa||0)+(mpItem.portions?.SMA?.guru||0)}</strong></div>
                      <div className="flex justify-between"><span>Sukowati:</span><strong className="text-neutral-800">{(mpItem.portions?.Sukowati?.besar||0)+(mpItem.portions?.Sukowati?.kecil||0)}</strong></div>
                      <div className="flex justify-between"><span>Sidokumpul:</span><strong className="text-neutral-800">{(mpItem.portions?.Sidokumpul?.besar||0)+(mpItem.portions?.Sidokumpul?.kecil||0)}</strong></div>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-neutral-100 text-center">
                    <span className="text-[10px] font-bold text-emerald-700">
                      {isSelected ? '✓ Sedang Ditampilkan' : 'Pilih Tanggal Ini →'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
