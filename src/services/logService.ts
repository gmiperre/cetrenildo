import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { AuditLog } from '../models/log';
import { db, ensureFirebaseConfigured } from './firebase';

const logsCollection = collection(db, 'logsAlteracao');

export const logService = {
  async create(entry: Omit<AuditLog, 'id' | 'timestamp'>) {
    ensureFirebaseConfigured();

    return addDoc(logsCollection, {
      ...entry,
      timestamp: serverTimestamp(),
    });
  },
};