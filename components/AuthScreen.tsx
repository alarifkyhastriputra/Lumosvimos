
import React, { useState } from 'react';
import { auth, db } from '../firebase.ts';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { useLanguage } from '../LanguageContext.tsx';

interface AuthScreenProps {
  bannedMessage?: string | null;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ bannedMessage }) => {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!username.trim()) {
          setError('Silakan masukkan Username Anda.');
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const trimmedUsername = username.trim();

        // Update profile display name in Firebase Auth
        await updateProfile(user, { displayName: trimmedUsername });

        // Save user profile directly to Realtime Database
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
          isAdmin: false
        });
      }
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        setError('Email/Gmail ini sudah terdaftar. Silakan login.');
      } else if (err?.code === 'auth/weak-password') {
        setError('Password terlalu pendek. Gunakan minimal 6 karakter.');
      } else if (err?.code === 'auth/invalid-email') {
        setError('Format Gmail/Email tidak valid.');
      } else {
        setError('Kesalahan akun. Periksa kembali email dan password Anda.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white max-w-xl mx-auto border-x border-gray-100">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black tracking-tighter mb-2">VIMOS</h1>
        <p className="text-xs uppercase tracking-[0.3em] font-bold text-gray-400">
          {isLogin ? 'Enter the shadows' : 'Create your account'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {bannedMessage && (
          <div className="p-3 bg-red-50 border border-red-500 text-xs font-bold uppercase text-center text-red-600 animate-pulse">
            {bannedMessage}
          </div>
        )}
        {error && (
          <div className="p-3 bg-gray-50 border border-black text-xs font-bold uppercase text-center text-red-600">
            {error}
          </div>
        )}
        
        {!isLogin && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-gray-700">
              Username / Nama Pengguna
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 bg-gray-50 border-2 border-black rounded-2xl focus:outline-none focus:bg-white transition-all text-sm font-medium"
              placeholder="Username unik Anda"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-gray-700">
            Gmail / Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 bg-gray-50 border-2 border-black rounded-2xl focus:outline-none focus:bg-white transition-all text-sm font-medium"
            placeholder="nama@gmail.com"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest ml-2 text-gray-700">
            Password / Kata Sandi
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
          className="w-full bg-black text-white p-4 rounded-2xl font-black uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50 mt-2"
        >
          {loading ? 'Processing...' : (isLogin ? 'Enter Vimos' : 'Daftar Akun')}
        </button>
      </form>

      <button
        onClick={() => {
          setIsLogin(!isLogin);
          setError('');
        }}
        className="mt-8 text-xs font-black uppercase tracking-widest hover:underline text-gray-600"
      >
        {isLogin ? "Belum punya akun? Daftar sekarang" : "Sudah punya akun? Masuk"}
      </button>
    </div>
  );
};

export default AuthScreen;
