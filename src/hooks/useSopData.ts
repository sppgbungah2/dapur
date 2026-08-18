import { useState, useEffect, useRef, useCallback } from 'react';
import { SOPDocument, Division, DayMenu, TaskItem, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  getSopTaskTableNames, 
  getSopTaskTableName,
  generateInitialSOPsForDate, 
  getDefaultTasksForDivision, 
  normalizeMenuList,
  getSlugFromDivision,
  DIVISION_CREATOR_MAP,
  getCanonicalSopId,
  normalizeDateISO
} from '../presetData';

const toIsoTimestampOrNull = (val?: string | null): string | null => {
  if (!val) return null;
  const parsed = Date.parse(val);
  if (!isNaN(parsed)) return new Date(parsed).toISOString();
  return null;
};

export function useSopData(selectedDate: string, fetchTasks: boolean = false) {
  const [dayMenus, setDayMenus] = useState<DayMenu[]>([]);
  const [sops, setSops] = useState<SOPDocument[]>([]);
  const [loadingSops, setLoadingSops] = useState<boolean>(true);
  const [sopError, setSopError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const deletedSopIdsRef = useRef<Set<string>>(new Set());
  const isUpdatingSopRef = useRef<boolean>(false);

  // (Removed LocalStorage fallbacks)

  // Fetch SOPs and Menus from Cloud Supabase (filtered by active selectedDate to minimize Egress)
  const fetchSopsAndMenus = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoadingSops(false);
      return;
    }

    const targetDate = normalizeDateISO(selectedDate);
    const targetMonth = targetDate.slice(0, 7);

    try {
      setLoadingSops(true);
      setSopError(null);

      let menuData: any[] | null = null;
      let sopData: any[] | null = null;

      try {
        const { data: mData, error: menuErr } = await supabase
          .from('day_menus')
          .select('*')
          .like('date', `${targetMonth}%`)
          .order('date', { ascending: true });
        if (!menuErr) menuData = mData;
      } catch (mE) {
        console.warn('Unable to query day_menus from Supabase, using local fallback:', mE);
      }

      try {
        const { data: sData, error: sopErr } = await supabase
          .from('sops')
          .select('*')
          .like('date', `${targetMonth}%`)
          .order('date', { ascending: true });
        if (!sopErr) sopData = sData;
      } catch (sE) {
        console.warn('Unable to query sops from Supabase, using local fallback:', sE);
      }

      const divisionTables = [
        'sop_tasks_driver',
        'sop_tasks_stocking',
        'sop_tasks_masak',
        'sop_tasks_pemorsian',
        'sop_tasks_kebersihan',
        'sop_tasks_cuci',
        'sop_tasks_keamanan'
      ];

      let taskFetchResults: { tbl: string; data: any[] }[] = [];
      if (fetchTasks) {
        try {
          taskFetchResults = await Promise.all(
            divisionTables.map(tbl =>
              supabase
                .from(tbl)
                .select('*')
                .like('sop_id', `%${targetDate}%`)
                .order('sort_order', { ascending: true })
                .then(res => ({ tbl, data: res.data || [] }), () => ({ tbl, data: [] }))
            )
          );
        } catch (tE) {
          console.warn('Unable to query division tasks from Supabase, using local fallback:', tE);
        }
      }

      const tableDataMap = new Map<string, any[]>();
      taskFetchResults.forEach(item => {
        tableDataMap.set(item.tbl, item.data);
      });

      if (menuData) {
        setDayMenus(menuData.map((m: any) => ({
          id: m.id,
          date: normalizeDateISO(m.date),
          dayName: m.day_name,
          menuList: normalizeMenuList(m.menu_list),
          portionCount: m.portion_count || 100
        })));
      }

      if (sopData && sopData.length > 0) {
        const formattedSOPs: SOPDocument[] = sopData.map((s: any) => {
          const isoDate = normalizeDateISO(s.date);
          const canonicalId = getCanonicalSopId(isoDate, s.division as Division);
          const divSlug = getSlugFromDivision(s.division as Division);
          const altId = `SOP_${divSlug}_${isoDate}`;

          const targetTables = getSopTaskTableNames(s.division as Division);
          let matchedCloudTasks: any[] = [];

          // Query candidate tables in order of specificity (sop_tasks_[div], sop_task_[div], sop_tasks)
          for (const tbl of targetTables) {
            const tblTasks = tableDataMap.get(tbl) || [];
            const matches = tblTasks.filter((t: any) => {
              if (!t.sop_id) return false;
              const cleanT = String(t.sop_id).trim();
              const cleanS = String(s.id).trim();
              const cleanCanon = String(canonicalId).trim();
              if (cleanT === cleanS || cleanT === cleanCanon || cleanT === altId) return true;

              const cleanTaskSopId = cleanT.toLowerCase();
              const normDate = isoDate.replace(/-/g, '');
              const hasDate = cleanTaskSopId.includes(isoDate) || cleanTaskSopId.includes(normDate);

              const normDiv = String(s.division || '').toLowerCase();
              const hasDivKeyword = normDiv.includes('driver') || normDiv.includes('distribusi') ? (cleanTaskSopId.includes('driver') || cleanTaskSopId.includes('distribusi')) :
                                    normDiv.includes('stocking') || normDiv.includes('persiapan') ? (cleanTaskSopId.includes('stocking') || cleanTaskSopId.includes('persiapan')) :
                                    normDiv.includes('masak') || normDiv.includes('pemasakan') ? (cleanTaskSopId.includes('masak') || cleanTaskSopId.includes('pemasakan')) :
                                    normDiv.includes('pemorsian') ? cleanTaskSopId.includes('pemorsian') :
                                    normDiv.includes('kebersihan') ? cleanTaskSopId.includes('kebersihan') :
                                    normDiv.includes('cuci') || normDiv.includes('pencucian') ? (cleanTaskSopId.includes('cuci') || cleanTaskSopId.includes('pencucian')) :
                                    normDiv.includes('keamanan') || normDiv.includes('security') ? (cleanTaskSopId.includes('keamanan') || cleanTaskSopId.includes('security')) : false;

              return hasDate && hasDivKeyword;
            });

            if (matches.length > 0) {
              matchedCloudTasks = matches;
              break;
            }
          }

          let mergedTasks: TaskItem[] = [];
          if (matchedCloudTasks.length > 0) {
            const taskMap = new Map<string, TaskItem>();
            matchedCloudTasks.forEach((ct: any) => {
              const key = ct.id || String(ct.text || '').trim().toLowerCase();
              if (!taskMap.has(key)) {
                taskMap.set(key, {
                  id: ct.id,
                  text: ct.text || '',
                  completed: !!ct.completed,
                  category: ct.category as 'persiapan' | 'aktif' | 'penutup',
                  sort_order: ct.sort_order ?? 0
                });
              }
            });
            mergedTasks = Array.from(taskMap.values()).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          } else {
            const matchedMenu = normalizeMenuList(menuData?.find((m: any) => normalizeDateISO(m.date) === isoDate)?.menu_list);
            mergedTasks = getDefaultTasksForDivision(s.division as Division, matchedMenu).map((t, idx) => ({
              ...t,
              id: `${canonicalId}-t-${idx}`,
              sort_order: idx
            }));
          }

          const creatorInfo = DIVISION_CREATOR_MAP[s.division as Division] || { role: UserRole.ASLAP, name: 'Aslap' };
          const creatorName = s.creator_name || (creatorInfo.role === UserRole.CHEF ? 'Rizka Aulia' : creatorInfo.role === UserRole.AHLI_GIZI ? 'Avianti Rahma Dianita' : 'Ahmad Maghfur');

          return {
            id: canonicalId,
            division: s.division as Division,
            date: isoDate,
            creatorRole: s.creator_role || creatorInfo.role,
            creatorName: creatorName,
            tasks: mergedTasks,
            isCheckedAll: !!s.is_checked_all,
            signerSupervisor: s.signer_supervisor || '',
            signatureSupervisorUrl: s.signature_supervisor_url || '',
            signedSupervisorAt: s.signed_supervisor_at || null,
            signerCoordinator: s.signer_coordinator || '',
            signatureCoordinatorUrl: s.signature_coordinator_url || '',
            signedCoordinatorAt: s.signed_coordinator_at || null,
            status: s.status || 'aktif',
            isLocked: !!s.is_locked,
            updatedAt: s.updated_at || new Date().toISOString()
          };
        });

        // Don't overwrite local state if saving is currently in progress
        if (!isUpdatingSopRef.current) {
          setSops(prev => {
            const mergedMap = new Map<string, SOPDocument>();

            formattedSOPs.forEach(s => {
              if (!deletedSopIdsRef.current.has(s.id)) {
                const key = `${s.date}__${getSlugFromDivision(s.division)}`;
                mergedMap.set(key, s);
              }
            });

            prev.forEach(ls => {
              if (deletedSopIdsRef.current.has(ls.id)) return;
              const key = `${normalizeDateISO(ls.date)}__${getSlugFromDivision(ls.division)}`;
              if (!mergedMap.has(key)) {
                mergedMap.set(key, ls);
              }
            });

            return Array.from(mergedMap.values());
          });
        }
      } else {
        // Fallback: Generate initial SOPs for this date if no records exist in cloud
        const fallbackMenu = normalizeMenuList(
          menuData?.find((m: any) => normalizeDateISO(m.date) === targetDate)?.menu_list
        );
        const initialSops = generateInitialSOPsForDate(targetDate, fallbackMenu);
        setSops(prev => {
          const otherDates = prev.filter(s => normalizeDateISO(s.date) !== targetDate);
          return [...otherDates, ...initialSops];
        });
      }
    } catch (err: any) {
      console.warn('Note on SOP fetch from Supabase (using local state fallback):', err?.message || err);
      setSopError(null);
    } finally {
      setLoadingSops(false);
    }
  }, [selectedDate, fetchTasks]);

  // Initial fetch and Event-based Supabase Realtime synchronization
  useEffect(() => {
    fetchSopsAndMenus();

    if (!isSupabaseConfigured || !supabase) return;

    // Realtime listener replacing continuous polling
    const channel = supabase
      .channel(`sops_realtime_${normalizeDateISO(selectedDate)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sops' }, () => {
        fetchSopsAndMenus();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_menus' }, () => {
        fetchSopsAndMenus();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Standard REST sync fallback active without repetitive log noise
          if (channel) {
            try {
              supabase.removeChannel(channel);
            } catch (e) {
              // ignore
            }
          }
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // ignore disconnect warning
      }
    };
  }, [fetchSopsAndMenus, selectedDate]);

  // Update single SOP
  const handleUpdateSOP = async (updatedSOP: SOPDocument) => {
    setSyncStatus('saving');
    isUpdatingSopRef.current = true;
    try {
      const isoDate = normalizeDateISO(updatedSOP.date);
      const divSlug = getSlugFromDivision(updatedSOP.division);
      const canonicalId = getCanonicalSopId(isoDate, updatedSOP.division);

      const normalizedSOP: SOPDocument = {
        ...updatedSOP,
        id: canonicalId,
        date: isoDate
      };

      setSops(prev => {
        const keyToUpdate = `${isoDate}__${divSlug}`;
        let matched = false;
        const next = prev.map(s => {
          const sIsoDate = normalizeDateISO(s.date);
          const sDivSlug = getSlugFromDivision(s.division);
          const key = `${sIsoDate}__${sDivSlug}`;
          if (s.id === updatedSOP.id || s.id === canonicalId || key === keyToUpdate) {
            matched = true;
            return normalizedSOP;
          }
          return s;
        });
        if (!matched) {
          next.push(normalizedSOP);
        }
        return next;
      });

      if (isSupabaseConfigured && supabase) {
        const creatorInfo = DIVISION_CREATOR_MAP[normalizedSOP.division as Division] || { role: UserRole.ASLAP, name: 'Aslap' };
        const creatorRole = normalizedSOP.creatorRole || creatorInfo.role;
        const creatorName = normalizedSOP.creatorName || (creatorInfo.role === UserRole.CHEF ? 'Rizka Aulia' : creatorInfo.role === UserRole.AHLI_GIZI ? 'Avianti Rahma Dianita' : 'Ahmad Maghfur');

        const sopPayload = {
          id: canonicalId,
          division: normalizedSOP.division,
          date: isoDate,
          creator_role: creatorRole,
          creator_name: creatorName,
          is_checked_all: !!normalizedSOP.isCheckedAll,
          signer_supervisor: normalizedSOP.signerSupervisor || '',
          signature_supervisor_url: normalizedSOP.signatureSupervisorUrl || '',
          signed_supervisor_at: toIsoTimestampOrNull(normalizedSOP.signedSupervisorAt),
          signer_coordinator: normalizedSOP.signerCoordinator || '',
          signature_coordinator_url: normalizedSOP.signatureCoordinatorUrl || '',
          signed_coordinator_at: toIsoTimestampOrNull(normalizedSOP.signedCoordinatorAt),
          status: normalizedSOP.status || 'aktif',
          updated_at: new Date().toISOString()
        };

        const { error: sopErr } = await supabase.from('sops').upsert(sopPayload);
        if (sopErr) throw sopErr;

        const targetTables = getSopTaskTableNames(normalizedSOP.division);
        const altSopId = `SOP_${divSlug}_${isoDate}`;

        const deleteSopIds = Array.from(new Set([
          updatedSOP.id,
          canonicalId,
          altSopId,
          `${isoDate}-${divSlug}`,
          `${isoDate}-${normalizedSOP.division}`
        ]));

        // Clean old records from division task tables
        for (const tbl of targetTables) {
          const { error: deleteError } = await supabase.from(tbl).delete().in('sop_id', deleteSopIds);
          if (deleteError) throw deleteError;
        }

        const tasksPayloadWithSId = normalizedSOP.tasks.map((t, idx) => ({
          id: t.id ? (t.id.includes('-t-') ? t.id : `${canonicalId}-t-${idx}`) : `${canonicalId}-t-${idx}`,
          sop_id: canonicalId,
          text: t.text || '',
          completed: !!t.completed,
          category: t.category || 'aktif',
          sort_order: t.sort_order ?? idx
        }));

        // Write tasks directly to division specific tables (sop_tasks_<divisi> and sop_task_<divisi>)
        if (tasksPayloadWithSId.length > 0) {
          let successCount = 0;
          let lastError = '';

          for (const tbl of targetTables) {
            try {
              const { error: taskErr } = await supabase.from(tbl).upsert(tasksPayloadWithSId);
              if (!taskErr) {
                successCount++;
              } else {
                console.warn(`Peringatan simpan ke ${tbl}:`, taskErr.message);
                lastError = taskErr.message;
              }
            } catch (e: any) {
              console.warn(`Exception saat simpan ke ${tbl}:`, e);
              lastError = e?.message || String(e);
            }
          }

          if (successCount === 0) {
            const errLower = lastError.toLowerCase();
            if (errLower.includes('permission denied') || errLower.includes('row-level security') || errLower.includes('rls') || errLower.includes('403')) {
              throw new Error(`Akses Ditolak (Permission Denied) pada tabel '${targetTables[0]}' di Supabase. Silakan buka menu Admin -> Skrip SQL Supabase, lalu jalankan skrip SQL terbaru di Supabase SQL Editor untuk memberikan GRANT permission & mematikan RLS.`);
            }
            throw new Error(`Gagal menyimpan tugas ke tabel divisi (${targetTables.join(', ')}): ${lastError}`);
          }
        }
      }

      setSyncStatus('saved');
      return { success: true };
    } catch (err: any) {
      console.warn('Error updating SOP:', err);
      setSyncStatus('error');
      return { success: false, error: err.message || 'Gagal menyimpan perubahan' };
    } finally {
      isUpdatingSopRef.current = false;
    }
  };

  // Explicit Save / Publish SOPs to Cloud
  const handleSaveSopsToCloud = async (targetDate?: string, sopsOverride?: SOPDocument[]) => {
    const rawDate = targetDate || selectedDate;
    const dateToSave = normalizeDateISO(rawDate);
    isUpdatingSopRef.current = true;
    try {
      setSyncStatus('saving');
      const sourceSops = sopsOverride || sops;
      let sopsToSave = sourceSops.filter(s => normalizeDateISO(s.date) === dateToSave && !deletedSopIdsRef.current.has(s.id));
      const dayMenuObj = dayMenus.find(m => normalizeDateISO(m.date) === dateToSave);
      const menuList = dayMenuObj?.menuList || [];

      if (sopsToSave.length === 0) {
        sopsToSave = generateInitialSOPsForDate(dateToSave, menuList);
        setSops(prev => {
          const map = new Map<string, SOPDocument>();
          prev.forEach(p => map.set(`${normalizeDateISO(p.date)}__${getSlugFromDivision(p.division)}`, p));
          sopsToSave.forEach(ns => map.set(`${normalizeDateISO(ns.date)}__${getSlugFromDivision(ns.division)}`, ns));
          return Array.from(map.values());
        });
      }

      if (isSupabaseConfigured && supabase) {
        for (const s of sopsToSave) {
          const isoDate = normalizeDateISO(s.date);
          const canonicalId = getCanonicalSopId(isoDate, s.division);
          const divSlug = getSlugFromDivision(s.division);

          const creatorInfo = DIVISION_CREATOR_MAP[s.division as Division] || { role: UserRole.ASLAP, name: 'Aslap' };
          const creatorRole = s.creatorRole || creatorInfo.role;
          const creatorName = s.creatorName || (creatorInfo.role === UserRole.CHEF ? 'Rizka Aulia' : creatorInfo.role === UserRole.AHLI_GIZI ? 'Avianti Rahma Dianita' : 'Ahmad Maghfur');

          const sopPayload = {
            id: canonicalId,
            division: s.division,
            date: isoDate,
            creator_role: creatorRole,
            creator_name: creatorName,
            is_checked_all: !!s.isCheckedAll,
            signer_supervisor: s.signerSupervisor || '',
            signature_supervisor_url: s.signatureSupervisorUrl || '',
            signed_supervisor_at: toIsoTimestampOrNull(s.signedSupervisorAt),
            signer_coordinator: s.signerCoordinator || '',
            signature_coordinator_url: s.signatureCoordinatorUrl || '',
            signed_coordinator_at: toIsoTimestampOrNull(s.signedCoordinatorAt),
            status: s.status || 'aktif',
            updated_at: new Date().toISOString()
          };

          const { error: sopError } = await supabase.from('sops').upsert(sopPayload);
          if (sopError) throw sopError;

          const targetTables = getSopTaskTableNames(s.division);
          const altSopId = `SOP_${divSlug}_${isoDate}`;

          const deleteSopIds = Array.from(new Set([
            s.id,
            canonicalId,
            altSopId,
            `${isoDate}-${divSlug}`,
            `${isoDate}-${s.division}`
          ]));

          const tasksToSave = (s.tasks && s.tasks.length > 0) 
            ? s.tasks 
            : getDefaultTasksForDivision(s.division, menuList);

          const tasksPayloadWithSId = tasksToSave.map((t, idx) => ({
            id: t.id ? (t.id.includes('-t-') ? t.id : `${canonicalId}-t-${idx}`) : `${canonicalId}-t-${idx}`,
            sop_id: canonicalId,
            text: t.text || '',
            completed: !!t.completed,
            category: t.category || 'aktif',
            sort_order: t.sort_order ?? idx
          }));

          // Clean up old tasks in target division tables
          for (const tbl of targetTables) {
            const { error: deleteError } = await supabase.from(tbl).delete().in('sop_id', deleteSopIds);
            if (deleteError) throw deleteError;
          }

          // Write tasks to division task tables (sop_tasks_<divisi> and sop_task_<divisi>)
          if (tasksPayloadWithSId.length > 0) {
            let successCount = 0;
            let lastError = '';

            for (const tbl of targetTables) {
              try {
                const { error: taskErr } = await supabase.from(tbl).upsert(tasksPayloadWithSId);
                if (!taskErr) {
                  successCount++;
                } else {
                  console.warn(`Peringatan simpan ke ${tbl}:`, taskErr.message);
                  lastError = taskErr.message;
                }
              } catch (e: any) {
                console.warn(`Exception saat simpan ke ${tbl}:`, e);
                lastError = e?.message || String(e);
              }
            }

            if (successCount === 0) {
              const errLower = lastError.toLowerCase();
              if (errLower.includes('permission denied') || errLower.includes('row-level security') || errLower.includes('rls') || errLower.includes('403')) {
                throw new Error(`Akses Ditolak (Permission Denied) pada tabel '${targetTables[0]}' di Supabase. Silakan buka menu Admin -> Skrip SQL Supabase, lalu jalankan skrip SQL terbaru di Supabase SQL Editor untuk memberikan GRANT permission & mematikan RLS.`);
              }
              throw new Error(`Gagal menyimpan tugas divisi ${s.division}: ${lastError}`);
            }
          }
        }
      }

      setSyncStatus('saved');
      return { 
        success: true, 
        message: `🎉 Berhasil! Seluruh ${sopsToSave.length} SOP tersimpan & tersinkronisasi 100% ke Cloud Supabase!` 
      };
    } catch (err: any) {
      console.warn('Error in handleSaveSopsToCloud:', err);
      setSyncStatus('error');
      return { success: false, message: `Gagal menyimpan ke Cloud: ${err.message}` };
    } finally {
      isUpdatingSopRef.current = false;
    }
  };

  // Generate SOPs template for date
  const handleGenerateSOPs = async (date?: string) => {
    const rawDate = date || selectedDate;
    const targetDate = normalizeDateISO(rawDate);
    const dayMenuObj = dayMenus.find(m => normalizeDateISO(m.date) === targetDate);
    const menuList = dayMenuObj?.menuList || [];
    const generated = generateInitialSOPsForDate(targetDate, menuList) as SOPDocument[];

    setSops(prev => {
      const existingOtherDates = prev.filter(p => normalizeDateISO(p.date) !== targetDate);
      const updatedSopsList = [...existingOtherDates, ...generated];
      return updatedSopsList;
    });

    await handleSaveSopsToCloud(targetDate, generated);
  };

  // Delete SOP
  const handleDeleteSOP = async (sopId: string) => {
    try {
      deletedSopIdsRef.current.add(sopId);
      setSops(prev => prev.filter(s => s.id !== sopId));

      if (isSupabaseConfigured && supabase) {
        const divisionTables = [
          'sop_tasks_driver',
          'sop_tasks_stocking',
          'sop_tasks_masak',
          'sop_tasks_pemorsian',
          'sop_tasks_kebersihan',
          'sop_tasks_cuci',
          'sop_tasks_keamanan'
        ];
        for (const tbl of divisionTables) {
          try {
            await supabase.from(tbl).delete().eq('sop_id', sopId);
          } catch (e) {}
        }
        await supabase.from('sops').delete().eq('id', sopId);
      }
      return { success: true, message: 'SOP berhasil dihapus' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Gagal menghapus SOP' };
    }
  };

  return {
    sops,
    setSops,
    dayMenus,
    setDayMenus,
    loadingSops,
    sopError,
    syncStatus,
    fetchSopsAndMenus,
    handleUpdateSOP,
    handleSaveSopsToCloud,
    handleGenerateSOPs,
    handleDeleteSOP
  };
}
