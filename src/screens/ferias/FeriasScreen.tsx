import { StyleSheet, Text, View } from 'react-native';

import { ScreenShell } from '../../components/ScreenShell';
import { theme } from '../../utils/theme';

export function FeriasScreen() {
  return (
    <ScreenShell>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Módulo de férias</Text>
        <Text style={styles.heroText}>
          Esta área foi reservada para o próximo módulo. A intenção é permitir solicitação de férias, acompanhamento dos períodos e visualização do calendário da equipe.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Escopo previsto</Text>
        <Text style={styles.cardText}>• Solicitar período de férias</Text>
        <Text style={styles.cardText}>• Acompanhar status da solicitação</Text>
        <Text style={styles.cardText}>• Consultar calendário de férias da equipe</Text>
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
    gap: theme.spacing.sm,
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