-- TABEL MASTER PORSI
CREATE TABLE public.master_porsi (
  date TEXT PRIMARY KEY,
  portions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);
ALTER TABLE public.master_porsi DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.master_porsi TO anon, authenticated, postgres, service_role;
