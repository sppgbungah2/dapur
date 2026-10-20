import { useState, useEffect, useRef, useCallback } from 'react';
import { SOPDocument, Division, DayMenu, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { persistSop, serializeSopWrite } from '../lib/sopPersistence';
import {
  getSopTaskTableName, generateInitialSOPsForDate, normalizeMenuList,
  getSlugFromDivision, DIVISION_CREATOR_MAP, getCanonicalSopId, normalizeDateISO
} from '../presetData';

export function useSopData(selectedDate: string, fetchTasks = false) {
  const [dayMenus, setDayMenus] = useState<DayMenu[]>([]);
  const [sops, setSops] = useState<SOPDocument[]>([]);
  const [loadingSops, setLoadingSops] = useState(true);
  const [sopError, setSopError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const sopsRef = useRef(sops);
  sopsRef.current = sops;
  const requestRef = useRef(0);
  const writeCount = useRef(0);
  const writeRevision = useRef(0);
  const deletedIds = useRef(new Set<string>());

  const fetchSopsAndMenus = useCallback(async () => {
    const request = ++requestRef.current;
    const revision = writeRevision.current;
    if (!isSupabaseConfigured || !supabase) {
      setSopError('Supabase belum dikonfigurasi. SOP belum dapat dimuat atau disimpan.');
      setLoadingSops(false);
      return;
    }
    setLoadingSops(true);
    try {
      const month = normalizeDateISO(selectedDate).slice(0, 7);
      const startDate = `${month}-01`;
      const nextMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
      const [menus, documents] = await Promise.all([
        supabase.from('day_menus').select('*').gte('date', startDate).lt('date', nextMonth).order('date'),
        supabase.from('sops').select('*').gte('date', startDate).lt('date', nextMonth).order('date')
      ]);
      if (menus.error) throw menus.error;
      if (documents.error) throw documents.error;
      const rows = documents.data || [];
      // Read tasks for every returned SOP, including legacy IDs and dates in the same month.
      const tableRows = new Map<string, any[]>();
      const tables = [...new Set(rows.map(s => getSopTaskTableName(s.division)))];
      await Promise.all(tables.map(async table => {
        const candidates = rows.filter(s => getSopTaskTableName(s.division) === table);
        const ids = [...new Set(candidates.flatMap(s => [
          s.id, getCanonicalSopId(s.date, s.division),
          `SOP_${getSlugFromDivision(s.division)}_${normalizeDateISO(s.date)}`
        ]))];
        const result = await supabase.from(table).select('*').in('sop_id', ids).order('sort_order');
        if (result.error) throw result.error;
        tableRows.set(table, result.data || []);
      }));
      if (request !== requestRef.current || revision !== writeRevision.current || writeCount.current) return;
      const unique = new Map<string, SOPDocument>();
      for (const s of rows) {
        if (deletedIds.current.has(s.id)) continue;
        const date = normalizeDateISO(s.date);
        const candidates = [s.id, getCanonicalSopId(date, s.division), `SOP_${getSlugFromDivision(s.division)}_${date}`];
        const cloudTasks = tableRows.get(getSopTaskTableName(s.division)) || [];
        const taskOwner = candidates.find(id => cloudTasks.some(t => t.sop_id === id)) || s.id;
        const creator = DIVISION_CREATOR_MAP[s.division as Division];
        const formatted: SOPDocument = {
          id: s.id, date, division: s.division, creatorRole: s.creator_role || creator?.role || UserRole.ASLAP,
          creatorName: s.creator_name || '',
          tasks: cloudTasks.filter(t => t.sop_id === taskOwner).map(t => ({
            id: t.id, text: t.text || '', completed: !!t.completed, category: t.category || 'aktif', sort_order: t.sort_order
          })),
          tasksLoaded: true, adminEdited: !!s.admin_edited, isCheckedAll: !!s.is_checked_all,
          signerSupervisor: s.signer_supervisor || '', signatureSupervisorUrl: s.signature_supervisor_url || '',
          signedSupervisorAt: s.signed_supervisor_at || null,
          signerCoordinator: s.signer_coordinator || '', signatureCoordinatorUrl: s.signature_coordinator_url || '',
          signedCoordinatorAt: s.signed_coordinator_at || null,
          status: s.status === 'published' ? 'aktif' : s.status || 'draft',
          isLocked: !!s.is_locked, updatedAt: s.updated_at || ''
        };
        const key = `${date}__${s.division}`;
        const previous = unique.get(key);
        if (!previous || Date.parse(formatted.updatedAt) >= Date.parse(previous.updatedAt || '1970-01-01')) unique.set(key, formatted);
      }
      setDayMenus((menus.data || []).map(m => ({
        date: normalizeDateISO(m.date), menuList: normalizeMenuList(m.menu_list),
        createdAt: m.created_at, createdBy: m.created_by
      })));
      setSops(prev => [...prev.filter(s => !s.date.startsWith(month)), ...unique.values()]);
      setSopError(null);
    } catch (error: any) {
      if (request === requestRef.current) setSopError(`SOP gagal dimuat: ${error.message}. Data terakhir tetap dipertahankan; coba muat ulang.`);
    } finally {
      if (request === requestRef.current) setLoadingSops(false);
    }
  }, [selectedDate, fetchTasks]);

  useEffect(() => {
    void fetchSopsAndMenus();
    if (!supabase) return;
    const channel = supabase.channel(`sops_realtime_${selectedDate}`)
      .on('postgres_changes', { event: '*', schema: 'dapur_db', table: 'sops' }, () => void fetchSopsAndMenus())
      .on('postgres_changes', { event: '*', schema: 'dapur_db', table: 'day_menus' }, () => void fetchSopsAndMenus())
      .subscribe();
    return () => { ++requestRef.current; void supabase.removeChannel(channel); };
  }, [fetchSopsAndMenus, selectedDate]);

  const handleUpdateSOP = async (updatedSOP: SOPDocument, createOnly = false) => {
    ++writeCount.current;
    ++writeRevision.current;
    setSyncStatus('saving');
    try {
      const saved = await serializeSopWrite(updatedSOP.id, () => persistSop(supabase, updatedSOP, createOnly));
      const next = sopsRef.current.filter(s => !(s.date === saved.date && s.division === saved.division));
      sopsRef.current = [...next, saved];
      setSops(sopsRef.current);
      setSyncStatus('saved');
      return { success: true, sop: saved };
    } catch (error: any) {
      setSyncStatus('error');
      return { success: false, error: error.message || 'Gagal menyimpan SOP. Perubahan Anda tetap ada di editor.' };
    } finally {
      --writeCount.current;
      ++writeRevision.current;
    }
  };

  const handleSaveSopsToCloud = async (date = selectedDate, overrides?: SOPDocument[]) => {
    const documents = (overrides || sopsRef.current).filter(s => s.date === normalizeDateISO(date));
    if (!documents.length) return { success: false, message: 'Belum ada draft SOP. Generate template terlebih dahulu.' };
    for (const sop of documents) {
      const result = await handleUpdateSOP(sop);
      if (!result.success) return { success: false, message: result.error || 'Gagal menyimpan SOP.' };
    }
    return { success: true, message: 'SOP berhasil disimpan. Draft tetap draft sampai admin menerbitkan.' };
  };

  const handleGenerateSOPs = async (date = selectedDate, menuOverride?: string[]) => {
    try {
      if (!supabase || !isSupabaseConfigured) throw new Error('Supabase belum dikonfigurasi.');
      const targetDate = normalizeDateISO(date);
      const result = await supabase.from('sops').select('division').eq('date', targetDate);
      if (result.error) throw result.error;
      const existing = new Set((result.data || []).map(s => s.division));
      const menu = menuOverride || dayMenus.find(m => m.date === targetDate)?.menuList || [];
      const generated = generateInitialSOPsForDate(targetDate, menu) as SOPDocument[];
      for (const sop of generated.filter(s => !existing.has(s.division))) {
        const saved = await handleUpdateSOP(sop, true);
        if (!saved.success) throw new Error(saved.error);
      }
      await fetchSopsAndMenus();
      return { success: true, message: 'Draft SOP tersedia. Edit instruksi, simpan, lalu terbitkan tiap divisi. SOP yang sudah ada tetap dipertahankan.' };
    } catch (error: any) {
      setSopError(error.message);
      return { success: false, message: error.message };
    }
  };

  const handleDeleteSOP = async (id: string) => {
    ++writeCount.current;
    ++writeRevision.current;
    try {
      if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
      const sop = sopsRef.current.find(s => s.id === id);
      if (!sop) throw new Error('SOP tidak ditemukan.');
      await serializeSopWrite(id, async () => {
        const tasks = await supabase.from(getSopTaskTableName(sop.division)).delete().eq('sop_id', id);
        if (tasks.error) throw tasks.error;
        const document = await supabase.from('sops').delete().eq('id', id);
        if (document.error) throw document.error;
      });
      deletedIds.current.add(id);
      setSops(prev => prev.filter(s => s.id !== id));
      return { success: true, message: 'SOP berhasil dihapus.' };
    } catch (error: any) {
      return { success: false, message: error.message };
    } finally {
      --writeCount.current;
      ++writeRevision.current;
    }
  };

  return { sops, setSops, dayMenus, setDayMenus, loadingSops, sopError, syncStatus,
    fetchSopsAndMenus, handleUpdateSOP, handleSaveSopsToCloud, handleGenerateSOPs, handleDeleteSOP };
}
