import { StyleSheet, Text, View } from 'react-native';

import { RegistroStatus } from '../models/frequencia';
import { getStatusColor } from '../utils/date';
import { theme } from '../utils/theme';

interface StatusBadgeProps {
  status: RegistroStatus;
  pending?: boolean;
  labelOverride?: string;
}

const labelMap: Record<RegistroStatus, string> = {
  presente: 'Presente',
  falta: 'Falta',
  falta_justificada: 'Falta justificada',
  abono: 'Abono',
  presenca_contestada: 'Presença contestada',
};

export function StatusBadge({ status, pending = false, labelOverride }: StatusBadgeProps) {
  const color = getStatusColor(status, pending);

  return (
    <View style={[styles.badge, { backgroundColor: `${color}18`, borderColor: `${color}60` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{pending ? 'Pendente' : (labelOverride ?? labelMap[status])}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});