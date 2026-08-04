import React, { useState, useEffect } from 'react';
import { 
  Package, Wrench, ShieldCheck, ShoppingCart, Truck, Calendar, Sparkles,
  Camera, Users, FileText, CheckCircle, Search, AlertCircle, Plus, ClipboardCheck, ArrowRight, FileSpreadsheet,
  Trash2, Loader2, RefreshCw, Check, X, Code, Clipboard, ShieldAlert, CheckCircle2, Info,
  Save, Archive, Download, ExternalLink
} from 'lucide-react';
import { DayMenu, UserRole, DRIVERS_LIST } from '../types';
import { supabase, isSupabaseConfigured, UserProfile } from '../lib/supabase';
import { safeLocalStorageSetItem, safeLocalStorageGetItem } from '../lib/storage';
import { uploadToCloudinary, isCloudinaryConfigured } from '../lib/cloudinary';
import SignaturePad from './SignaturePad';
import BASTView from './BASTView';
import SuratJalanView from './SuratJalanView';
import OrganoleptikView from './OrganoleptikView';
import PortionMasterView, { PortionConfig } from './PortionMasterView';
import AbsensiView from './AbsensiView';
import IncomingGoodsView from './IncomingGoodsView';
import StockOpnameView from './StockOpnameView';
import StockOperasionalView from './StockOperasionalView';
import DashboardAdminView from './DashboardAdminView';


// Real schemas for SQL integration
export interface SisaStokItem {
  id: string;
  item_name: string;
  category: string;
  quantity: string;
  condition: string;
  action_plan: string;
  created_by?: string;
  created_at?: string;
}

export interface OrderRequestItem {
  id: string;
  item_name: string;
  qty: string;
  reason: string;
  category: 'alat' | 'operasional';
  status: 'pending' | 'disetujui' | 'ditolak' | 'ditolak_admin_utama';
  created_by?: string;
  created_at?: string;
  notes?: string;
}

export interface VolunteerComplaintItem {
  id: string;
  source: string;
  category: string;
  complaint_text: string;
  action_taken?: string;
  status: 'pending' | 'selesai';
  created_by?: string;
  created_at?: string;
}

interface MockModulesProps {
  moduleIndex: number;
  onSetMenu: (date: string, items: string[]) => void;
  allDayMenus?: DayMenu[];
  onSaveMenu?: (date: string, menuList: string[]) => void;
  onGenerateSOPs?: (date: string, menuList: string[]) => void;
  onDeleteMenu?: (date: string) => void;
  currentUserRole?: UserRole;
  loggedInUser?: UserProfile | null;
  selectedDate?: string;
  sops?: any[];
  setSops?: any;
  onGoToTab?: (tabNum: number) => void;
  onSaveSopsToCloud?: (date?: string) => Promise<{ success: boolean; message: string }>;
}

const DISTRIBUTION_LOCATIONS = [
  "MA Assa'adah",
  "MTS Assa'adah II",
  "SMA Assa'adah",
  "SMK Assa'adah",
  "Desa Sidokumpul",
  "Desa Sukowati"
];

const PRESET_SUGGESTIONS = [
  { name: 'Nasi Krawu Bungah', items: ['Nasi Putih', 'Krawu Ayam Bungah', 'Tempe Goreng Ketumbar', 'Kupasan Timun Segar', 'Sambal Serundeng', 'Pisang'] },
  { name: 'Soto Lamongan Mantap', items: ['Nasi Gurih', 'Soto Ayam Lamongan', 'Telur Asin Madura', 'Krupuk Bawang', 'Jeruk Manis'] },
  { name: 'Ayam Geprek Pedas', items: ['Nasi Putih', 'Ayam Geprek Sambal Korek', 'Tumis Kangkung Belacan', 'Khrupuk Udang', 'Pisang Ambon'] },
  { name: 'Rawon Sapi Tradisional', items: ['Nasi Putih', 'Rawon Daging Sapi', 'Mendol Tempe', 'Kecambah Segar & Nipis', 'Semangka Merah'] },
  { name: 'Gulai Bandeng Segar', items: ['Nasi Putih', 'Gulai Ikan Bandeng', 'Sayur Bobor Bayam Labu', 'Tahu Goreng Tepung', 'Melon Segar'] }
];

// Reusable Component for Shipping and Delivery Documentation (Ompreng, BAST, Surat Jalan, Organoleptik)
function ShippingDocPanel({
  type,
  title,
  description,
  icon: IconComponent,
  loggedInUser,
  currentUserRole,
  shippingDocs,
  setShippingDocs,
  selectedDate,
  allDayMenus
}: {
  type: 'ompreng' | 'serah_terima' | 'surat_jalan' | 'organoleptik';
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  loggedInUser?: UserProfile | null;
  currentUserRole: UserRole;
  shippingDocs: any[];
  setShippingDocs: React.Dispatch<React.SetStateAction<any[]>>;
  selectedDate: string;
  allDayMenus?: DayMenu[];
}) {
  const [filterDateMode, setFilterDateMode] = useState<'selected' | 'all'>('selected');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form states
  const [vehicleNumber, setVehicleNumber] = useState('W 8006 EG');
  const [receiverName, setReceiverName] = useState('');
  const [comments, setComments] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [driverName, setDriverName] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadFileError, setUploadFileError] = useState<string | null>(null);
  
  // Organoleptik legacy specifics (retained for compatibility)
  const [organoleptikRasa, setOrganoleptikRasa] = useState('Sangat Layak (Segar & Gurih)');
  const [organoleptikAroma, setOrganoleptikAroma] = useState('Sangat Harum');
  const [organoleptikTekstur, setOrganoleptikTekstur] = useState('Matang Sempurna');
  const [organoleptikSuhu, setOrganoleptikSuhu] = useState('68');

  // Previewing image popup state
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

  // --- NEW HIGH-FIDELITY DIGITAL FORM STATES ---
  
  // Surat Jalan form states:
  const [sjNo, setSjNo] = useState('');
  const [sjKepada, setSjKepada] = useState('');
  const [sjWaktu, setSjWaktu] = useState('11:00 WIB');
  const [sjDriver, setSjDriver] = useState('');
  const [sjRows, setSjRows] = useState<{ id: string; jenis: string; porsi: number; alatSebelum: number; alatSesudah: number; keterangan: string }[]>([]);

  // BAST form states:
  const [bastNo, setBastNo] = useState('');
  const [bastDriver, setBastDriver] = useState('');
  const [bastSekolah, setBastSekolah] = useState('');
  const [bastPenerima, setBastPenerima] = useState('');
  const [bastBarang, setBastBarang] = useState('PAKET PROGRAM MAKAN BERGIZI GRATIS');
  const [bastJumlah, setBastJumlah] = useState(265);
  const [bastWaktu, setBastWaktu] = useState('11:15 WIB');

  // Form Signature States
  const [tempSjSignatureAslap, setTempSjSignatureAslap] = useState<string>('');
  const [tempSjSignatureReceiver, setTempSjSignatureReceiver] = useState<string>('');
  const [tempBastSignatureDriver, setTempBastSignatureDriver] = useState<string>('');
  const [tempBastSignatureReceiver, setTempBastSignatureReceiver] = useState<string>('');

  // Signature pad modal trigger state
  const [activeSigRequest, setActiveSigRequest] = useState<{
    docId?: string;
    targetField: 'sjSignatureAslap' | 'sjSignatureReceiver' | 'bastSignatureDriver' | 'bastSignatureReceiver';
    title: string;
    suggestedName: string;
  } | null>(null);

  // Organoleptik detailed form states:
  const [orlepJam, setOrlepJam] = useState('11:30 WIB');
  const [orlepPanelis, setOrlepPanelis] = useState('');
  const [orlepDesa, setOrlepDesa] = useState('Bungah');
  const [orlepMenu, setOrlepMenu] = useState('');
  const [orlepKritik, setOrlepKritik] = useState('');
  const [orlepGrid, setOrlepGrid] = useState<Record<string, number>>({
    MP_rasa: 4, MP_warna: 4, MP_aroma: 4, MP_tekstur: 4,
    LH_rasa: 4, LH_warna: 4, LH_aroma: 4, LH_tekstur: 4,
    LN_rasa: 4, LN_warna: 4, LN_aroma: 4, LN_tekstur: 4,
    SY_rasa: 4, SY_warna: 4, SY_aroma: 4, SY_tekstur: 4,
    B_rasa: 4, B_warna: 4, B_aroma: 4, B_tekstur: 4,
  });

  const [activeDocView, setActiveDocView] = useState<any | null>(null);

  const generateAbbrev = (schoolName: string) => {
    let abbrev = 'MA'; // default fallback
    const upper = (schoolName || '').toUpperCase();
    if (upper.includes('SMA')) {
      abbrev = 'SMA';
    } else if (upper.includes('SMK')) {
      abbrev = 'SMK';
    } else if (upper.includes('MTS') || upper.includes('TSANAWIYAH')) {
      abbrev = 'MTS';
    } else if (upper.includes('MA') || upper.includes('ALIYAH')) {
      abbrev = 'MA';
    } else {
      const match = upper.match(/\b(MA|SMA|SMK|MTS)\b/);
      if (match) {
        abbrev = match[1];
      }
    }
    return abbrev;
  };

  const getBastAutoNumber = (dateStr: string, schoolName: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    const abbrev = generateAbbrev(schoolName);
    return `${day}/${abbrev}/BAST/MBGQOM/${month}/${year}`;
  };

  const getSjAutoNumber = (dateStr: string, schoolName: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    const abbrev = generateAbbrev(schoolName);
    return `${day}/${abbrev}/SJ/MBGQOM/${month}/${year}`;
  };

  // Auto Generate BAST Number in real-time as user types school name or changes date
  useEffect(() => {
    if (selectedDate) {
      const num = getBastAutoNumber(selectedDate, bastSekolah);
      setBastNo(num);
    }
  }, [selectedDate, bastSekolah]);

  // Auto Generate Surat Jalan Number in real-time as user types school name or changes date
  useEffect(() => {
    if (selectedDate) {
      const num = getSjAutoNumber(selectedDate, sjKepada);
      setSjNo(num);
    }
  }, [selectedDate, sjKepada]);

  const handleUpdateDocumentSignature = (docId: string, field: string, signatureDataUrl: string) => {
    setShippingDocs(prev => prev.map(doc => {
      if (doc.id === docId) {
        return {
          ...doc,
          [field]: signatureDataUrl
        };
      }
      return doc;
    }));
    // Update activeDocView if it is currently open
    if (activeDocView && activeDocView.id === docId) {
      setActiveDocView(prev => ({
        ...prev,
        [field]: signatureDataUrl
      }));
    }
  };

  // Helper to split date into Indonesian written words
  const getIndonesianDateText = (dateStr: string) => {
    if (!dateStr) return { dayName: 'Selasa', dateNum: '16', monthName: 'Juni', yearNum: '2026' };
    const dateObj = new Date(dateStr);
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = parseInt(parts[1]) - 1;
      const d = parseInt(parts[2]);
      const localDate = new Date(parseInt(y), m, d);
      return {
        dayName: dayNames[localDate.getDay()],
        dateNum: d.toString(),
        monthName: monthNames[m],
        yearNum: y
      };
    }
    return {
      dayName: dayNames[dateObj.getDay()] || 'Selasa',
      dateNum: dateObj.getDate().toString() || '16',
      monthName: monthNames[dateObj.getMonth()] || 'Juni',
      yearNum: dateObj.getFullYear().toString() || '2026'
    };
  };

  // Pre-populate form variables based on selectedDate & environment context
  useEffect(() => {
    if (selectedDate) {
      const dateInfo = getIndonesianDateText(selectedDate);
      const parts = selectedDate.split('-');
      
      // Portions defaults - if active day menu has portions, use it, otherwise 265
      const currentDayMenu = allDayMenus?.find(m => m.date === selectedDate);
      const calculatedPorsi = (currentDayMenu as any)?.portionsCount || 265;

      // 1. Surat Jalan defaults
      setSjKepada(receiverName || 'Madrasah Aliyah Qomaruddin Bungah');
      setSjDriver(loggedInUser?.fullName || 'Bpk. Sholeh (Driver)');
      setSjRows([
        { id: '1', jenis: 'Paket Program Makan Bergizi Gratis', porsi: calculatedPorsi, alatSebelum: calculatedPorsi, alatSesudah: calculatedPorsi, keterangan: 'Hangat & Lengkap' },
        { id: '2', jenis: 'Buah Melon Potong Segar', porsi: calculatedPorsi, alatSebelum: 0, alatSesudah: 0, keterangan: 'Kondisi Baik' },
        { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: calculatedPorsi, alatSebelum: 0, alatSesudah: 0, keterangan: 'Karton Utuh' }
      ]);

      // 2. BAST defaults
      if (parts.length === 3) {
        setBastNo(`087/BAST-MBG/SPPGBB2/${parts[1]}/${parts[0]}`);
      } else {
        setBastNo('087/BAST-MBG/SPPGBB2/06/2026');
      }
      setBastDriver(loggedInUser?.fullName || 'Bpk. Sholeh (Driver)');
      setBastSekolah(receiverName || 'Madrasah Aliyah Qomaruddin Bungah');
      setBastPenerima(receiverName || 'Ibu Aminah, S.Pd');
      setBastJumlah(calculatedPorsi);
      setDriverName(loggedInUser?.role === UserRole.DRIVER ? loggedInUser.fullName : DRIVERS_LIST[0]);

      // 3. Organoleptik defaults
      const menuStr = currentDayMenu ? currentDayMenu.menuList.join(', ') : 'Nasi Krawu Bungah, Tempe Goreng, Timun, Melon';
      setOrlepMenu(menuStr);
      setOrlepPanelis(loggedInUser?.fullName || 'Avianti Rahma Dianita');
      setOrlepGrid({
        MP_rasa: 4, MP_warna: 4, MP_aroma: 4, MP_tekstur: 4,
        LH_rasa: 4, LH_warna: 4, LH_aroma: 4, LH_tekstur: 4,
        LN_rasa: 4, LN_warna: 4, LN_aroma: 4, LN_tekstur: 4,
        SY_rasa: 4, SY_warna: 4, SY_aroma: 4, SY_tekstur: 4,
        B_rasa: 5, B_warna: 5, B_aroma: 5, B_tekstur: 4,
      });
    }
  }, [selectedDate, allDayMenus, loggedInUser, showAddForm]);

  // Quick preset image simulator for easy testing without real files
  const cameraPresets = {
    ompreng: [
      {
        name: 'Ompreng di Bagasi Mobil',
        url: 'https://images.unsplash.com/photo-1594212699903-ec8a3cee50f6?w=500&auto=format&fit=crop&q=80',
        note: 'Kotak ompreng siap kirim dalam mobil operasional.'
      },
      {
        name: 'Tumpukan Kontainer Bersih',
        url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=500&auto=format&fit=crop&q=80',
        note: 'Kontainer makanan stainless tertumpuk rapi.'
      }
    ],
    serah_terima: [
      {
        name: 'Lembar BAST Ditandatangani',
        url: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=500&auto=format&fit=crop&q=80',
        note: 'Dokumen serah terima fisik bermeterai/berparaf.'
      }
    ],
    surat_jalan: [
      {
        name: 'Surat Jalan dengan Cap Basah',
        url: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=80',
        note: 'Dokumen surat jalan resmi dancap basah SPPG.'
      }
    ],
    organoleptik: [
      {
        name: 'Uji Termometer Gizi Sup',
        url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
        note: 'Sampel sup sayur hangat diuji sensorik & suhu.'
      }
    ]
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 1. Instantly read as local dataURL for immediate UI feedback/preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // 2. Perform background Cloudinary upload
      try {
        setIsUploadingFile(true);
        setUploadFileError(null);
        
        const cdnUrl = await uploadToCloudinary(file, 'image');
        setImageUrl(cdnUrl);
      } catch (err: any) {
        console.warn('Error uploading file to Cloudinary:', err);
        setUploadFileError(err.message || 'Gagal mengunggah dokumentasi ke Cloudinary.');
      } finally {
        setIsUploadingFile(false);
      }
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalImageUrl = imageUrl;
    if (!finalImageUrl) {
      if (type === 'serah_terima') {
        finalImageUrl = 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=500&auto=format&fit=crop&q=80'; // clean document mockup
      } else if (type === 'surat_jalan') {
        finalImageUrl = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80'; // delivery document mockup
      } else {
        alert('Silakan unggah foto fisik lembar dokumen atau gunakan gambar simulasi kamera.');
        return;
      }
    }

    // Compose rich metadata based on type
    const dateInfo = getIndonesianDateText(selectedDate);
    const dayFormatted = `${dateInfo.dayName}, ${dateInfo.dateNum} ${dateInfo.monthName} ${dateInfo.yearNum}`;

    const newDoc = {
      id: 'doc-' + Date.now(),
      type,
      date: selectedDate,
      vehicleNumber: vehicleNumber.toUpperCase().trim(),
      imageUrl: finalImageUrl,
      comments: comments.trim() || `Lembar ${title} digital berhasil digenerate otomatis.`,
      uploadedBy: loggedInUser?.email || 'driver@sppg.com',
      uploadedAt: new Date().toISOString(),
      receiverName: type === 'serah_terima' ? bastPenerima : (type === 'surat_jalan' ? sjKepada : receiverName.trim() || 'Staf Penerima'),
      status: type === 'organoleptik' ? 'Lulus Uji Orlep' : (type === 'serah_terima' ? 'BAST Sah' : 'Kirim Sukses'),
      driverName: type === 'ompreng' ? driverName : undefined,
      
      // Organoleptik specifics
      organoleptikRasa: type === 'organoleptik' ? organoleptikRasa : undefined,
      organoleptikAroma: type === 'organoleptik' ? organoleptikAroma : undefined,
      organoleptikTekstur: type === 'organoleptik' ? organoleptikTekstur : undefined,
      organoleptikSuhu: type === 'organoleptik' ? organoleptikSuhu : undefined,
      
      // Rich Digital Form Fields
      sjNo: type === 'surat_jalan' ? sjNo : undefined,
      sjKepada: type === 'surat_jalan' ? sjKepada : undefined,
      sjWaktu: type === 'surat_jalan' ? sjWaktu : undefined,
      sjDriver: type === 'surat_jalan' ? sjDriver : undefined,
      sjRows: type === 'surat_jalan' ? sjRows : undefined,
      sjSignatureAslap: type === 'surat_jalan' ? tempSjSignatureAslap : undefined,
      sjSignatureReceiver: type === 'surat_jalan' ? tempSjSignatureReceiver : undefined,

      bastNo: type === 'serah_terima' ? bastNo : undefined,
      bastDriver: type === 'serah_terima' ? bastDriver : undefined,
      bastSekolah: type === 'serah_terima' ? bastSekolah : undefined,
      bastPenerima: type === 'serah_terima' ? bastPenerima : undefined,
      bastBarang: type === 'serah_terima' ? bastBarang : undefined,
      bastJumlah: type === 'serah_terima' ? bastJumlah : undefined,
      bastWaktu: type === 'serah_terima' ? bastWaktu : undefined,
      bastSignatureDriver: type === 'serah_terima' ? tempBastSignatureDriver : undefined,
      bastSignatureReceiver: type === 'serah_terima' ? tempBastSignatureReceiver : undefined,

      orlepJam: type === 'organoleptik' ? orlepJam : undefined,
      orlepPanelis: type === 'organoleptik' ? orlepPanelis : undefined,
      orlepDesa: type === 'organoleptik' ? orlepDesa : undefined,
      orlepMenu: type === 'organoleptik' ? orlepMenu : undefined,
      orlepKritik: type === 'organoleptik' ? orlepKritik : undefined,
      orlepGrid: type === 'organoleptik' ? orlepGrid : undefined,
    };

    setShippingDocs(prev => [newDoc, ...prev]);
    setActiveDocView(newDoc); // AUTO-OPEN GENERATED SHEET PREVIEW MODAL AS REQUESTED!
    setSuccessMsg(`Lembar dokumen ${title} hari ini berhasil direkam!`);
    setTimeout(() => setSuccessMsg(null), 3000);

    // Reset Form
    setComments('');
    setReceiverName('');
    setImageUrl('');
    setTempSjSignatureAslap('');
    setTempSjSignatureReceiver('');
    setTempBastSignatureDriver('');
    setTempBastSignatureReceiver('');
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus arsip lembar harian ini?')) {
      setShippingDocs(prev => prev.filter(doc => doc.id !== id));
    }
  };

  // Filter docs
  const filteredDocs = shippingDocs.filter(doc => {
    if (doc.type !== type) return false;
    if (filterDateMode === 'selected' && doc.date !== selectedDate) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        doc.vehicleNumber.toLowerCase().includes(s) ||
        (doc.receiverName && doc.receiverName.toLowerCase().includes(s)) ||
        doc.comments.toLowerCase().includes(s) ||
        doc.uploadedBy.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6 animate-fade-in" id={`shipping-panel-${type}`}>
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
              <IconComponent className="h-6 w-6 text-emerald-700 shrink-0" />
              {title}
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
              📝 Harian / Updateable
            </span>
          </div>
          <p className="text-sm text-neutral-500">{description}</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto shrink-0">
          {type === 'ompreng' && (
            <a
              href="https://drive.google.com/drive/folders/1-2i-2zctARA9tuLXPSTNX25of6qR7CxY"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4" />
              Buka Google Drive Dokumentasi Ompreng ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-emerald-800 hover:bg-emerald-950 text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {showAddForm ? 'Tutup Form Isian' : 'Isi & Update Hari Ini'}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Form Section */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="p-5 border border-emerald-100 bg-emerald-50/15 rounded-2xl space-y-5 animate-fade-in shadow-2xs">
          <h3 className="font-bold text-xs text-emerald-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-emerald-150 pb-2">
            <Camera className="h-4 w-4 text-emerald-700" />
            Lengkapi Berkas Digital & Unggah Foto
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                Tanggal Operasional
              </label>
              <div className="w-full text-xs font-semibold border border-neutral-200 rounded-lg p-2.5 bg-neutral-100 text-neutral-600 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-neutral-500" />
                {selectedDate} (SOP Hari Ini)
              </div>
            </div>

            {type !== 'ompreng' && (
              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                  No Plat Kendaraan
                </label>
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value)}
                  placeholder="Contoh: W 1234 BGH"
                  className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden uppercase font-semibold text-neutral-800"
                />
              </div>
            )}

            {type === 'ompreng' ? (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                    Lokasi Distribusi Sasaran
                  </label>
                  <select
                    required
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden text-neutral-800 font-extrabold"
                  >
                    <option value="">-- Pilih Lokasi Distribusi --</option>
                    <option value="MA Assa'adah">MA Assa'adah</option>
                    <option value="MTS Assa'adah II">MTS Assa'adah II</option>
                    <option value="SMA Assa'adah">SMA Assa'adah</option>
                    <option value="SMK Assa'adah">SMK Assa'adah</option>
                    <option value="Desa Sidokumpul">Desa Sidokumpul</option>
                    <option value="Desa Sukowati">Desa Sukowati</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                    Nama Driver (Pengemudi)
                  </label>
                  <select
                    required
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden text-neutral-850 font-bold"
                  >
                    <option value="">-- Pilih Driver --</option>
                    {DRIVERS_LIST.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                    No Plat Kendaraan
                  </label>
                  <input
                    type="text"
                    required
                    value={vehicleNumber}
                    onChange={e => setVehicleNumber(e.target.value)}
                    placeholder="Contoh: W 1234 BGH"
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden uppercase font-semibold text-neutral-800"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                  {type === 'serah_terima' ? 'Nama Penerima Sekolah' : 'U.P / Penanggung Jawab'}
                </label>
                <input
                  type="text"
                  required
                  value={receiverName}
                  onChange={e => setReceiverName(e.target.value)}
                  placeholder="Contoh: Ibu Aminah, S.Pd"
                  className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden text-neutral-800"
                />
              </div>
            )}

          </div>

          {/* SURAT JALAN SPECIFIC FORM FIELDS */}
          {type === 'surat_jalan' && (
            <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-4 animate-fade-in text-neutral-800">
              <h4 className="text-xs font-extrabold text-emerald-900 border-b border-emerald-100 pb-1 flex items-center gap-1.5">
                📋 Rincian Pengiriman Surat Jalan
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nomor Surat Jalan (Otomatis)</label>
                  <input
                    type="text"
                    disabled
                    value={sjNo}
                    placeholder="Otomatis..."
                    className="w-full text-xs border border-neutral-200 bg-neutral-100 rounded-lg p-2 font-mono font-bold text-emerald-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Kepada Pihak (Lembaga Sasaran)</label>
                  <select
                    required
                    value={sjKepada}
                    onChange={e => setSjKepada(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850 font-bold"
                  >
                    <option value="">-- Pilih Lembaga --</option>
                    <option value="MA Assa'adah">MA Assa'adah</option>
                    <option value="MTS Assa'adah II">MTS Assa'adah II</option>
                    <option value="SMA Assa'adah">SMA Assa'adah</option>
                    <option value="SMK Assa'adah">SMK Assa'adah</option>
                    <option value="Desa Sidokumpul">Desa Sidokumpul</option>
                    <option value="Desa Sukowati">Desa Sukowati</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Waktu Pengiriman</label>
                  <input
                    type="text"
                    value={sjWaktu}
                    onChange={e => setSjWaktu(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Driver</label>
                  <input
                    type="text"
                    value={sjDriver}
                    onChange={e => setSjDriver(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850"
                  />
                </div>
              </div>

              {/* SJ Table Rows */}
              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-neutral-500 uppercase">Tabel Barang Kiriman:</span>
                <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] text-neutral-500 font-extrabold">
                        <th className="p-2 text-center w-10">No</th>
                        <th className="p-2">Jenis Barang</th>
                        <th className="p-2 text-center w-24">Porsi / Box</th>
                        <th className="p-2 text-center w-24">Alat (Bfr)</th>
                        <th className="p-2 text-center w-24">Alat (Aft)</th>
                        <th className="p-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-150">
                      {sjRows.map((row, rIdx) => (
                        <tr key={row.id}>
                          <td className="p-2 text-center text-neutral-400 font-mono">{rIdx + 1}</td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={row.jenis}
                              onChange={e => {
                                const newRows = [...sjRows];
                                newRows[rIdx].jenis = e.target.value;
                                setSjRows(newRows);
                              }}
                              className="w-full border-0 bg-transparent focus:ring-1 focus:ring-emerald-700 p-1 text-xs text-neutral-800 font-medium"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              value={row.porsi}
                              onChange={e => {
                                const newRows = [...sjRows];
                                newRows[rIdx].porsi = parseInt(e.target.value) || 0;
                                setSjRows(newRows);
                              }}
                              className="w-full border-0 bg-transparent text-center focus:ring-1 focus:ring-emerald-700 p-1 text-xs font-semibold text-neutral-800"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              value={row.alatSebelum}
                              onChange={e => {
                                const newRows = [...sjRows];
                                newRows[rIdx].alatSebelum = parseInt(e.target.value) || 0;
                                setSjRows(newRows);
                              }}
                              className="w-full border-0 bg-transparent text-center focus:ring-1 focus:ring-emerald-700 p-1 text-xs text-neutral-800"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              value={row.alatSesudah}
                              onChange={e => {
                                const newRows = [...sjRows];
                                newRows[rIdx].alatSesudah = parseInt(e.target.value) || 0;
                                setSjRows(newRows);
                              }}
                              className="w-full border-0 bg-transparent text-center focus:ring-1 focus:ring-emerald-700 p-1 text-xs text-neutral-800"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={row.keterangan}
                              onChange={e => {
                                const newRows = [...sjRows];
                                newRows[rIdx].keterangan = e.target.value;
                                setSjRows(newRows);
                              }}
                              className="w-full border-0 bg-transparent focus:ring-1 focus:ring-emerald-700 p-1 text-xs text-neutral-600"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => setSjRows([...sjRows, { id: `sj-${Date.now()}`, jenis: 'Tambahan Menu', porsi: 265, alatSebelum: 0, alatSesudah: 0, keterangan: 'Baik' }])}
                  className="text-[10px] text-emerald-800 font-extrabold hover:underline"
                >
                  + Tambah Baris Baru
                </button>
              </div>

              {/* ONLINE SIGNATURE AREA IN FORM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-100">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Tanda Tangan Aslap (Pihak Pertama)</label>
                  <div className="border border-neutral-200 rounded-xl bg-white p-3 flex flex-col items-center justify-center min-h-[110px] relative shadow-3xs">
                    {tempSjSignatureAslap ? (
                      <div className="text-center">
                        <img src={tempSjSignatureAslap} alt="Ttd Aslap" className="h-14 object-contain max-w-full mix-blend-multiply" />
                        <button
                          type="button"
                          onClick={() => setTempSjSignatureAslap('')}
                          className="text-[9px] text-red-500 hover:underline mt-1 font-semibold block mx-auto"
                        >
                          Hapus Ttd
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSigRequest({
                          targetField: 'sjSignatureAslap',
                          title: 'Tanda Tangan Asisten Lapangan (Aslap)',
                          suggestedName: 'SAYYID KHOLIL'
                        })}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100 text-[10px] font-extrabold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-[0.97]"
                      >
                        ✍️ Bubuhkan Ttd Aslap
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Tanda Tangan Penerima Sekolah</label>
                  <div className="border border-neutral-200 rounded-xl bg-white p-3 flex flex-col items-center justify-center min-h-[110px] relative shadow-3xs">
                    {tempSjSignatureReceiver ? (
                      <div className="text-center">
                        <img src={tempSjSignatureReceiver} alt="Ttd Penerima" className="h-14 object-contain max-w-full mix-blend-multiply" />
                        <button
                          type="button"
                          onClick={() => setTempSjSignatureReceiver('')}
                          className="text-[9px] text-red-500 hover:underline mt-1 font-semibold block mx-auto"
                        >
                          Hapus Ttd
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSigRequest({
                          targetField: 'sjSignatureReceiver',
                          title: 'Tanda Tangan Pihak Penerima Sekolah',
                          suggestedName: sjKepada || 'Ibu Aminah'
                        })}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100 text-[10px] font-extrabold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-[0.97]"
                      >
                        ✍️ Bubuhkan Ttd Penerima
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BAST SPECIFIC FORM FIELDS */}
          {type === 'serah_terima' && (
            <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-4 animate-fade-in text-neutral-800">
              <h4 className="text-xs font-extrabold text-emerald-900 border-b border-emerald-100 pb-1 flex items-center gap-1.5">
                📝 Rincian Surat Berita Acara (BAST)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nomor BAST (Otomatis)</label>
                  <input
                    type="text"
                    disabled
                    value={bastNo}
                    placeholder="Otomatis..."
                    className="w-full text-xs border border-neutral-200 bg-neutral-100 rounded-lg p-2 font-mono font-bold text-emerald-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Driver (Pihak Pertama)</label>
                  <input
                    type="text"
                    value={bastDriver}
                    onChange={e => setBastDriver(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Lembaga (Pihak Kedua)</label>
                  <select
                    required
                    value={bastSekolah}
                    onChange={e => setBastSekolah(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850 font-bold"
                  >
                    <option value="">-- Pilih Lembaga --</option>
                    <option value="MA Assa'adah">MA Assa'adah</option>
                    <option value="MTS Assa'adah II">MTS Assa'adah II</option>
                    <option value="SMA Assa'adah">SMA Assa'adah</option>
                    <option value="SMK Assa'adah">SMK Assa'adah</option>
                    <option value="Desa Sidokumpul">Desa Sidokumpul</option>
                    <option value="Desa Sukowati">Desa Sukowati</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Penerima Sekolah</label>
                  <input
                    type="text"
                    value={bastPenerima}
                    onChange={e => setBastPenerima(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Barang Paket</label>
                  <input
                    type="text"
                    value={bastBarang}
                    onChange={e => setBastBarang(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Jumlah Porsi Diserahkan</label>
                  <input
                    type="number"
                    value={bastJumlah}
                    onChange={e => setBastJumlah(parseInt(e.target.value) || 0)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Waktu Serah Terima</label>
                  <input
                    type="text"
                    value={bastWaktu}
                    onChange={e => setBastWaktu(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850"
                  />
                </div>
              </div>

              {/* ONLINE SIGNATURE AREA IN FORM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-100">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Tanda Tangan Driver (Pihak Pertama)</label>
                  <div className="border border-neutral-200 rounded-xl bg-white p-3 flex flex-col items-center justify-center min-h-[110px] relative shadow-3xs">
                    {tempBastSignatureDriver ? (
                      <div className="text-center">
                        <img src={tempBastSignatureDriver} alt="Ttd Driver" className="h-14 object-contain max-w-full mix-blend-multiply" />
                        <button
                          type="button"
                          onClick={() => setTempBastSignatureDriver('')}
                          className="text-[9px] text-red-500 hover:underline mt-1 font-semibold block mx-auto"
                        >
                          Hapus Ttd
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSigRequest({
                          targetField: 'bastSignatureDriver',
                          title: 'Tanda Tangan Driver (Pihak Pertama)',
                          suggestedName: bastDriver || 'Bpk. Sholeh'
                        })}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100 text-[10px] font-extrabold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-[0.97]"
                      >
                        ✍️ Bubuhkan Ttd Driver
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Tanda Tangan Penerima (Pihak Kedua)</label>
                  <div className="border border-neutral-200 rounded-xl bg-white p-3 flex flex-col items-center justify-center min-h-[110px] relative shadow-3xs">
                    {tempBastSignatureReceiver ? (
                      <div className="text-center">
                        <img src={tempBastSignatureReceiver} alt="Ttd Penerima" className="h-14 object-contain max-w-full mix-blend-multiply" />
                        <button
                          type="button"
                          onClick={() => setTempBastSignatureReceiver('')}
                          className="text-[9px] text-red-500 hover:underline mt-1 font-semibold block mx-auto"
                        >
                          Hapus Ttd
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSigRequest({
                          targetField: 'bastSignatureReceiver',
                          title: 'Tanda Tangan Penerima Sekolah',
                          suggestedName: bastPenerima || 'Ibu Aminah'
                        })}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-100 text-[10px] font-extrabold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-[0.97]"
                      >
                        ✍️ Bubuhkan Ttd Penerima
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ORGANOLEPTIK SPECIFIC DETAILED GRID */}
          {type === 'organoleptik' && (
            <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-4 animate-fade-in text-neutral-800">
              <h4 className="text-xs font-extrabold text-emerald-900 border-b border-emerald-100 pb-1 flex items-center gap-1.5">
                🔬 Lembar Pengujian Uji Organoleptik & Sensorik Makanan
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Jam Uji</label>
                  <input
                    type="text"
                    value={orlepJam}
                    onChange={e => setOrlepJam(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Panelis</label>
                  <input
                    type="text"
                    value={orlepPanelis}
                    onChange={e => setOrlepPanelis(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Desa Pengujian</label>
                  <input
                    type="text"
                    value={orlepDesa}
                    onChange={e => setOrlepDesa(e.target.value)}
                    className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1 font-sans">Suhu Hidangan (°C)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={organoleptikSuhu}
                      onChange={e => setOrganoleptikSuhu(e.target.value)}
                      className="w-20 text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850 font-bold font-mono"
                    />
                    <span className={`text-[10px] font-bold px-1.5 py-1 rounded font-sans ${
                      parseInt(organoleptikSuhu) >= 60 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 animate-pulse'
                    }`}>
                      {parseInt(organoleptikSuhu) >= 60 ? '✓ CCP Aman' : '⚠ Resiko Bakteri'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Menu Harian Yang Diuji</label>
                <input
                  type="text"
                  value={orlepMenu}
                  onChange={e => setOrlepMenu(e.target.value)}
                  className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2 focus:ring-1 focus:ring-emerald-700 text-neutral-850 font-semibold"
                />
              </div>

              {/* Matrix of Ratings */}
              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-neutral-500 uppercase">
                  Skor Penilaian Gizi (1: Buruk - 5: Sangat Suka)
                </span>
                <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] text-neutral-500 font-extrabold text-center select-none">
                        <th className="p-2 text-left">Komponen Gizi</th>
                        <th className="p-2">Rasa</th>
                        <th className="p-2">Warna</th>
                        <th className="p-2">Aroma</th>
                        <th className="p-2">Tekstur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-150 text-neutral-800 font-medium">
                      {[
                        { code: 'MP', name: 'MP (Makanan Pokok / Nasi)' },
                        { code: 'LH', name: 'LH (Lauk Hewani / Ayam)' },
                        { code: 'LN', name: 'LN (Lauk Nabati / Tahu)' },
                        { code: 'SY', name: 'SY (Sayur / Wortel Jagung)' },
                        { code: 'B', name: 'B (Buah-Buahan / Melon)' }
                      ].map(comp => (
                        <tr key={comp.code} className="hover:bg-neutral-50/50">
                          <td className="p-2 font-bold text-neutral-700 text-[11px]">{comp.name}</td>
                          {['rasa', 'warna', 'aroma', 'tekstur'].map(attr => {
                            const key = `${comp.code}_${attr}`;
                            const val = orlepGrid[key] || 4;
                            return (
                              <td key={attr} className="p-1 text-center">
                                <select
                                  value={val}
                                  onChange={e => setOrlepGrid(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                                  className="mx-auto text-[11px] font-black font-mono border border-neutral-200 bg-neutral-50 rounded-md px-1.5 py-1 w-14 text-center cursor-pointer text-emerald-800"
                                >
                                  <option value={1}>1</option>
                                  <option value={2}>2</option>
                                  <option value={3}>3</option>
                                  <option value={4}>4</option>
                                  <option value={5}>5</option>
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between text-[9px] text-neutral-400 font-mono italic">
                  <span>Skor: 1 = Sangat Buruk / Amis / Asam</span>
                  <span>Skor: 4 = Sesuai SOP Gizi SPPG</span>
                  <span>Skor: 5 = Sangat Harum / Gurih / Sempurna</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                  Kritik, Saran, & Rekomendasi Panelis Gizi
                </label>
                <textarea
                  value={orlepKritik}
                  onChange={e => setOrlepKritik(e.target.value)}
                  placeholder="Contoh: Suhu hidangan sup dipertahankan hangat di atas 60C, citarasa asin gurih lauk hewani sangat seimbang, melon manis."
                  rows={2}
                  className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-700 text-neutral-850"
                />
              </div>
            </div>
          )}

          {type !== 'ompreng' && (
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                Catatan Pengiriman / Catatan Uji Lapangan
              </label>
              <textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                placeholder="Berikan keterangan tambahan jika diperlukan."
                rows={2}
                className="w-full text-xs border border-neutral-200 bg-white rounded-lg p-2.5 shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden text-neutral-800"
              />
            </div>
          )}

          {/* Upload and Simulation camera options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            
            <div className="border border-neutral-200 rounded-xl p-3 bg-white space-y-2 relative overflow-hidden">
              {isUploadingFile && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center z-10">
                  <Loader2 className="h-5 w-5 text-emerald-700 animate-spin" />
                  <span className="text-[10px] font-bold text-neutral-700 mt-1">Mengunggah ke Cloudinary...</span>
                </div>
              )}
              <span className="block text-[10px] font-bold text-neutral-500 uppercase flex items-center justify-between">
                <span>Unggah File Dokumen Fisik / Foto Asli</span>
                {isCloudinaryConfigured() ? (
                  <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-300 px-1 py-0.5 rounded font-mono">Cloud Active</span>
                ) : (
                  <span className="text-[8px] bg-neutral-100 text-neutral-500 border border-neutral-300 px-1 py-0.5 rounded font-mono">Sandbox Mode</span>
                )}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isUploadingFile}
                className="w-full text-xs text-neutral-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer disabled:opacity-50"
              />
              <p className="text-[9px] text-neutral-400 leading-snug">
                Pilih atau seret foto langsung dari HP / laptop Anda (JPG, PNG, WEBP).
              </p>
              {uploadFileError && (
                <p className="text-[9px] text-red-600 font-semibold bg-red-50 p-1.5 rounded">
                  ⚠ {uploadFileError}
                </p>
              )}
            </div>

            <div className="border border-emerald-100 rounded-xl p-3 bg-emerald-50/15 space-y-2">
              <span className="block text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1 font-sans">
                <Camera className="h-3.5 w-3.5 text-emerald-700" />
                Simulasi Kamera Cepat (Tanpa File)
              </span>
              <div className="flex flex-wrap gap-2">
                {cameraPresets[type as keyof typeof cameraPresets]?.map((p, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    disabled={isUploadingFile}
                    onClick={() => {
                      setImageUrl(p.url);
                      if (!comments) setComments(p.note);
                      setSuccessMsg(`Simulasi kamera ${p.name} dimuat!`);
                      setTimeout(() => setSuccessMsg(null), 2500);
                    }}
                    className="bg-white hover:bg-emerald-50 text-[10px] text-neutral-700 font-semibold px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:border-emerald-500/40 transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-3xs hover:shadow-2xs active:scale-[0.97] disabled:opacity-50"
                  >
                    📸 {p.name}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-neutral-400 leading-snug">
                Gunakan preset gambar simulasi di atas untuk pengetesan instan tanpa unggah manual.
              </p>
            </div>

          </div>

          {imageUrl && (
            <div className="border border-neutral-200 rounded-xl p-3 bg-neutral-50 flex items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <img src={imageUrl} alt="Pratinjau" className="h-14 w-14 object-cover rounded-md border border-neutral-300 shadow-3xs" />
                <div>
                  <span className="block text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full w-max text-center">
                    ✓ Berkas Dilampirkan
                  </span>
                  {imageUrl.startsWith('http') && (imageUrl.includes('cloudinary') || imageUrl.includes('cloudinary.com')) ? (
                    <span className="text-[9px] text-emerald-600 font-semibold block mt-1 flex items-center gap-1 bg-emerald-50/40 px-1.5 py-0.5 rounded border border-emerald-200/50 w-max">
                      ⚡ Cloud Storage: Cloudinary CDN
                    </span>
                  ) : imageUrl.startsWith('data:') ? (
                    <span className="text-[9px] text-amber-700 font-semibold block mt-1 flex items-center gap-1 bg-amber-50/40 px-1.5 py-0.5 rounded border border-amber-200/50 w-max">
                      ⚠ Local Sandbox: Raw Base64 string
                    </span>
                  ) : (
                    <span className="text-[9px] text-neutral-500 font-mono block mt-1">
                      Simulated Camera Preset Asset
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={isUploadingFile}
                onClick={() => setImageUrl('')}
                className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 hover:bg-red-50 rounded disabled:opacity-50"
              >
                Hapus
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-150">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              disabled={isUploadingFile}
              className="text-neutral-500 hover:bg-neutral-100 text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isUploadingFile}
              className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs px-4 py-2.5 rounded-lg cursor-pointer transition-colors shadow-xs hover:shadow-sm disabled:opacity-50 flex items-center gap-1"
            >
              {isUploadingFile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isUploadingFile ? 'Sedang Mengunggah...' : 'Simpan Dokumentasi'}
            </button>
          </div>

        </form>
      )}

      {/* Control Filter Toolbar */}
      <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-150 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-neutral-200 self-start">
          <button
            type="button"
            onClick={() => setFilterDateMode('selected')}
            className={`text-[10px] font-bold px-3 py-2 rounded-md transition-all ${
              filterDateMode === 'selected' ? 'bg-emerald-800 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Hari Ini ({selectedDate})
          </button>
          <button
            type="button"
            onClick={() => setFilterDateMode('all')}
            className={`text-[10px] font-bold px-3 py-2 rounded-md transition-all ${
              filterDateMode === 'all' ? 'bg-emerald-800 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Semua Tanggal
          </button>
        </div>

        <div className="relative flex-1 md:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari Plat Mobil, Penerima, Catatan..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-neutral-200 bg-white rounded-lg focus:ring-1 focus:ring-emerald-700 outline-hidden text-neutral-800 shadow-3xs"
          />
        </div>
      </div>

      {/* Grid List */}
      {filteredDocs.length === 0 ? (
        <div className="border border-neutral-100 border-dashed rounded-xl p-8 text-center text-xs text-neutral-400">
          <p className="font-semibold text-neutral-600">Belum ada dokumentasi {title} yang terekam.</p>
          <p className="text-[10px] text-neutral-400 mt-1">Silakan klik "Isi & Update Hari Ini" untuk mengisi lembar digital.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocs.map(doc => (
            <div key={doc.id} className="border border-neutral-200 rounded-xl bg-white shadow-3xs overflow-hidden hover:border-emerald-700/35 transition-all flex flex-col md:flex-row gap-3 p-3">
              
              <div 
                onClick={() => setActivePreviewImage(doc.imageUrl)}
                className="w-full md:w-28 h-28 shrink-0 bg-neutral-900 rounded-lg overflow-hidden border border-neutral-100 relative cursor-zoom-in group"
              >
                <img src={doc.imageUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded">Zoom Foto</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded font-mono border border-slate-200">
                      🚗 {doc.vehicleNumber}
                    </span>
                    <span className="text-[9px] text-neutral-500 font-mono">
                      {new Date(doc.uploadedAt).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-700 font-medium mt-1.5 line-clamp-2 leading-relaxed">
                    "{doc.comments}"
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 mt-2 bg-neutral-50 p-1.5 rounded-lg border border-neutral-100 text-[10px]">
                    <div>
                      <span className="text-neutral-450 block text-[8px] uppercase font-black tracking-wider">Penerima / U.P</span>
                      <span className="font-semibold text-neutral-700 truncate block">{doc.receiverName || 'Staf Asrama'}</span>
                    </div>
                    {doc.type === 'ompreng' && doc.driverName ? (
                      <div>
                        <span className="text-neutral-450 block text-[8px] uppercase font-black tracking-wider">Driver Pengirim</span>
                        <span className="font-semibold text-neutral-700 truncate block">{doc.driverName}</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-neutral-450 block text-[8px] uppercase font-black tracking-wider">Status Validasi</span>
                        <span className="font-extrabold text-emerald-800 flex items-center gap-0.5 font-sans">
                          <Check className="h-3 w-3 text-emerald-700 shrink-0 stroke-[3]" />
                          {doc.status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Summary labels for rich docs */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {doc.type === 'surat_jalan' && (
                      <span className="text-[9px] bg-sky-50 text-sky-800 border border-sky-100 rounded px-1.5 py-0.5 font-bold font-sans">
                        📄 Surat Jalan Terlampir ({doc.sjRows?.length || 3} baris)
                      </span>
                    )}
                    {doc.type === 'serah_terima' && (
                      <span className="text-[9px] bg-indigo-50 text-indigo-800 border border-indigo-100 rounded px-1.5 py-0.5 font-bold font-sans">
                        📝 BAST Terbit ({doc.bastJumlah || 265} porsi)
                      </span>
                    )}
                    {doc.type === 'organoleptik' && (
                      <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-100 rounded px-1.5 py-0.5 font-bold font-sans">
                        🔬 Orlep Suhu: {doc.organoleptikSuhu || doc.orlepGrid ? 'Lengkap' : 'SOP'} ({doc.organoleptikSuhu || 68}°C)
                      </span>
                    )}
                  </div>

                </div>

                <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-[9px] text-neutral-450">
                  <span className="truncate block max-w-[100px] font-mono" title={`Diunggah: ${doc.uploadedBy}`}>
                    👤 {doc.uploadedBy.split('@')[0]}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveDocView(doc)}
                      className="text-emerald-800 hover:text-emerald-950 font-extrabold hover:underline transition-all py-0.5 px-1 bg-emerald-50 rounded cursor-pointer"
                    >
                      Lihat Berkas Resmi 📄
                    </button>
                    {(loggedInUser?.email === doc.uploadedBy || currentUserRole === UserRole.ASLAP || currentUserRole === UserRole.ADMIN) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="text-red-500 hover:text-red-700 font-bold transition-all p-1 hover:bg-red-50 rounded cursor-pointer"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>

              </div>

            </div>
          ))}
        </div>
      )}

      {/* Lightbox zoomed picture overlay */}
      {activePreviewImage && (
        <div 
          onClick={() => setActivePreviewImage(null)}
          className="fixed inset-0 bg-neutral-950/90 flex items-center justify-center p-4 z-50 animate-fade-in cursor-zoom-out"
        >
          <div className="bg-neutral-900 rounded-2xl overflow-hidden p-1.5 max-w-2xl w-full border border-neutral-800 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <img src={activePreviewImage} alt="Pratinjau Besar" className="w-full max-h-[80vh] object-contain rounded-xl" />
            <div className="p-3 text-center text-xs text-neutral-300 font-medium">
              Klik di luar gambar atau tekan gambar untuk menutup pratinjau.
            </div>
            <button
              onClick={() => setActivePreviewImage(null)}
              className="absolute top-4 right-4 bg-black/60 text-white rounded-full p-2 hover:bg-black/80 transition-all font-mono font-bold leading-none"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* HIGH-FIDELITY DIGITAL PAPER SIMULATOR MODAL */}
      {activeDocView && (
        <div
          className="fixed inset-0 bg-neutral-900/80 flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto"
          onClick={() => setActiveDocView(null)}
        >
          <div
            className="bg-stone-100 rounded-2xl max-w-3xl w-full border border-stone-300 shadow-2xl relative my-8 overflow-hidden select-text"
            onClick={e => e.stopPropagation()}
          >
            {/* Action Bar */}
            <div className="bg-stone-200 px-6 py-3 border-b border-stone-300 flex items-center justify-between select-none">
              <span className="text-stone-700 text-xs font-bold font-mono">
                📟 Digital Facsimile - {activeDocView.type === 'surat_jalan' ? 'SURAT JALAN' : (activeDocView.type === 'serah_terima' ? 'BAST' : 'ORGANOLEPTIK')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-emerald-800 hover:bg-emerald-950 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-3xs cursor-pointer transition-all"
                >
                  🖨️ Cetak / Simpan PDF
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDocView(null)}
                  className="bg-stone-300 hover:bg-stone-400 text-stone-700 font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>

            {/* Document Body (Simulating Real Print Paper A4) */}
            <div className="p-8 md:p-12 bg-white m-4 md:m-6 rounded-lg border border-stone-300 shadow-xs text-neutral-900 font-serif leading-relaxed max-h-[75vh] overflow-y-auto">
              
              {/* Official Header */}
              <div className="border-b-2 border-double border-neutral-900 pb-4 text-center space-y-1 select-none">
                <h2 className="text-base font-extrabold tracking-widest font-sans uppercase">
                  SPPG YAYASAN PONDOK PESANTREN QOMARUDDIN
                </h2>
                <p className="text-[11px] font-sans font-semibold text-neutral-600">
                  Unit Dapur Bungah 2 - Program Makan Bergizi Gratis (MBG) Gresik
                </p>
                <p className="text-[9px] font-sans font-medium text-neutral-400 italic">
                  Jl. Raya Bungah No. 1, Bungah, Kabupaten Gresik, Jawa Timur
                </p>
              </div>

              {/* OMPRENG FACSIMILE */}
              {activeDocView.type === 'ompreng' && (
                <div className="space-y-6 mt-6 font-sans">
                  <div className="text-center">
                    <h3 className="text-lg font-black tracking-wide font-sans underline">DOKUMENTASI PENGIRIMAN OMPRENG</h3>
                    <p className="text-[10px] font-mono text-neutral-500 uppercase mt-0.5 font-bold">KODE LAPORAN: {activeDocView.id.toUpperCase()}</p>
                  </div>

                  {/* Metadata block */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans bg-neutral-50 p-4 rounded-xl border border-neutral-250">
                    <div className="space-y-1.5">
                      <span className="text-neutral-450 font-bold uppercase text-[9px] block">Lembaga / Desa Sasaran:</span>
                      <p className="font-extrabold text-neutral-900 text-sm">{activeDocView.receiverName || 'MA Assa\'adah'}</p>
                      <p className="text-neutral-500 font-semibold">Dapur Terpadu SPPG Bungah - Kab. Gresik</p>
                    </div>
                    <div className="space-y-1.5 text-right sm:text-right text-left">
                      <p><strong className="font-bold text-neutral-700">Hari, Tanggal:</strong> {getIndonesianDateText(activeDocView.date).dayName}, {getIndonesianDateText(activeDocView.date).dateNum} {getIndonesianDateText(activeDocView.date).monthName} {getIndonesianDateText(activeDocView.date).yearNum}</p>
                      <p><strong className="font-bold text-neutral-700">Waktu Lapor:</strong> {new Date(activeDocView.uploadedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
                      <p><strong className="font-bold text-neutral-700">Driver Pelapor:</strong> {activeDocView.uploadedBy.split('@')[0]}</p>
                      <p><strong className="font-bold text-neutral-700">No Kendaraan:</strong> {activeDocView.vehicleNumber}</p>
                    </div>
                  </div>

                  {/* Photo Exhibit */}
                  <div className="space-y-2">
                    <span className="text-neutral-450 font-bold uppercase text-[9px] block">Bukti Foto Penyerahan Makanan (Ompreng):</span>
                    <div className="border border-neutral-300 rounded-xl overflow-hidden bg-neutral-900 max-h-[350px] flex items-center justify-center shadow-inner">
                      <img referrerPolicy="no-referrer" src={activeDocView.imageUrl} alt="Bukti Kirim Ompreng" className="max-h-[350px] object-contain w-full" />
                    </div>
                    <p className="text-[10px] text-neutral-400 italic text-center">Foto di atas diambil langsung oleh Driver sebagai bukti fisik pertanggungjawaban.</p>
                  </div>

                  {/* Remarks / Notes */}
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-neutral-500 uppercase text-[9px] block">Catatan Pengiriman Driver:</span>
                    <p className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 italic font-sans text-neutral-800 leading-relaxed">
                      "{activeDocView.comments || 'Ompreng telah diterima dalam kondisi aman, steril, dan tersegel utuh.'}"
                    </p>
                  </div>

                  {/* Signature Section */}
                  <div className="grid grid-cols-2 gap-12 pt-6 text-xs font-sans">
                    <div className="text-center space-y-12">
                      <p className="font-semibold text-neutral-600">Diserahkan Oleh (Driver),</p>
                      <div className="h-12 flex items-center justify-center">
                        <span className="text-neutral-400 font-bold bg-neutral-100 border border-neutral-300 rounded px-3 py-1 italic text-[10px] font-mono">[ DRIVER VERIFIED ]</span>
                      </div>
                      <p className="font-black text-neutral-800 underline uppercase">{activeDocView.uploadedBy.split('@')[0]}</p>
                    </div>
                    <div className="text-center space-y-12">
                      <p className="font-semibold text-neutral-600">Diketahui Pihak Penerima,</p>
                      <div className="h-12 flex items-center justify-center">
                        <span className="text-neutral-400 font-bold bg-neutral-100 border border-neutral-300 rounded px-3 py-1 italic text-[10px] font-mono">[ PENERIMA SEKOLAH ]</span>
                      </div>
                      <p className="font-black text-neutral-800 underline uppercase">Staf Asrama / {activeDocView.receiverName || 'Sekolah'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* SURAT JALAN FACSIMILE */}
              {activeDocView.type === 'surat_jalan' && (
                <div className="space-y-6 mt-6">
                  <div className="text-center">
                    <h3 className="text-lg font-black tracking-wide font-sans underline">SURAT JALAN</h3>
                    <p className="text-[10px] font-mono text-neutral-500 uppercase mt-0.5">ID: {activeDocView.id}</p>
                  </div>

                  {/* Metadata block */}
                  <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                    <div className="space-y-1">
                      <p><span className="text-neutral-450 font-bold uppercase text-[9px] block">Kepada Yth. Pihak Sekolah:</span></p>
                      <p className="font-extrabold text-neutral-900 text-sm">{activeDocView.sjKepada || activeDocView.receiverName || 'Penerima Sekolah'}</p>
                      <p className="text-neutral-500">Kecamatan Bungah, Kab. Gresik</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p><strong className="font-bold text-neutral-700">Hari, Tanggal:</strong> {getIndonesianDateText(activeDocView.date).dayName}, {getIndonesianDateText(activeDocView.date).dateNum} {getIndonesianDateText(activeDocView.date).monthName} {getIndonesianDateText(activeDocView.date).yearNum}</p>
                      <p><strong className="font-bold text-neutral-700">Waktu Kirim:</strong> {activeDocView.sjWaktu || '11:00 WIB'}</p>
                      <p><strong className="font-bold text-neutral-700">Pengemudi (Driver):</strong> {activeDocView.sjDriver || 'Bpk. Sholeh'}</p>
                      <p><strong className="font-bold text-neutral-700">No Kendaraan:</strong> {activeDocView.vehicleNumber}</p>
                    </div>
                  </div>

                  <p className="text-[11px] font-sans">Harap diterima barang pengantaran makan bergizi santri harian di bawah ini dalam keadaan baik, bersegel higienis, dan porsi pas sesuai manifest data:</p>

                  {/* Table */}
                  <div className="border border-neutral-900 overflow-hidden font-sans">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-900 text-[10px] font-bold text-center">
                          <th className="p-2 border-r border-neutral-900 w-10 text-center">No</th>
                          <th className="p-2 border-r border-neutral-900 text-left">Jenis Item Makanan / Logistik</th>
                          <th className="p-2 border-r border-neutral-900 w-24">Jumlah Porsi</th>
                          <th className="p-2 border-r border-neutral-900 w-24">Alat Makan (Kirim)</th>
                          <th className="p-2 border-r border-neutral-900 w-24">Alat Makan (Balik)</th>
                          <th className="p-2">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900">
                        {(activeDocView.sjRows || [
                          { id: '1', jenis: 'Paket Program Makan Bergizi Gratis', porsi: 265, alatSebelum: 265, alatSesudah: 265, keterangan: 'Selesai dikirim hangat' },
                          { id: '2', jenis: 'Buah Melon Potong Segar', porsi: 265, alatSebelum: 0, alatSesudah: 0, keterangan: 'Lengkap' },
                          { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: 265, alatSebelum: 0, alatSesudah: 0, keterangan: 'Utuh' }
                        ]).map((row: any, rIdx: number) => (
                          <tr key={row.id} className="text-center">
                            <td className="p-2 border-r border-neutral-900 font-mono text-[10px]">{rIdx + 1}</td>
                            <td className="p-2 border-r border-neutral-900 text-left font-semibold">{row.jenis}</td>
                            <td className="p-2 border-r border-neutral-900 font-bold">{row.porsi} Box</td>
                            <td className="p-2 border-r border-neutral-900 font-mono">{row.alatSebelum} pcs</td>
                            <td className="p-2 border-r border-neutral-900 font-mono">{row.alatSesudah} pcs</td>
                            <td className="p-2 text-left italic text-neutral-500 text-[11px]">{row.keterangan || '-'}</td>
                          </tr>
                        ))}
                        {/* Totals Row */}
                        <tr className="bg-neutral-50/50 text-center font-extrabold border-t border-neutral-900">
                          <td className="p-2 border-r border-neutral-900" colSpan={2}>TOTAL AKUMULASI KIRIMAN</td>
                          <td className="p-2 border-r border-neutral-900 text-emerald-800 font-black">
                            {(activeDocView.sjRows || []).reduce((acc: number, cur: any) => acc + (cur.porsi || 0), 0) || 795} Box
                          </td>
                          <td className="p-2 border-r border-neutral-900 font-mono">
                            {(activeDocView.sjRows || []).reduce((acc: number, cur: any) => acc + (cur.alatSebelum || 0), 0) || 265}
                          </td>
                          <td className="p-2 border-r border-neutral-900 font-mono">
                            {(activeDocView.sjRows || []).reduce((acc: number, cur: any) => acc + (cur.alatSesudah || 0), 0) || 265}
                          </td>
                          <td className="p-2 text-left text-[10px] text-emerald-800">Status Manifest Lulus</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-12 pt-6 text-xs font-sans">
                    <div className="text-center space-y-2 flex flex-col items-center">
                      <p className="font-semibold text-neutral-600">Diserahkan Oleh,<br /><span className="text-neutral-450 block text-[9px] uppercase font-bold tracking-wider">Asisten Lapangan SPPG</span></p>
                      
                      <div className="h-16 flex items-center justify-center border border-dashed border-stone-200 rounded-lg w-44 bg-stone-50/50 p-1 relative group">
                        {activeDocView.sjSignatureAslap ? (
                          <div className="relative">
                            <img src={activeDocView.sjSignatureAslap} alt="Ttd Aslap" className="h-14 object-contain mix-blend-multiply" />
                            <button
                              type="button"
                              onClick={() => handleUpdateDocumentSignature(activeDocView.id, 'sjSignatureAslap', '')}
                              className="absolute -top-2 -right-2 bg-red-100 text-red-650 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 flex items-center justify-center h-5 w-5 text-[8px]"
                              title="Hapus Tanda Tangan"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveSigRequest({
                              docId: activeDocView.id,
                              targetField: 'sjSignatureAslap',
                              title: 'Tanda Tangan Asisten Lapangan (Aslap)',
                              suggestedName: 'SAYYID KHOLIL'
                            })}
                            className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            ✍️ Bubuhkan Ttd Aslap
                          </button>
                        )}
                      </div>

                      <div className="w-44 text-center">
                        <div className="border-b border-neutral-900 mx-auto font-bold uppercase text-neutral-800">SAYYID KHOLIL</div>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Aslap Logistik Bungah 2</p>
                      </div>
                    </div>

                    <div className="text-center space-y-2 flex flex-col items-center">
                      <p className="font-semibold text-neutral-600">Diterima Oleh,<br /><span className="text-neutral-450 block text-[9px] uppercase font-bold tracking-wider">Pihak Sekolah Sasaran</span></p>

                      <div className="h-16 flex items-center justify-center border border-dashed border-stone-200 rounded-lg w-44 bg-stone-50/50 p-1 relative group">
                        {activeDocView.sjSignatureReceiver ? (
                          <div className="relative">
                            <img src={activeDocView.sjSignatureReceiver} alt="Ttd Penerima" className="h-14 object-contain mix-blend-multiply" />
                            <button
                              type="button"
                              onClick={() => handleUpdateDocumentSignature(activeDocView.id, 'sjSignatureReceiver', '')}
                              className="absolute -top-2 -right-2 bg-red-100 text-red-650 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 flex items-center justify-center h-5 w-5 text-[8px]"
                              title="Hapus Tanda Tangan"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveSigRequest({
                              docId: activeDocView.id,
                              targetField: 'sjSignatureReceiver',
                              title: 'Tanda Tangan Penerima Sekolah',
                              suggestedName: activeDocView.receiverName || 'Ibu Aminah'
                            })}
                            className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            ✍️ Bubuhkan Ttd Penerima
                          </button>
                        )}
                      </div>

                      <div className="w-44 text-center">
                        <div className="border-b border-neutral-900 mx-auto font-bold uppercase text-neutral-800">{activeDocView.receiverName || 'STAF PENERIMA'}</div>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Seksi Kesejahteraan Santri / Siswa</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BAST FACSIMILE */}
              {activeDocView.type === 'serah_terima' && (
                <div className="space-y-6 mt-6">
                  <div className="text-center space-y-1">
                    <h3 className="text-base font-extrabold tracking-wide font-sans underline">BERITA ACARA SERAH TERIMA (BAST)</h3>
                    <p className="text-[10px] font-mono text-neutral-700 uppercase">NO: {activeDocView.bastNo || '087/BAST-MBG/SPPGBB2/06/2026'}</p>
                  </div>

                  <p className="text-xs">Yang bertanda tangan di bawah ini pada hari ini:</p>

                  <div className="grid grid-cols-2 gap-4 text-xs bg-stone-50 p-3 rounded-lg border border-stone-200 font-sans leading-normal">
                    <div className="space-y-1 border-r border-stone-200 pr-3">
                      <span className="font-bold text-emerald-800 text-[10px] uppercase block tracking-wider">Pihak Pertama (Diserahkan):</span>
                      <p><strong className="text-neutral-600">Nama Driver:</strong> {activeDocView.bastDriver || 'Bpk. Sholeh'}</p>
                      <p><strong className="text-neutral-600">Unit Dapur:</strong> SPPG GRESIK BUNGAH 2</p>
                      <p><strong className="text-neutral-600">No Plat:</strong> {activeDocView.vehicleNumber}</p>
                    </div>
                    <div className="space-y-1 pl-1">
                      <span className="font-bold text-emerald-800 text-[10px] uppercase block tracking-wider">Pihak Kedua (Diterima):</span>
                      <p><strong className="text-neutral-600">Nama Sekolah:</strong> {activeDocView.bastSekolah || 'Madrasah Aliyah Qomaruddin'}</p>
                      <p><strong className="text-neutral-600">Nama Penerima:</strong> {activeDocView.bastPenerima || 'Ibu Aminah'}</p>
                      <p><strong className="text-neutral-600">SOP Tanggal:</strong> {activeDocView.date}</p>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-justify">
                    Menyatakan bahwa <strong>PIHAK PERTAMA</strong> telah menyerahkan paket program gizi gratis dari dapur asrama kepada <strong>PIHAK KEDUA</strong>, dan PIHAK KEDUA menyatakan telah menerima dalam kondisi segar, hangat, tertutup rapat sesuai segel higienitas dengan rincian berikut:
                  </p>

                  {/* BAST Table */}
                  <div className="border border-neutral-900 overflow-hidden font-sans">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-900 text-[10px] font-bold text-center">
                          <th className="p-2 border-r border-neutral-900 w-10 text-center">No</th>
                          <th className="p-2 border-r border-neutral-900 text-left">Nama Komoditas / Paket Makanan</th>
                          <th className="p-2 border-r border-neutral-900 w-32">Kuantitas Diserahkan</th>
                          <th className="p-2">Waktu Penyerahan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900">
                        <tr className="text-center font-semibold">
                          <td className="p-3 border-r border-neutral-900 font-mono">1</td>
                          <td className="p-3 border-r border-neutral-900 text-left font-black text-neutral-850">
                            {activeDocView.bastBarang || 'PAKET PROGRAM MAKAN BERGIZI GRATIS'}
                            <span className="block text-[10px] font-normal text-neutral-500 italic mt-0.5">Sesuai standar nutrisi gizi asrama</span>
                          </td>
                          <td className="p-3 border-r border-neutral-900 text-emerald-800 font-black text-sm">
                            {activeDocView.bastJumlah || 265} Porsi
                          </td>
                          <td className="p-3 font-semibold font-mono text-neutral-700">
                            {activeDocView.bastWaktu || '11:15 WIB'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[11px] italic leading-snug">
                    * Catatan verifikasi fisik: "{activeDocView.comments || 'Semua box ompreng dalam keadaan bersih dan porsi pas.'}"
                  </p>

                  <p className="text-xs leading-relaxed">
                    Demikian Berita Acara Serah Terima ini kami buat secara sukarela dan penuh tanggung jawab untuk digunakan sebagai lampiran laporan harian SPPG Kabupaten Gresik.
                  </p>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-12 pt-6 text-xs font-sans">
                    <div className="text-center space-y-2 flex flex-col items-center">
                      <p className="font-semibold text-neutral-600">PIHAK PERTAMA<br /><span className="text-neutral-450 block text-[9px] uppercase font-bold tracking-wider">(DRIVER SPPG)</span></p>
                      
                      <div className="h-16 flex items-center justify-center border border-dashed border-stone-200 rounded-lg w-44 bg-stone-50/50 p-1 relative group">
                        {activeDocView.bastSignatureDriver ? (
                          <div className="relative">
                            <img src={activeDocView.bastSignatureDriver} alt="Ttd Driver" className="h-14 object-contain mix-blend-multiply" />
                            <button
                              type="button"
                              onClick={() => handleUpdateDocumentSignature(activeDocView.id, 'bastSignatureDriver', '')}
                              className="absolute -top-2 -right-2 bg-red-100 text-red-650 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 flex items-center justify-center h-5 w-5 text-[8px]"
                              title="Hapus Tanda Tangan"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveSigRequest({
                              docId: activeDocView.id,
                              targetField: 'bastSignatureDriver',
                              title: 'Tanda Tangan Driver (Pihak Pertama)',
                              suggestedName: activeDocView.bastDriver || 'Bpk. Sholeh'
                            })}
                            className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            ✍️ Bubuhkan Ttd Driver
                          </button>
                        )}
                      </div>

                      <div className="w-44 text-center">
                        <div className="border-b border-neutral-900 mx-auto font-bold uppercase text-neutral-800">{activeDocView.bastDriver || 'Bpk. Sholeh'}</div>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Logistik Bungah 2</p>
                      </div>
                    </div>

                    <div className="text-center space-y-2 flex flex-col items-center">
                      <p className="font-semibold text-neutral-600">PIHAK KEDUA<br /><span className="text-neutral-450 block text-[9px] uppercase font-bold tracking-wider">(PENERIMA SEKOLAH)</span></p>

                      <div className="h-16 flex items-center justify-center border border-dashed border-stone-200 rounded-lg w-44 bg-stone-50/50 p-1 relative group">
                        {activeDocView.bastSignatureReceiver ? (
                          <div className="relative">
                            <img src={activeDocView.bastSignatureReceiver} alt="Ttd Penerima" className="h-14 object-contain mix-blend-multiply" />
                            <button
                              type="button"
                              onClick={() => handleUpdateDocumentSignature(activeDocView.id, 'bastSignatureReceiver', '')}
                              className="absolute -top-2 -right-2 bg-red-100 text-red-650 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 flex items-center justify-center h-5 w-5 text-[8px]"
                              title="Hapus Tanda Tangan"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveSigRequest({
                              docId: activeDocView.id,
                              targetField: 'bastSignatureReceiver',
                              title: 'Tanda Tangan Penerima (Pihak Kedua)',
                              suggestedName: activeDocView.bastPenerima || 'Ibu Aminah'
                            })}
                            className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            ✍️ Bubuhkan Ttd Penerima
                          </button>
                        )}
                      </div>

                      <div className="w-44 text-center">
                        <div className="border-b border-neutral-900 mx-auto font-bold uppercase text-neutral-800">{activeDocView.bastPenerima || 'Ibu Aminah'}</div>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Pihak Sekolah Penerima</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ORGANOLEPTIK FACSIMILE */}
              {activeDocView.type === 'organoleptik' && (
                <div className="space-y-6 mt-6">
                  <div className="text-center">
                    <h3 className="text-lg font-black tracking-wide font-sans underline">FORM ORGANOLEPTIK</h3>
                    <p className="text-[10px] font-sans font-semibold text-neutral-500 uppercase">UJI SENSORIK MUTU MAKANAN HARIAN</p>
                  </div>

                  {/* Instruction block */}
                  <div className="border border-neutral-300 p-3 bg-neutral-50 text-[10px] leading-relaxed rounded-lg select-none font-sans space-y-1">
                    <strong className="block text-emerald-800">Petunjuk Parameter Penilaian:</strong>
                    <p>Seksi Quality Checker diwajibkan melakukan pencicipan dan penilaian organoleptik menu santri sebelum didistribusikan. Berikan nilai 1 sampai 5:</p>
                    <div className="flex flex-wrap gap-4 text-neutral-600 font-semibold mt-1">
                      <span>1: Sangat Buruk / Basi</span>
                      <span>2: Kurang Suka</span>
                      <span>3: Sedikit Suka</span>
                      <span>4: Layak (SOP)</span>
                      <span>5: Sangat Suka / Gurih</span>
                    </div>
                  </div>

                  {/* Metadata block */}
                  <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                    <div className="space-y-1">
                      <p><strong className="text-neutral-600">Hari / Tanggal Pengujian:</strong> {getIndonesianDateText(activeDocView.date).dayName}, {getIndonesianDateText(activeDocView.date).dateNum} {getIndonesianDateText(activeDocView.date).monthName} {getIndonesianDateText(activeDocView.date).yearNum}</p>
                      <p><strong className="text-neutral-600">Jam Pengujian:</strong> {activeDocView.orlepJam || '11:30 WIB'}</p>
                      <p><strong className="text-neutral-600">Nama Panelis:</strong> {activeDocView.orlepPanelis || 'Avianti Rahma Dianita'}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p><strong className="text-neutral-600">Kecamatan / Desa:</strong> {activeDocView.orlepDesa || 'Bungah'}</p>
                      <p><strong className="text-neutral-600">Suhu CCP Hidangan:</strong> <span className="font-mono font-bold text-emerald-800 text-sm">{activeDocView.organoleptikSuhu || activeDocView.orlepSuhu || '68'} °C</span></p>
                      <p className="text-[10px] text-emerald-700 italic font-semibold">(Batas Kritis CCP &gt;60°C Terpenuhi)</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs font-sans">
                    <span className="text-neutral-450 font-bold uppercase text-[9px] block">Menu Masakan Harian Yang Diuji:</span>
                    <p className="font-extrabold text-neutral-800 bg-neutral-50 px-2 py-1 rounded border border-neutral-200 inline-block">{activeDocView.orlepMenu || 'Nasi Krawu Bungah, Ayam Goreng Lengkuas, Tempe Bacem, Melon'}</p>
                  </div>

                  {/* Evaluation Grid Table */}
                  <div className="border border-neutral-950 overflow-hidden font-sans">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-100 border-b border-neutral-950 text-[10px] font-bold text-center">
                          <th className="p-2 border-r border-neutral-950 text-left">Komponen Gizi Hidangan</th>
                          <th className="p-2 border-r border-neutral-950 w-24">Citarasa</th>
                          <th className="p-2 border-r border-neutral-950 w-24">Warna Alami</th>
                          <th className="p-2 border-r border-neutral-950 w-24">Aroma Harum</th>
                          <th className="p-2 border-r border-neutral-950 w-24">Tekstur Matang</th>
                          <th className="p-2">Rata-Rata</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-950 text-center font-bold text-neutral-850">
                        {(() => {
                          const menuItems = (activeDocView.orlepMenu || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                          return [
                            { code: 'MP', name: `Makanan Pokok (${menuItems[0] || 'Nasi Putih'})` },
                            { code: 'LH', name: `Lauk Hewani (${menuItems[1] || 'Lauk Protein'})` },
                            { code: 'LN', name: `Lauk Nabati (${menuItems[2] || 'Tahu/Tempe'})` },
                            { code: 'SY', name: `Sayur Hidangan (${menuItems[3] || 'Sayuran'})` },
                            { code: 'B', name: `Buah / Susu (${menuItems[4] || 'Buah/Suku'})` }
                          ];
                        })().map(comp => {
                          const r = activeDocView.orlepGrid?.[`${comp.code}_rasa`] || 4;
                          const w = activeDocView.orlepGrid?.[`${comp.code}_warna`] || 4;
                          const a = activeDocView.orlepGrid?.[`${comp.code}_aroma`] || 4;
                          const t = activeDocView.orlepGrid?.[`${comp.code}_tekstur`] || 4;
                          const avg = ((r + w + a + t) / 4).toFixed(1);
                          return (
                            <tr key={comp.code}>
                              <td className="p-2 border-r border-neutral-950 text-left font-extrabold text-neutral-700">{comp.name}</td>
                              <td className="p-2 border-r border-neutral-950 font-mono text-neutral-600">{r} / 5</td>
                              <td className="p-2 border-r border-neutral-950 font-mono text-neutral-600">{w} / 5</td>
                              <td className="p-2 border-r border-neutral-950 font-mono text-neutral-600">{a} / 5</td>
                              <td className="p-2 border-r border-neutral-950 font-mono text-neutral-600">{t} / 5</td>
                              <td className="p-2 font-black text-emerald-800 bg-emerald-50/40">{avg}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Kritik, Saran */}
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-neutral-500 uppercase text-[9px] block">Kritik, Saran & Rekomendasi Panelis Checker:</span>
                    <p className="bg-neutral-50 p-3 rounded border border-neutral-200 italic font-sans text-neutral-800 leading-relaxed">
                      "{activeDocView.orlepKritik || activeDocView.comments || 'Suhu hangat makanan terjaga prima, rasa gurih seimbang, melon segar layak konsumsi.'}"
                    </p>
                  </div>

                  <p className="text-[10px] text-neutral-500 font-sans leading-snug">
                    Pernyataan: Dengan menandatangani form ini, panelis menyatakan bahwa makanan tersebut di atas dinilai LAYAK KONSUMSI dan sesuai dengan standar gizi santri SPPG Bungah.
                  </p>

                  {/* Signatures */}
                  <div className="grid grid-cols-1 pt-4 text-xs font-sans">
                    <div className="text-right space-y-12 pr-12">
                      <p className="font-semibold text-neutral-600">Penguji / Panelis,<br /><span className="text-neutral-450 block text-[8px] uppercase tracking-wider font-extrabold">Checker Gizi SPPG</span></p>
                      <div>
                        <div className="border-b border-neutral-900 w-44 ml-auto font-bold text-neutral-800 uppercase">{activeDocView.orlepPanelis || 'Avianti Rahma Dianita'}</div>
                        <p className="text-[9px] text-neutral-400 mt-0.5">Seksi Kontrol Kualitas Dapur 2</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* SIGNATURE DRAWER MODAL OVERLAY */}
      {activeSigRequest && (
        <SignaturePad
          title={activeSigRequest.title}
          suggestedName={activeSigRequest.suggestedName}
          onSave={(signatureDataUrl) => {
            if (activeSigRequest.docId) {
              // Update existing saved document in shippingDocs & activeDocView!
              handleUpdateDocumentSignature(activeSigRequest.docId, activeSigRequest.targetField, signatureDataUrl);
            } else {
              // Just update the temporary state for the form being filled!
              if (activeSigRequest.targetField === 'sjSignatureAslap') {
                setTempSjSignatureAslap(signatureDataUrl);
              } else if (activeSigRequest.targetField === 'sjSignatureReceiver') {
                setTempSjSignatureReceiver(signatureDataUrl);
              } else if (activeSigRequest.targetField === 'bastSignatureDriver') {
                setTempBastSignatureDriver(signatureDataUrl);
              } else if (activeSigRequest.targetField === 'bastSignatureReceiver') {
                setTempBastSignatureReceiver(signatureDataUrl);
              }
            }
            setActiveSigRequest(null);
          }}
          onCancel={() => setActiveSigRequest(null)}
        />
      )}

    </div>
  );
}

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

export default function MockModules({ 
  moduleIndex, 
  onSetMenu,
  allDayMenus = [],
  onSaveMenu,
  onGenerateSOPs,
  onDeleteMenu,
  currentUserRole,
  loggedInUser,
  selectedDate,
  sops = [],
  setSops,
  onGoToTab,
  onSaveSopsToCloud
}: MockModulesProps) {
  // Common states
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dbErrorMsg, setDbErrorMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Forms states
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [activeSigRequest, setActiveSigRequest] = useState<{
    title: string;
    suggestedName: string;
    targetField: 'absensiKetua' | 'absensiAslap';
  } | null>(null);

  // Dynamic entity states
  const [stokSisa, setStokSisa] = useState<SisaStokItem[]>([]);
  const [orderRequests, setOrderRequests] = useState<OrderRequestItem[]>([]);
  const [keluhanList, setKeluhanList] = useState<VolunteerComplaintItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isInitialFetchDone, setIsInitialFetchDone] = useState(false);

  // === KEDATANGAN BARANG STATE ===
  interface KedatanganBarangItem {
    id: string;
    name: string;
    qty: number;
    uom: string;
    supplier: string;
    checker: 'LENGKAP' | 'KURANG' | 'BATAL';
    input: 'SUDAH' | 'BELUM';
    specification: string;
  }

  const [kedatanganMap, setRawKedatanganMap] = useState<Record<string, KedatanganBarangItem[]>>({});

  const syncKedatanganMapToSupabase = async (
    prev: Record<string, KedatanganBarangItem[]>,
    next: Record<string, KedatanganBarangItem[]>
  ) => {
    if (!isSupabaseConfigured || !supabase) return;
    setIsSyncing(true);
    try {
      const prevItems: { date: string; item: KedatanganBarangItem }[] = [];
      const nextItems: { date: string; item: KedatanganBarangItem }[] = [];

      Object.entries(prev).forEach(([date, items]) => {
        if (items) items.forEach(item => prevItems.push({ date, item }));
      });
      Object.entries(next).forEach(([date, items]) => {
        if (items) items.forEach(item => nextItems.push({ date, item }));
      });

      const prevIds = new Set(prevItems.map(x => x.item.id));
      const nextIds = new Set(nextItems.map(x => x.item.id));

      const deletedItems = prevItems.filter(x => !nextIds.has(x.item.id));
      for (const x of deletedItems) {
        await supabase.from('kedatangan_barang').delete().eq('id', x.item.id);
      }

      for (const x of nextItems) {
        const isNew = !prevIds.has(x.item.id);
        const prevX = prevItems.find(p => p.item.id === x.item.id);
        const isChanged = isNew || JSON.stringify(prevX?.item) !== JSON.stringify(x.item);

        if (isChanged) {
          const dbPayload = {
            id: x.item.id,
            date: x.date,
            name: x.item.name,
            qty: x.item.qty,
            uom: x.item.uom,
            supplier: x.item.supplier,
            checker: x.item.checker,
            input: x.item.input,
            specification: x.item.specification
          };
          await supabase.from('kedatangan_barang').upsert(dbPayload);
        }
      }
    } catch (err) {
      console.warn("Error syncing kedatangan_barang to Supabase:", err);
    }
  };

  const setKedatanganMap = (update: React.SetStateAction<Record<string, KedatanganBarangItem[]>>) => {
    setRawKedatanganMap(prev => {
      const next = typeof update === 'function' ? (update as any)(prev) : update;
      safeLocalStorageSetItem('sppg_kedatangan_barang_map', JSON.stringify(next));
      setTimeout(() => {
        syncKedatanganMapToSupabase(prev, next);
      }, 0);
      return next;
    });
  };

  // SQL Script console toggle
  const [showSqlPanel, setShowSqlPanel] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Form toggles
  const [isAddingSisa, setIsAddingSisa] = useState(false);
  const [sisaCategory, setSisaCategory] = useState('Protein Basah');
  const [sisaCond, setSisaCond] = useState('Sangat Segar (Chiller)');

  // Admin approval states
  const [adminNoteInput, setAdminNoteInput] = useState<Record<string, string>>({});
  const [adminComplaintAction, setAdminComplaintAction] = useState<Record<string, string>>({});

  const isAdmin = loggedInUser?.email === 'maghfurmunif@gmail.com' || loggedInUser?.email === 'punkysme@gmail.com' || currentUserRole === UserRole.ADMIN;

  // Shipping Documentation Type Definitions
  interface ShippingDocItem {
    id: string;
    type: 'ompreng' | 'serah_terima' | 'surat_jalan' | 'organoleptik';
    date: string;
    vehicleNumber: string;
    imageUrl: string;
    comments: string;
    uploadedBy: string;
    uploadedAt: string;
    receiverName?: string;
    status: string;
    // Specific fields for Organoleptik
    organoleptikRasa?: string;  
    organoleptikAroma?: string; 
    organoleptikTekstur?: string; 
    organoleptikSuhu?: string;   
  }

  // Shipping Docs States with LocalStorage synchronization
  const [shippingDocs, setRawShippingDocs] = useState<ShippingDocItem[]>([]);

  const syncShippingDocsToSupabase = async (prev: ShippingDocItem[], next: ShippingDocItem[]) => {
    if (!isSupabaseConfigured || !supabase) return;
    setIsSyncing(true);
    try {
      const prevIds = new Set(prev.map(d => d.id));
      const nextIds = new Set(next.map(d => d.id));

      const deletedIds = prev.filter(d => !nextIds.has(d.id)).map(d => d.id);
      for (const id of deletedIds) {
        await Promise.allSettled([
          supabase.from('shipping_docs').delete().eq('id', id),
          supabase.from('bast_docs').delete().eq('id', id),
          supabase.from('surat_jalan_docs').delete().eq('id', id),
          supabase.from('organoleptik_docs').delete().eq('id', id)
        ]);
      }

      for (const item of next) {
        const isNew = !prevIds.has(item.id);
        const prevItem = prev.find(d => d.id === item.id);
        const isChanged = isNew || JSON.stringify(prevItem) !== JSON.stringify(item);

        if (isChanged) {
          const promises: Promise<any>[] = [];

          // 1. General Shipping doc (shipping_docs)
          const shipPayload = {
            id: item.id,
            type: item.type || 'ompreng',
            date: item.date,
            vehicle_number: item.vehicleNumber || (item as any).sjDriver || '',
            receiver_name: item.receiverName || (item as any).sjKepada || (item as any).bastSekolah || '',
            sj_no: (item as any).sjNo || (item as any).bastNo || null,
            sj_kepada: (item as any).sjKepada || (item as any).bastSekolah || null,
            sj_driver: (item as any).sjDriver || (item as any).bastDriver || item.vehicleNumber || null,
            status: item.status || 'Selesai Kirim',
            items: (item as any).items || (item as any).sjRows || [],
            photo_url: item.imageUrl || '',
            image_url: item.imageUrl || '',
            comments: item.comments || '',
            uploaded_by: item.uploadedBy || '',
            uploaded_at: item.uploadedAt || new Date().toISOString()
          };
          promises.push(supabase.from('shipping_docs').upsert(shipPayload) as unknown as Promise<any>);

          // 2. BAST Doc (bast_docs)
          if (item.type === 'serah_terima' || (item as any).bastNo || (item as any).bastSekolah) {
            const bastPayload = {
              id: item.id,
              date: item.date,
              bast_no: (item as any).bastNo || `BAST-${item.date}-${item.id.slice(-4)}`,
              bast_sekolah: (item as any).bastSekolah || item.receiverName || '',
              bast_driver: (item as any).bastDriver || item.vehicleNumber || '',
              bast_penerima: (item as any).bastPenerima || item.receiverName || '',
              bast_barang: (item as any).bastBarang || '',
              bast_jumlah: (item as any).bastJumlah || 0,
              bast_waktu: (item as any).bastWaktu || '',
              status: item.status || 'BAST Sah',
              items: (item as any).items || [],
              photo_url: item.imageUrl || '',
              bast_signature_driver: (item as any).bastSignatureDriver || null,
              bast_signature_receiver: (item as any).bastSignatureReceiver || null,
              uploaded_by: item.uploadedBy || ''
            };
            promises.push(supabase.from('bast_docs').upsert(bastPayload) as unknown as Promise<any>);
          }

          // 3. Surat Jalan Doc (surat_jalan_docs)
          if (item.type === 'surat_jalan' || (item as any).sjNo || (item as any).sjKepada) {
            const sjPayload = {
              id: item.id,
              date: item.date,
              sj_no: (item as any).sjNo || `SJ-${item.date}-${item.id.slice(-4)}`,
              sj_kepada: (item as any).sjKepada || item.receiverName || '',
              sj_driver: (item as any).sjDriver || item.vehicleNumber || '',
              sj_waktu: (item as any).sjWaktu || '',
              status: item.status || 'Terkirim',
              items: (item as any).items || [],
              sj_rows: (item as any).sjRows || [],
              photo_url: item.imageUrl || '',
              comments: item.comments || '',
              sj_signature_aslap: (item as any).sjSignatureAslap || null,
              sj_signature_receiver: (item as any).sjSignatureReceiver || null,
              uploaded_by: item.uploadedBy || ''
            };
            promises.push(supabase.from('surat_jalan_docs').upsert(sjPayload) as unknown as Promise<any>);
          }

          // 4. Organoleptik Doc (organoleptik_docs)
          if (item.type === 'organoleptik' || (item as any).orlepMenu || item.organoleptikRasa) {
            const orlepPayload = {
              id: item.id,
              date: item.date,
              tester_name: (item as any).orlepPanelis || item.uploadedBy || '',
              menu_name: (item as any).orlepMenu || item.comments || '',
              orlep_menu: (item as any).orlepMenu || item.comments || '',
              orlep_panelis: (item as any).orlepPanelis || item.uploadedBy || '',
              orlep_jam: (item as any).orlepJam || '',
              orlep_desa: (item as any).orlepDesa || '',
              organoleptik_rasa: item.organoleptikRasa || '',
              organoleptik_aroma: item.organoleptikAroma || '',
              organoleptik_tekstur: item.organoleptikTekstur || '',
              organoleptik_suhu: item.organoleptikSuhu || '',
              orlep_kritik: (item as any).orlepKritik || '',
              orlep_grid: (item as any).orlepGrid || [],
              orlep_signature: (item as any).orlepSignature || null,
              notes: item.comments || '',
              status: item.status || 'Lulus Uji',
              photo_url: item.imageUrl || '',
              uploaded_by: item.uploadedBy || ''
            };
            promises.push(supabase.from('organoleptik_docs').upsert(orlepPayload) as unknown as Promise<any>);
          }

          const results = await Promise.allSettled(promises);
          results.forEach((res, idx) => {
            if (res.status === 'fulfilled') {
               const { error } = res.value as any;
               if (error) console.warn(`Failed to upsert doc part ${idx} for item ${item.id}:`, error);
            } else {
               console.warn(`Promise rejected for item ${item.id}:`, res.reason);
            }
          });
        }
      }
    } catch (err) {
      console.warn("Error syncing docs to Supabase:", err);
    }
  };

  const setShippingDocs = (update: React.SetStateAction<ShippingDocItem[]>) => {
    setRawShippingDocs(prev => {
      const next = typeof update === 'function' ? (update as any)(prev) : update;
      setTimeout(() => {
        syncShippingDocsToSupabase(prev, next);
      }, 0);
      return next;
    });
  };

  // Stock Opname & Trash Items Type Definitions
  interface StockItem {
    id: string;
    category: string;
    name: string;
    stokAwal: number;
    barangMasuk: number;
    stokAkhir: number;
    uom: string;
    expiredDate?: string;
  }

  interface TrashItem {
    id: string;
    tanggal: string;
    hari: string;
    namaMenu: string;
    porsiBesar: number;
    porsiKecil: number;
    gramasiMP: number;
    gramasiLN: number;
    gramasiLH: number;
    gramasiSY: number;
    gramasiBuah: number;
    sampahMP: number;
    sampahLN: number;
    sampahLH: number;
    sampahSY: number;
    sampahBuah: number;
    sampahOrganik: number;
    sampahAnorganik: number;
  }

  // Stock Opname States
  const STOCK_CATEGORIES = [
    'Bumbu', 'Saus', 'Pertepungan', 'Makanan Pokok', 'Susu', 'Minyak', 
    'Air', 'Plastik', 'Chiller', 'Frezer', 'Lauk', 'Buah', 'Sayur', 'Lain-Lain'
  ];

  const defaultStockTemplate: StockItem[] = [
    { id: 'st-1', category: 'Bumbu', name: 'Kunyit bubuk Desaku', stokAwal: 10, barangMasuk: 5, stokAkhir: 15, uom: 'Sachet' },
    { id: 'st-2', category: 'Bumbu', name: 'Gula Pasir Rose Brand', stokAwal: 50, barangMasuk: 10, stokAkhir: 60, uom: 'Kg' },
    { id: 'st-3', category: 'Bumbu', name: 'Gula Merah Saringan', stokAwal: 2.2, barangMasuk: 0, stokAkhir: 2.2, uom: 'Kg' },
    { id: 'st-4', category: 'Bumbu', name: 'Garam Beriodium Garamku', stokAwal: 30, barangMasuk: 10, stokAkhir: 40, uom: 'Pack' },
    { id: 'st-5', category: 'Saus', name: 'Kecap Manis ABC', stokAwal: 5, barangMasuk: 2, stokAkhir: 7, uom: 'Jerigen 5L' },
    { id: 'st-6', category: 'Saus', name: 'Saus Sambal Asli ABC', stokAwal: 4, barangMasuk: 1, stokAkhir: 5, uom: 'Jerigen 5L' },
    { id: 'st-7', category: 'Pertepungan', name: 'Tepung Terigu Segitiga Biru', stokAwal: 25, barangMasuk: 25, stokAkhir: 50, uom: 'Kg' },
    { id: 'st-8', category: 'Pertepungan', name: 'Tepung Maizena Kunci', stokAwal: 6, barangMasuk: 2, stokAkhir: 8, uom: 'Dus' },
    { id: 'st-9', category: 'Makanan Pokok', name: 'Beras Premium Cianjur', stokAwal: 15, barangMasuk: 15, stokAkhir: 30, uom: 'Zak' },
    { id: 'st-10', category: 'Makanan Pokok', name: 'Mie Kering Telur Enak', stokAwal: 5, barangMasuk: 5, stokAkhir: 10, uom: 'Dus' },
    { id: 'st-11', category: 'Susu', name: 'SKM Carnation Original', stokAwal: 20, barangMasuk: 24, stokAkhir: 44, uom: 'Kaleng' },
    { id: 'st-12', category: 'Minyak', name: 'Minyak Goreng Bimoli Klasik', stokAwal: 12, barangMasuk: 12, stokAkhir: 24, uom: 'Pouch 2L' },
    { id: 'st-13', category: 'Air', name: 'Air Mineral Club Tanggung', stokAwal: 10, barangMasuk: 20, stokAkhir: 30, uom: 'Karton' },
    { id: 'st-14', category: 'Plastik', name: 'Kantong Plastik Kresek Putih 15', stokAwal: 8, barangMasuk: 4, stokAkhir: 12, uom: 'Pack' },
    { id: 'st-15', category: 'Plastik', name: 'Plastic Wrap Hygiene Roll', stokAwal: 3, barangMasuk: 1, stokAkhir: 4, uom: 'Roll' },
    { id: 'st-16', category: 'Chiller', name: 'Bawang Merah Kupas Segar', stokAwal: 5, barangMasuk: 5, stokAkhir: 10, uom: 'Kg' },
    { id: 'st-17', category: 'Chiller', name: 'Bawang Putih Kupas Segar', stokAwal: 4, barangMasuk: 4, stokAkhir: 8, uom: 'Kg' },
    { id: 'st-18', category: 'Frezer', name: 'Daging Sapi Giling Porsi', stokAwal: 10, barangMasuk: 10, stokAkhir: 20, uom: 'Kg' },
    { id: 'st-19', category: 'Frezer', name: 'Fillet Dada Ayam Segar', stokAwal: 15, barangMasuk: 15, stokAkhir: 30, uom: 'Kg' },
    { id: 'st-20', category: 'Lauk', name: 'Telur Ayam Broiler', stokAwal: 3, barangMasuk: 5, stokAkhir: 8, uom: 'Peti' },
    { id: 'st-21', category: 'Lauk', name: 'Tempe Papan Bungkus Daun', stokAwal: 20, barangMasuk: 30, stokAkhir: 50, uom: 'Pcs' },
    { id: 'st-22', category: 'Buah', name: 'Semangka Merah Tanpa Biji', stokAwal: 15, barangMasuk: 15, stokAkhir: 30, uom: 'Kg' },
    { id: 'st-23', category: 'Buah', name: 'Melon Orange Manis', stokAwal: 10, barangMasuk: 10, stokAkhir: 20, uom: 'Kg' },
    { id: 'st-24', category: 'Sayur', name: 'Wortel Lokal Bersepat', stokAwal: 12, barangMasuk: 8, stokAkhir: 20, uom: 'Kg' },
    { id: 'st-25', category: 'Sayur', name: 'Kubis/Kol Putih Bulat', stokAwal: 10, barangMasuk: 10, stokAkhir: 20, uom: 'Kg' },
    { id: 'st-26', category: 'Lain-Lain', name: 'Sabun Cuci Piring Mama Lemon', stokAwal: 5, barangMasuk: 5, stokAkhir: 10, uom: 'Pouch' }
  ];

  const [selectedStockDate, setSelectedStockDate] = useState<string>(selectedDate || '2026-06-16');

  // Synchronize dynamic date changes from central calendar
  useEffect(() => {
    if (selectedDate) {
      setSelectedStockDate(selectedDate);
    }
  }, [selectedDate]);

  const [stockMap, setRawStockMap] = useState<Record<string, StockItem[]>>({});

  const setStockMap = (update: React.SetStateAction<Record<string, StockItem[]>>) => {
    setRawStockMap(prev => {
      const next = typeof update === 'function' ? (update as any)(prev) : update;
      if (isSupabaseConfigured && supabase) {
        setIsSyncing(true);
        const promises = Object.keys(next).map(date => {
          if (JSON.stringify(prev[date]) !== JSON.stringify(next[date])) {
            return supabase.from('stock_opname_docs').upsert({ date, items: next[date] });
          }
          return Promise.resolve();
        });
        Promise.all(promises).finally(() => setTimeout(() => setIsSyncing(false), 800));
      }
      return next;
    });
  };

  const setOperasionalMap = (update: React.SetStateAction<Record<string, StockItem[]>>) => {
    setRawOperasionalMap(prev => {
      const next = typeof update === 'function' ? (update as any)(prev) : update;
      if (isSupabaseConfigured && supabase) {
        setIsSyncing(true);
        const promises = Object.keys(next).map(date => {
          if (JSON.stringify(prev[date]) !== JSON.stringify(next[date])) {
            return supabase.from('stok_operasional_docs').upsert({ date, items: next[date] });
          }
          return Promise.resolve();
        });
        Promise.all(promises).finally(() => setTimeout(() => setIsSyncing(false), 800));
      }
      return next;
    });
  };

  const setTrashItems = (update: React.SetStateAction<TrashItem[]>) => {
    setRawTrashItems(prev => {
      const next = typeof update === 'function' ? (update as any)(prev) : update;
      if (isSupabaseConfigured && supabase) {
         setIsSyncing(true);
         (async () => {
           try {
             await supabase.from('rekap_sampah_docs').upsert({ id: 'global', items: next });
           } catch (e) {}
           setTimeout(() => setIsSyncing(false), 800);
         })();
      }
      return next;
    });
  };

  // Current active date's stock items
  const activeStockList = stockMap[selectedStockDate] && stockMap[selectedStockDate].length > 0
    ? stockMap[selectedStockDate]
    : defaultStockTemplate;

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Semua');
  const [newStockName, setNewStockName] = useState('');
  const [newStockCat, setNewStockCat] = useState('Bumbu');
  const [newStockStokAwal, setNewStockStokAwal] = useState('0');
  const [newStockBarangMasuk, setNewStockBarangMasuk] = useState('0');
  const [newStockStokAkhir, setNewStockStokAkhir] = useState('0');
  const [newStockUom, setNewStockUom] = useState('Kg');
  const [newStockExpiredDate, setNewStockExpiredDate] = useState('');
  const [isAddingStockItem, setIsAddingStockItem] = useState(false);

  // Waste (Rekap Sampah) States & Views
  const [wasteViewMode, setWasteViewMode] = useState<'card' | 'table'>('card');
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  const [trashItems, setRawTrashItems] = useState<TrashItem[]>([]);

  const [newTrashDate, setNewTrashDate] = useState('');
  const [newTrashHari, setNewTrashHari] = useState('Senin');
  const [newTrashMenu, setNewTrashMenu] = useState('');
  const [newTrashPorsiBesar, setNewTrashPorsiBesar] = useState(0);
  const [newTrashPorsiKecil, setNewTrashPorsiKecil] = useState(0);
  const [newTrashGramasiMP, setNewTrashGramasiMP] = useState(0);
  const [newTrashGramasiLN, setNewTrashGramasiLN] = useState(0);
  const [newTrashGramasiLH, setNewTrashGramasiLH] = useState(0);
  const [newTrashGramasiSY, setNewTrashGramasiSY] = useState(0);
  const [newTrashGramasiBuah, setNewTrashGramasiBuah] = useState(0);
  const [newTrashSampahMP, setNewTrashSampahMP] = useState(0);
  const [newTrashSampahLN, setNewTrashSampahLN] = useState(0);
  const [newTrashSampahLH, setNewTrashSampahLH] = useState(0);
  const [newTrashSampahSY, setNewTrashSampahSY] = useState(0);
  const [newTrashSampahBuah, setNewTrashSampahBuah] = useState(0);
  const [newTrashSisaOrganik, setNewTrashSisaOrganik] = useState(0);
  const [newTrashSisaAnorganik, setNewTrashSisaAnorganik] = useState(0);
  const [isAddingTrash, setIsAddingTrash] = useState(false);

  // Auto-sync Trash Menu and Portions when date changes
  useEffect(() => {
    if (!newTrashDate) return;
    
    // 1. Map Day name
    const indonesianDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    try {
      const d = new Date(newTrashDate);
      const dayName = indonesianDays[d.getDay()];
      setNewTrashHari(dayName);
    } catch (e) {
      // ignore
    }

    // 2. Map Menu Name from allDayMenus
    const foundMenu = allDayMenus?.find(m => m.date === newTrashDate);
    if (foundMenu && foundMenu.menuList && foundMenu.menuList.length > 0) {
      setNewTrashMenu(foundMenu.menuList.join(', '));
    } else {
      setNewTrashMenu('');
    }

    // 3. Map Master Portions
    const DEFAULT_PORTIONS_LOCAL = {
      MA: { guru: 48, siswa: 207 },
      "MTS II": { guru: 45, siswa: 518 },
      SMK: { guru: 55, siswa: 567 },
      SMA: { guru: 50, siswa: 861 },
      Sukowati: { besar: 80, kecil: 40 },
      Sidokumpul: { besar: 95, kecil: 45 }
    };

    let portionConfig = DEFAULT_PORTIONS_LOCAL;
    try {
      const saved = localStorage.getItem(`sppg_portions_${newTrashDate}`);
      if (saved) {
        portionConfig = JSON.parse(saved);
      }
    } catch (e) {
      // ignore
    }

    const porsiBesar = 
      (portionConfig.MA?.guru || 0) + (portionConfig.MA?.siswa || 0) +
      (portionConfig["MTS II"]?.guru || 0) + (portionConfig["MTS II"]?.siswa || 0) +
      (portionConfig.SMK?.guru || 0) + (portionConfig.SMK?.siswa || 0) +
      (portionConfig.SMA?.guru || 0) + (portionConfig.SMA?.siswa || 0) +
      (portionConfig.Sukowati?.besar || 0) + (portionConfig.Sidokumpul?.besar || 0);

    const porsiKecil = (portionConfig.Sukowati?.kecil || 0) + (portionConfig.Sidokumpul?.kecil || 0);

    setNewTrashPorsiBesar(porsiBesar);
    setNewTrashPorsiKecil(porsiKecil);

  }, [newTrashDate, allDayMenus]);

  // States for case 10 (Menu Harian Gizi Ponpes) declared at top-level to satisfy Rules of Hooks:
  const [localSchedDate, setLocalSchedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2); // default to Day H+2
    return d.toISOString().split('T')[0];
  });
  const [localSchedItems, setLocalSchedItems] = useState<string[]>([]);
  const [localItemInput, setLocalItemInput] = useState('');
  const [isSavingSched, setIsSavingSched] = useState(false);

  // --- STATES FOR STOK OPERASIONAL ---
  const defaultOperasionalTemplate: StockItem[] = [
    { id: 'op-1', category: 'Kebersihan', name: 'Sabun Cuci Piring Mama Lemon', stokAwal: 3, barangMasuk: 2, stokAkhir: 5, uom: 'Jerigen' },
    { id: 'op-2', category: 'ATK', name: 'Buku Catatan Laporan Harian', stokAwal: 2, barangMasuk: 5, stokAkhir: 7, uom: 'Pcs' },
    { id: 'op-3', category: 'ATK', name: 'Bulpen Standard Hitam', stokAwal: 10, barangMasuk: 12, stokAkhir: 22, uom: 'Box' },
    { id: 'op-4', category: 'Air', name: 'Galon Air Minum Isi Ulang', stokAwal: 5, barangMasuk: 10, stokAkhir: 15, uom: 'Galon' },
    { id: 'op-5', category: 'APD', name: 'Masker Sensi Earloop 3-ply', stokAwal: 2, barangMasuk: 3, stokAkhir: 5, uom: 'Box' },
    { id: 'op-6', category: 'APD', name: 'Sarung Tangan Plastik Higienis', stokAwal: 4, barangMasuk: 4, stokAkhir: 8, uom: 'Box' }
  ];

  const [selectedOperasionalDate, setSelectedOperasionalDate] = useState<string>(selectedDate || '2026-06-16');

  // Sync date change
  useEffect(() => {
    if (selectedDate) {
      setSelectedOperasionalDate(selectedDate);
    }
  }, [selectedDate]);

  const [operasionalMap, setRawOperasionalMap] = useState<Record<string, StockItem[]>>({});

  useEffect(() => {
    safeLocalStorageSetItem('sppg_stok_operasional_by_date_v1', JSON.stringify(operasionalMap));
  }, [operasionalMap]);

  useEffect(() => {
    safeLocalStorageSetItem('sppg_stock_opname_by_date_v4', JSON.stringify(stockMap));
  }, [stockMap]);

  useEffect(() => {
    safeLocalStorageSetItem('sppg_rekap_sampah_v3', JSON.stringify(trashItems));
  }, [trashItems]);

  // Saved Reports State for Stock Opname, Stok Operasional, and Kedatangan Barang
  interface SavedReport {
    id: string;
    date: string;
    module: 'stock' | 'operasional' | 'kedatangan';
    timestamp: string;
    fileName: string;
    itemCount: number;
    headers: string[];
    rows: string[][];
  }

  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    safeLocalStorageSetItem('sppg_saved_reports_excel_v1', JSON.stringify(savedReports));
  }, [savedReports]);

  const addSavedReport = (date: string, module: 'stock' | 'operasional' | 'kedatangan', fileName: string, itemCount: number, headers: string[], rows: string[][]) => {
    const newReport: SavedReport = {
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date,
      module,
      timestamp: new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      fileName,
      itemCount,
      headers,
      rows
    };
    setSavedReports(prev => [newReport, ...prev]);
  };

  const triggerSuccessMsg = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const loadSisaStokFromLocal = () => {
    setStokSisa([]);
  };

  const loadOrdersFromLocal = () => {
    setOrderRequests([]);
  };

  const loadKeluhanFromLocal = () => {
    setKeluhanList([]);
  };

  const fetchDatabaseData = async () => {
    setIsLoadingData(true);
    setDbErrorMsg(null);
    try {
      if (isSupabaseConfigured && supabase) {
        // Fetch Sisa Stok
        const { data: sisaData, error: sisaErr } = await supabase
          .from('sisa_stok')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!sisaErr && sisaData) {
          setStokSisa(sisaData);
        } else {
          if (sisaErr) console.warn("sisa_stok table query error: ", sisaErr.message);
          loadSisaStokFromLocal();
        }

        // Fetch Order Requests
        const { data: orderData, error: orderErr } = await supabase
          .from('order_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (!orderErr && orderData) {
          setOrderRequests(orderData);
        } else {
          if (orderErr) console.warn("order_requests table query error: ", orderErr.message);
          loadOrdersFromLocal();
        }

        // Fetch Complaints
        const { data: keluhanData, error: keluhanErr } = await supabase
          .from('volunteer_complaints')
          .select('*')
          .order('created_at', { ascending: false });

        if (!keluhanErr && keluhanData) {
          setKeluhanList(keluhanData);
        } else {
          if (keluhanErr) console.warn("volunteer_complaints table query error: ", keluhanErr.message);
          loadKeluhanFromLocal();
        }

        // Fetch Shipping Docs (BAST, Surat Jalan, Organoleptik, Ompreng) across dedicated tables
        try {
          const targetDate = selectedDate || '2026-06-16';

const [shipRes, bastRes, sjRes, orlepRes] = await Promise.allSettled([
            supabase.from('shipping_docs').select('*').order('date', { ascending: false }).limit(500),
            supabase.from('bast_docs').select('*').order('date', { ascending: false }).limit(500),
            supabase.from('surat_jalan_docs').select('*').order('date', { ascending: false }).limit(500),
            supabase.from('organoleptik_docs').select('*').order('date', { ascending: false }).limit(500)
          ]);

          const combinedMap = new Map<string, any>();

          // 1. Process shipping_docs
          if (shipRes.status === 'fulfilled' && shipRes.value.data) {
            shipRes.value.data.forEach((d: any) => {
              combinedMap.set(d.id, {
                id: d.id,
                type: d.type || 'ompreng',
                date: d.date,
                vehicleNumber: d.vehicle_number || d.sj_driver || '',
                imageUrl: d.image_url || d.photo_url || '',
                comments: d.comments || '',
                uploadedBy: d.uploaded_by || '',
                uploadedAt: d.uploaded_at || d.created_at || new Date().toISOString(),
                receiverName: d.receiver_name || d.sj_kepada || '',
                status: d.status || 'Selesai Kirim',
                sjNo: d.sj_no,
                sjKepada: d.sj_kepada,
                sjDriver: d.sj_driver
              });
            });
          }

          // 2. Process bast_docs
          if (bastRes.status === 'fulfilled' && bastRes.value.data) {
            bastRes.value.data.forEach((d: any) => {
              const existing = combinedMap.get(d.id) || {};
              combinedMap.set(d.id, {
                ...existing,
                id: d.id,
                type: 'serah_terima',
                date: d.date,
                vehicleNumber: d.bast_driver || existing.vehicleNumber || '',
                imageUrl: d.photo_url || existing.imageUrl || '',
                comments: existing.comments || '',
                uploadedBy: d.uploaded_by || existing.uploadedBy || '',
                uploadedAt: d.created_at || existing.uploadedAt || new Date().toISOString(),
                receiverName: d.bast_penerima || d.bast_sekolah || existing.receiverName || '',
                status: d.status || 'BAST Sah',
                bastNo: d.bast_no,
                bastDriver: d.bast_driver,
                bastSekolah: d.bast_sekolah,
                bastPenerima: d.bast_penerima,
                bastBarang: d.bast_barang,
                bastJumlah: d.bast_jumlah,
                bastWaktu: d.bast_waktu,
                items: d.items,
                bastSignatureDriver: d.bast_signature_driver,
                bastSignatureReceiver: d.bast_signature_receiver
              });
            });
          }

          // 3. Process surat_jalan_docs
          if (sjRes.status === 'fulfilled' && sjRes.value.data) {
            sjRes.value.data.forEach((d: any) => {
              const existing = combinedMap.get(d.id) || {};
              combinedMap.set(d.id, {
                ...existing,
                id: d.id,
                type: 'surat_jalan',
                date: d.date,
                vehicleNumber: d.sj_driver || existing.vehicleNumber || '',
                imageUrl: d.photo_url || existing.imageUrl || '',
                comments: d.comments || existing.comments || '',
                uploadedBy: d.uploaded_by || existing.uploadedBy || '',
                uploadedAt: d.created_at || existing.uploadedAt || new Date().toISOString(),
                receiverName: d.sj_kepada || existing.receiverName || '',
                status: d.status || 'Terkirim',
                sjNo: d.sj_no,
                sjKepada: d.sj_kepada,
                sjDriver: d.sj_driver,
                sjWaktu: d.sj_waktu,
                items: d.items,
                sjRows: typeof d.sj_rows === 'string' ? JSON.parse(d.sj_rows) : d.sj_rows,
                sjSignatureAslap: d.sj_signature_aslap,
                sjSignatureReceiver: d.sj_signature_receiver
              });
            });
          }

          // 4. Process organoleptik_docs
          if (orlepRes.status === 'fulfilled' && orlepRes.value.data) {
            orlepRes.value.data.forEach((d: any) => {
              const existing = combinedMap.get(d.id) || {};
              combinedMap.set(d.id, {
                ...existing,
                id: d.id,
                type: 'organoleptik',
                date: d.date,
                vehicleNumber: existing.vehicleNumber || '',
                imageUrl: d.photo_url || existing.imageUrl || '',
                comments: d.notes || d.orlep_kritik || existing.comments || '',
                uploadedBy: d.uploaded_by || d.tester_name || d.orlep_panelis || existing.uploadedBy || '',
                uploadedAt: d.created_at || existing.uploadedAt || new Date().toISOString(),
                receiverName: d.tester_name || d.orlep_panelis || existing.receiverName || '',
                status: d.status || 'Lulus Uji',
                organoleptikRasa: d.organoleptik_rasa,
                organoleptikAroma: d.organoleptik_aroma,
                organoleptikTekstur: d.organoleptik_tekstur,
                organoleptikSuhu: d.organoleptik_suhu,
                orlepJam: d.orlep_jam,
                orlepPanelis: d.orlep_panelis || d.tester_name,
                orlepDesa: d.orlep_desa,
                orlepMenu: d.orlep_menu || d.menu_name,
                orlepKritik: d.orlep_kritik,
                orlepGrid: typeof d.orlep_grid === 'string' ? JSON.parse(d.orlep_grid) : d.orlep_grid,
                orlepSignature: d.orlep_signature
              });
            });
          }

          const allFetched = Array.from(combinedMap.values());
          setRawShippingDocs(allFetched);
        } catch (err) {
          console.warn("Failed fetching documents:", err);
        }


        // Fetch Stock Opname Docs, Stok Operasional Docs, Trash Items
        try {
          const [soRes, opRes, trashRes] = await Promise.allSettled([
            supabase.from('stock_opname_docs').select('*'),
            supabase.from('stok_operasional_docs').select('*'),
            supabase.from('rekap_sampah_docs').select('*').eq('id', 'global').maybeSingle()
          ]);
          
          if (soRes.status === 'fulfilled' && soRes.value.data) {
             const map: Record<string, StockItem[]> = {};
             soRes.value.data.forEach(d => { map[d.date] = d.items; });
             setRawStockMap(map);
          }
          if (opRes.status === 'fulfilled' && opRes.value.data) {
             const map: Record<string, StockItem[]> = {};
             opRes.value.data.forEach(d => { map[d.date] = d.items; });
             setRawOperasionalMap(map);
          }
          if (trashRes.status === 'fulfilled' && trashRes.value.data) {
             setRawTrashItems(trashRes.value.data.items || []);
          }
        } catch (e) {
          console.warn('Error fetching new docs:', e);
        }

        // Fetch Kedatangan Barang - Filtered by selectedDate
        try {
          const targetDate = selectedDate || '2026-06-16';
          const { data: kdData, error: kdErr } = await supabase
            .from('kedatangan_barang')
            .select('*')
            .eq('date', targetDate);

          if (!kdErr && kdData) {
            const map: Record<string, KedatanganBarangItem[]> = {};
            kdData.forEach(item => {
              const d = item.date;
              if (!map[d]) map[d] = [];
              map[d].push({
                id: item.id,
                name: item.name,
                qty: Number(item.qty),
                uom: item.uom,
                supplier: item.supplier,
                checker: item.checker as any,
                input: item.input as any,
                specification: item.specification
              });
            });
            setRawKedatanganMap(map);
          } else if (kdErr) {
            console.warn("kedatangan_barang table query error:", kdErr.message);
          }
        } catch (err) {
          console.warn("Failed fetching kedatangan_barang:", err);
        }

      } else {
        loadSisaStokFromLocal();
        loadOrdersFromLocal();
        loadKeluhanFromLocal();
      }
    } catch (e: any) {
      console.warn("Error fallback loading: ", e);
      loadSisaStokFromLocal();
      loadOrdersFromLocal();
      loadKeluhanFromLocal();
    } finally {
      setIsLoadingData(false);
      setIsInitialFetchDone(true);
    }
  };

  useEffect(() => {
    fetchDatabaseData();
  }, [moduleIndex, selectedDate]);

  // Handle adding new sisa stok item
  const handleAddSisaStok = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName || !formData.qty || !formData.action) return;

    const newItem: SisaStokItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'stok-' + Math.random().toString(36).substring(7),
      item_name: formData.itemName,
      category: sisaCategory,
      quantity: formData.qty,
      condition: sisaCond,
      action_plan: formData.action,
      created_by: loggedInUser?.email || 'staf@sppg.com',
      created_at: new Date().toISOString()
    };

    let isSavedRemote = false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('sisa_stok').insert([{
          id: newItem.id,
          item_name: newItem.item_name,
          category: newItem.category,
          quantity: newItem.quantity,
          condition: newItem.condition,
          action_plan: newItem.action_plan,
          created_by: newItem.created_by
        }]);
        if (!error) isSavedRemote = true;
      } catch (err) {
        console.warn("Supabase insert error:", err);
      }
    }

    const updated = [newItem, ...stokSisa];
    setStokSisa(updated);
    safeLocalStorageSetItem('sppg_sisa_stok', JSON.stringify(updated));
    setFormData({});
    setIsAddingSisa(false);
    triggerSuccessMsg(isSavedRemote 
      ? `Stok sisa "${newItem.item_name}" berhasil disinkronisasi ke Cloud Database!` 
      : `Stok sisa "${newItem.item_name}" berhasil disimpan lokal!`
    );
  };

  // Handle deleting sisa stok
  const handleDeleteSisaStok = async (id: string) => {
    let deletedRemote = false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('sisa_stok').delete().eq('id', id);
        if (!error) deletedRemote = true;
      } catch (err) {
        console.warn('Delete error remote: ', err);
      }
    }
    const updated = stokSisa.filter(item => item.id !== id);
    setStokSisa(updated);
    safeLocalStorageSetItem('sppg_sisa_stok', JSON.stringify(updated));
    triggerSuccessMsg(deletedRemote ? "Data sisa stok terhapus dari Cloud!" : "Data sisa stok terhapus secara lokal!");
  };

  // Handle creating order request
  const handleCreateOrderRequest = async (e: React.FormEvent, isAlat: boolean) => {
    e.preventDefault();
    if (!formData.itemName || !formData.qty || !formData.reason) return;

    const newItem: OrderRequestItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'o-' + Math.random().toString(36).substring(7),
      item_name: formData.itemName,
      qty: formData.qty,
      reason: formData.reason,
      category: isAlat ? 'alat' : 'operasional',
      status: 'pending',
      created_by: loggedInUser?.email || 'chef@sppg.com',
      created_at: new Date().toISOString()
    };

    let isSavedRemote = false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('order_requests').insert([{
          id: newItem.id,
          item_name: newItem.item_name,
          qty: newItem.qty,
          reason: newItem.reason,
          category: newItem.category,
          status: newItem.status,
          created_by: newItem.created_by
        }]);
        if (!error) isSavedRemote = true;
      } catch (err) {
        console.warn("Supabase insert order error:", err);
      }
    }

    const updated = [newItem, ...orderRequests];
    setOrderRequests(updated);
    safeLocalStorageSetItem('sppg_order_requests', JSON.stringify(updated));
    setFormData({});
    triggerSuccessMsg(isSavedRemote
      ? `Pengajuan order ${isAlat ? 'Alat' : 'Operasional'} berhasil dikirim ke Cloud Database!` 
      : `Pengajuan order ${isAlat ? 'Alat' : 'Operasional'} disimpan secara lokal!`
    );
  };

  // Handle updating order request status (Admin)
  const handleUpdateOrderStatus = async (id: string, nextStatus: 'disetujui' | 'ditolak' | 'ditolak_admin_utama') => {
    const notes = adminNoteInput[id] || '';
    let isUpdatedRemote = false;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('order_requests')
          .update({ status: nextStatus, notes })
          .eq('id', id);
        if (!error) isUpdatedRemote = true;
      } catch (err) {
        console.warn("Supabase update error: ", err);
      }
    }

    const updated = orderRequests.map(req => 
      req.id === id ? { ...req, status: nextStatus, notes } : req
    );
    setOrderRequests(updated);
    safeLocalStorageSetItem('sppg_order_requests', JSON.stringify(updated));
    
    // Clear admin input for this ID
    setAdminNoteInput(prev => ({ ...prev, [id]: '' }));
    triggerSuccessMsg(isUpdatedRemote
      ? `Pengajuan berhasil di-${nextStatus} di Cloud Database!`
      : `Pengajuan berhasil di-${nextStatus} secara lokal!`
    );
  };

  // Handle volunteer complaint submission
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.source || !formData.category || !formData.complaintText) return;

    const newItem: VolunteerComplaintItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'k-' + Math.random().toString(36).substring(7),
      source: formData.source,
      category: formData.category,
      complaint_text: formData.complaintText,
      status: 'pending',
      created_by: loggedInUser?.email || 'wali@sppg.com',
      created_at: new Date().toISOString()
    };

    let isSavedRemote = false;
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('volunteer_complaints').insert([{
          id: newItem.id,
          source: newItem.source,
          category: newItem.category,
          complaint_text: newItem.complaint_text,
          status: newItem.status,
          created_by: newItem.created_by
        }]);
        if (!error) isSavedRemote = true;
      } catch (err) {
        console.warn("Supabase insert complaint failure:", err);
      }
    }

    const updated = [newItem, ...keluhanList];
    setKeluhanList(updated);
    safeLocalStorageSetItem('sppg_volunteer_complaints', JSON.stringify(updated));
    setFormData({});
    triggerSuccessMsg(isSavedRemote
      ? "Laporan keluhan berhasil diunggah ke Cloud Database!" 
      : "Laporan keluhan berhasil dicatat secara lokal!"
    );
  };

  // Handle updating complement resolution (Admin)
  const handleResolveComplaint = async (id: string) => {
    const actionPlan = adminComplaintAction[id] || 'Telah diverifikasi dan ditindaklanjuti oleh Administrator.';
    let isUpdatedRemote = false;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('volunteer_complaints')
          .update({ action_taken: actionPlan, status: 'selesai' })
          .eq('id', id);
        if (!error) isUpdatedRemote = true;
      } catch (err) {
        console.warn("Supabase complaint update error:", err);
      }
    }

    const updated = keluhanList.map(kel => 
      kel.id === id ? { ...kel, action_taken: actionPlan, status: 'selesai' as const } : kel
    );
    setKeluhanList(updated);
    safeLocalStorageSetItem('sppg_volunteer_complaints', JSON.stringify(updated));
    setAdminComplaintAction(prev => ({ ...prev, [id]: '' }));
    triggerSuccessMsg(isUpdatedRemote
      ? "Keluhan relawan berhasil diselesaikan di Cloud Database!"
      : "Keluhan relawan berhasil diselesaikan secara lokal!"
    );
  };

  // SQL code block template string
  const postgres_sql_scripts = `-- =========================================================================
-- MASTER SQL MIGRASI & SEED DATA BARU - SPPG PONPES GIZI GRESIK
-- =========================================================================
-- Salin dan jalankan seluruh query ini di SQL Editor dashboard Supabase Anda.
-- Perintah di bawah ini akan menghapus semua skema lama agar bersih,
-- membuat tabel baru dengan relasi yang tepat, mengaktifkan RLS yang aman,
-- serta langsung menyisipkan data mockup siap pakai untuk seluruh modul menu.
-- =========================================================================

-- -------------------------------------------------------------
-- BAGIAN A: PEMBERSIHAN DATA & SKEMA LAMA (RESET TOTAL)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS sop_tasks CASCADE;
DROP TABLE IF EXISTS sops CASCADE;
DROP TABLE IF EXISTS day_menus CASCADE;
DROP TABLE IF EXISTS sisa_stok CASCADE;
DROP TABLE IF EXISTS order_requests CASCADE;
DROP TABLE IF EXISTS volunteer_complaints CASCADE;

-- -------------------------------------------------------------
-- BAGIAN B: PEMBUATAN TABEL BARU
-- -------------------------------------------------------------

-- 1. Membuat tabel day_menus (Perencanaan Menu Harian Gizi)
CREATE TABLE day_menus (
  date TEXT PRIMARY KEY,
  menu_list TEXT[] NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Membuat tabel sops (Dokumen SOP Harian Digital Divisi)
CREATE TABLE sops (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  division TEXT NOT NULL,
  creator_role TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  is_checked_all BOOLEAN DEFAULT false,
  signer_supervisor TEXT,
  signature_supervisor_url TEXT,
  signed_supervisor_at TEXT,
  signer_coordinator TEXT,
  signature_coordinator_url TEXT,
  signed_coordinator_at TEXT,
  status TEXT DEFAULT 'aktif' CHECK (status IN ('aktif', 'selesai')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Membuat tabel sop_tasks (Checklist Item untuk setiap Dokumen SOP)
CREATE TABLE sop_tasks (
  id TEXT PRIMARY KEY,
  sop_id TEXT NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  category TEXT NOT NULL CHECK (category IN ('persiapan', 'aktif', 'penutup')),
  sort_order INTEGER NOT NULL
);

-- 4. Membuat tabel sisa_stok (Stock Opname Gudang - Sisa Stok)
CREATE TABLE sisa_stok (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity TEXT NOT NULL,
  condition TEXT NOT NULL,
  action_plan TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Membuat tabel order_requests (Pengajuan Order Alat & Operasional)
CREATE TABLE order_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  qty TEXT NOT NULL,
  reason TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('alat', 'operasional')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'disetujui', 'ditolak')),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Membuat tabel volunteer_complaints (Log Keluhan Relawan / Asrama)
CREATE TABLE volunteer_complaints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  complaint_text TEXT NOT NULL,
  action_taken TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'selesai')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Membuat tabel absensi_logs (Daftar Presensi Harian Relawan)
CREATE TABLE IF NOT EXISTS absensi_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  check_in_time TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Membuat tabel absensi_signoffs (Otorisasi Absensi Harian)
CREATE TABLE IF NOT EXISTS absensi_signoffs (
  date TEXT PRIMARY KEY,
  signer_ketua TEXT,
  signature_ketua_url TEXT,
  signed_ketua_at TEXT,
  signer_aslap TEXT,
  signature_aslap_url TEXT,
  signed_aslap_at TEXT,
  status TEXT DEFAULT 'Draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS absensi_signoff (
  date TEXT PRIMARY KEY,
  signer_ketua TEXT,
  signature_ketua_url TEXT,
  signed_ketua_at TEXT,
  signer_aslap TEXT,
  signature_aslap_url TEXT,
  signed_aslap_at TEXT,
  status TEXT DEFAULT 'Draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------
-- BAGIAN C: PENGAKTIFAN ROW LEVEL SECURITY (RLS) & AKSES SPESIFIK ROLE
-- -------------------------------------------------------------

-- Aktifkan RLS pada seluruh tabel operasional
ALTER TABLE day_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sisa_stok ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_complaints ENABLE ROW LEVEL SECURITY;

-- Fungsi Pembantu 1: Mendapatkan Email Akun Pengguna Supabase Aktif
CREATE OR REPLACE FUNCTION current_user_email()
RETURNS TEXT AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    'guest@sppg.com' -- Fallback jika dijalankan di lokal/tanpa JWT
  );
$$ LANGUAGE sql STABLE;

-- Fungsi Pembantu 2: Mendapatkan Peran (Role) Berdasarkan Alamat Email Pengguna
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := LOWER(TRIM(current_user_email());
  
  -- 1. Aslap, Ketua SPPG (ketua@sppg.com), dan Admin Utama mendapatkan akses penuh (Admin/Aslap)
  IF v_email IN ('maghfurmunif@gmail.com', 'aslap@sppg.com', 'ketua@sppg.com') THEN
    RETURN 'admin_aslap';
  -- 2. Chef / Juru Masak
  ELSIF v_email IN ('chef@sppg.com') OR v_email LIKE 'chef%' THEN
    RETURN 'chef';
  -- 3. Ahli Gizi
  ELSIF v_email IN ('gizi@sppg.com') OR v_email LIKE 'gizi%' THEN
    RETURN 'ahli_gizi';
  -- 4. Akuntan
  ELSIF v_email IN ('akuntan@sppg.com') OR v_email LIKE 'akuntan%' THEN
    RETURN 'akuntan';
  -- 5. Koordinator/Relawan lapangan umum
  ELSE
    RETURN 'relawan_koordinator';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Kebijakan RLS Tabel 1: day_menus (Perencanaan Menu Harian Gizi)
CREATE POLICY "day_menus_select_policy" ON day_menus FOR SELECT USING (true);
CREATE POLICY "day_menus_modify_policy" ON day_menus FOR ALL 
  USING (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan'))
  WITH CHECK (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan'));

-- Kebijakan RLS Tabel 2 & 3: sops dan sop_tasks (SOP Harian Digital)
CREATE POLICY "sops_all_access_policy" ON sops FOR ALL
  USING (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan', 'relawan_koordinator'))
  WITH CHECK (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan', 'relawan_koordinator'));

CREATE POLICY "sop_tasks_all_access_policy" ON sop_tasks FOR ALL
  USING (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan', 'relawan_koordinator'))
  WITH CHECK (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan', 'relawan_koordinator'));

-- Kebijakan RLS Tabel 4: sisa_stok (Stock Opname Gudang)
CREATE POLICY "sisa_stok_all_access_policy" ON sisa_stok FOR ALL
  USING (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan'))
  WITH CHECK (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan'));

-- Kebijakan RLS Tabel 5: order_requests (Pengajuan Order Alat & Operasional)
CREATE POLICY "order_requests_policy" ON order_requests FOR ALL
  USING (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan', 'relawan_koordinator'))
  WITH CHECK (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan', 'relawan_koordinator'));

-- Kebijakan RLS Tabel 6: volunteer_complaints (Keluhan Asrama / Relawan)
CREATE POLICY "volunteer_complaints_policy" ON volunteer_complaints FOR ALL
  USING (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan', 'relawan_koordinator'))
  WITH CHECK (current_user_role() IN ('admin_aslap', 'chef', 'ahli_gizi', 'akuntan', 'relawan_koordinator'));

-- -------------------------------------------------------------
-- BAGIAN D: PENYISIPAN DATA MOCKUP AWAL (SEED DATA)
-- -------------------------------------------------------------

-- 1. Menyisipkan data untuk day_menus (Perencanaan Menu Gizi Harian)
INSERT INTO day_menus (date, menu_list, created_by) VALUES
('2026-06-15', ARRAY['Nasi Putih', 'Ayam Geprek Sambal Korek', 'Tumis Kangkung Belacan', 'Kerupuk Udang', 'Pisang Ambon'], 'Ahli Gizi'),
('2026-06-16', ARRAY['Nasi Putih', 'Krawu Ayam Bungah', 'Tempe Goreng Ketumbar', 'Kupasan Timun Segar', 'Sambal Serundeng Kelapa', 'Semangka Merah'], 'Ahli Gizi'),
('2026-06-17', ARRAY['Nasi Putih', 'Soto Madura Daging Sapi', 'Perkedel Kentang', 'Sambal Jeruk Nipis', 'Emping Melinjo', 'Melon Segar'], 'Ahli Gizi'),
('2026-06-18', ARRAY['Nasi Liwet Sunda', 'Tongkol Suwir Cabe Hijau', 'Tahu Bacem Gurih', 'Lalapan Daun Kemangi', 'Kerupuk Putih', 'Pisang Mas'], 'Ahli Gizi'),
('2026-06-19', ARRAY['Nasi Kuning Aromatik', 'Ayam Goreng Lengkuas', 'Kering Tempe Kacang', 'Telur Dadar Iris', 'Sambal Bajak', 'Jeruk Manis'], 'Ahli Gizi'),
('2026-06-20', ARRAY['Nasi Kebuli', 'Kari Kambing Spesial', 'Acar Nanas Timun', 'Kerupuk Gendar', 'Apel Malang Segar'], 'Ahli Gizi'),
('2026-06-21', ARRAY['Nasi Merah Sehat', 'Kakap Bakar Kecap', 'Cah Jambal Roti', 'Lalap Terong Goreng', 'Sambal Terasi Ponpes', 'Pepaya'], 'Ahli Gizi');

-- 2. Menyisipkan data untuk sops (Dokumen SOP Harian)
INSERT INTO sops (id, date, division, creator_role, creator_name, is_checked_all, signer_supervisor, signature_supervisor_url, signed_supervisor_at, signer_coordinator, signature_coordinator_url, signed_coordinator_at, status) VALUES
('2026-06-15-Divisi Masak', '2026-06-15', 'Divisi Masak', 'chef', 'Chef Ahmad', true, 'Chef Ahmad', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><path d="M10,20 Q30,5 50,20 T90,20" fill="none" stroke="black" stroke-width="2"/></svg>', '15/06/2026, 08.00 WIB', 'Koordinator Masak', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><path d="M10,20 Q30,5 50,20 T90,20" fill="none" stroke="black" stroke-width="2"/></svg>', '15/06/2026, 08.30 WIB', 'selesai'),
('2026-06-15-Divisi Pemorsian', '2026-06-15', 'Divisi Pemorsian', 'ahli_gizi', 'Avianti Rahma Dianita', true, 'Avianti Rahma Dianita', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><path d="M10,20 Q30,5 50,20 T90,20" fill="none" stroke="black" stroke-width="2"/></svg>', '15/06/2026, 08.00 WIB', 'Koordinator Pemorsian', 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><path d="M10,20 Q30,5 50,20 T90,20" fill="none" stroke="black" stroke-width="2"/></svg>', '15/06/2026, 08.30 WIB', 'selesai'),
('2026-06-16-Divisi Masak', '2026-06-16', 'Divisi Masak', 'chef', 'Chef Ahmad', false, 'Chef Ahmad', '', null, 'Koordinator Masak', '', null, 'aktif'),
('2026-06-16-Divisi Pemorsian', '2026-06-16', 'Divisi Pemorsian', 'ahli_gizi', 'Avianti Rahma Dianita', false, 'Avianti Rahma Dianita', '', null, 'Koordinator Pemorsian', '', null, 'aktif');

-- 3. Menyisipkan data untuk sop_tasks (Butir SOP Checklist)
INSERT INTO sop_tasks (id, sop_id, text, completed, category, sort_order) VALUES
-- Senin - Divisi Masak
('2026-06-15-masak-t-1', '2026-06-15-Divisi Masak', 'Mencuci tangan dengan sanitizer dan memakai celemek serta masker masak bersih.', true, 'persiapan', 0),
('2026-06-15-masak-t-2', '2026-06-15-Divisi Masak', 'Menyiapkan bahan lauk gizi utama (Ayam Geprek) dan sayuran segar.', true, 'persiapan', 1),
('2026-06-15-masak-t-3', '2026-06-15-Divisi Masak', 'Menggoreng ayam dengan suhu merata 170°C sampai matang kecoklatan sempurna.', true, 'aktif', 2),
('2026-06-15-masak-t-4', '2026-06-15-Divisi Masak', 'Mematikan kompor gas elpiji dan merapikan meja kompor setelah selesai digunakan.', true, 'penutup', 3),

-- Senin - Divisi Pemorsian
('2026-06-15-pemorsian-t-1', '2026-06-15-Divisi Pemorsian', 'Membersihkan rel meja perakitan (assembly line) ompreng makan.', true, 'persiapan', 0),
('2026-06-15-pemorsian-t-2', '2026-06-15-Divisi Pemorsian', 'Memasukkan porsi nasi putih sesuai takaran gizi kalori (180 gram).', true, 'aktif', 1),
('2026-06-15-pemorsian-t-3', '2026-06-15-Divisi Pemorsian', 'Menumpuk tutup box ompreng secara rapat agar terhindar dari debu luar.', true, 'penutup', 2),

-- Selasa - Divisi Masak (Sebagian dicentang)
('2026-06-16-masak-t-1', '2026-06-16-Divisi Masak', 'Mencuci tangan dengan steril dan memasak nasi pulen menggunakan mesin boiler uap.', true, 'persiapan', 0),
('2026-06-16-masak-t-2', '2026-06-16-Divisi Masak', 'Menyiapkan bumbu krawu khas Gresik dengan parutan kelapa serundeng sangrai.', true, 'persiapan', 1),
('2026-06-16-masak-t-3', '2026-06-16-Divisi Masak', 'Melakukan sterilisasi pisau pemotong dan talenan kayu dapur.', false, 'aktif', 2),
('2026-06-16-masak-t-4', '2026-06-16-Divisi Masak', 'Mengepel dan mengelap tumpahan kuah di area masak kompor utama.', false, 'penutup', 3),

-- Selasa - Divisi Pemorsian
('2026-06-16-pemorsian-t-1', '2026-06-16-Divisi Pemorsian', 'Memilah ompreng santri yang retak untuk dipisahkan dari perakitan.', true, 'persiapan', 0),
('2026-06-16-pemorsian-t-2', '2026-06-16-Divisi Pemorsian', 'Mengisi lauk Ayam Krawu, Tempe Goreng, dan Semangka Merah sesuai porsi rata.', false, 'aktif', 1),
('2026-06-16-pemorsian-t-3', '2026-06-16-Divisi Pemorsian', 'Melaporkan rekapitulasi jumlah box ompreng terisi ke papan logistik.', false, 'penutup', 2);

-- 4. Menyisipkan data untuk sisa_stok (Stock Opname Gudang)
INSERT INTO sisa_stok (item_name, category, quantity, condition, action_plan, created_by) VALUES
('Ayam Frozen', 'Chiller / Freezer', '45 Kg', 'Sangat Baik', 'Olah untuk lauk geprek hari Rabu', 'Chef Ahmad'),
('Beras Premium Sentra Ramos', 'Gudang Kering', '150 Kg', 'Sangat Baik', 'Simpan di pallet kayu, amankan dari kelembaban', 'Admin Logistik'),
('Sawi Hijau Organik', 'Kebun Gizi', '12 Kg', 'Agak Layu', 'Segera masak untuk tumis sayur sore ini', 'Chef Ahmad'),
('Minyak Goreng Bimoli Jerigen', 'Gudang Kering', '4 Pcs', 'Sangat Baik', 'Gunakan untuk menggoreng tempe beku esok hari', 'Admin Logistik'),
('Tempe Kedelai Super', 'Gudang Kering', '25 Papan', 'Sangat Baik', 'Olah habis untuk menu tempe penyet esok pagi', 'Ahli Gizi');

-- 5. Menyisipkan data untuk order_requests (Pengajuan Order Alat & Operasional)
INSERT INTO order_requests (item_name, qty, reason, category, status, notes, created_by) VALUES
('Mixer Adonan Roti Besar', '1 Unit', 'Mixer lama sering mati mendadak di tengah proses pengadukan roti gizi santri.', 'alat', 'pending', null, 'Chef Ahmad'),
('Sabun Pencuci Piring Jerigen 5L', '5 Pcs', 'Untuk sterilisasi ompreng dan peralatan masak di area cuci piring sanitasi.', 'operasional', 'disetujui', 'Disetujui. Silakan koordinasi dengan bagian keuangan ponpes.', 'Ahli Gizi'),
('Pisau Stainless Chef Pro', '3 Pcs', 'Pisau lama sudah tumpul dan berkarat ringan, memperlambat persiapan sayuran harian.', 'alat', 'pending', null, 'Chef Ahmad');

-- 6. Menyisipkan data untuk volunteer_complaints (Log Keluhan Relawan / Asrama)
INSERT INTO volunteer_complaints (source, category, complaint_text, action_taken, status, created_by) VALUES
('Asrama Santri Putra', 'Kebersihan', 'Tempat sampah di selasar depan gerbang utama asrama overload, menimbulkan bau kurang sedap.', null, 'pending', 'Relawan Ahmad'),
('Asrama Santri Putri', 'Kerusakan Alat', 'Saringan pembuangan air di wastafel cuci ompreng kotor tersumbat oleh kerak lemak sisa nasi.', 'Sudah disiram air panas mendidih bercampur soda api oleh relawan piket asrama putri.', 'selesai', 'Fatimah'),
('Dapur Utama SPPG', 'Keterlambatan', 'Pengiriman gas elpiji 50kg terlambat sekitar 45 menit dari jadwal pagi awal persiapan masak.', 'Menghubungi agen gas terdekat untuk segera memberikan armada cadangan tercepat.', 'selesai', 'Relawan Dian');

-- =========================================================================
-- INFO QUERY OPERASIONAL & PENGAWASAN (Gunakan untuk debugging di SQL Editor):
-- =========================================================================
-- A. Ambil Menu Gizi Berdasarkan Urutan Tanggal:
--    SELECT * FROM day_menus ORDER BY date ASC;
--
-- B. Ambil Dokumen SOP beserta Butir Tugasnya:
--    SELECT s.date, s.division, t.text, t.completed, t.category 
--    FROM sops s 
--    JOIN sop_tasks t ON s.id = t.sop_id 
--    ORDER BY s.date, s.division, t.sort_order;
--
-- C. Ambil Pengajuan Order Yang Masih Pending:
--    SELECT * FROM order_requests WHERE status = 'pending';
-- =========================================================================`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(postgres_sql_scripts);

    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const currentYear = 2026;

  // Render correct mockup based on index (1-based to match the user's 1-14 numbering)
  switch (moduleIndex) {
    case 1: // Stok Bahan Sisa
      return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
                  <Package className="h-6 w-6 text-emerald-700" />
                  Stok Bahan Sisa (Dapur Basah & Kering)
                </h2>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                  isSupabaseConfigured ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {isSupabaseConfigured ? '🟢 Cloud Sync Aktif' : '🟡 Mode Lokal (Tanpa Cloud)'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">Pencatatan sisa bahan setelah proses pemorsian untuk efisiensi limbah (zero waste).</p>
            </div>
            <button 
              onClick={() => setIsAddingSisa(!isAddingSisa)}
              className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
            >
              <Plus className="h-4 w-4" /> {isAddingSisa ? 'Tutup Form' : 'Pencatatan Baru'}
            </button>
          </div>

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" /> {successMsg}
            </div>
          )}

          {isAddingSisa && (
            <form onSubmit={handleAddSisaStok} className="p-4 border border-emerald-100 bg-emerald-50/10 rounded-xl space-y-4">
              <h3 className="font-bold text-xs text-emerald-900 uppercase tracking-widest flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Masukkan Sisa Stok Baru
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Sisa Bahan</label>
                  <input 
                    type="text" 
                    required
                    value={formData.itemName || ''}
                    onChange={e => setFormData({...formData, itemName: e.target.value})}
                    placeholder="Contoh: Karkas Ayam Broiler"
                    className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Kategori</label>
                  <select 
                    value={sisaCategory} 
                    onChange={e => setSisaCategory(e.target.value)}
                    className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs outline-hidden"
                  >
                    <option value="Protein Basah">Protein Basah (Ayam/Ikan/Daging)</option>
                    <option value="Bumbu Dapur">Bumbu Dapur (Cabai/Bawang/Kunyit)</option>
                    <option value="Sayur Segar">Sayur Segar (Kangkung/Timun/Sawi)</option>
                    <option value="Lauk Nabati">Lauk Nabati (Tempe/Tahu)</option>
                    <option value="Beras & Sembako">Beras & Sembako (Minyak/Beras)</option>
                    <option value="Consumables">Consumables (Gas/Sabun)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Jumlah Sisa (Qty)</label>
                  <input 
                    type="text" 
                    required
                    value={formData.qty || ''}
                    onChange={e => setFormData({...formData, qty: e.target.value})}
                    placeholder="Contoh: 4.5 Kg / 10 Batang"
                    className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Kondisi / Kelayakan</label>
                  <select 
                    value={sisaCond} 
                    onChange={e => setSisaCond(e.target.value)}
                    className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs outline-hidden"
                  >
                    <option value="Sangat Segar (Chiller)">Sangat Segar (Chiller)</option>
                    <option value="Kering, Bagus">Kering, Bagus</option>
                    <option value="Segar">Segar</option>
                    <option value="Sangat Segar">Sangat Segar</option>
                    <option value="Sedikit Layu">Sedikit Layu</option>
                    <option value="Baik keadaannya">Baik</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Rencana Action (Tindakan)</label>
                  <input 
                    type="text" 
                    required
                    value={formData.action || ''}
                    onChange={e => setFormData({...formData, action: e.target.value})}
                    placeholder="Contoh: Masuk Menu Masak Esok Hari / Goreng Sore Ini"
                    className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-700 outline-hidden"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddingSisa(false)}
                  className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-lg text-xs font-semibold hover:bg-neutral-50"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="bg-emerald-800 hover:bg-emerald-900 text-white px-5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input 
                type="text" 
                placeholder="Cari sisa bahan (contoh: ayam, bawang, timun)..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg text-sm bg-neutral-50/50"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-neutral-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/70 text-[10px] text-neutral-500 font-extrabold uppercase tracking-wider select-none">
                  <th className="py-3 px-4">Nama Bahan</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Jumlah Sisa</th>
                  <th className="py-3 px-4">Kondisi / Kelayakan</th>
                  <th className="py-3 px-4">Rencana Action</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {stokSisa.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-neutral-400 font-medium">
                      {isLoadingData ? 'Memuat data dari database...' : 'Belum ada sisa log bahan hari ini.'}
                    </td>
                  </tr>
                ) : (
                  stokSisa.filter(it => it.item_name.toLowerCase().includes(searchTerm.toLowerCase())).map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-neutral-50/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-neutral-900">{item.item_name}</td>
                      <td className="py-3 px-4 text-xs font-mono text-neutral-500">{item.category}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">{item.quantity}</td>
                      <td className="py-3 px-4">
                        <span className="bg-emerald-50 text-emerald-800 text-[10px] uppercase tracking-wide font-black px-2 py-0.5 rounded-full border border-emerald-100">
                          {item.condition}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-serif text-neutral-600">{item.action_plan}</td>
                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={() => handleDeleteSisaStok(item.id)}
                          className="hover:text-red-700 text-neutral-400 p-1.5 rounded-lg hover:bg-red-50 transition-all inline-flex items-center"
                          title="Hapus sisa stok"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 2: // Inventaris alat
      return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
          <div>
            <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
              <Wrench className="h-6 w-6 text-emerald-700" />
              Inventaris Peralatan Dapur SPPG
            </h2>
            <p className="text-xs text-neutral-500">Daftar alat aset dapur berat dan ringan beserta status kepemilikan dan masa kelayakan.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
              <span className="text-xs text-neutral-500 block font-medium">Total Aset Alat</span>
              <span className="text-2xl font-bold text-emerald-800">142 Unit</span>
            </div>
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center">
              <span className="text-xs text-neutral-500 block font-medium">Kondisi Baik</span>
              <span className="text-2xl font-bold text-blue-800">136 Unit</span>
            </div>
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-center">
              <span className="text-xs text-neutral-500 block font-medium">Butuh Servis</span>
              <span className="text-2xl font-bold text-amber-800">4 Unit</span>
            </div>
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
              <span className="text-xs text-neutral-500 block font-medium">Rusak Total</span>
              <span className="text-2xl font-bold text-red-800">2 Unit</span>
            </div>
          </div>

          <div className="border border-neutral-100 rounded-xl overflow-hidden text-sm">
            {[
              { name: 'Kuali Raksasa Diameter 1.2 Meter', qty: '4 Unit', status: 'Baik', label: 'Heavy Duty cooking' },
              { name: 'Blender Komersial Heavy Duty 3HP', qty: '2 Unit', status: 'Butuh Servis', label: 'Bumbu Halus stocking' },
              { name: 'Meja Assembly Lines Premium Stainless 304', qty: '3 Unit', status: 'Baik', label: 'Pemorsian' },
              { name: 'Lemari Pendingin Industri (Cold Room Freezer)', qty: '1 Unit', status: 'Baik', label: 'Penyimpanan Dapur' },
              { name: 'Baskom Stainless Ukuran Jumbo', qty: '18 Unit', status: 'Baik', label: 'Cuci & Rendam' },
              { name: 'Pisau Rajang Daging Victorinox', qty: '8 Unit', status: 'Rusak Total', label: 'Stocking' }
            ].map((item, id) => (
              <div key={id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-b last:border-b-0 border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                <div>
                  <h4 className="font-semibold text-neutral-900">{item.name}</h4>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-widest">{item.label}</span>
                </div>
                <div className="flex items-center gap-4 mt-2 sm:mt-0 font-mono">
                  <span className="text-sm text-neutral-600 font-bold">Qty: {item.qty}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-extrabold ${
                    item.status === 'Baik' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                    item.status === 'Butuh Servis' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                    'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 3: // Inventaris Operasional
      return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
          <div>
            <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-emerald-700" />
              Inventaris Barang Habis Pakai / Operasional
            </h2>
            <p className="text-xs text-neutral-500 font-sans">Aset consumables seperti tabung LPG, sabun cuci piring sanitasi, masker, sarung tangan, dsb.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Bahan Bakar & Energi', list: [{ n: 'Tabung Gas Elpiji 50 Kg', q: '6 tabung', stat: 'Aman' }, { n: 'Gas Portable Stocking', q: '12 Kaleng', stat: 'Kurang' }] },
              { title: 'Sanitasi & Kebersihan', list: [{ n: 'Sabun Cuci Piring Ekonomis Jerigen', q: '8 Jerigen', stat: 'Aman' }, { n: 'Karbol Cair Wangi Pinus', q: '5 Botol', stat: 'Aman' }] },
              { title: 'Safety APD & Packaging', list: [{ n: 'Masker Higienis 3-Fly', q: '4 Box', stat: 'Kritis' }, { n: 'Sarung Tangan Nitrile steril', q: '3 Box', stat: 'Kritis' }] }
            ].map((section, idx) => (
              <div key={idx} className="border border-neutral-100 p-5 rounded-xl bg-neutral-50/50 space-y-4">
                <h3 className="font-bold text-sm text-emerald-900 border-b pb-2 border-neutral-200/55">{section.title}</h3>
                <div className="space-y-3">
                  {section.list.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-700 font-medium">{item.n}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-neutral-100 px-2 py-0.5 rounded-sm">{item.q}</span>
                        <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${
                          item.stat === 'Aman' ? 'bg-emerald-100 text-emerald-800' :
                          item.stat === 'Kurang' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800 animate-pulse'
                        }`}>{item.stat}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 4: // Order Alat
    case 5: // Order Operasional
      const isAlat = moduleIndex === 4;
      const filteredRequests = orderRequests.filter(req => req.category === (isAlat ? 'alat' : 'operasional'));
      
      return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
                  <ShoppingCart className="h-6 w-6 text-emerald-700" />
                  Pemesanan & Requisition {isAlat ? 'Peralatan Baru' : 'Kebutuhan Operasional'}
                </h2>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                  isSupabaseConfigured ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {isSupabaseConfigured ? '🟢 Cloud Sync Aktif' : '🟡 Mode Lokal (Tanpa Cloud)'}
                </span>
                {isAdmin && (
                  <span className="bg-purple-100 text-purple-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-purple-200 animate-pulse">
                    🔑 Akun Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {isAlat 
                  ? 'Ajukan pengadaan peralatan masak baru atau pengganti komponen berat/ringan.' 
                  : 'Ajukan pengadaan bahan bakar gas LPG, sabun cuci piring jumbo, desinfektan, dsb.'}
              </p>
            </div>
          </div>

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" /> {successMsg}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Form Pengajuan / Submission (Hanya Tampil / Aktif jika bukan Admin, atau Admin juga bisa buat pengujian) */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-neutral-50/50 border border-neutral-100 p-4 rounded-xl space-y-4">
                <h3 className="font-bold text-xs text-neutral-700 uppercase tracking-widest flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-emerald-800" /> Buat Pengajuan Baru
                </h3>
                
                <form onSubmit={e => handleCreateOrderRequest(e, isAlat)} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Nama Barang</label>
                    <input 
                      type="text" 
                      required
                      value={formData.itemName || ''}
                      onChange={e => setFormData({...formData, itemName: e.target.value})}
                      placeholder={isAlat ? 'Contoh: Mixer Adonan Kue' : 'Contoh: Sabun Jerigen Premium'}
                      className="w-full text-xs border border-neutral-200 rounded-lg px-3 py-2 bg-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Jumlah (Qty)</label>
                    <input 
                      type="text" 
                      required
                      value={formData.qty || ''}
                      onChange={e => setFormData({...formData, qty: e.target.value})}
                      placeholder="Contoh: 1 Unit / 3 Pcs" 
                      className="w-full text-xs border border-neutral-200 rounded-lg px-3 py-2 bg-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Alasan Pengadaan & Spek</label>
                    <textarea 
                      rows={3} 
                      required
                      value={formData.reason || ''}
                      onChange={e => setFormData({...formData, reason: e.target.value})}
                      placeholder="Tulis alasan kebutuhan yang mendesak..."
                      className="w-full text-xs border border-neutral-200 rounded-lg px-3 py-2 bg-white"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-2 px-4 rounded-lg text-xs w-full transition-colors uppercase tracking-wider"
                  >
                    Kirim Form Pengajuan
                  </button>
                </form>
              </div>
            </div>

            {/* List Pengajuan (Menampilkan data order_requests secara relasional dan real-time) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <h3 className="font-bold text-xs text-neutral-700 uppercase tracking-widest flex items-center gap-1.5">
                  <ClipboardCheck className="h-4 w-4 text-emerald-800" /> 
                  Daftar Pengajuan Masuk {isAlat ? '(Peralatan)' : '(Operasional)'}
                </h3>
                <span className="text-[10px] bg-neutral-100 text-neutral-600 font-mono px-2 py-0.5 rounded-full">
                  Total: {filteredRequests.length}
                </span>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="bg-neutral-50/50 border border-neutral-100 border-dashed rounded-xl p-8 text-center text-xs text-neutral-400 font-medium">
                  {isLoadingData ? 'Sedang memuat data dari database...' : 'Belum ada data pengadaan untuk kategori ini.'}
                </div>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {filteredRequests.map((req, idx) => (
                    <div key={req.id || idx} className="p-4 border border-neutral-100 rounded-xl bg-white hover:bg-neutral-50/20 transition-all shadow-2xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-neutral-900 text-sm">{req.item_name}</h4>
                            <span className="bg-neutral-100 text-neutral-700 font-mono font-bold text-[10px] px-2 py-0.5 rounded-lg border border-neutral-200">
                              Qty: {req.qty}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-400 mt-0.5">
                            Diajukan oleh: <strong className="text-neutral-600 font-mono">{req.created_by}</strong> 
                            {req.created_at && ` • Pada: ${new Date(req.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', hour:'2-digit', minute:'2-digit'})}`}
                          </p>
                        </div>

                        {/* Status badge */}
                        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-extrabold border ${
                          req.status === 'disetujui' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          req.status === 'ditolak' ? 'bg-red-50 text-red-800 border-red-200' :
                          req.status === 'ditolak_admin_utama' ? 'bg-rose-50 text-rose-850 border-rose-200 font-extrabold' :
                          'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                        }`}>
                          {req.status === 'pending' ? '⌛ Pending' : 
                           req.status === 'disetujui' ? '✓ Disetujui' : 
                           req.status === 'ditolak_admin_utama' ? '✗ Ditolak Admin Utama' : '✗ Ditolak'}
                        </span>
                      </div>

                      <div className="bg-neutral-50/60 p-2.5 rounded-lg text-xs text-neutral-600 font-serif leading-relaxed">
                        <span className="font-sans font-bold text-[10px] text-neutral-400 block uppercase mb-0.5 select-none">Justifikasi Alasan:</span>
                        {req.reason}
                      </div>

                      {/* Admin Note if already approved/rejected */}
                      {req.notes && (
                        <div className="bg-blue-50/50 border border-blue-100 p-2.5 rounded-lg text-xs text-blue-900">
                          <span className="font-sans font-bold text-[10px] text-blue-500 block uppercase mb-0.5">Catatan Administrator:</span>
                          {req.notes}
                        </div>
                      )}

                      {/* Admin panel controls (Only visible for maghfurmunif@gmail.com and pending state) */}
                      {isAdmin && req.status === 'pending' && (
                        <div className="border-t border-neutral-100 pt-3 flex flex-col gap-2">
                          <div className="flex gap-2 items-center flex-wrap">
                            <input 
                              type="text"
                              value={adminNoteInput[req.id] || ''}
                              onChange={e => setAdminNoteInput({ ...adminNoteInput, [req.id]: e.target.value })}
                              placeholder="Masukkan catatan keputusan admin (cth: Di-order ke supplier, Dana disetujui)"
                              className="text-xs border border-neutral-200 rounded-lg px-3 py-1.5 flex-1 bg-white focus:outline-emerald-700 min-w-[200px]"
                            />
                            <button
                              onClick={() => handleUpdateOrderStatus(req.id, 'disetujui')}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[10px] uppercase px-3 py-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" /> Setujui
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(req.id, 'ditolak')}
                              className="bg-red-700 hover:bg-red-800 text-white font-extrabold text-[10px] uppercase px-3 py-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" /> Tolak
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(req.id, 'ditolak_admin_utama')}
                              className="bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-[10px] uppercase px-3 py-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="Tolak sebagai Admin Utama"
                            >
                              <X className="h-3.5 w-3.5" /> Tolak (Admin Utama)
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      );

    case 6: { // Kedatangan Barang
      return (
        <IncomingGoodsView
          selectedDate={selectedDate || '2026-06-16'}
          isInitialFetchDone={isInitialFetchDone}
          kedatanganMap={kedatanganMap}
          setKedatanganMap={setKedatanganMap}
          savedReports={savedReports}
          addSavedReport={addSavedReport}
          triggerSuccessMsg={triggerSuccessMsg}
          successMsg={successMsg}
          isSupabaseConfigured={isSupabaseConfigured}
        />
      );
    }

    case 7: // Galeri Kedatangan Barang
    case 8: // Dokumentasi
      const isGaleri = moduleIndex === 7;
      return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
                <Camera className="h-6 w-6 text-emerald-700" />
                {isGaleri ? 'Galeri Kedatangan & Timbangan Barang' : 'Dokumentasi Dapur & Distribusi Santri'}
              </h2>
              <p className="text-xs text-neutral-500">Unggahan visual dan foto-foto sebagai bukti otentik pengawasan dapur pondok pesantren.</p>
            </div>
            <button
              onClick={() => triggerSuccessMsg("Fungsi upload kamera diaktifkan! Silakan pilih foto.")}
              className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-4 w-4" /> Ambil Foto / Upload
            </button>
          </div>

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> {successMsg}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {isGaleri ? (
              [
                { t: 'Timbangan Ayam Karkas 70kg', d: 'Supplier Bpk Dul', img: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=150&auto=format&fit=crop&q=60' },
                { t: 'Bawang Merah & Putih Bersih', d: 'Kondisi kering & mulus', img: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=150&auto=format&fit=crop&q=60' },
                { t: 'Sayur Kangkung Segar', d: 'Seikat 35 ikat', img: 'https://images.unsplash.com/photo-1587593817658-af82697ed3b2?w=150&auto=format&fit=crop&q=60' },
                { t: 'Pemeriksaan Telur Asin', d: 'Utuh tidak retak', img: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=150&auto=format&fit=crop&q=60' },
              ].map((ph, idx) => (
                <div key={idx} className="border border-neutral-100 rounded-xl overflow-hidden shadow-xs bg-neutral-50 group hover:border-emerald-500 transition-all">
                  <div className="relative aspect-square bg-neutral-200 overflow-hidden">
                    <img referrerPolicy="no-referrer" src={ph.img} alt={ph.t} className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-emerald-700/90 text-white text-[8px] font-mono">OK</span>
                  </div>
                  <div className="p-2 space-y-0.5">
                    <h5 className="font-bold text-[11px] text-neutral-800 truncate">{ph.t}</h5>
                    <p className="text-[9px] text-neutral-400">{ph.d}</p>
                  </div>
                </div>
              ))
            ) : (
              [
                { t: 'Penyajian Rel Pemorsian', d: 'Selesai 450 pack', img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=150&auto=format&fit=crop&q=60' },
                { t: 'Pencucian Wadah Stainless', d: 'Kebersihan alat paking', img: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=150&auto=format&fit=crop&q=60' },
                { t: 'Distribusi Food Box Asrama', d: 'Diterima Uztadz Asrama', img: 'https://images.unsplash.com/photo-1594212699903-ec8a3cee50f6?w=150&auto=format&fit=crop&q=60' },
                { t: 'Kebersihan Lantai Dapur', d: 'Mop Karbol Pasca Masak', img: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=150&auto=format&fit=crop&q=60' },
              ].map((ph, idx) => (
                <div key={idx} className="border border-neutral-100 rounded-xl overflow-hidden shadow-xs bg-neutral-50 group hover:border-emerald-500 transition-all">
                  <div className="relative aspect-square bg-neutral-200 overflow-hidden">
                    <img referrerPolicy="no-referrer" src={ph.img} alt={ph.t} className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-emerald-700/90 text-white text-[8px] font-mono">DOKUMENTASI</span>
                  </div>
                  <div className="p-2 space-y-0.5">
                    <h5 className="font-bold text-[11px] text-neutral-800 truncate">{ph.t}</h5>
                    <p className="text-[9px] text-neutral-400">{ph.d}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );

    case 9: { // Absensi
      return (
        <AbsensiView
          selectedDate={selectedDate || '2026-06-16'}
          isInitialFetchDone={isInitialFetchDone}
        />
      );
    }

    case 10: // Menu Harian Gizi Ponpes
      const handleAddLocalItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!localItemInput.trim()) return;
        setLocalSchedItems([...localSchedItems, localItemInput.trim()]);
        setLocalItemInput('');
      };

      const handlePresetLocalSched = (presetItems: string[]) => {
        setLocalSchedItems([...presetItems]);
      };

      const handleLocalSubmitSchedule = () => {
        if (!localSchedDate) {
          alert('Silakan pilih tanggal terlebih dahulu!');
          return;
        }
        if (localSchedItems.length === 0) {
          alert('Masukkan minimal 1 hidangan makanan gizi untuk dijadwalkan!');
          return;
        }
        if (!onSaveMenu || !onGenerateSOPs) {
          alert('Fasilitas penyimpanan data sandboxed!');
          return;
        }

        setIsSavingSched(true);
        setTimeout(() => {
          onSaveMenu(localSchedDate, localSchedItems);
          onGenerateSOPs(localSchedDate, localSchedItems);
          setIsSavingSched(false);
          triggerSuccessMsg(`Jadwal Menu & SOP baru untuk tanggal ${localSchedDate} berhasil diterbitkan & diunggah ke database!`);
          setLocalSchedItems([]);
        }, 1000);
      };

      const getIndoDayName = (dateStr: string) => {
        try {
          const parts = dateStr.split('-');
          const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
          return `${days[date.getDay()]}, ${parts[2]} ${months[date.getMonth()]}`;
        } catch (e) {
          return dateStr;
        }
      };

      return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
                <Calendar className="h-6 w-6 text-emerald-700" />
                Menu Harian Gizi Ponpes SPPG (Data Real-Time Cloud)
              </h2>
              <p className="text-xs text-neutral-500">Jadwal menu gizi santri yang disinkronkan langsung dengan sops dan database Supabase.</p>
            </div>
            
            <span className="bg-emerald-50 text-[10px] text-emerald-800 uppercase tracking-widest font-extrabold px-3 py-1 rounded font-mono">
              ROLE: {currentUserRole}
            </span>
          </div>

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> {successMsg}
            </div>
          )}

          {/* scheduler form for admins */}
          {currentUserRole === UserRole.ADMIN && (
            <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200/50 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                <h3 className="font-bold text-neutral-800 text-xs uppercase tracking-wider font-mono text-emerald-900">
                  📅 Tambah & Jadwalkan Menu Hari Selanjutnya (Tanggal Esok+)
                </h3>
                <span className="text-[9px] bg-neutral-200 text-neutral-600 font-bold px-1.5 py-0.5 rounded">ADMIN PANEL</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
                {/* select date & presets */}
                <div className="md:col-span-5 space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1">Pilih Tanggal Selanjutnya</label>
                    <input 
                      type="date"
                      value={localSchedDate}
                      onChange={e => setLocalSchedDate(e.target.value)}
                      className="w-full bg-white border border-neutral-200 p-2 rounded-lg font-mono font-bold text-neutral-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Pilih Paket Templat:</span>
                    <div className="flex flex-wrap gap-1">
                      {PRESET_SUGGESTIONS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handlePresetLocalSched(preset.items)}
                          className="bg-white hover:bg-emerald-800 hover:text-white border border-neutral-200 text-[10px] py-1 px-2.5 rounded transition-all truncate"
                        >
                          {preset.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* list editor */}
                <div className="md:col-span-7 space-y-3 border-l border-neutral-200/50 pl-0 md:pl-5">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1">Draf Items Makanan</label>
                    <form onSubmit={handleAddLocalItem} className="flex gap-2">
                      <input 
                        type="text"
                        value={localItemInput}
                        onChange={e => setLocalItemInput(e.target.value)}
                        placeholder="Contoh: Tempe Goreng Mendoan..."
                        className="flex-1 bg-white border border-neutral-200 px-3 py-1.5 rounded-lg text-xs"
                      />
                      <button type="submit" className="bg-neutral-800 text-white text-xs font-bold px-4 py-1.5 rounded-lg shrink-0">
                        Tambah
                      </button>
                    </form>
                  </div>

                  {localSchedItems.length === 0 ? (
                    <div className="p-6 border border-dashed border-neutral-200 rounded-xl bg-white text-center text-neutral-400 text-[11px]">
                      Belum ada draf. Ketuk templat paket menu di sebelah kiri atau ketik hidangan mandiri.
                    </div>
                  ) : (
                    <div className="bg-white border rounded-xl overflow-hidden divide-y divide-neutral-100 max-h-[120px] overflow-y-auto">
                      {localSchedItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 text-neutral-700 text-xs">
                          <span className="font-semibold flex items-center gap-1.5 text-neutral-800">
                            <span className="w-4 h-4 bg-neutral-100 rounded-full flex items-center justify-center font-bold text-[9px] text-neutral-500">{idx+1}</span>
                            {item}
                          </span>
                          <button
                            type="button"
                            onClick={() => setLocalSchedItems(localSchedItems.filter((_, i) => i !== idx))}
                            className="text-neutral-400 hover:text-red-500 font-bold px-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-right pt-2 border-t border-neutral-200/30">
                    <button
                      type="button"
                      onClick={handleLocalSubmitSchedule}
                      className="bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 font-bold font-mono text-white text-[10.5px] px-4 py-2 rounded-lg inline-flex items-center gap-1.5 tracking-wider transition-all"
                    >
                      {isSavingSched ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      PUBLIKASIKAN JADWAL MENU ({localSchedDate})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* grid listing of our real menus */}
          <div className="space-y-3">
            <h3 className="font-bold text-neutral-800 text-xs uppercase tracking-wider font-mono">
              📚 DAFTAR JADWAL MENU SAAT INI DI DATABASE ({allDayMenus.length} Hari Terbit)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              {[...allDayMenus]
                .sort((a,b) => a.date.localeCompare(b.date))
                .map((mn, idx) => (
                <div 
                  key={mn.date} 
                  className={`border p-4 rounded-xl shadow-xs flex flex-col justify-between bg-white border-neutral-200 hover:border-emerald-600 hover:shadow-xs transition-all relative`}
                >
                  {/* Delete Button for Admin */}
                  {currentUserRole === UserRole.ADMIN && onDeleteMenu && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteMenu(mn.date);
                      }}
                      className="absolute top-2.5 right-2.5 p-1 text-neutral-300 hover:text-red-600 rounded bg-neutral-50 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all text-[11px]"
                      title="Hapus menu gizi ini"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}

                  <div>
                    <span className="font-bold text-xs text-neutral-900 block mb-2 font-display pr-5">
                      {getIndoDayName(mn.date)}
                    </span>
                    <ul className="space-y-1 text-xs text-neutral-600">
                      {mn.menuList.map((food, i) => (
                        <li key={i} className="flex items-center gap-1.5 truncate">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="truncate text-[11.5px]">{food}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono">
                      620 Kcal
                    </span>
                    <button 
                      onClick={() => {
                        onSetMenu(mn.date, mn.menuList);
                        triggerSuccessMsg(`SOP untuk tanggal ${mn.date} diaktifkan dengan menu: ${mn.menuList.join(', ')}!`);
                      }}
                      className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-0.5 hover:underline"
                      title="Aktifkan menu dan tampilkan SOP harian"
                    >
                      Gunakan SOP <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 11: // Form Pemesanan
      return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
          <div>
            <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
              <FileText className="h-6 w-6 text-emerald-700" />
              Formulir Pemesanan Makanan Kegiatan Khusus Ponpes
            </h2>
            <p className="text-xs text-neutral-500">Pemesanan khusus untuk wali santri, rapat asatidzah, wisuda pondok pesantren, dan event tumpengan.</p>
          </div>

          <form onSubmit={e => {
            e.preventDefault();
            triggerSuccessMsg("Pemesanan catering khusus berhasil direkam. Masuk antrean dapur asatidz!");
            setFormData({});
          }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">Nama Pemesan / Lembaga</label>
              <input type="text" required placeholder="Contoh: Panitia Isro' Mi'raj Ponpes" className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-50/50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">Tanggal Kebutuhan</label>
              <input type="date" required className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-50/50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">Jumlah Porsi (Packs / Tampah)</label>
              <input type="text" required placeholder="Contoh: 120 Packs Box" className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-50/50" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">Jenis Hidangan / Catatan Alergi</label>
              <textarea rows={3} placeholder="Contoh: Nasi kuning tumpeng komplit, lauk ayam ingkung bakar tanpa kolesterol." className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-50/50" />
            </div>
            <div className="md:col-span-3 text-right">
              <button type="submit" className="bg-emerald-800 hover:bg-emerald-950 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-transform active:scale-98">
                Submit Pemesanan Catering
              </button>
            </div>
          </form>

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> {successMsg}
            </div>
          )}
        </div>
      );

    case 12: { // Stock Opname revamping
      return (
        <StockOpnameView
          selectedDate={selectedStockDate}
          isInitialFetchDone={isInitialFetchDone}
          stockMap={stockMap}
          setStockMap={setStockMap}
          kedatanganMap={kedatanganMap}
          savedReports={savedReports}
          addSavedReport={addSavedReport}
          triggerSuccessMsg={triggerSuccessMsg}
          successMsg={successMsg}
          isSupabaseConfigured={isSupabaseConfigured}
        />
      );
    }

    case 13: // Request Bahan dan Alat
      return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
          <div>
            <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-emerald-700" />
              Permintaan (Request) Bahan Spesifik atau Alat Tambahan
            </h2>
            <p className="text-xs text-neutral-500">Ajukan bahan diluar menu terjadwal (misal bumbu tambahan, santan mendadak, dsb.).</p>
          </div>

          <form onSubmit={e => {
            e.preventDefault();
            triggerSuccessMsg("Permintaan bahan mendesak berhasil diteruskan ke tim gudang logistik!");
            setFormData({});
          }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">Nama Bahan/Alat Tambahan</label>
                <input type="text" required placeholder="Contoh: Kemiri Kupas 3Kg" className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-50/50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">Sifat Urgensi</label>
                <select className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-50/50">
                  <option>Biasa (Dipersiapkan esok)</option>
                  <option>Segera (Butuh siang ini)</option>
                  <option>Sangat Mendesak (Butuh dalam 1 jam)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">Catatan Keperluan Lapangan</label>
              <textarea rows={2} placeholder="Sebutkan kenapa bahan ini dibutuhkan mendadak..." className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-50/50" />
            </div>
            <button type="submit" className="bg-emerald-800 hover:bg-emerald-950 text-white font-bold py-2 px-5 rounded-lg text-xs">
              Kirim Request Bahan
            </button>
          </form>

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> {successMsg}
            </div>
          )}
        </div>
      );

    case 14: // Keluhan
      return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold font-sans text-neutral-800 flex items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-red-600 animate-pulse" />
                  Log Keluhan Relawan & Masukan Hidangan
                </h2>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                  isSupabaseConfigured ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {isSupabaseConfigured ? '🟢 Cloud Sync Aktif' : '🟡 Mode Lokal (Tanpa Cloud)'}
                </span>
                {isAdmin && (
                  <span className="bg-purple-100 text-purple-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-purple-200 animate-pulse">
                    🔑 Akun Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">Katalog keluhan dari Ustadz Pembimbing, asrama, aslap, atau relawan untuk corrective action SOP Dapur.</p>
            </div>
          </div>

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" /> {successMsg}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Form Input Keluhan */}
            <div className="lg:col-span-1">
              <form onSubmit={handleCreateComplaint} className="p-4 border border-rose-100 bg-rose-50/10 rounded-xl space-y-4">
                <h4 className="font-bold text-xs text-rose-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Catat Keluhan Baru
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Sumber Keluhan</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.source || ''}
                      onChange={e => setFormData({ ...formData, source: e.target.value })}
                      placeholder="Contoh: Ustadz Jauhari (Asrama Putra C)" 
                      className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs outline-hidden focus:ring-1 focus:ring-rose-300" 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Kategori Masalah</label>
                    <select 
                      value={formData.category || 'Kebersihan Hidangan'}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs outline-hidden focus:ring-1 focus:ring-rose-300"
                    >
                      <option value="Kebersihan Hidangan">Kebersihan Hidangan (Asing/Serangga)</option>
                      <option value="Keterlambatan Distribusi">Keterlambatan Distribusi (Sarapan/Sore)</option>
                      <option value="Rasa / Suhu Makanan">Rasa / Suhu Makanan (Hambar/Dingin/Asin)</option>
                      <option value="Kekurangan Porsi Jumlah">Kekurangan Porsi Jumlah (Kurang Box/Ompreng)</option>
                      <option value="Lainnya">Lainnya (Komplain Non-Spesifik)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-600 uppercase mb-1">Isi Keluhan</label>
                    <textarea 
                      rows={3} 
                      required 
                      value={formData.complaintText || ''}
                      onChange={e => setFormData({ ...formData, complaintText: e.target.value })}
                      placeholder="Uraikan laporan masalah asrama secara lengkap..." 
                      className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 bg-white shadow-2xs outline-hidden focus:ring-1 focus:ring-rose-300" 
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="bg-red-750 hover:bg-neutral-900 border border-transparent text-white font-bold px-4 py-2.5 rounded-lg text-xs w-full transition-colors uppercase tracking-wider"
                  >
                    Kirim Log Keluhan
                  </button>
                </div>
              </form>
            </div>

            {/* List Keluhan dan Solusi / Tindakan Perbaikan */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <h3 className="font-bold text-xs text-neutral-700 uppercase tracking-widest flex items-center gap-1.5">
                  <ClipboardCheck className="h-4 w-4 text-rose-800" />
                  Daftar Investigasi Keluhan Relawan
                </h3>
                <span className="text-[10px] bg-red-100 text-red-800 font-mono px-2 py-0.5 rounded-full font-black">
                  Keluhan Pasif: {keluhanList.length}
                </span>
              </div>

              {keluhanList.length === 0 ? (
                <div className="bg-neutral-50/50 border border-neutral-100 border-dashed rounded-xl p-8 text-center text-xs text-neutral-400 font-medium">
                  {isLoadingData ? 'Sedang memuat data dari database...' : 'Tidak ada catatan keluhan saat ini.'}
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {keluhanList.map((item, idx) => (
                    <div key={item.id || idx} className="p-4 border border-rose-100 bg-white rounded-xl space-y-3 relative hover:bg-neutral-50/20 transition-all shadow-2xs">
                      
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-neutral-900 text-xs sm:text-sm bg-neutral-100/80 px-2 py-1 rounded-sm border border-neutral-200">
                              🏠 {item.source}
                            </span>
                            <span className="text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-150 px-2 py-0.5 rounded-full uppercase">
                              {item.category}
                            </span>
                          </div>
                          
                          <p className="text-[10px] text-neutral-400 mt-1">
                            Pelapor: <span className="font-mono">{item.created_by || 'wali@sppg.com'}</span>
                            {item.created_at && ` • Tanggal: ${new Date(item.created_at).toLocaleDateString('id-ID', {day: 'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}`}
                          </p>
                        </div>

                        {/* Status label */}
                        <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-extrabold rounded border ${
                          item.status === 'selesai' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200 animate-pulse'
                        }`}>
                          {item.status === 'selesai' ? '✓ Terselesaikan' : '⌛ Sedang Diperiksa'}
                        </span>
                      </div>

                      <div className="text-xs bg-neutral-50/60 p-2.5 rounded-lg text-neutral-700 leading-relaxed font-serif">
                        <strong className="text-neutral-400 font-sans text-[10px] block uppercase mb-0.5 select-none font-bold">Laporan Masalah:</strong>
                        "{item.complaint_text}"
                      </div>

                      {/* Corrective Action Display or Form update */}
                      {item.status === 'selesai' ? (
                        <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-lg text-xs text-emerald-950 font-sans">
                          <strong className="text-emerald-800 font-sans text-[10px] block uppercase mb-1 font-extrabold">🚀 Corrective Action (Tindakan Nyata):</strong>
                          {item.action_taken}
                        </div>
                      ) : (
                        <div className="bg-red-50/40 border border-red-100 p-2.5 rounded-lg text-xs text-neutral-600 font-sans space-y-2">
                          <strong className="text-red-800 text-[10px] block uppercase font-extrabold">🚨 Tindakan Investigasi Belum Dirilis:</strong>
                          
                          {/* If admin is logged-in, they see form input */}
                          {isAdmin ? (
                            <div className="flex gap-2 items-center mt-1">
                              <input 
                                type="text"
                                value={adminComplaintAction[item.id] || ''}
                                onChange={e => setAdminComplaintAction({ ...adminComplaintAction, [item.id]: e.target.value })}
                                placeholder="Tulis instruksi perbaikan kuah / ganti porsi dsb..."
                                className="text-xs border border-neutral-200 rounded-lg px-2.5 py-1.5 flex-1 bg-white focus:outline-rose-300"
                              />
                              <button
                                onClick={() => handleResolveComplaint(item.id)}
                                className="bg-rose-750 hover:bg-neutral-950 text-white font-extrabold text-[10px] uppercase px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                              >
                                Selesaikan Keluhan
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-400 italic">
                              Menanti tindakan perbaikan dan evaluasi dari Administrator (Ustadz Munif).
                            </span>
                          )}
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      );

    case 16: // Rekap Sampah Makanan (Waste)
      const handleCreateTrashItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTrashDate || !newTrashMenu.trim()) return;
        const newItem: TrashItem = {
          id: 'ts-' + Date.now(),
          tanggal: newTrashDate,
          hari: newTrashHari,
          namaMenu: newTrashMenu,
          porsiBesar: Number(newTrashPorsiBesar) || 0,
          porsiKecil: Number(newTrashPorsiKecil) || 0,
          gramasiMP: Number(newTrashGramasiMP) || 0,
          gramasiLN: Number(newTrashGramasiLN) || 0,
          gramasiLH: Number(newTrashGramasiLH) || 0,
          gramasiSY: Number(newTrashGramasiSY) || 0,
          gramasiBuah: Number(newTrashGramasiBuah) || 0,
          sampahMP: Number(newTrashSampahMP) || 0,
          sampahLN: Number(newTrashSampahLN) || 0,
          sampahLH: Number(newTrashSampahLH) || 0,
          sampahSY: Number(newTrashSampahSY) || 0,
          sampahBuah: Number(newTrashSampahBuah) || 0,
          sampahOrganik: Number(newTrashSisaOrganik) || 0,
          sampahAnorganik: Number(newTrashSisaAnorganik) || 0,
        };
        setTrashItems(prev => [newItem, ...prev]);
        setNewTrashMenu('');
        setNewTrashDate('');
        setNewTrashPorsiBesar(0);
        setNewTrashPorsiKecil(0);
        setNewTrashGramasiMP(0);
        setNewTrashGramasiLN(0);
        setNewTrashGramasiLH(0);
        setNewTrashGramasiSY(0);
        setNewTrashGramasiBuah(0);
        setNewTrashSampahMP(0);
        setNewTrashSampahLN(0);
        setNewTrashSampahLH(0);
        setNewTrashSampahSY(0);
        setNewTrashSampahBuah(0);
        setNewTrashSisaOrganik(0);
        setNewTrashSisaAnorganik(0);
        setIsAddingTrash(false);
        triggerSuccessMsg("Rekap data sampah masakan berhasil didokumentasikan!");
      };

      const handleRemoveTrashItem = (id: string) => {
        const confirmed = window.confirm("Apakah Anda yakin ingin menghapus catatan sampah makanan ini?");
        if (confirmed) {
          setTrashItems(prev => prev.filter(item => item.id !== id));
          triggerSuccessMsg("Catatan sampah berhasil dihapus.");
        }
      };

      const getKelayakanStats = (item: TrashItem) => {
        const totalKirim = (item.gramasiMP || 0) + (item.gramasiLN || 0) + (item.gramasiLH || 0) + (item.gramasiSY || 0) + (item.gramasiBuah || 0);
        const totalSampah = (item.sampahMP || 0) + (item.sampahLN || 0) + (item.sampahLH || 0) + (item.sampahSY || 0) + (item.sampahBuah || 0);
        const konsumsiPercent = totalKirim > 0 ? ((totalKirim - totalSampah) / totalKirim) * 100 : 100;

        let statusText = 'Sangat Baik';
        let bgStyle = 'bg-emerald-100 text-emerald-805 border-emerald-300';
        let desc = 'Sangat disukai & diterima oleh siswa. Sisa makanan sangat minim.';

        if (konsumsiPercent < 75) {
          statusText = 'Perlu Evaluasi';
          bgStyle = 'bg-rose-100 text-rose-800 border-rose-300';
          desc = 'Perlu ditinjau ulang (rasa, tekstur, atau porsi) - sisa makanan > 25%.';
        } else if (konsumsiPercent < 90) {
          statusText = 'Baik';
          bgStyle = 'bg-amber-100 text-amber-805 border-amber-300';
          desc = 'Layak dan aman dikonsumsi dengan beberapa sisa ringan.';
        }

        return {
          totalKirim,
          totalSampah,
          percent: konsumsiPercent.toFixed(1),
          statusText,
          bgStyle,
          desc
        };
      };

      // Preview calculations for the current input fields
      const currentKirimTotal = Number(newTrashGramasiMP) + Number(newTrashGramasiLN) + Number(newTrashGramasiLH) + Number(newTrashGramasiSY) + Number(newTrashGramasiBuah);
      const currentSampahTotal = Number(newTrashSampahMP) + Number(newTrashSampahLN) + Number(newTrashSampahLH) + Number(newTrashSampahSY) + Number(newTrashSampahBuah);
      const currentPercent = currentKirimTotal > 0 ? ((currentKirimTotal - currentSampahTotal) / currentKirimTotal) * 100 : 100;
      let currentStatus = 'Sangat Baik';
      let currentBg = 'bg-emerald-100 text-emerald-800';
      if (currentPercent < 75) {
        currentStatus = 'Perlu Evaluasi';
        currentBg = 'bg-rose-100 text-rose-800';
      } else if (currentPercent < 90) {
        currentStatus = 'Baik';
        currentBg = 'bg-amber-100 text-amber-800';
      }

      // Pie chart calculations for overall food waste composition
      const totalMP = trashItems.reduce((acc, it) => acc + (it.sampahMP || 0), 0);
      const totalLN = trashItems.reduce((acc, it) => acc + (it.sampahLN || 0), 0);
      const totalLH = trashItems.reduce((acc, it) => acc + (it.sampahLH || 0), 0);
      const totalSY = trashItems.reduce((acc, it) => acc + (it.sampahSY || 0), 0);
      const totalBuah = trashItems.reduce((acc, it) => acc + (it.sampahBuah || 0), 0);
      const grandTotalWaste = totalMP + totalLN + totalLH + totalSY + totalBuah;

      const pieData = [
        { label: 'Makanan Pokok', value: totalMP, color: '#0f766e' }, // teal-700
        { label: 'Lauk Nabati', value: totalLN, color: '#f59e0b' },   // amber-500
        { label: 'Lauk Hewani', value: totalLH, color: '#e11d48' },   // rose-600
        { label: 'Sayur Hidangan', value: totalSY, color: '#10b981' }, // emerald-500
        { label: 'Buah / Susu', value: totalBuah, color: '#3b82f6' }  // blue-500
      ].filter(d => d.value > 0);

      const getCoordinatesForPercent = (percent: number) => {
        const angle = percent * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        return [x, y];
      };

      const getPieSlices = (data: { label: string; value: number; color: string }[]) => {
        const total = data.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) return [];
        
        let accumulatedPercent = 0;
        return data.map((slice) => {
          const startPercent = accumulatedPercent;
          accumulatedPercent += slice.value / total;
          const endPercent = accumulatedPercent;
          
          const [startX, startY] = getCoordinatesForPercent(startPercent);
          const [endX, endY] = getCoordinatesForPercent(endPercent);
          
          const largeArcFlag = slice.value / total > 0.5 ? 1 : 0;
          
          const pathData = [
            `M 50 50`,
            `L ${50 + 40 * startX} ${50 + 40 * startY}`,
            `A 40 40 0 ${largeArcFlag} 1 ${50 + 40 * endX} ${50 + 40 * endY}`,
            `Z`
          ].join(' ');
          
          return {
            pathData,
            ...slice,
            percent: ((slice.value / total) * 100).toFixed(1)
          };
        });
      };

      const slices = getPieSlices(pieData);

      return (
        <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Trash2 className="h-6 w-6 text-emerald-700 font-bold" />
                <h2 className="text-xl font-bold font-sans text-neutral-800">
                  Rekapitulasi Sampah Makanan (Waste Tracker)
                </h2>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Kalkulasi volume pengiriman makanan vs sisa sampah makanan siswa untuk menentukan indeks status kelayakan menu.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddingTrash(!isAddingTrash)}
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-4 w-4" /> {isAddingTrash ? 'Batal' : 'Catat Rekap Sampah'}
              </button>
              <button
                onClick={() => triggerSuccessMsg("Seluruh laporan rekap sampah makanan berhasil diekspor!")}
                className="border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold px-4 py-2 rounded-lg"
              >
                Ekspor Data
              </button>
            </div>
          </div>

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle className="h-4 w-4 shrink-0" /> {successMsg}
            </div>
          )}

          {/* Form Create Waste Report */}
          {isAddingTrash && (
            <form onSubmit={handleCreateTrashItem} className="bg-neutral-50 p-5 rounded-xl border border-neutral-250 space-y-6">
              <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
                <h3 className="text-xs font-bold font-mono text-emerald-900 uppercase tracking-wider">Formulir Log Rekap Sampah Baru</h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold font-mono px-2 py-0.5 rounded uppercase">Preview Sistem</span>
              </div>

              {/* Step 1: Identitas & Porsi */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-neutral-700 uppercase border-l-4 border-emerald-850 pl-2">1. Identitas & Volume Porsi</h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Tanggal</label>
                    <input
                      type="date"
                      required
                      value={newTrashDate}
                      onChange={e => setNewTrashDate(e.target.value)}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Hari</label>
                    <select
                      value={newTrashHari}
                      onChange={e => setNewTrashHari(e.target.value)}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-semibold"
                    >
                      {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Nama Menu Harian</label>
                    <input
                      type="text"
                      required
                      value={newTrashMenu}
                      onChange={e => setNewTrashMenu(e.target.value)}
                      placeholder="Contoh: Sayur Bobor Bayam, Telur Dadar & Melon"
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Jumlah Porsi Besar</label>
                    <input
                      type="number"
                      value={newTrashPorsiBesar}
                      onChange={e => setNewTrashPorsiBesar(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Jumlah Porsi Kecil</label>
                    <input
                      type="number"
                      value={newTrashPorsiKecil}
                      onChange={e => setNewTrashPorsiKecil(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Total Porsi (Kalkulasi)</label>
                    <input
                      type="text"
                      disabled
                      value={`${(Number(newTrashPorsiBesar) || 0) + (Number(newTrashPorsiKecil) || 0)} Porsi`}
                      className="w-full text-xs border border-neutral-300 rounded px-2.5 py-1.5 bg-neutral-100 font-extrabold font-mono text-neutral-700"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Gramasi Pengiriman */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-neutral-700 uppercase border-l-4 border-emerald-850 pl-2">2. Gramasi Pengiriman Makanan (Gram)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1">MP (Makanan Pokok)</label>
                    <input
                      type="number"
                      value={newTrashGramasiMP}
                      onChange={e => setNewTrashGramasiMP(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1">LN (Lauk Nabati)</label>
                    <input
                      type="number"
                      value={newTrashGramasiLN}
                      onChange={e => setNewTrashGramasiLN(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1">LH (Lauk Hewani)</label>
                    <input
                      type="number"
                      value={newTrashGramasiLH}
                      onChange={e => setNewTrashGramasiLH(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1">SY (Sayur)</label>
                    <input
                      type="number"
                      value={newTrashGramasiSY}
                      onChange={e => setNewTrashGramasiSY(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1 font-semibold">Buah</label>
                    <input
                      type="number"
                      value={newTrashGramasiBuah}
                      onChange={e => setNewTrashGramasiBuah(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-bold text-neutral-500 mb-1">Total Kirim (Gr)</label>
                    <div className="bg-neutral-200 text-neutral-800 text-xs font-bold font-mono rounded px-2.5 py-1.5 text-center shadow-2xs border border-neutral-250">
                      {currentKirimTotal.toLocaleString()} g
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Gramasi Sampah */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-neutral-700 uppercase border-l-4 border-emerald-850 pl-2">3. Gramasi Sampah / Sisa Piring (Gram)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-1">Sampah MP</label>
                    <input
                      type="number"
                      value={newTrashSampahMP}
                      onChange={e => setNewTrashSampahMP(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono text-rose-805"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-1">Sampah LN</label>
                    <input
                      type="number"
                      value={newTrashSampahLN}
                      onChange={e => setNewTrashSampahLN(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono text-rose-805"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-1">Sampah LH</label>
                    <input
                      type="number"
                      value={newTrashSampahLH}
                      onChange={e => setNewTrashSampahLH(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono text-rose-805"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-1">Sampah SY</label>
                    <input
                      type="number"
                      value={newTrashSampahSY}
                      onChange={e => setNewTrashSampahSY(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono text-rose-805"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-400 mb-1">Sampah Buah</label>
                    <input
                      type="number"
                      value={newTrashSampahBuah}
                      onChange={e => setNewTrashSampahBuah(Number(e.target.value))}
                      className="w-full text-xs border border-neutral-200 rounded px-2.5 py-1.5 bg-white font-mono text-rose-805"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[10px] font-bold text-neutral-500 mb-1">Total Sampah (Gr)</label>
                    <div className="bg-rose-50 text-rose-800 text-xs font-bold font-mono rounded px-2.5 py-1.5 text-center border border-rose-200 shadow-2xs">
                      {currentSampahTotal.toLocaleString()} g
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4: Sisa Produksi Organik / Anorganik */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-neutral-200 pt-4">
                <div>
                  <h4 className="text-[11px] font-bold text-neutral-700 uppercase border-l-4 border-emerald-850 pl-2 mb-3">4. Sisa Produksi (Dapur)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-neutral-500 mb-1">Sampah Organik (Kg)</label>
                      <input
                        type="number"
                        step="any"
                        value={newTrashSisaOrganik}
                        onChange={e => setNewTrashSisaOrganik(Number(e.target.value))}
                        className="w-full text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-500 mb-1 font-semibold">Anorganik (Kg)</label>
                      <input
                        type="number"
                        step="any"
                        value={newTrashSisaAnorganik}
                        onChange={e => setNewTrashSisaAnorganik(Number(e.target.value))}
                        className="w-full text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Instant Analysis Preview */}
                <div className="sm:col-span-2 bg-neutral-105 border border-neutral-250 p-4 rounded-lg">
                  <h5 className="text-[10px] font-bold text-neutral-550 uppercase tracking-widest font-mono">Simulasi Indeks Kelayakan Menu</h5>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-xs text-neutral-550 block select-none">Persentase Konsumsi</span>
                      <span className="text-2xl font-black font-mono text-neutral-850">{currentPercent.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-xs text-neutral-550 block select-none">Status Kelayakan</span>
                      <span className={`inline-block font-extrabold px-3 py-1 text-xs rounded border capitalize ${currentBg}`}>
                        {currentStatus}
                      </span>
                    </div>
                    <div className="flex-1 text-[10.5px] text-neutral-500 leading-relaxed">
                      {currentStatus === 'Sangat Baik' && 'Penerimaan katering sangat tinggi. Makanan dikonsumsi optimal oleh murid.'}
                      {currentStatus === 'Baik' && 'Penerimaan layak & aman. Ada sedikit sisa piring yang dapat dimonitor.'}
                      {currentStatus === 'Perlu Evaluasi' && 'Tingkat kelebihan porsi atau ketidaksukaan menu di atas 25%. Silakan evaluasi rasa & porsi.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingTrash(false)}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 text-xs rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-805 hover:bg-emerald-950 text-white rounded-lg text-xs font-bold"
                >
                  Simpan Catatan Sampah
                </button>
              </div>
            </form>
          )}

          {/* Bento dynamic KPI stats for Waste tracker */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200/50 text-emerald-800 shadow-2xs">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest font-mono select-none block">Indeks Konsumsi</span>
                <span className="text-lg font-black text-neutral-800 font-mono">
                  {trashItems.length > 0
                    ? (trashItems.reduce((acc, item) => {
                        const tk = (item.gramasiMP || 0) + (item.gramasiLN || 0) + (item.gramasiLH || 0) + (item.gramasiSY || 0) + (item.gramasiBuah || 0);
                        const ts = (item.sampahMP || 0) + (item.sampahLN || 0) + (item.sampahLH || 0) + (item.sampahSY || 0) + (item.sampahBuah || 0);
                        return acc + (tk > 0 ? ((tk - ts) / tk) * 100 : 100);
                      }, 0) / trashItems.length).toFixed(1)
                    : '100'}%
                </span>
                <span className="text-[9px] text-emerald-700 block select-none">Rata-rata Terkonsumsi</span>
              </div>
            </div>

            <div className="bg-amber-50/40 border border-amber-100 p-4 rounded-xl flex items-center gap-3">
              <div className="bg-white p-2.5 rounded-lg border border-amber-200/50 text-amber-800 shadow-2xs">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest font-mono select-none block">Total Sampah Piring</span>
                <span className="text-lg font-black text-neutral-800 font-mono">
                  {(trashItems.reduce((acc, item) => acc + (item.sampahMP || 0) + (item.sampahLN || 0) + (item.sampahLH || 0) + (item.sampahSY || 0) + (item.sampahBuah || 0), 0) / 1000).toFixed(1)} Kg
                </span>
                <span className="text-[9px] text-amber-700 block select-none">Sisa Piring Murid (Katering)</span>
              </div>
            </div>

            <div className="bg-rose-50/30 border border-rose-100 p-4 rounded-xl flex items-center gap-3">
              <div className="bg-white p-2.5 rounded-lg border border-rose-200/50 text-rose-800 shadow-2xs">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest font-mono select-none block">Sisa Produksi Dapur</span>
                <span className="text-lg font-black text-neutral-800 font-mono">
                  {(trashItems.reduce((acc, item) => acc + (item.sampahOrganik || 0) + (item.sampahAnorganik || 0), 0)).toFixed(1)} Kg
                </span>
                <span className="text-[9px] text-rose-700 block select-none">Sampah Dapur Pasca-Masak</span>
              </div>
            </div>

            <div className="bg-blue-50/30 border border-blue-105 p-4 rounded-xl flex items-center gap-3">
              <div className="bg-white p-2.5 rounded-lg border border-blue-200/50 text-blue-700 shadow-2xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="truncate max-w-full">
                <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest font-mono select-none block">Menu Terfavorit</span>
                <span className="text-xs font-bold text-neutral-800 truncate block max-w-[160px]" title={trashItems.length > 0 ? trashItems[0].namaMenu : '-'}>
                  {trashItems.length > 0 ? trashItems[0].namaMenu.split(',')[0] : '-'}
                </span>
                <span className="text-[9px] text-blue-705 block select-none">Indeks Sisa Minim</span>
              </div>
            </div>
          </div>

          {/* View Toggle Layout */}
          <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-3">
            <span className="text-xs font-bold text-neutral-600 block select-none">
              Daftar Dokumentasi Sampah:
            </span>
            <div className="inline-flex p-1 bg-neutral-100 rounded-lg border border-neutral-200/60 font-sans">
              <button
                type="button"
                onClick={() => setWasteViewMode('card')}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${wasteViewMode === 'card' ? 'bg-white text-emerald-805 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                📰 Kartu Harian (Mudah Dibaca)
              </button>
              <button
                type="button"
                onClick={() => setWasteViewMode('table')}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${wasteViewMode === 'table' ? 'bg-white text-emerald-805 shadow-xs' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                📊 Tabel Laporan Lengkap
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (Content) */}
            <div className="lg:col-span-2 space-y-4">
              {wasteViewMode === 'card' ? (
                /* SIMPLIFIED VISUAL DAILY CARDS */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trashItems.length === 0 ? (
                <div className="col-span-2 p-12 text-center border-2 border-dashed border-neutral-200 rounded-2xl text-neutral-400 font-medium font-sans">
                  Belum ada laporan sampah piring masakan yang ditambahkan.
                </div>
              ) : (
                trashItems.map(item => {
                  const stats = getKelayakanStats(item);
                  return (
                    <div key={item.id} className="bg-white border border-neutral-200 rounded-xl shadow-2xs overflow-hidden flex flex-col hover:border-emerald-300 transition-all">
                      <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="bg-neutral-200 text-neutral-800 text-[9px] font-bold px-2 py-0.5 rounded font-mono">{item.tanggal}</span>
                          <span className="text-xs font-bold text-neutral-700">{item.hari}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${stats.bgStyle}`}>
                          {stats.statusText} ({stats.percent}%)
                        </span>
                      </div>
                      <div className="p-4 space-y-3 flex-1 text-xs">
                        <div>
                          <span className="text-[9px] text-neutral-400 block font-bold uppercase">Menu</span>
                          <span className="font-semibold text-neutral-800 text-xs">{item.namaMenu || 'Belum diisi'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 border-t border-neutral-100 pt-2 text-[11px] text-neutral-600">
                          <div>
                            <span className="text-[9px] text-neutral-400 block">Total Porsi</span>
                            <span className="font-bold text-neutral-800">{item.porsiBesar + item.porsiKecil} Porsi</span>
                            <span className="text-[9px] text-neutral-500 block">({item.porsiBesar} Bsr / {item.porsiKecil} Kcl)</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-neutral-400 block">Volume Kirim</span>
                            <span className="font-bold text-neutral-800">{(stats.totalKirim / 1000).toFixed(1)} Kg</span>
                          </div>
                        </div>
                        <div className="bg-rose-50/50 p-2.5 rounded-lg border border-rose-100 text-[11px] space-y-1">
                          <span className="text-[9px] text-rose-800 font-bold block uppercase">Rincian Sisa Piring:</span>
                          <div className="grid grid-cols-5 gap-1 text-center text-neutral-750 font-mono">
                            <div><div className="text-[8px] text-neutral-450">MP</div><div className="font-semibold">{item.sampahMP}g</div></div>
                            <div><div className="text-[8px] text-neutral-450">LN</div><div className="font-semibold">{item.sampahLN}g</div></div>
                            <div><div className="text-[8px] text-neutral-450">LH</div><div className="font-semibold">{item.sampahLH}g</div></div>
                            <div><div className="text-[8px] text-neutral-450">SY</div><div className="font-semibold">{item.sampahSY}g</div></div>
                            <div><div className="text-[8px] text-neutral-450">BH</div><div className="font-semibold">{item.sampahBuah}g</div></div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-neutral-50/50 px-4 py-2 border-t border-neutral-150 flex items-center justify-between text-[11px]">
                        <span className="text-neutral-500">Sisa Dapur: {item.sampahOrganik}kg Org / {item.sampahAnorganik}kg Anorg</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTrashItem(item.id)}
                          className="text-rose-600 hover:text-rose-900 font-semibold text-xs cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* TABULAR DATA TAB VIEW */
            <div className="overflow-x-auto border border-neutral-200 rounded-xl bg-white">
              <table className="w-full text-left border-collapse text-xs select-text">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] text-neutral-500 font-extrabold uppercase tracking-wider select-none">
                    <th className="py-2.5 px-3">Tanggal / Hari</th>
                    <th className="py-2.5 px-3">Nama Menu</th>
                    <th className="py-2.5 px-3 text-center w-24">Porsi (B/K)</th>
                    <th className="py-2.5 px-3 text-center w-28">Kirim (Kg)</th>
                    <th className="py-2.5 px-3 text-center bg-rose-50/40 text-rose-800 w-28">Sisa (Kg)</th>
                    <th className="py-2.5 px-3 text-center">Analisis</th>
                    <th className="py-2.5 px-3 text-center w-10">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {trashItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-400 text-xs">
                        Belum ada laporan sampah masakan.
                      </td>
                    </tr>
                  ) : (
                    trashItems.map(item => {
                      const stats = getKelayakanStats(item);
                      return (
                        <tr key={item.id} className="hover:bg-neutral-50/40 text-[11px] transition-colors leading-normal">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-neutral-900">{item.tanggal}</div>
                            <div className="text-neutral-400 text-[10px]">{item.hari}</div>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-neutral-850 max-w-[150px] truncate" title={item.namaMenu}>
                            {item.namaMenu}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <div className="font-semibold text-neutral-800">{item.porsiBesar + item.porsiKecil}</div>
                            <div className="text-[9px] text-neutral-400">({item.porsiBesar}/{item.porsiKecil})</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <span className="font-semibold text-neutral-800">{(stats.totalKirim / 1000).toFixed(1)}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center bg-rose-50/10 font-mono text-rose-800">
                            <span className="font-bold">{(stats.totalSampah / 1000).toFixed(1)}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${stats.bgStyle}`}>
                              {stats.statusText} ({stats.percent}%)
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveTrashItem(item.id)}
                              className="text-rose-600 hover:text-rose-900 p-1 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Visual SVG Pie Chart */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="border-b border-neutral-100 pb-2">
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider font-mono">Analisis Komposisi Sampah</h3>
              <p className="text-[10px] text-neutral-500 mt-0.5 leading-snug">Proporsi sisa makanan piring siswa secara kumulatif</p>
            </div>
            
            {slices.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-400 font-medium">
                Belum ada data sampah untuk menampilkan grafik lingkaran.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex justify-center py-2">
                  <svg width="160" height="160" viewBox="0 0 100 100" className="drop-shadow-xs relative">
                    {slices.map((slice, index) => (
                      <path
                        key={index}
                        d={slice.pathData}
                        fill={slice.color}
                        className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                      >
                        <title>{slice.label}: {slice.value.toLocaleString()} g ({slice.percent}%)</title>
                      </path>
                    ))}
                    {/* Inner Donut Hole */}
                    <circle cx="50" cy="50" r="26" fill="white" />
                    {/* Text inside donut */}
                    <text x="50" y="48" textAnchor="middle" className="text-[7px] font-black fill-neutral-800 font-sans">
                      {((grandTotalWaste) / 1000).toFixed(1)} Kg
                    </text>
                    <text x="50" y="56" textAnchor="middle" className="text-[4px] font-bold fill-neutral-400 uppercase tracking-widest font-mono">
                      SISA PIRING
                    </text>
                  </svg>
                </div>
                
                <div className="space-y-2 border-t border-neutral-100 pt-3">
                  {slices.map((slice, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }}></span>
                        <span className="font-medium text-neutral-600 text-[11px]">{slice.label}</span>
                      </div>
                      <span className="font-bold font-mono text-neutral-800 text-[11px]">
                        {slice.value.toLocaleString()} g ({slice.percent}%)
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-900 border-t border-dashed border-neutral-200 pt-2 mt-2">
                    <span className="text-[11px]">Total Sisa Piring</span>
                    <span className="font-mono text-[11px]">{(grandTotalWaste / 1000).toFixed(1)} Kg</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-neutral-200 p-4 rounded-xl space-y-2">
        <h4 className="text-xs font-bold text-neutral-800">Petunjuk Parameter & Rumus Perhitungan:</h4>
        <ul className="list-disc list-inside text-[11px] text-neutral-500 space-y-1 pl-1">
          <li>
            <strong className="text-neutral-700">Total Porsi:</strong> Penjumlahan otomatis antara volume Porsi Besar dan Porsi Kecil yang ditarik dari Master Jumlah Porsi.
          </li>
          <li>
            <strong className="text-neutral-700">Indeks Konsumsi (%):</strong> Kalkulasi presentasi pangan yang dimakan siswa. Rumus: <code className="bg-neutral-200/60 px-1 py-0.2 rounded text-[10px] font-mono text-neutral-800">((Total Kirim - Total Sampah) / Total Kirim) * 100</code>.
          </li>
          <li>
            <strong className="text-neutral-700">Sisa Produksi:</strong> Jumlah sisa buangan organik/anorganik dari dapur internal (sebelum piring siswa).
          </li>
        </ul>
      </div>
    </div>
  );

    case 17: { // Stok Operasional
      return (
        <StockOperasionalView
          selectedDate={selectedOperasionalDate}
          isInitialFetchDone={isInitialFetchDone}
          operasionalMap={operasionalMap}
          setOperasionalMap={setOperasionalMap}
          kedatanganMap={kedatanganMap}
          savedReports={savedReports}
          addSavedReport={addSavedReport}
          triggerSuccessMsg={triggerSuccessMsg}
          successMsg={successMsg}
          isSupabaseConfigured={isSupabaseConfigured}
        />
      );
    }

    case 18: {
      return (
        <ShippingDocPanel
          type="ompreng"
          title="Dokumentasi Pengiriman Ompreng"
          description="Laporan visual pengiriman kotak boks pemintas makanan (ompreng) ke asrama, menjamin kerapihan, higienitas, dan kuantitas koli boks."
          icon={Truck}
          loggedInUser={loggedInUser}
          currentUserRole={currentUserRole || UserRole.DRIVER}
          shippingDocs={shippingDocs}
          setShippingDocs={setShippingDocs}
          selectedDate={selectedDate || '2026-06-16'}
        />
      );
    }

    case 19: {
      return (
        <BASTView
          loggedInUser={loggedInUser}
          currentUserRole={currentUserRole || UserRole.DRIVER}
          shippingDocs={shippingDocs}
          setShippingDocs={setShippingDocs}
          selectedDate={selectedDate || '2026-06-16'}
          allDayMenus={allDayMenus}
        />
      );
    }

    case 20: {
      return (
        <SuratJalanView
          loggedInUser={loggedInUser}
          currentUserRole={currentUserRole || UserRole.DRIVER}
          shippingDocs={shippingDocs}
          setShippingDocs={setShippingDocs}
          selectedDate={selectedDate || '2026-06-16'}
          allDayMenus={allDayMenus}
        />
      );
    }

    case 21: {
      return (
        <OrganoleptikView
          loggedInUser={loggedInUser}
          currentUserRole={currentUserRole || UserRole.DRIVER}
          shippingDocs={shippingDocs}
          setShippingDocs={setShippingDocs}
          selectedDate={selectedDate || '2026-06-16'}
          allDayMenus={allDayMenus}
        />
      );
    }

    case 22: {
      return (
        <PortionMasterView
          selectedDate={selectedDate || '2026-08-04'}
          allDayMenus={allDayMenus}
          shippingDocs={shippingDocs}
          setShippingDocs={setRawShippingDocs}
        />
      );
    }

    case 23: {
      return (
        <DashboardAdminView
          selectedDate={selectedDate || '2026-06-16'}
          allDayMenus={allDayMenus}
          sops={sops}
          setSops={setSops}
          onSaveMenu={onSaveMenu}
          onGenerateSOPs={onGenerateSOPs}
          onGoToTab={onGoToTab}
          shippingDocs={shippingDocs}
          setShippingDocs={setRawShippingDocs}
          orderRequests={orderRequests}
          setOrderRequests={setOrderRequests}
          keluhanList={keluhanList}
          setKeluhanList={setKeluhanList}
          onSaveSopsToCloud={onSaveSopsToCloud}
        />
      );
    }

    default:
      return (
        <div className="p-8 text-center text-neutral-400">
          Sub-fitur dalam pengerjaan. Silakan pilih menu SOP di sidebar.
        </div>
      );
  }
}
