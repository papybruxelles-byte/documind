import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { browserSessionPersistence, createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut as firebaseSignOut, updateProfile } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/lib/firebase';
import { arrayUnion, collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string, role: 'enterprise_admin' | 'individual' | 'company_member', companyCode?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getSignInError(error: unknown) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email or password incorrect. Try again or sign up.';
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Unable to connect. Check your internet connection and try again.';
    }
  }

  return 'Unable to sign in. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    void setPersistence(auth, browserSessionPersistence)
      .catch((error) => console.error('Unable to enable session-only authentication.', error))
      .finally(() => {
        if (!active) return;
        unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          setUser(nextUser);
          setLoading(false);
        });
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return { error: null };
    } catch (error) {
      return { error: getSignInError(error) };
    }
  };

  const signUp = async (email: string, password: string, name: string, role: 'enterprise_admin' | 'individual' | 'company_member', companyCode?: string) => {
    try {
      let memberCompanyId: string | null = null;
      if (role === 'company_member') {
        const matches = await getDocs(query(collection(db, 'companies'), where('join_code', '==', companyCode?.trim().toUpperCase() || '')));
        if (matches.empty) return { error: 'Invalid company credential. Please contact your administrator.' };
        memberCompanyId = matches.docs[0].id;
      }
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      let companyId: string | null = null;
      let status = 'approved';
      if (role === 'enterprise_admin') {
        companyId = crypto.randomUUID();
        const joinCode = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
        await setDoc(doc(db, 'companies', companyId), { name: `${name}'s company`, join_code: joinCode, admin_uids: [credential.user.uid], member_uids: [credential.user.uid], created_at: new Date().toISOString() });
      } else if (role === 'company_member') {
        companyId = memberCompanyId; status = 'pending';
        await updateDoc(doc(db, 'companies', companyId!), { member_uids: arrayUnion(credential.user.uid) });
      }
      await setDoc(doc(db, 'profiles', credential.user.uid), { uid: credential.user.uid, email: email.toLowerCase(), name, role, status, company_id: companyId, created_at: new Date().toISOString() });
      return { error: null };
    } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to create account' }; }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
