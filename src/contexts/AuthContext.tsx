import { User } from 'firebase/auth';
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { UserProfile } from '../models/user';
import { authService } from '../services/authService';
import { frequenciaService } from '../services/frequenciaService';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';
import { theme } from '../utils/theme';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  patchProfile: (patch: Partial<UserProfile>) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const loadRequestRef = useRef(0);

  const loadProfile = useCallback(async (user: User | null, requestId?: number) => {
    console.log('🔵 loadProfile chamado - requestId:', requestId, 'user:', user?.email);
    
    if (!user) {
      console.log('⚠️ loadProfile: usuário null');
      if (mountedRef.current) {
        setProfile(null);
      }
      return;
    }

    try {
      console.log('⏳ Carregando perfil do usuário:', user.email);
      const nextProfile = await userService.ensureUserProfile(user);
      console.log('✅ Perfil carregado:', nextProfile?.nome);

      if (!mountedRef.current) {
        console.log('❌ Componente desmontou durante loadProfile');
        return;
      }

      if (requestId !== undefined && requestId !== loadRequestRef.current) {
        console.log('⚠️ Race condition detectada - requestId:', requestId, 'vs loadRequestRef:', loadRequestRef.current);
        return;
      }

      setProfile(nextProfile);

      try {
        console.log('📲 Registrando notificações...');
        const pushToken = await notificationService.registerForPushNotifications();
        if (pushToken) {
          await userService.updatePushToken(user.uid, pushToken);
          console.log('✅ Push token atualizado');
        }
        await notificationService.schedulePunchReminder(nextProfile.horarioEntradaEsperado);
        await notificationService.syncDailyReminderMessage(nextProfile.id);
        await notificationService.notifyPendingAttendance(nextProfile.id);
        console.log('✅ Notificações configuradas');
      } catch (error) {
        console.warn('Falha ao configurar notificações do usuário autenticado.', error);
      }
    } catch (error) {
      console.error('❌ Erro em loadProfile:', error);
      throw error;
    }
  }, []);

  const refreshProfile = async () => {
    loadRequestRef.current += 1;
    await loadProfile(firebaseUser, loadRequestRef.current);
  };

  const patchProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((currentProfile) => (currentProfile ? { ...currentProfile, ...patch } : currentProfile));
  }, []);

  useEffect(() => {
    console.log('🟢 AuthProvider montado - iniciando Firebase listener');
    mountedRef.current = true;

    const unsubscribe = authService.subscribe((user) => {
      console.log('🎯 Firebase listener executado - user:', user?.email || 'null');
      
      const requestId = loadRequestRef.current + 1;
      loadRequestRef.current = requestId;
      console.log('📍 Request ID criado:', requestId);
      
      setFirebaseUser(user);

      if (!user) {
        console.log('🚪 Usuário logout detectado');
        setProfile(null);
        setLoading(false);
        return;
      }

      console.log('🔓 Usuário login detectado:', user.email);
      setLoading(true);
      console.log('⏳ Loading=true');

      loadProfile(user, requestId)
        .catch((error) => {
          console.error('❌ Erro ao carregar perfil após login:', error);
        })
        .finally(() => {
          console.log('🔚 Finally - mountedRef:', mountedRef.current, 'requestId:', requestId, 'loadRequestRef:', loadRequestRef.current);
          if (mountedRef.current && requestId === loadRequestRef.current) {
            console.log('✅ setLoading(false)');
            setLoading(false);
          } else {
            console.log('⚠️ Condição bloqueou setLoading(false)');
          }
        });
    });

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        frequenciaService.flushPendingActions().catch((error) => {
          console.warn('Falha ao sincronizar ações pendentes após reconexão.', error);
        });
      }
    });

    return () => {
      console.log('🟡 AuthProvider desmontando');
      mountedRef.current = false;
      unsubscribe();
      unsubscribeNetInfo();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      login: async (email, password) => {
        await authService.login(email, password);
      },
      logout: async () => {
        await authService.logout();
      },
      refreshProfile,
      patchProfile,
    }),
    [firebaseUser, loading, patchProfile, profile],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}