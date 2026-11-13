---
name: desenvolvimento-app
description: Conduz o desenvolvimento completo de um app ou funcionalidade, do zero até a entrega, em fases com aprovação do usuário entre cada uma - entrevista de descoberta, telas, PRD, regras de negócio, banco de dados, segurança, plano e rotina de construção, implementação e testes de segurança. Use quando o usuário pedir "desenvolvimento app", "desenvolver um app", "criar um sistema do zero", "planejar uma funcionalidade nova", ou chamar /desenvolvimento-app. Aceita uma fase como argumento para começar ou retomar dela (ex.: /desenvolvimento-app seguranca).
---

# Desenvolvimento de App — do conceito à entrega

Você conduz o usuário por um processo completo de desenvolvimento, **uma fase por vez**.
Cada fase gera um documento em `docs/produto/`. Nenhuma fase começa antes da anterior ser aprovada.

## Princípios

- **Pergunte antes de supor.** Na dúvida sobre uma regra, pergunte. Nunca invente regra de negócio.
- **Uma fase por vez.** Ao fim de cada fase: mostre um resumo curto, aponte o que ficou em aberto e peça aprovação. Só avance com "ok".
- **Perguntas em rodadas pequenas.** No máximo 4 perguntas por vez, de preferência com opções (use AskUserQuestion quando disponível). Linguagem simples, sem jargão técnico — quem responde pode não ser programador.
- **Projeto existente: leia o código primeiro.** Se já há código, mapeie o que existe (telas, rotas, banco, integrações) antes de perguntar. Não pergunte o que o código já responde.
- **Tudo vira documento.** Decisões tomadas na conversa vão para `docs/produto/decisoes.md` com data e motivo.
- **Use as outras skills quando existirem.** Os nomes abaixo são sugestões; se uma skill não estiver disponível, faça a etapa você mesmo.

## Retomada

Ao ser chamada, verifique quais arquivos já existem em `docs/produto/`.
- Se o usuário passou uma fase como argumento, comece por ela (avise se uma fase anterior obrigatória está faltando).
- Se não passou, continue da primeira fase sem documento aprovado.
- Diga em uma linha onde o projeto está: "Fases 0–3 prontas. Próxima: Banco de dados."

## As fases

| # | Fase | Argumento | Documento |
|---|---|---|---|
| 0 | Descoberta | `descoberta` | `00-descoberta.md` |
| 1 | Telas e fluxos | `telas` | `01-telas.md` (+ protótipo) |
| 2 | PRD | `prd` | `02-prd.md` |
| 3 | Regras de negócio | `regras` | `03-regras-de-negocio.md` |
| 4 | Banco de dados | `banco` | `04-banco-de-dados.md` |
| 5 | Segurança | `seguranca` | `05-seguranca.md` |
| 6 | Plano e rotina de construção | `plano` | `06-plano-de-construcao.md` |
| 7 | Rotinas do sistema | `rotinas` | `07-rotinas-do-sistema.md` |
| 8 | Construção | `construcao` | código + atualização do plano |
| 9 | Testes e auditoria de segurança | `testes` | `09-testes.md` |

Os modelos de cada documento estão em [modelos.md](modelos.md). Leia o modelo da fase antes de escrevê-la.

### Fase 0 — Descoberta

Objetivo: entender o problema antes de qualquer tela.
Pergunte em rodadas, nesta ordem:
1. **Problema:** que dor o app resolve? Como a pessoa resolve isso hoje?
2. **Usuários:** quem usa? Quantos perfis diferentes (ex.: médico, secretária, admin)?
3. **Tarefas principais:** as 3 a 5 coisas que o usuário mais faz. Peça um exemplo real de cada.
4. **Canais:** celular, computador, WhatsApp, e-mail?
5. **Dados:** que informações entram e saem? Vêm de onde (foto, PDF, digitado, outro sistema)?
6. **Restrições:** prazo, orçamento, tecnologia já escolhida, leis (LGPD, dados de saúde, financeiros).
7. **Sucesso:** como saber que deu certo? Um número, se possível.

Se o usuário não souber responder algo, registre como "em aberto" e siga — não trave.

### Fase 1 — Telas e fluxos

1. Liste as telas necessárias a partir das tarefas principais. Corte o que não serve a uma tarefa.
2. Para cada tarefa, desenhe o fluxo: tela → ação → resultado → próxima tela. Conte os toques; menos é melhor.
3. Prototipe as telas-chave (no máximo 3 primeiro). Use **artifact-design** e **web-artifacts-builder** se disponíveis; senão, um HTML simples.
4. Se o usuário mandou imagens de referência, siga a identidade visual delas e diga o que manteve e o que mudou.

### Fase 2 — PRD

Documento de requisitos: objetivo, público, escopo (o que entra **e o que não entra**), requisitos funcionais numerados (RF-01…), não funcionais (RNF-01…), métricas de sucesso e riscos. Cada requisito funcional aponta para a tela da Fase 1 onde acontece.

### Fase 3 — Regras de negócio

A fase mais importante. Para **cada comportamento** do sistema, escreva:
- **Quando** (situação), **então** (o que o sistema faz), **exceções**, **quem decide** em caso de dúvida (sistema ou usuário).
- Um **exemplo real** com dados concretos.

Procure ativamente os casos de borda: duplicidade, dado faltando, dado conflitante, valor zero ou negativo, reenvio do mesmo arquivo, mesma pessoa com nome escrito diferente, ação desfeita.
Para cada regra que só um especialista sabe responder, gere uma pergunta em linguagem simples, com exemplo, que o usuário possa repassar a essa pessoa.
Se uma regra puder variar por cliente, marque como **configurável** — ela deve ir para o banco, não para o código.

### Fase 4 — Banco de dados

Derive o modelo das regras da Fase 3, não o contrário. Para cada tabela: campos, tipos, obrigatórios, únicos, índices, relacionamentos e **classificação do dado** (público, pessoal, sensível — ex.: saúde, CPF, financeiro).
Defina como evitar duplicidade no nível do banco (chaves únicas, hash de arquivo) e como migrar dados existentes.
Se possível, desenhe o diagrama com **artifact-diagramming**.

### Fase 5 — Segurança

1. Classifique o **nível de segurança** com base nos dados da Fase 4:
   - **Baixo**: nada pessoal. **Médio**: dados pessoais comuns. **Alto**: dados financeiros ou CPF. **Crítico**: dados de saúde ou pagamentos.
2. Monte o checklist do nível: autenticação, autorização (cada usuário só vê o que é dele), isolamento por usuário no banco, segredos fora do código, upload de arquivos, limite de requisições, logs sem dados sensíveis, backup, LGPD (consentimento, exclusão de dados, base legal).
3. Liste as ameaças principais (quem poderia atacar, como, o que perderia) e a defesa de cada uma.

### Fase 6 — Plano e rotina de construção

1. Quebre o trabalho em **etapas entregáveis**: cada etapa termina com algo que o usuário consegue testar. A primeira etapa é a mais fina possível que já gera valor.
2. Para cada etapa: tarefas, requisitos (RF) e regras cobertas, critério de pronto.
3. Defina a rotina: branch por etapa, commits pequenos, revisão antes de subir, como fazer deploy e como voltar atrás se der errado.

### Fase 7 — Rotinas do sistema

O que o sistema faz sozinho, sem o usuário pedir: tarefas agendadas, processamentos em segundo plano, notificações, limpezas, relatórios automáticos. Para cada uma: gatilho, frequência, o que faz, o que acontece se falhar, como é monitorada.

### Fase 8 — Construção

Implemente **uma etapa do plano por vez**:
1. Implemente seguindo as regras da Fase 3 — cite o ID da regra em casos não óbvios.
2. Rode o app e veja funcionando (**run** se disponível). Teste o caminho feliz e os casos de borda da Fase 3.
3. Revise com **code-review** e **simplify** se disponíveis.
4. Atualize o plano marcando a etapa como pronta e mostre ao usuário o que testar.

### Fase 9 — Testes e auditoria de segurança

1. Rode **security-review** se disponível.
2. Teste o checklist da Fase 5 item por item, com o resultado de cada um (passou / falhou / não testado e por quê).
3. Testes obrigatórios: acessar dado de outro usuário, requisição sem login, upload de arquivo malicioso ou gigante, entrada com caracteres especiais, reenvio duplicado.
4. Registre o que falhou como tarefa no plano. Não declare "seguro" se algo ficou sem teste.

## Fim de cada fase

Termine sempre com:
- **Feito:** 1–2 linhas.
- **Em aberto:** perguntas pendentes (ou "nada").
- **Próxima fase:** nome, e a pergunta "Posso seguir?".
