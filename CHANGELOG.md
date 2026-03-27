# Changelog

Todas as mudanças relevantes deste projeto devem ser documentadas neste arquivo.

Este changelog segue uma estrutura inspirada em Keep a Changelog.

## [Unreleased]

### Added

- Documento `HISTORICO_DESENVOLVIMENTO.md` com o historico cronologico da evolucao do projeto.
- Suite inicial de testes com Vitest.
- Testes unitarios para regras de dominio de justificativa em `src/domain/frequencia.test.ts`.
- Testes de serializacao e reidratacao offline em `src/services/offlineService.test.ts`.
- Modulo de dominio em `src/domain/frequencia.ts` para centralizar regras puras e labels.
- Utilitario `src/utils/errors.ts` para padronizar mensagens de erro na interface.
- Cache simples em memoria para a listagem de equipe em `src/services/userService.ts`.
- Documento `firebase.json` para deploy de regras e indices do Firestore.
- Acao de registro retroativo no detalhe do dia (`RegistroScreen`) para permitir marcar presenca em datas passadas.

### Changed

- Fluxo de justificativa migrado de upload de arquivo para envio por e-mail com rastreio no app.
- `README.md` revisado para refletir o estado real do projeto, limitacoes atuais e comandos corretos de deploy.
- Dependencia `firebase` atualizada para a linha `12.11.0`.
- `ScreenShell` passou a suportar modo sem `ScrollView` para permitir telas com virtualizacao propria.
- `HistoricoScreen` passou a usar `FlatList` com rolagem propria e cabecalho virtualizado.
- `frequenciaService` foi refatorado para compartilhar regras de justificativa com o modulo de dominio.
- `AuthContext` passou a tratar melhor erros de carregamento de perfil e sincronizacao.
- Tratamento de erro nas telas foi padronizado com utilitario unico.
- `frequenciaService.registerPunch` passou a aceitar data alvo e aplicar horario esperado do perfil em registros retroativos.
- Payload offline de `registerPunch` passou a suportar data opcional para replay consistente de marcacoes retroativas.
- `README.md` atualizado com as mudancas de ponto retroativo, permissao de usuario padrao e comando de deploy utilizado.

### Fixed

- Correcao de risco de autoelevacao de privilegio nas regras de usuarios do Firestore.
- Correcao de permissao excessiva para alteracao de campos criticos em registros de frequencia.
- Correcao da criacao de registros de frequencia para usar id deterministico por `userId_data`.
- Correcao de risco de duplicidade de registros em cenarios concorrentes com escrita transacional.
- Correcao da serializacao offline para preservar e reidratar `Timestamp` corretamente.
- Correcao do replay da fila offline com payloads tipados e metadados de retry.
- Correcao da duplicacao de labels e regras de status de justificativa entre telas e services.
- Correcao da copy da tela de login para o fluxo atual sem anexos.
- Correcao das regras para permitir que usuario `padrao` atualize seus proprios campos de ponto (entrada/saida/status) sem ampliar permissao para campos sensiveis.
- Correcao do bloqueio de registro em dias passados, habilitando marcacao retroativa para casos de esquecimento de presenca.

### Security

- Hardening de `firebase/firestore.rules` para restringir criacao e atualizacao de `users` e `registrosFrequencia`.
- Regras do Firestore recompiladas e publicadas no projeto `equipe-cetreina`.
- Vulnerabilidades reportadas pelo `npm audit` em `undici` foram eliminadas por meio da atualizacao do SDK Firebase.
- Atualizacao de `firebase/firestore.rules` publicada com permissao especifica e restrita para update de ponto pelo proprio usuario autenticado.

## [1.0.0]

### Added

- Estrutura inicial do aplicativo Expo com TypeScript.
- Integracao base com Firebase Authentication e Firestore.
- Navegacao com stack autenticado e tabs principais.
- Modulo inicial de frequencia com telas de login, home, registro diario e historico.
- Persistencia de sessao, resumo mensal e fila offline basica.
