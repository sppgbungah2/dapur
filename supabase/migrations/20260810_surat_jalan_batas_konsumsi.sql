-- Jalankan sekali di Supabase SQL Editor sebelum memakai kolom Batas Konsumsi.
alter table public.surat_jalan_docs
  add column if not exists sj_batas_konsumsi text;

-- Isi otomatis untuk arsip Surat Jalan yang sudah ada.
update public.surat_jalan_docs
set sj_batas_konsumsi = case
  when lower(sj_kepada) like '%sidokumpul%' or lower(sj_kepada) like '%sukowati%' then '09.00 WIB'
  when lower(sj_kepada) like '%sma%' or lower(sj_kepada) like '%ma assa%' then '10.00 WIB'
  when lower(sj_kepada) like '%mts%' then '11.00 WIB'
  when lower(sj_kepada) like '%smk%' then '12.00 WIB'
  else sj_batas_konsumsi
end
where sj_batas_konsumsi is null or btrim(sj_batas_konsumsi) = '';
