
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth, 
  browserLocalPersistence, 
  indexedDBLocalPersistence, 
  browserSessionPersistence, 
  browserPopupRedirectResolver,
  getAuth 
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCZIDtUteM2MiESDJd35gaKPHX_Ht1zL6s",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "projectchat01-d16bc.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://projectchat01-d16bc-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "projectchat01-d16bc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "projectchat01-d16bc.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "163313653543",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:163313653543:web:a34c117ad6ab7be611bb02",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-XVNJLVW2ST"
};

// Initialize Firebase
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    popupRedirectResolver: browserPopupRedirectResolver
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export { browserPopupRedirectResolver };
export const db = getDatabase(app);

// Initialize Firebase Analytics if supported in the browser environment
export let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Graceful fallback if analytics is blocked or unsupported in context
  });
}


