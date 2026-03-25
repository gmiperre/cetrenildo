import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

import { auth, ensureFirebaseConfigured } from './firebase';

export const authService = {
  async login(email: string, password: string) {
    ensureFirebaseConfigured();
    return signInWithEmailAndPassword(auth, email.trim(), password);
  },

  async logout() {
    return signOut(auth);
  },

  subscribe(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },
};