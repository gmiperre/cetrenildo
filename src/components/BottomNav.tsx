import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../hooks/useAuth';
import { AppStackParamList } from '../navigation/types';
import { theme } from '../utils/theme';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

export function BottomNav() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute();
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);

  const active = route.name;

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);
      await logout();
    } catch (error) {
      Alert.alert('Sair', 'Nao foi possivel encerrar a sessao. Tente novamente.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) }]}>
      <Pressable
        onPress={() => navigation.navigate('Home')}
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      >
        <Ionicons
          color={active === 'Home' ? theme.colors.primary : theme.colors.textMuted}
          name={active === 'Home' ? 'home' : 'home-outline'}
          size={24}
        />
        <Text style={[styles.label, active === 'Home' && styles.labelActive]}>Home</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate('Modulos')}
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      >
        <Ionicons
          color={active === 'Modulos' ? theme.colors.primary : theme.colors.textMuted}
          name={active === 'Modulos' ? 'apps' : 'apps-outline'}
          size={24}
        />
        <Text style={[styles.label, active === 'Modulos' && styles.labelActive]}>Módulos</Text>
      </Pressable>

      <Pressable
        onPress={handleLogout}
        disabled={loggingOut}
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      >
        <Ionicons color={theme.colors.danger} name="log-out-outline" size={24} />
        <Text style={[styles.label, styles.labelDanger]}>Sair</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    shadowColor: theme.shadow.shadowColor,
    shadowOpacity: theme.shadow.shadowOpacity,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: theme.shadow.elevation,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    gap: 4,
  },
  itemPressed: {
    opacity: 0.55,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  labelActive: {
    color: theme.colors.primary,
  },
  labelDanger: {
    color: theme.colors.danger,
  },
});
