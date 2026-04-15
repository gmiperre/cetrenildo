import { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';

import { UserDirectoryEntry, UserProfile, UserRole } from '../models/user';
import { db, ensureFirebaseConfigured } from './firebase';

const usersCollection = collection(db, 'users');
const userDirectoryCollection = collection(db, 'userDirectory');
const TEAM_CACHE_TTL_MS = 5 * 60 * 1000;

let teamCache: { users: UserDirectoryEntry[]; cachedAt: number } | null = null;

const buildDefaultUserProfile = (user: User): UserProfile => ({
  id: user.uid,
  nome: user.displayName ?? user.email?.split('@')[0] ?? 'Colaborador',
  email: user.email ?? '',
  tipo: 'padrao',
  horarioEntradaEsperado: '08:00',
  horarioSaidaEsperado: '17:00',
  fotoPerfilUri: null,
  pushToken: null,
});

const toUserDirectoryEntry = (profile: UserProfile): UserDirectoryEntry => ({
  id: profile.id,
  nome: profile.nome,
  email: profile.email,
  tipo: profile.tipo,
  horarioEntradaEsperado: profile.horarioEntradaEsperado,
  horarioSaidaEsperado: profile.horarioSaidaEsperado,
});

const syncUserDirectoryEntry = async (profile: UserProfile) => {
  await setDoc(doc(userDirectoryCollection, profile.id), toUserDirectoryEntry(profile), { merge: true });
};

export const userService = {
  async ensureUserProfile(user: User) {
    console.log('📋 ensureUserProfile chamado para:', user.email);
    ensureFirebaseConfigured();
    try {
      const ref = doc(usersCollection, user.uid);
      console.log('🔍 Consultando Firestore - documento:', user.uid);
      const snapshot = await getDoc(ref);

      if (!snapshot.exists()) {
        console.log('📝 Perfil não existe - criando novo perfil padrão');
        const profile = buildDefaultUserProfile(user);
        console.log('💾 Salvando novo perfil:', profile);
        await setDoc(ref, profile);
        await syncUserDirectoryEntry(profile);
        console.log('✅ Perfil criado com sucesso');
        return profile;
      }

      console.log('✅ Perfil carregado do Firestore');
      const profile = snapshot.data() as UserProfile;
      await syncUserDirectoryEntry(profile);
      return profile;
    } catch (error) {
      console.error('❌ Erro em ensureUserProfile:', error);
      throw error;
    }
  },

  async getById(userId: string) {
    ensureFirebaseConfigured();
    const snapshot = await getDoc(doc(usersCollection, userId));
    return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
  },

  async listAll() {
    ensureFirebaseConfigured();

    if (teamCache && Date.now() - teamCache.cachedAt < TEAM_CACHE_TTL_MS) {
      return teamCache.users;
    }

    const directorySnapshot = await getDocs(query(userDirectoryCollection, orderBy('nome')));
    if (!directorySnapshot.empty) {
      const users = directorySnapshot.docs.map((item) => item.data() as UserDirectoryEntry);
      teamCache = { users, cachedAt: Date.now() };
      return users;
    }

    const snapshot = await getDocs(query(usersCollection, orderBy('nome')));
    const users = snapshot.docs.map((item) => item.data() as UserProfile);
    await Promise.all(users.map((user) => syncUserDirectoryEntry(user)));
    const directoryUsers = users.map((user) => toUserDirectoryEntry(user));
    teamCache = { users: directoryUsers, cachedAt: Date.now() };
    return directoryUsers;
  },

  async createManagedProfile(input: {
    id: string;
    nome: string;
    email: string;
    tipo?: UserRole;
    horarioEntradaEsperado: string;
    horarioSaidaEsperado: string;
  }) {
    ensureFirebaseConfigured();

    const profile: UserProfile = {
      id: input.id,
      nome: input.nome.trim(),
      email: input.email.trim(),
      tipo: input.tipo ?? 'padrao',
      horarioEntradaEsperado: input.horarioEntradaEsperado,
      horarioSaidaEsperado: input.horarioSaidaEsperado,
      fotoPerfilUri: null,
      pushToken: null,
    };

    await setDoc(doc(usersCollection, input.id), profile);
    await syncUserDirectoryEntry(profile);
    teamCache = null;
    return profile;
  },

  async updatePushToken(userId: string, pushToken: string | null) {
    ensureFirebaseConfigured();
    await setDoc(doc(usersCollection, userId), { pushToken }, { merge: true });
  },

  async updateProfilePhoto(userId: string, fotoPerfilUri: string | null) {
    ensureFirebaseConfigured();
    await setDoc(doc(usersCollection, userId), { fotoPerfilUri }, { merge: true });
    teamCache = null;
  },

  clearListCache() {
    teamCache = null;
  },
};