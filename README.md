# Equipe Cetreina

Aplicativo mobile em React Native com Expo e backend Firebase para apoiar rotinas de RH, com foco inicial em controle de frequência e estrutura pronta para expansão modular.

Documentacao complementar:

- veja `HISTORICO_DESENVOLVIMENTO.md` para o registro cronologico das decisoes e implementacoes desta evolucao
- veja `CHANGELOG.md` para um resumo formal das mudancas por categoria

Status atual:

- Aplicacao com suporte a Android, iOS e Web
- Backend usando Firebase Authentication e Firestore
- Fluxo de justificativa por e-mail, sem Firebase Storage
- Regras do Firestore publicadas no projeto `equipe-cetreina`

Atualizacoes recentes:

- Correcao de permissao para usuario `padrao` registrar e atualizar ponto (entrada/saida)
- Registro retroativo habilitado no detalhe do dia para datas passadas
- Um unico toque registra entrada e saida simultaneamente usando o horario esperado do perfil
- Bloqueio de registro para datas futuras mantido
- Feedback de erro inline na tela de login (sem Alert, mensagem em vermelho acima de "Esqueceu a senha?")
- Suporte a dias especiais via colecao `calendarDays` no Firestore (feriados, ponto facultativo, sem expediente)
- Dias marcados como `requerPonto: false` bloqueiam o botao de ponto e sao sinalizados visualmente no historico

## Stack

- Expo + React Native
- TypeScript
- Firebase Authentication e Firestore
- React Navigation com Stack + Bottom Tabs
- Context API para sessão e perfil
- Sincronização offline básica com AsyncStorage
- React DOM + React Native Web para execucao no navegador

## Estrutura

```text
src/
  components/
  contexts/
  hooks/
  models/
  navigation/
  screens/
  services/
  utils/
firebase/
```

## Módulos entregues

- Login com e-mail e senha
- Recuperacao de senha por e-mail
- Persistência de sessão via Firebase Auth
- Home com resumo mensal, avisos e botão único de ponto
- Fluxo de frequência com registro diário, histórico e validação
- Registro retroativo de presenca com horario esperado (quando aplicavel)
- Justificativa por e-mail com rastreio no app
- Controle de acesso no frontend e nas regras do Firestore
- Registro de eventos de alteração para criação, edição e validação
- Fila offline básica para criação e atualização de registros
- Calendario de dias especiais via Firestore (`calendarDays`) com suporte a feriados, ponto facultativo e sem expediente
- Bloqueio de ponto e sinalização visual para dias marcados como dispensados

## Configuração Firebase

O arquivo `app.json` atualmente já está configurado para o projeto Firebase `equipe-cetreina`.

Se voce for usar outro projeto Firebase, altere os campos em `expo.extra.firebase`:

- apiKey
- authDomain
- projectId
- messagingSenderId
- appId

Observacao sobre Android nativo:

- Este projeto ainda nao esta configurado no `app.json` para consumir `google-services.json` automaticamente em builds nativas.
- Se voce for integrar build Android nativa/EAS com servicos Firebase que exijam esse arquivo, sera necessario adicionar a configuracao correspondente no app Expo.

## Autenticacao e registros de login

O projeto inicia na tela de login e usa Firebase Authentication como mecanismo de autenticacao.

Como funciona hoje:

- O fluxo de entrada e saida de sessao fica centralizado em `src/services/authService.ts`.
- A tela inicial de autenticacao fica em `src/screens/auth/LoginScreen.tsx`.
- A decisao entre area autenticada e nao autenticada fica em `src/navigation/RootNavigator.tsx`.
- A sessao do usuario autenticado e o perfil carregado ficam sob responsabilidade de `src/contexts/AuthContext.tsx`.

Onde os dados ficam registrados:

- O Firebase Authentication controla as credenciais e a sessao do usuario.
- O app cria ou garante o documento do usuario na colecao `users` no primeiro login, via `src/services/userService.ts`.
- O projeto nao mantem, neste momento, uma colecao dedicada de historico de acessos/login/logout.

Recuperacao de senha:

- A tela de login possui a acao `Esqueceu a senha?`.
- O envio do e-mail de redefinicao usa Firebase Authentication.

Observacao sobre cadastro:

- O projeto nao expoe `Cadastre-se` publicamente na interface.
- Para um contexto corporativo de RH, a recomendacao atual e manter a criacao de usuarios como processo controlado, evitando auto-cadastro publico sem regras adicionais.

## Regras e índices

Arquivos prontos para deploy:

- firebase/firestore.rules
- firebase/firestore.indexes.json

Deploy com Firebase CLI:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project <seu-project-id> --config firebase.json
```

Deploy utilizado neste ambiente:

```bash
npx firebase-tools deploy --only firestore:rules --project equipe-cetreina
```

Importante:

- Este projeto esta configurado para funcionar sem Firebase Storage.
- O arquivo `firebase.json` da raiz aponta para `firebase/firestore.rules` e `firebase/firestore.indexes.json`.

## Rodando o projeto

```bash
npm install
npm run start
```

## Setup em nova maquina

Checklist recomendado para colocar o projeto em funcionamento em outro ambiente:

1. Node.js e npm

- Instale Node.js LTS (recomendado Node 20+).
- Confirme as versoes:

```bash
node -v
npm -v
```

2. Clonar o repositorio

```bash
git clone <url-do-repositorio>
cd <nome-da-pasta-do-projeto>
```

3. Instalar dependencias

```bash
npm install
```

4. Configurar Firebase

- Confira o bloco `expo.extra.firebase` em `app.json`.
- Se for usar outro projeto Firebase, atualize:
  - apiKey
  - authDomain
  - projectId
  - messagingSenderId
  - appId

5. Validar configuracao local

```bash
npx expo config --type public
npx tsc --noEmit
```

6. Executar testes

```bash
npm run test
```

7. Iniciar o projeto

```bash
npm run start
```

Atalhos por plataforma:

```bash
npm run android
npm run ios
npm run web
```

8. Publicar regras do Firestore (quando necessario)

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project <seu-project-id> --config firebase.json
```

9. Validacao funcional minima

- Entrar com usuario colaborador.
- Registrar ponto (um toque registra entrada e saida pelo horario esperado do perfil).
- Abrir um dia passado no historico e registrar presenca retroativa.
- Confirmar que a Home exibe confirmacao de frequencia registrada apos o ponto.
- Tentar login com senha errada e confirmar mensagem de erro inline (sem Alert).
- Marcar envio por e-mail e verificar status.
- Entrar com usuario gestor e validar/recusar justificativa.
- Confirmar atualizacao no historico e na Home.
- Inserir um documento em `calendarDays` com `requerPonto: false` e confirmar que o botao de ponto some nesse dia.

Atalhos disponiveis:

```bash
npm run android
npm run ios
npm run web
```

Suporte Web:

- Dependencias web instaladas e compativeis com o SDK atual do Expo (`react-dom` e `react-native-web`).
- O comando `npm run web` pode ser usado para executar o app no navegador.

## Testes

```bash
npm run test
```

Cobertura inicial adicionada:

- regras puras de dominio de frequencia
- serializacao e reidratacao do modo offline

Escopo atual da suite:

- testes unitarios com Vitest
- foco em regras de dominio e persistencia offline

O que ainda nao esta coberto:

- regras do Firestore com Emulator
- replay completo da fila offline
- fluxo fim a fim com autenticacao e navegacao

## Checklist de validacao (Firestore-only)

1. Entrar com um usuario colaborador.
2. Criar ou editar um registro de frequencia e preencher justificativa.
3. Marcar o envio por e-mail no app e confirmar status como Em analise.
4. Entrar com um usuario gestor.
5. Validar ou recusar a justificativa (recusa exige observacao).
6. Confirmar no historico que o status foi atualizado para Validada ou Recusada.
7. Confirmar que o aviso na Home reflete o novo status.

## Calendario de dias especiais (calendarDays)

A colecao `calendarDays` no Firestore permite marcar dias especificos como feriados, ponto facultativo ou sem expediente.

Estrutura de um documento:

```json
{
  "id": "2026-04-21",
  "data": "2026-04-21",
  "tipo": "feriado",
  "requerPonto": false,
  "motivo": "Tiradentes",
  "horarioEntradaOverride": null,
  "horarioSaidaOverride": null
}
```

Campos:

- `tipo`: `util` | `feriado` | `ponto_facultativo` | `sem_expediente`
- `requerPonto`: quando `false`, o botao de ponto e bloqueado e o dia nao conta como falta
- `motivo`: texto livre exibido no app (ex: "Tiradentes")
- `horarioEntradaOverride` / `horarioSaidaOverride`: substitui o horario esperado do perfil nesse dia especifico (formato `"HH:MM"`)

Comportamento:

- A tela de registro exibe o tipo e o motivo do dia com destaque visual
- O historico exibe um chip com o tipo do dia em cada item afetado
- O resumo mensal exclui dias com `requerPonto: false` da contagem de faltas esperadas

Insercao de documentos:

Ate que uma tela de gestao seja adicionada, os documentos devem ser criados diretamente no Firebase Console ou via script. O ID do documento deve ser a propria data no formato `YYYY-MM-DD`.

Permissoes:

- Leitura: qualquer usuario autenticado
- Escrita: apenas gestores (`tipo: 'gestor'` no documento do usuario em `users`)

## Observações

- O app cria automaticamente o documento do usuário na coleção users no primeiro login autenticado.
- O fluxo opcional de notificações usa expo-notifications como camada cliente. Para envio remoto real via FCM, configure as credenciais nativas do Firebase no projeto Expo/EAS.
- O registro de eventos atual ajuda no rastreio operacional, mas nao deve ser tratado como trilha de auditoria forte de backend.
- O resumo mensal considera dias úteis como base para apuração simples de faltas, respeitando `calendarDays` quando disponivel.