import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDiKZp3n0Pedg1JjJ52skYBR5pXB0_g7tc',
  authDomain: 'documind-d081e.firebaseapp.com',
  projectId: 'documind-d081e',
  storageBucket: 'documind-d081e.firebasestorage.app',
  messagingSenderId: '442403228578',
  appId: '1:442403228578:web:17d59c4c2daeaf8eb3c0fb',
  measurementId: 'G-WEXC6EDKMS',
  databaseURL: 'https://documind-d081e-default-rtdb.firebaseio.com',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Analytics is browser-only and optional, so unsupported environments do not block the app.
void isSupported().then((supported) => supported && getAnalytics(firebaseApp));
