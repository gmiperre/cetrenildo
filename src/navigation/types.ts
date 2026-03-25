export type AuthStackParamList = {
  Login: undefined;
};

export type FrequenciaStackParamList = {
  FrequenciaHome: undefined;
  Registro: {
    date: string;
    userId?: string;
  };
  Historico: undefined;
};

export type AppTabParamList = {
  HomeTab: undefined;
  FrequenciaTab: undefined;
};