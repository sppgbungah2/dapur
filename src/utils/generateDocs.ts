import { PortionConfig, DEFAULT_PORTIONS } from '../components/PortionMasterView';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getRecipientName, getDefaultReceiptTime, generateAbbrev } from './docHelpers';
import { buildBastComment, buildSuratJalanRows, getActiveDeliveryTargets, getDeliveryDetails } from './deliveryMaster';

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
  loggedInUserEmail: string,
  targetType?: 'surat_jalan' | 'serah_terima' | 'organoleptik'
): Promise<any[]> {
  const portions = await fetchPortionsForDate(selectedDate);
  
  const dateParts = selectedDate.split('-');
  const year = dateParts[0] || '2026';
  const month = dateParts[1] || '07';
  const day = dateParts[2] || '19';

  // Hanya lokasi yang mempunyai PM pada tanggal ini yang perlu dibuatkan berkas.
  const schools = getActiveDeliveryTargets(portions);

  const newDocsCreated: any[] = [];
  const nowTs = Date.now();
  const uploader = loggedInUserEmail || 'admin@sppg.com';

  // 1. Generate BAST
  if (!targetType || targetType === 'serah_terima') {
    const hasBast = currentDocs.some(d => d.type === 'serah_terima' && d.date === selectedDate);
    if (!hasBast) {
      schools.forEach((sch, idx) => {
        const abbrev = generateAbbrev(sch);
        const bastNoStr = `${day}/${abbrev}/BAST/MBGQOM/${month}/${year}`;
        const details = getDeliveryDetails(sch, portions);
        newDocsCreated.push({
          id: `bast-${selectedDate}-${idx}-${nowTs}`,
          type: 'serah_terima',
          date: selectedDate,
          vehicleNumber: details.vehicleNumber,
          imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=500&auto=format&fit=crop&q=80',
          comments: buildBastComment(sch, portions, menuStr.split(',').map(item => item.trim())),
          uploadedBy: uploader,
          uploadedAt: new Date().toISOString(),
          receiverName: details.recipient,
          status: 'Aktif',
          bastNo: bastNoStr,
          bastDriver: details.driver,
          bastSekolah: sch,
          bastPenerima: details.recipient,
          bastBarang: 'PAKET PROGRAM MAKAN BERGIZI GRATIS',
          bastJumlah: details.total,
          bastWaktu: details.time,
          bastSignatureDriver: '',
          bastSignatureReceiver: ''
        });
      });
    }
  }

  // 2. Generate Surat Jalan
  if (!targetType || targetType === 'surat_jalan') {
    const hasSj = currentDocs.some(d => d.type === 'surat_jalan' && d.date === selectedDate);
    if (!hasSj) {
      schools.forEach((sch, idx) => {
        const abbrev = generateAbbrev(sch);
        const sjNoStr = `${day}/${abbrev}/SJ/MBGQOM/${month}/${year}`;
        const details = getDeliveryDetails(sch, portions);
        const sjRows = buildSuratJalanRows(sch, portions);
        newDocsCreated.push({
          id: `sj-${selectedDate}-${idx}-${nowTs}`,
          type: 'surat_jalan',
          date: selectedDate,
          vehicleNumber: details.vehicleNumber,
          imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
          comments: `Dokumen surat jalan pengiriman logistik untuk ${sch}.`,
          uploadedBy: uploader,
          uploadedAt: new Date().toISOString(),
          receiverName: details.recipient,
          status: 'Aktif',
          sjNo: sjNoStr,
          sjKepada: sch,
          sjWaktu: details.time,
          sjDriver: details.driver,
          sjRows,
          sjSignatureAslap: '',
          sjSignatureReceiver: ''
        });
      });
    }
  }

  // 3. Generate Organoleptik
  if (!targetType || targetType === 'organoleptik') {
    const hasOrlep = currentDocs.some(d => d.type === 'organoleptik' && d.date === selectedDate);
    if (!hasOrlep) {
      schools.forEach((sch, idx) => {
        const details = getDeliveryDetails(sch, portions);
        newDocsCreated.push({
          id: `orlep-${selectedDate}-${idx}-${nowTs}`,
          type: 'organoleptik',
          date: selectedDate,
          vehicleNumber: details.vehicleNumber,
          imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
          comments: `Hasil uji kelayakan sensorik rasa dan suhu CCP hidangan gizi untuk ${sch}.`,
          uploadedBy: uploader,
          uploadedAt: new Date().toISOString(),
          receiverName: details.recipient,
          status: 'Aktif',
          orlepJam: details.time,
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
  }

  return [...currentDocs, ...newDocsCreated];
}

export function updateExistingDocsWithPortions(currentDocs: any[], date: string, portions: PortionConfig, menuList: string[] = []): any[] {
  const getPortionCount = (schName: string) => {
    if (!schName) return 0;
    if (schName.includes("MA")) return (portions.MA?.guru || 0) + (portions.MA?.siswa || 0);
    if (schName.includes("MTS")) return (portions["MTS II"]?.guru || 0) + (portions["MTS II"]?.siswa || 0);
    if (schName.includes("SMA")) return (portions.SMA?.guru || 0) + (portions.SMA?.siswa || 0);
    if (schName.includes("SMK")) return (portions.SMK?.guru || 0) + (portions.SMK?.siswa || 0);
    if (schName.includes("Sukowati")) return (portions.Sukowati?.besar || 0) + (portions.Sukowati?.kecil || 0);
    if (schName.includes("Sidokumpul")) return (portions.Sidokumpul?.besar || 0) + (portions.Sidokumpul?.kecil || 0);
    return 0;
  };

  return currentDocs.map(doc => {
    if (doc.date !== date) return doc;

    const sch = doc.bastSekolah || doc.sjKepada || doc.receiverName || '';

    if (doc.type === 'serah_terima') {
      const details = getDeliveryDetails(sch, portions);
      return {
        ...doc,
        vehicleNumber: details.vehicleNumber || doc.vehicleNumber,
        receiverName: details.recipient || doc.receiverName,
        bastDriver: details.driver || doc.bastDriver,
        bastPenerima: details.recipient || doc.bastPenerima,
        bastJumlah: details.total,
        bastWaktu: details.time || doc.bastWaktu,
        comments: buildBastComment(sch, portions, menuList)
      };
    }

    if (doc.type === 'surat_jalan') {
      const details = getDeliveryDetails(sch, portions);
      return {
        ...doc,
        vehicleNumber: details.vehicleNumber || doc.vehicleNumber,
        receiverName: details.recipient || doc.receiverName,
        sjDriver: details.driver || doc.sjDriver,
        sjWaktu: details.time || doc.sjWaktu,
        sjRows: buildSuratJalanRows(sch, portions)
      };
    }

    if (doc.type === 'organoleptik') {
      const details = getDeliveryDetails(sch, portions);
      return {
        ...doc,
        vehicleNumber: details.vehicleNumber || doc.vehicleNumber,
        receiverName: details.recipient || doc.receiverName,
        orlepJam: details.time || doc.orlepJam,
        orlepMenu: menuList.length ? menuList.join(', ') : doc.orlepMenu
      };
    }

    return doc;
  });
}
