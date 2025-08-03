
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
  linkWithCredential
} from 'firebase/auth';
import { app, getOrCreateUser } from '@/lib/firebase';
import { useToast } from './use-toast';

const auth = getAuth(app);

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await getOrCreateUser(user.uid, user.isAnonymous);
      } else {
        // If no user, sign in anonymously
        await signInAnonymously(auth);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const linkAnonymousAccount = async (credential: any) => {
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      try {
        const result = await linkWithCredential(auth.currentUser, credential);
        setUser(result.user);
        await getOrCreateUser(result.user.uid, false, result.user.displayName || undefined, result.user.email || undefined);
        toast({ title: "Accounts linked successfully." });
      } catch (error: any) {
        console.error("Error linking accounts:", error);
        // Handle specific errors like 'auth/credential-already-in-use'
        if (error.code === 'auth/credential-already-in-use') {
            toast({
                title: "Account already exists",
                description: "This Google account is already associated with a user. Please sign in directly.",
                variant: 'destructive'
            })
            // Sign in with the credential directly as linking failed.
             await signInWithPopup(auth, credential.providerId === 'google.com' ? new GoogleAuthProvider() : credential)
        } else {
            throw error; // Re-throw other errors
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
        await getOrCreateUser(result.user.uid, false, result.user.displayName || undefined, result.user.email || undefined);
      }
    } catch (error) {
      console.error("Google sign-in error", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
       if (auth.currentUser && auth.currentUser.isAnonymous) {
        const credential = createUserWithEmailAndPassword(auth, email, password);
        await linkWithCredential(auth.currentUser, (await credential).credential!);
        const newUser = (await credential).user;
        await getOrCreateUser(newUser.uid, false, newUser.displayName || undefined, newUser.email || undefined);

       } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await getOrCreateUser(userCredential.user.uid, false, userCredential.user.displayName || undefined, userCredential.user.email || undefined);
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
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signUpWithEmail, signInWithEmail, signOut }}>
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
