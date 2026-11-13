# Modelos dos documentos

Use estes modelos como esqueleto. Remova seções que não se aplicam; não deixe seção vazia.

---

## 00-descoberta.md

```markdown
# Descoberta — <nome do produto>
Data: <AAAA-MM-DD>

## Problema
<a dor, em 2-3 frases> — Hoje resolvem assim: <...>

## Usuários
| Perfil | Quem é | O que mais faz |
|---|---|---|

## Tarefas principais
1. <tarefa> — Exemplo real: <...>

## Canais
## Dados que entram e saem
## Restrições (prazo, orçamento, tecnologia, leis)
## Como medir sucesso
## Em aberto
```

---

## 01-telas.md

```markdown
# Telas e fluxos

## Lista de telas
| Tela | Para qual tarefa | Essencial? |
|---|---|---|

## Fluxos
### <Tarefa>
<Tela A> → <ação> → <Tela B> → <resultado>   (N toques)

## Protótipos
<links ou caminhos dos arquivos>

## Decisões visuais
<cores, tipografia, o que foi mantido das referências>
```

---

## 02-prd.md

```markdown
# PRD — <nome>

## Objetivo
## Público
## Escopo
**Entra:** ...
**Não entra (por enquanto):** ...

## Requisitos funcionais
| ID | Requisito | Tela | Prioridade |
|---|---|---|---|
| RF-01 | | | Alta |

## Requisitos não funcionais
| ID | Requisito |
|---|---|
| RNF-01 | Desempenho: ... |

## Métricas de sucesso
## Riscos
| Risco | Impacto | Como reduzir |
|---|---|---|
```

---

## 03-regras-de-negocio.md

```markdown
# Regras de negócio

## RN-01 — <nome curto>
- **Quando:** <situação>
- **Então:** <o que o sistema faz>
- **Exceções:** <...>
- **Quem decide na dúvida:** sistema | usuário
- **Configurável por cliente?** sim | não
- **Exemplo:** <dados concretos>
- **Requisitos:** RF-..

## Perguntas para o especialista
1. <pergunta simples> — Exemplo: <...> — Opções: A) ... B) ...
```

---

## 04-banco-de-dados.md

```markdown
# Banco de dados

## <tabela>
| Campo | Tipo | Obrigatório | Único | Classificação | Observação |
|---|---|---|---|---|---|

Índices: ...
Relacionamentos: ...
Regras atendidas: RN-..

## Anti-duplicidade
## Migração de dados existentes
## Diagrama
```

---

## 05-seguranca.md

```markdown
# Segurança

## Nível: <Baixo | Médio | Alto | Crítico>
Motivo: <quais dados levaram a esse nível>

## Checklist
| Item | Como será atendido | Status |
|---|---|---|
| Autenticação | | pendente |
| Cada usuário só vê os próprios dados | | pendente |
| Segredos fora do código | | pendente |
| Upload de arquivos validado | | pendente |
| Limite de requisições | | pendente |
| Logs sem dados sensíveis | | pendente |
| Backup e recuperação | | pendente |
| LGPD: consentimento, exclusão, base legal | | pendente |

## Ameaças
| Quem | Como | O que perderia | Defesa |
|---|---|---|---|
```

---

## 06-plano-de-construcao.md

```markdown
# Plano de construção

## Etapa 1 — <nome> (status: pendente | em andamento | pronta)
- **Entrega:** <o que o usuário consegue testar no fim>
- **Tarefas:** ...
- **Cobre:** RF-.., RN-..
- **Pronto quando:** ...

## Rotina
- Branch por etapa: ...
- Revisão antes de subir: ...
- Deploy: ...
- Como voltar atrás: ...
```

---

## 07-rotinas-do-sistema.md

```markdown
# Rotinas do sistema

| Rotina | Gatilho | Frequência | O que faz | Se falhar | Monitoramento |
|---|---|---|---|---|---|
```

---

## 09-testes.md

```markdown
# Testes e auditoria de segurança
Data: <AAAA-MM-DD>

| Teste | Resultado | Observação |
|---|---|---|
| Acessar dado de outro usuário | passou / falhou / não testado | |
| Requisição sem login | | |
| Upload malicioso ou gigante | | |
| Caracteres especiais na entrada | | |
| Reenvio duplicado | | |

## Falhas viraram tarefas
- [ ] ...
```

---

## decisoes.md

```markdown
# Decisões

| Data | Decisão | Motivo | Fase |
|---|---|---|---|
```
