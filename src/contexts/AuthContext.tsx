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
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const loadRequestRef = useRef(0);

  const loadProfile = useCallback(async (user: User | null, requestId?: number) => {
    if (!user) {
      if (mountedRef.current) {
        setProfile(null);
      }
      return;
    }

    const nextProfile = await userService.ensureUserProfile(user);
    if (!mountedRef.current || (requestId !== undefined && requestId !== loadRequestRef.current)) {
      return;
    }

    setProfile(nextProfile);

    try {
      const pushToken = await notificationService.registerForPushNotifications();
      if (pushToken) {
        await userService.updatePushToken(user.uid, pushToken);
      }
      await notificationService.schedulePunchReminder(nextProfile.horarioEntradaEsperado);
    } catch (error) {
      console.warn('Falha ao configurar notificações do usuário autenticado.', error);
    }
  }, []);

  const refreshProfile = async () => {
    loadRequestRef.current += 1;
    await loadProfile(firebaseUser, loadRequestRef.current);
  };

  useEffect(() => {
    mountedRef.current = true;

    const unsubscribe = authService.subscribe((user) => {
      const requestId = loadRequestRef.current + 1;
      loadRequestRef.current = requestId;
      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      loadProfile(user, requestId)
        .catch((error) => {
          console.warn('Falha ao carregar perfil autenticado.', error);
        })
        .finally(() => {
          if (mountedRef.current && requestId === loadRequestRef.current) {
            setLoading(false);
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
    }),
    [firebaseUser, loading, profile],
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