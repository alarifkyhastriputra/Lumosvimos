import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyA3SVbGNE34805jokZxFz6kWlY7do4i4qc",
  authDomain: "chiutchiyu.firebaseapp.com",
  databaseURL: "https://chiutchiyu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chiutchiyu",
  storageBucket: "chiutchiyu.firebasestorage.app",
  messagingSenderId: "685811847893",
  appId: "1:685811847893:web:55f5f32493b29c1a27085c",
  measurementId: "G-XN59W189RV"
};

// Initialize Firebase
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// Initialize Firebase Analytics if supported in the browser environment
export let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}
