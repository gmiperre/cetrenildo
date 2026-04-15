import Constants from 'expo-constants';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

type SupabaseConfig = {
  url?: string;
  anonKey?: string;
  absenceBucket?: string;
};

const config = (Constants.expoConfig?.extra?.supabase ?? {}) as SupabaseConfig;

const fallbackConfig: Required<SupabaseConfig> = {
  url: 'YOUR_SUPABASE_URL',
  anonKey: 'YOUR_SUPABASE_ANON_KEY',
  absenceBucket: 'absence-documents',
};

const mergedConfig = {
  ...fallbackConfig,
  ...config,
};

export const isSupabaseConfigured =
  Boolean(mergedConfig.url)
  && Boolean(mergedConfig.anonKey)
  && !mergedConfig.url.startsWith('YOUR_')
  && !mergedConfig.anonKey.startsWith('YOUR_');

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured) {
    throw new Error('Configure o Supabase no app.json para habilitar upload e download de PDFs.');
  }

  if (!supabaseClient) {
    supabaseClient = createClient(mergedConfig.url, mergedConfig.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
};

export const supabaseConfig = {
  absenceBucket: mergedConfig.absenceBucket,
};
