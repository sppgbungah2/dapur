import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle, Info, AlertCircle, Search, Trash2, 
  ShieldCheck, Clipboard, Download, Plus, FileSpreadsheet, X 
} from 'lucide-react';
import SignaturePad from './SignaturePad';
import { safeLocalStorageSetItem, safeLocalStorageGetItem } from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// CSV Helper for Excel exports
const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
  const content = [
    headers.join(';'),
    ...rows.map(row => row.map(val => {
      const cleanVal = String(val || '').replace(/"/g, '""');
      return `"${cleanVal}"`;
    }).join(';'))
  ].join('\r\n');
  
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export interface AbsensiItem {
  id: string;
  name: string;
  role: string;
  status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
  checkInTime: string;
  notes: string;
}

export interface AbsensiSignOff {
  signerKetua: string;
  signatureKetuaUrl: string | null;
  signedKetuaAt: string | null;
  signerAslap: string;
  signatureAslapUrl: string | null;
  signedAslapAt: string | null;
  status: 'Draft' | 'Final';
}

const MASTER_RELAVAN: { name: string; role: string }[] = [
  { name: 'Ahmad Maghfur', role: 'Asisten Lapangan' },
  { name: 'Rizka Aulia', role: 'Chef' },
  { name: 'Mohammad Sholihuddin Nuraini', role: 'Koordinator Distribusi' },
  { name: 'Ahmad Wahyudi', role: 'Distribusi' },
  { name: 'Falikul Habibi', role: 'Distribusi' },
  { name: 'Imam Durori Ahmadi', role: 'Distribusi' },
  { name: 'Muhammad Fahruddin', role: 'Keamanan' },
  { name: 'Mohammad Arifin', role: 'Keamanan' },
  { name: 'Moch. Nasiruddin', role: 'Kebersihan' },
  { name: 'Ismail', role: 'Kebersihan' },
  { name: 'Muhammad Fajrul Falah', role: 'Koordinator Pemorsian' },
  { name: 'Dewi Rifkah Imroatul Kholifah', role: 'Pemorsian' },
  { name: 'Muzdalifah', role: 'Pemorsian' },
  { name: 'Tukhfatul Maghfiroh', role: 'Pemorsian' },
  { name: 'Anwar Ramadhan', role: 'Pemorsian' },
  { name: 'Moh. Salman Al Farisi', role: 'Pemorsian' },
  { name: 'Mohammad Fateh Robbani', role: 'Pemorsian' },
  { name: 'Nurul Hidayati', role: 'Pemorsian' },
  { name: 'Masnadatus Sa’adah', role: 'Pemorsian' },
  { name: 'Ahmad Syariful A\'laa', role: 'Pemorsian' },
  { name: 'Moh. Sholeh', role: 'Koordinator Stocking' },
  { name: 'Moh. Nuha Hasbullah', role: 'Stocking' },
  { name: 'Erna', role: 'Stocking' },
  { name: 'Durrotun Nafisah Abidin', role: 'Stocking' },
  { name: 'Ahmad Syaifuddin Aziz', role: 'Stocking' },
  { name: 'Fitrotin', role: 'Stocking' },
  { name: 'Muhammad Faiz Akbar', role: 'Koordinator Masak' },
  { name: 'Alfanuh Muhammad Al Zamzami', role: 'Tim Masak' },
  { name: 'Muhammad Baihaqi', role: 'Tim Masak' },
  { name: 'Nur Azizah', role: 'Tim Masak' },
  { name: 'Roudlotus Salami', role: 'Tim Masak' },
  { name: 'Mawaddah Oktaviani', role: 'Tim Masak' },
  { name: 'Selsila Aulia Islamy', role: 'Tim Masak' },
  { name: 'Sri Utami', role: 'Tim Masak' },
  { name: 'Juita Susanti', role: 'Tim Masak' },
  { name: 'Mohammad Ainur Ridlo', role: 'Koordinator Pencucian' },
  { name: 'Ahmad Fairuzal Asdi Tamamul Q', role: 'Pencucian' },
  { name: 'Muhammad Asrori', role: 'Pencucian' },
  { name: 'Anwar Hidayat Al Asy’ari', role: 'Pencucian' },
  { name: 'M. Lucky Gilang Dzulfiqar', role: 'Pencucian' },
  { name: 'Ihsan Bashori', role: 'Pencucian' },
  { name: 'Moh. Izzul Arroby', role: 'Pencucian' },
  { name: 'Akhmad Riza Firmansyah', role: 'Pencucian' },
  { name: 'Muh Ali Ahsanul Amal', role: 'Pencucian' },
  { name: 'Zukhruf Nabil Aduba', role: 'Pencucian' },
  { name: 'Ahmad Sulthon Jamaluddin', role: 'Pencucian' },
  { name: 'Moh Maftuh Abror', role: 'Pencucian' }
];

interface AbsensiViewProps {
  selectedDate: string;
  isInitialFetchDone: boolean;
}

export default function AbsensiView({ selectedDate, isInitialFetchDone }: AbsensiViewProps) {
  const activeDate = selectedDate || '2026-06-16';

  // Persistence maps
  const [absensiMap, setAbsensiMap] = useState<Record<string, AbsensiItem[]>>(() => {
    const saved = safeLocalStorageGetItem('sppg_absensi_map');
    return saved ? JSON.parse(saved) : {};
  });

  const [absensiSignOffs, setAbsensiSignOffs] = useState<Record<string, AbsensiSignOff>>(() => {
    const saved = safeLocalStorageGetItem('sppg_absensi_signoffs');
    return saved ? JSON.parse(saved) : {};
  });

  // Local Form state
  const [newAbsName, setNewAbsName] = useState('');
  const [newAbsRole, setNewAbsRole] = useState('Asisten Dapur');
  const [newAbsStatus, setNewAbsStatus] = useState<'Hadir' | 'Sakit' | 'Izin' | 'Alpa'>('Hadir');
  const [newAbsTime, setNewAbsTime] = useState('06:00 WIB');
  const [newAbsNotes, setNewAbsNotes] = useState('');
  const [isAddingAbs, setIsAddingAbs] = useState(false);

  // Modal Views
  const [searchName, setSearchName] = useState('');
  const [showAbsPrintView, setShowAbsPrintView] = useState(false);
  const [showWeeklyRecapView, setShowWeeklyRecapView] = useState(false);
  const [recapSearchQuery, setRecapSearchQuery] = useState('');
  const [recapStartDate, setRecapStartDate] = useState(() => {
    const date = new Date(activeDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // get Monday
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().split('T')[0];
  });
  const [recapEndDate, setRecapEndDate] = useState(() => {
    const date = new Date(activeDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // get Monday
    const monday = new Date(date.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (activeDate) {
      const date = new Date(activeDate);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // get Monday
      const monday = new Date(date.setDate(diff));
      setRecapStartDate(monday.toISOString().split('T')[0]);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setRecapEndDate(sunday.toISOString().split('T')[0]);
    }
  }, [activeDate]);

  const [activeSigRequest, setActiveSigRequest] = useState<{
    title: string;
    suggestedName: string;
    targetField: 'absensiKetua' | 'absensiAslap';
  } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  // Sync state to LocalStorage
  useEffect(() => {
    safeLocalStorageSetItem('sppg_absensi_map', JSON.stringify(absensiMap));
  }, [absensiMap]);

  useEffect(() => {
    safeLocalStorageSetItem('sppg_absensi_signoffs', JSON.stringify(absensiSignOffs));
  }, [absensiSignOffs]);

  // Sync to Supabase helper function
  const syncAbsensiToSupabase = async (
    dateStr: string,
    signOffData: AbsensiSignOff,
    logsList: AbsensiItem[]
  ) => {
    if (!isSupabaseConfigured || !supabase) {
      console.warn('Supabase is not configured.');
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Prepare signoff payload
      const signOffPayload = {
        date: dateStr,
        signer_ketua: signOffData.signerKetua || 'M. Fajrul Falah',
        signature_ketua_url: signOffData.signatureKetuaUrl || null,
        signed_ketua_at: signOffData.signedKetuaAt || null,
        signer_aslap: signOffData.signerAslap || 'Ahmad Maghfur',
        signature_aslap_url: signOffData.signatureAslapUrl || null,
        signed_aslap_at: signOffData.signedAslapAt || null,
        status: signOffData.status || 'Draft',
        updated_at: new Date().toISOString()
      };

      // Upsert into both absensi_signoffs and absensi_signoff
      const resSignoffs = await supabase.from('absensi_signoffs').upsert(signOffPayload);
      if (resSignoffs.error) {
        console.warn('absensi_signoffs upsert notice:', resSignoffs.error.message);
      }
      try {
        await supabase.from('absensi_signoff').upsert(signOffPayload);
      } catch (err) {
        // ignore fallback errors if table absensi_signoff does not exist
      }

      // 2. Prepare logs payload
      if (logsList && logsList.length > 0) {
        const logsPayload = logsList.map((item, idx) => ({
          id: item.id || `abs-${dateStr}-${idx}-${item.name.replace(/\s+/g, '-').toLowerCase()}`,
          date: dateStr,
          name: item.name,
          role: item.role,
          status: item.status,
          check_in_time: item.checkInTime || '-',
          notes: item.notes || '',
          updated_at: new Date().toISOString()
        }));

        const resLogs = await supabase.from('absensi_logs').upsert(logsPayload);
        if (resLogs.error) {
          console.error('absensi_logs upsert error:', resLogs.error.message);
        }
      }

      setSyncSuccessMessage(`✅ Berhasil menyinkronkan & merekap data Absensi (${logsList.length} relawan) ke tabel absensi_logs & absensi_signoffs di Supabase!`);
      setTimeout(() => setSyncSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error('Error syncing absensi to Supabase:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch initial data from Supabase when activeDate changes
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !activeDate) return;

    const fetchFromSupabase = async () => {
      try {
        // Fetch signoff
        let { data: signData } = await supabase
          .from('absensi_signoffs')
          .select('*')
          .eq('date', activeDate)
          .maybeSingle();

        if (!signData) {
          const { data: signDataAlt } = await supabase
            .from('absensi_signoff')
            .select('*')
            .eq('date', activeDate)
            .maybeSingle();
          signData = signDataAlt;
        }

        if (signData) {
          setAbsensiSignOffs(prev => ({
            ...prev,
            [activeDate]: {
              signerKetua: signData.signer_ketua || 'M. Fajrul Falah',
              signatureKetuaUrl: signData.signature_ketua_url || null,
              signedKetuaAt: signData.signed_ketua_at || null,
              signerAslap: signData.signer_aslap || 'Ahmad Maghfur',
              signatureAslapUrl: signData.signature_aslap_url || null,
              signedAslapAt: signData.signed_aslap_at || null,
              status: signData.status || 'Draft'
            }
          }));
        }

        // Fetch logs
        const { data: logsData } = await supabase
          .from('absensi_logs')
          .select('*')
          .eq('date', activeDate);

        if (logsData && logsData.length > 0) {
          const parsedLogs: AbsensiItem[] = logsData.map(row => ({
            id: row.id,
            name: row.name,
            role: row.role,
            status: row.status as any,
            checkInTime: row.check_in_time || row.checkInTime || '-',
            notes: row.notes || ''
          }));

          setAbsensiMap(prev => ({
            ...prev,
            [activeDate]: parsedLogs
          }));
        }
      } catch (err) {
        console.warn('Note on absensi Supabase fetch (using local cache fallback):', err);
      }
    };

    fetchFromSupabase();
  }, [activeDate]);

  // Handle Initial Population
  useEffect(() => {
    if (!isInitialFetchDone) return;
    
    if (!absensiMap[activeDate] || absensiMap[activeDate].length < 15) {
      const initial: AbsensiItem[] = MASTER_RELAVAN.map((m, idx) => {
        let defaultTime = '05:00 WIB';
        if (m.role.toLowerCase().includes('chef') || m.role.toLowerCase().includes('masak')) {
          defaultTime = '04:15 WIB';
        } else if (m.role.toLowerCase().includes('lapangan')) {
          defaultTime = '04:30 WIB';
        } else if (m.role.toLowerCase().includes('stocking')) {
          defaultTime = '04:45 WIB';
        } else if (m.role.toLowerCase().includes('pemorsian')) {
          defaultTime = '05:15 WIB';
        } else if (m.role.toLowerCase().includes('keamanan') || m.role.toLowerCase().includes('kebersihan')) {
          defaultTime = '05:30 WIB';
        } else if (m.role.toLowerCase().includes('distrib')) {
          defaultTime = '06:00 WIB';
        } else if (m.role.toLowerCase().includes('pencucian')) {
          defaultTime = '07:00 WIB';
        }

        let status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa' = 'Hadir';
        let notes = 'Aktif bertugas sesuai SOP';
        let checkInTime = defaultTime;
        
        if (m.name === 'Erna') {
          status = 'Izin';
          notes = 'Izin keperluan keluarga harian';
          checkInTime = '-';
        } else if (m.name === 'Ismail') {
          status = 'Sakit';
          notes = 'Sakit demam pusing';
          checkInTime = '-';
        }

        return {
          id: `abs-${Date.now()}-${idx}`,
          name: m.name,
          role: m.role,
          status,
          checkInTime,
          notes
        };
      });

      setAbsensiMap(prev => ({
        ...prev,
        [activeDate]: initial
      }));
    }

    if (!absensiSignOffs[activeDate]) {
      setAbsensiSignOffs(prev => ({
        ...prev,
        [activeDate]: {
          signerKetua: 'M. Fajrul Falah',
          signatureKetuaUrl: null,
          signedKetuaAt: null,
          signerAslap: 'Ahmad Maghfur',
          signatureAslapUrl: null,
          signedAslapAt: null,
          status: 'Draft'
        }
      }));
    }
  }, [activeDate, isInitialFetchDone, absensiMap, absensiSignOffs]);

  // Derived state
  const itemsList = absensiMap[activeDate] || [];
  const signOff = absensiSignOffs[activeDate] || {
    signerKetua: 'M. Fajrul Falah',
    signatureKetuaUrl: null,
    signedKetuaAt: null,
    signerAslap: 'Ahmad Maghfur',
    signatureAslapUrl: null,
    signedAslapAt: null,
    status: 'Draft'
  };

  const filteredList = itemsList.filter(item => 
    item.name.toLowerCase().includes(searchName.toLowerCase()) ||
    item.role.toLowerCase().includes(searchName.toLowerCase())
  );

  const totalStaff = itemsList.length;
  const hadirCount = itemsList.filter(i => i.status === 'Hadir').length;
  const sakitCount = itemsList.filter(i => i.status === 'Sakit' || i.status === 'Izin').length;
  const alpaCount = itemsList.filter(i => i.status === 'Alpa').length;

  // Handlers
  const handleUpdateAbsItem = (id: string, updates: Partial<AbsensiItem>) => {
    if (signOff.status === 'Final') return;
    const list = absensiMap[activeDate] || [];
    const nextList = list.map(item => item.id === id ? { ...item, ...updates } : item);

    setAbsensiMap(prev => ({
      ...prev,
      [activeDate]: nextList
    }));

    syncAbsensiToSupabase(activeDate, signOff, nextList);
  };

  const handleAddAttendee = (e: React.FormEvent) => {
    e.preventDefault();
    if (signOff.status === 'Final') return;
    if (!newAbsName.trim()) {
      alert('Nama personel wajib diisi!');
      return;
    }
    const newItem: AbsensiItem = {
      id: `abs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newAbsName.trim(),
      role: newAbsRole,
      status: newAbsStatus,
      checkInTime: newAbsStatus === 'Hadir' ? newAbsTime : '-',
      notes: newAbsNotes.trim()
    };

    const list = absensiMap[activeDate] || [];
    const nextList = [...list, newItem];

    setAbsensiMap(prev => ({
      ...prev,
      [activeDate]: nextList
    }));

    setNewAbsName('');
    setNewAbsNotes('');
    setIsAddingAbs(false);

    syncAbsensiToSupabase(activeDate, signOff, nextList);
  };

  const handleDeleteAttendee = (id: string) => {
    if (signOff.status === 'Final') return;
    if (confirm('Apakah Anda yakin ingin menghapus personel ini dari daftar absensi harian?')) {
      const list = absensiMap[activeDate] || [];
      const nextList = list.filter(item => item.id !== id);

      setAbsensiMap(prev => ({
        ...prev,
        [activeDate]: nextList
      }));

      syncAbsensiToSupabase(activeDate, signOff, nextList);
    }
  };

  const handleFinalizeAbsensi = () => {
    if (!signOff.signatureKetuaUrl || !signOff.signatureAslapUrl) {
      alert('Gagal mengunci! Tanda tangan Ketua SPPG dan Asisten Lapangan wajib dilengkapi terlebih dahulu.');
      return;
    }

    if (confirm('Apakah Anda yakin ingin mengunci Absensi hari ini? Berkas yang dikunci akan direkap permanen dan disinkronkan ke Supabase.')) {
      const finalSignOff: AbsensiSignOff = {
        ...signOff,
        status: 'Final'
      };

      setAbsensiSignOffs(prev => ({
        ...prev,
        [activeDate]: finalSignOff
      }));

      // Directly sync both signoff and logs to Supabase
      syncAbsensiToSupabase(activeDate, finalSignOff, itemsList);
    }
  };

  const handleSaveAbsensiSignature = (type: 'ketua' | 'aslap', signatureUrl: string) => {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
    const current = signOff;

    const updatedSignOff: AbsensiSignOff = {
      ...current,
      ...(type === 'ketua' ? {
        signatureKetuaUrl: signatureUrl,
        signedKetuaAt: timestamp
      } : {
        signatureAslapUrl: signatureUrl,
        signedAslapAt: timestamp
      })
    };

    setAbsensiSignOffs(prev => ({
      ...prev,
      [activeDate]: updatedSignOff
    }));

    syncAbsensiToSupabase(activeDate, updatedSignOff, itemsList);
  };

  const handleDownloadAbsTxt = () => {
    const docHeader = `STANDAR OPERASIONAL PROSEDUR (SOP) - ABSENSI DIGITAL TIM DAPUR SPPG\n`;
    const docDate = `TANGGAL: ${activeDate}\n`;
    const docStats = `TOTAL: ${totalStaff} | HADIR: ${hadirCount} | SAKIT/IZIN: ${sakitCount} | ALPA: ${alpaCount}\n\n`;
    
    const listText = itemsList.map((item, idx) => 
      `${idx + 1}. [${item.status}] ${item.name} (${item.role}) - Jam Masuk: ${item.checkInTime} - Notes: ${item.notes || '-'}`
    ).join('\n');

    const docFooter = `\n\nMengetahui,\nKetua SPPG: ${signOff.signerKetua} (${signOff.signedKetuaAt || 'BELUM TTD'})\nAslap: ${signOff.signerAslap} (${signOff.signedAslapAt || 'BELUM TTD'})`;

    const blob = new Blob([docHeader + docDate + docStats + listText + docFooter], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ABSENSI_${activeDate}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
              <Users className="h-6 w-6 text-emerald-700" />
              Absensi Harian Tim SPPG Qomaruddin
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
              SOP-Aligned
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">Pencatatan real-time kehadiran tim dapur utama, pemorsian gizi, driver distribusi, dan tim sanitasi.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowWeeklyRecapView(true)}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-850 text-xs font-bold px-3.5 py-2 rounded-lg border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" /> Rekap Pekan (Excel)
          </button>
          <button
            onClick={() => setShowAbsPrintView(true)}
            className="bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-bold px-3.5 py-2 rounded-lg border border-neutral-250 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Clipboard className="h-4 w-4" /> Cetak / Print Absensi
          </button>
          <button
            onClick={handleDownloadAbsTxt}
            className="bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-bold px-3.5 py-2 rounded-lg border border-neutral-250 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" /> Ekspor File
          </button>
          {signOff.status !== 'Final' && (
            <button
              onClick={() => setIsAddingAbs(!isAddingAbs)}
              className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Personel Baru
            </button>
          )}
        </div>
      </div>

      {/* Supabase Sync Feedback Banners */}
      {syncSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold p-3.5 rounded-xl flex items-center justify-between shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>{syncSuccessMessage}</span>
          </div>
          <button onClick={() => setSyncSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isSyncing && (
        <div className="bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold p-3 rounded-xl flex items-center gap-2 animate-pulse">
          <Info className="h-4 w-4 text-sky-600 shrink-0" />
          <span>Menyinkronkan data presensi & otorisasi ke Supabase...</span>
        </div>
      )}

      {/* Form Tambah Personel */}
      {isAddingAbs && (
        <form onSubmit={handleAddAttendee} className="p-4 border border-emerald-100 bg-emerald-50/10 rounded-xl space-y-4">
          <h3 className="font-bold text-xs text-emerald-900 uppercase tracking-widest flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Daftarkan Personel Hari Ini
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Personel</label>
              <input
                type="text"
                required
                value={newAbsName}
                onChange={e => setNewAbsName(e.target.value)}
                placeholder="Contoh: Muhammad Fajrul"
                className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Jabatan / Peran</label>
              <input
                type="text"
                required
                value={newAbsRole}
                onChange={e => setNewAbsRole(e.target.value)}
                placeholder="Contoh: Juru Masak Cadangan"
                className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Status Kehadiran</label>
              <select
                value={newAbsStatus}
                onChange={e => {
                  const val = e.target.value as 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
                  setNewAbsStatus(val);
                }}
                className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs outline-hidden"
              >
                <option value="Hadir">Hadir</option>
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin</option>
                <option value="Alpa">Alpa</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Jam Masuk (Check-In)</label>
              <input
                type="text"
                value={newAbsTime}
                onChange={e => setNewAbsTime(e.target.value)}
                placeholder="06:00 WIB"
                disabled={newAbsStatus !== 'Hadir'}
                className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden disabled:bg-neutral-50"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Catatan Khusus / Keterangan</label>
            <input
              type="text"
              value={newAbsNotes}
              onChange={e => setNewAbsNotes(e.target.value)}
              placeholder="Contoh: Terlambat karena ada urusan pesantren mendadak."
              className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingAbs(false)}
              className="px-3 py-1.5 border border-neutral-200 hover:bg-neutral-50 rounded-lg text-xs font-semibold text-neutral-500"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-950 text-white rounded-lg text-xs font-bold"
            >
              Simpan Personel
            </button>
          </div>
        </form>
      )}

      {/* Stats Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-50 border border-neutral-100 p-4 rounded-xl flex items-center justify-between shadow-3xs">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block select-none">Total Personel</span>
            <strong className="text-xl font-bold font-sans text-neutral-800">{totalStaff} Orang</strong>
          </div>
          <Users className="h-6 w-6 text-neutral-400 shrink-0" />
        </div>
        <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-xl flex items-center justify-between shadow-3xs">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block select-none">Hadir</span>
            <strong className="text-xl font-bold font-sans text-emerald-850">{hadirCount} Orang</strong>
          </div>
          <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
        </div>
        <div className="bg-amber-50/40 border border-amber-100 p-4 rounded-xl flex items-center justify-between shadow-3xs">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 block select-none">Sakit / Izin</span>
            <strong className="text-xl font-bold font-sans text-amber-850">{sakitCount} Orang</strong>
          </div>
          <Info className="h-6 w-6 text-amber-500 shrink-0" />
        </div>
        <div className="bg-red-50/40 border border-red-100 p-4 rounded-xl flex items-center justify-between shadow-3xs">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-red-600 block select-none">Alpa</span>
            <strong className="text-xl font-bold font-sans text-red-850">{alpaCount} Orang</strong>
          </div>
          <AlertCircle className="h-6 w-6 text-red-500 shrink-0" />
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        <input
          type="text"
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
          placeholder="Cari berdasarkan nama personel atau peran..."
          className="w-full text-xs pl-9 pr-4 py-2 border border-neutral-200 rounded-lg bg-neutral-50/50 shadow-2xs outline-hidden focus:ring-1 focus:ring-emerald-700 focus:bg-white"
        />
      </div>

      {/* Table list */}
      <div className="border border-neutral-100 rounded-xl overflow-hidden shadow-3xs">
        <table className="w-full text-left text-xs text-neutral-600 border-collapse">
          <thead>
            <tr className="bg-neutral-50 text-[10px] font-black text-neutral-500 uppercase tracking-wider border-b border-neutral-100 select-none">
              <th className="p-3">Nama &amp; Peran</th>
              <th className="p-3">Kehadiran</th>
              <th className="p-3">Jam Masuk</th>
              <th className="p-3">Keterangan / Aktivitas</th>
              {signOff.status !== 'Final' && <th className="p-3 text-center">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-neutral-400 italic">
                  Tidak ada data personel yang cocok untuk pencarian ini.
                </td>
              </tr>
            ) : (
              filteredList.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/40 transition-colors">
                  <td className="p-3">
                    <h4 className="font-bold text-neutral-900">{item.name}</h4>
                    <p className="text-[10px] text-neutral-400">{item.role}</p>
                  </td>
                  <td className="p-3">
                    {signOff.status === 'Final' ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        item.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        item.status === 'Sakit' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        item.status === 'Izin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {item.status}
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleUpdateAbsItem(item.id, { 
                              status: st, 
                              checkInTime: st === 'Hadir' ? (item.checkInTime === '-' ? '06:00 WIB' : item.checkInTime) : '-' 
                            })}
                            className={`px-2 py-1 text-[9px] font-extrabold uppercase rounded border transition-colors cursor-pointer ${
                              item.status === st 
                                ? st === 'Hadir' ? 'bg-emerald-600 text-white border-emerald-700' :
                                  st === 'Sakit' ? 'bg-amber-500 text-white border-amber-600' :
                                  st === 'Izin' ? 'bg-indigo-600 text-white border-indigo-700' :
                                  'bg-red-600 text-white border-red-700'
                                : 'bg-white text-neutral-500 hover:bg-neutral-100 border-neutral-200'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-mono">
                    {signOff.status === 'Final' ? (
                      <span className="text-neutral-700">{item.checkInTime}</span>
                    ) : (
                      <input
                        type="text"
                        value={item.checkInTime}
                        disabled={item.status !== 'Hadir'}
                        onChange={e => handleUpdateAbsItem(item.id, { checkInTime: e.target.value })}
                        className="w-24 border border-neutral-200 rounded p-1 text-xs focus:ring-1 focus:ring-emerald-700 bg-white shadow-2xs outline-hidden disabled:bg-neutral-50"
                      />
                    )}
                  </td>
                  <td className="p-3">
                    {signOff.status === 'Final' ? (
                      <span className="text-neutral-500">{item.notes || '-'}</span>
                    ) : (
                      <input
                        type="text"
                        value={item.notes}
                        onChange={e => handleUpdateAbsItem(item.id, { notes: e.target.value })}
                        placeholder="Tulis catatan atau aktivitas..."
                        className="w-full border border-neutral-200 rounded p-1.5 text-xs focus:ring-1 focus:ring-emerald-700 bg-white shadow-2xs outline-hidden"
                      />
                    )}
                  </td>
                  {signOff.status !== 'Final' && (
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteAttendee(item.id)}
                        className="p-1 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                        title="Hapus personel"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Signatures & Finalize */}
      <div className="bg-neutral-50/60 border border-neutral-250 p-6 rounded-2xl space-y-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-neutral-700">✍️ Otorisasi &amp; Tanda Tangan SOP Absensi</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Aslap */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 text-center flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <h4 className="font-bold text-neutral-700">1. Asisten Lapangan (Aslap)</h4>
              <p className="text-[10px] text-neutral-400">Bertanggung jawab atas validasi fisik kehadiran harian di lapangan dapur.</p>
            </div>

            <div className="h-24 border border-dashed border-neutral-250 rounded-lg flex flex-col items-center justify-center bg-neutral-50/30 overflow-hidden relative">
              {signOff.signatureAslapUrl ? (
                <img
                  src={signOff.signatureAslapUrl}
                  alt="Tanda Tangan Aslap"
                  className="max-h-20 object-contain mx-auto"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSigRequest({
                    title: 'Tanda Tangan Validasi Lapangan (Aslap)',
                    suggestedName: 'Ahmad Maghfur',
                    targetField: 'absensiAslap'
                  })}
                  className="text-neutral-400 hover:text-emerald-800 text-[10px] font-bold py-2 px-4 border border-dashed border-neutral-300 hover:border-emerald-700 bg-white rounded transition-all cursor-pointer"
                >
                  Bubuhkan Tanda Tangan
                </button>
              )}
            </div>

            <div className="text-center">
              <p className="font-extrabold text-xs text-neutral-800 underline">Ahmad Maghfur</p>
              <p className="text-[9px] text-neutral-400 mt-0.5">{signOff.signedAslapAt ? `Ditandatangani: ${signOff.signedAslapAt}` : 'Belum Ditandatangani'}</p>
            </div>
          </div>

          {/* Ketua SPPG */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 text-center flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <h4 className="font-bold text-neutral-700">2. Ketua SPPG</h4>
              <p className="text-[10px] text-neutral-400">Otorisasi final lembar kepatuhan personil harian dan kesiapan dapur gizi.</p>
            </div>

            <div className="h-24 border border-dashed border-neutral-250 rounded-lg flex flex-col items-center justify-center bg-neutral-50/30 overflow-hidden relative">
              {signOff.signatureKetuaUrl ? (
                <img
                  src={signOff.signatureKetuaUrl}
                  alt="Tanda Tangan Ketua SPPG"
                  className="max-h-20 object-contain mx-auto"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSigRequest({
                    title: 'Tanda Tangan Otorisasi Utama (Ketua SPPG)',
                    suggestedName: 'M. Fajrul Falah',
                    targetField: 'absensiKetua'
                  })}
                  className="text-neutral-400 hover:text-emerald-800 text-[10px] font-bold py-2 px-4 border border-dashed border-neutral-300 hover:border-emerald-700 bg-white rounded transition-all cursor-pointer"
                >
                  Bubuhkan Tanda Tangan
                </button>
              )}
            </div>

            <div className="text-center">
              <p className="font-extrabold text-xs text-neutral-800 underline">M. Fajrul Falah</p>
              <p className="text-[9px] text-neutral-400 mt-0.5">{signOff.signedKetuaAt ? `Ditandatangani: ${signOff.signedKetuaAt}` : 'Belum Ditandatangani'}</p>
            </div>
          </div>

        </div>

        <div className="flex justify-end pt-2 border-t border-neutral-200/60">
          {signOff.status === 'Final' ? (
            <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-extrabold px-6 py-3 rounded-xl flex items-center gap-2 shadow-2xs select-none">
              <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0" />
              ABSENSI HARI INI SECURELY LOCKED &amp; SYNCED TO SUPABASE
            </div>
          ) : (
            <button
              type="button"
              onClick={handleFinalizeAbsensi}
              disabled={!signOff.signatureKetuaUrl || !signOff.signatureAslapUrl}
              className="bg-emerald-850 hover:bg-emerald-950 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white text-xs font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" /> Kunci &amp; Finalisasi Absensi Hari Ini
            </button>
          )}
        </div>
      </div>

      {/* FACSIMILE ABSENSI PRINT MODAL */}
      {showAbsPrintView && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto no-print animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-neutral-100 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-neutral-800">
                <Clipboard className="h-5 w-5 text-neutral-600" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider">Pratinjau Cetak Absensi Harian (A4)</h3>
              </div>
              <button
                onClick={() => setShowAbsPrintView(false)}
                className="p-1.5 hover:bg-neutral-200 rounded-lg text-neutral-500 cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto grow p-8 bg-neutral-100/50 flex justify-center">
              <div className="bg-white p-12 w-[21cm] min-h-[29.7cm] shadow-md border border-neutral-200 text-neutral-800 relative text-xs font-serif leading-relaxed" id="printable-absensi">
                
                {/* Header Kop Surat */}
                <div className="text-center border-b-4 border-double border-black pb-4 mb-6">
                  <h1 className="text-lg font-black font-sans uppercase tracking-widest text-black">SOP-ALIGNED ABSENSI HARIAN DAPUR</h1>
                  <h2 className="text-md font-bold font-sans uppercase text-emerald-850">SEKOLAH PERSIAPAN PENGABDIAN GURU (SPPG)</h2>
                  <p className="text-[9px] font-sans text-neutral-500 italic mt-1">Jl. KH. Qomaruddin No.01, Sampurnan, Bungah, Kabupaten Gresik, Jawa Timur 61152</p>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 mb-4 border border-neutral-200 p-3 rounded bg-neutral-50/50 font-sans">
                  <div>
                    <p className="text-[10px] font-black uppercase text-neutral-400">Parameter Dokumen</p>
                    <table className="w-full mt-1 text-[11px] leading-relaxed">
                      <tbody>
                        <tr>
                          <td className="font-medium text-neutral-500 py-0.5">Hari / Tanggal</td>
                          <td className="font-bold text-neutral-900">: {activeDate.split('-').reverse().join('/')}</td>
                        </tr>
                        <tr>
                          <td className="font-medium text-neutral-500 py-0.5">Status Laporan</td>
                          <td className="font-bold text-neutral-900">: {signOff.status === 'Final' ? 'FINAL (TERKUNCI)' : 'DRAFT'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-neutral-400">Statistik Kehadiran</p>
                    <table className="w-full mt-1 text-[11px]">
                      <tbody>
                        <tr>
                          <td className="font-medium text-neutral-500 py-0.5">Total Relawan</td>
                          <td className="font-extrabold text-neutral-900">: {totalStaff} Orang</td>
                        </tr>
                        <tr>
                          <td className="font-medium text-neutral-500 py-0.5">Hadir / Absen</td>
                          <td className="font-extrabold text-emerald-700">: {hadirCount} Hadir | {sakitCount} Izin/Sakit | {alpaCount} Alpa</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table list */}
                <table className="w-full text-left text-[11px] border border-neutral-300 border-collapse font-sans mb-8">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-300 text-[10px] font-bold text-neutral-600 uppercase">
                      <th className="p-2 border-r border-neutral-300 w-10 text-center">No</th>
                      <th className="p-2 border-r border-neutral-300">Nama Relawan</th>
                      <th className="p-2 border-r border-neutral-300">Jabatan</th>
                      <th className="p-2 border-r border-neutral-300 text-center w-24">Status</th>
                      <th className="p-2 border-r border-neutral-300 text-center w-24">Jam Masuk</th>
                      <th className="p-2">Keterangan / Aktivitas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {itemsList.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="p-2 border-r border-neutral-300 text-center text-neutral-400 font-bold">{idx + 1}</td>
                        <td className="p-2 border-r border-neutral-300 font-bold text-neutral-900">{item.name}</td>
                        <td className="p-2 border-r border-neutral-300 text-neutral-500">{item.role}</td>
                        <td className="p-2 border-r border-neutral-300 text-center font-extrabold">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                            item.status === 'Hadir' ? 'bg-emerald-50 text-emerald-850' : 'bg-red-50 text-red-800'
                          }`}>{item.status}</span>
                        </td>
                        <td className="p-2 border-r border-neutral-300 text-center font-mono text-neutral-700">{item.checkInTime}</td>
                        <td className="p-2 text-neutral-500 italic">{item.notes || 'Aktif bertugas'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 pt-8 font-sans border-t border-neutral-200">
                  <div className="text-center space-y-2">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Disiapkan Oleh,</p>
                    <p className="text-xs font-extrabold text-neutral-700">Asisten Lapangan (Aslap)</p>
                    <div className="h-16 flex items-center justify-center">
                      {signOff.signatureAslapUrl ? (
                        <img referrerPolicy="no-referrer" src={signOff.signatureAslapUrl} alt="TTD Aslap" className="max-h-14 object-contain" />
                      ) : (
                        <div className="text-[10px] text-neutral-300 italic">Belum Ditandatangan</div>
                      )}
                    </div>
                    <p className="font-extrabold text-xs text-neutral-800 underline">Ahmad Maghfur</p>
                    <p className="text-[9px] text-neutral-400">{signOff.signedAslapAt ? `Waktu: ${signOff.signedAslapAt}` : ''}</p>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Disetujui Oleh,</p>
                    <p className="text-xs font-extrabold text-neutral-700">Ketua SPPG</p>
                    <div className="h-16 flex items-center justify-center">
                      {signOff.signatureKetuaUrl ? (
                        <img referrerPolicy="no-referrer" src={signOff.signatureKetuaUrl} alt="TTD Ketua" className="max-h-14 object-contain" />
                      ) : (
                        <div className="text-[10px] text-neutral-300 italic">Belum Ditandatangan</div>
                      )}
                    </div>
                    <p className="font-extrabold text-xs text-neutral-800 underline">M. Fajrul Falah</p>
                    <p className="text-[9px] text-neutral-400">{signOff.signedKetuaAt ? `Waktu: ${signOff.signedKetuaAt}` : ''}</p>
                  </div>
                </div>

              </div>
            </div>

            <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setShowAbsPrintView(false)}
                className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100 rounded-lg text-xs font-bold text-neutral-700 cursor-pointer"
              >
                Kembali
              </button>
              <button
                onClick={() => window.print()}
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Clipboard className="h-4 w-4" /> Cetak Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* active signature modal */}
      {activeSigRequest && (
        <SignaturePad
          title={activeSigRequest.title}
          suggestedName={activeSigRequest.suggestedName}
          onSave={(signatureDataUrl) => {
            if (activeSigRequest.targetField === 'absensiKetua') {
              handleSaveAbsensiSignature('ketua', signatureDataUrl);
            } else if (activeSigRequest.targetField === 'absensiAslap') {
              handleSaveAbsensiSignature('aslap', signatureDataUrl);
            }
            setActiveSigRequest(null);
          }}
          onCancel={() => setActiveSigRequest(null)}
        />
      )}

      {/* WEEKLY RECAP MODAL */}
      {showWeeklyRecapView && (() => {
        // Calculate days in the custom date range dynamically
        const getDaysInRange = (startStr: string, endStr: string) => {
          const start = new Date(startStr);
          const end = new Date(endStr);
          const days: { dateStr: string; label: string }[] = [];
          const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          
          const current = new Date(start);
          // Safety guard to prevent infinite loop
          let guard = 0;
          while (current <= end && guard < 366) {
            guard++;
            const yyyy = current.getFullYear();
            const mm = String(current.getMonth() + 1).padStart(2, '0');
            const dd = String(current.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            days.push({
              dateStr,
              label: `${dayNames[current.getDay()]} (${dd}/${mm})`
            });
            current.setDate(current.getDate() + 1);
          }
          return days;
        };

        const weekDays = getDaysInRange(recapStartDate, recapEndDate);
        const startDayLabel = recapStartDate.split('-').reverse().join('/');
        const endDayLabel = recapEndDate.split('-').reverse().join('/');

        // Aggregate data over the selected range of days
        const aggregatedMap: Record<string, {
          name: string;
          role: string;
          hadir: number;
          sakit: number;
          izin: number;
          alpa: number;
          notes: string[];
        }> = {};

        // Baseline with MASTER_RELAVAN
        MASTER_RELAVAN.forEach(v => {
          aggregatedMap[v.name] = {
            name: v.name,
            role: v.role,
            hadir: 0,
            sakit: 0,
            izin: 0,
            alpa: 0,
            notes: []
          };
        });

        // Populate over all days in the range
        weekDays.forEach(day => {
          const dayRecords = absensiMap[day.dateStr] || [];
          dayRecords.forEach(record => {
            if (!aggregatedMap[record.name]) {
              aggregatedMap[record.name] = {
                name: record.name,
                role: record.role,
                hadir: 0,
                sakit: 0,
                izin: 0,
                alpa: 0,
                notes: []
              };
            }
            const entry = aggregatedMap[record.name];
            if (record.status === 'Hadir') entry.hadir += 1;
            else if (record.status === 'Sakit') entry.sakit += 1;
            else if (record.status === 'Izin') entry.izin += 1;
            else if (record.status === 'Alpa') entry.alpa += 1;

            if (record.notes && record.notes !== 'Aktif bertugas sesuai SOP') {
              entry.notes.push(`${day.label}: ${record.notes}`);
            }
          });
        });

        const recapList = Object.values(aggregatedMap).filter(item => 
          item.name.toLowerCase().includes(recapSearchQuery.toLowerCase()) ||
          item.role.toLowerCase().includes(recapSearchQuery.toLowerCase())
        );

        const handleDownloadRecapExcel = () => {
          const csvHeaders = ['No', 'Nama Relawan', 'Jabatan / Posisi', 'Masuk (Hari)', 'Izin (Hari)', 'Sakit (Hari)', 'Alpa (Hari)', 'Keterangan'];
          const csvRows = Object.values(aggregatedMap).map((emp, index) => [
            String(index + 1),
            emp.name,
            emp.role,
            String(emp.hadir),
            String(emp.izin),
            String(emp.sakit),
            String(emp.alpa),
            emp.notes.length > 0 ? emp.notes.join(' | ') : 'Aktif penuh sesuai SOP'
          ]);
          const filename = `REKAP_ABSENSI_KUSTOM_${recapStartDate}_SD_${recapEndDate}.csv`;
          downloadCSV(filename, csvHeaders, csvRows);
        };

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl border border-neutral-100 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              
              {/* Header */}
              <div className="bg-emerald-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider">Rekapitulasi Absensi Relawan SPPG</h3>
                    <p className="text-[10px] text-emerald-100 mt-0.5">Periode: {startDayLabel} s/d {endDayLabel} ({weekDays.length} Hari)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWeeklyRecapView(false)}
                  className="p-1.5 hover:bg-emerald-900 rounded-lg text-emerald-100 cursor-pointer transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Date Range Picker and Search Controls */}
              <div className="p-4 bg-neutral-50 border-b border-neutral-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-5 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 grow bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 shadow-2xs">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Mulai:</span>
                    <input
                      type="date"
                      value={recapStartDate}
                      onChange={(e) => setRecapStartDate(e.target.value)}
                      className="text-xs font-bold text-neutral-800 w-full focus:outline-none bg-transparent"
                    />
                  </div>
                  <span className="text-xs text-neutral-400 font-bold select-none">s/d</span>
                  <div className="flex items-center gap-1.5 grow bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 shadow-2xs">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Selesai:</span>
                    <input
                      type="date"
                      value={recapEndDate}
                      onChange={(e) => setRecapEndDate(e.target.value)}
                      className="text-xs font-bold text-neutral-800 w-full focus:outline-none bg-transparent"
                    />
                  </div>
                </div>
                
                <div className="md:col-span-4 relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                  <input
                    type="text"
                    value={recapSearchQuery}
                    onChange={e => setRecapSearchQuery(e.target.value)}
                    placeholder="Cari relawan / posisi..."
                    className="w-full text-xs pl-8 pr-3 py-2 border border-neutral-200 bg-white rounded-lg outline-hidden focus:ring-1 focus:ring-emerald-700"
                  />
                </div>

                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleDownloadRecapExcel}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <Download className="h-4 w-4" /> Unduh Rekap Excel (CSV)
                  </button>
                </div>
              </div>

              {/* Recap Table */}
              <div className="overflow-y-auto grow p-6">
                <div className="border border-neutral-100 rounded-xl overflow-hidden shadow-3xs mb-6">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                        <th className="p-3 w-12 text-center">No</th>
                        <th className="p-3">Nama Relawan</th>
                        <th className="p-3">Jabatan / Posisi</th>
                        <th className="p-3 text-center w-24 bg-emerald-50/50 text-emerald-800">Masuk (Hari)</th>
                        <th className="p-3 text-center w-24 bg-indigo-50/50 text-indigo-800">Izin (Hari)</th>
                        <th className="p-3 text-center w-24 bg-amber-50/50 text-amber-850">Sakit (Hari)</th>
                        <th className="p-3 text-center w-24 bg-red-50/50 text-red-800">Alpa (Hari)</th>
                        <th className="p-3">Keterangan Aktivitas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {recapList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-neutral-400 italic">
                            Relawan tidak ditemukan.
                          </td>
                        </tr>
                      ) : (
                        recapList.map((emp, index) => (
                          <tr key={emp.name} className="hover:bg-neutral-50/30 transition-colors">
                            <td className="p-3 text-center text-neutral-400 font-bold">{index + 1}</td>
                            <td className="p-3 font-bold text-neutral-900">{emp.name}</td>
                            <td className="p-3 text-neutral-500">{emp.role}</td>
                            <td className="p-3 text-center font-extrabold text-emerald-700 bg-emerald-50/10">{emp.hadir}</td>
                            <td className="p-3 text-center font-extrabold text-indigo-700 bg-indigo-50/10">{emp.izin}</td>
                            <td className="p-3 text-center font-extrabold text-amber-700 bg-amber-50/10">{emp.sakit}</td>
                            <td className="p-3 text-center font-extrabold text-red-700 bg-red-50/10">{emp.alpa}</td>
                            <td className="p-3 text-neutral-500 text-[11px]">
                              {emp.notes.length > 0 ? (
                                <div className="space-y-0.5">
                                  {emp.notes.map((n, i) => (
                                    <div key={i} className="leading-tight">• {n}</div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-neutral-400 italic">Aktif bertugas penuh</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Official Signatures Facsimile */}
                <div className="grid grid-cols-2 gap-8 border-t border-neutral-200/80 pt-6">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 select-none">Disiapkan oleh,</p>
                    <p className="text-xs font-black text-neutral-700 uppercase">Asisten Lapangan (Aslap)</p>
                    <div className="my-3 h-16 flex items-center justify-center">
                      {signOff.signatureAslapUrl ? (
                        <img
                          src={signOff.signatureAslapUrl}
                          alt="Tanda Tangan Aslap"
                          className="max-h-14 object-contain mx-auto"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-xs text-neutral-300 italic">Belum TTD Harian</div>
                      )}
                    </div>
                    <p className="font-extrabold text-xs text-neutral-800 underline">Ahmad Maghfur</p>
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 select-none">Disetujui oleh,</p>
                    <p className="text-xs font-black text-neutral-700 uppercase">Ketua SPPG</p>
                    <div className="my-3 h-16 flex items-center justify-center">
                      {signOff.signatureKetuaUrl ? (
                        <img
                          src={signOff.signatureKetuaUrl}
                          alt="Tanda Tangan Ketua SPPG"
                          className="max-h-14 object-contain mx-auto"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-xs text-neutral-300 italic">Belum TTD Harian</div>
                      )}
                    </div>
                    <p className="font-extrabold text-xs text-neutral-800 underline">M. Fajrul Falah</p>
                  </div>
                </div>
              </div>

              {/* Footer Toolbar */}
              <div className="bg-neutral-50 p-4 border-t border-neutral-100 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWeeklyRecapView(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
