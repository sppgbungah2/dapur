# Alur SOP

1. Admin memilih tanggal lalu **Generate Draft dari Template**. Template yang digunakan tetap template bawaan. SOP yang sudah ada tidak diganti saat generate diulang.
2. Admin membuka divisi, mengedit instruksi, menambah atau menghapus tugas, lalu menekan **Simpan Draft**. Draft belum ditampilkan kepada koordinator.
3. Setelah instruksi diedit, admin menekan **Terbitkan SOP**. Perubahan yang belum disimpan ikut disimpan dalam transaksi penerbitan. Koordinator kemudian dapat mengisi checklist dan menyimpan perubahannya.

Mengedit instruksi SOP yang sudah terbit menjadikannya draft lagi saat disimpan. SOP yang sudah dikunci tidak dapat diedit.

## Mengaktifkan perubahan di server

Jalankan `supabase/migrations/20261020_sop_draft_transaction.sql` melalui SQL Editor atau koneksi administrator database, **sebelum** menerapkan build aplikasi baru. Migrasi ini menggunakan schema `dapur_db`, sesuai konfigurasi aplikasi. Migrasi menambahkan penanda edit admin dan fungsi transaksi; tidak mengganti isi SOP lama atau menonaktifkan RLS.

Aplikasi sengaja tidak kembali ke jalur penyimpanan lama jika fungsi transaksi belum tersedia. Pesan kesalahan akan menyebutkan migrasi yang diperlukan.

## Jika penyimpanan gagal

- Instruksi, tugas, status, dan penandatangan disimpan dalam satu transaksi. Kegagalan salah satu tahap membatalkan seluruh perubahan database.
- Edit lokal tetap berada di editor dan session storage tab untuk dicoba kembali. Salinan tab bukan pengganti penyimpanan server; pastikan status tersimpan sebelum menutup tab.
- Jika SOP telah diubah di sesi lain, penyimpanan ditolak. Salin edit yang ingin dipertahankan, pilih **Muat ulang versi server**, lalu gabungkan perubahan.
- Gagal membaca tugas tidak lagi memicu pengisian template. Template hanya dibuat melalui tindakan generate admin.

## Pemeriksaan

- `npm run test:sop` menguji alur draft, kegagalan simpan, rollback transaksi, pemuatan ulang, ID tugas, dan konflik versi menggunakan PostgreSQL lokal (PGlite).
- `npm run lint`
- `npm run build`
