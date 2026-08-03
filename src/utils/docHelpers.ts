export function getRecipientName(sch: string): string {
  if (sch === "MA Assa'adah") return 'Ustadz Jauhari (Kepala MA)';
  if (sch === "MTS Assa'adah II") return 'Ustadz Hakim (Kepala MTS)';
  if (sch === "SMA Assa'adah") return 'Ibu Muslihah (Kepala SMA)';
  if (sch === "SMK Assa'adah") return 'Pak Syaiful (Kepala SMK)';
  if (sch === "Desa Sukowati") return 'Pak Kasun Sukowati';
  if (sch === "Desa Sidokumpul") return 'Ibu Musrifah (Pokja Sidokumpul)';
  return 'Penanggung Jawab Sasaran';
}

export function getDefaultReceiptTime(sch: string): string {
  if (sch === "MA Assa'adah") return '10:00 WIB';
  if (sch === "MTS Assa'adah II") return '10:15 WIB';
  if (sch === "SMA Assa'adah") return '10:30 WIB';
  if (sch === "SMK Assa'adah") return '10:45 WIB';
  if (sch === "Desa Sukowati") return '11:00 WIB';
  if (sch === "Desa Sidokumpul") return '11:15 WIB';
  return '10:30 WIB';
}

export function generateAbbrev(sch: string): string {
  const upper = sch.toUpperCase();
  if (upper.includes('MA')) return 'MA_ASS';
  if (upper.includes('MTS')) return 'MTS_ASS';
  if (upper.includes('SMA')) return 'SMA_ASS';
  if (upper.includes('SMK')) return 'SMK_ASS';
  if (upper.includes('SUKOWATI')) return 'DS_SKW';
  if (upper.includes('SIDOKUMPUL')) return 'DS_SDK';
  return 'LBG';
}

export function createAllInitialShippingDocsForDate(
  selectedDate: string, 
  currentDocs: any[], 
  menuListStr?: string
): any[] {
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

  const newDocsCreated: any[] = [];
  const nowTs = Date.now();

  // 1. Check BAST docs for selectedDate
  const hasBast = currentDocs.some(d => d.type === 'serah_terima' && d.date === selectedDate);
  if (!hasBast) {
    schools.forEach((sch, idx) => {
      const abbrev = generateAbbrev(sch);
      const bastNoStr = `${day}/${abbrev}/BAST/MBGQOM/${month}/${year}`;
      const defaultPenerima = getRecipientName(sch);
      const defaultWaktu = getDefaultReceiptTime(sch);
      let qty = 280;
      if (sch.includes('MTS')) qty = 310;
      if (sch.includes('SMA')) qty = 340;
      if (sch.includes('SMK')) qty = 380;
      if (sch.includes('Sukowati')) qty = 250;
      if (sch.includes('Sidokumpul')) qty = 220;

      newDocsCreated.push({
        id: `bast-${selectedDate}-${idx}-${nowTs}`,
        type: 'serah_terima',
        date: selectedDate,
        vehicleNumber: 'W 1234 BGH',
        imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=500&auto=format&fit=crop&q=80',
        comments: `Dokumen serah terima makanan bergizi untuk ${sch}.`,
        uploadedBy: 'admin@sppg.com',
        uploadedAt: new Date().toISOString(),
        receiverName: defaultPenerima,
        status: 'Aktif',
        bastNo: bastNoStr,
        bastDriver: 'Ahmad Maghfur',
        bastSekolah: sch,
        bastPenerima: defaultPenerima,
        bastBarang: 'PAKET PROGRAM MAKAN BERGIZI GRATIS',
        bastJumlah: qty,
        bastWaktu: defaultWaktu,
        bastSignatureDriver: '',
        bastSignatureReceiver: ''
      });
    });
  }

  // 2. Check Surat Jalan docs for selectedDate
  const hasSj = currentDocs.some(d => d.type === 'surat_jalan' && d.date === selectedDate);
  if (!hasSj) {
    schools.forEach((sch, idx) => {
      const abbrev = generateAbbrev(sch);
      const sjNoStr = `${day}/${abbrev}/SJ/MBGQOM/${month}/${year}`;
      const defaultPenerima = getRecipientName(sch);
      const defaultWaktu = getDefaultReceiptTime(sch);

      let sjRows = [
        { id: '1', jenis: 'Porsi Guru / Pendamping', porsi: 20, alatSebelum: 20, alatSesudah: 20, keterangan: 'Hangat & Lengkap' },
        { id: '2', jenis: 'Porsi Siswa / Penerima', porsi: 260, alatSebelum: 260, alatSesudah: 260, keterangan: 'Hangat & Lengkap' },
        { id: '3', jenis: 'Susu Kotak UHT 125ml', porsi: 280, alatSebelum: 0, alatSesudah: 0, keterangan: 'Karton Utuh' }
      ];

      newDocsCreated.push({
        id: `sj-${selectedDate}-${idx}-${nowTs}`,
        type: 'surat_jalan',
        date: selectedDate,
        vehicleNumber: 'W 8006 EG',
        imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
        comments: `Dokumen surat jalan pengiriman logistik untuk ${sch}.`,
        uploadedBy: 'admin@sppg.com',
        uploadedAt: new Date().toISOString(),
        receiverName: defaultPenerima,
        status: 'Aktif',
        sjNo: sjNoStr,
        sjKepada: sch,
        sjWaktu: defaultWaktu,
        sjDriver: 'Ahmad Maghfur',
        sjRows,
        sjSignatureAslap: '',
        sjSignatureReceiver: ''
      });
    });
  }

  // 3. Check Organoleptik docs for selectedDate
  const hasOrlep = currentDocs.some(d => d.type === 'organoleptik' && d.date === selectedDate);
  if (!hasOrlep) {
    const menuStr = menuListStr || 'Nasi Putih, Ayam Geprek Sambal Korek, Tumis Kangkung, Pisang Ambon';
    schools.forEach((sch, idx) => {
      const defaultPenerima = getRecipientName(sch);
      const defaultWaktu = getDefaultReceiptTime(sch);

      newDocsCreated.push({
        id: `orlep-${selectedDate}-${idx}-${nowTs}`,
        type: 'organoleptik',
        date: selectedDate,
        vehicleNumber: 'W 1234 BGH',
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
        comments: `Hasil uji kelayakan sensorik rasa dan suhu CCP hidangan gizi untuk ${sch}.`,
        uploadedBy: 'ahligizi@sppg.com',
        uploadedAt: new Date().toISOString(),
        receiverName: defaultPenerima,
        status: 'Aktif',
        orlepJam: defaultWaktu,
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

  if (newDocsCreated.length === 0) return currentDocs;
  return [...newDocsCreated, ...currentDocs];
}
