import type { SOPDocument } from '../types';
import { getCanonicalSopId, getDefaultTasksForDivision, normalizeDateISO } from '../presetData';

const queues = new Map<string, Promise<unknown>>();

export function serializeSopWrite<T>(id: string, write: () => Promise<T>): Promise<T> {
  const previous = queues.get(id) || Promise.resolve();
  const next = previous.catch(() => undefined).then(write);
  queues.set(id, next);
  void next.finally(() => {
    if (queues.get(id) === next) queues.delete(id);
  }).catch(() => undefined);
  return next;
}

export function hasSopEdits(sop: SOPDocument, menu: string[]): boolean {
  const template = getDefaultTasksForDivision(sop.division, menu);
  return JSON.stringify(sop.tasks.map(t => [t.text.trim(), t.category])) !==
    JSON.stringify(template.map(t => [t.text.trim(), t.category]));
}

const timestamp = (value: string | null) =>
  value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;

/** The database commits the SOP and all its tasks together, or rolls everything back. */
export async function persistSop(db: any, sop: SOPDocument, createOnly = false): Promise<SOPDocument> {
  if (!db) throw new Error('Supabase belum dikonfigurasi. Perubahan belum tersimpan.');
  if (sop.tasksLoaded === false) throw new Error('Tugas SOP belum berhasil dimuat. Muat ulang sebelum menyimpan.');
  const ids = sop.tasks.map(t => t.id);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new Error('ID tugas SOP tidak valid atau berulang. Perubahan belum disimpan.');
  }
  if (sop.tasks.some(t => !t.text.trim())) throw new Error('Isi instruksi SOP tidak boleh kosong.');
  if (sop.status !== 'draft' && !sop.tasks.length) throw new Error('SOP terbit harus memiliki minimal satu tugas.');

  const id = sop.id || getCanonicalSopId(sop.date, sop.division);
  const saved = { ...sop, id, date: normalizeDateISO(sop.date), updatedAt: new Date().toISOString() };
  const payload = {
    id, date: saved.date, division: saved.division,
    creator_role: saved.creatorRole, creator_name: saved.creatorName,
    is_checked_all: saved.isCheckedAll, signer_supervisor: saved.signerSupervisor,
    signature_supervisor_url: saved.signatureSupervisorUrl,
    signed_supervisor_at: timestamp(saved.signedSupervisorAt),
    signer_coordinator: saved.signerCoordinator,
    signature_coordinator_url: saved.signatureCoordinatorUrl,
    signed_coordinator_at: timestamp(saved.signedCoordinatorAt),
    status: saved.status, updated_at: saved.updatedAt
  };
  const tasks = saved.tasks.map((task, index) => ({ ...task, text: task.text.trim(), sort_order: index }));
  const { data, error } = await db.rpc('save_sop', {
    p_document: payload,
    p_tasks: tasks,
    p_expected_updated_at: createOnly ? null : sop.updatedAt || null,
    p_create_only: createOnly
  });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('Penyimpanan SOP belum diaktifkan di server. Jalankan migrasi 20261020_sop_draft_transaction.sql. Edit Anda tetap tersimpan di tab ini.');
    }
    throw error;
  }
  if (!data?.updated_at) throw new Error('Server belum mengonfirmasi penyimpanan SOP. Silakan muat ulang untuk memeriksa.');
  return { ...saved, updatedAt: data.updated_at, adminEdited: !!data.admin_edited, tasks, tasksLoaded: true };
}
