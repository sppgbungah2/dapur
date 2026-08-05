import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, asOperationalDate } from '../lib/supabase';
import { initializeOperationalDocuments } from '../lib/operationalLifecycle';
import { PortionConfig, DEFAULT_PORTIONS } from './PortionMasterView';
import { CheckCircle2, Save, FileText, Loader2, AlertCircle } from 'lucide-react';
import { updateExistingDocsWithPortions } from '../utils/generateDocs';
import { DayMenu } from '../types';

interface Props {
  selectedDate: string;
  onSuccess: (msg: string) => void;
  onGenerateSOPs: (date: string, menuList: string[]) => void;
  shippingDocs: any[];
  setShippingDocs: React.Dispatch<React.SetStateAction<any[]>>;
  allDayMenus: DayMenu[];
  onSaveMenu: (date: string, menuList: string[]) => void;
  onSavePortions?: (portions: PortionConfig) => void;
}

export default function PerencanaanMenuPorsi({
  selectedDate,
  onSuccess,
  onGenerateSOPs,
  shippingDocs,
  setShippingDocs,
  allDayMenus,
  onSaveMenu,
  onSavePortions
}: Props) {
  const [menuText, setMenuText] = useState('');
  const [portions, setPortions] = useState<PortionConfig>({ ...DEFAULT_PORTIONS });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const [initSOPStatus, setInitSOPStatus] = useState<'idle'|'loading'|'success'>('idle');
  const [initSJStatus, setInitSJStatus] = useState<'idle'|'loading'|'success'>('idle');
  const [initBASTStatus, setInitBASTStatus] = useState<'idle'|'loading'|'success'>('idle');
  const [initOrlepStatus, setInitOrlepStatus] = useState<'idle'|'loading'|'success'>('idle');
  const [initError, setInitError] = useState<string | null>(null);

  // Load Menu and Portions
  useEffect(() => {
    setIsSaved(false);

    // Load Menu
    const currentDayMenu = allDayMenus.find(m => m.date === selectedDate);
    if (currentDayMenu && currentDayMenu.menuList.length > 0) {
      setMenuText(currentDayMenu.menuList.join(', '));
      setIsSaved(true);
    } else {
      setMenuText('Nasi Putih, Lauk Utama, Sayur, Buah');
    }

    // Load Portions from DB
    const loadPortions = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.from('master_porsi').select('portions').eq('date', selectedDate).maybeSingle();
          if (data && data.portions) {
            setPortions(data.portions as PortionConfig);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to load portions from Supabase:', err);
      }
      setPortions({ ...DEFAULT_PORTIONS });
    };
    loadPortions();
  }, [selectedDate]); // ONLY depend on selectedDate so it doesn't revert while typing!

  // Check if docs already exist
  useEffect(() => {
    setInitSOPStatus('idle');
    setInitSJStatus('idle');
    setInitBASTStatus('idle');
    setInitOrlepStatus('idle');

    const hasSj = shippingDocs.some(d => d.type === 'surat_jalan' && d.date === selectedDate);
    if (hasSj) setInitSJStatus('success');
    
    const hasBast = shippingDocs.some(d => d.type === 'serah_terima' && d.date === selectedDate);
    if (hasBast) setInitBASTStatus('success');
    
    const hasOrlep = shippingDocs.some(d => d.type === 'organoleptik' && d.date === selectedDate);
    if (hasOrlep) setInitOrlepStatus('success');
  }, [selectedDate, shippingDocs]);

  // Source of truth for Step 2 is Supabase, not the local shipping-document cache.
  useEffect(() => {
    let alive = true;
    const syncInitiationStatus = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      const [sj, bast, orlep, sop] = await Promise.all([
        supabase.from('surat_jalan_docs').select('id', { count: 'exact', head: true }).eq('date', selectedDate),
        supabase.from('bast_docs').select('id', { count: 'exact', head: true }).eq('date', selectedDate),
        supabase.from('organoleptik_docs').select('id', { count: 'exact', head: true }).eq('date', selectedDate),
        supabase.from('sops').select('id', { count: 'exact', head: true }).eq('date', selectedDate)
      ]);
      if (!alive) return;
      if (sj.error || bast.error || orlep.error || sop.error) {
        setInitError(`Gagal menyinkronkan status inisiasi: ${(sj.error || bast.error || orlep.error || sop.error)?.message}`);
        return;
      }
      setInitSJStatus((sj.count || 0) > 0 ? 'success' : 'idle');
      setInitBASTStatus((bast.count || 0) > 0 ? 'success' : 'idle');
      setInitOrlepStatus((orlep.count || 0) > 0 ? 'success' : 'idle');
      setInitSOPStatus((sop.count || 0) > 0 ? 'success' : 'idle');
    };
    syncInitiationStatus();
    return () => { alive = false; };
  }, [selectedDate]);

  const handleSave = async () => {
    setIsSaving(true);
    const menuArr = menuText.split(',').map(m => m.trim()).filter(m => m !== '');
    
    // 1. Save Menu
    onSaveMenu(selectedDate, menuArr);

    // 2. Save Portions
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('master_porsi').upsert({
          date: selectedDate,
          portions: portions,
          created_at: new Date().toISOString(),
          created_by: 'admin@sppg.com'
        });
      } catch (err) {
        console.warn('Failed to save portions to Supabase:', err);
      }
    }

    // 3. Update existing Surat Jalan and BAST documents automatically
    if (shippingDocs.length > 0) {
      const updatedDocs = updateExistingDocsWithPortions(shippingDocs, selectedDate, portions);
      setShippingDocs(updatedDocs);
    }

    setIsSaving(false);
    setIsSaved(true);
    if (onSavePortions) {
      onSavePortions(portions);
    }
    onSuccess('Berhasil menyimpan Rencana Menu & PM serta memperbarui SJ/BAST di Database!');
  };

  const handleInitializeAll = async () => {
    setInitError(null);
    setInitSOPStatus('loading'); setInitSJStatus('loading'); setInitBASTStatus('loading'); setInitOrlepStatus('loading');
    const menuArr = menuText.split(',').map(m => m.trim()).filter(m => m !== '');
    try {
      const result = await initializeOperationalDocuments(asOperationalDate(selectedDate), menuArr, 'admin@sppg.com');
      setShippingDocs(prev => [...prev.filter(d => d.date !== selectedDate), ...result.docs.map(d => ({ ...d, status: 'draft', is_locked: false }))]);
      onGenerateSOPs(selectedDate, menuArr);
      setInitSOPStatus('success'); setInitSJStatus('success'); setInitBASTStatus('success'); setInitOrlepStatus('success');
      onSuccess('Semua draft berhasil tersimpan di Supabase.');
    } catch (err) {
      setInitError(`Inisiasi gagal: ${err instanceof Error ? err.message : String(err)}`);
      setInitSOPStatus('idle'); setInitSJStatus('idle'); setInitBASTStatus('idle'); setInitOrlepStatus('idle');
    }
  };

  const updatePortion = (loc: string, field: string, val: number) => {
    setPortions(prev => ({
      ...prev,
      [loc]: {
        ...(prev[loc as keyof PortionConfig] as any),
        [field]: val
      }
    }));
  };

  const totalPM = ((portions.MA?.siswa || 0) + (portions.MA?.guru || 0)) +
                  ((portions["MTS II"]?.siswa || 0) + (portions["MTS II"]?.guru || 0)) +
                  ((portions.SMK?.siswa || 0) + (portions.SMK?.guru || 0)) +
                  ((portions.SMA?.siswa || 0) + (portions.SMA?.guru || 0)) +
                  ((portions.Sukowati?.besar || 0) + (portions.Sukowati?.kecil || 0)) +
                  ((portions.Sidokumpul?.besar || 0) + (portions.Sidokumpul?.kecil || 0));

  return (
    <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-bold text-neutral-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" />
          Langkah 1: Perencanaan Menu & PM (Penerima Manfaat)
        </h2>
        <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full text-xs">
          Total: {totalPM} PM
        </span>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-neutral-600 mb-1">Menu Harian (pisahkan dengan koma)</label>
          <input 
            type="text" 
            value={menuText}
            onChange={e => setMenuText(e.target.value)}
            className="w-full text-sm p-3 border border-neutral-300 rounded-xl focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="text-xs font-bold block mb-2">MA Assa'adah</span>
            <div className="flex gap-2 text-xs">
              <label>Guru: <input type="number" className="w-12 border p-1 rounded" value={portions.MA.guru} onChange={e => updatePortion('MA', 'guru', parseInt(e.target.value)||0)}/></label>
              <label>Siswa: <input type="number" className="w-12 border p-1 rounded" value={portions.MA.siswa} onChange={e => updatePortion('MA', 'siswa', parseInt(e.target.value)||0)}/></label>
            </div>
          </div>
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="text-xs font-bold block mb-2">MTS Assa'adah II</span>
            <div className="flex gap-2 text-xs">
              <label>Guru: <input type="number" className="w-12 border p-1 rounded" value={portions['MTS II'].guru} onChange={e => updatePortion('MTS II', 'guru', parseInt(e.target.value)||0)}/></label>
              <label>Siswa: <input type="number" className="w-12 border p-1 rounded" value={portions['MTS II'].siswa} onChange={e => updatePortion('MTS II', 'siswa', parseInt(e.target.value)||0)}/></label>
            </div>
          </div>
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="text-xs font-bold block mb-2">SMA Assa'adah</span>
            <div className="flex gap-2 text-xs">
              <label>Guru: <input type="number" className="w-12 border p-1 rounded" value={portions.SMA.guru} onChange={e => updatePortion('SMA', 'guru', parseInt(e.target.value)||0)}/></label>
              <label>Siswa: <input type="number" className="w-12 border p-1 rounded" value={portions.SMA.siswa} onChange={e => updatePortion('SMA', 'siswa', parseInt(e.target.value)||0)}/></label>
            </div>
          </div>
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="text-xs font-bold block mb-2">SMK Assa'adah</span>
            <div className="flex gap-2 text-xs">
              <label>Guru: <input type="number" className="w-12 border p-1 rounded" value={portions.SMK.guru} onChange={e => updatePortion('SMK', 'guru', parseInt(e.target.value)||0)}/></label>
              <label>Siswa: <input type="number" className="w-12 border p-1 rounded" value={portions.SMK.siswa} onChange={e => updatePortion('SMK', 'siswa', parseInt(e.target.value)||0)}/></label>
            </div>
          </div>
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="text-xs font-bold block mb-2">Desa Sukowati</span>
            <div className="flex gap-2 text-xs">
              <label>Besar: <input type="number" className="w-12 border p-1 rounded" value={portions.Sukowati.besar} onChange={e => updatePortion('Sukowati', 'besar', parseInt(e.target.value)||0)}/></label>
              <label>Kecil: <input type="number" className="w-12 border p-1 rounded" value={portions.Sukowati.kecil} onChange={e => updatePortion('Sukowati', 'kecil', parseInt(e.target.value)||0)}/></label>
            </div>
          </div>
          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <span className="text-xs font-bold block mb-2">Desa Sidokumpul</span>
            <div className="flex gap-2 text-xs">
              <label>Besar: <input type="number" className="w-12 border p-1 rounded" value={portions.Sidokumpul.besar} onChange={e => updatePortion('Sidokumpul', 'besar', parseInt(e.target.value)||0)}/></label>
              <label>Kecil: <input type="number" className="w-12 border p-1 rounded" value={portions.Sidokumpul.kecil} onChange={e => updatePortion('Sidokumpul', 'kecil', parseInt(e.target.value)||0)}/></label>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Simpan Perencanaan Menu & PM ke Database
        </button>
      </div>

      {/* Step 2: Initialization */}
      {isSaved && (
        <div className="mt-8 pt-6 border-t border-neutral-200 animate-fade-in">
          <h2 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Langkah 2: Inisiasi Dokumen (Otomatis Generate ke Database)
          </h2>
          {initError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"><AlertCircle className="inline h-4 w-4 mr-1" />{initError}</div>}
          <button onClick={handleInitializeAll} disabled={initSOPStatus === 'loading' || initSOPStatus === 'success'} className="w-full mb-4 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-300 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
            {initSOPStatus === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
            {initSOPStatus === 'success' ? 'Sudah Diinisiasi di Database' : 'Inisiasi Surat-Surat ke Supabase'}
          </button>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <button
              onClick={handleInitializeAll}
              disabled={initSOPStatus === 'success' || initSOPStatus === 'loading'}
              className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 font-bold transition-all ${
                initSOPStatus === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 
                'bg-white border-neutral-200 hover:border-emerald-400 text-neutral-700'
              }`}
            >
              {initSOPStatus === 'loading' ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> :
               initSOPStatus === 'success' ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> :
               <FileText className="w-6 h-6 text-neutral-400" />}
              {initSOPStatus === 'success' ? 'Sukses Inisiasi SOP' : 'Inisiasi Dokumen SOP'}
            </button>

            <button
              onClick={handleInitializeAll}
              disabled={initSJStatus === 'success' || initSJStatus === 'loading'}
              className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 font-bold transition-all ${
                initSJStatus === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 
                'bg-white border-neutral-200 hover:border-emerald-400 text-neutral-700'
              }`}
            >
              {initSJStatus === 'loading' ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> :
               initSJStatus === 'success' ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> :
               <FileText className="w-6 h-6 text-neutral-400" />}
              {initSJStatus === 'success' ? 'Sukses Inisiasi SJ' : 'Inisiasi Surat Jalan'}
            </button>

            <button
              onClick={handleInitializeAll}
              disabled={initBASTStatus === 'success' || initBASTStatus === 'loading'}
              className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 font-bold transition-all ${
                initBASTStatus === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 
                'bg-white border-neutral-200 hover:border-emerald-400 text-neutral-700'
              }`}
            >
              {initBASTStatus === 'loading' ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> :
               initBASTStatus === 'success' ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> :
               <FileText className="w-6 h-6 text-neutral-400" />}
              {initBASTStatus === 'success' ? 'Sukses Inisiasi BAST' : 'Inisiasi BAST'}
            </button>

            <button
              onClick={handleInitializeAll}
              disabled={initOrlepStatus === 'success' || initOrlepStatus === 'loading'}
              className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 font-bold transition-all ${
                initOrlepStatus === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 
                'bg-white border-neutral-200 hover:border-emerald-400 text-neutral-700'
              }`}
            >
              {initOrlepStatus === 'loading' ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> :
               initOrlepStatus === 'success' ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> :
               <FileText className="w-6 h-6 text-neutral-400" />}
              {initOrlepStatus === 'success' ? 'Sukses Inisiasi Orlep' : 'Inisiasi Organoleptik'}
            </button>

          </div>
        </div>
      )}
    </div>
  );
}
