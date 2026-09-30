import React, { useState, useEffect } from 'react';
import { auth } from '../firebase.ts';
import { 
  signInWithPopup, 
  signInWithRedirect,
  GoogleAuthProvider 
} from 'firebase/auth';
import { useLanguage, Language } from '../LanguageContext.tsx';
import { User } from '../types.ts';

interface AuthScreenProps {
  bannedMessage?: string | null;
  onLoginSuccess?: (user: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ bannedMessage }) => {
  const { language, setLanguage, t } = useLanguage();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
  ];

  const currentLangObj = languages.find(l => l.code === language) || languages[0];

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      // On success, App.tsx's onAuthStateChanged observer handles profile & mounting smoothly
    } catch (err: any) {
      setLoading(false);
      const code = err?.code || '';
      const message = String(err?.message || '');
      console.warn('Google sign-in error:', code, err);

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Jendela login Google ditutup. Silakan klik tombol Masuk untuk mencoba lagi.');
      } else if (code === 'auth/popup-blocked') {
        setError('Jendela pop-up login terblokir oleh peramban. Silakan izinkan pop-up atau klik opsi "Masuk via Redirect" di bawah.');
      } else if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
        setError(`Domain "${window.location.hostname}" belum diotorisasi di Firebase. Silakan tambahkan domain ini ke Firebase Console > Authentication > Settings > Authorized domains.`);
      } else if (code === 'auth/network-request-failed') {
        setError('Koneksi internet bermasalah. Periksa jaringan Anda dan coba lagi.');
      } else {
        setError(err?.message || 'Gagal masuk dengan akun Google. Silakan coba lagi.');
      }
    }
  };

  const handleGoogleRedirectSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      setLoading(false);
      console.error('Redirect sign-in error:', err);
      setError(err?.message || 'Gagal memulai login dengan pengalihan.');
    }
  };

  const handleCopyCurrentDomain = () => {
    try {
      navigator.clipboard.writeText(window.location.hostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    } catch {}
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 bg-white max-w-xl mx-auto border-x border-gray-100">
      {/* Top Language Switcher Bar */}
      <div className="absolute top-5 right-5 z-20">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-black/10 hover:border-black/30 bg-neutral-50 hover:bg-neutral-100 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span>{currentLangObj.flag}</span>
            <span className="uppercase text-[11px] tracking-wider">{currentLangObj.code}</span>
            <i className={`fas fa-chevron-down text-[9px] text-neutral-400 transition-transform ${showLangMenu ? 'rotate-180' : ''}`}></i>
          </button>

          {showLangMenu && (
            <>
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setShowLangMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-44 bg-white border border-neutral-200 rounded-2xl shadow-xl z-40 py-1 overflow-hidden animate-fade-in">
                <div className="px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-neutral-400 border-b border-neutral-100">
                  {t('auth_change_language')}
                </div>
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code);
                      setShowLangMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      language === lang.code 
                        ? 'bg-neutral-900 text-white' 
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                    {language === lang.code && (
                      <i className="fas fa-check text-[10px]"></i>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Brand Header */}
      <div className="text-center mb-8">
        <h1 className="text-6xl font-black tracking-tighter mb-2 text-black">VIMOS</h1>
        <p className="text-xs uppercase tracking-[0.35em] font-extrabold text-neutral-400">
          Monochrome Social Orbit
        </p>
      </div>

      {/* Language Quick Pills */}
      <div className="flex items-center justify-center space-x-1.5 mb-8 p-1 bg-neutral-100 rounded-full border border-black/5">
        {languages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLanguage(lang.code)}
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer ${
              language === lang.code
                ? 'bg-black text-white shadow-xs'
                : 'text-neutral-500 hover:text-black hover:bg-neutral-200/60'
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.code.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {/* Banned Alert */}
      {bannedMessage && (
        <div className="w-full mb-6 p-4 bg-red-50 border border-red-500 text-xs font-bold uppercase text-center text-red-600 animate-pulse rounded-2xl shadow-xs">
          <i className="fas fa-ban mr-1.5"></i>
          {bannedMessage}
        </div>
      )}

      {/* Error Alert with Auto Solution */}
      {error && (
        <div className="w-full mb-6 p-4 bg-red-50 border border-red-200 text-xs font-bold text-center text-red-600 rounded-2xl animate-fade-in space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <i className="fas fa-circle-exclamation text-sm shrink-0"></i>
            <span>{error}</span>
          </div>
          {error.includes('Authorized domains') && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCopyCurrentDomain}
                className="bg-black hover:bg-neutral-800 text-white text-[11px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full transition-all active:scale-95 flex items-center space-x-1.5 mx-auto cursor-pointer shadow-xs"
              >
                <i className={copiedDomain ? "fas fa-check text-emerald-400" : "fas fa-copy"}></i>
                <span>{copiedDomain ? 'Domain Berhasil Disalin!' : `Salin Domain (${window.location.hostname})`}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Google Login Only Card */}
      <div className="w-full bg-neutral-50 border-2 border-black/10 rounded-3xl p-7 shadow-xs flex flex-col items-center text-center space-y-6">
        <div className="space-y-2">
          <div className="w-14 h-14 bg-white border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <svg className="w-7 h-7" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
          </div>
          <h2 className="text-lg font-black text-neutral-900 tracking-tight">
            Masuk dengan Akun Google
          </h2>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
            Akses seluruh fitur Vimos secara instan dan aman hanya menggunakan akun Google Anda.
          </p>
        </div>

        {/* Sole Login Button */}
        <div className="w-full space-y-2">
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full bg-white hover:bg-neutral-100 text-neutral-900 border-2 border-black p-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-200 shadow-md active:scale-98 cursor-pointer flex items-center justify-center space-x-3 disabled:opacity-75"
          >
            {loading ? (
              <>
                <i className="fas fa-circle-notch fa-spin text-base text-neutral-900"></i>
                <span>Menghubungkan ke Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{t('auth_google_continue')}</span>
              </>
            )}
          </button>

          {/* Cancel & Reset Option when connecting */}
          {loading && (
            <div className="pt-2 animate-fade-in flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setLoading(false);
                  setError('Proses masuk dibatalkan. Anda dapat mengklik tombol Masuk kembali.');
                }}
                className="text-[11px] font-black uppercase text-red-600 hover:text-red-700 underline tracking-wider cursor-pointer"
              >
                Batalkan & Coba Lagi
              </button>
            </div>
          )}

          {/* Backup Option: Redirect flow */}
          {!loading && (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleGoogleRedirectSignIn}
                className="text-neutral-500 hover:text-neutral-900 text-[11px] font-bold underline cursor-pointer"
              >
                Pilihan lain: Masuk via Redirect Halaman Penuh
              </button>
            </div>
          )}
        </div>

        {/* If in iframe, offer open in full tab */}
        {isInIframe && (
          <div className="w-full bg-neutral-100 p-3 rounded-2xl text-[11px] text-neutral-600 flex items-center justify-between">
            <span className="font-medium text-left">Buka di tab peramban penuh untuk login Google tanpa hambatan iframe:</span>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-neutral-800 transition-all shrink-0 ml-2"
            >
              Buka Tab Baru <i className="fas fa-arrow-up-right-from-square ml-1"></i>
            </a>
          </div>
        )}

        {/* Feature badges */}
        <div className="w-full pt-2 border-t border-neutral-200/80 grid grid-cols-2 gap-2 text-left">
          <div className="flex items-center space-x-2 text-[11px] font-bold text-neutral-600 bg-white p-2.5 rounded-xl border border-neutral-200/60">
            <i className="fas fa-shield-halved text-neutral-900 text-xs shrink-0"></i>
            <span>Autentikasi Resmi Google</span>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-bold text-neutral-600 bg-white p-2.5 rounded-xl border border-neutral-200/60">
            <i className="fas fa-bolt text-neutral-900 text-xs shrink-0"></i>
            <span>Masuk 1-Klik Tanpa Password</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-[11px] text-neutral-400 font-medium">
        <p>© 2026 Vimos Network. Protected with Google Identity Services.</p>
      </div>
    </div>
  );
};

export default AuthScreen;
