import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../utils/theme';

interface SummaryCardProps {
  label: string;
  value: string | number;
  accent: string;
}

export function SummaryCard({ label, value, accent }: SummaryCardProps) {
  return (
    <View style={[styles.card, { borderLeftColor: accent }]}> 
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 112,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderLeftWidth: 5,
    padding: theme.spacing.md,
    justifyContent: 'space-between',
    ...theme.shadow,
  },
  value: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '800',
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});