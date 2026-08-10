import { PortionConfig } from '../components/PortionMasterView';
import { getDefaultReceiptTime, getRecipientName } from '../presetData';

export const DELIVERY_TARGETS = [
  "MA Assa'adah",
  "MTS Assa'adah II",
  "SMA Assa'adah",
  "SMK Assa'adah",
  'Desa Sidokumpul',
  'Desa Sukowati',
  'Desa Gumeng'
] as const;

/** Penanggung jawab Dapur untuk seluruh Surat Jalan. Bukan driver pengiriman. */
export const PRIMARY_ASLAP_NAME = 'Ahmad Maghfur';

type PortionEntry = { label: string; count: number };

const DELIVERY_ASSIGNMENTS: Record<string, { driver: string; vehicleNumber: string }> = {
  "MA Assa'adah": { driver: 'Ahmad Wahyudi', vehicleNumber: 'W 1234 BGH' },
  "MTS Assa'adah II": { driver: 'Ahmad Wahyudi', vehicleNumber: 'W 1234 BGH' },
  "SMK Assa'adah": { driver: 'Faliqul Habibi', vehicleNumber: 'W 8006 EG' },
  "SMA Assa'adah": { driver: 'Faliqul Habibi', vehicleNumber: 'W 8006 EG' },
  'Desa Sukowati': { driver: 'Imam Durori', vehicleNumber: 'W 1420 BK' },
  'Desa Sidokumpul': { driver: 'Imam Durori', vehicleNumber: 'W 1420 BK' },
  'Desa Gumeng': { driver: 'Imam Durori', vehicleNumber: 'W 1420 BK' }
};

export function getPortionEntries(target: string, portions: PortionConfig): PortionEntry[] {
  if (target === "MA Assa'adah") return [{ label: 'Porsi Siswa', count: portions.MA?.siswa || 0 }, { label: 'Porsi Guru', count: portions.MA?.guru || 0 }];
  if (target === "MTS Assa'adah II") return [{ label: 'Porsi Siswa', count: portions['MTS II']?.siswa || 0 }, { label: 'Porsi Guru', count: portions['MTS II']?.guru || 0 }];
  if (target === "SMK Assa'adah") return [{ label: 'Porsi Siswa', count: portions.SMK?.siswa || 0 }, { label: 'Porsi Guru', count: portions.SMK?.guru || 0 }];
  if (target === "SMA Assa'adah") return [{ label: 'Porsi Siswa', count: portions.SMA?.siswa || 0 }, { label: 'Porsi Guru', count: portions.SMA?.guru || 0 }];
  if (target.includes('Sukowati')) return [{ label: 'Porsi Besar', count: portions.Sukowati?.besar || 0 }, { label: 'Porsi Kecil', count: portions.Sukowati?.kecil || 0 }];
  if (target.includes('Sidokumpul')) return [{ label: 'Porsi Besar', count: portions.Sidokumpul?.besar || 0 }, { label: 'Porsi Kecil', count: portions.Sidokumpul?.kecil || 0 }];
  if (target.includes('Gumeng')) return [{ label: 'Porsi Besar', count: portions.Gumeng?.besar || 0 }, { label: 'Porsi Kecil', count: portions.Gumeng?.kecil || 0 }];
  return [];
}

/** Lokasi dengan PM nol tidak memerlukan dokumen distribusi pada tanggal tersebut. */
export function getActiveDeliveryTargets(portions: PortionConfig) {
  return DELIVERY_TARGETS.filter(target => getDeliveryDetails(target, portions).total > 0);
}

export function getDeliveryDetails(target: string, portions: PortionConfig) {
  const portionsForTarget = getPortionEntries(target, portions);
  const assignment = DELIVERY_ASSIGNMENTS[target] || { driver: '', vehicleNumber: '' };
  return {
    ...assignment,
    recipient: getRecipientName(target),
    time: getDefaultReceiptTime(target),
    consumptionDeadline: getConsumptionDeadline(target),
    total: portionsForTarget.reduce((sum, item) => sum + item.count, 0),
    breakdown: portionsForTarget.map(item => `${item.label}: ${item.count}`).join(', '),
    portions: portionsForTarget
  };
}

/** Batas konsumsi makanan sesuai tujuan pengiriman Surat Jalan. */
export function getConsumptionDeadline(target: string): string {
  const normalized = target.toLowerCase();
  if (normalized.includes('sidokumpul') || normalized.includes('sukowati')) return '09.00 WIB';
  if (normalized.includes('sma') || normalized.includes('ma assa')) return '10.00 WIB';
  if (normalized.includes('mts')) return '11.00 WIB';
  if (normalized.includes('smk')) return '12.00 WIB';
  return '-';
}

export function buildBastComment(target: string, portions: PortionConfig, menuList: string[] = []) {
  const details = getDeliveryDetails(target, portions);
  const menu = menuList.filter(Boolean).join(', ') || 'menu harian belum diatur';
  return `Dokumen serah terima makanan bergizi untuk ${target} (${details.breakdown}) dengan menu ${menu}.`;
}

export function buildSuratJalanRows(target: string, portions: PortionConfig) {
  return getDeliveryDetails(target, portions).portions.map((item, index) => ({
    id: String(index + 1), jenis: item.label, porsi: item.count,
    alatSebelum: item.count, alatSesudah: item.count, keterangan: 'Hangat & Lengkap'
  }));
}
