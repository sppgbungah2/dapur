import { supabase, isSupabaseConfigured, asOperationalDate } from './supabase';
import { generateInitialDocsAsync } from '../utils/generateDocs';
import { generateInitialSOPsForDate, getCanonicalSopId, getSopTaskTableName } from '../presetData';

const requireClient = () => {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase belum dikonfigurasi. Dokumen tidak dibuat.');
  return supabase;
};

/** Creates all daily drafts in Supabase. UI must only consume the return value after this succeeds. */
export async function initializeOperationalDocuments(dateInput: string, menuList: string[], email: string) {
  const date = asOperationalDate(dateInput);
  const db = requireClient();
  const docs = await generateInitialDocsAsync(date, [], menuList.join(', '), email);
  const bast = docs.filter(d => d.type === 'serah_terima').map(d => ({
    id: `bast-${date}-${d.bastSekolah}`, date, status: 'draft', is_locked: false,
    bast_no: d.bastNo, bast_sekolah: d.bastSekolah, bast_driver: d.bastDriver, bast_penerima: d.bastPenerima,
    bast_barang: d.bastBarang, bast_jumlah: d.bastJumlah, bast_waktu: d.bastWaktu,
    bast_signature_driver: null, bast_signature_receiver: null, uploaded_by: email, photo_url: d.imageUrl, items: []
  }));
  const sj = docs.filter(d => d.type === 'surat_jalan').map(d => ({
    id: `sj-${date}-${d.sjKepada}`, date, status: 'draft', is_locked: false,
    sj_no: d.sjNo, sj_kepada: d.sjKepada, sj_driver: d.sjDriver, sj_waktu: d.sjWaktu,
    sj_rows: d.sjRows, sj_signature_aslap: null, sj_signature_receiver: null, uploaded_by: email, photo_url: d.imageUrl, comments: d.comments, items: []
  }));
  const orlep = docs.filter(d => d.type === 'organoleptik').map(d => ({
    id: `orlep-${date}-${d.orlepDesa}`, date, status: 'draft', is_locked: false,
    orlep_jam: d.orlepJam, orlep_panelis: d.orlepPanelis, orlep_desa: d.orlepDesa, orlep_menu: d.orlepMenu,
    orlep_kritik: d.orlepKritik, organoleptik_suhu: d.organoleptikSuhu, orlep_grid: d.orlepGrid,
    orlep_signature: null, uploaded_by: email, photo_url: d.imageUrl, notes: d.comments
  }));
  const generatedSops = generateInitialSOPsForDate(date, menuList);
  const sops = generatedSops.map(s => ({
    id: getCanonicalSopId(date, s.division), date, division: s.division, creator_role: s.creatorRole,
    creator_name: s.creatorName, is_checked_all: false, signer_supervisor: s.signerSupervisor,
    signature_supervisor_url: '', signer_coordinator: s.signerCoordinator, signature_coordinator_url: '',
    status: 'draft', is_locked: false
  }));
  const results = await Promise.all([
    db.from('bast_docs').upsert(bast), db.from('surat_jalan_docs').upsert(sj),
    db.from('organoleptik_docs').upsert(orlep), db.from('sops').upsert(sops)
  ]);
  const failed = results.find(result => result.error);
  if (failed?.error) throw failed.error;
  const taskResults = await Promise.all(generatedSops.map(s => {
    const sopId = getCanonicalSopId(date, s.division);
    return db.from(getSopTaskTableName(s.division)).upsert(s.tasks.map((task: any, index: number) => ({
      id: `${sopId}-t-${index}`, sop_id: sopId, text: task.text, completed: false,
      category: task.category || 'aktif', sort_order: index
    })));
  }));
  const failedTask = taskResults.find(result => result.error);
  if (failedTask?.error) throw failedTask.error;
  return { docs, sops };
}

export async function setOperationalLock(dateInput: string, isLocked: boolean) {
  const date = asOperationalDate(dateInput);
  const db = requireClient();
  const results = await Promise.all([
    db.from('bast_docs').update({ is_locked: isLocked }).eq('date', date),
    db.from('surat_jalan_docs').update({ is_locked: isLocked }).eq('date', date),
    db.from('organoleptik_docs').update({ is_locked: isLocked }).eq('date', date),
    db.from('sops').update({ is_locked: isLocked }).eq('date', date)
  ]);
  const failed = results.find(result => result.error);
  if (failed?.error) throw failed.error;
}

export async function publishOperationalDocuments(dateInput: string) {
  const date = asOperationalDate(dateInput);
  const db = requireClient();
  const results = await Promise.all([
    db.from('bast_docs').update({ status: 'published' }).eq('date', date).eq('is_locked', false),
    db.from('surat_jalan_docs').update({ status: 'published' }).eq('date', date).eq('is_locked', false),
    db.from('organoleptik_docs').update({ status: 'published' }).eq('date', date).eq('is_locked', false),
    db.from('sops').update({ status: 'published' }).eq('date', date).eq('is_locked', false)
  ]);
  const failed = results.find(result => result.error);
  if (failed?.error) throw failed.error;
}
