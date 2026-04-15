import { getSupabaseClient, supabaseConfig } from './supabase';

type UploadFolhaPdfInput = {
  userId: string;
  month: number;
  year: number;
  fileName: string;
  mimeType: string;
  fileUri: string;
};

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();

const toArrayBuffer = async (fileUri: string) => {
  const response = await fetch(fileUri);
  if (!response.ok) {
    throw new Error('Nao foi possivel ler o PDF selecionado para upload.');
  }

  return response.arrayBuffer();
};

const fnv1aHash = (value: Uint8Array) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value[i];
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const folhaDocumentService = {
  async uploadFolhaOriginalEmitida(input: UploadFolhaPdfInput) {
    const supabase = getSupabaseClient();
    const normalizedMonth = `${input.month}`.padStart(2, '0');
    const normalizedName = sanitizeFileName(input.fileName || 'folha-frequencia.pdf') || 'folha-frequencia.pdf';
    const path = `folhas/original/${input.userId}/${input.year}-${normalizedMonth}/${Date.now()}-${normalizedName}`;

    const buffer = await toArrayBuffer(input.fileUri);
    const bytes = new Uint8Array(buffer);
    const hash = fnv1aHash(bytes);

    const { error } = await supabase.storage
      .from(supabaseConfig.absenceBucket)
      .upload(path, buffer, {
        contentType: input.mimeType || 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(`Falha no upload da folha emitida: ${error.message}`);
    }

    return {
      path,
      hash,
    };
  },

  async uploadFolhaFuncionarioAssinada(input: UploadFolhaPdfInput) {
    const supabase = getSupabaseClient();
    const normalizedMonth = `${input.month}`.padStart(2, '0');
    const normalizedName = sanitizeFileName(input.fileName || 'folha-assinada.pdf') || 'folha-assinada.pdf';
    const path = `folhas/funcionario-assinada/${input.userId}/${input.year}-${normalizedMonth}/${Date.now()}-${normalizedName}`;

    const buffer = await toArrayBuffer(input.fileUri);
    const bytes = new Uint8Array(buffer);
    const hash = fnv1aHash(bytes);

    const { error } = await supabase.storage
      .from(supabaseConfig.absenceBucket)
      .upload(path, buffer, {
        contentType: input.mimeType || 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(`Falha no upload da folha assinada: ${error.message}`);
    }

    return {
      path,
      hash,
    };
  },

  async uploadFolhaGestorFinal(input: UploadFolhaPdfInput) {
    const supabase = getSupabaseClient();
    const normalizedMonth = `${input.month}`.padStart(2, '0');
    const normalizedName = sanitizeFileName(input.fileName || 'folha-final-assinada.pdf') || 'folha-final-assinada.pdf';
    const path = `folhas/gestor-final/${input.userId}/${input.year}-${normalizedMonth}/${Date.now()}-${normalizedName}`;

    const buffer = await toArrayBuffer(input.fileUri);
    const bytes = new Uint8Array(buffer);
    const hash = fnv1aHash(bytes);

    const { error } = await supabase.storage
      .from(supabaseConfig.absenceBucket)
      .upload(path, buffer, {
        contentType: input.mimeType || 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(`Falha no upload da versão final assinada: ${error.message}`);
    }

    return {
      path,
      hash,
    };
  },

  async createDownloadUrl(path: string, expiresInSeconds = 600) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(supabaseConfig.absenceBucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Falha ao gerar link de download: ${error?.message ?? 'URL indisponivel'}`);
    }

    return data.signedUrl;
  },
};
