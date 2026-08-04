import { createClient } from '@supabase/supabase-js';
import { UserRole, Division } from '../types';

// 1. Ambil Variabel Environment
const rawSupabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://dapurdb.naracode.my.id';
const rawAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

// 2. Sanitasi URL: Hapus spasi & trailing slash (mencegah HTTP 308 Redirect)
const cleanSupabaseUrl = rawSupabaseUrl.trim().replace(/\/+$/, '');
const cleanAnonKey = rawAnonKey.trim();

// 3. Validasi Ketersediaan Konfigurasi
const isPlaceholderUrl = !cleanSupabaseUrl || cleanSupabaseUrl.includes('your_project_id');
const isPlaceholderKey = !cleanAnonKey || cleanAnonKey.includes('your_public_anon_key_here');

export const isSupabaseConfigured = !isPlaceholderUrl && !isPlaceholderKey;

if (!isSupabaseConfigured) {
  console.warn('⚠️ Supabase URL atau Anon Key belum terkonfigurasi dengan benar di .env!');
}

// 4. Client Supabase
export const supabase = createClient(
  cleanSupabaseUrl,
  cleanAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      timeout: 20000,
    },
  }
);

// 5. Interface & Mapping Profil Pengguna Dapur Qomaruddin
export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  isCoordinator?: boolean;
  coordinatorDivision?: Division;
}

export function mapUserToProfile(uid: string, email: string): UserProfile {
  const normEmail = email.toLowerCase().trim();
  
  // Super Admin / Developer
  if (normEmail === 'maghfurmunif@gmail.com' || normEmail === 'punkysme@gmail.com' || uid === 'd5454d9d-1d50-4baa-b5b9-f8693694db4a') {
    return {
      id: uid,
      email: normEmail === 'punkysme@gmail.com' ? 'punkysme@gmail.com' : 'maghfurmunif@gmail.com',
      role: UserRole.ADMIN,
      fullName: normEmail === 'punkysme@gmail.com' ? 'Ahmad Fajrul Falah (Admin Utama)' : 'Ustadz Maghfur Munif (Admin Utama)'
    };
  }

  // Admin Utama Dapur
  if (normEmail === 'maghfur@qomaruddin.com') return { id: uid, email, role: UserRole.ADMIN, fullName: 'Ustadz Maghfur Munif (Admin Utama)' };
  if (normEmail === 'rifkah@qomaruddin.com') return { id: uid, email, role: UserRole.ADMIN, fullName: 'Ibu Rifkah (Admin Utama)' };
  if (normEmail === 'fajar@qomaruddin.com') return { id: uid, email, role: UserRole.ADMIN, fullName: 'Bpk. Fajar (Admin Utama)' };
  if (normEmail === 'sam@qomaruddin.com') return { id: uid, email, role: UserRole.ADMIN, fullName: 'Bpk. Sam (Admin Utama)' };
  if (normEmail === 'ketua@sppg.com') return { id: uid, email, role: UserRole.ADMIN, fullName: 'Ketua SPPG' };

  // Tim Inti Produksi & Manajemen
  if (normEmail === 'chef@qomaruddin.com' || normEmail.startsWith('chef')) {
    return { id: uid, email, role: UserRole.CHEF, fullName: 'Rizka Aulia (Head Chef)' };
  }
  if (normEmail === 'gizi@qomaruddin.com' || normEmail.startsWith('gizi')) {
    return { id: uid, email, role: UserRole.AHLI_GIZI, fullName: 'Avianti Rahma Dianita (Ahli Gizi)' };
  }
  if (normEmail === 'akuntan@qomaruddin.com' || normEmail.startsWith('akuntan')) {
    return { id: uid, email, role: UserRole.AKUNTAN, fullName: 'Staff Akuntan (Tim Utama)' };
  }
  if (normEmail === 'driver@qomaruddin.com' || normEmail === 'driver@sppg.com') {
    return { id: uid, email, role: UserRole.DRIVER, fullName: 'Imam Durori (Driver)', isCoordinator: true, coordinatorDivision: Division.DRIVER };
  }

  // Koordinator Divisi Operasional SOP
  if (normEmail === 'stocking@qomaruddin.com' || normEmail === 'stocking@sppg.com' || normEmail === 'persiapan@sppg.com') {
    return { id: uid, email, role: UserRole.CHEF, fullName: 'Koordinator Persiapan & Stocking', isCoordinator: true, coordinatorDivision: Division.STOCKING };
  }
  if (normEmail === 'masak@qomaruddin.com' || normEmail === 'masak@sppg.com') {
    return { id: uid, email, role: UserRole.CHEF, fullName: 'Koordinator Masak', isCoordinator: true, coordinatorDivision: Division.MASAK };
  }
  if (normEmail === 'pemorsian@qomaruddin.com') {
    return { id: uid, email, role: UserRole.CHEF, fullName: 'Koordinator Pemorsian', isCoordinator: true, coordinatorDivision: Division.PEMORSIAN };
  }
  if (normEmail === 'cuci@qomaruddin.com' || normEmail === 'cuci@sppg.com') {
    return { id: uid, email, role: UserRole.ASLAP, fullName: 'Koordinator Cuci Ompreng', isCoordinator: true, coordinatorDivision: Division.CUCI };
  }
  if (normEmail === 'kebersihan@qomaruddin.com' || normEmail === 'kebersihan@sppg.com') {
    return { id: uid, email, role: UserRole.ASLAP, fullName: 'Koordinator Kebersihan & Sanitasi', isCoordinator: true, coordinatorDivision: Division.KEBERSIHAN };
  }
  if (normEmail === 'keamanan@qomaruddin.com' || normEmail === 'kemanan@sppg.com' || normEmail === 'keamanan@sppg.com') {
    return { id: uid, email, role: UserRole.ASLAP, fullName: 'Koordinator Keamanan & Utility', isCoordinator: true, coordinatorDivision: Division.KEAMANAN };
  }

  // Penerima Sasaran (Sekolah / Desa)
  if (normEmail === 'ma@qomaruddin.com') return { id: uid, email, role: UserRole.PENERIMA, fullName: "MA Assa'adah (Penerima)" };
  if (normEmail === 'smk@qomaruddin.com') return { id: uid, email, role: UserRole.PENERIMA, fullName: "SMK Assa'adah (Penerima)" };
  if (normEmail === 'sma@qomaruddin.com') return { id: uid, email, role: UserRole.PENERIMA, fullName: "SMA Assa'adah (Penerima)" };
  if (normEmail === 'mts@qomaruddin.com') return { id: uid, email, role: UserRole.PENERIMA, fullName: "MTS Assa'adah II (Penerima)" };
  if (normEmail === 'sukowati@qomaruddin.com') return { id: uid, email, role: UserRole.PENERIMA, fullName: "Desa Sukowati (Penerima)" };
  if (normEmail === 'sidokumpul@qomaruddin.com') return { id: uid, email, role: UserRole.PENERIMA, fullName: "Desa Sidokumpul (Penerima)" };

  // Fallback Role Publik / Aslap
  if (normEmail.startsWith('aslap')) {
    return { id: uid, email, role: UserRole.ASLAP, fullName: 'Ahmad Maghfur (Aslap)' };
  }

  return {
    id: uid,
    email,
    role: UserRole.ADMIN,
    fullName: email.split('@')[0].toUpperCase() + ' (Staff Dapur)'
  };
}