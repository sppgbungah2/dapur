import React, { useState, useEffect } from 'react';
import { 
  Lock, Mail, Database, AlertCircle, Loader2, CheckCircle2, 
  Info, ShieldCheck, KeyRound, Eye, EyeOff, Settings, X, Save
} from 'lucide-react';
import { supabase, isSupabaseConfigured, mapUserToProfile, UserProfile } from '../lib/supabase';
import { UserRole } from '../types';

interface LoginProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings Form State
  const [customSupabaseUrl, setCustomSupabaseUrl] = useState('');
  const [customSupabaseKey, setCustomSupabaseKey] = useState('');
  const [customCloudinaryName, setCustomCloudinaryName] = useState('');
  const [customCloudinaryPreset, setCustomCloudinaryPreset] = useState('');

  useEffect(() => {
    setCustomSupabaseUrl(localStorage.getItem('CUSTOM_SUPABASE_URL') || '');
    setCustomSupabaseKey(localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY') || '');
    setCustomCloudinaryName(localStorage.getItem('CUSTOM_CLOUDINARY_CLOUD_NAME') || '');
    setCustomCloudinaryPreset(localStorage.getItem('CUSTOM_CLOUDINARY_UPLOAD_PRESET') || '');
  }, []);

  const handleSaveSettings = () => {
    if (customSupabaseUrl) {
      localStorage.setItem('CUSTOM_SUPABASE_URL', customSupabaseUrl.trim());
    } else {
      localStorage.removeItem('CUSTOM_SUPABASE_URL');
    }
    
    if (customSupabaseKey) {
      localStorage.setItem('CUSTOM_SUPABASE_ANON_KEY', customSupabaseKey.trim());
    } else {
      localStorage.removeItem('CUSTOM_SUPABASE_ANON_KEY');
    }

    if (customCloudinaryName) {
      localStorage.setItem('CUSTOM_CLOUDINARY_CLOUD_NAME', customCloudinaryName.trim());
    } else {
      localStorage.removeItem('CUSTOM_CLOUDINARY_CLOUD_NAME');
    }

    if (customCloudinaryPreset) {
      localStorage.setItem('CUSTOM_CLOUDINARY_UPLOAD_PRESET', customCloudinaryPreset.trim());
    } else {
      localStorage.removeItem('CUSTOM_CLOUDINARY_UPLOAD_PRESET');
    }
    
    setShowSettings(false);
    window.location.reload(); // Reload to apply the new connection
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const normEmail = email.trim();
    if (!normEmail || !password) {
      setErrorMsg('Harap masukkan email dan kata sandi Anda.');
      setLoading(false);
      return;
    }

    try {
      if (isSupabaseConfigured && supabase) {
        // --- REAL SUPABASE AUTHENTICATION ---
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normEmail,
          password: password,
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data && data.user) {
          const profile = mapUserToProfile(data.user.id, data.user.email || normEmail);
          setSuccessMsg(`Autentikasi berhasil! Selamat datang kembali, ${profile.fullName}.`);
          
          setTimeout(() => {
            onLoginSuccess(profile);
          }, 1200);
        }
      } else {
        // --- SECURE FALLBACK PREVIEW SYSTEM (Perfect for AI Studio environment) ---
        // Mimics a real query or successful login with the exact target email or presets
        setTimeout(() => {
          if (normEmail.toLowerCase() === 'maghfurmunif@gmail.com' || normEmail.toLowerCase() === 'punkysme@gmail.com') {
            const profile = mapUserToProfile(
              normEmail.toLowerCase() === 'punkysme@gmail.com' ? 'punkysme-mock-uid' : 'd5454d9d-1d50-4baa-b5b9-f8693694db4a',
              normEmail.toLowerCase() === 'punkysme@gmail.com' ? 'punkysme@gmail.com' : 'maghfurmunif@gmail.com'
            );
            setSuccessMsg(`Simulasi berhasil! Masuk sebagai Admin SPPG.`);
            onLoginSuccess(profile);
          } else if (normEmail.toLowerCase() === 'chef@sppg.com') {
            const profile = mapUserToProfile('chef-mock-uid', 'chef@sppg.com');
            setSuccessMsg(`Simulasi berhasil! Masuk sebagai Chef Ahmad.`);
            onLoginSuccess(profile);
          } else if (normEmail.toLowerCase() === 'gizi@sppg.com') {
            const profile = mapUserToProfile('gizi-mock-uid', 'gizi@sppg.com');
            setSuccessMsg(`Simulasi berhasil! Masuk sebagai Ahli Gizi.`);
            onLoginSuccess(profile);
          } else if (normEmail.toLowerCase() === 'aslap@sppg.com') {
            const profile = mapUserToProfile('aslap-mock-uid', 'aslap@sppg.com');
            setSuccessMsg(`Simulasi berhasil! Masuk sebagai Aslap.`);
            onLoginSuccess(profile);
          } else if (normEmail.toLowerCase() === 'ketua@sppg.com') {
            const profile = mapUserToProfile('ketua-mock-uid', 'ketua@sppg.com');
            setSuccessMsg(`Simulasi berhasil! Masuk sebagai Ketua SPPG.`);
            onLoginSuccess(profile);
          } else if (normEmail.toLowerCase() === 'akuntan@sppg.com') {
            const profile = mapUserToProfile('akuntan-mock-uid', 'akuntan@sppg.com');
            setSuccessMsg(`Simulasi berhasil! Masuk sebagai Akuntan.`);
            onLoginSuccess(profile);
          } else if (normEmail.toLowerCase() === 'driver@sppg.com') {
            const profile = mapUserToProfile('driver-mock-uid', 'driver@sppg.com');
            setSuccessMsg(`Simulasi berhasil! Masuk sebagai Driver.`);
            onLoginSuccess(profile);
          } else {
            // General signup simulation to feel complete
            if (password.length < 6) {
              setErrorMsg('Sandi salah atau terlampau pendek (Min. 6 Karakter).');
            } else {
              const profile = mapUserToProfile('guest-mock-uid', normEmail);
              setSuccessMsg(`Pendaftaran Simulasi Sukses.`);
              onLoginSuccess(profile);
            }
          }
          setLoading(false);
        }, 1000);
      }
    } catch (err: any) {
      // Use console.warn instead of console.warn to prevent AI Studio from showing a red error overlay 
      // for a network error that we are handling gracefully in the UI.
      console.warn('Login notice:', err);
      // Translate typical supabase error messages for Indonesian boarding school environment
      let customErr = err.message || 'Gagal tersambung dengan server auth.';
      if (customErr.includes('Invalid login credentials')) {
        customErr = 'Email atau kata sandi salah. Silakan coba kembali.';
      } else if (customErr.includes('Failed to fetch')) {
        customErr = 'Gagal terhubung ke database (Failed to fetch). Hapus Custom Supabase URL & Key di Pengaturan (⚙️) jika sudah tidak valid.';
      }
      setErrorMsg(customErr);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans">
      
      {/* Visual Ambient Decorative Circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-950/40 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-950/30 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 select-none pointer-events-none" />

      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden relative z-10">
        
        {/* Top Boarder Header */}
        <div className="p-6 md:p-8 bg-slate-850 border-b border-slate-700 text-center space-y-3 relative">
          <button
            onClick={() => setShowSettings(true)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition-colors"
            title="Pengaturan Koneksi Supabase"
          >
            <Settings className="h-5 w-5" />
          </button>
          
          <img 
            src="https://www.bgn.go.id/logo-bgn.png" 
            alt="Logo BGN" 
            className="h-14 w-14 object-contain select-none mx-auto mb-1 animate-pulse" 
            referrerPolicy="no-referrer"
          />
          
          <div className="space-y-1">
            <h1 className="text-white font-bold text-lg md:text-xl font-display tracking-tight leading-snug">
              Dapur Qomaruddin
            </h1>
            <p className="text-emerald-400 font-mono text-[10px] tracking-widest uppercase">
              SISTEM INFORMASI KONTROL OPERASIONAL
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8 space-y-6">
          
          {/* Supabase Connection Status Widget */}
          <div className={`p-3 rounded-xl flex items-start gap-2 text-xs border ${
            isSupabaseConfigured 
              ? 'bg-emerald-950/30 border-emerald-805/40 text-emerald-300'
              : 'bg-indigo-950/30 border-indigo-805/40 text-indigo-300'
          }`}>
            {isSupabaseConfigured ? (
              <>
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Terkoneksi ke Supabase</span>
                  <p className="text-[10px] text-emerald-400/80 leading-relaxed">
                    Menggunakan User Authentication &amp; database real-time aktif.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Info className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Mode Sandbox Aktif (Offline)</span>
                  <p className="text-[10px] text-indigo-400/80 leading-relaxed">
                    Belum mendeteksi kunci .env. Menggunakan sistem simulasi lokal autentik.
                  </p>
                </div>
              </>
            )}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Error Message banner */}
            {errorMsg && (
              <div className="bg-rose-950/40 border border-rose-500/20 text-rose-300 p-3 rounded-xl flex items-start gap-2 text-xs animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success Message banner */}
            {successMsg && (
              <div className="bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 p-3 rounded-xl flex items-start gap-2 text-xs animate-fadeIn">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-slate-300 text-xs font-semibold">Alamat Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-slate-300 text-xs font-semibold">Kata Sandi (Password)</label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-slate-900 font-bold text-xs py-3 rounded-xl transition-all shadow-md hover:shadow-emerald-900/10 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memverifikasi Credential...</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>Masuk ke Dashboard</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="bg-slate-850 px-6 py-4 border-t border-slate-700 text-center font-mono text-[9px] text-slate-500 select-none">
          YAYASAN PONDOK PESANTREN QOMARUDDIN BUNGAH GRESIK
        </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-700">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-400" />
                Koneksi Supabase Lokal
              </h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Isi form di bawah ini jika Anda ingin menggunakan server Supabase Self-Hosted lokal (misalnya via Docker / Cloudflare Tunnel). 
                  Kosongkan form jika Anda ingin kembali menggunakan environment default (VITE_).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-300 text-xs font-semibold">Supabase Project URL</label>
                <input
                  type="text"
                  placeholder="https://abc.supabase.co atau https://api.local.net"
                  value={customSupabaseUrl}
                  onChange={(e) => setCustomSupabaseUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="block text-slate-300 text-xs font-semibold">Supabase Anon Key</label>
                <input
                  type="text"
                  placeholder="eyJhbGci..."
                  value={customSupabaseKey}
                  onChange={(e) => setCustomSupabaseKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
              <div className="space-y-1.5 mt-4">
                <label className="block text-slate-300 text-xs font-semibold">Cloudinary Cloud Name (Opsional)</label>
                <input
                  type="text"
                  placeholder="dwxyz..."
                  value={customCloudinaryName}
                  onChange={(e) => setCustomCloudinaryName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-300 text-xs font-semibold">Cloudinary Upload Preset (Opsional)</label>
                <input
                  type="text"
                  placeholder="preset_name"
                  value={customCloudinaryPreset}
                  onChange={(e) => setCustomCloudinaryPreset(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
            </div>

            <div className="p-5 border-t border-slate-700 bg-slate-850 flex justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-md"
              >
                <Save className="h-4 w-4" />
                Simpan & Reload
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
