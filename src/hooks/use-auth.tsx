
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  User,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  linkWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { app, getOrCreateUser } from '@/lib/firebase';
import { useToast } from './use-toast';
import { getOrCreateUserAdmin } from '@/lib/firebase-admin';

const auth = getAuth(app);

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authCompleted: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authCompleted, setAuthCompleted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Still use client version here for initial load, as this runs client-side.
        await getOrCreateUser(user.uid, user.isAnonymous); 
      } else {
        // If no user, sign in anonymously
        await signInAnonymously(auth);
      }
      setLoading(false);
      setAuthCompleted(true);
    });

    return () => unsubscribe();
  }, []);
  
  const linkAnonymousAccount = async (credential: any) => {
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      try {
        const result = await linkWithCredential(auth.currentUser, credential);
        setUser(result.user);
        // Use the admin version here because we are creating/merging user data authoritatively
        await getOrCreateUserAdmin(result.user.uid, false, result.user.displayName || undefined, result.user.email || undefined);
        toast({ title: "Accounts linked successfully." });
      } catch (error: any) {
        console.error("Error linking accounts:", error);
        if (error.code === 'auth/credential-already-in-use') {
            toast({
                title: "Account already exists",
                description: "This account is already associated with a user. Signing you in directly.",
                variant: 'destructive'
            });
            // Sign in with the credential directly as linking failed.
             await signInWithPopup(auth, credential.providerId === 'google.com' ? new GoogleAuthProvider() : credential)
        } else {
            toast({
              title: "Linking Failed",
              description: error.message,
              variant: "destructive"
            })
        }
      }
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      if (auth.currentUser && auth.currentUser.isAnonymous) {
         await linkAnonymousAccount(provider);
      } else {
        const result = await signInWithPopup(auth, provider);
        await getOrCreateUserAdmin(result.user.uid, false, result.user.displayName || undefined, result.user.email || undefined);
      }
    } catch (error) {
      console.error("Google sign-in error", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
       if (auth.currentUser && auth.currentUser.isAnonymous) {
        const credential = EmailAuthProvider.credential(email, password);
        await linkAnonymousAccount(credential);
       } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await getOrCreateUserAdmin(userCredential.user.uid, false, userCredential.user.displayName || undefined, userCredential.user.email || undefined);
       }
    } catch (error) {
        console.error("Email sign-up error", error);
        throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Email sign-in error", error);
        throw error;
    }
  };


  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will handle signing in anonymously
    } catch (error) {
      console.error("Sign out error", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authCompleted, signInWithGoogle, signUpWithEmail, signInWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
