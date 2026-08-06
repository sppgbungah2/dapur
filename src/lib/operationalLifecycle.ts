import { supabase, isSupabaseConfigured, asOperationalDate } from './supabase';
import { fetchPortionsForDate, generateInitialDocsAsync } from '../utils/generateDocs';
import { getActiveDeliveryTargets } from '../utils/deliveryMaster';
import { generateInitialSOPsForDate, getCanonicalSopId, getSopTaskTableName } from '../presetData';
import type { SignatureRecord } from '../components/SignatureImportView';

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

/** Applies the imported signature URLs, locks documents, and therefore displays the existing official stamp. */
export async function autoSignOperationalDocuments(dateInput: string) {
  const date = asOperationalDate(dateInput);
  const db = requireClient();
  const expectedShipments = getActiveDeliveryTargets(await fetchPortionsForDate(date)).length;
  let config: any = null;
  // Seluruh tanggal hanya memakai satu konfigurasi master TTD.
  // Ini mencegah TTD/peran dari impor tanggal lama ikut terbaca.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await db.from('borongan_signatories').select('signatories').eq('date', 'MASTER_DEFAULT').maybeSingle();
    if (error) throw error;
    config = data;
    if ((data?.signatories as any)?.records?.length) break;
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 450));
  }
  const readRecords = (value: any): SignatureRecord[] => {
    if (Array.isArray(value)) return value as SignatureRecord[];
    if (Array.isArray(value?.records)) return value.records as SignatureRecord[];
    if (Array.isArray(value?.data)) return value.data as SignatureRecord[];
    return [];
  };
  const records = readRecords(config?.signatories) as SignatureRecord[];
  if (!records.length) throw new Error('Master TTD belum tersedia. Unggah Master TTD terlebih dahulu.');
  const canonical = (value: string) => value.toLocaleLowerCase('id-ID').replace(/[^a-z0-9]/g, '');
  const lookup = (documentType: SignatureRecord['documentType'], target: string, role: string) => {
    const matchingRole = records.filter(record => canonical(record.documentType) === canonical(documentType) && canonical(record.role) === canonical(role));
    const direct = matchingRole.find(record => canonical(record.target) === canonical(target))
      // A single Aslap/Driver may be legitimately assigned to every location.
      || matchingRole.find(record => ['semualokasi', 'all', 'umum', 'global'].includes(canonical(record.target)))
      || ((role === 'Aslap' || role === 'Driver') && matchingRole.length ? matchingRole[0] : undefined);
    if (direct) return direct;
    // In this operational structure, the Aslap signs SOP Driver/Cuci/Kebersihan/Keamanan.
    // Reuse that imported URL for Surat Jalan when the user maintains one shared Aslap signature.
    if (documentType === 'SURAT_JALAN' && role === 'Aslap') {
      return records.find(record =>
        canonical(record.documentType) === 'sop' && canonical(record.role) === canonical('Aslap') &&
        ['driver', 'cuci', 'kebersihan', 'keamanan'].includes(canonical(record.target))
      );
    }
    return undefined;
  };
  let sjResult: any; let bastResult: any; let orlepResult: any; let sopResult: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    [sjResult, bastResult, orlepResult, sopResult] = await Promise.all([
      db.from('surat_jalan_docs').select('id, sj_kepada').eq('date', date),
      db.from('bast_docs').select('id, bast_sekolah').eq('date', date),
      db.from('organoleptik_docs').select('id, orlep_desa').eq('date', date),
      db.from('sops').select('id, division').eq('date', date)
    ]);
    const ready = (sjResult.data?.length || 0) >= expectedShipments && (bastResult.data?.length || 0) >= expectedShipments && (orlepResult.data?.length || 0) >= expectedShipments && (sopResult.data?.length || 0) >= 7;
    if (ready || attempt === 3) break;
    await new Promise(resolve => setTimeout(resolve, 450));
  }
  const sourceError = [sjResult, bastResult, orlepResult, sopResult].find(result => result.error)?.error;
  if (sourceError) throw sourceError;
  if ((sjResult.data?.length || 0) < expectedShipments || (bastResult.data?.length || 0) < expectedShipments || (orlepResult.data?.length || 0) < expectedShipments || (sopResult.data?.length || 0) < 7) {
    throw new Error('Dokumen belum lengkap di Supabase. Tunggu sinkronisasi Inisiasi Masal selesai, lalu coba kembali.');
  }
  const now = new Date().toISOString();
  const updates: PromiseLike<any>[] = [];
  for (const doc of sjResult.data || []) {
    const aslap = lookup('SURAT_JALAN', doc.sj_kepada, 'Aslap'); const receiver = lookup('SURAT_JALAN', doc.sj_kepada, 'Penerima');
    if (!aslap || !receiver) throw new Error(`TTD Surat Jalan belum lengkap untuk ${doc.sj_kepada}: ${!aslap ? 'Aslap' : 'Penerima'} belum ditemukan.`);
    updates.push(db.from('surat_jalan_docs').update({ sj_signature_aslap: aslap.signatureUrl, sj_signature_receiver: receiver.signatureUrl, status: 'Terkunci', is_locked: true }).eq('id', doc.id));
  }
  for (const doc of bastResult.data || []) {
    const driver = lookup('BAST', doc.bast_sekolah, 'Driver'); const receiver = lookup('BAST', doc.bast_sekolah, 'Penerima');
    if (!driver || !receiver) throw new Error(`TTD BAST belum lengkap untuk ${doc.bast_sekolah}: ${!driver ? 'Driver' : 'Penerima'} belum ditemukan.`);
    updates.push(db.from('bast_docs').update({ bast_signature_driver: driver.signatureUrl, bast_signature_receiver: receiver.signatureUrl, status: 'Terkunci', is_locked: true }).eq('id', doc.id));
  }
  for (const doc of orlepResult.data || []) {
    const panelist = lookup('ORGANOLEPTIK', doc.orlep_desa, 'Panelis');
    if (!panelist) throw new Error(`TTD Organoleptik belum lengkap untuk ${doc.orlep_desa}.`);
    updates.push(db.from('organoleptik_docs').update({ orlep_signature: panelist.signatureUrl, status: 'Terkunci', is_locked: true }).eq('id', doc.id));
  }
  for (const doc of sopResult.data || []) {
    const normalizedDivision = canonical(doc.division);
    const ownerRole = normalizedDivision === canonical('Masak') ? 'Chef' : normalizedDivision === canonical('Pemorsian') ? 'Ahli Gizi' : 'Aslap';
    const owner = lookup('SOP', doc.division, ownerRole);
    const coordinator = lookup('SOP', doc.division, 'Koordinator');
    if (!owner || !coordinator) throw new Error(`Dua TTD SOP belum lengkap untuk divisi ${doc.division}.`);
    updates.push(db.from('sops').update({ signer_supervisor: owner.name, signature_supervisor_url: owner.signatureUrl, signed_supervisor_at: now, signer_coordinator: coordinator.name, signature_coordinator_url: coordinator.signatureUrl, signed_coordinator_at: now, status: 'selesai', is_locked: true }).eq('id', doc.id));
  }
  const results = await Promise.all(updates);
  const failed = results.find(result => result.error);
  if (failed?.error) throw failed.error;
}
