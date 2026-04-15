import AsyncStorage from '@react-native-async-storage/async-storage';
import { Timestamp } from 'firebase/firestore';

import { FolhaFrequenciaMensal, FrequenciaRegistro, OfflineAction } from '../models/frequencia';

const OFFLINE_ACTIONS_KEY = '@equipe-cetreina/offline-actions';
const TIMESTAMP_TAG = '__firestoreTimestamp';

const cacheKey = (userId: string) => `@equipe-cetreina/cache/${userId}`;
const folhasCacheKey = (userId: string) => `@equipe-cetreina/cache/folhas/${userId}`;

const encodeTimestamps = (value: unknown): unknown => {
  if (value instanceof Timestamp) {
    return { [TIMESTAMP_TAG]: value.toMillis() };
  }

  if (Array.isArray(value)) {
    return value.map((item) => encodeTimestamps(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, encodeTimestamps(nestedValue)]));
  }

  return value;
};

const decodeTimestamps = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => decodeTimestamps(item));
  }

  if (value && typeof value === 'object') {
    if (TIMESTAMP_TAG in (value as Record<string, unknown>)) {
      return Timestamp.fromMillis((value as Record<string, number>)[TIMESTAMP_TAG]);
    }

    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, decodeTimestamps(nestedValue)]));
  }

  return value;
};

const serializeJson = (value: unknown) => JSON.stringify(encodeTimestamps(value));

async function readJson<T>(key: string, fallback: T) {
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return decodeTimestamps(JSON.parse(rawValue)) as T;
  } catch {
    return fallback;
  }
}

export const offlineService = {
  async getPendingActions() {
    return readJson<OfflineAction[]>(OFFLINE_ACTIONS_KEY, []);
  },

  async queueAction(action: OfflineAction) {
    const actions = await this.getPendingActions();
    await AsyncStorage.setItem(OFFLINE_ACTIONS_KEY, serializeJson([...actions, action]));
  },

  async replacePendingActions(actions: OfflineAction[]) {
    await AsyncStorage.setItem(OFFLINE_ACTIONS_KEY, serializeJson(actions));
  },

  async getCachedRecords(userId: string) {
    return readJson<FrequenciaRegistro[]>(cacheKey(userId), []);
  },

  async setCachedRecords(userId: string, records: FrequenciaRegistro[]) {
    await AsyncStorage.setItem(cacheKey(userId), serializeJson(records));
  },

  async upsertCachedRecord(record: FrequenciaRegistro) {
    const records = await this.getCachedRecords(record.userId);
    const nextRecords = records.filter((item) => item.data !== record.data);
    nextRecords.push(record);
    await this.setCachedRecords(record.userId, nextRecords);
  },

  async getCachedFolhas(userId: string) {
    return readJson<FolhaFrequenciaMensal[]>(folhasCacheKey(userId), []);
  },

  async setCachedFolhas(userId: string, folhas: FolhaFrequenciaMensal[]) {
    await AsyncStorage.setItem(folhasCacheKey(userId), serializeJson(folhas));
  },

  async upsertCachedFolha(folha: FolhaFrequenciaMensal) {
    const folhas = await this.getCachedFolhas(folha.userId);
    const current = folhas.find((item) => item.userId === folha.userId && item.mes === folha.mes && item.ano === folha.ano);
    const shouldReplace = !current || (folha.updatedAt?.toMillis?.() ?? 0) >= (current.updatedAt?.toMillis?.() ?? 0);

    if (!shouldReplace) {
      return;
    }

    const next = folhas.filter((item) => !(item.userId === folha.userId && item.mes === folha.mes && item.ano === folha.ano));
    next.push(folha);
    await this.setCachedFolhas(folha.userId, next);
  },
};