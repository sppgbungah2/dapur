import React, { useState, useEffect, useRef } from 'react';
import { 
  ClipboardList, Package, Wrench, ShieldCheck, ShoppingCart, Truck, 
  Camera, Users, Calendar, FileText, CheckCircle2, Flame, RefreshCcw, 
  HelpCircle, ChevronRight, UserCircle, Bell, ArrowRight, ShieldAlert,
  Menu, Info, Eye, Trash2, ClipboardCheck, LayoutDashboard
} from 'lucide-react';
import { Division, UserRole, DayMenu, SOPDocument } from './types';
import { PRESET_MENUS, DIVISION_CREATOR_MAP, generateInitialSOPsForDate, getDefaultTasksForDivision } from './presetData';
import SOPCreator from './components/SOPCreator';
import SOPChecklistView from './components/SOPChecklistView';
import SOPRecap from './components/SOPRecap';
import MockModules from './components/MockModules';
import Login from './components/Login';
import { isSupabaseConfigured, supabase, mapUserToProfile, UserProfile } from './lib/supabase';
import { safeLocalStorageSetItem, safeLocalStorageGetItem } from './lib/storage';
import { useRouting } from './hooks/useRouting';
import { useSopData } from './hooks/useSopData';

export default function App() {
  // User Authentication State
  const [loggedInUser, setLoggedInUser] = useState<UserProfile | null>(null);

  // Custom Hooks for Routing & SOP Data
  const { 
    activeTab, 
    setActiveTab, 
    selectedDate, 
    setSelectedDate, 
    activeSopDetail, 
    setActiveSopDetail 
  } = useRouting(loggedInUser);

  const {
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
  } = useSopData(selectedDate);

  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(UserRole.ADMIN);
  const [currentUsername, setCurrentUsername] = useState<string>('Sistem Administrator');
  
  // Inner SOP Sub-Tab selection
  const [currentSubTab, setCurrentSubTab] = useState<'dashboard' | 'create' | 'recap'>('dashboard');
  
  // Mobile navigation drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Utility functions for Slug Parsing and Formatting (e.g. 27-7-2026 <-> 2026-07-27)
  const parseDateFromSlug = (slug: string): string | null => {
    if (!slug) return null;
    const s = slug.trim();
    // YYYY-MM-DD or YYYY-M-D
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = isoMatch[2].padStart(2, '0');
      const d = isoMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // DD-MM-YYYY or D-M-YYYY
    const idMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (idMatch) {
      const d = idMatch[1].padStart(2, '0');
      const m = idMatch[2].padStart(2, '0');
      const y = idMatch[3];
      return `${y}-${m}-${d}`;
    }
    return null;
  };

  const formatDateToSlug = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const y = parts[0];
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      return `${d}-${m}-${y}`; // Output example: 27-7-2026
    }
    return dateStr;
  };

  const getTabFromPage = (pageName: string): number => {
    const norm = pageName.toLowerCase().trim();
    if (norm === 'dashboard-admin' || norm === 'dashboard') return 23;
    if (norm === 'sop') return 15;
    if (norm === 'keluhan') return 14;
    if (norm === 'order-alat' || norm === 'order_alat') return 4;
    if (norm === 'order-operasional' || norm === 'order_operasional') return 5;
    if (norm === 'pengiriman-ompreng') return 18;
    if (norm === 'serah-terima' || norm === 'bast') return 19;
    if (norm === 'surat-jalan' || norm === 'sj') return 20;
    if (norm === 'organoleptik') return 21;
    if (norm === 'master-porsi' || norm === 'master_porsi') return 22;
    return 23; // default to Dashboard Admin
  };

  const getPageFromTab = (tabNum: number): string => {
    if (tabNum === 23) return 'dashboard-admin';
    if (tabNum === 15) return 'sop';
    if (tabNum === 14) return 'keluhan';
    if (tabNum === 4) return 'order-alat';
    if (tabNum === 5) return 'order-operasional';
    if (tabNum === 18) return 'pengiriman-ompreng';
    if (tabNum === 19) return 'serah-terima';
    if (tabNum === 20) return 'surat-jalan';
    if (tabNum === 21) return 'organoleptik';
    if (tabNum === 22) return 'master-porsi';
    return '';
  };

  const getDivisionFromSlug = (slug: string): Division | null => {
    const norm = slug.toLowerCase().trim();
    if (norm === 'driver') return Division.DRIVER;
    if (norm === 'persiapan' || norm === 'stocking') return Division.STOCKING;
    if (norm === 'pemasakan' || norm === 'masak') return Division.MASAK;
    if (norm === 'pemorsian') return Division.PEMORSIAN;
    if (norm === 'distribusi') return Division.DRIVER;
    if (norm === 'kebersihan') return Division.KEBERSIHAN;
    if (norm === 'pencucian' || norm === 'cuci') return Division.CUCI;
    if (norm === 'keamanan' || norm === 'security') return Division.KEAMANAN;
    return null;
  };

  const getSlugFromDivision = (div: Division): string => {
    switch (div) {
      case Division.DRIVER: return 'driver';
      case Division.STOCKING: return 'persiapan';
      case Division.MASAK: return 'pemasakan';
      case Division.PEMORSIAN: return 'pemorsian';
      case Division.KEBERSIHAN: return 'kebersihan';
      case Division.CUCI: return 'pencucian';
      case Division.KEAMANAN: return 'keamanan';
      default: return 'persiapan';
    }
  };

  const getSopTaskTableName = (div: Division | string): string => {
    const norm = (div || '').toLowerCase().trim();
    if (norm.includes('driver') || norm.includes('distribusi')) return 'sop_tasks_driver';
    if (norm.includes('stocking') || norm.includes('persiapan')) return 'sop_tasks_stocking';
    if (norm.includes('masak') || norm.includes('pemasakan')) return 'sop_tasks_masak';
    if (norm.includes('pemorsian')) return 'sop_tasks_pemorsian';
    if (norm.includes('kebersihan')) return 'sop_tasks_kebersihan';
    if (norm.includes('cuci') || norm.includes('pencucian')) return 'sop_tasks_cuci';
    if (norm.includes('keamanan') || norm.includes('security')) return 'sop_tasks_keamanan';
    return 'sop_tasks_stocking';
  };

  const getSopTaskTableNames = (div: Division | string): string[] => {
    const primary = getSopTaskTableName(div);
    const singular = primary.replace('sop_tasks_', 'sop_task_');
    return [primary, singular, 'sop_tasks'];
  };

  // Listen for route changes (standard clean pathname routing with date & division slug support)
  useEffect(() => {
    const handleRouteChange = () => {
      // Clean up legacy hash paths if present by rewriting them to standard paths
      if (window.location.hash) {
        const hashPath = window.location.hash.replace(/^#\/?/, '/');
        window.history.replaceState(null, '', hashPath);
      }

      const path = window.location.pathname;
      if (!path || path === '/') return;
      
      const parts = path.split('/').filter(Boolean); // e.g. ["admin", "sop", "driver", "29-7-2026"]
      
      // 1. Check for Date Slug
      for (let i = parts.length - 1; i >= 0; i--) {
        const parsedDate = parseDateFromSlug(parts[i]);
        if (parsedDate) {
          setSelectedDate(parsedDate);
          break;
        }
      }

      // 2. Check for Page Slug
      for (let i = 0; i < parts.length; i++) {
        const pageCandidate = parts[i].toLowerCase().trim();
        const tab = getTabFromPage(pageCandidate);
        if (tab !== 23 || pageCandidate === 'dashboard-admin' || pageCandidate === 'dashboard') {
          setActiveTab(tab);
          break;
        }
      }
    };

    window.addEventListener('popstate', handleRouteChange);
    handleRouteChange(); // Run on mount

    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  // Update browser URL path when activeTab, selectedDate, or activeSopDetail changes
  useEffect(() => {
    if (!loggedInUser) return;
    
    let prefix = 'admin';
    let subEntity = '';

    const email = loggedInUser.email?.toLowerCase().trim() || '';
    if (email.includes('ma@qomaruddin.com')) { prefix = 'user'; subEntity = 'ma'; }
    else if (email.includes('smk@qomaruddin.com')) { prefix = 'user'; subEntity = 'smk'; }
    else if (email.includes('sma@qomaruddin.com')) { prefix = 'user'; subEntity = 'sma'; }
    else if (email.includes('mts@qomaruddin.com')) { prefix = 'user'; subEntity = 'mts'; }
    else if (email.includes('sukowati@qomaruddin.com')) { prefix = 'user'; subEntity = 'sukowati'; }
    else if (email.includes('sidokumpul@qomaruddin.com')) { prefix = 'user'; subEntity = 'sidokumpul'; }
    else if (loggedInUser.isCoordinator) {
      prefix = 'koordinator';
      if (loggedInUser.coordinatorDivision) {
        subEntity = getSlugFromDivision(loggedInUser.coordinatorDivision);
      }
    }
    else if (loggedInUser.role === UserRole.DRIVER) { prefix = 'driver'; }
    else if (loggedInUser.role === UserRole.CHEF) { prefix = 'chef'; }
    else if (loggedInUser.role === UserRole.AHLI_GIZI) { prefix = 'gizi'; }
    else if (loggedInUser.role === UserRole.ASLAP) { prefix = 'aslap'; }
    
    const page = getPageFromTab(activeTab);
    const dateSlug = formatDateToSlug(selectedDate);

    if (page) {
      let newPath = '';
      if (activeTab === 15 && activeSopDetail) {
        const divSlug = getSlugFromDivision(activeSopDetail.division);
        if (subEntity) {
          newPath = `/${prefix}/${subEntity}/${page}/${divSlug}/${dateSlug}`;
        } else {
          newPath = `/${prefix}/${page}/${divSlug}/${dateSlug}`;
        }
      } else if (subEntity) {
        newPath = `/${prefix}/${subEntity}/${page}/${dateSlug}`;
      } else {
        newPath = `/${prefix}/${page}/${dateSlug}`;
      }

      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    }
  }, [activeTab, selectedDate, activeSopDetail, loggedInUser]);

  // Keep activeSopDetail synchronized with URL parameters, logged in coordinator division, or latest sops list from Cloud Supabase
  useEffect(() => {
    if (activeTab !== 15) return;

    // For coordinators, prioritize their assigned division SOP
    if (loggedInUser?.isCoordinator && loggedInUser?.coordinatorDivision) {
      const coordDiv = loggedInUser.coordinatorDivision;
      const matchedSOP = sops.find(s => s.date === selectedDate && s.division === coordDiv);
      if (matchedSOP) {
        if (!activeSopDetail || activeSopDetail.id !== matchedSOP.id || activeSopDetail.division !== coordDiv) {
          setActiveSopDetail(matchedSOP);
          return;
        }
      }
    }

    // Check if URL specifies division & date
    const parts = window.location.pathname.split('/').filter(Boolean);
    let urlDiv: Division | null = null;
    let urlDate: string | null = null;
    for (const p of parts) {
      const d = parseDateFromSlug(p);
      if (d) urlDate = d;
      const div = getDivisionFromSlug(p);
      if (div) urlDiv = div;
    }

    const searchDate = urlDate || selectedDate;
    let searchDiv = urlDiv;

    if (!searchDiv && loggedInUser?.isCoordinator && loggedInUser?.coordinatorDivision) {
      searchDiv = loggedInUser.coordinatorDivision;
    } else if (!searchDiv && activeSopDetail) {
      searchDiv = activeSopDetail.division;
    }

    if (searchDiv && searchDate) {
      const matchedSOP = sops.find(s => s.date === searchDate && s.division === searchDiv);
      if (matchedSOP) {
        if (!activeSopDetail || JSON.stringify(matchedSOP) !== JSON.stringify(activeSopDetail)) {
          setActiveSopDetail(matchedSOP);
        }
      }
    } else if (activeSopDetail) {
      const updatedSop = sops.find(s => s.id === activeSopDetail.id || (s.date === activeSopDetail.date && s.division === activeSopDetail.division));
      if (updatedSop && JSON.stringify(updatedSop) !== JSON.stringify(activeSopDetail)) {
        setActiveSopDetail(updatedSop);
      }
    }
  }, [sops, activeTab, selectedDate, loggedInUser]);

  // Synchronise usernames based on active role
  useEffect(() => {
    if (loggedInUser?.isCoordinator) {
      // Keep name mapped directly from login profile
      setCurrentUsername(loggedInUser.fullName);
      return;
    }
    switch (currentUserRole) {
      case UserRole.CHEF:
        setCurrentUsername('Rizka Aulia (Head Chef)');
        break;
      case UserRole.AHLI_GIZI:
        setCurrentUsername('Avianti Rahma Dianita');
        break;
      case UserRole.ASLAP:
        setCurrentUsername('Ahmad Maghfur (Aslap)');
        break;
      case UserRole.ADMIN:
        setCurrentUsername('Admin Utama SPPG');
        break;
      case UserRole.AKUNTAN:
        setCurrentUsername('Staff Akuntan SPPG');
        break;
      case UserRole.DRIVER:
        setCurrentUsername('Driver Logistik SPPG');
        break;
    }
  }, [currentUserRole, loggedInUser]);

  // Try to recover the active Supabase session on startup
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && session.user) {
          const profile = mapUserToProfile(session.user.id, session.user.email || '');
          setLoggedInUser(profile);
          setCurrentUserRole(profile.role);
          setCurrentUsername(profile.fullName);
          const email = profile.email?.toLowerCase().trim() || '';
          if (['ma@qomaruddin.com', 'smk@qomaruddin.com', 'sma@qomaruddin.com', 'mts@qomaruddin.com', 'sukowati@qomaruddin.com', 'sidokumpul@qomaruddin.com'].includes(email)) {
            setActiveTab(19);
          }
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session && session.user) {
          const profile = mapUserToProfile(session.user.id, session.user.email || '');
          setLoggedInUser(profile);
          setCurrentUserRole(profile.role);
          setCurrentUsername(profile.fullName);
          const email = profile.email?.toLowerCase().trim() || '';
          if (['ma@qomaruddin.com', 'smk@qomaruddin.com', 'sma@qomaruddin.com', 'mts@qomaruddin.com', 'sukowati@qomaruddin.com', 'sidokumpul@qomaruddin.com'].includes(email)) {
            setActiveTab(19);
          }
        } else {
          setLoggedInUser(null);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  // Sync day menus to localStorage for persistent offline fallbacks
  useEffect(() => {
    if (dayMenus && dayMenus.length > 0) {
      safeLocalStorageSetItem('sppg_day_menus', JSON.stringify(dayMenus));
    }
  }, [dayMenus]);

  // Bootstrap Supabase with user local storage or baseline preset-menus and SOP checklists if empty
  const bootstrapSupabase = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      console.log('Bootstrapping Supabase database tables...');
      
      const savedMenusStr = safeLocalStorageGetItem('sppg_day_menus');

      let menusToSeed = PRESET_MENUS;
      if (savedMenusStr) {
        try {
          const parsedMenus = JSON.parse(savedMenusStr);
          if (parsedMenus && parsedMenus.length > 0) {
            menusToSeed = parsedMenus;
          }
        } catch (e) {
          console.error('Error parsing local day menus for bootstrap:', e);
        }
      }

      // 1. Seed day_menus
      const menuPayload = menusToSeed.map(m => ({
        date: m.date,
        menu_list: m.menuList,
        created_at: m.createdAt || new Date().toISOString(),
        created_by: m.createdBy || UserRole.ADMIN
      }));
      await supabase.from('day_menus').upsert(menuPayload);

      // 2. Generate initial default SOPs if empty
      const initialSopsInDatabase: any[] = [];
      const tasksByTable: Record<string, any[]> = {};

      // Monday 2026-06-15 sops (Seeded as completed & signed)
      const mondayMenu = ['Nasi Putih', 'Ayam Geprek Sambal Korek', 'Tumis Kangkung Belacan', 'Khrupuk Udang', 'Pisang Ambon'];
      Object.values(Division).forEach((div) => {
        const creatorInfo = DIVISION_CREATOR_MAP[div];
        const supervisorName = creatorInfo.role === UserRole.CHEF ? 'Rizka Aulia' :
                              creatorInfo.role === UserRole.AHLI_GIZI ? 'Avianti Rahma Dianita' : 'Ahmad Maghfur';
        
        const sopId = `2026-06-15-${div}`;
        const targetTable = getSopTaskTableName(div);
        const singularTable = targetTable.replace('sop_tasks_', 'sop_task_');
        if (!tasksByTable[targetTable]) tasksByTable[targetTable] = [];
        if (!tasksByTable[singularTable]) tasksByTable[singularTable] = [];
        if (!tasksByTable['sop_tasks']) tasksByTable['sop_tasks'] = [];

        initialSopsInDatabase.push({
          id: sopId,
          date: '2026-06-15',
          division: div,
          creator_role: creatorInfo.role,
          creator_name: supervisorName,
          is_checked_all: true,
          signer_supervisor: supervisorName,
          signature_supervisor_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><path d="M10,20 Q30,5 50,20 T90,20" fill="none" stroke="black" stroke-width="2"/></svg>',
          signed_supervisor_at: '2026-06-15T08:00:00Z',
          signer_coordinator: `Koordinator ${div.split(' ')[0]}`,
          signature_coordinator_url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><path d="M10,20 Q30,5 50,20 T90,20" fill="none" stroke="black" stroke-width="2"/></svg>',
          signed_coordinator_at: '2026-06-15T08:30:00Z',
          status: 'selesai',
          updated_at: '2026-06-15T08:30:00Z'
        });

        const defaultTasks = generateInitialSOPsForDate('2026-06-15', mondayMenu).find(s => s.division === div)?.tasks || [];
        defaultTasks.forEach((t: any, idx: number) => {
          const item = {
            id: `${sopId}-t-${idx}`,
            sop_id: sopId,
            text: t.text,
            completed: true,
            category: t.category,
            sort_order: idx
          };
          tasksByTable[targetTable].push(item);
          tasksByTable[singularTable].push(item);
          tasksByTable['sop_tasks'].push(item);
        });
      });

      // Tuesday 2026-06-16 sops (Active, pre-checked partial)
      const tuesdayMenu = ['Nasi Putih', 'Krawu Ayam Bungah', 'Tempe Goreng Ketumbar', 'Kupasan Timun Segar', 'Sambal Serundeng Kelapa', 'Pisang'];
      Object.values(Division).forEach((div) => {
        const creatorInfo = DIVISION_CREATOR_MAP[div];
        const supervisorName = creatorInfo.role === UserRole.CHEF ? 'Rizka Aulia' :
                              creatorInfo.role === UserRole.AHLI_GIZI ? 'Avianti Rahma Dianita' : 'Ahmad Maghfur';
        
        const sopId = `2026-06-16-${div}`;
        const targetTable = getSopTaskTableName(div);
        const singularTable = targetTable.replace('sop_tasks_', 'sop_task_');
        if (!tasksByTable[targetTable]) tasksByTable[targetTable] = [];
        if (!tasksByTable[singularTable]) tasksByTable[singularTable] = [];
        if (!tasksByTable['sop_tasks']) tasksByTable['sop_tasks'] = [];

        initialSopsInDatabase.push({
          id: sopId,
          date: '2026-06-16',
          division: div,
          creator_role: creatorInfo.role,
          creator_name: supervisorName,
          is_checked_all: false,
          signer_supervisor: supervisorName,
          signature_supervisor_url: '',
          signed_supervisor_at: null,
          signer_coordinator: `Koordinator ${div.split(' ')[0]}`,
          signature_coordinator_url: '',
          signed_coordinator_at: null,
          status: 'aktif',
          updated_at: '2026-06-16T05:00:00Z'
        });

        const defaultTasks = generateInitialSOPsForDate('2026-06-16', tuesdayMenu).find(s => s.division === div)?.tasks || [];
        defaultTasks.forEach((t: any, idx: number) => {
          const item = {
            id: `${sopId}-t-${idx}`,
            sop_id: sopId,
            text: t.text,
            completed: idx < 3,
            category: t.category,
            sort_order: idx
          };
          tasksByTable[targetTable].push(item);
          tasksByTable[singularTable].push(item);
          tasksByTable['sop_tasks'].push(item);
        });
      });

      await supabase.from('sops').upsert(initialSopsInDatabase);
      for (const [tbl, tasks] of Object.entries(tasksByTable)) {
        if (tasks.length > 0) {
          try {
            const { error: upsertErr } = await supabase.from(tbl).upsert(tasks);
            if (upsertErr) {
              console.warn(`Note during bootstrap upsert to ${tbl}:`, upsertErr.message);
            }
          } catch (tblErr) {
            console.warn(`Note during bootstrap upsert exception for ${tbl}:`, tblErr);
          }
        }
      }
      console.log('Bootstrapping Supabase database completed successfully!');
    } catch (e) {
      console.error('Failed to bootstrap Supabase:', e);
    }
  };

  // Keep activeSopDetail synchronized with the latest sops list from Supabase
  useEffect(() => {
    if (activeSopDetail) {
      const updatedSop = sops.find(s => s.id === activeSopDetail.id);
      if (updatedSop && JSON.stringify(updatedSop) !== JSON.stringify(activeSopDetail)) {
        setActiveSopDetail(updatedSop);
      }
    }
  }, [sops]);

  // Load state directly from Supabase via custom hook
  const loadAllFromSupabase = async () => {
    await fetchSopsAndMenus();
  };

  // Handlers
  const handleSaveMenu = async (date: string, menuList: string[]) => {
    const existingMenuIdx = dayMenus.findIndex(m => m.date === date);
    const newMenu: DayMenu = {
      date,
      menuList,
      createdAt: new Date().toISOString(),
      createdBy: currentUserRole
    };

    if (existingMenuIdx !== -1) {
      const updated = [...dayMenus];
      updated[existingMenuIdx] = newMenu;
      setDayMenus(updated);
    } else {
      setDayMenus([...dayMenus, newMenu]);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('day_menus').upsert({
          date,
          menu_list: menuList,
          created_at: newMenu.createdAt,
          created_by: newMenu.createdBy
        });
        if (error) {
          console.error('Failed to save menu on Supabase:', error);
          alert('Gagal menyimpan menu ke Supabase: ' + error.message);
        } else {
          console.log('Successfully saved menu on Supabase:', date);
        }
      } catch (e) {
        console.error('Failed to save menu to Supabase:', e);
      }
    }
  };

  const handleDeleteMenu = async (date: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus menu dan semua SOP digital untuk tanggal ${date}?`)) {
      return;
    }

    // Update local state immediately
    setDayMenus(prev => prev.filter(m => m.date !== date));
    setSops(prev => prev.filter(s => s.date !== date));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: errMenu } = await supabase.from('day_menus').delete().eq('date', date);
        const { error: errSops } = await supabase.from('sops').delete().eq('date', date);
        const divisionTables = [
          'sop_tasks',
          'sop_tasks_driver', 'sop_task_driver',
          'sop_tasks_stocking', 'sop_task_stocking',
          'sop_tasks_masak', 'sop_task_masak',
          'sop_tasks_pemorsian', 'sop_task_pemorsian',
          'sop_tasks_kebersihan', 'sop_task_kebersihan',
          'sop_tasks_cuci', 'sop_task_cuci',
          'sop_tasks_keamanan', 'sop_task_keamanan'
        ];
        for (const tbl of divisionTables) {
          await supabase.from(tbl).delete().like('sop_id', `%${date}%`);
        }
        
        if (errMenu || errSops) {
          console.error('Supabase deletion error:', errMenu || errSops);
          alert('Gagal menghapus data dari Supabase: ' + (errMenu?.message || errSops?.message));
        } else {
          console.log('Successfully deleted menu and SOPs from Supabase:', date);
        }
      } catch (e) {
        console.error('Failed to delete menu on Supabase:', e);
      }
    }
  };



  // Helper selectors
  const getMenuForSelectedDate = () => {
    return dayMenus.find(m => m.date === selectedDate) || null;
  };

  const getSOPsForSelectedDate = () => {
    return sops.filter(s => s.date === selectedDate);
  };

  const syncMenuFromSchedule = (date: string, items: string[]) => {
    // Allows schedule tab to write back to our database
    handleSaveMenu(date, items);
    handleGenerateSOPs(date);
    setSelectedDate(date);
    setCurrentSubTab('dashboard');
  };

  // List of all capabilities
  const FEATURE_MENUS = [
    { num: 23, name: 'Dashboard Admin Utama', icon: LayoutDashboard, category: 'Kontrol Utama', badge: 'BARU' },
    { num: 15, name: 'SOP Harian Digital', icon: CheckCircle2, category: 'Kontrol Kualitas', badge: 'UTAMA' },
    { num: 10, name: 'Menu Harian Gizi', icon: Calendar, category: 'Perencanaan' },
    { num: 22, name: 'Master Jumlah Porsi', icon: Users, category: 'Perencanaan' },
    { num: 12, name: 'Stock Opname Gudang', icon: ClipboardList, category: 'Aset & Logistik' },
    { num: 17, name: 'Stok Operasional', icon: Package, category: 'Aset & Logistik' },
    { num: 16, name: 'Rekap Sampah Makanan (Waste)', icon: Trash2, category: 'Kontrol Kualitas' },
    { num: 4, name: 'Order Alat Baru', icon: ShoppingCart, category: 'Perekaman & Order' },
    { num: 5, name: 'Order Operasional', icon: ShoppingCart, category: 'Perekaman & Order' },
    { num: 6, name: 'Kedatangan Barang', icon: Truck, category: 'Distribusi & Logistik' },
    { num: 7, name: 'Galeri Kedatangan Barang', icon: Camera, category: 'Dokumentasi', url: 'https://drive.google.com/drive/folders/1TBcj9LvdkzgdNRpkKvxznz5_-1VF--hw' },
    { num: 8, name: 'Dokumentasi Dapur', icon: Camera, category: 'Dokumentasi', url: 'https://drive.google.com/drive/folders/1bqTPoSzK1KscBq58gSs_LIcjK_90ExIu?usp=drive_link' },
    { num: 18, name: 'Dokumentasi Pengiriman Ompreng', icon: Camera, category: 'Dokumentasi Pengiriman', url: 'https://drive.google.com/drive/folders/1-2i-2zctARA9tuLXPSTNX25of6qR7CxY' },
    { num: 19, name: 'Berita Acara Serah Terima', icon: FileText, category: 'Dokumentasi Pengiriman' },
    { num: 20, name: 'Surat Jalan', icon: Truck, category: 'Dokumentasi Pengiriman' },
    { num: 21, name: 'Organoleptik', icon: ClipboardList, category: 'Dokumentasi Pengiriman' },
    { num: 14, name: 'Keluhan Relawan', icon: ShieldAlert, category: 'Sumber Daya Manusia' },
    { num: 9, name: 'Absensi Relawan', icon: ClipboardCheck, category: 'Sumber Daya Manusia', badge: 'PEKANAN' }
  ];

  const visibleMenus = !loggedInUser
    ? []
    : (() => {
        const email = loggedInUser.email?.toLowerCase().trim() || '';
        const role = loggedInUser.role;

        // 1. ADMIN UTAMA
        if (
          ['maghfur@qomaruddin.com', 'rifkah@qomaruddin.com', 'fajar@qomaruddin.com', 'sam@qomaruddin.com', 'maghfurmunif@gmail.com', 'punkysme@gmail.com', 'ketua@sppg.com'].includes(email) ||
          role === UserRole.ADMIN
        ) {
          return FEATURE_MENUS;
        }

        // 2. PENERIMA SASARAN
        if (
          ['ma@qomaruddin.com', 'smk@qomaruddin.com', 'sma@qomaruddin.com', 'mts@qomaruddin.com', 'sukowati@qomaruddin.com', 'sidokumpul@qomaruddin.com'].includes(email) ||
          role === UserRole.PENERIMA
        ) {
          // BAST (19), Surat Jalan (20), Organoleptik (21)
          return FEATURE_MENUS.filter(menu => [19, 20, 21].includes(menu.num));
        }

        // 3. TIM UTAMA
        if (email === 'chef@qomaruddin.com') {
          // SOP Digital, Menu Harian, Order Alat/Operasional, Keluhan
          return FEATURE_MENUS.filter(menu => [15, 10, 4, 5, 14].includes(menu.num));
        }
        if (email === 'gizi@qomaruddin.com') {
          // SOP Harian, Menu Harian Gizi, Order Alat/Operasional, Dokumentasi Pengiriman Ompreng, Keluhan
          return FEATURE_MENUS.filter(menu => [15, 10, 4, 5, 18, 14].includes(menu.num));
        }
        if (email === 'akuntan@qomaruddin.com') {
          // Stock Opname, Stock Operasional, Order Operasional, Kedatangan Barang, Galeri Kedatangan Barang
          return FEATURE_MENUS.filter(menu => [12, 17, 5, 6, 7].includes(menu.num));
        }

        // 4. DIVISI (SOP Harian, Menu Harian Gizi, Order Alat/Operasional, Keluhan)
        if (['stocking@qomaruddin.com', 'masak@qomaruddin.com', 'pemorsian@qomaruddin.com', 'cuci@qomaruddin.com', 'kebersihan@qomaruddin.com', 'keamanan@qomaruddin.com'].includes(email)) {
          return FEATURE_MENUS.filter(menu => [15, 10, 4, 5, 14].includes(menu.num));
        }

        // 5. DRIVER
        if (email === 'driver@qomaruddin.com') {
          // SOP Harian, Menu Harian Gizi, Order Alat/Operasional, BAST, Surat Jalan, Keluhan, Dokumentasi Pengiriman Ompreng
          return FEATURE_MENUS.filter(menu => [15, 10, 4, 5, 18, 19, 20, 21, 14].includes(menu.num));
        }

        // Legacy/Default Fallbacks based on mapped roles
        if (role === UserRole.CHEF || role === UserRole.AHLI_GIZI) {
          return FEATURE_MENUS.filter(menu => [15, 10, 12, 16, 4, 5, 14].includes(menu.num));
        } else if (role === UserRole.AKUNTAN) {
          return FEATURE_MENUS.filter(menu => [15, 10, 12, 17, 4, 5, 6, 7, 14].includes(menu.num));
        } else if (role === UserRole.DRIVER) {
          return FEATURE_MENUS.filter(menu => [15, 14, 18, 19, 20, 21].includes(menu.num));
        } else if (loggedInUser.isCoordinator) {
          return FEATURE_MENUS.filter(menu => [15, 14, 4, 5, 16, 17].includes(menu.num));
        }

        return FEATURE_MENUS;
      })();

  // Security redirect if activeTab is not allowed for current user
  useEffect(() => {
    if (loggedInUser) {
      const allowedNums = visibleMenus.map(m => m.num);
      if (!allowedNums.includes(activeTab)) {
        if (allowedNums.length > 0) {
          setActiveTab(allowedNums[0]); // Redirect to first allowed menu tab
        } else {
          setActiveTab(15);
        }
      }
    }
  }, [loggedInUser, activeTab, visibleMenus]);

  if (!loggedInUser) {
    return (
      <Login 
        onLoginSuccess={(profile) => {
          setLoggedInUser(profile);
          setCurrentUserRole(profile.role);
          setCurrentUsername(profile.fullName);
          const email = profile.email?.toLowerCase().trim() || '';
          if (
            ['maghfur@qomaruddin.com', 'rifkah@qomaruddin.com', 'fajar@qomaruddin.com', 'sam@qomaruddin.com', 'maghfurmunif@gmail.com', 'punkysme@gmail.com', 'ketua@sppg.com'].includes(email) ||
            profile.role === UserRole.ADMIN
          ) {
            setActiveTab(23);
          } else if (['ma@qomaruddin.com', 'smk@qomaruddin.com', 'sma@qomaruddin.com', 'mts@qomaruddin.com', 'sukowati@qomaruddin.com', 'sidokumpul@qomaruddin.com'].includes(email)) {
            setActiveTab(19);
          } else if (profile.isCoordinator) {
            setActiveTab(15);
          }
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-neutral-800">
      
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-neutral-950/60 z-[98] md:hidden backdrop-blur-xs transition-opacity duration-300"
        />
      )}
      
      {/* 1. LEFT SIDEBAR NAVIGATION (Hides on standard print) */}
      <aside 
        id="nav-sidebar" 
        className={`w-72 bg-neutral-900 text-white shrink-0 shadow-lg flex flex-col border-r border-[#151c2c] fixed md:relative inset-y-0 left-0 z-[99] transform ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
         } transition-transform duration-300 ease-in-out md:flex`}
      >
        {/* Boarding school branding */}
        <div className="p-5 border-b border-[#252f44] bg-[#0c1421] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img 
              src="https://www.bgn.go.id/logo-bgn.png" 
              alt="Logo BGN" 
              className="h-10 w-10 object-contain select-none" 
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="font-bold text-xs md:text-sm tracking-wide text-white uppercase font-display">
                Dapur Qomaruddin
              </h1>
              <span className="text-[10px] text-emerald-400 block tracking-widest font-mono uppercase">
                Bungah - Gresik
              </span>
            </div>
          </div>
          
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-850 rounded-lg transition-colors cursor-pointer"
            aria-label="Tutup navigasi"
          >
            <span className="text-xl font-bold">&times;</span>
          </button>
        </div>

        {/* Sidebar Capabilities scrolling List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          <div className="text-[10px] text-neutral-500 font-bold px-3 uppercase tracking-widest block select-none">
            Modul Operasional
          </div>
          <div className="space-y-1">
            {visibleMenus.map((menu) => {
              const IconComp = menu.icon;
              const isSelected = activeTab === menu.num;
              
              const innerContent = (
                <>
                  <div className="flex items-center gap-3">
                    <IconComp className={`h-4 w-4 shrink-0 ${isSelected ? 'text-emerald-300' : 'text-neutral-400'}`} />
                    <span className="text-xs truncate font-medium">{menu.name}</span>
                  </div>
                  {menu.badge && (
                    <span className="bg-amber-500 text-neutral-900 font-black text-[9px] px-1.5 py-0.5 rounded-sm shrink-0 uppercase tracking-widest scale-90 animate-pulse">
                      {menu.badge}
                    </span>
                  )}
                </>
              );

              if (menu.url) {
                return (
                  <a
                    key={menu.num}
                    href={menu.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 rounded-lg flex items-center justify-between text-left transition-all text-neutral-400 hover:text-white hover:bg-neutral-800/60"
                  >
                    {innerContent}
                  </a>
                );
              }

              return (
                <button
                  key={menu.num}
                  onClick={() => {
                    setActiveTab(menu.num);
                    setActiveSopDetail(null);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full py-2.5 px-3 rounded-lg flex items-center justify-between text-left transition-all ${
                    isSelected 
                      ? 'bg-emerald-800 text-white font-semibold shadow-xs border border-emerald-700/50' 
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  {innerContent}
                </button>
              );
            })}
          </div>
        </div>

        {/* Board footer credentials */}
        <div className="p-4 border-t border-[#222d3d] bg-neutral-950 font-mono text-[9px] text-neutral-500 text-center">
          DIBUAT UNTUK SPPG QOMARUDDIN
          <div className="text-[8px] text-emerald-600 mt-0.5">© {new Date().getFullYear()} - PAPERLESS PROJECT</div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        {/* Top Header Controls bar (Hides on standard print) */}
        <header id="role-bar" className="bg-white border-b border-neutral-200/80 p-4 sticky top-0 z-[98] no-print flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider font-mono">
                Sistem Informasi Digitalisasi Dapur
              </span>
              <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-1">
                Kualitas Nutrisi &amp; Manajemen Kebersihan Pesantren
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick date selector */}
            <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 shadow-2xs font-mono text-xs">
              <Calendar className="h-3.5 w-3.5 text-neutral-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value);
                  setActiveSopDetail(null);
                }}
                className="bg-transparent border-none outline-hidden focus:ring-0 font-semibold p-0 text-neutral-800"
              />
            </div>

            {/* Logged in User Profile Info & Log Out Button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <UserCircle className="h-7 w-7 text-emerald-800 hidden sm:block" />
                <div className="text-left font-sans">
                  <span className="text-[10px] text-emerald-700 font-extrabold block uppercase tracking-wider leading-none">
                    {currentUserRole}
                  </span>
                  <span className="text-[11.5px] font-bold text-neutral-800 block truncate max-w-[150px] sm:max-w-[180px] mt-0.5">
                    {currentUsername}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => {
                  if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
                    setLoggedInUser(null);
                    if (isSupabaseConfigured && supabase) {
                      supabase.auth.signOut();
                    }
                  }
                }}
                className="bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200/60 font-bold text-[9px] px-2.5 py-1.5 rounded-xl uppercase tracking-wider transition-all"
                title="Keluar dari Aplikasi"
              >
                Keluar
              </button>
            </div>
          </div>
        </header>

        {/* Work Area scrollable wrap */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {activeTab !== 15 ? (
            /* Render Mockups for 1 to 14 and 23 */
            <MockModules 
              moduleIndex={activeTab} 
              onSetMenu={syncMenuFromSchedule}
              allDayMenus={dayMenus}
              onSaveMenu={handleSaveMenu}
              onGenerateSOPs={handleGenerateSOPs}
              onDeleteMenu={handleDeleteMenu}
              currentUserRole={currentUserRole}
              loggedInUser={loggedInUser}
              selectedDate={selectedDate}
              sops={sops}
              setSops={setSops}
              onGoToTab={setActiveTab}
              onSaveSopsToCloud={handleSaveSopsToCloud}
            />
          ) : activeSopDetail ? (
            /* Render Full-depth checklist printed form sheet */
            <SOPChecklistView
              sop={activeSopDetail}
              menuList={getMenuForSelectedDate()?.menuList || []}
              currentUserRole={currentUserRole}
              currentUsername={currentUsername}
              onUpdateSOP={handleUpdateSOP}
              onBack={() => setActiveSopDetail(null)}
              isCoordinator={loggedInUser?.isCoordinator}
              loggedInUser={loggedInUser}
              onSaveSopsToCloud={handleSaveSopsToCloud}
            />
          ) : loggedInUser.isCoordinator ? (
            /* Coordinator Empty State: No SOP generated for this date yet */
            <div className="bg-white p-12 rounded-3xl border border-neutral-100 shadow-xl text-center space-y-6 max-w-2xl mx-auto my-12">
              <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto text-amber-600">
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-neutral-800">
                  Lembar Kerja SOP Belum Dirilis
                </h3>
                <p className="text-sm text-neutral-500">
                  SOP harian untuk divisi <strong className="text-emerald-800">{loggedInUser.coordinatorDivision}</strong> pada tanggal {selectedDate} belum dipublikasikan oleh Supervisor / Admin.
                </p>
              </div>
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => {
                    const menuItems = getMenuForSelectedDate()?.menuList || ['Nasi Putih', 'Lauk Protein', 'Lauk Nabati', 'Sayuran Segar'];
                    handleGenerateSOPs(selectedDate);
                  }}
                  className="bg-emerald-800 hover:bg-emerald-950 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-xs transition-colors w-full sm:w-auto"
                >
                  Inisialisasi SOP Mandiri
                </button>
                <span className="text-xs text-neutral-400">
                  Atau hubungi Supervisor/Admin Utama di Ruang Admin.
                </span>
              </div>
            </div>
          ) : (
            /* SOP Management Page */
            <div className="space-y-6">
              {/* Context Banner */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-xl font-bold text-neutral-900 font-display">
                    Manajemen SOP Dapur Harian Berbasis Menu
                  </h1>
                  <p className="text-xs text-neutral-500 max-w-xl">
                    SOP Dapur SPPG disinkronkan langsung berbasis menu harian gizi tinggi. Gunakan form centang digital ini untuk mengganti kertas cetak.
                  </p>
                </div>

                {/* Sub Tab selection buttons */}
                <div className="flex border border-neutral-200 bg-neutral-50 p-1 rounded-xl shrink-0 tab-buttons no-print flex-wrap gap-1 sm:gap-0">
                  <button
                    onClick={() => setCurrentSubTab('dashboard')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentSubTab === 'dashboard'
                        ? 'bg-emerald-800 text-white shadow-2xs'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    Dashboard SOP
                  </button>
                  <button
                    onClick={() => setCurrentSubTab('create')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentSubTab === 'create'
                        ? 'bg-emerald-800 text-white shadow-2xs'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    Rilis / Atur Menu
                  </button>
                  <button
                    onClick={() => setCurrentSubTab('recap')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currentSubTab === 'recap'
                        ? 'bg-emerald-800 text-white shadow-2xs'
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    Bank Rekapitulasi
                  </button>
                </div>
              </div>

              {/* Render Selected SubTab */}
              {currentSubTab === 'create' ? (
                <SOPCreator
                  selectedDate={selectedDate}
                  dayMenu={getMenuForSelectedDate()}
                  sopsForDate={getSOPsForSelectedDate()}
                  currentUserRole={currentUserRole}
                  currentUsername={currentUsername}
                  onSaveMenu={handleSaveMenu}
                  onGenerateSOPs={handleGenerateSOPs}
                  onUpdateSOP={handleUpdateSOP}
                  allDayMenus={dayMenus}
                  onSelectDate={(date) => setSelectedDate(date)}
                  onDeleteMenu={handleDeleteMenu}
                  onSetUserRole={setCurrentUserRole}
                  onBootstrapDb={bootstrapSupabase}
                  onSaveSopsToCloud={handleSaveSopsToCloud}
                />
              ) : currentSubTab === 'recap' ? (
                <SOPRecap
                  sops={sops}
                  onSelectSOP={(sop) => setActiveSopDetail(sop)}
                  onDeleteSOP={handleDeleteSOP}
                />
              ) : (
                /* 2.A MAIN SOP DASHBOARD SUB-TAB */
                <div className="space-y-6">
                  {/* Selected Menu Highlight board */}
                  <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Flame className="h-5 w-5 text-emerald-800" />
                        <div>
                          <h3 className="font-bold text-neutral-800 text-sm font-display">
                            Menu Gizi Aktif Terpilih
                          </h3>
                          <p className="text-[11px] text-neutral-400">Dimasukkan oleh Ahli Gizi untuk konsumsi asrama santri</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setCurrentSubTab('create')}
                        className="text-xs text-emerald-800 hover:text-emerald-900 font-bold flex items-center gap-1.5 hover:underline"
                      >
                        Kelola Menu &amp; SOP <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>

                    {getMenuForSelectedDate() ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs text-neutral-400 font-medium font-sans uppercase tracking-widest mr-2">Disajikan:</span>
                        {getMenuForSelectedDate()?.menuList.map((food, idx) => (
                          <span 
                            key={idx} 
                            className="bg-emerald-50 text-emerald-800 font-bold text-xs px-3 py-1.5 rounded-xl border border-emerald-100/60"
                          >
                            {idx + 1}. {food}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50 text-center space-y-3">
                        <Info className="h-6 w-6 text-neutral-400 mx-auto" />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-neutral-600">Menu Belum Dikeluarkan untuk Tanggal Ini</p>
                          <p className="text-[11.5px] text-neutral-400 max-w-sm mx-auto">Untuk menghasilkan tugas centang-centang harian, rilis menu harian terlebih dahulu melalui tab <strong>"Rilis / Atur Menu"</strong>.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 7 DIVISIONS CARDS LIST */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-neutral-800 text-sm font-display select-none">
                      Pilih Divisi Dapur untuk Membuka SOP Checklist
                    </h3>
                    
                    {getSOPsForSelectedDate().length === 0 ? (
                      <div className="p-16 border border-neutral-200 rounded-2xl bg-white text-center space-y-4">
                        <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto animate-bounce" />
                        <div className="space-y-1.5">
                          <h4 className="text-neutral-700 font-bold text-sm">SOP Dapur Belum Dipublikasikan</h4>
                          <p className="text-xs text-neutral-400 max-w-sm mx-auto">Checklist harian belum dikomposisikan oleh Chef, Ahli Gizi, atau Aslap. Ketuk tombol di bawah untuk membuat secara otomatis.</p>
                        </div>
                        <button
                          onClick={() => {
                            // Quick auto-generate using preloaded menu
                            const defaultList = ['Nasi Putih', 'Krawu Ayam Bungah', 'Tempe Goreng Ketumbar', 'Kupasan Timun Segar', 'Sambal Serundeng kelapa', 'Pisang'];
                            handleSaveMenu(selectedDate, defaultList);
                            handleGenerateSOPs(selectedDate);
                          }}
                          className="bg-emerald-800 hover:bg-emerald-950 text-white text-xs font-bold px-5 py-2.5 rounded-xl text-center inline-block"
                        >
                          + Instant Masukkan Template SOP
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {getSOPsForSelectedDate().map((sop) => {
                          const completedCount = sop.tasks.filter(t => t.completed).length;
                          const totalCount = sop.tasks.length;
                          const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                          
                          return (
                            <div 
                              key={sop.id}
                              onClick={() => setActiveSopDetail(sop)}
                              className="bg-white hover:border-emerald-600 border border-neutral-200/80 rounded-2xl p-5 shadow-3xs cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group flex flex-col justify-between min-h-[175px]"
                            >
                              <div>
                                <div className="flex items-start justify-between">
                                  <div>
                                    <span className="text-[9px] text-neutral-400 font-mono block uppercase tracking-wider">DIVISI</span>
                                    <h4 className="font-bold text-base text-neutral-800 group-hover:text-emerald-800 transition-colors">
                                      {sop.division}
                                    </h4>
                                  </div>
                                  
                                  <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold border ${
                                    sop.status === 'selesai'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}>
                                    {sop.status === 'selesai' ? 'TERKUNCI' : 'AKTIF'}
                                  </span>
                                </div>

                                <p className="text-[10px] text-neutral-400 mt-2">
                                  Dibuat: {sop.creatorName} ({sop.creatorRole.replace(' (Asisten Lapangan)', '').replace(' / Juru Masak', '')})
                                </p>
                              </div>

                              <div className="mt-5 pt-3 border-t border-neutral-100 flex flex-col gap-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-neutral-500 font-semibold">Tugas Selesai:</span>
                                  <span className="font-mono font-bold text-neutral-950">
                                    {completedCount} / {totalCount} ({pct}%)
                                  </span>
                                </div>

                                {/* Custom mini progress slider */}
                                <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${pct === 100 ? 'bg-emerald-600' : 'bg-amber-500'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>

                                {/* Link tag */}
                                <span className="text-[10px] text-emerald-800 font-extrabold mt-1 uppercase tracking-wider flex items-center gap-0.5 self-end">
                                  Buka Checklist <ArrowRight className="h-3 w-3 translate-x-0 group-hover:translate-x-1 transition-transform" />
                                </span>
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
          )}
        </div>
      </main>
    </div>
  );
}
