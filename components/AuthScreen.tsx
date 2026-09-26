
import React, { useState } from 'react';
import { auth, db, browserPopupRedirectResolver } from '../firebase.ts';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { ref, set, get, update } from 'firebase/database';
import { useLanguage, Language } from '../LanguageContext.tsx';

interface AuthScreenProps {
  bannedMessage?: string | null;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ bannedMessage }) => {
  const { language, setLanguage, t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
  ];

  const currentLangObj = languages.find(l => l.code === language) || languages[0];

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      const user = userCredential.user;

      const userRef = ref(db, `users/${user.uid}`);
      const snapshot = await get(userRef);
      if (!snapshot.exists()) {
        const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Vimos Member');
        await set(userRef, {
          name: displayName,
          email: user.email || '',
          bio: 'A wandering soul in Vimos.',
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.uid}&backgroundColor=000000`,
          followers: {},
          following: {},
          recentCaptures: {},
          totalLikes: 0,
          isAdmin: false,
          isGoogleLinked: true,
          googleEmail: user.email || '',
          googleDisplayName: user.displayName || displayName,
          googlePhotoURL: user.photoURL || '',
          googleLinkedAt: Date.now()
        });
      } else {
        await update(userRef, {
          isGoogleLinked: true,
          googleEmail: user.email || '',
          googleDisplayName: user.displayName || snapshot.val().name || '',
          googlePhotoURL: user.photoURL || snapshot.val().photoURL || '',
        });
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        // User closed popup without signing in
      } else if (err?.code === 'auth/popup-blocked') {
        setError('Jendela popup Google diblokir browser. Izinkan popup dan coba lagi.');
      } else if (err?.code === 'auth/unauthorized-domain') {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        setError(`Domain ini (${hostname}) belum diizinkan di Firebase Console. Tambahkan ke Authorized Domains di Firebase Console > Authentication > Settings.`);
      } else if (err?.code === 'auth/operation-not-allowed') {
        setError('Metode login Google belum diaktifkan di Firebase Console. Aktifkan di Authentication > Sign-in method.');
      } else if (err?.code === 'auth/argument-error') {
        setError('Terjadi kendala konfigurasi popup. Silakan coba lagi.');
      } else {
        setError(err?.message || 'Gagal masuk dengan Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!username.trim()) {
          setError(t('auth_error_username'));
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const trimmedUsername = username.trim();

        // Update profile display name in Firebase Auth
        await updateProfile(user, { displayName: trimmedUsername });

        // Save user profile directly to Realtime Database
        // isGoogleLinked is initialized to false so user is required to link Google before accessing Vimos web features
        const userRef = ref(db, `users/${user.uid}`);
        await set(userRef, {
          name: trimmedUsername,
          email: user.email || email,
          bio: 'A wandering soul in Vimos.',
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.uid}&backgroundColor=000000`,
          followers: {},
          following: {},
          recentCaptures: {},
          totalLikes: 0,
          isAdmin: false,
          isGoogleLinked: false,
        });
      }
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        setError(t('auth_error_email_in_use'));
      } else if (err?.code === 'auth/weak-password') {
        setError(t('auth_error_weak_pass'));
      } else if (err?.code === 'auth/invalid-email') {
        setError(t('auth_error_invalid_email'));
      } else {
        setError(t('auth_error_general'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 bg-white max-w-xl mx-auto border-x border-gray-100">
      {/* Top Language Switcher Bar */}
      <div className="absolute top-5 right-5 z-20">
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

      <div className="text-center mb-8">
        <h1 className="text-5xl font-black tracking-tighter mb-2">VIMOS</h1>
        <p className="text-xs uppercase tracking-[0.3em] font-bold text-gray-400">
          {isLogin ? t('auth_tagline_login') : t('auth_tagline_register')}
        </p>
      </div>

      {/* Quick Language Pills below title */}
      <div className="flex items-center justify-center space-x-1.5 mb-6 p-1 bg-neutral-100 rounded-full border border-black/5">
        {languages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLanguage(lang.code)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center space-x-1 ${
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

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {bannedMessage && (
          <div className="p-3 bg-red-50 border border-red-500 text-xs font-bold uppercase text-center text-red-600 animate-pulse rounded-xl">
            {bannedMessage}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs font-bold text-center text-red-600 rounded-xl">
            {error}
          </div>
        )}
        
        {!isLogin && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-gray-700">
              {t('auth_username_label')}
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-black rounded-2xl focus:outline-none focus:bg-white transition-all text-sm font-medium"
              placeholder={t('auth_username_placeholder')}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-gray-700">
            {t('auth_email_label')}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 bg-gray-50 border-2 border-black rounded-2xl focus:outline-none focus:bg-white transition-all text-sm font-medium"
            placeholder={t('auth_email_placeholder')}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-gray-700">
            {t('auth_password_label')}
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 bg-gray-50 border-2 border-black rounded-2xl focus:outline-none focus:bg-white transition-all text-sm font-medium"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white p-4 rounded-2xl font-black uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50 mt-2 shadow-xs cursor-pointer"
        >
          {loading ? t('auth_processing') : (isLogin ? t('auth_submit_login') : t('auth_submit_register'))}
        </button>

        {/* Mandatory Google Linking Notice for Registration */}
        {!isLogin && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start space-x-2">
            <i className="fas fa-shield-halved text-amber-600 mt-0.5 shrink-0"></i>
            <span>{t('auth_must_link_google_hint')}</span>
          </div>
        )}

        {/* Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <span className="relative bg-white px-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
            {t('auth_or_divider')}
          </span>
        </div>

        {/* Google One-Click Auth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white text-gray-900 border-2 border-gray-200 hover:border-black p-3.5 rounded-2xl font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center space-x-3 shadow-2xs hover:shadow-xs disabled:opacity-50 cursor-pointer"
        >
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
          <span>{t('auth_google_continue')}</span>
        </button>
      </form>

      <button
        onClick={() => {
          setIsLogin(!isLogin);
          setError('');
        }}
        className="mt-8 text-xs font-black uppercase tracking-widest hover:underline text-gray-600"
      >
        {isLogin ? t('auth_switch_to_register') : t('auth_switch_to_login')}
      </button>
    </div>
  );
};

export default AuthScreen;
