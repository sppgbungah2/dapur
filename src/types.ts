export enum Division {
  STOCKING = 'Stocking (Persiapan)',
  MASAK = 'Masak',
  PEMORSIAN = 'Pemorsian',
  DRIVER = 'Driver',
  CUCI = 'Cuci',
  KEBERSIHAN = 'Kebersihan',
  KEAMANAN = 'Keamanan'
}

export enum UserRole {
  CHEF = 'Chef / Juru Masak',
  AHLI_GIZI = 'Ahli Gizi',
  ASLAP = 'Aslap (Asisten Lapangan)',
  ADMIN = 'Administrator',
  AKUNTAN = 'Akuntan',
  DRIVER = 'Driver',
  PENERIMA = 'Penerima / Sasaran'
}

export interface MenuItem {
  id: string;
  name: string;
}

export interface DayMenu {
  date: string; // YYYY-MM-DD
  menuList: string[]; // List of dishes, e.g. ["Nasi", "Krawu Ayam", "Tempe Goreng", "Timun", "Sambal + Serundeng", "Pisang"]
  createdAt: string;
  createdBy: string;
}

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  category: 'persiapan' | 'aktif' | 'penutup'; // APD/General, Cooking/Active, Cleaning/Closing
  sort_order?: number;
}

export interface SOPDocument {
  id: string; // date-division
  date: string; // YYYY-MM-DD
  division: Division;
  creatorRole: UserRole;
  creatorName: string;
  tasks: TaskItem[];
  isCheckedAll: boolean;
  
  // Signatures
  signerSupervisor: string; // Creator name (Head Chef, Ahli Gizi, Aslap)
  signatureSupervisorUrl: string; // PNG Data URI from Canvas
  signedSupervisorAt: string | null;

  signerCoordinator: string; // Coordinator lapangan name
  signatureCoordinatorUrl: string; // PNG Data URI from Canvas
  signedCoordinatorAt: string | null;
  
  status: 'draft' | 'aktif' | 'selesai'; // draft, active (ready to check), selesai (signed & recorded)
  updatedAt: string;
}

// Keep a record of historical checklist completions
export interface SOPRecapItem {
  id: string;
  date: string;
  division: Division;
  menuList: string[];
  completedCount: number;
  totalCount: number;
  signedBySupervisor: string;
  signedByCoordinator: string;
  signatureSupervisorUrl: string;
  signatureCoordinatorUrl: string;
  signedAt: string;
}

export const DRIVERS_LIST = [
  'Imam Durori',
  'Ahmad Wahyudi',
  'Sholahuddin Nuraini',
  'Faliqul Habibi'
];

export interface StockItem {
  id: string;
  category: string;
  name: string;
  stokAwal: number;
  barangMasuk: number;
  barangKeluar?: number;
  stokAkhir: number;
  uom: string;
  expiredDate?: string;
}

