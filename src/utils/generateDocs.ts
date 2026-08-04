import { PortionConfig, DEFAULT_PORTIONS } from '../components/PortionMasterView';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getRecipientName, getDefaultReceiptTime, generateAbbrev } from './docHelpers';

export async function fetchPortionsForDate(date: string): Promise<PortionConfig> {
  let portions: PortionConfig = { ...DEFAULT_PORTIONS };
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('master_porsi')
        .select('portions')
        .eq('date', date)
        .maybeSingle();
      
      if (error) {
        console.warn("Could not load portions from Supabase, trying local cache:", error);
      } else if (data && data.portions) {
        return data.portions as PortionConfig;
      }
      
      // Fallback to template
      const { data: tplData } = await supabase
        .from('master_porsi')
        .select('portions')
        .eq('date', '1970-01-01')
        .maybeSingle();
      if (tplData && tplData.portions) {
        return tplData.portions as PortionConfig;
      }
    }
    
    // Local storage fallback
    const saved = localStorage.getItem(`sppg_portions_${date}`);
    if (saved) return JSON.parse(saved);
    const globalSaved = localStorage.getItem('sppg_global_master_portions');
    if (globalSaved) return JSON.parse(globalSaved);
  } catch (err) {
    console.warn("Error loading portion master data:", err);
  }
  return portions;
}

export async function generateInitialDocsAsync(
  selectedDate: string,
  currentDocs: any[],
  menuStr: string,
  loggedInUserEmail: string
): Promise<any[]> {
  const portions = await fetchPortionsForDate(selectedDate);
  
  const dateParts = selectedDate.split('-');
  const year = dateParts[0] || '2026';
  const month = dateParts[1] || '07';
  const day = dateParts[2] || '19';

  const schools = [
    "MA Assa'adah",
    "MTS Assa'adah II",
    "SMA Assa'adah",
    "SMK Assa'adah",
    "Desa Sukowati",
    "Desa Sidokumpul"
  ];

  const getPortionCount = (schName: string) => {
    if (schName === "MA Assa'adah") return (portions.MA?.guru || 0) + (portions.MA?.siswa || 0);
    if (schName === "MTS Assa'adah II") return (portions["MTS II"]?.guru || 0) + (portions["MTS II"]?.siswa || 0);
    if (schName === "SMA Assa'adah") return (portions.SMA?.guru || 0) + (portions.SMA?.siswa || 0);
    if (schName === "SMK Assa'adah") return (portions.SMK?.guru || 0) + (portions.SMK?.siswa || 0);
    if (schName === "Desa Sukowati") return (portions.Sukowati?.besar || 0) + (portions.Sukowati?.kecil || 0);
    if (schName === "Desa Sidokumpul") return (portions.Sidokumpul?.besar || 0) + (portions.Sidokumpul?.kecil || 0);
    return 265;
  };

  const newDocsCreated: any[] = [];
  const nowTs = Date.now();
  const uploader = loggedInUserEmail || 'admin@sppg.com';

  // 1. Generate BAST
  const hasBast = currentDocs.some(d => d.type === 'serah_terima' && d.date === selectedDate);
  if (!hasBast) {
    schools.forEach((sch, idx) => {
      const abbrev = generateAbbrev(sch);
      const bastNoStr = `${day}/${abbrev}/BAST/MBGQOM/${month}/${year}`;
      newDocsCreated.push({
        id: `bast-${selectedDate}-${idx}-${nowTs}`,
        type: 'serah_terima',
        date: selectedDate,
        vehicleNumber: 'W 8006 EG',
        imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=500&auto=format&fit=crop&q=80',
        comments: `Dokumen serah terima makanan bergizi untuk ${sch}.`,
        uploadedBy: uploader,
        uploadedAt: new Date().toISOString(),
        receiverName: getRecipientName(sch),
        status: 'Aktif',
        bastNo: bastNoStr,
        bastDriver: 'Ahmad Maghfur',
        bastSekolah: sch,
        bastPenerima: getRecipientName(sch),
        bastBarang: 'PAKET PROGRAM MAKAN BERGIZI GRATIS',
        bastJumlah: getPortionCount(sch),
        bastWaktu: getDefaultReceiptTime(sch),
        bastSignatureDriver: '',
        bastSignatureReceiver: ''
      });
    });
  }

  // 2. Generate Surat Jalan
  const hasSj = currentDocs.some(d => d.type === 'surat_jalan' && d.date === selectedDate);
  if (!hasSj) {
    schools.forEach((sch, idx) => {
      const abbrev = generateAbbrev(sch);
      const sjNoStr = `${day}/${abbrev}/SJ/MBGQOM/${month}/${year}`;
      const tot = getPortionCount(sch);
      let sjRows = [];
      if (sch.includes('Desa')) {
        let b = 0, k = 0;
        if (sch.includes('Sukowati')) { b = portions.Sukowati?.besar || 0; k = portions.Sukowati?.kecil || 0; }
        if (sch.includes('Sidokumpul')) { b = portions.Sidokumpul?.besar || 0; k = portions.Sidokumpul?.kecil || 0; }
        sjRows = [
          { id: '1', jenis: 'Porsi Kecil', porsi: k, alatSebelum: k, alatSesudah: k, keterangan: 'Hangat & Lengkap' },
          { id: '2', jenis: 'Porsi Besar', porsi: b, alatSebelum: b, alatSesudah: b, keterangan: 'Hangat & Lengkap' },
          { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: tot, alatSebelum: 0, alatSesudah: 0, keterangan: 'Karton Utuh' }
        ];
      } else {
        let g = 0, s = 0;
        if (sch.includes('MA')) { g = portions.MA?.guru || 0; s = portions.MA?.siswa || 0; }
        if (sch.includes('MTS')) { g = portions["MTS II"]?.guru || 0; s = portions["MTS II"]?.siswa || 0; }
        if (sch.includes('SMA')) { g = portions.SMA?.guru || 0; s = portions.SMA?.siswa || 0; }
        if (sch.includes('SMK')) { g = portions.SMK?.guru || 0; s = portions.SMK?.siswa || 0; }
        sjRows = [
          { id: '1', jenis: 'Porsi Guru / Pendamping', porsi: g, alatSebelum: g, alatSesudah: g, keterangan: 'Hangat & Lengkap' },
          { id: '2', jenis: 'Porsi Siswa / Penerima', porsi: s, alatSebelum: s, alatSesudah: s, keterangan: 'Hangat & Lengkap' },
          { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: tot, alatSebelum: 0, alatSesudah: 0, keterangan: 'Karton Utuh' }
        ];
      }

      newDocsCreated.push({
        id: `sj-${selectedDate}-${idx}-${nowTs}`,
        type: 'surat_jalan',
        date: selectedDate,
        vehicleNumber: 'W 8006 EG',
        imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
        comments: `Dokumen surat jalan pengiriman logistik untuk ${sch}.`,
        uploadedBy: uploader,
        uploadedAt: new Date().toISOString(),
        receiverName: getRecipientName(sch),
        status: 'Aktif',
        sjNo: sjNoStr,
        sjKepada: sch,
        sjWaktu: getDefaultReceiptTime(sch),
        sjDriver: 'Ahmad Maghfur',
        sjRows,
        sjSignatureAslap: '',
        sjSignatureReceiver: ''
      });
    });
  }

  // 3. Generate Organoleptik
  const hasOrlep = currentDocs.some(d => d.type === 'organoleptik' && d.date === selectedDate);
  if (!hasOrlep) {
    schools.forEach((sch, idx) => {
      newDocsCreated.push({
        id: `orlep-${selectedDate}-${idx}-${nowTs}`,
        type: 'organoleptik',
        date: selectedDate,
        vehicleNumber: 'W 1234 BGH',
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
        comments: `Hasil uji kelayakan sensorik rasa dan suhu CCP hidangan gizi untuk ${sch}.`,
        uploadedBy: uploader,
        uploadedAt: new Date().toISOString(),
        receiverName: getRecipientName(sch),
        status: 'Aktif',
        orlepJam: getDefaultReceiptTime(sch),
        orlepPanelis: 'Avianti Rahma Dianita',
        orlepDesa: sch,
        orlepMenu: menuStr,
        orlepKritik: 'Suhu hangat terjaga prima, rasa gurih seimbang, hidangan segar layak konsumsi.',
        organoleptikSuhu: '68',
        orlepGrid: {
          MP_rasa: 4, MP_warna: 4, MP_aroma: 4, MP_tekstur: 4,
          LH_rasa: 4, LH_warna: 4, LH_aroma: 4, LH_tekstur: 4,
          LN_rasa: 4, LN_warna: 4, LN_aroma: 4, LN_tekstur: 4,
          SY_rasa: 4, SY_warna: 4, SY_aroma: 4, SY_tekstur: 4,
          B_rasa: 5, B_warna: 5, B_aroma: 5, B_tekstur: 4,
        },
        orlepSignature: ''
      });
    });
  }

  return [...currentDocs, ...newDocsCreated];
}
