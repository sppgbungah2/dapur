import { Division, DayMenu, TaskItem, UserRole } from './types';

// Preset Menus
export const PRESET_MENUS: DayMenu[] = [
  {
    date: '2026-06-15', // Senin
    menuList: ['Nasi Putih', 'Ayam Geprek Sambal Korek', 'Tumis Kangkung Belacan', 'Khrupuk Udang', 'Pisang Ambon'],
    createdAt: '2026-06-14T08:00:00Z',
    createdBy: 'Ahli Gizi (Avianti Rahma Dianita)'
  },
  {
    date: '2026-06-16', // Selasa (Matches the attachment example!)
    menuList: ['Nasi Putih', 'Krawu Ayam Bungah', 'Tempe Goreng Ketumbar', 'Kupasan Timun Segar', 'Sambal Serundeng Kelapa', 'Pisang'],
    createdAt: '2026-06-15T08:15:00Z',
    createdBy: 'Ahli Gizi (Avianti Rahma Dianita)'
  },
  {
    date: '2026-06-17', // Rabu
    menuList: ['Nasi Gurih', 'Soto Ayam Lamongan', 'Telur Asin Madura', 'Krupuk Bawang', 'Jeruk Manis'],
    createdAt: '2026-06-16T09:00:00Z',
    createdBy: 'Ahli Gizi (Avianti Rahma Dianita)'
  },
  {
    date: '2026-06-18', // Kamis
    menuList: ['Nasi Putih', 'Rawon Daging Sapi Pepesan', 'Mendol Tempe', 'Kecambah Segar & Jeruk Nipis', 'Semangka Merah'],
    createdAt: '2026-06-17T07:45:00Z',
    createdBy: 'Ahli Gizi (Avianti Rahma Dianita)'
  },
  {
    date: '2026-06-19', // Jumat
    menuList: ['Nasi Putih', 'Gulai Ikan Bandeng', 'Sayur Bobor Bayam Labu', 'Tahu Goreng Tepung', 'Melon Segar'],
    createdAt: '2026-06-18T10:30:00Z',
    createdBy: 'Ahli Gizi (Avianti Rahma Dianita)'
  }
];

// Map of who compiles SOP for each division
export const DIVISION_CREATOR_MAP: Record<Division, { role: UserRole; label: string }> = {
  [Division.STOCKING]: { role: UserRole.CHEF, label: 'Head Chef' },
  [Division.MASAK]: { role: UserRole.CHEF, label: 'Head Chef' },
  [Division.PEMORSIAN]: { role: UserRole.AHLI_GIZI, label: 'Ahli Gizi' },
  [Division.DRIVER]: { role: UserRole.ASLAP, label: 'Aslap (Asisten Lapangan)' },
  [Division.CUCI]: { role: UserRole.ASLAP, label: 'Aslap (Asisten Lapangan)' },
  [Division.KEBERSIHAN]: { role: UserRole.ASLAP, label: 'Aslap (Asisten Lapangan)' },
  [Division.KEAMANAN]: { role: UserRole.ASLAP, label: 'Aslap (Asisten Lapangan)' }
};

// Helper to normalize any format of menuList (string[], JSON string, comma string, array of objects) safely into string[]
export function normalizeMenuList(rawMenuList: any): string[] {
  if (!rawMenuList) return [];
  if (Array.isArray(rawMenuList)) {
    return rawMenuList
      .map(item => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return String(item.name || item.text || item.item || item.label || item.dish || JSON.stringify(item)).trim();
        }
        return String(item || '').trim();
      })
      .filter(Boolean);
  }
  if (typeof rawMenuList === 'string') {
    const trimmed = rawMenuList.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeMenuList(parsed);
        }
      } catch (_) {}
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// Generates lists of default tasks for a division, potentially customizing items based on menu list
export function getDefaultTasksForDivision(division: Division, rawMenuList: any): TaskItem[] {
  const menuList = normalizeMenuList(rawMenuList);
  const tasks: TaskItem[] = [];

  switch (division) {
    case Division.CUCI:
      // Tim Cuci
      tasks.push(
        // Persiapan
        { id: `${division}-prep-1`, text: 'Hadir tepat waktu sesuai dengan jadwal yang telah ditentukan dan melakukan absensi.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-2`, text: 'Mengikuti doa bersama dan briefing sebelum bekerja yang dipimpin oleh Koordinator.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-3`, text: 'Melakukan sanitasi perorangan secara disiplin (memastikan tubuh tidak dalam kondisi sakit menular, mencuci tangan, menjaga kuku tetap pendek dan bersih, serta terbebas dari bau asap rokok).', completed: false, category: 'persiapan' },
        { id: `${division}-prep-4`, text: 'Memakai Alat Pelindung Diri (APD) secara lengkap (masker, hairnet, dan sarung tangan) dalam proses pencucian.', completed: false, category: 'persiapan' },

        // Aktif
        { id: `${division}-act-1`, text: 'Buang dan pisahkan seluruh sisa makanan dari ompreng ke dalam kantong plastik (trash bag) yang berbeda: makanan pokok, lauk hewani, lauk nabati, sayur, buah, dst. Jangan menyisakan limbah padat di dalam.', completed: false, category: 'aktif' },
        { id: `${division}-act-2`, text: 'Timbang dan catat sisa makanan masing-masing: makanan pokok, lauk hewani, lauk nabati, sayur, buah, dst.', completed: false, category: 'aktif' },
        { id: `${division}-act-3`, text: 'Bilas ompreng dengan air mengalir guna merontokkan bumbu, minyak, dan sisa makanan kasar yang menempel.', completed: false, category: 'aktif' },
        { id: `${division}-act-4`, text: 'Cuci seluruh permukaan ompreng (dalam, luar, celah / sekat) menggunakan spons dan cairan sabun. Gunakan sabut jika ada noda membandel.', completed: false, category: 'aktif' },
        { id: `${division}-act-5`, text: 'Bilas ompreng hingga benar-benar bersih dari busa sabun di bawah air mengalir. Pastikan ompreng tidak licin / masih berlemak.', completed: false, category: 'aktif' },
        { id: `${division}-act-6`, text: 'Sterilkan ompreng dengan cara merendam ompreng dengan air panas pada suhu minimal 80°C selama 1-2 menit atau masukkan ke dalam kabinet sterilizer dengan siklus suhu tinggi.', completed: false, category: 'aktif' },
        { id: `${division}-act-7`, text: 'Tiriskan ompreng pada rak peniris bertingkat secara terbalik / miring di area bersih yang memiliki sirkulasi udara baik. Jika menggunakan lap, pastikan kain lap steril dan ganti secara berkala.', completed: false, category: 'aktif' },
        { id: `${division}-act-8`, text: 'Sebelum disimpan, pastikan ompreng tidak berbau sabun/amis, tidak ada bercak air/minyak, dan tidak ada bau langu.', completed: false, category: 'aktif' },
        { id: `${division}-act-9`, text: 'Simpan ompreng yang sudah benar-benar kering.', completed: false, category: 'aktif' },
        { id: `${division}-act-10`, text: 'Dilarang menumpuk ompreng yang masih dalam kondisi basah atau lembab, karena akan memicu munculnya bau apek, jamur, dan bakteri.', completed: false, category: 'aktif' },

        // Penutup
        { id: `${division}-close-1`, text: 'Membersihkan seluruh peralatan kerja (mencuci dan mengeringkan alat seperti lap, keranjang, troli, dan peralatan lainnya hingga benar-benar bersih dan kering).', completed: false, category: 'penutup' },
        { id: `${division}-close-2`, text: 'Membersihkan seluruh area kerja Tim Cuci (termasuk halaman, wastafel, lantai, dan bak cuci) segera setelah menyelesaikan pekerjaan.', completed: false, category: 'penutup' },
        { id: `${division}-close-3`, text: 'Mengembalikan seluruh peralatan yang telah dipakai ke tempat penyimpanan semula.', completed: false, category: 'penutup' },
        { id: `${division}-close-4`, text: 'Koordinator memastikan seluruh dapur dalam keadaan bersih dan aman (kompor/gas mati, kran air tertutup).', completed: false, category: 'penutup' },
        { id: `${division}-close-5`, text: 'Mengikuti doa bersama yang dipimpin oleh Koordinator sebelum mengakhiri kerja dan melakukan absen pulang.', completed: false, category: 'penutup' }
      );
      break;

    case Division.PEMORSIAN:
      // Tim Pemorsian
      tasks.push(
        // Persiapan
        { id: `${division}-prep-1`, text: 'Menghadiri pekerjaan sesuai dengan jadwal yang telah ditentukan dan melakukan absensi.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-2`, text: 'Mengikuti doa bersama dan briefing sebelum bekerja yang dipimpin oleh Koordinator.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-3`, text: 'Melakukan sanitasi perorangan secara disiplin (memastikan tubuh tidak dalam kondisi sakit menular, mencuci tangan, menjaga kuku tetap pendek dan bersih, serta terbebas dari bau asap rokok).', completed: false, category: 'persiapan' },
        { id: `${division}-prep-4`, text: 'Mensterilkan permukaan meja kerja dengan cairan sanitasi yang sesuai sebelum memulai operasional.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-5`, text: 'Memeriksa dan memastikan bahwa seluruh ompreng benar-benar kering, bersih, serta bebas dari segala bentuk sisa makanan atau kotoran.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-6`, text: 'Memporsikan makanan dengan menerapkan sistem First In First Out (FIFO).', completed: false, category: 'persiapan' },
        { id: `${division}-prep-7`, text: 'Memakai Alat Pelindung Diri (APD) secara lengkap (masker, hairnet, dan sarung tangan) dalam proses memporsikan makanan.', completed: false, category: 'persiapan' },

        // Aktif
        { id: `${division}-act-1`, text: 'Melakukan pengambilan sampel timbangan secara acak (sampling) untuk memastikan berat porsi seragam, di bawah pengawasan langsung dari Pengawas Gizi.', completed: false, category: 'aktif' },
        { id: `${division}-act-2`, text: 'Memastikan seluruh komponen makanan (kondimen) lengkap dan tidak ada yang terlewat sebelum kemasan ditutup.', completed: false, category: 'aktif' },
        { id: `${division}-act-3`, text: 'Melakukan proses serah terima ompreng kepada Tim Pengiriman (delivery) dengan wajib menerapkan sistem First In First Out (FIFO).', completed: false, category: 'aktif' },
        { id: `${division}-act-4`, text: 'Menghitung total box ompreng yang siap didistribusikan dan melaporkan ke Pengawas Gizi.', completed: false, category: 'aktif' },

        // Penutup
        { id: `${division}-close-1`, text: 'Membersihkan segera seluruh peralatan kerja (mencuci dan mengeringkan alat seperti baskom, lengser, keranjang, troli, dan peralatan lainnya hingga benar-benar kering).', completed: false, category: 'penutup' },
        { id: `${division}-close-2`, text: 'Membersihkan seluruh area kerja tim pemorsian (termasuk meja, lantai, rak, dan bak cuci) segera setelah menyelesaikan pekerjaan.', completed: false, category: 'penutup' },
        { id: `${division}-close-3`, text: 'Mengembalikan seluruh peralatan yang telah dibersihkan ke tempat penyimpanan semula.', completed: false, category: 'penutup' },
        { id: `${division}-close-4`, text: 'Koordinator memastikan seluruh area pemorsian dalam keadaan bersih serta mematikan seluruh fasilitas elektronik seperti kipas angin dan AC setelah operasional selesai.', completed: false, category: 'penutup' },
        { id: `${division}-close-5`, text: 'Mengikuti doa bersama yang dipimpin oleh Koordinator sebelum mengakhiri kerja dan melakukan absen pulang.', completed: false, category: 'penutup' }
      );
      break;

    case Division.MASAK:
      // Tim Pengolahan (Masak)
      tasks.push(
        // Persiapan
        { id: `${division}-prep-1`, text: 'Menghadiri pekerjaan sesuai dengan jadwal yang telah ditentukan dan melakukan absensi.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-2`, text: 'Mengikuti doa bersama dan briefing sebelum bekerja yang dipimpin oleh Koordinator.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-3`, text: 'Melakukan sanitasi perorangan secara disiplin (memastikan tubuh tidak dalam kondisi sakit menular, mencuci tangan, menjaga kuku tetap pendek dan bersih, serta terbebas dari bau asap rokok).', completed: false, category: 'persiapan' },
        { id: `${division}-prep-4`, text: 'Memastikan Koordinator telah mengecek bahan-bahan yang dibutuhkan dan menerapkan sistem First In First Out (FIFO) serta sistem First Expired First Out (FEFO).', completed: false, category: 'persiapan' },
        { id: `${division}-prep-5`, text: 'Memakai Alat Pelindung Diri (APD) secara lengkap (masker, hairnet, dan sarung tangan) dalam proses pengolahan bahan makanan.', completed: false, category: 'persiapan' }
      );

      // Aktif (Dynamic based on menus)
      tasks.push(
        { id: `${division}-act-1`, text: `Merebus kuah kaldu utama atau menanak dan mengukus nasi putih sejumlah porsi gizi santri (Menu: ${menuList.join(', ')}).`, completed: false, category: 'aktif' }
      );
      if (menuList.some(m => m.toLowerCase().includes('ayam'))) {
        tasks.push(
          { id: `${division}-act-2`, text: 'Menggoreng atau menumis protein ayam hingga matang merata di suhu minimal 75°C.', completed: false, category: 'aktif' }
        );
      }
      if (menuList.some(m => m.toLowerCase().includes('tempe') || m.toLowerCase().includes('tahu'))) {
        tasks.push(
          { id: `${division}-act-3`, text: 'Melakukan marinasi tempe/tahu dengan bumbu ketumbar bawang lalu goreng deep-fry hingga kuning keemasan.', completed: false, category: 'aktif' }
        );
      }
      tasks.push(
        { id: `${division}-act-4`, text: 'Memasak lauk pelengkap tumis sayuran (durasi tidak overcooked agar vitamin terjaga).', completed: false, category: 'aktif' },
        { id: `${division}-act-5`, text: 'Membuat sambal serundeng atau sambal goreng penyetan khas, cicipi kesesuaian rasa gizi.', completed: false, category: 'aktif' },
        { id: `${division}-act-6`, text: 'Melakukan pengetesan organoleptik (Rasa, Bau, Tekstur) sebelum masakan dipindahkan ke tempat pemorsian.', completed: false, category: 'aktif' }
      );

      // Penutup
      tasks.push(
        { id: `${division}-close-1`, text: 'Membersihkan seluruh peralatan kerja (mencuci dan mengeringkan alat seperti baskom, lengser, keranjang, troli, dan peralatan lainnya hingga benar-benar kering).', completed: false, category: 'penutup' },
        { id: `${division}-close-2`, text: 'Membersihkan seluruh area kerja Tim Pengolahan (termasuk meja, kompor, steamer, lantai, rak, dan bak cuci) segera setelah menyelesaikan pekerjaan.', completed: false, category: 'penutup' },
        { id: `${division}-close-3`, text: 'Mengembalikan seluruh peralatan yang telah dibersihkan ke tempat penyimpanan semula.', completed: false, category: 'penutup' },
        { id: `${division}-close-4`, text: 'Koordinator memastikan seluruh dapur dalam keadaan bersih dan aman (kompor/gas mati, kran air tertutup).', completed: false, category: 'penutup' },
        { id: `${division}-close-5`, text: 'Mengikuti doa bersama yang dipimpin oleh Koordinator sebelum mengakhiri kerja dan melakukan absen pulang.', completed: false, category: 'penutup' }
      );
      break;

    case Division.STOCKING:
      // Tim Persiapan (Stocking)
      tasks.push(
        // Persiapan
        { id: `${division}-prep-1`, text: 'Hadir tepat waktu sesuai dengan jadwal yang telah ditentukan dan melakukan absensi.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-2`, text: 'Mengikuti doa bersama dan briefing sebelum bekerja yang dipimpin oleh Koordinator.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-3`, text: 'Melakukan sanitasi perorangan secara disiplin (memastikan tubuh tidak dalam kondisi sakit menular, mencuci tangan, menjaga kuku tetap pendek dan bersih, serta terbebas dari bau asap rokok).', completed: false, category: 'persiapan' },
        { id: `${division}-prep-4`, text: 'Memastikan Koordinator telah mengecek bahan-bahan yang dibutuhkan dan menerapkan sistem First In First Out (FIFO) serta sistem First Expired First Out (FEFO).', completed: false, category: 'persiapan' },
        { id: `${division}-prep-5`, text: 'Menerima bahan baku dengan teliti serta mengecek kualitas dan kuantitas bahan baku yang diterima secara seksama.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-6`, text: 'Menyortir kelayakan buah sesuai dengan standar kualitas yang ditetapkan.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-7`, text: 'Segera melaporkan apabila terdapat kekurangan atau ketidaklayakan buah dan bahan baku.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-8`, text: 'Memakai Alat Pelindung Diri (APD) secara lengkap (masker, hairnet, dan sarung tangan) dalam proses mempersiapkan bahan-bahan.', completed: false, category: 'persiapan' }
      );

      // Aktif
      tasks.push(
        { id: `${division}-act-1`, text: `Menerima dan memeriksa kesegaran serta kelayakan bahan menu: ${menuList.join(', ')}.`, completed: false, category: 'aktif' }
      );
      if (menuList.some(m => m.toLowerCase().includes('ayam'))) {
        tasks.push(
          { id: `${division}-act-2`, text: 'Mencuci Ayam bersih, potong, kemudian direbus dengan garam, daun salam, dan jeruk purut.', completed: false, category: 'aktif' },
          { id: `${division}-act-3`, text: 'Mengupas bumbu rempah: Bawang putih, bawang merah, jahe, lengkuas, kunyit sesuai resep porsi.', completed: false, category: 'aktif' }
        );
      } else {
        tasks.push(
          { id: `${division}-act-2`, text: 'Mengupas dan memotong bumbu rempah mentah (bawang merah, bawang putih, cabai, jahe, lengkuas).', completed: false, category: 'aktif' }
        );
      }
      tasks.push(
        { id: `${division}-act-4`, text: 'Membersihkan cabai merah besar, buang bijinya setengah untuk mengontrol tingkat pedas santri.', completed: false, category: 'aktif' },
        { id: `${division}-act-5`, text: 'Memblender bumbu halus dasar (merah/putih/kuning) sesuai takaran gramasi timbangan gizi.', completed: false, category: 'aktif' },
        { id: `${division}-act-6`, text: 'Menyiapkan bahan pelengkap pendukung (seperti krupuk, timun iris, atau buah pisang) di wadah bersih.', completed: false, category: 'aktif' }
      );

      // Penutup
      tasks.push(
        { id: `${division}-close-1`, text: 'Membersihkan seluruh peralatan kerja (mencuci dan mengeringkan alat seperti baskom, lengser, keranjang, troli, dan peralatan lainnya hingga benar-benar kering).', completed: false, category: 'penutup' },
        { id: `${division}-close-2`, text: 'Membersihkan seluruh area kerja Tim Persiapan (termasuk meja, lantai, rak, dan bak cuci) segera setelah menyelesaikan pekerjaan.', completed: false, category: 'penutup' },
        { id: `${division}-close-3`, text: 'Mengembalikan seluruh peralatan yang telah dibersihkan ke tempat penyimpanan semula.', completed: false, category: 'penutup' },
        { id: `${division}-close-4`, text: 'Koordinator memastikan seluruh dapur dalam keadaan bersih dan aman (kompor/gas mati, kran air tertutup).', completed: false, category: 'penutup' },
        { id: `${division}-close-5`, text: 'Mengikuti doa bersama yang dipimpin oleh Koordinator sebelum mengakhiri kerja dan melakukan absen pulang.', completed: false, category: 'penutup' }
      );
      break;

    case Division.KEAMANAN:
      // Tim Keamanan
      tasks.push(
        // Persiapan
        { id: `${division}-prep-1`, text: 'Hadir tepat waktu sesuai dengan jadwal yang telah ditentukan dan melakukan absensi.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-2`, text: 'Mengikuti doa bersama dan briefing sebelum bekerja.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-3`, text: 'Melakukan sanitasi perorangan secara disiplin (memastikan tubuh tidak dalam kondisi sakit menular, mencuci tangan, menjaga kuku tetap pendek dan bersih, serta terbebas dari bau asap rokok).', completed: false, category: 'persiapan' },

        // Aktif
        { id: `${division}-act-1`, text: 'Memeriksa kebersihan dan kelayakan instalasi pipa gas elpiji 50 kg, mencium apakah ada indikasi kebocoran.', completed: false, category: 'aktif' },
        { id: `${division}-act-2`, text: 'Memastikan Alat Pemadam Api Ringan (APAR) di area dapur tidak kadaluarsa dan gampang dijangkau.', completed: false, category: 'aktif' },
        { id: `${division}-act-3`, text: 'Patroli berkala mengelilingi pintu genset dan panel listrik utama pengatur daya pendingin cold storage.', completed: false, category: 'aktif' },
        { id: `${division}-act-4`, text: 'Security wajib bersiaga di pintu masuk/akses utama area produksi selama jam operasional yang ditentukan.', completed: false, category: 'aktif' },
        { id: `${division}-act-5`, text: 'Security wajib melakukan pemeriksaan dan tegas melarang masuk individu yang tidak berkepentingan, karyawan yang tidak memiliki jadwal (off-duty), dan individu yang menunjukkan gejala sakit menular (seperti batuk, demam, flu, dll).', completed: false, category: 'aktif' },
        { id: `${division}-act-6`, text: 'Security wajib mengarahkan tamu untuk mengisi Buku Tamu / Visitor Log secara lengkap (Nama, instansi, keperluan, jam masuk, tanda tangan) serta memeriksa kartu identitas untuk ditukar dengan Visitor Badge.', completed: false, category: 'aktif' },
        { id: `${division}-act-7`, text: 'Security wajib memastikan setiap tamu yang telah mendapatkan izin masuk untuk mengenakan APD khusus tamu sesuai regulasi K3 yang berlaku (seperti safety shoes/shoe cover, masker, dan hairnet) dan dilarang keras meloloskan tamu ke area produksi jika APD belum terpasang dengan lengkap dan benar.', completed: false, category: 'aktif' },
        { id: `${division}-act-8`, text: 'Jika ada tamu mendadak, Security wajib menghubungi Kepala terlebih dahulu untuk meminta konfirmasi izin masuk.', completed: false, category: 'aktif' },
        { id: `${division}-act-9`, text: 'Lakukan pemeriksaan tas/barang bawaan tamu saat masuk dan keluar area produksi untuk mencegah kontaminasi atau kehilangan aset.', completed: false, category: 'aktif' },
        { id: `${division}-act-10`, text: 'Lakukan patroli/pengecekan berkala pada sistem penguncian pintu untuk menghindari adanya pintu yang diganjal atau terbuka tanpa pengawasan.', completed: false, category: 'aktif' },
        { id: `${division}-act-11`, text: 'Lakukan pemeriksaan tas/barang bawaan karyawan saat masuk dan keluar area produksi untuk mencegah kontaminasi atau kehilangan aset.', completed: false, category: 'aktif' },

        // Penutup
        { id: `${division}-close-1`, text: 'Memastikan seluruh sistem pendingin dan sirkulasi udara (AC, kipas angin, dan blower) telah dimatikan.', completed: false, category: 'penutup' },
        { id: `${division}-close-2`, text: 'Memastikan seluruh lampu ruangan dapur telah dipadamkan sebelum meninggalkan area.', completed: false, category: 'penutup' },
        { id: `${division}-close-3`, text: 'Melakukan serah terima tugas (handover) kepada petugas shift berikutnya.', completed: false, category: 'penutup' },
        { id: `${division}-close-4`, text: 'Memastikan seluruh akses keluar masuk terkunci sebelum meninggalkan pekerjaan.', completed: false, category: 'penutup' }
      );
      break;

    case Division.DRIVER:
      // Tim Driver
      tasks.push(
        // Persiapan
        { id: `${division}-prep-1`, text: 'Menghadiri pekerjaan sesuai dengan jadwal yang telah ditentukan dan melakukan absensi.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-2`, text: 'Mengikuti doa bersama dan briefing sebelum bekerja yang dipimpin oleh Koordinator.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-3`, text: 'Melakukan sanitasi perorangan secara disiplin (memastikan tubuh tidak dalam kondisi sakit menular, mencuci tangan, menjaga kuku tetap pendek dan bersih, serta terbebas dari bau asap rokok).', completed: false, category: 'persiapan' },
        { id: `${division}-prep-4`, text: 'Panaskan mesin mobil terlebih dahulu sebelum beroperasi, serta pastikan kondisi fisik kendaraan dalam keadaan bersih, kering, dan bebas dari bau menyengat maupun kontaminasi bahan kimia.', completed: false, category: 'persiapan' },

        // Aktif
        { id: `${division}-act-1`, text: 'Kendarai kendaraan dengan kecepatan aman yang terkendali serta hindari guncangan keras guna menjaga keamanan muatan dan kenyamanan berkendara.', completed: false, category: 'aktif' },
        { id: `${division}-act-2`, text: 'Wajib mengenakan pakaian yang sopan, rapi, serta menggunakan sepatu tertutup selama menjalankan tugas.', completed: false, category: 'aktif' },
        { id: `${division}-act-3`, text: 'Gunakan Alat Pelindung Diri (APD) secara lengkap (masker, hairnet, dan sarung tangan) sebelum memasuki ruang pemorsian untuk mengangkut ompreng.', completed: false, category: 'aktif' },
        { id: `${division}-act-4`, text: 'Angkut ompreng yang telah diikat rapi dengan tali dari Tim Pemorsian, lalu masukkan dan tata dengan aman ke dalam mobil pengangkut.', completed: false, category: 'aktif' },
        { id: `${division}-act-5`, text: 'Hitung kembali secara teliti jumlah paket makanan bergizi yang dimuat ke dalam kendaraan guna memastikan kesesuaian data.', completed: false, category: 'aktif' },
        { id: `${division}-act-6`, text: 'Pastikan driver membawa surat jalan resmi sebelum melakukan keberangkatan.', completed: false, category: 'aktif' },
        { id: `${division}-act-7`, text: 'Berangkat menuju titik lokasi (sekolah dan desa) yang telah ditentukan dengan rute dan kecepatan aman.', completed: false, category: 'aktif' },
        { id: `${division}-act-8`, text: 'Serahkan ompreng kepada pihak sekolah dan desa, lakukan penghitungan bersama, lalu catat jumlah aktualnya pada surat jalan sebagai bukti serah terima.', completed: false, category: 'aktif' },
        { id: `${division}-act-9`, text: 'Terima dan kumpulkan kembali ompreng kosong dari sekolah dan desa, lakukan penghitungan, lalu catat jumlahnya pada surat jalan.', completed: false, category: 'aktif' },
        { id: `${division}-act-10`, text: 'Kembali ke dapur pusat untuk menyerahkan seluruh ompreng kosong kepada Tim Pencucian guna proses sanitasi berikutnya.', completed: false, category: 'aktif' },

        // Penutup
        { id: `${division}-close-1`, text: 'Membersihkan mobil pengangkut setelah selesai melaksanakan pekerjaan.', completed: false, category: 'penutup' },
        { id: `${division}-close-2`, text: 'Bersihkan dan rapikan kembali area kerja/bongkar muat alat penunjang kerja yang telah digunakan.', completed: false, category: 'penutup' },
        { id: `${division}-close-3`, text: 'Cuci dan bersihkan kendaraan (baik bagian luar maupun kabin/bagasi dalam) secara menyeluruh dari sisa kotoran atau sampah, sehingga kendaraan kembali dalam kondisi higienis dan siap digunakan untuk operasional berikutnya.', completed: false, category: 'penutup' },
        { id: `${division}-close-4`, text: 'Koordinator mengecek kembali kebersihan dan keamanan kendaraan.', completed: false, category: 'penutup' },
        { id: `${division}-close-5`, text: 'Mengikuti doa bersama yang dipimpin oleh Koordinator sebelum mengakhiri kerja dan melakukan absen pulang.', completed: false, category: 'penutup' }
      );
      break;

    case Division.KEBERSIHAN:
      // Tim Kebersihan
      tasks.push(
        // Persiapan
        { id: `${division}-prep-1`, text: 'Hadir tepat waktu sesuai dengan jadwal yang telah ditentukan dan melakukan absensi.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-2`, text: 'Mengikuti doa bersama dan briefing sebelum bekerja.', completed: false, category: 'persiapan' },
        { id: `${division}-prep-3`, text: 'Melakukan sanitasi perorangan secara disiplin (memastikan tubuh tidak dalam kondisi sakit menular, mencuci tangan, menjaga kuku tetap pendek dan bersih, serta terbebas dari bau asap rokok).', completed: false, category: 'persiapan' },

        // Aktif
        { id: `${division}-act-1`, text: 'Menyapu seluruh bagian lantai dapur utama, ruang bahan kering, dan ruang pemorsian.', completed: false, category: 'aktif' },
        { id: `${division}-act-2`, text: 'Mengepel lantai menggunakan cairan karbol desinfektan untuk mematikan kuman dan menghilangkan licin minyak.', completed: false, category: 'aktif' },
        { id: `${division}-act-3`, text: 'Mengelap meja persiapan, meja pemorsian, dan dinding keramik kompor dari cipratan minyak / kuah.', completed: false, category: 'aktif' },
        { id: `${division}-act-4`, text: 'Membuang sampah gizi dari seluruh ruangan dapur ke Tempat Pembuangan Sampah (TPS) Akhir Ponpes.', completed: false, category: 'aktif' },
        { id: `${division}-act-5`, text: 'Membersihkan saringan air got (floor drain) dapur dari sumbatan lemak sisa pencucian piring.', completed: false, category: 'aktif' },

        // Penutup
        { id: `${division}-close-1`, text: 'Memastikan seluruh kran air tertutup rapat dan mesin pompa air dalam keadaan mati.', completed: false, category: 'penutup' },
        { id: `${division}-close-2`, text: 'Melakukan serah terima tugas (handover) kepada petugas shift berikutnya.', completed: false, category: 'penutup' }
      );
      break;
  }

  return tasks;
}

// Generate complete set of SOP Documents for a single day based on menus
export function generateInitialSOPsForDate(date: string, menuList: string[]): Record<string, any>[] {
  const sops: any[] = [];
  
  Object.values(Division).forEach(div => {
    const creatorInfo = DIVISION_CREATOR_MAP[div];
    let creatorName = 'Rizka Aulia';
    if (creatorInfo.role === UserRole.AHLI_GIZI) {
      creatorName = 'Avianti Rahma Dianita';
    } else if (creatorInfo.role === UserRole.ASLAP) {
      creatorName = 'Ahmad Maghfur (Aslap)';
    }

    const defaultTasks = getDefaultTasksForDivision(div, menuList).map((t, idx) => ({
      ...t,
      id: `${date}-${div}-t-${idx}`
    }));

    sops.push({
      id: `${date}-${div}`,
      date,
      division: div,
      creatorRole: creatorInfo.role,
      creatorName,
      tasks: defaultTasks,
      isCheckedAll: false,
      signerSupervisor: creatorName,
      signatureSupervisorUrl: '',
      signedSupervisorAt: null,
      signerCoordinator: `Koordinator ${div.split(' ')[0]}`,
      signatureCoordinatorUrl: '',
      signedCoordinatorAt: null,
      status: 'aktif',
      updatedAt: new Date().toISOString()
    });
  });

  return sops;
}

export function getRecipientName(schoolOrLocation: string): string {
  if (!schoolOrLocation) return '';
  const norm = schoolOrLocation.toLowerCase().trim();
  if (norm.includes('sidokumpul')) return 'Susianti Nengsih';
  if (norm.includes('sukowati')) return 'Nurul Mahmudah';
  if (norm.includes('smk')) return 'Ibu Sumiati';
  if (norm.includes('mts')) return 'Ibu Ina Mariana';
  if (norm.includes('sma')) return 'Ibu Wahyuni';
  if (norm.includes('ma')) return 'Ibu Muslihah';
  return 'Staf Lembaga';
}

export function getDefaultReceiptTime(schoolOrLocation: string): string {
  if (!schoolOrLocation) return '08.00 WIB';
  const norm = schoolOrLocation.toLowerCase().trim();
  if (norm.includes('sidokumpul')) return '07.00 WIB';
  if (norm.includes('sukowati')) return '07.30 WIB';
  if (norm.includes('sma')) return '07.30 WIB';
  if (norm.includes('ma')) return '08.00 WIB';
  if (norm.includes('mts')) return '09.00 WIB';
  if (norm.includes('smk')) return '10.30 WIB';
  return '08.00 WIB';
}

export function parseDateFromSlug(slug: string): string | null {
  if (!slug) return null;
  const s = slug.trim();
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const idMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (idMatch) {
    const d = idMatch[1].padStart(2, '0');
    const m = idMatch[2].padStart(2, '0');
    const y = idMatch[3];
    return `${y}-${m}-${d}`;
  }
  return null;
}

export function formatDateToSlug(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return `${d}-${m}-${y}`;
  }
  return dateStr;
}

export function getTabFromPage(pageName: string): number {
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
  return 23;
}

export function getPageFromTab(tabNum: number): string {
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
}

export function getDivisionFromSlug(slug: string): Division | null {
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
}

export function getSlugFromDivision(div: Division): string {
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
}

export function normalizeDateISO(dateStr: string): string {
  if (!dateStr) return '';
  const parsed = parseDateFromSlug(dateStr);
  if (parsed) return parsed;
  return dateStr.trim();
}

export function getCanonicalSopId(date: string, division: Division | string): string {
  const isoDate = normalizeDateISO(date);
  const norm = (division || '').toString().toLowerCase();
  let divSlug = 'stocking';
  if (norm.includes('driver') || norm.includes('distribusi')) divSlug = 'driver';
  else if (norm.includes('stocking') || norm.includes('persiapan')) divSlug = 'stocking';
  else if (norm.includes('masak') || norm.includes('pemasakan')) divSlug = 'masak';
  else if (norm.includes('pemorsian')) divSlug = 'pemorsian';
  else if (norm.includes('kebersihan')) divSlug = 'kebersihan';
  else if (norm.includes('cuci') || norm.includes('pencucian')) divSlug = 'cuci';
  else if (norm.includes('keamanan') || norm.includes('security')) divSlug = 'keamanan';
  return `SOP-${isoDate}-${divSlug.toUpperCase()}`;
}

export function getSopTaskTableName(div?: Division | string): string {
  const norm = (div || '').toString().toLowerCase().trim();
  if (norm.includes('driver') || norm.includes('distribusi')) return 'sop_tasks_driver';
  if (norm.includes('stocking') || norm.includes('persiapan')) return 'sop_tasks_stocking';
  if (norm.includes('masak') || norm.includes('pemasakan')) return 'sop_tasks_masak';
  if (norm.includes('pemorsian')) return 'sop_tasks_pemorsian';
  if (norm.includes('kebersihan')) return 'sop_tasks_kebersihan';
  if (norm.includes('cuci') || norm.includes('pencucian')) return 'sop_tasks_cuci';
  if (norm.includes('keamanan') || norm.includes('security')) return 'sop_tasks_keamanan';
  return 'sop_tasks_stocking';
}

export function getSopTaskTableNames(div?: Division | string): string[] {
  const primary = getSopTaskTableName(div);
  const singular = primary.replace('sop_tasks_', 'sop_task_');
  return [primary, singular, 'sop_tasks'];
}
