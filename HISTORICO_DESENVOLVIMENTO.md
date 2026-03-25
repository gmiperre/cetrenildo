# Historico de Desenvolvimento

Este documento registra o historico desta conversa convertido em referencia tecnica do projeto, com foco nas decisoes de arquitetura, mudancas implementadas e estado atual do aplicativo.

## Visao Geral

O projeto `Equipe Cetreina` foi construido como um aplicativo mobile com Expo + React Native + TypeScript, usando Firebase como backend. O foco inicial foi o modulo de frequencia para RH, com autenticacao, historico mensal, justificativas e controle de acesso por perfil.

Ao longo da evolucao, a estrategia tecnica mudou de um fluxo com Firebase Storage para um fluxo 100% gratuito usando apenas Firebase Authentication + Firestore, com justificativa enviada por e-mail e rastreada dentro do app.

## Linha do Tempo

### 1. Estruturacao inicial do aplicativo

Foram definidos e implementados:

- projeto Expo com TypeScript
- arquitetura modular em `src/components`, `src/screens`, `src/navigation`, `src/services`, `src/models`, `src/hooks`, `src/contexts` e `src/utils`
- navegacao com stack e tabs
- shell do app com autenticacao e area autenticada
- integracao inicial com Firebase Authentication e Firestore

Arquivos-base relevantes:

- `App.tsx`
- `app.json`
- `src/navigation/*`
- `src/contexts/AuthContext.tsx`
- `src/services/firebase.ts`

### 2. Implementacao do modulo de frequencia

Foi criado o fluxo principal do produto:

- login com e-mail e senha
- tela inicial com resumo mensal e avisos
- registro de ponto com entrada e saida
- detalhamento do registro diario
- historico mensal por colaborador
- validacao por gestor

Arquivos principais:

- `src/screens/auth/LoginScreen.tsx`
- `src/screens/home/HomeScreen.tsx`
- `src/screens/frequencia/FrequenciaScreen.tsx`
- `src/screens/frequencia/RegistroScreen.tsx`
- `src/screens/frequencia/HistoricoScreen.tsx`
- `src/services/frequenciaService.ts`

### 3. Estrategia inicial com Firebase Storage

Na fase inicial do projeto, foi considerado um fluxo com upload de comprovantes para justificativas usando Firebase Storage. Esse caminho foi preparado no codigo e nas regras, mas depois foi abandonado por motivo de custo e simplicidade operacional.

### 4. Mudanca de estrategia para Firestore-only

Foi tomada a decisao de remover o Firebase Storage e migrar o produto para uma abordagem 100% gratuita. O comprovante passou a ser enviado por e-mail fora do app, e o aplicativo passou a registrar apenas os metadados desse envio:

- texto da justificativa
- status da justificativa
- indicador de envio por e-mail
- assunto do e-mail
- protocolo/message-id opcional
- observacao do gestor em caso de recusa

Resultado da mudanca:

- remocao do Storage da arquitetura
- remocao de dependencias de upload
- atualizacao das telas para o novo fluxo
- atualizacao de regras e modelos para o fluxo sem anexos

### 5. Limpeza do projeto apos remocao do Storage

Foi feita uma limpeza tecnica para retirar restos do fluxo antigo:

- remocao de `storageService`
- remocao de `storage.rules`
- remocao de campos e referencias de URL de arquivo
- remocao de dependencias de upload
- atualizacao da documentacao

### 6. Publicacao das regras do Firestore

Foi configurado `firebase.json` na raiz do projeto e realizado o deploy das regras e dos indices do Firestore para o projeto `equipe-cetreina`.

Arquivos envolvidos:

- `firebase.json`
- `firebase/firestore.rules`
- `firebase/firestore.indexes.json`

### 7. Revisao tecnica completa do projeto

Foi executada uma revisao com foco de producao cobrindo:

- arquitetura e organizacao
- qualidade do codigo
- seguranca
- performance
- testes
- banco de dados

Os principais riscos encontrados foram:

- escalonamento de privilegio nas regras de usuarios
- atualizacao insegura de campos de frequencia
- possibilidade de duplicar registros por usuario e dia
- serializacao incorreta de `Timestamp` no modo offline
- ausencia de testes automatizados

## Fases de Correcao Executadas

### Fase 1. Endurecimento das regras do Firestore

Foi executado o hardening de seguranca em `firebase/firestore.rules`:

- bloqueio de autoelevacao de privilegio para gestor
- restricao de campos editaveis pelo proprio usuario no documento `users`
- restricao de campos editaveis pelo colaborador em `registrosFrequencia`
- validacoes adicionais para criacao de registros e logs

Resultado:

- regras recompiladas e republicadas com sucesso no Firebase

### Fase 2. Integridade de dados de frequencia

Foi reestruturado `src/services/frequenciaService.ts` para impedir duplicidade de registros:

- id deterministico por `userId_data`
- leitura priorizando documento deterministico
- fallback para documentos legados
- escrita transacional com `runTransaction`
- deduplicacao da listagem mensal quando coexistem registros antigos e novos

Resultado:

- novos registros deixaram de depender de `addDoc`
- o fluxo ganhou previsibilidade e menor risco de concorrencia

### Fase 3. Robustez do modo offline

Foi corrigida a persistencia offline:

- serializacao de `Timestamp` para AsyncStorage
- reidratacao de `Timestamp` ao ler cache e fila offline
- tipagem discriminada da fila de acoes pendentes
- metadados de retry e erro por acao offline
- logging de falhas de sincronizacao
- protecao extra no `AuthContext` contra updates tardios e falhas silenciosas

Arquivos principais:

- `src/models/frequencia.ts`
- `src/services/offlineService.ts`
- `src/services/frequenciaService.ts`
- `src/contexts/AuthContext.tsx`

### Fase 4. Refatoracao de dominio e reducao de duplicacao

Foi feita uma refatoracao incremental para reduzir acoplamento e duplicacao:

- extracao de regras puras para `src/domain/frequencia.ts`
- centralizacao de labels de status de justificativa
- centralizacao do calculo de status de justificativa
- centralizacao do mapeamento de erros em `src/utils/errors.ts`
- simplificacao das telas que repetiam essas regras

Resultado:

- menor duplicacao entre service e telas
- base melhor para testes unitarios

### Fase 5. Performance e experiencia de uso

Foi ajustado o fluxo de historico para melhorar comportamento em listas maiores:

- `ScreenShell` passou a suportar telas sem `ScrollView`
- `HistoricoScreen` voltou a usar `FlatList` com rolagem propria
- recuperacao da virtualizacao da lista
- cache simples em memoria para a listagem de equipe de gestores
- ajuste da copy do login para o fluxo atual sem anexos

### Fase 6. Testes automatizados minimos

Foi configurada uma suite inicial com Vitest:

- script `npm run test`
- testes de dominio para regras puras de justificativa
- testes do `offlineService` para serializacao e reidratacao de `Timestamp`

Arquivos de teste adicionados:

- `src/domain/frequencia.test.ts`
- `src/services/offlineService.test.ts`

## Estado Atual do Projeto

No fim deste historico, o projeto encontra-se com as seguintes caracteristicas:

- app mobile focado em Android e iOS
- autenticacao via Firebase Auth
- persistencia de negocio via Firestore
- justificativa por e-mail, sem Firebase Storage
- regras do Firestore publicadas
- registro de frequencia com id deterministico por usuario e data
- cache offline com reidratacao correta de `Timestamp`
- lista de historico com virtualizacao restaurada
- testes unitarios minimos em execucao com `npm run test`

## Limitacoes Conhecidas

Apesar da evolucao, ainda restam pontos relevantes para a proxima etapa:

- faltam testes com Firestore Emulator para validar regras de seguranca
- falta teste automatizado do replay completo da fila offline
- o registro de eventos ainda nao substitui uma auditoria forte de backend
- o alvo web ainda nao esta preparado
- ainda nao existe suite E2E para o fluxo completo com colaborador e gestor

## Proximos Passos Recomendados

1. Adicionar testes das regras do Firestore com Emulator.
2. Adicionar testes do `flushPendingActions` e cenario de retry.
3. Evoluir logs de alteracao para um fluxo mais confiavel de backend.
4. Executar rodada de testes manuais com usuario colaborador e gestor em dispositivo real.
5. Se houver necessidade de build nativa/EAS com mais servicos Firebase, revisar a configuracao do Expo para Android e iOS.
