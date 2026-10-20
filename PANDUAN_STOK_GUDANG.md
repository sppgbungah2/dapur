# Stock opname harian: gudang kering dan gudang basah

## Pemasangan

Jalankan `supabase/migrations/20261023_daily_stock_opname.sql` di database aplikasi, kemudian pasang build terbaru. Migrasi ini mandiri: tidak memerlukan migrasi buku transaksi tanggal 21/22. Belum diterapkan ke produksi dari workspace ini.

Data stok dan penerimaan lama tetap tersimpan. Data lama tidak otomatis dimasukkan ke salah satu gudang karena belum mempunyai pembagian gudang kering/basah. Pada tanggal pertama, admin mengisi barang dan stok awal masing-masing gudang. Jangan menjalankan migrasi pemindahan saldo buku transaksi untuk alur harian ini.

## Penggunaan

1. Pilih bulan dan buka kartu tanggal.
2. Isi tabel **Gudang Kering** dan **Gudang Basah**: nama bahan, satuan, stok gudang awal, barang datang, pemakaian, fisik, dan keterangan.
3. Saldo kartu dihitung otomatis: stok gudang awal + barang datang − pemakaian.
4. Selisih dihitung otomatis: fisik − saldo kartu. Minus berarti kurang; positif berarti lebih. Fisik kosong berarti belum diperiksa, berbeda dari angka 0.
5. Klik **Simpan stok opname** untuk menyimpan kedua gudang bersama. Klik **Unduh rekap CSV** untuk mengekspor kedua tabel tanggal tersebut (termasuk isian yang masih diedit).

Tidak ada jam, batas pukul 14.00, atau formulir transaksi terpisah. Semua angka merupakan jumlah untuk tanggal yang dipilih. Rekap bisa dilihat kapan saja. Tambahan kiriman dimasukkan dengan memperbarui total Barang datang pada tanggal itu.

Saat membuka tanggal baru, daftar barang dan saldo fisik dari tanggal tersimpan terakhir disalin sebagai stok awal. Jika fisik belum diisi, saldo kartu dipakai. Admin dapat menyesuaikannya. Perubahan tanggal sebelumnya tidak menimpa tanggal berikutnya yang sudah disimpan.

Hanya admin dapat mengedit. Akun dapur yang diizinkan dapat melihat dan mengunduh. Penyimpanan memeriksa versi dokumen agar perubahan admin lain tidak tertimpa. Isian belum tersimpan dipertahankan per tanggal di sessionStorage selama sesi browser yang sama. Jika terjadi konflik, unduh salinan CSV sebelum memuat ulang data server dan menggabungkan perubahan secara manual.

## Pemeriksaan

`npm run test:daily-stock`, `npm run lint`, `npm run build`.
