export type UserRole = 'padrao' | 'gestor';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  tipo: UserRole;
  horarioEntradaEsperado: string;
  horarioSaidaEsperado: string;
  pushToken?: string | null;
}