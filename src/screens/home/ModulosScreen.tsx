import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppButton } from '../../components/AppButton';
import { ScreenShell } from '../../components/ScreenShell';
import { useAuth } from '../../hooks/useAuth';
import { getTodayKey } from '../../utils/date';
import { theme } from '../../utils/theme';
import { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Modulos'>;

export function ModulosScreen({ navigation }: Props) {
  const { profile } = useAuth();
  return (
    <ScreenShell showNav>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Catálogo operacional</Text>
        <Text style={styles.heroTitle}>Escolha o módulo que deseja usar</Text>
        <Text style={styles.heroText}>
          A Home permanece como painel inicial. Os fluxos operacionais ficam separados por módulo para facilitar a expansão do produto.
        </Text>
      </View>

      <View style={styles.moduleCard}>
        <Text style={styles.moduleTitle}>Frequência</Text>
        <Text style={styles.moduleText}>
          Registre ponto, acompanhe o histórico mensal, envie justificativas e trate ocorrências do dia.
        </Text>
        <AppButton
          onPress={() =>
            navigation.navigate('FrequenciaModule', {
              screen: 'Registro',
              params: { date: getTodayKey() },
            })
          }
          title="Abrir frequência"
        />
      </View>

      <View style={styles.moduleCard}>
        <Text style={styles.moduleTitle}>Férias</Text>
        <Text style={styles.moduleText}>
          Área reservada para solicitação de férias, acompanhamento dos períodos aprovados e calendário da equipe.
        </Text>
        <AppButton onPress={() => navigation.navigate('FeriasModule')} title="Ver visão inicial" variant="secondary" />
      </View>

      {profile?.tipo === 'gestor' ? (
        <View style={styles.moduleCard}>
          <Text style={styles.moduleTitle}>Equipe</Text>
          <Text style={styles.moduleText}>
            Cadastre funcionários, defina cargas horárias e gerencie os acessos da equipe.
          </Text>
          <AppButton onPress={() => navigation.navigate('EquipeModule')} title="Abrir equipe" />
        </View>
      ) : null}
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
  moduleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadow,
  },
  moduleTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  moduleText: {
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
});