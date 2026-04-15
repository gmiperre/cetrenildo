import { useCallback, useState } from 'react';

import { FolhaFrequenciaMensal } from '../models/frequencia';
import { frequenciaService } from '../services/frequenciaService';
import { getErrorMessage } from '../utils/errors';

export function useFolhaMensal(userId?: string) {
  const [folha, setFolha] = useState<FolhaFrequenciaMensal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFolha = useCallback(
    async (month: number, year: number) => {
      if (!userId) {
        setFolha(null);
        return null;
      }

      setLoading(true);
      setError(null);
      try {
        const current = await frequenciaService.getFolhaMensal(userId, month, year);
        setFolha(current);
        return current;
      } catch (err) {
        const message = getErrorMessage(err, 'Não foi possível carregar a folha mensal.');
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  const emitirFolha = useCallback(
    async (month: number, year: number) => {
      if (!userId) {
        throw new Error('Usuário não identificado para emissão da folha.');
      }

      setLoading(true);
      setError(null);
      try {
        const emitted = await frequenciaService.emitirFolhaMensal(userId, month, year, userId);
        setFolha(emitted);
        return emitted;
      } catch (err) {
        const message = getErrorMessage(err, 'Não foi possível emitir a folha mensal.');
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  const uploadFolhaAssinada = useCallback(
    async (month: number, year: number, filePath: string, fileHash: string) => {
      if (!userId) {
        throw new Error('Usuário não identificado para upload da folha assinada.');
      }

      setLoading(true);
      setError(null);
      try {
        const updated = await frequenciaService.uploadFolhaAssinadaFuncionario(
          userId,
          month,
          year,
          userId,
          filePath,
          fileHash,
        );
        setFolha(updated);
        return updated;
      } catch (err) {
        const message = getErrorMessage(err, 'Não foi possível enviar a folha assinada.');
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  const reviewFolhaGestor = useCallback(
    async (
      targetUserId: string,
      month: number,
      year: number,
      actorId: string,
      decision: 'aprovar' | 'rejeitar',
      motivo?: string,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const updated = await frequenciaService.reviewFolhaMensalGestor(targetUserId, month, year, actorId, decision, motivo);
        setFolha(updated);
        return updated;
      } catch (err) {
        const message = getErrorMessage(err, 'Não foi possível revisar a folha mensal.');
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const uploadFolhaFinalGestor = useCallback(
    async (
      targetUserId: string,
      month: number,
      year: number,
      actorId: string,
      filePath: string,
      fileHash: string,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const updated = await frequenciaService.uploadFolhaFinalGestor(
          targetUserId,
          month,
          year,
          actorId,
          filePath,
          fileHash,
        );
        setFolha(updated);
        return updated;
      } catch (err) {
        const message = getErrorMessage(err, 'Não foi possível enviar a versão final da folha.');
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const confirmarCienciaFolha = useCallback(
    async (month: number, year: number) => {
      if (!userId) {
        throw new Error('Usuário não identificado para confirmar ciência da folha.');
      }

      setLoading(true);
      setError(null);
      try {
        const updated = await frequenciaService.confirmarCienciaFolhaFuncionario(userId, month, year, userId);
        setFolha(updated);
        return updated;
      } catch (err) {
        const message = getErrorMessage(err, 'Não foi possível confirmar ciência da folha.');
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  return {
    folha,
    loading,
    error,
    refreshFolha,
    emitirFolha,
    uploadFolhaAssinada,
    reviewFolhaGestor,
    uploadFolhaFinalGestor,
    confirmarCienciaFolha,
  };
}
