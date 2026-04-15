import { getSupabaseClient, supabaseConfig } from './supabase';

type UploadAbsencePdfInput = {
  userId: string;
  date: string;
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

export const absenceDocumentService = {
  async uploadAbsencePdf(input: UploadAbsencePdfInput) {
    const supabase = getSupabaseClient();
    const normalizedName = sanitizeFileName(input.fileName || 'comprovante.pdf') || 'comprovante.pdf';
    const path = `ausencias/${input.userId}/${input.date}/${Date.now()}-${normalizedName}`;

    const buffer = await toArrayBuffer(input.fileUri);

    const { error } = await supabase.storage
      .from(supabaseConfig.absenceBucket)
      .upload(path, buffer, {
        contentType: input.mimeType || 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(`Falha no upload do comprovante: ${error.message}`);
    }

    return path;
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
