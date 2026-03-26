import { User, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';

import { auth, ensureFirebaseConfigured } from './firebase';

export const authService = {
  async login(email: string, password: string) {
    console.log('🔐 Login iniciado para:', email);
    ensureFirebaseConfigured();
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log('✅ Login bem-sucedido:', result.user.email);
      return result;
    } catch (error) {
      console.error('❌ Erro no login:', error);
      throw error;
    }
  },

  async resetPassword(email: string) {
    ensureFirebaseConfigured();
    return sendPasswordResetEmail(auth, email.trim());
  },

  async logout() {
    console.log('🚪 Logout iniciado');
    try {
      await signOut(auth);
      console.log('✅ Logout bem-sucedido');
    } catch (error) {
      console.error('❌ Erro no logout:', error);
      throw error;
    }
  },

  subscribe(callback: (user: User | null) => void) {
    console.log('👂 Registrando Firebase listener');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔔 onAuthStateChanged disparado - user:', user?.email || 'null');
      callback(user);
    });
    console.log('✅ Firebase listener registrado');
    return unsubscribe;
  },
};