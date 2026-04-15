import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { AppButton } from '../../components/AppButton';
import { ScreenShell } from '../../components/ScreenShell';
import { useAuth } from '../../hooks/useAuth';
import { AppMessage } from '../../models/message';
import { AppStackParamList } from '../../navigation/types';
import { messageService } from '../../services/messageService';
import { formatDisplayDate } from '../../utils/date';
import { theme } from '../../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'MensagensModule'>;

const formatDateTime = (date: Date) => {
  const day = formatDisplayDate(`${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`);
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${day} ${hour}:${minute}`;
};

export function MensagensScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = useMemo(() => messages.filter((message) => !message.readAt).length, [messages]);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setMessages([]);
      return;
    }

    setLoading(true);
    try {
      const nextMessages = await messageService.listByUser(profile.id);
      setMessages(nextMessages);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const handleOpenMessage = async (message: AppMessage) => {
    if (!profile?.id) {
      return;
    }

    if (!message.readAt) {
      await messageService.markAsRead(profile.id, message.id);
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? {
                ...item,
                readAt: item.readAt ?? item.createdAt,
              }
            : item,
        ),
      );
    }

    if (message.type === 'pending_attendance' && message.metadata?.oldestPendingDate) {
      navigation.navigate('FrequenciaModule', {
        screen: 'Registro',
        params: {
          date: message.metadata.oldestPendingDate,
          userId: profile.id,
        },
      });
      return;
    }

    if (
      (message.type === 'justificativa_recusada'
        || message.type === 'justificativa_aprovada'
        || message.type === 'lembrete_frequencia'
        || message.type === 'presenca_contestada'
        || message.type === 'contestacao_encerrada'
        || message.type === 'contestacao_reaberta'
        || message.type === 'folha_enviada_revisao'
        || message.type === 'folha_rejeitada_gestor'
        || message.type === 'folha_final_disponivel'
        || message.type === 'folha_concluida'
        || message.type === 'folha_emitida')
      && message.metadata?.relatedDate
    ) {
      if (
        message.type === 'folha_emitida'
        || message.type === 'folha_enviada_revisao'
        || message.type === 'folha_rejeitada_gestor'
        || message.type === 'folha_final_disponivel'
        || message.type === 'folha_concluida'
      ) {
        navigation.navigate('FrequenciaModule', {
          screen: 'Historico',
        });
        return;
      }

      navigation.navigate('FrequenciaModule', {
        screen: 'Registro',
        params: {
          date: message.metadata.relatedDate,
          userId: profile.id,
        },
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!profile?.id) {
      return;
    }

    await messageService.markAllAsRead(profile.id);
    await load();
  };
  return (
    <ScreenShell showNav>
      <View style={styles.heroCard}>
        <Text style={styles.title}>Mensagens</Text>
        <Text style={styles.subtitle}>Acompanhe alertas e comunicações operacionais.</Text>
        <Text style={styles.badge}>{unreadCount} não lidas</Text>
      </View>

      <View style={styles.sectionCard}>
        <AppButton
          loading={loading}
          onPress={handleMarkAllAsRead}
          title="Marcar todas como lidas"
          variant="secondary"
        />
      </View>

      {messages.length ? (
        messages.map((message) => (
          <Pressable key={message.id} onPress={() => handleOpenMessage(message)} style={({ pressed }) => [styles.messageCard, pressed && styles.pressed]}>
            <View style={styles.messageHeader}>
              <Text style={styles.messageTitle}>{message.title}</Text>
              {!message.readAt ? <Text style={styles.unreadDot}>•</Text> : null}
            </View>
            <Text style={styles.messageBody}>{message.body}</Text>
            <Text style={styles.messageDate}>{formatDateTime(message.createdAt.toDate())}</Text>
          </Pressable>
        ))
      ) : (
        <View style={styles.sectionCard}>
          <Text style={styles.emptyText}>Nenhuma mensagem por enquanto.</Text>
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#D7F4E6',
    lineHeight: 22,
  },
  badge: {
    color: '#A8EAC8',
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadow,
  },
  messageCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    ...theme.shadow,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  unreadDot: {
    color: theme.colors.primary,
    fontSize: 28,
    lineHeight: 24,
  },
  messageBody: {
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
  messageDate: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: theme.colors.textMuted,
  },
  pressed: {
    opacity: 0.8,
  },
});
