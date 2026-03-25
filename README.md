# Equipe Cetreina

Aplicativo mobile em React Native com Expo e backend Firebase para apoiar rotinas de RH, com foco inicial em controle de frequência e estrutura pronta para expansão modular.

Documentacao complementar:

- veja `HISTORICO_DESENVOLVIMENTO.md` para o registro cronologico das decisoes e implementacoes desta evolucao

Status atual:

- Aplicacao mobile focada em Android e iOS
- Backend usando Firebase Authentication e Firestore
- Fluxo de justificativa por e-mail, sem Firebase Storage
- Regras do Firestore publicadas no projeto `equipe-cetreina`

## Stack

- Expo + React Native
- TypeScript
- Firebase Authentication e Firestore
- React Navigation com Stack + Bottom Tabs
- Context API para sessão e perfil
- Sincronização offline básica com AsyncStorage

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
- Persistência de sessão via Firebase Auth
- Home com resumo mensal, avisos e botão único de ponto
- Fluxo de frequência com registro diário, histórico e validação
- Justificativa por e-mail com rastreio no app
- Controle de acesso no frontend e nas regras do Firestore
- Registro de eventos de alteração para criação, edição e validação
- Fila offline básica para criação e atualização de registros

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

## Regras e índices

Arquivos prontos para deploy:

- firebase/firestore.rules
- firebase/firestore.indexes.json

Deploy com Firebase CLI:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project <seu-project-id> --config firebase.json
```

Importante:

- Este projeto esta configurado para funcionar sem Firebase Storage.
- O arquivo `firebase.json` da raiz aponta para `firebase/firestore.rules` e `firebase/firestore.indexes.json`.

## Rodando o projeto

```bash
npm install
npm run start
```

Atalhos disponiveis:

```bash
npm run android
npm run ios
```

Limitacao atual:

- O alvo web ainda nao esta pronto neste projeto.
- O script `npm run web` existe, mas exige instalacao e configuracao adicional de dependencias como `react-dom` e `react-native-web`.

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

## Observações

- O app cria automaticamente o documento do usuário na coleção users no primeiro login autenticado.
- O fluxo opcional de notificações usa expo-notifications como camada cliente. Para envio remoto real via FCM, configure as credenciais nativas do Firebase no projeto Expo/EAS.
- O registro de eventos atual ajuda no rastreio operacional, mas nao deve ser tratado como trilha de auditoria forte de backend.
- O resumo mensal considera dias úteis como base para apuração simples de faltas.