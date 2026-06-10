import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, initializeAuth } from 'firebase/auth';
import { getReactNativePersistence } from '@firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

type ExpoFirebaseConfig = FirebaseOptions & {
  messagingSenderId?: string;
};

const fallbackConfig: ExpoFirebaseConfig = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const config = (
  Constants.expoConfig?.extra?.firebaseConfig
  ?? Constants.expoConfig?.extra?.firebase
  ?? fallbackConfig
) as ExpoFirebaseConfig;

export const isFirebaseConfigured = !Object.values(config).some((value) => !value || `${value}`.startsWith('YOUR_'));

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
const secondaryAuthAppName = 'employee-provisioning';

export const firebaseApp = app;
export const auth: Auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // já inicializado (hot reload)
    const { getAuth } = require('firebase/auth');
    return getAuth(app);
  }
})();
export const db: Firestore = getFirestore(app);

export const getSecondaryAuthApp = () => {
  const existingApp = getApps().find((item) => item.name === secondaryAuthAppName);
  return existingApp ?? initializeApp(config, secondaryAuthAppName);
};

export const ensureFirebaseConfigured = () => {
  if (!isFirebaseConfigured) {
    throw new Error('Configure o Firebase no app.json antes de autenticar ou sincronizar dados.');
  }
};