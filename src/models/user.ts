export type UserRole = 'padrao' | 'gestor';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  tipo: UserRole;
  horarioEntradaEsperado: string;
  horarioSaidaEsperado: string;
  fotoPerfilUri?: string | null;
  pushToken?: string | null;
}

export type UserDirectoryEntry = Pick<
  UserProfile,
  'id' | 'nome' | 'email' | 'tipo' | 'horarioEntradaEsperado' | 'horarioSaidaEsperado'
>;