# RecebMed - Auditoria Técnica Baseada na Produção

**Data do Relatório:** 17 de Março de 2026
**Versão:** 2.0 — Baseada em dados reais da plataforma em produção
**Fonte dos dados:** Logs de deploy, respostas de API em produção, banco PostgreSQL

---

## 1. Arquitetura do Sistema em Produção

### 1.1 Stack Tecnológico

| Camada | Tecnologia | Observação em Produção |
|--------|-----------|----------------------|
| **Frontend** | React 19 + Vite 3.2.11 + TailwindCSS v4 + shadcn/ui | Funcionando, SPA com 14 páginas |
| **Backend** | Node.js + Express 5 + TypeScript | Build compilado para `dist/index.cjs`, roda em produção |
| **Database** | PostgreSQL (Replit managed) | Ativo, com warning de SSL mode (`sslmode=require` será deprecado) |
| **AI/ML** | OpenAI API — `gpt-5-mini` (visão/texto), `gpt-4o-mini-transcribe` (áudio) | On-demand, sem serviço persistente |
| **Object Storage** | Replit Object Storage (GCS) | Upload de evidências (fotos/áudios) funcionando |
| **Deploy** | Replit Deployments | Porta 5000 → porta externa 80, restarts automáticos por signal terminated |
| **Auth** | JWT + bcryptjs (12 rounds) | Token 7 dias, rate limiting ativo |

### 1.2 Estrutura do Projeto

```
client/src/
  pages/              # 14 páginas (Dashboard, Entries, Capture, Reports, Reconciliation, Import, etc.)
  components/         # AppLayout (tab bar), EditEntryModal, AppTour, ProjectionsPanel
  hooks/              # use-upload.ts (presigned URL flow)
  lib/                # auth.ts, audioUtils.ts (WAV para iPhone), queryClient.ts
  locales/            # pt-BR.json, en.json, es.json, fr.json

server/
  index.ts            # Entry point (50MB body, audit scheduler)
  routes.ts           # ~1242 linhas, todas as rotas API
  openai.ts           # Cliente OpenAI + extração foto/áudio
  reconciliation.ts   # ~616 linhas, extração PDF/imagem/CSV + motor de reconciliação
  audit.ts            # Auditor automático (5min + pós-upload) — NÃO ESTÁ ATIVO EM PRODUÇÃO
  storage.ts          # Interface Drizzle (~280 linhas)

shared/
  schema.ts           # 5 tabelas: users, doctor_entries, clinic_reports, notifications, ai_corrections
```

---

## 2. Estado Real da Produção — Dados Observados

### 2.1 Usuários e Volume

| Métrica | Valor em Produção |
|---------|------------------|
| **Usuários registrados** | 1 (Felipe Rotoli — feliperotoli_1@hotmail.com) |
| **Total de lançamentos (doctor_entries)** | ~223 (todos criados em 07/03/2026 via foto) |
| **Relatórios da clínica (clinic_reports)** | 0 |
| **Notificações** | Múltiplas (reconciliação e batch) |
| **Correções da IA** | 0 |

### 2.2 Status dos Lançamentos em Produção

| Status | Quantidade | Observação |
|--------|-----------|------------|
| `pending` | ~172 | Nunca foram cruzados com nenhum relatório |
| `divergent` | ~51 | Marcados como divergentes, mas **sem relatório correspondente** |
| `reconciled` | 0 | **ZERO entradas reconciliadas** |

### 2.3 Qualidade dos Dados Extraídos pela IA (Amostra Real)

Dados extraídos de fotos de etiquetas de pacientes em produção:

| Campo | Qualidade | Exemplos Reais |
|-------|-----------|----------------|
| **patientName** | BOA | "IDELMA DE MOURA", "JULIETH NOGUEIRA PEREIRA", "PEDRO IVO BERTOGLIO KASPER" |
| **procedureDate** | BOA | Datas corretas (2025-02-18, 2025-03-05, 2025-05-06) |
| **insuranceProvider** | PARCIAL | "PACOTE", "SUS", "UNIMED LONDRINA" — funciona, mas "PACOTE" deveria ser "Particular" |
| **procedureName** | RUIM | `null` em quase todos os registros |
| **description** | RUIM | "Não identificado" na maioria, exceção: "Bypass" em 1 entrada |
| **procedureValue** | RUIM | `null` em todos os registros |
| **patientBirthDate** | RUIM | `null` em todos os registros |

### 2.4 Notificações Geradas em Produção

```
Cronologia real (do mais recente ao mais antigo):

17/03/2026 01:41 — "Conferência concluída: 51 conferidos (0 recebidos, 51 divergentes), 172 pendentes"
16/03/2026 18:43 — "Conferência concluída: 0 conferidos, 0 divergentes, 223 pendentes"
16/03/2026 18:38 — "Conferência concluída: 0 conferidos, 0 divergentes, 223 pendentes"
07/03/2026 17:22 — "Lançamentos em lote: 17 lançamentos registrados com sucesso"
07/03/2026 17:01 — "Novo lançamento: Lançamento registrado..."
```

---

## 3. Problemas Críticos Encontrados em Produção

### PROBLEMA 1: Taxa de Reconciliação = 0%

**Evidência:** `"totals":{"reconciled":0,"divergent":51,"total":51}` nos logs de produção

**Causa raiz:** Existem **0 clinic_reports** no banco. A reconciliação não tem nada com que cruzar.

**Impacto:** O recurso principal do sistema (conferência inteligente) nunca funcionou para o usuário real. Os 223 lançamentos do médico existem sem nenhum relatório da clínica para comparar.

**Como aconteceu:** O usuário subiu fotos de etiquetas de pacientes (criando doctor_entries), mas aparentemente nunca subiu um PDF/CSV de relatório da clínica (que criaria clinic_reports). Ou subiu e o processamento falhou sem feedback claro.

### PROBLEMA 2: 51 Entradas Marcadas "Divergent" Sem Relatório

**Evidência:** 51 entries com `status: "divergent"`, mas 0 clinic_reports no banco.

**Causa provável:** A reconciliação executou (notificação de 17/03 01:41) e o fallback local `scoreMatch()` comparou entries entre si ou contra uma lista vazia, resultando em classificação incorreta. Não deveria haver "divergentes" se não existe relatório para comparar.

**Impacto:** O médico vê 51 lançamentos como "divergentes" sem explicação — gera confusão e desconfiança no sistema.

### PROBLEMA 3: Extração de Fotos com Dados Incompletos

**Evidência:** 100% das entries têm `procedureName: null`, `procedureValue: null`, `patientBirthDate: null`, e ~90% têm `description: "Não identificado"`.

**Causa:** As fotos são de etiquetas hospitalares que tipicamente contêm apenas nome do paciente, data e convênio. O prompt da IA espera mais dados do que as etiquetas fornecem, e quando não encontra, preenche com "Não identificado" em vez de extrair o que é possível.

**Impacto:** Quando o relatório da clínica for eventualmente enviado, o cruzamento terá dificuldade porque faltam campos na entrada do médico (procedimento, valor, nascimento).

### PROBLEMA 4: Auditor Automático NÃO Está Ativo em Produção

**Evidência:** Nenhum log `[Audit]` nos logs de deploy. O `audit.ts` foi adicionado mas **não foi publicado** ainda.

**Impacto:** As varreduras automáticas a cada 5 minutos e a auditoria pós-upload não estão funcionando no ambiente publicado.

### PROBLEMA 5: SSL Warning do PostgreSQL

**Evidência no log:**
```
(node:21) Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', 'verify-ca'
are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0),
these modes will adopt standard libpq semantics, which have weaker security guarantees.
```

**Impacto:** Não causa erro agora, mas poderá quebrar em futuras atualizações do driver pg.

### PROBLEMA 6: Restarts Frequentes em Produção

**Evidência:** Múltiplos ciclos de `signal terminated` → restart nos logs:
- 6:24, 6:45, 7:12, 8:49, 9:10, 9:58, 10:47, 11:59 — 8 restarts em ~6 horas

**Causa provável:** Replit scale-down por inatividade (comportamento normal), mas pode impactar a experiência do usuário com cold starts.

---

## 4. Fluxo de Dados Real (Observado em Produção)

### 4.1 O que o usuário REALMENTE fez

```
1. Registrou a conta (07/03/2026)

2. Subiu múltiplas fotos de etiquetas de pacientes (07/03/2026 17:00-17:22)
   → Sistema extraiu via gpt-5-mini (vision)
   → Criou ~223 doctor_entries (status: "pending")
   → Dados extraídos: nome + data + convênio (OK)
   → Dados NÃO extraídos: procedimento, valor, nascimento (todos null)

3. NÃO subiu nenhum PDF/CSV de relatório da clínica
   → 0 clinic_reports criados
   → Reconciliação não tem contraparte para cruzar

4. Tentou reconciliar (16/03/2026 18:38 e 18:43)
   → Resultado: "0 conferidos, 0 divergentes, 223 pendentes"
   → Correto — sem relatório, tudo fica pendente

5. Outra reconciliação ocorreu (17/03/2026 01:41)
   → Resultado: "51 conferidos (0 recebidos, 51 divergentes), 172 pendentes"
   → INCORRETO — não deveria haver 51 divergentes sem clinic_reports
```

### 4.2 Captura por Foto (Fluxo Real)

```
Foto da etiqueta → POST /api/entries/photo
  → SHA-256 hash calculado (deduplicação)
  → Base64 enviado para gpt-5-mini (vision)
  → IA retorna JSON: {patientName, procedureDate, insuranceProvider, ...}
  → Campos com confidence score
  → Redireciona para ConfirmEntry (usuário pode editar)
  → Após confirmação → salva em doctor_entries
  → Foto original uploaded para Object Storage
```

**Resultado real em produção:** Nomes extraídos corretamente, datas corretas, convênios parcialmente corretos. Procedimento, valor e nascimento quase sempre null.

### 4.3 Captura por Áudio

```
Gravação de áudio → WAV conversion (iPhone compat.)
  → POST /api/entries/audio
  → gpt-4o-mini-transcribe (STT) → texto
  → Texto → gpt-5-mini → dados estruturados
  → Confirmação → salva
```

**Status em produção:** Nenhum lançamento por áudio observado nos logs.

### 4.4 Upload de Relatório da Clínica

```
PDF/Imagem/CSV → POST /api/reconciliation/upload
  → PDF: pdf-parse → texto → gpt-5-mini → JSON
  → Imagem: gpt-5-mini (vision) → JSON
  → CSV: parser local → (fallback: gpt-5-mini) → JSON
  → Dados salvos em clinic_reports
  → runReconciliation() executado
  → schedulePostUploadAudit() agendado (2 min depois)
```

**Status em produção:** NENHUM upload de relatório registrado. 0 clinic_reports no banco.

---

## 5. Lógica de Reconciliação — Análise Detalhada

### 5.1 Campos de Matching (5 campos, SEM valor financeiro)

| # | Campo | Tolerância | Em Produção |
|---|-------|-----------|-------------|
| 1 | **Nome do Paciente** | Levenshtein ≤ 3 chars | Disponível (extraído de fotos) |
| 2 | **Data do Procedimento** | ≤ 3 dias de diferença | Disponível (extraído de fotos) |
| 3 | **Data de Nascimento** | Exato (se ambos têm) | **INDISPONÍVEL** — null em 100% das entries |
| 4 | **Procedimento** | Levenshtein ≤ 30% ou substring | **INDISPONÍVEL** — null em ~100% das entries |
| 5 | **Convênio** | Levenshtein ≤ 3 ou substring | Disponível, mas "PACOTE" deveria ser "Particular" |

**Confirmação: valor monetário NÃO é usado para matching.** O prompt da IA explicita: "NÃO compare valores financeiros."

### 5.2 Algoritmo de Matching (2 camadas)

**Camada 1 — IA (gpt-5-mini):**
- Batches de 30 entries vs. clinic_reports
- IA analisa e retorna: "received" (match) | "divergent" (parcial) | "pending" (sem par)

**Camada 2 — Fallback Local (scoreMatch):**
- Score 0-5 pontos (1 ponto por campo)
- ≥ 4/5 → `reconciled`
- ≥ 2/5 → `divergent`
- < 2/5 → `pending`

**Regra especial:** Se um campo está null/vazio em AMBOS os lados → conta como match (ganha o ponto). Isso explica o bug das 51 divergentes — com campos null, o score sobe artificialmente.

### 5.3 Classificação de Status

| Status | Condição | Motivo Exibido |
|--------|----------|----------------|
| `reconciled` | IA diz "received" OU score ≥ 4/5 | Campos que bateram (ex: "nome, data, convênio") |
| `divergent` | IA diz "divergent" OU score 2-3/5 | Detalhamento (ex: "Convênio: 'Particular' ≠ 'SUS'") |
| `pending` | IA diz "pending" OU score < 2 OU sem relatório | Sem par encontrado |

### 5.4 Cenários de Match Parcial

| Cenário | O que Acontece | Score Esperado |
|---------|---------------|----------------|
| Nome + Data batem, Convênio diferente | Se procedimento e nascimento são null em ambos → 4/5 | `reconciled` |
| Nome parecido (Levenshtein > 3), Data bate | Nome não pontua → depende dos outros | Provavelmente `divergent` |
| Nada bate | Score 0-1 | `pending` |
| Sem clinic_report para comparar | Fica pendente (não deveria marcar divergente) | `pending` |

---

## 6. Sistema de Logging — O que é Registrado

### 6.1 Logs Existentes em Produção

| Tipo | Formato | Exemplo Real |
|------|---------|-------------|
| **Requests API** | `{hora} [express] {MÉTODO} {rota} {status} in {ms}` | `1:15:26 PM [express] POST /api/auth/login 200 in 880ms` |
| **Login** | Token redacted, user info visível | `{"user":{"name":"Felipe Rotoli","email":"..."}}` |
| **Entries** | Full response body (truncado) | Lista com todos os lançamentos e seus status |
| **Projeções** | Totais de reconciliação | `{"reconciled":0,"divergent":51,"total":51}` |
| **Notificações** | Historial completo | `"51 conferidos (0 recebidos, 51 divergentes), 172 pendentes"` |
| **Server start** | Porta de escuta | `serving on port 5000` |
| **SSL warning** | Aviso de driver pg | Warning sobre sslmode deprecation |

### 6.2 Logs de Reconciliação

| Evento | Log em Produção |
|--------|----------------|
| PDF texto extraído | `PDF text extracted: {N} chars, first 200: {preview}` |
| PDF IA resultado | `PDF AI extraction: {N} entries from {N} chars` |
| PDF 0 resultados | Warning com preview da resposta da IA |
| CSV local falhou | `CSV local parsing returned 0 results, trying AI fallback...` |
| Upload salvamento | `Reconciliation upload: {N} saved, {N} skipped from {N} extracted` |
| Batch error (IA) | `AI reconciliation batch error: {error}` |

### 6.3 O que NÃO É Logado

- Confidence scores da IA (retornados ao frontend, não logados no server)
- Nome do arquivo PDF original
- Tempo individual de cada chamada à OpenAI
- Histórico de auditorias (o audit.ts não está ativo em produção)
- Razão específica de cada divergência (disponível no response, mas não logado separadamente)

### 6.4 Acessibilidade dos Logs

| Tipo | Acesso |
|------|--------|
| **Produção (deploy)** | Painel de deploy Replit |
| **Desenvolvimento** | Console do workflow "Start application" |
| **Banco de dados** | SQL direto via Replit DB tools |

---

## 7. Implementações Recentes (Últimos 7 dias)

### 7.1 Features Novas (no código, nem todas publicadas)

| # | Feature | Status em Produção |
|---|---------|-------------------|
| F1 | **Auditor Automático** — Varredura a cada 5min + 2min pós-upload | NÃO PUBLICADO |
| F2 | **Filtros Rápidos nos Relatórios** — Chips 7d/30d/60d/mês/ano | NÃO PUBLICADO |
| F3 | **Dashboard Cards Clicáveis** — Navegam para entries filtradas | NÃO PUBLICADO |
| F4 | **CSV AI Fallback** — IA interpreta CSV quando parser local falha | NÃO PUBLICADO |
| F5 | **Validação 20MB** — Limite de tamanho com toast em 4 idiomas | NÃO PUBLICADO |
| F6 | **Prompt de Extração Reescrito** — 7 campos detalhados + regras de convênio | NÃO PUBLICADO |
| F7 | **Sanitização universal** — sanitizeValue/sanitizeDate/sanitizeEntry | NÃO PUBLICADO |
| F8 | **Recuperação de JSON parcial** — Fallback regex quando IA retorna JSON truncado | NÃO PUBLICADO |

### 7.2 Bugs Corrigidos (no código)

| # | Bug | Descrição |
|---|-----|-----------|
| B1 | Valores brasileiros não convertidos | `"4.702,00"` ficava como string, agora converte para `4702.00` |
| B2 | Datas `31/01/2025` falhavam | sanitizeDate() aceita DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY |
| B3 | JSON truncado perdia tudo | parseAIResponse() faz fallback com regex |
| B4 | Token limit baixo (4000) | Elevado para 16000 tokens |
| B5 | Mensagem genérica de erro | Agora mostra motivo específico |
| B6 | CSV com colunas não-padrão | Headers fuzzy expandidos |

---

## 8. Recomendações Prioritárias

### 8.1 URGENTE — Corrigir Antes de Publicar

1. **Publicar as mudanças recentes** — Todas as melhorias estão no código mas não no deploy
2. **Bug das 51 divergentes sem relatório** — Quando não há clinic_reports, a reconciliação NÃO deve marcar nada como divergente. Apenas "pending".
3. **Limpar dados corrompidos** — Os 51 registros divergentes no banco de produção precisam ser resetados para "pending"

### 8.2 IMPORTANTE — Melhorias de Curto Prazo

4. **Guiar o usuário no fluxo completo** — O usuário criou 223 lançamentos mas nunca subiu o relatório da clínica. O sistema precisa de um indicador visual tipo "Suba o relatório da clínica para iniciar a conferência"
5. **Melhorar extração de fotos** — O prompt precisa ser ajustado para etiquetas hospitalares que só têm nome+data+convênio, sem forçar campos que não existem
6. **"PACOTE" → "Particular"** — A IA deveria classificar "PACOTE" como forma de pagamento particular

### 8.3 LONGO PRAZO

7. **Persistir logs de auditoria no banco** — Tabela `audit_logs` com histórico de cada reconciliação
8. **Corrigir SSL warning** — Adicionar `sslmode=verify-full` explícito na connection string
9. **Monitorar cold starts** — 8 restarts em 6 horas impacta a experiência

---

## Apêndice A: Tabelas do Banco (Schema Real)

### doctor_entries
```sql
id                VARCHAR(36)  PK DEFAULT gen_random_uuid()
doctor_id         VARCHAR(36)  NOT NULL
patient_name      TEXT         NOT NULL
patient_birth_date TEXT                  -- null em 100% dos registros reais
procedure_date    TIMESTAMP    NOT NULL
procedure_name    TEXT                   -- null em ~100% dos registros reais
insurance_provider TEXT        NOT NULL  -- "PACOTE", "SUS", "UNIMED LONDRINA"
description       TEXT         NOT NULL  -- "Não identificado" em ~90%
procedure_value   NUMERIC(12,2)          -- null em 100% dos registros reais
entry_method      ENUM(photo|audio|manual) -- 100% "photo" nos dados reais
source_url        TEXT                   -- URLs de Object Storage
image_hash        VARCHAR(64)            -- SHA-256 para deduplicação
status            ENUM(pending|reconciled|divergent) -- 0% reconciled na produção
created_at        TIMESTAMP
```

### clinic_reports
```sql
-- TABELA VAZIA EM PRODUÇÃO (0 registros)
id, doctor_id, patient_name, patient_birth_date, procedure_date,
procedure_name, insurance_provider, reported_value, description,
source_pdf_url, created_at
```

### ai_corrections
```sql
-- TABELA VAZIA EM PRODUÇÃO (0 registros)
-- O usuário nunca corrigiu dados extraídos pela IA
```

---

## Apêndice B: Endpoints da API (Com dados de produção)

| Método | Rota | Tempo Médio | Observação |
|--------|------|-------------|------------|
| POST | `/api/auth/login` | 880ms | Funciona, bcrypt 12 rounds |
| GET | `/api/entries` | 200-500ms | Retorna ~223 entries |
| GET | `/api/financials/projections` | 93-442ms | Retorna 0 reconciliados |
| GET | `/api/notifications` | 140-482ms | Lista histórico de notificações |
| POST | `/api` | 2-11ms | Health check? Retorna 200 |

---

## Apêndice C: Timeline Real de Produção

```
07/03/2026 17:00 — Primeiro uso. Fotos de etiquetas enviadas em batch.
                    ~206 lançamentos criados via foto.

07/03/2026 17:22 — Segundo batch de fotos.
                    +17 lançamentos. Total: ~223.

07/03/2026 → 16/03/2026 — 9 dias sem atividade relevante nos logs.

16/03/2026 18:38 — Reconciliação executada.
                    Resultado: "0 conferidos, 0 divergentes, 223 pendentes"
                    (Correto — sem clinic_reports)

16/03/2026 18:43 — Reconciliação executada novamente.
                    Resultado: "0 conferidos, 0 divergentes, 223 pendentes"

17/03/2026 01:41 — Reconciliação executada.
                    Resultado: "51 conferidos (0 recebidos, 51 divergentes), 172 pendentes"
                    (BUG — não deveria haver divergentes sem clinic_reports)

17/03/2026 13:15 — Último acesso registrado.
                    Login → visualização de entries → Dashboard.
```
