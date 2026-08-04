import { createClient } from '@supabase/supabase-js';
import { UserRole, Division } from '../types';

const getLocalStorage = (key: string) => {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (e) {
    // ignore
  }
  return null;
};

const supabaseUrl = getLocalStorage('CUSTOM_SUPABASE_URL') || (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = getLocalStorage('CUSTOM_SUPABASE_ANON_KEY') || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Clean up standard placeholder strings and invalid values
const isValidUrl = (url: string) => url && url.startsWith('http') && !url.includes('your_project_id') && !url.includes('api.local.net') && url !== 'null' && url !== 'undefined';
const isValidKey = (key: string) => key && !key.includes('your_public_anon_key_here') && !key.includes('mock-anon-key') && key.trim() !== '' && key !== 'null' && key !== 'undefined';

export const isSupabaseConfigured = isValidUrl(supabaseUrl) && isValidKey(supabaseAnonKey);

// Real Supabase client instance (or null if not yet configured)
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        timeout: 10000,
      }
    })
  : null;

// User custom profile mapping helper
export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  isCoordinator?: boolean;
  coordinatorDivision?: Division;
}

// Map emails or user UIDs to the relevant operational role in SPPG Kitchen
export function mapUserToProfile(uid: string, email: string): UserProfile {
  const normEmail = email.toLowerCase().trim();
  
  // Specific instruction: User maghfurmunif@gmail.com and punkysme@gmail.com are Admins
  if (normEmail === 'maghfurmunif@gmail.com' || normEmail === 'punkysme@gmail.com' || uid === 'd5454d9d-1d50-4baa-b5b9-f8693694db4a') {
    return {
      id: uid,
      email: normEmail === 'punkysme@gmail.com' ? 'punkysme@gmail.com' : 'maghfurmunif@gmail.com',
      role: UserRole.ADMIN,
      fullName: normEmail === 'punkysme@gmail.com' ? 'Ahmad Fajrul Falah (Admin Utama)' : 'Ustadz Maghfur Munif (Admin Utama)'
    };
  }

  // --- ADMIN UTAMA ---
  if (normEmail === 'maghfur@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.ADMIN,
      fullName: 'Ustadz Maghfur Munif (Admin Utama)'
    };
  }
  if (normEmail === 'rifkah@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.ADMIN,
      fullName: 'Ibu Rifkah (Admin Utama)'
    };
  }
  if (normEmail === 'fajar@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.ADMIN,
      fullName: 'Bpk. Fajar (Admin Utama)'
    };
  }
  if (normEmail === 'sam@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.ADMIN,
      fullName: 'Bpk. Sam (Admin Utama)'
    };
  }

  // --- PENERIMA SASARAN ---
  if (normEmail === 'ma@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.PENERIMA,
      fullName: "MA Assa'adah (Penerima)"
    };
  }
  if (normEmail === 'smk@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.PENERIMA,
      fullName: "SMK Assa'adah (Penerima)"
    };
  }
  if (normEmail === 'sma@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.PENERIMA,
      fullName: "SMA Assa'adah (Penerima)"
    };
  }
  if (normEmail === 'mts@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.PENERIMA,
      fullName: "MTS Assa'adah II (Penerima)"
    };
  }
  if (normEmail === 'sukowati@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.PENERIMA,
      fullName: "Desa Sukowati (Penerima)"
    };
  }
  if (normEmail === 'sidokumpul@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.PENERIMA,
      fullName: "Desa Sidokumpul (Penerima)"
    };
  }

  // --- TIM UTAMA ---
  if (normEmail === 'chef@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.CHEF,
      fullName: 'Rizka Aulia (Head Chef)'
    };
  }
  if (normEmail === 'gizi@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.AHLI_GIZI,
      fullName: 'Avianti Rahma Dianita (Ahli Gizi)'
    };
  }
  if (normEmail === 'akuntan@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.AKUNTAN,
      fullName: 'Staff Akuntan (Tim Utama)'
    };
  }

  // --- DIVISI ---
  if (normEmail === 'stocking@qomaruddin.com' || normEmail === 'stocking@sppg.com') {
    return {
      id: uid,
      email,
      role: UserRole.CHEF,
      fullName: 'Koordinator Persiapan & Stocking',
      isCoordinator: true,
      coordinatorDivision: Division.STOCKING
    };
  }

  if (normEmail === 'persiapan@sppg.com') {
    return {
      id: uid,
      email,
      role: UserRole.CHEF,
      fullName: 'Koordinator Persiapan & Stocking',
      isCoordinator: true,
      coordinatorDivision: Division.STOCKING
    };
  }

  if (normEmail === 'masak@qomaruddin.com' || normEmail === 'masak@sppg.com') {
    return {
      id: uid,
      email,
      role: UserRole.CHEF,
      fullName: 'Koordinator Masak',
      isCoordinator: true,
      coordinatorDivision: Division.MASAK
    };
  }

  if (normEmail === 'pemorsian@qomaruddin.com') {
    return {
      id: uid,
      email,
      role: UserRole.CHEF,
      fullName: 'Koordinator Pemorsian',
      isCoordinator: true,
      coordinatorDivision: Division.PEMORSIAN
    };
  }

  if (normEmail === 'driver@qomaruddin.com' || normEmail === 'driver@sppg.com') {
    return {
      id: uid,
      email,
      role: UserRole.DRIVER,
      fullName: 'Imam Durori (Driver)',
      isCoordinator: true,
      coordinatorDivision: Division.DRIVER
    };
  }

  if (normEmail === 'cuci@qomaruddin.com' || normEmail === 'cuci@sppg.com') {
    return {
      id: uid,
      email,
      role: UserRole.ASLAP,
      fullName: 'Koordinator Cuci Ompreng',
      isCoordinator: true,
      coordinatorDivision: Division.CUCI
    };
  }

  if (normEmail === 'kebersihan@qomaruddin.com' || normEmail === 'kebersihan@sppg.com') {
    return {
      id: uid,
      email,
      role: UserRole.ASLAP,
      fullName: 'Koordinator Kebersihan & Sanitasi',
      isCoordinator: true,
      coordinatorDivision: Division.KEBERSIHAN
    };
  }

  if (normEmail === 'keamanan@qomaruddin.com' || normEmail === 'kemanan@sppg.com' || normEmail === 'keamanan@sppg.com') {
    return {
      id: uid,
      email,
      role: UserRole.ASLAP,
      fullName: 'Koordinator Keamanan & Utility',
      isCoordinator: true,
      coordinatorDivision: Division.KEAMANAN
    };
  }

  // Predefined convenience mail accounts for other legacy roles
  if (normEmail === 'ketua@sppg.com') {
    return {
      id: uid,
      email,
      role: UserRole.ADMIN,
      fullName: 'Ketua SPPG'
    };
  }

  if (normEmail.startsWith('akuntan')) {
    return {
      id: uid,
      email,
      role: UserRole.AKUNTAN,
      fullName: 'Staff Akuntan SPPG'
    };
  }

  if (normEmail.startsWith('chef')) {
    return {
      id: uid,
      email,
      role: UserRole.CHEF,
      fullName: 'Rizka Aulia (Head Chef)'
    };
  }
  
  if (normEmail.startsWith('gizi')) {
    return {
      id: uid,
      email,
      role: UserRole.AHLI_GIZI,
      fullName: 'Avianti Rahma Dianita (Ahli Gizi)'
    };
  }
  
  if (normEmail.startsWith('aslap')) {
    return {
      id: uid,
      email,
      role: UserRole.ASLAP,
      fullName: 'Ahmad Maghfur (Aslap)'
    };
  }

  // Default fallback for any other registered users
  return {
    id: uid,
    email,
    role: UserRole.ADMIN, // Default to admin for user-created emails to ensure they have all capabilities
    fullName: email.split('@')[0].toUpperCase() + ' (Staff Dapur)'
  };
}
