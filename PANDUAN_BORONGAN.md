# Panduan Borongan Dokumen

## Persiapan sekali saja

1. Buka Supabase Dashboard, pilih **SQL Editor**, lalu jalankan isi file `supabase/migrations/20260806_borongan.sql`.
2. Masuk sebagai Administrator dan buka menu sidebar **Borongan**.
3. Tersedia dua template terpisah. Jangan mengubah judul kolomnya.

## 1. Mengisi impor Menu & PM

Satu baris mewakili satu tanggal. Gunakan format tanggal `YYYY-MM-DD`, misalnya `2025-11-01`.

- **Menu**: pisahkan makanan dengan koma.
- Isi semua kolom porsi pada template jika mengimpor porsi, termasuk `Gumeng Besar` dan `Gumeng Kecil`. Nilai boleh `0`; lokasi dengan total PM `0` tidak akan dibuatkan Surat Jalan, BAST, atau Organoleptik.
## 2. Mengisi Master TTD Default

Klik **Unduh Template TTD**. Ini adalah master yang cukup diunggah sekali dan berlaku untuk semua tanggal. Isi Tanggal dengan `MASTER_DEFAULT` agar jelas sebagai master; aplikasi selalu menyimpannya sebagai Master Default dan tidak membuat TTD per tanggal.

- **SOP:** 7 divisi × dua peran sesuai dokumen: Stocking = `Aslap` + `Koordinator`; Masak = `Chef` + `Koordinator`; Pemorsian = `Ahli Gizi` + `Koordinator`; Driver, Cuci, Kebersihan, dan Keamanan = `Aslap` + `Koordinator`.
- **BAST:** tujuh lokasi × `Driver` dan `Penerima`.
- **Surat Jalan:** tujuh lokasi × `Aslap` dan `Penerima`.
- **Organoleptik:** tujuh lokasi × `Panelis`.

Kolom Nama dan URL TTD wajib terisi. URL harus menuju gambar tanda tangan yang dapat dibuka browser.

Jika satu Aslap atau Driver yang sama berlaku untuk semua lokasi, Anda dapat mengisi satu baris dengan Target/Divisi `Semua Lokasi`; sistem akan menggunakannya sebagai TTD bersama. TTD Penerima tetap harus ada untuk setiap lokasi.

## Proses kerja

1. Unggah berkas **Menu & PM**, lalu unggah **Master TTD Default** satu kali (unggah ulang hanya bila ada perubahan tanda tangan).
2. Pastikan tanggal dan total porsi tampil pada **Daftar Rekapitulasi**.
3. Pada baris berstatus **Belum Diinisiasi**, klik **Inisiasi Masal**.
4. Setelah jumlah berkas lengkap, klik **Paraf Otomatis**. Tombol akan menampilkan **Menyinkronkan...** sampai TTD, stempel, dan penguncian selesai tersimpan di Supabase.
5. Status akhir: **Lengkap & TTD**; tombol menjadi **Lengkap & Terbit** untuk membuka cetak/simpan bundle PDF.

## Catatan penting

- Unggah ulang Master TTD akan memperbarui TTD default untuk semua tanggal berikutnya. Untuk SOP Stocking, gunakan peran `Aslap` dan `Koordinator`.
- Pastikan URL tanda tangan benar dan Anda memiliki wewenang menggunakan tanda tangan tersebut sebelum memilih **Paraf Otomatis**.
- Jika impor menyebut tabel `borongan_signatories` tidak ditemukan, migrasi pada langkah persiapan belum dijalankan.
