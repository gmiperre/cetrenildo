# Cronograma do Projeto

## 1. Objetivo do documento

Este documento consolida o cronograma do projeto desde o seu início, registrando:

- as etapas já implementadas
- o escopo entregue em cada fase
- o prazo de entrega de cada etapa
- os artefatos de evidência de entrega
- as formas de acompanhamento dos resultados técnicos e funcionais

Este cronograma foi estruturado a partir do histórico técnico do repositório, da documentação já existente e do escopo implementado até 21/04/2026.

## 2. Premissas de consolidação

- Data-base de início identificada no repositório: 25/03/2026.
- Como nem todas as entregas possuem marco formal datado no histórico de commits, os prazos abaixo foram consolidados por fases de execução e evolução funcional.
- O cronograma abaixo representa o andamento real do projeto e o escopo efetivamente implementado, e não um planejamento contratual prévio.

## 3. Visão geral do projeto

Produto: aplicativo mobile para apoio às rotinas operacionais de RH, com foco principal em frequência funcional.

Stack principal:

- Expo + React Native
- TypeScript
- Firebase Authentication
- Firestore
- Supabase Storage para PDFs e documentos
- Navegação modular com React Navigation

Módulos e frentes já entregues:

- autenticação
- frequência diária
- histórico mensal
- justificativas e ausências
- calendário de dias especiais
- contestação de presença
- mensagens e notificações in-app
- fluxo de folha mensal com geração e revisão de PDF
- área de equipe para gestor

## 4. Cronograma consolidado por etapa

| Etapa | Escopo principal | Entregas implementadas | Prazo de entrega | Status |
|---|---|---|---|---|
| 1. Estruturação inicial | Fundação do app e arquitetura-base | Projeto Expo com TypeScript, estrutura em `src/`, integração inicial com Firebase, navegação autenticada | 25/03/2026 a 26/03/2026 | Concluída |
| 2. Módulo inicial de frequência | Fluxo principal do colaborador | Login, home, registro diário, histórico mensal, detalhamento do dia, base de validação por gestor | 26/03/2026 a 27/03/2026 | Concluída |
| 3. Ajuste de arquitetura backend | Simplificação do fluxo de justificativas | Migração da estratégia de anexos em Firebase Storage para fluxo principal em Firestore, limpeza de dependências antigas, revisão de documentação | 28/03/2026 a 31/03/2026 | Concluída |
| 4. Segurança e integridade de dados | Endurecimento técnico do núcleo do sistema | Hardening das regras do Firestore, restrição de permissões por papel, ID determinístico por `userId_data`, escrita transacional, prevenção de duplicidade | 01/04/2026 a 04/04/2026 | Concluída |
| 5. Modo offline, domínio e testes | Robustez e qualidade interna | Serialização correta de `Timestamp`, fila offline tipada, refatoração de regras para `src/domain/frequencia.ts`, padronização de erros, testes unitários iniciais com Vitest | 05/04/2026 a 08/04/2026 | Concluída |
| 6. Evolução operacional da frequência | Usabilidade e cobertura de casos reais | Registro retroativo, calendário de dias especiais, bloqueio de ponto em dias sem expediente, ajustes de navegação, catálogo de módulos | 09/04/2026 a 12/04/2026 | Concluída |
| 7. Contestação e comunicação | Fluxo bilateral entre gestor e colaborador | Contestação de presença, resposta do funcionário, encerramento e reabertura de contestação, notificações in-app, tela de mensagens, detalhe gerencial do funcionário | 13/04/2026 a 16/04/2026 | Concluída |
| 8. Folha mensal e documentos PDF | Fechamento mensal e rastreabilidade documental | Emissão da folha mensal, upload de PDFs, revisão do gestor, versão final assinada, mensagens da folha, geração da folha em PDF baseada em template oficial com calibragem visual | 17/04/2026 a 21/04/2026 | Concluída |

## 5. Detalhamento das tarefas por etapa

### Etapa 1. Estruturação inicial

Entregas:

- criação da base do aplicativo com Expo e TypeScript
- separação por camadas em componentes, telas, navegação, serviços, modelos, hooks e utilitários
- criação do fluxo autenticado e não autenticado
- configuração inicial do Firebase

Critério de aceite:

- o projeto compila
- o app navega entre login e área autenticada
- a base de serviços e contexto foi estabelecida

### Etapa 2. Módulo inicial de frequência

Entregas:

- tela de login
- tela inicial com resumo do dia e do mês
- registro diário de ponto
- tela de detalhe do registro
- histórico mensal por usuário

Critério de aceite:

- o colaborador consegue acessar o módulo de frequência
- o registro diário pode ser criado e consultado
- o histórico mensal pode ser listado

### Etapa 3. Ajuste de arquitetura backend

Entregas:

- revisão da arquitetura de justificativas
- consolidação do fluxo operacional principal sem dependência do Firebase Storage
- limpeza técnica do código legado de anexos antigos
- atualização documental do estado real do projeto

Critério de aceite:

- o fluxo de justificativa fica coerente com a arquitetura vigente
- o projeto permanece funcional após remoção do legado antigo

### Etapa 4. Segurança e integridade de dados

Entregas:

- endurecimento de `firebase/firestore.rules`
- bloqueio de autoelevação de privilégio
- atualização segura de documentos `users` e `registrosFrequencia`
- criação de registros com identificador determinístico
- prevenção de duplicidade em cenários concorrentes

Critério de aceite:

- regras compiladas e publicadas
- operações críticas respeitam o papel do usuário
- um mesmo usuário não gera registros duplicados para a mesma data

### Etapa 5. Modo offline, domínio e testes

Entregas:

- reidratação correta de `Timestamp`
- fila offline mais robusta
- centralização das regras de domínio
- padronização de mensagens de erro
- testes unitários mínimos para domínio e persistência offline

Critério de aceite:

- ações offline mantêm consistência ao sincronizar
- os testes automatizados executam sem falhas
- regras de negócio deixam de ficar duplicadas em múltiplas telas e serviços

### Etapa 6. Evolução operacional da frequência

Entregas:

- registro retroativo de presença
- suporte a calendário especial (`feriado`, `ponto facultativo`, `sem expediente`)
- bloqueio de ação quando não há expediente
- reorganização da navegação por módulos
- abertura direta do registro do dia a partir do módulo de frequência

Critério de aceite:

- o usuário consegue tratar esquecimentos de registro
- dias sem expediente são respeitados pelo sistema
- o acesso ao fluxo operacional fica mais direto

### Etapa 7. Contestação e comunicação

Entregas:

- contestação de presença pelo gestor
- resposta do colaborador
- decisão final do gestor
- reabertura de contestação com rastreio de ciclo
- coleção e serviço de mensagens
- tela de mensagens
- tela gerencial de detalhe de funcionário

Critério de aceite:

- um gestor consegue abrir e concluir uma contestação
- o funcionário recebe e responde a contestação
- o sistema notifica os envolvidos e preserva o histórico do caso

### Etapa 8. Folha mensal e documentos PDF

Entregas:

- modelo de dados e hook de folha mensal
- fluxo de emissão, envio, revisão, rejeição, aprovação e conclusão da folha
- upload de PDFs via Supabase Storage
- mensagens de status da folha
- geração da folha mensal em PDF com base no modelo oficial
- ajuste fino de posicionamento visual na página 1 e página 2 do PDF
- preenchimento de justificativas na segunda página conforme o dia do registro

Critério de aceite:

- a folha do mês pode ser emitida
- o PDF é gerado a partir do modelo oficial
- o gestor consegue revisar a folha e anexar a versão final
- as justificativas aparecem no quadro correto da segunda página

## 6. Marcos de entrega

| Marco | Resultado esperado | Data-limite consolidada | Situação |
|---|---|---|---|
| M1. Base funcional do app | App autenticado e arquitetura-base criada | 26/03/2026 | Entregue |
| M2. Frequência operacional | Registro diário e histórico disponíveis | 27/03/2026 | Entregue |
| M3. Segurança reforçada | Regras do Firestore endurecidas e integridade de dados protegida | 04/04/2026 | Entregue |
| M4. Robustez técnica | Offline, domínio e testes mínimos estabilizados | 08/04/2026 | Entregue |
| M5. Casos operacionais avançados | Registro retroativo e calendário especial implantados | 12/04/2026 | Entregue |
| M6. Contestação ponta a ponta | Fluxo bilateral com mensagens concluído | 16/04/2026 | Entregue |
| M7. Folha mensal em PDF | Fluxo mensal com emissão e revisão documental disponível | 21/04/2026 | Entregue |

## 7. Formas de acompanhamento dos resultados

O acompanhamento dos resultados do projeto deve combinar validação técnica, validação funcional e indicadores operacionais.

### 7.1. Acompanhamento técnico

Métodos:

- compilação com `npx tsc --noEmit`
- execução de testes com `npm run test`
- revisão das regras do Firestore antes de deploy
- validação manual dos fluxos críticos em ambiente de desenvolvimento

Indicadores sugeridos:

- projeto compilando sem erros
- testes unitários passando
- ausência de regressões visíveis nos fluxos principais
- regras publicadas sem erro no Firebase

### 7.2. Acompanhamento funcional

Métodos:

- checklist manual de homologação por perfil de usuário
- validação em dispositivo com usuário colaborador
- validação em dispositivo com usuário gestor
- conferência visual da geração de PDF contra o modelo oficial

Indicadores sugeridos:

- login bem-sucedido
- registro diário funcionando para dia atual e dia passado
- justificativa podendo ser enviada e revisada
- contestação funcionando de ponta a ponta
- folha emitida, revisada e concluída sem falha

### 7.3. Acompanhamento operacional do produto

Métodos:

- revisão semanal de entregas concluídas
- registro de mudanças em `CHANGELOG.md`
- atualização do histórico técnico em `HISTORICO_DESENVOLVIMENTO.md`
- conferência periódica das coleções do Firestore e objetos no Supabase Storage

Indicadores sugeridos:

- quantidade de pendências de frequência por usuário
- quantidade de justificativas em análise, aprovadas e recusadas
- quantidade de contestações abertas, encerradas e reabertas
- quantidade de folhas emitidas, rejeitadas, aprovadas e concluídas

## 8. Instrumentos de controle recomendados

Para acompanhamento contínuo, recomenda-se usar os seguintes instrumentos:

### 8.1. Controle de entregas

- `CHANGELOG.md` para mudanças relevantes
- este `cronograma.md` para visão executiva de etapas e prazos

### 8.2. Controle de qualidade

- `npx tsc --noEmit`
- `npm run test`
- checklist funcional descrito no `README.md`

### 8.3. Controle de resultado por fluxo

- autenticação: validação de login, recuperação de senha e sessão
- frequência: criação, edição, retroatividade e histórico
- ausências: justificativa, documento, análise do gestor
- contestação: abertura, resposta, decisão e reabertura
- folha mensal: emissão, assinatura, revisão, versão final e ciência

## 9. Situação atual do cronograma

Resumo executivo em 21/04/2026:

- todas as etapas estruturantes e operacionais do escopo atual foram entregues
- o projeto possui fluxo principal de frequência funcional
- o módulo de folha mensal já foi implementado com emissão documental em PDF
- a principal frente remanescente passa a ser refinamento, homologação ampliada e cobertura adicional de testes

## 10. Próximos acompanhamentos sugeridos

As próximas rodadas de acompanhamento devem priorizar:

- homologação completa dos fluxos por perfil
- testes adicionais de regras do Firestore com Emulator
- testes mais profundos de replay offline
- consolidação final dos ajustes finos do PDF da folha mensal
- expansão futura dos módulos de férias e equipe