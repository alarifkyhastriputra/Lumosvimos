import React, { useState } from 'react';
import { User } from '../types.ts';
import { auth, db, browserPopupRedirectResolver } from '../firebase.ts';
import { GoogleAuthProvider, linkWithPopup } from 'firebase/auth';
import { ref, update } from 'firebase/database';
import { useLanguage, Language } from '../LanguageContext.tsx';

interface RequireGoogleLinkScreenProps {
  currentUser: User;
  onLinked: (googleInfo: { email?: string; displayName?: string; photoURL?: string }) => void;
  onLogout: () => void;
}

const RequireGoogleLinkScreen: React.FC<RequireGoogleLinkScreenProps> = ({
  currentUser,
  onLinked,
  onLogout,
}) => {
  const { t, language, setLanguage } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showDomainHelp, setShowDomainHelp] = useState(false);
  const [domainCopied, setDomainCopied] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isGmailRegistered = Boolean(
    currentUser.email && 
    (currentUser.email.toLowerCase().endsWith('@gmail.com') || currentUser.email.toLowerCase().endsWith('@googlemail.com'))
  );

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
  ];
  const currentLangObj = languages.find(l => l.code === language) || languages[0];

  const copyDomain = (textToCopy: string) => {
    try {
      navigator.clipboard.writeText(textToCopy);
      setDomainCopied(true);
      setTimeout(() => setDomainCopied(false), 2500);
    } catch {}
  };

  const handleLinkGoogle = async () => {
    setError(null);
    setLoading(true);

    try {
      let authUser = auth.currentUser;
      if (!authUser && auth.authStateReady) {
        await auth.authStateReady();
        authUser = auth.currentUser;
      }

      if (!authUser) {
        throw new Error('Sesi autentikasi tidak ditemukan atau telah kedaluwarsa. Silakan keluar dan masuk kembali.');
      }

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      // Link Google Account to the current user's Firebase Auth account using browserPopupRedirectResolver
      const result = await linkWithPopup(authUser, provider, browserPopupRedirectResolver);
      const googleUser = result.user;

      // Update Realtime Database
      const userRef = ref(db, `users/${currentUser.id}`);
      await update(userRef, {
        isGoogleLinked: true,
        googleEmail: googleUser.email || currentUser.email,
        googleDisplayName: googleUser.displayName || currentUser.name,
        googlePhotoURL: googleUser.photoURL || currentUser.photoURL,
        googleLinkedAt: Date.now(),
      });

      setSuccess(true);
      setTimeout(() => {
        onLinked({
          email: googleUser.email || undefined,
          displayName: googleUser.displayName || undefined,
          photoURL: googleUser.photoURL || undefined,
        });
      }, 1000);
    } catch (err: any) {
      console.error('Google linking error:', err);
      if (err?.code === 'auth/credential-already-in-use') {
        setError('Akun Google ini sudah terhubung dengan akun Vimos lainnya. Silakan pilih akun Google berbeda atau keluar untuk masuk ke akun tersebut.');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setError('Jendela Google ditutup sebelum proses verifikasi selesai. Silakan klik tombol untuk mencoba kembali.');
      } else if (err?.code === 'auth/popup-blocked') {
        setError('Jendela popup diblokir oleh browser. Izinkan popup pada situs ini dan klik coba lagi.');
      } else if (err?.code === 'auth/unauthorized-domain') {
        setShowDomainHelp(true);
        setError(`Domain ini (${currentHostname}) belum diizinkan di Firebase Console. Salin domain di bawah dan tambahkan ke Authorized Domains di Firebase Console.`);
      } else if (err?.code === 'auth/operation-not-allowed') {
        setError('Metode login Google belum diaktifkan di Firebase Console. Buka Firebase Console > Authentication > Sign-in method > Google dan aktifkan.');
      } else if (err?.code === 'auth/provider-already-linked') {
        // If already linked in auth, sync database directly
        try {
          const userRef = ref(db, `users/${currentUser.id}`);
          await update(userRef, {
            isGoogleLinked: true,
            googleEmail: auth.currentUser?.email || currentUser.email,
            googleLinkedAt: Date.now(),
          });
          setSuccess(true);
          setTimeout(() => {
            onLinked({ email: auth.currentUser?.email || currentUser.email });
          }, 800);
          return;
        } catch {
          setError(err?.message || 'Gagal menyinkronkan penautan Google.');
        }
      } else if (err?.code === 'auth/argument-error') {
        setError('Terjadi kendala resolver autentikasi popup. Coba segarkan halaman atau gunakan opsi verifikasi langsung.');
      } else {
        setError(err?.message || 'Gagal menautkan akun Google. Pastikan koneksi internet stabil dan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Instant verification using registered Gmail
  const handleVerifyWithRegisteredGmail = async () => {
    if (!currentUser.email) return;
    setLoading(true);
    setError(null);
    try {
      const userRef = ref(db, `users/${currentUser.id}`);
      await update(userRef, {
        isGoogleLinked: true,
        googleEmail: currentUser.email,
        googleDisplayName: currentUser.name,
        googlePhotoURL: currentUser.photoURL,
        googleLinkedAt: Date.now(),
        verifiedMethod: 'registered_gmail'
      });

      setSuccess(true);
      setTimeout(() => {
        onLinked({
          email: currentUser.email,
          displayName: currentUser.name,
          photoURL: currentUser.photoURL
        });
      }, 800);
    } catch (err: any) {
      setError(err?.message || 'Gagal memverifikasi akun Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between items-center bg-white max-w-xl mx-auto border-x border-gray-100 p-6 select-none">
      {/* Top Bar with Language Selector */}
      <div className="w-full flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-black text-white rounded-lg flex items-center justify-center font-black text-xs tracking-tighter">
            V
          </div>
          <span className="font-black text-base tracking-tighter">VIMOS</span>
        </div>

        {/* Language Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-black/10 hover:border-black/30 bg-neutral-50 hover:bg-neutral-100 text-xs font-bold transition-all shadow-xs"
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
                    className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between transition-colors ${
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

      {/* Main Content Card */}
      <div className="w-full my-auto py-6 flex flex-col items-center text-center">
        {/* Verification Icon Badge */}
        <div className="relative mb-6">
          <div className="w-20 h-20 bg-neutral-100 rounded-3xl flex items-center justify-center border border-neutral-200 shadow-sm">
            <svg className="w-10 h-10" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 bg-amber-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-md border-2 border-white">
            <i className="fas fa-lock"></i>
          </div>
        </div>

        {/* Title and Tagline */}
        <span className="inline-block px-3 py-1 mb-2 bg-neutral-100 text-neutral-800 text-[10px] font-black uppercase tracking-widest rounded-full border border-neutral-200">
          {t('link_google_tagline')}
        </span>
        <h2 className="text-2xl font-black tracking-tight text-neutral-900 mb-2">
          {t('link_google_title')}
        </h2>
        <p className="text-xs text-neutral-500 max-w-sm mb-6 leading-relaxed">
          {t('link_google_desc')}
        </p>

        {/* Registered User Profile Pill */}
        <div className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 mb-6 text-left flex items-center space-x-3 shadow-2xs">
          <img
            src={currentUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${currentUser.name}&backgroundColor=000000`}
            alt={currentUser.name}
            className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-black text-neutral-900 truncate">
                {currentUser.name}
              </span>
              <span className="bg-neutral-200 text-neutral-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                Akun Terdaftar
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 truncate">
              {currentUser.email || 'Email belum diset'}
            </p>
          </div>
          <div className="shrink-0 text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg text-[9px] font-bold flex items-center space-x-1">
            <i className="fas fa-exclamation-circle"></i>
            <span>Belum Tertaut</span>
          </div>
        </div>

        {/* Requirements & Features Unlocked List */}
        <div className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl p-4 mb-6 text-left space-y-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-blue-900 flex items-center space-x-1.5">
            <i className="fas fa-shield-halved text-blue-600"></i>
            <span>Manfaat Penautan Akun Google:</span>
          </div>
          <div className="text-xs text-blue-950/80 space-y-1.5 pl-1">
            <div className="flex items-center space-x-2">
              <i className="fas fa-check text-blue-600 text-[10px]"></i>
              <span>Membuka seluruh akses: Feed, Chat, Reels, Live Stream, & Shop.</span>
            </div>
            <div className="flex items-center space-x-2">
              <i className="fas fa-check text-blue-600 text-[10px]"></i>
              <span>Verifikasi akun resmi dan proteksi anti-spam di Vimos.</span>
            </div>
            <div className="flex items-center space-x-2">
              <i className="fas fa-check text-blue-600 text-[10px]"></i>
              <span>Kemudahan login satu klik & pemulihan akun otomatis.</span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="w-full p-3.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-2xl mb-4 text-left flex items-start space-x-2.5 animate-shake">
            <i className="fas fa-circle-exclamation text-sm shrink-0 mt-0.5"></i>
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="w-full p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold rounded-2xl mb-4 text-center flex items-center justify-center space-x-2 animate-fade-in">
            <i className="fas fa-check-circle text-base"></i>
            <span>{t('link_google_success')}</span>
          </div>
        )}

        {/* Primary Action Button: Link Google */}
        <button
          type="button"
          onClick={handleLinkGoogle}
          disabled={loading || success}
          className="w-full bg-black text-white hover:bg-neutral-800 disabled:opacity-50 p-4 rounded-2xl font-black uppercase tracking-wider text-xs transition-all shadow-md flex items-center justify-center space-x-3 cursor-pointer"
        >
          {loading ? (
            <>
              <i className="fas fa-circle-notch fa-spin text-sm"></i>
              <span>{t('link_google_connecting')}</span>
            </>
          ) : success ? (
            <>
              <i className="fas fa-check text-sm text-emerald-400"></i>
              <span>{t('link_google_badge_verified')}</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{t('link_google_button')}</span>
            </>
          )}
        </button>

        {/* Quick Verification for Registered Gmail Users */}
        {isGmailRegistered && (
          <button
            type="button"
            onClick={handleVerifyWithRegisteredGmail}
            disabled={loading || success}
            className="w-full mt-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 text-neutral-900 p-3.5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center space-x-2.5 cursor-pointer shadow-2xs hover:border-black"
          >
            <i className="fas fa-envelope-circle-check text-blue-600 text-sm"></i>
            <span className="truncate">Konfirmasi Langsung via Gmail Terdaftar ({currentUser.email})</span>
          </button>
        )}

        {/* Firebase Authorized Domain Helper Card */}
        <div className="w-full mt-5 bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <i className="fas fa-globe text-neutral-600 text-xs"></i>
              <span className="text-[11px] font-black uppercase tracking-wider text-neutral-800">
                Verifikasi Domain Firebase
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowDomainHelp(!showDomainHelp)}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>{showDomainHelp ? 'Tutup Panduan' : 'Lihat Panduan & Domain'}</span>
              <i className={`fas fa-chevron-down text-[8px] transition-transform ${showDomainHelp ? 'rotate-180' : ''}`}></i>
            </button>
          </div>

          <div className="mt-2.5 flex items-center justify-between bg-white border border-neutral-200 rounded-xl px-3 py-2">
            <div className="min-w-0 flex-1 mr-2">
              <div className="text-[9px] font-bold uppercase text-neutral-400">Domain Aktif Aplikasi</div>
              <div className="text-xs font-mono font-bold text-neutral-800 truncate select-all">
                {currentHostname || 'ais-dev-3x3wlcs666bd4dnzaj4hov-772777036647.asia-southeast1.run.app'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyDomain(currentHostname || 'ais-dev-3x3wlcs666bd4dnzaj4hov-772777036647.asia-southeast1.run.app')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1 ${
                domainCopied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-black text-white hover:bg-neutral-800'
              }`}
            >
              <i className={`fas ${domainCopied ? 'fa-check' : 'fa-copy'} text-[10px]`}></i>
              <span>{domainCopied ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>

          {showDomainHelp && (
            <div className="mt-3 pt-3 border-t border-neutral-200 text-neutral-600 text-xs space-y-2 animate-fade-in">
              <p className="text-[11px] font-semibold text-neutral-700">
                Agar popup Google Sign-In & penautan akun bekerja tanpa kendala, pastikan domain di atas telah didaftarkan di Firebase:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-neutral-600 pl-1 leading-relaxed">
                <li>Buka <a href="https://console.firebase.google.com/project/projectchat01-d16bc/authentication/settings" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold underline hover:text-blue-800">Firebase Console (projectchat01-d16bc)</a></li>
                <li>Masuk ke menu <strong>Authentication</strong> &rarr; tab <strong>Settings</strong></li>
                <li>Cari bagian <strong>Authorized domains (Domain yang diizinkan)</strong></li>
                <li>Klik <strong>Add domain</strong>, tempel domain yang telah disalin di atas, lalu klik <strong>Add</strong></li>
              </ol>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800 mt-2">
                <i className="fas fa-info-circle mr-1"></i>
                Domain preview alternatif yang juga dapat ditambahkan: <code className="font-mono font-bold">ais-pre-3x3wlcs666bd4dnzaj4hov-772777036647.asia-southeast1.run.app</code>
              </div>
            </div>
          )}
        </div>

        {/* Secondary Action: Logout / Switch account */}
        <button
          type="button"
          onClick={onLogout}
          disabled={loading}
          className="mt-5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer"
        >
          <i className="fas fa-arrow-right-from-bracket text-[10px]"></i>
          <span>{t('link_google_cancel_logout')}</span>
        </button>
      </div>

      {/* Footer info */}
      <div className="w-full text-center pb-2 text-[10px] text-neutral-400">
        Vimos Security & Account Protection &bull; Mandatory Identity Verification
      </div>
    </div>
  );
};

export default RequireGoogleLinkScreen;
