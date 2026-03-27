import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../../components/AppButton';
import { ScreenShell } from '../../components/ScreenShell';
import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../utils/theme';
import { EquipeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<EquipeStackParamList, 'EquipeHome'>;

export function EquipeScreen({ navigation }: Props) {
  const { profile } = useAuth();

  if (profile?.tipo !== 'gestor') {
    return (
      <ScreenShell>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Acesso restrito</Text>
          <Text style={styles.cardText}>Este módulo é exclusivo para gestores.</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Módulo gestor</Text>
        <Text style={styles.heroTitle}>Gestão de equipe</Text>
        <Text style={styles.heroText}>
          Cadastre funcionários, defina cargas horárias e gerencie os acessos da equipe.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cadastrar funcionário</Text>
        <Text style={styles.cardText}>
          Crie o acesso com e-mail e senha e já defina a carga horária esperada sem sair do aplicativo.
        </Text>
        <AppButton onPress={() => navigation.navigate('CadastroFuncionario')} title="Cadastrar funcionário" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  heroEyebrow: {
    color: '#A8EAC8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  heroText: {
    color: '#D7F4E6',
    lineHeight: 22,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadow,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  cardText: {
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
});
