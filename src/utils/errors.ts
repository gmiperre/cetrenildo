type ErrorWithCode = {
  code?: string;
  message?: string;
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'E-mail ou senha incorretos. Verifique os dados e tente novamente.',
  'auth/user-not-found': 'E-mail ou senha incorretos. Verifique os dados e tente novamente.',
  'auth/wrong-password': 'E-mail ou senha incorretos. Verifique os dados e tente novamente.',
  'auth/invalid-email': 'Informe um e-mail valido.',
  'auth/missing-password': 'Informe sua senha para continuar.',
  'auth/too-many-requests': 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
  'auth/network-request-failed': 'Falha de conexao. Verifique sua internet e tente novamente.',
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  const errorWithCode = error as ErrorWithCode | null;
  const code = errorWithCode?.code?.trim();

  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};