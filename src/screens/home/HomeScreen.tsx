import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import { AppButton } from '../../components/AppButton';
import { ScreenShell } from '../../components/ScreenShell';
import { SummaryCard } from '../../components/SummaryCard';
import { useAuth } from '../../hooks/useAuth';
import { profilePhotoService } from '../../services/profilePhotoService';
import { userService } from '../../services/userService';
import { useMonthlySummary } from '../../hooks/useMonthlySummary';
import { calendarService } from '../../services/calendarService';
import { getTodayKey, isWorkdayForDate } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { theme } from '../../utils/theme';
import { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { patchProfile, profile } = useAuth();
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const [displayedPhotoUri, setDisplayedPhotoUri] = useState<string | null>(null);
  const [todayIsWorkday, setTodayIsWorkday] = useState(true);
  const { records, workedDays, missedDays, justifiedDays, refresh } = useMonthlySummary(profile?.id);
  const pendingEmailCount = records.filter((record) => record.justificativaStatus === 'pendente_envio').length;
  const rejectedCount = records.filter((record) => record.justificativaStatus === 'recusada').length;

  const todayRecord = records.find((record) => record.data === getTodayKey()) ?? null;
  const punchState = !todayRecord?.horaEntrada
    ? 'none'
    : !todayRecord.horaSaida
    ? 'pending'
    : 'complete';
  const hasOperationalAlert = rejectedCount > 0 || pendingEmailCount > 0;

  const openTodayRecord = () => {
    navigation.navigate('FrequenciaModule', {
      screen: 'Registro',
      params: {
        date: getTodayKey(),
        userId: profile?.id,
      },
    });
  };

  const openHistorico = () => {
    navigation.navigate('FrequenciaModule', {
      screen: 'Historico',
    });
  };

  const profileInitials = profile?.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '3x4';

  useEffect(() => {
    setPhotoLoadFailed(false);
  }, [displayedPhotoUri]);

  useEffect(() => {
    if (!profile?.id) {
      setDisplayedPhotoUri(null);
      return;
    }

    profilePhotoService
      .getCachedProfilePhoto(profile.id)
      .then((cachedPhoto) => {
        if (cachedPhoto) {
          setDisplayedPhotoUri(cachedPhoto);
          return;
        }

        if (!updatingPhoto) {
          setDisplayedPhotoUri(profile.fotoPerfilUri ?? null);
        }
      })
      .catch(() => {
        if (!updatingPhoto) {
          setDisplayedPhotoUri(profile.fotoPerfilUri ?? null);
        }
      });
  }, [profile?.id]);

  useEffect(() => {
    if (updatingPhoto) {
      return;
    }

    if (profile?.fotoPerfilUri) {
      setDisplayedPhotoUri(profile.fotoPerfilUri);
      if (profile.id) {
        profilePhotoService.cacheProfilePhoto(profile.id, profile.fotoPerfilUri).catch(() => undefined);
      }
      return;
    }

    if (profile?.id) {
      profilePhotoService
        .getCachedProfilePhoto(profile.id)
        .then((cachedPhoto) => {
          setDisplayedPhotoUri(cachedPhoto ?? null);
        })
        .catch(() => {
          setDisplayedPhotoUri(null);
        });
      return;
    }

    setDisplayedPhotoUri(null);
  }, [profile?.fotoPerfilUri, updatingPhoto]);

  const saveProfilePhoto = async (uri: string) => {
    if (!profile?.id) {
      return;
    }

    try {
      setUpdatingPhoto(true);
      const photoUrl = await profilePhotoService.uploadProfilePhoto(uri);
      setDisplayedPhotoUri(photoUrl);
      setPhotoLoadFailed(false);
      await profilePhotoService.cacheProfilePhoto(profile.id, photoUrl);
      await userService.updateProfilePhoto(profile.id, photoUrl);
      patchProfile({ fotoPerfilUri: photoUrl });
    } catch (error) {
      setDisplayedPhotoUri(profile.fotoPerfilUri ?? null);
      Alert.alert('Foto de perfil', getErrorMessage(error, 'Nao foi possivel salvar a foto. Tente novamente.'));
    } finally {
      setUpdatingPhoto(false);
    }
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissao necessaria', 'Permita acesso aos arquivos para selecionar a foto de perfil.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await saveProfilePhoto(result.assets[0].uri);
    }
  };

  const takeWithCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissao necessaria', 'Permita acesso a camera para capturar a foto de perfil.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await saveProfilePhoto(result.assets[0].uri);
    }
  };

  const removePhoto = async () => {
    if (!profile?.id) {
      return;
    }

    try {
      setUpdatingPhoto(true);
      setDisplayedPhotoUri(null);
      setPhotoLoadFailed(false);
      await profilePhotoService.cacheProfilePhoto(profile.id, null);
      await profilePhotoService.removeProfilePhoto();
      await userService.updateProfilePhoto(profile.id, null);
      patchProfile({ fotoPerfilUri: null });
    } catch (error) {
      setDisplayedPhotoUri(profile.fotoPerfilUri ?? null);
      Alert.alert('Foto de perfil', getErrorMessage(error, 'Nao foi possivel remover a foto. Tente novamente.'));
    } finally {
      setUpdatingPhoto(false);
    }
  };

  const openPhotoOptions = () => {
    if (!profile) {
      return;
    }

    // On web/desktop, Alert action lists are inconsistent. Open gallery directly.
    if (Platform.OS === 'web') {
      pickFromGallery().catch(() => undefined);
      return;
    }

    const options = [
      {
        text: 'Câmera',
        onPress: () => {
          takeWithCamera().catch(() => undefined);
        },
      },
      {
        text: 'Galeria',
        onPress: () => {
          pickFromGallery().catch(() => undefined);
        },
      },
      ...(displayedPhotoUri
        ? [
            {
              text: 'Remover foto',
              style: 'destructive' as const,
              onPress: () => {
                removePhoto().catch(() => undefined);
              },
            },
          ]
        : []),
      {
        text: 'Cancelar',
        style: 'cancel' as const,
      },
    ];

    Alert.alert('Foto de perfil', 'Escolha uma opção para atualizar sua foto.', options);
  };

  const nextAction = rejectedCount > 0
    ? {
        title: 'Corrigir justificativas recusadas',
        description: 'Existe pelo menos uma justificativa recusada aguardando ajuste.',
        buttonLabel: 'Revisar pendências',
        onPress: openHistorico,
      }
    : pendingEmailCount > 0
    ? {
        title: 'Finalizar justificativas pendentes',
        description: 'Há ocorrências aguardando envio ou conferência do comprovante por e-mail.',
        buttonLabel: 'Ver pendências',
        onPress: openHistorico,
      }
    : !todayIsWorkday
    ? {
        title: 'Sem expediente hoje',
        description: 'Hoje não é dia útil. Aproveite o descanso e acompanhe o histórico do mês.',
        buttonLabel: 'Ver histórico',
        onPress: openHistorico,
      }
    : punchState === 'none'
    ? {
        title: 'Registrar entrada de hoje',
        description: 'Seu dia ainda não foi iniciado. O próximo passo útil é registrar a entrada.',
        buttonLabel: 'Registrar agora',
        onPress: openTodayRecord,
      }
    : punchState === 'pending'
    ? {
        title: 'Registrar saída de hoje',
        description: 'Sua entrada já foi registrada. Falta concluir o expediente com a saída.',
        buttonLabel: 'Concluir registro',
        onPress: openTodayRecord,
      }
    : {
        title: 'Acompanhar histórico do mês',
        description: 'Seu dia está concluído. O próximo passo útil é revisar o histórico e pendências.',
        buttonLabel: 'Ver histórico',
        onPress: openHistorico,
      };

  const alertMessage = rejectedCount > 0
    ? 'Existe justificativa recusada aguardando correção.'
    : pendingEmailCount > 0
    ? 'Você tem justificativas pendentes de envio por e-mail.'
    : null;

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => undefined);
      calendarService.getByDate(getTodayKey())
        .then((policy) => setTodayIsWorkday(isWorkdayForDate(getTodayKey(), policy)))
        .catch(() => undefined);
    }, [refresh]),
  );

  if (!profile) {
    return null;
  }

  return (
    <ScreenShell showNav>
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <Pressable
            disabled={updatingPhoto}
            onPress={openPhotoOptions}
            style={({ pressed }) => [styles.photoFrame, pressed && styles.shortcutPressed, updatingPhoto && styles.photoActionDisabled]}
          >
            {displayedPhotoUri && !photoLoadFailed ? (
              Platform.OS === 'web' ? (
                <img
                  alt="Foto de perfil"
                  key={displayedPhotoUri}
                  onError={() => setPhotoLoadFailed(true)}
                  src={displayedPhotoUri}
                  style={styles.photoImage as unknown as React.CSSProperties}
                />
              ) : (
                <Image
                  key={displayedPhotoUri}
                  onError={() => setPhotoLoadFailed(true)}
                  source={{ uri: displayedPhotoUri }}
                  style={styles.photoImage}
                />
              )
            ) : (
              <Text style={styles.photoPlaceholder}>{profileInitials}</Text>
            )}
          </Pressable>

          <View style={styles.headerContent}>
            <Text style={styles.greeting}>Olá, {profile.nome}</Text>
            <Text style={styles.meta}>{profile.email}</Text>
            <Text style={styles.metaDetail}>Tipo de acesso: {profile.tipo === 'gestor' ? 'gestor' : 'padrão'}</Text>
            <Text style={styles.metaDetail}>Horário: {profile.horarioEntradaEsperado} às {profile.horarioSaidaEsperado}</Text>
            <Pressable
              disabled={updatingPhoto}
              onPress={openPhotoOptions}
              style={({ pressed }) => [styles.photoLink, pressed && styles.shortcutPressed, updatingPhoto && styles.photoActionDisabled]}
            >
              <Text style={styles.photoLinkText}>{updatingPhoto ? 'Salvando foto...' : 'Alterar foto'}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {hasOperationalAlert && alertMessage ? (
        <View style={styles.alertCard}>
          <Text style={styles.alertEyebrow}>Atenção operacional</Text>
          <Text style={styles.alertText}>{alertMessage}</Text>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Próxima ação</Text>
        <Text style={styles.sectionLead}>{nextAction.title}</Text>
        <Text style={styles.sectionText}>{nextAction.description}</Text>
        <AppButton onPress={nextAction.onPress} title={nextAction.buttonLabel} />
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard accent={theme.colors.success} label="Presenças" value={workedDays} />
        <SummaryCard accent="#B7791F" label="Abonos" value={justifiedDays} />
        <SummaryCard accent={theme.colors.danger} label="Faltas" value={missedDays} />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Pendências e orientações</Text>
        <Text style={styles.sectionText}>Confirme seus registros pendentes no detalhe do dia sempre que houver ocorrência aberta.</Text>
        {pendingEmailCount > 0 ? <Text style={styles.sectionText}>Justificativas pendentes de envio: {pendingEmailCount}.</Text> : null}
        {rejectedCount > 0 ? <Text style={styles.sectionText}>Justificativas recusadas: {rejectedCount}.</Text> : null}
        <Text style={styles.sectionText}>A navegação principal deve acontecer pela barra inferior; a Home serve como painel de acompanhamento.</Text>
      </View>

    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    ...theme.shadow,
  },
  profileRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
    flex: 1,
  },
  headerContent: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  meta: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  metaDetail: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '600',
  },
  photoFrame: {
    width: 84,
    height: 112,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.6,
  },
  photoLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  photoLinkText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  photoActionDisabled: {
    opacity: 0.6,
  },
  alertCard: {
    backgroundColor: '#FFF4E5',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#F2C078',
    gap: theme.spacing.xs,
  },
  alertEyebrow: {
    color: '#8A5A12',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  alertText: {
    color: '#6E4A10',
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadow,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionLead: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionText: {
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
  shortcutPressed: {
    opacity: 0.8,
  },
});