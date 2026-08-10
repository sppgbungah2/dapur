-- =====================================================================
-- SPPG BUNGAH 2 - SUPABASE COMPLETE RESET & SCHEMA SCRIPT (sql_query_3.sql)
-- Satuan Pelayanan Program Gizi (SPPG) Dapur Utama MBG
-- Yayasan Pondok Pesantren Qomaruddin, Bungah, Gresik
-- =====================================================================
-- PERINTAH:
-- 1. Buka Dashboard Supabase -> SQL Editor.
-- 2. Salin seluruh skrip ini dan klik "Run".
-- 3. Seluruh data & tabel lama akan DI-RESET & DIHAPUS, lalu dibuat ulang 100% baru
--    beserta RLS Policy agar webapp berjalan lancar tanpa kendala izin.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. DROP & RESET SEMUA TABEL LAMA (MEMBERSIHKAN SEMUA DATA LAMA)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS public.day_menus CASCADE;
DROP TABLE IF EXISTS public.sops CASCADE;
DROP TABLE IF EXISTS public.sop_tasks CASCADE;

-- Tabel task per divisi (Divisi Tunggal & Jamak)
DROP TABLE IF EXISTS public.sop_tasks_driver CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_stocking CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_masak CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_pemorsian CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_kebersihan CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_cuci CASCADE;
DROP TABLE IF EXISTS public.sop_tasks_keamanan CASCADE;

DROP TABLE IF EXISTS public.sop_task_driver CASCADE;
DROP TABLE IF EXISTS public.sop_task_stocking CASCADE;
DROP TABLE IF EXISTS public.sop_task_masak CASCADE;
DROP TABLE IF EXISTS public.sop_task_pemorsian CASCADE;
DROP TABLE IF EXISTS public.sop_task_kebersihan CASCADE;
DROP TABLE IF EXISTS public.sop_task_cuci CASCADE;
DROP TABLE IF EXISTS public.sop_task_keamanan CASCADE;

-- Tabel operasional, logistik, & dokumentasi
DROP TABLE IF EXISTS public.sisa_stok CASCADE;
DROP TABLE IF EXISTS public.order_requests CASCADE;
DROP TABLE IF EXISTS public.volunteer_complaints CASCADE;
DROP TABLE IF EXISTS public.shipping_docs CASCADE;
DROP TABLE IF EXISTS public.surat_jalan_docs CASCADE;
DROP TABLE IF EXISTS public.kedatangan_barang CASCADE;
DROP TABLE IF EXISTS public.bast_docs CASCADE;
DROP TABLE IF EXISTS public.organoleptik_docs CASCADE;

-- Tabel absensi & otorisasi
DROP TABLE IF EXISTS public.absensi_logs CASCADE;
DROP TABLE IF EXISTS public.absensi_signoffs CASCADE;
DROP TABLE IF EXISTS public.absensi_signoff CASCADE;

-- ---------------------------------------------------------------------
-- 2. MEMBUAT ULANG SEMUA TABEL UTAMA WEBAPP (SCHEMA SPPG QOMARUDDIN)
-- ---------------------------------------------------------------------

-- A. TABEL MENU HARIAN (day_menus)
CREATE TABLE public.day_menus (
  id TEXT,
  date TEXT PRIMARY KEY,
  day_name TEXT,
  menu_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  portion_count INT DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'admin@qomaruddin.com'
);

-- B. TABEL DOKUMEN SOP DIVISI (sops)
CREATE TABLE public.sops (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  division TEXT NOT NULL,
  creator_role TEXT,
  creator_name TEXT,
  is_checked_all BOOLEAN DEFAULT FALSE,
  signer_supervisor TEXT,
  signature_supervisor_url TEXT,
  signed_supervisor_at TIMESTAMP WITH TIME ZONE,
  signer_coordinator TEXT,
  signature_coordinator_url TEXT,
  signed_coordinator_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'aktif',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sops_date ON public.sops(date);
CREATE INDEX idx_sops_division ON public.sops(division);

-- C. TABEL SOP TASKS PER DIVISI
CREATE TABLE public.sop_tasks (
  id TEXT PRIMARY KEY,
  sop_id TEXT NOT NULL,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  category TEXT DEFAULT 'aktif',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Divisi Resmi
CREATE TABLE public.sop_tasks_driver ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_stocking ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_masak ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_pemorsian ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_kebersihan ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_cuci ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );
CREATE TABLE public.sop_tasks_keamanan ( id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, text TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, category TEXT DEFAULT 'aktif', sort_order INT DEFAULT 0, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() );

CREATE INDEX idx_sop_tasks_sop_id ON public.sop_tasks(sop_id);

-- D. TABEL STOK OPERASIONAL & SISA STOK
CREATE TABLE public.sisa_stok (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  stock_qty NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- E. TABEL ORDER BARANG / PERALATAN
CREATE TABLE public.order_requests (
  id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  requester TEXT,
  department TEXT,
  priority TEXT DEFAULT 'Normal',
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- F. TABEL KELUHAN RELAWAN & KRITIK SARAN
CREATE TABLE public.volunteer_complaints (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  volunteer_name TEXT NOT NULL,
  division TEXT,
  complaint TEXT NOT NULL,
  status TEXT DEFAULT 'Baru',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- G. TABEL SURAT JALAN (surat_jalan_docs)
CREATE TABLE public.surat_jalan_docs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  sj_no TEXT,
  sj_kepada TEXT,
  sj_driver TEXT,
  sj_waktu TEXT,
  sj_batas_konsumsi TEXT,
  status TEXT DEFAULT 'Terkirim',
  items JSONB DEFAULT '[]'::jsonb,
  sj_rows JSONB DEFAULT '[]'::jsonb,
  photo_url TEXT,
  comments TEXT,
  sj_signature_aslap TEXT,
  sj_signature_receiver TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- H. TABEL BAST (bast_docs)
CREATE TABLE public.bast_docs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  bast_no TEXT,
  bast_sekolah TEXT,
  bast_driver TEXT,
  bast_penerima TEXT,
  bast_barang TEXT,
  bast_jumlah NUMERIC DEFAULT 0,
  bast_waktu TEXT,
  status TEXT DEFAULT 'BAST Sah',
  items JSONB DEFAULT '[]'::jsonb,
  photo_url TEXT,
  bast_signature_driver TEXT,
  bast_signature_receiver TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- I. TABEL ORGANOLEPTIK (organoleptik_docs)
CREATE TABLE public.organoleptik_docs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  tester_name TEXT,
  menu_name TEXT,
  orlep_menu TEXT,
  orlep_panelis TEXT,
  orlep_jam TEXT,
  orlep_desa TEXT,
  organoleptik_rasa TEXT,
  organoleptik_aroma TEXT,
  organoleptik_tekstur TEXT,
  organoleptik_suhu TEXT,
  color_score INT DEFAULT 5,
  aroma_score INT DEFAULT 5,
  taste_score INT DEFAULT 5,
  texture_score INT DEFAULT 5,
  orlep_kritik TEXT,
  orlep_grid JSONB DEFAULT '[]'::jsonb,
  orlep_signature TEXT,
  notes TEXT,
  status TEXT DEFAULT 'Lulus Uji',
  photo_url TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- J. TABEL PENGIRIMAN OMPRENG (shipping_docs)
CREATE TABLE public.shipping_docs (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'ompreng',
  date TEXT NOT NULL,
  vehicle_number TEXT,
  receiver_name TEXT,
  sj_no TEXT,
  sj_kepada TEXT,
  sj_driver TEXT,
  status TEXT DEFAULT 'Kirim Sukses',
  items JSONB DEFAULT '[]'::jsonb,
  photo_url TEXT,
  image_url TEXT,
  comments TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- K. TABEL KEDATANGAN BARANG (kedatangan_barang)
CREATE TABLE public.kedatangan_barang (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT,
  qty NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'kg',
  supplier TEXT,
  status TEXT DEFAULT 'Sesuai',
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- L. TABEL ABSENSI RELAWAN (absensi_logs)
CREATE TABLE public.absensi_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  check_in_time TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- M. TABEL OTORISASI ABSENSI (absensi_signoffs)
CREATE TABLE public.absensi_signoffs (
  date TEXT PRIMARY KEY,
  signer_ketua TEXT,
  signature_ketua_url TEXT,
  signed_ketua_at TEXT,
  signer_aslap TEXT,
  signature_aslap_url TEXT,
  signed_aslap_at TEXT,
  status TEXT DEFAULT 'Draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 3. GRANT PERMISSION HAK AKSES FULL & NONAKTIFKAN RLS (BEBAS PERMISSION DENIED)
-- ---------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, postgres, service_role;

DO $$ 
DECLARE 
  tbl text;
BEGIN 
  FOR tbl IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
  LOOP 
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, postgres, service_role;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public Full Access" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow All Access" ON public.%I;', tbl);
    EXECUTE format('CREATE POLICY "Public Full Access" ON public.%I FOR ALL TO public USING (true) WITH CHECK (true);', tbl);
  END LOOP; 
END $$;

-- Selesai. Seluruh data lama di-reset dan database Supabase telah siap 100%.
