import { NavigatorScreenParams } from '@react-navigation/native';

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

export type EquipeStackParamList = {
  EquipeHome: undefined;
  CadastroFuncionario: undefined;
  FuncionarioDetalhe: {
    userId: string;
  };
};

export type AppTabParamList = {
  Home: undefined;
  FrequenciaModule: NavigatorScreenParams<FrequenciaStackParamList> | undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Modulos: undefined;
  MensagensModule: undefined;
  FrequenciaModule: NavigatorScreenParams<FrequenciaStackParamList> | undefined;
  FeriasModule: undefined;
  EquipeModule: NavigatorScreenParams<EquipeStackParamList> | undefined;
};