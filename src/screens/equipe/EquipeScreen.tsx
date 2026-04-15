import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { AppButton } from '../../components/AppButton';
import { AppTextField } from '../../components/AppTextField';
import { ScreenShell } from '../../components/ScreenShell';
import { useAuth } from '../../hooks/useAuth';
import { UserDirectoryEntry } from '../../models/user';
import { userService } from '../../services/userService';
import { theme } from '../../utils/theme';
import { EquipeStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<EquipeStackParamList, 'EquipeHome'>;

export function EquipeScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [team, setTeam] = useState<UserDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadTeam = async () => {
        try {
          setLoading(true);
          const users = await userService.listAll();
          if (active) {
            setTeam(users);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      loadTeam().catch(() => undefined);

      return () => {
        active = false;
      };
    }, []),
  );

  const normalizedQuery = search.trim().toLowerCase();
  const filteredTeam = useMemo(() => {
    if (!normalizedQuery) {
      return team;
    }

    return team.filter((member) => {
      const full = `${member.nome} ${member.email}`.toLowerCase();
      return full.includes(normalizedQuery);
    });
  }, [normalizedQuery, team]);

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
          Cadastre funcionários, acompanhe o time e acesse detalhes de cada colaborador.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cadastrar funcionário</Text>
        <Text style={styles.cardText}>
          Crie o acesso com e-mail e senha e já defina a carga horária esperada sem sair do aplicativo.
        </Text>
        <AppButton onPress={() => navigation.navigate('CadastroFuncionario')} title="Cadastrar funcionário" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Funcionários cadastrados</Text>
        <AppTextField
          autoCapitalize="none"
          label="Buscar"
          onChangeText={setSearch}
          placeholder="Nome ou e-mail"
          value={search}
        />

        {loading ? <Text style={styles.helperText}>Carregando equipe...</Text> : null}
        {!loading && !filteredTeam.length ? (
          <Text style={styles.helperText}>Nenhum funcionário encontrado para o filtro informado.</Text>
        ) : null}

        <ScrollView contentContainerStyle={styles.listContent} style={styles.listWrapper}>
          {filteredTeam.map((member) => (
            <Pressable
              key={member.id}
              onPress={() => navigation.navigate('FuncionarioDetalhe', { userId: member.id })}
              style={({ pressed }) => [styles.memberCard, pressed && styles.memberCardPressed]}
            >
              <View style={styles.memberHeader}>
                <Text style={styles.memberName}>{member.nome}</Text>
                <Text style={styles.memberRole}>{member.tipo === 'gestor' ? 'Gestor' : 'Padrão'}</Text>
              </View>
              <Text style={styles.memberText}>{member.email}</Text>
              <Text style={styles.memberText}>
                Horário: {member.horarioEntradaEsperado} às {member.horarioSaidaEsperado}
              </Text>
              <Text style={styles.memberLink}>Ver perfil</Text>
            </Pressable>
          ))}
        </ScrollView>
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
  helperText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  listWrapper: {
    maxHeight: 380,
  },
  listContent: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  memberCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  memberCardPressed: {
    opacity: 0.85,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  memberName: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  memberRole: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  memberText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  memberLink: {
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
});
