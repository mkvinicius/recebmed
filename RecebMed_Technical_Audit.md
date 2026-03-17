# RecebMed - Technical System Audit

**Data do Relatório:** 17 de Março de 2026
**Versão:** 1.0

---

## 1. Arquitetura do Sistema (High-Level System Architecture)

### 1.1 Stack Tecnológico

| Camada | Tecnologia | Versão/Detalhes |
|--------|-----------|-----------------|
| **Frontend** | React 19 + Vite 3.2.11 + Rollup 2.80.0 | SPA com TailwindCSS v4 (@tailwindcss/postcss), shadcn/ui, Recharts, wouter (routing) |
| **Backend** | Node.js + Express 5 + TypeScript | tsx para execução, body limit 50MB |
| **Database** | PostgreSQL (Replit managed) | Drizzle ORM, drizzle-zod para validação |
| **AI/ML** | OpenAI API (direto) | `gpt-5-mini` (visão/texto/reconciliação), `gpt-4o-mini-transcribe` (STT) |
| **Object Storage** | Replit Object Storage (GCS) | Upload de evidências (fotos/áudios) via presigned URLs |
| **Deploy** | Replit | Workflow único: `npm run dev` → Express serve API + Vite dev/static |
| **Auth** | JWT + bcryptjs | Token 7 dias, bcrypt 12 rounds, rate limiting + helmet |
| **i18n** | 4 locales | pt-BR, en, es, fr |

### 1.2 Estrutura de Diretórios

```
client/src/
  pages/                    # 14 páginas da aplicação
    Dashboard.tsx           # Painel principal com 4 cards clicáveis (Pendentes/Reconciliados/Divergentes/Lançamentos)
    Entries.tsx             # Lista de lançamentos com filtro por status via query string
    Capture.tsx             # Captura por foto/áudio/manual (validação 20MB)
    Reports.tsx             # Relatórios de produção com filtros rápidos (7d/30d/60d/mês/ano)
    Reconciliation.tsx      # Upload de PDF/imagem/CSV para conferência
    ClinicReports.tsx       # Visualização de relatórios importados da clínica
    Import.tsx              # Importação histórica (PDF/CSV/Excel)
    EntryDetail.tsx         # Detalhe individual do lançamento
    ConfirmEntry.tsx        # Confirmação pós-captura (edição antes de salvar)
    Profile.tsx             # Perfil do usuário
    Settings.tsx            # Configurações
    Login.tsx / Register.tsx / ForgotPassword.tsx
  components/
    AppLayout.tsx           # Layout com tab bar inferior (z-50)
    EditEntryModal.tsx      # Modal de edição compartilhado (Dashboard + Entries)
    AppTour.tsx             # Tour guiado para novos usuários (3 passos)
    ProjectionsPanel.tsx    # Projeções de produção (30/60/90 dias)
    ObjectUploader.tsx      # Upload via Uppy + presigned URLs
    ui/                     # Componentes shadcn/ui
  hooks/
    use-upload.ts           # Hook de upload com presigned URL flow
  lib/
    auth.ts                 # Gestão de token/usuário
    audioUtils.ts           # Conversão WAV para compatibilidade iPhone
    queryClient.ts          # React Query client
  locales/
    pt-BR.json, en.json, es.json, fr.json

server/
  index.ts                  # Entry point Express (50MB body, audit scheduler start)
  routes.ts                 # Todas as rotas API (~1242 linhas)
  openai.ts                 # Cliente OpenAI + extração de imagem/áudio
  reconciliation.ts         # Extração PDF/imagem/CSV + motor de reconciliação (~616 linhas)
  audit.ts                  # Auditor automático em background (varredura periódica + pós-upload)
  storage.ts                # Interface de storage + implementação Drizzle (~280 linhas)
  db.ts                     # Pool de conexão PostgreSQL
  static.ts                 # Serve arquivos estáticos (produção)
  vite.ts                   # Dev server Vite (desenvolvimento)
  replit_integrations/
    object_storage/         # Serviço de Object Storage (GCS, presigned URLs, ACL)

shared/
  schema.ts                 # Schema Drizzle + validação Zod (5 tabelas)
```

---

## 2. Implementações e Correções Recentes (Últimos 7 dias)

### 2.1 Features Novas

| # | Feature | Descrição | Arquivos |
|---|---------|-----------|----------|
| F1 | **Auditor Automático em Background** | Sistema que roda a cada 5 minutos verificando todos os usuários. Reseta entradas divergentes para pendente e re-executa a reconciliação. Após uploads, agenda auditoria adicional em 2 minutos. Envia notificações automáticas com resultado. | `server/audit.ts`, `server/index.ts`, `server/routes.ts` |
| F2 | **Filtros Rápidos nos Relatórios** | 5 chips de filtro de data (7d, 30d, 60d, Este mês, Este ano) com comportamento toggle na página de Relatórios | `client/src/pages/Reports.tsx`, locales |
| F3 | **Dashboard Cards Clicáveis** | 4 cards do dashboard agora navegam para `/entries?status=X`. Cards de produção expandem inline mostrando lançamentos filtrados | `Dashboard.tsx`, `Entries.tsx` |
| F4 | **CSV AI Fallback** | Quando o parser local não reconhece as colunas do CSV, envia para a IA interpretar automaticamente | `server/reconciliation.ts`, `server/routes.ts` |
| F5 | **Validação de Tamanho de Arquivo** | Limite de 20MB antes do processamento com toast descritivo em 4 idiomas | `Capture.tsx`, `Import.tsx`, locales |

### 2.2 Bug Fixes e Correções

| # | Correção | Problema | Solução |
|---|----------|----------|---------|
| B1 | **Prompt de extração de PDF reescrito** | IA retornava dados vazios ou incorretos para formatos variados de hospitais brasileiros | Prompt detalhado com 7 campos numerados, regras de classificação de convênio vs. forma de pagamento, exemplos de conversão de valores brasileiros |
| B2 | **Sanitização universal de dados** | Valores `"4.702,00"` não eram convertidos; datas `31/01/2025` falhavam; campos com nomes variados não eram reconhecidos | Funções `sanitizeValue()`, `sanitizeDate()`, `sanitizeEntry()` com fallback para múltiplos nomes de campo |
| B3 | **Recuperação de JSON parcial** | Quando a IA retornava JSON truncado (por token limit), perdia-se tudo | `parseAIResponse()` agora faz fallback com regex para extrair objetos individuais do texto parcial |
| B4 | **Token limit insuficiente** | PDFs grandes geravam respostas cortadas | `max_completion_tokens` elevado para 16.000 |
| B5 | **Erro genérico no upload** | Mensagem "Erro ao processar arquivo" sem detalhes | Mensagens específicas: PDF corrompido, rate limit, 0 registros encontrados, formato não suportado |
| B6 | **Headers de CSV fuzzy** | CSVs com colunas como "Dt_Atendimento" ou "Beneficiário" não eram reconhecidos | Aliases expandidos para dezenas de variações em `extractCsvData()` e `mapRowToEntry()` |
| B7 | **Import route — headers ampliados** | Import histórico não reconhecia colunas como "operadora", "valor_pago", "beneficiario" | `mapRowToEntry()` expandido com mais padrões de coluna |

---

## 3. Fluxo de Dados: Da Entrada do Usuário à Reconciliação

### 3.1 Entrada de Dados (Data Entry)

#### a) Entrada Manual (`POST /api/entries`)

```
Usuário preenche formulário → Frontend valida campos → POST /api/entries
  → Backend valida com Zod → storage.createDoctorEntry() → PostgreSQL
  → Status inicial: "pending"
  → Retorna o entry criado
```

**Campos salvos:** `patientName`, `patientBirthDate`, `procedureDate`, `procedureName`, `insuranceProvider`, `description`, `procedureValue`, `entryMethod: "manual"`, `status: "pending"`

#### b) Captura por Foto (`POST /api/entries/photo`)

```
Usuário tira foto/seleciona imagem → Frontend converte para base64
  → Valida tamanho (< 20MB) → POST /api/entries/photo
  → Backend calcula SHA-256 hash da imagem (deduplicação)
  → Verifica duplicatas via imageHash
  → Envia base64 para OpenAI gpt-5-mini (vision)
  → IA retorna JSON com dados extraídos + confidence por campo
  → Aplica correções aprendidas (CorrectionHints de correções anteriores)
  → Redireciona para ConfirmEntry.tsx (usuário revisa/edita ANTES de salvar)
  → Após confirmação → storage.createDoctorEntry()
  → Upload da imagem original para Object Storage (evidência)
  → Status inicial: "pending"
```

**Processamento da foto:** IMEDIATO. A IA processa na hora e o usuário vê os dados extraídos para revisar antes de confirmar.

**Aprendizado:** O sistema armazena correções feitas pelo usuário na tabela `ai_corrections` e usa essas correções como contexto nas próximas extrações (adaptive learning).

#### c) Captura por Áudio (`POST /api/entries/audio`)

```
Usuário grava áudio → Frontend converte para WAV (compatibilidade iPhone)
  → Valida tamanho (< 20MB) → POST /api/entries/audio
  → Backend detecta formato do áudio (WAV/WebM/MP3/MP4/OGG via magic bytes)
  → Envia para OpenAI gpt-4o-mini-transcribe (STT) → texto transcrito
  → Texto transcrito enviado para gpt-5-mini → extração estruturada
  → Retorna JSON com dados + confidence
  → Redireciona para ConfirmEntry.tsx → usuário confirma
  → storage.createDoctorEntry() → status: "pending"
```

**Processamento do áudio:** IMEDIATO. Transcrição + extração acontecem na mesma request.

### 3.2 Estado Pré-Reconciliação

Todos os lançamentos do médico ficam na tabela `doctor_entries` com `status: "pending"` até que um PDF/CSV da clínica seja enviado para conferência.

```sql
-- Tabela: doctor_entries
id          | UUID v4 (auto)
doctor_id   | FK para users.id
patient_name     | texto (obrigatório)
patient_birth_date | texto (opcional, YYYY-MM-DD)
procedure_date   | timestamp (obrigatório)
procedure_name   | texto (opcional)
insurance_provider | texto (obrigatório)
description      | texto (obrigatório)
procedure_value  | numeric(12,2) (opcional)
entry_method     | enum: photo | audio | manual
source_url       | URL da evidência no Object Storage
image_hash       | SHA-256 para deduplicação de fotos
status           | enum: pending | reconciled | divergent
created_at       | timestamp (auto)
```

---

## 4. Workflow de Reconciliação e Papel da IA

### 4.1 Trigger (Gatilho)

A reconciliação é acionada em **3 momentos**:

| Trigger | Quando | Arquivo |
|---------|--------|---------|
| **Upload imediato** | Quando o médico sobe PDF/imagem/CSV na tela de Reconciliação | `routes.ts` → `POST /api/reconciliation/upload` |
| **Pós-upload (2 min)** | Agendada automaticamente após qualquer upload | `audit.ts` → `schedulePostUploadAudit()` |
| **Periódica (5 min)** | Varredura automática de todos os usuários ativos | `audit.ts` → `runPeriodicAudit()` |

### 4.2 Quando a IA é Ativada

A IA atua em **dois momentos distintos** dentro do workflow:

```
MOMENTO 1: EXTRAÇÃO (ao receber o arquivo da clínica)
  PDF  → pdf-parse extrai texto → gpt-5-mini interpreta → JSON estruturado
  Imagem → gpt-5-mini (vision) analisa → JSON estruturado
  CSV  → Parser local tenta primeiro → se falhar → gpt-5-mini como fallback

MOMENTO 2: RECONCILIAÇÃO (cruzamento de dados)
  Lançamentos pendentes do médico + Relatórios da clínica
  → gpt-5-mini compara em batches de 30
  → Para cada lançamento: match, divergente, ou pendente
  → Se IA falhar → fallback local com scoreMatch() (Levenshtein + regras)
```

### 4.3 Tarefas Específicas da IA

| Tarefa | Modelo | Input | Output |
|--------|--------|-------|--------|
| **OCR/Extração de PDF** | gpt-5-mini (texto) | Texto extraído do PDF via pdf-parse | Array JSON com 7 campos por registro |
| **OCR/Extração de Imagem** | gpt-5-mini (vision) | Imagem base64 do relatório | Array JSON com 7 campos por registro |
| **Interpretação de CSV** | gpt-5-mini (texto) | Primeiros 5000 chars do CSV | Array JSON com 7 campos por registro |
| **Comparação/Match** | gpt-5-mini (texto) | Lançamentos do médico + relatórios da clínica (batches de 30) | Array com entryIndex, reportIndex, status, divergenceReason |
| **Extração de Foto (captura)** | gpt-5-mini (vision) | Foto base64 de etiqueta/documento | JSON com dados do paciente + confidence scores |
| **Transcrição de Áudio** | gpt-4o-mini-transcribe | Áudio WAV/WebM/MP3 | Texto transcrito |

### 4.4 Estado da IA

A IA é **invocada sob demanda** (on-demand). Não existe um serviço persistente ou modelo carregado em memória. Cada chamada é uma request HTTP para a API da OpenAI.

O único componente "persistente" é o **audit scheduler** (`audit.ts`), que é um `setInterval` Node.js que roda a cada 5 minutos e invoca a IA conforme necessário.

---

## 5. Lógica de Reconciliação e Regras de Divergência

### 5.1 Campos de Matching

A reconciliação utiliza **5 campos** para determinar correspondência. O valor financeiro **NÃO** é utilizado.

| # | Campo | Peso | Tolerância |
|---|-------|------|------------|
| 1 | **Nome do Paciente** | 1 ponto | Levenshtein distance ≤ 3 caracteres |
| 2 | **Data do Procedimento** | 1 ponto | Diferença ≤ 3 dias |
| 3 | **Data de Nascimento** | 1 ponto | Match exato (se ambos disponíveis). Se um dos lados não tem → conta como match |
| 4 | **Procedimento** | 1 ponto | Levenshtein ≤ 30% do comprimento maior, OU substring match. Se um dos lados não tem → conta como match |
| 5 | **Convênio** | 1 ponto | Levenshtein ≤ 3, OU substring match. Se um dos lados não tem → conta como match |

**Score máximo: 5 pontos**

### 5.2 Algoritmo de Matching

O sistema usa **duas camadas** de matching:

#### Camada 1: IA (gpt-5-mini)

```
Para cada batch de até 30 lançamentos pendentes:
  → Envia para gpt-5-mini com prompt AI_RECONCILIATION_PROMPT
  → IA analisa e retorna: "received" | "divergent" | "pending" para cada lançamento
  → Resultados aplicados imediatamente
```

#### Camada 2: Fallback Local (scoreMatch)

```
Para lançamentos NÃO processados pela IA (erro, timeout, etc.):
  → scoreMatch() calcula pontuação com os 5 campos
  → Score ≥ 4/5 → RECONCILED (recebido)
  → Score ≥ 2/5 → DIVERGENT (divergente)
  → Score < 2/5 → PENDING (permanece pendente)
```

### 5.3 Cenários de Match Parcial

| Cenário | Campos que Batem | Score | Resultado |
|---------|-----------------|-------|-----------|
| Nome + Data + Nascimento + Procedimento + Convênio | 5/5 | `reconciled` |
| Nome + Data + Nascimento + Procedimento, convênio diferente | 4/5 | `reconciled` |
| Nome + Data, procedimento e convênio diferentes | 2/5 | `divergent` |
| Nome levemente diferente (Levenshtein ≤ 3), Data bate | 2+/5 | `divergent` (mín.) |
| Nome totalmente diferente, Data bate | 1/5 | `pending` |
| Nenhum campo bate | 0/5 | `pending` |

#### Cenário A: Nome e Data batem, Convênio diferente
- Score: 2 (nome) + 1 (data) + 1 (nascimento se N/D) + 0 (convênio) = depende do procedimento
- Se procedimento também bate → 4/5 → **reconciled**
- Se procedimento não bate → 3/5 → **divergent**
- Motivo exibido: `"Convênio: 'Unimed' ≠ 'Amil'"`

#### Cenário B: Nome levemente diferente, Nascimento e Data batem
- "Maria Silva Santos" vs "Maria S. Santos" → Levenshtein pode ser > 3
- Se Levenshtein > 3 → nome não pontua → Score: 0 + 1 + 1 + ... = depende dos outros campos
- A IA (Camada 1) geralmente resolve esses casos melhor que o fallback local

### 5.4 Classificação de Status

| Status | Condição (Fallback Local) | Condição (IA) | Motivo Exibido ao Usuário |
|--------|--------------------------|---------------|--------------------------|
| **`reconciled`** | Score ≥ 4/5 | IA retorna `"received"` | Campos que bateram: "nome, data, nascimento, procedimento" |
| **`divergent`** | Score ≥ 2/5 e < 4/5 | IA retorna `"divergent"` | Lista específica dos campos diferentes. Ex: `"Convênio: 'Particular' ≠ 'SUS'"`, `"Data: 15/01/2026 ≠ 18/01/2026"` |
| **`pending`** | Score < 2/5 ou sem relatório correspondente | IA retorna `"pending"` ou nenhum match encontrado | Lançamento permanece sem par. Sem motivo específico — simplesmente não foi encontrado no relatório da clínica |

### 5.5 Confirmação: Valor Financeiro

**O valor monetário do procedimento (`procedureValue` / `reportedValue`) NÃO é usado como critério de matching.** Ele é armazenado e exibido para referência do médico, mas não influencia na classificação reconciled/divergent/pending.

O prompt da IA explicita: *"NÃO compare valores financeiros. Foque apenas nos 5 campos acima."*

---

## 6. Logging e Auditoria do Sistema

### 6.1 Logs de Request (Express Middleware)

Toda request API é logada automaticamente pelo middleware em `server/index.ts`:

```
Formato: {timestamp} [express] {METHOD} {path} {statusCode} in {duration}ms :: {responseBody}
Exemplo: 2:15:30 PM [express] POST /api/reconciliation/upload 200 in 3421ms :: {"success":true,"extractedCount":15}
```

**Campos logados:**
- Timestamp (hora local)
- Método HTTP
- Path da rota
- Status code
- Duração em ms
- Body da resposta (com tokens/codes redacted)

### 6.2 Logs de Extração (PDF/Imagem/CSV)

| Evento | Log | Exemplo |
|--------|-----|---------|
| PDF texto extraído | `PDF text extracted: {chars} chars, first 200: {preview}` | `PDF text extracted: 8432 chars, first 200: Conta Corrente Equipe...` |
| PDF AI resultado | `PDF AI extraction: {count} entries from {chars} chars` | `PDF AI extraction: 23 entries from 8432 chars` |
| PDF 0 resultados | `AI returned 0 entries from non-empty PDF. Response: {preview}` | Warning com preview da resposta da IA |
| Imagem AI resultado | `Image AI extraction: {count} entries` | `Image AI extraction: 5 entries` |
| CSV local falhou | `CSV local parsing returned 0 results, trying AI fallback...` | — |
| CSV AI resultado | `CSV AI fallback extraction: {count} entries` | `CSV AI fallback extraction: 12 entries` |
| Upload salvamento | `Reconciliation upload: {saved} saved, {skipped} skipped from {total} extracted` | `Reconciliation upload: 20 saved, 3 skipped from 23 extracted` |

### 6.3 Logs de Reconciliação (AI Matching)

| Evento | Log |
|--------|-----|
| AI batch error | `AI reconciliation batch error: {error}` |
| Rate limit | `Limite de requisições atingido. Aguarde...` (retornado ao frontend) |

### 6.4 Logs do Auditor Automático

| Evento | Log | Prefixo |
|--------|-----|---------|
| Scheduler iniciado | `Scheduler iniciado — varredura a cada 5 minutos` | `[Audit]` |
| Auditoria agendada | `Agendando auditoria pós-upload para usuário {id} em 120s` | `[Audit]` |
| Varredura iniciada | `Varredura periódica iniciada — {N} usuários ativos` | `[Audit]` |
| Usuário pulado | `Pulando usuário {id} — auditoria pós-upload já agendada` | `[Audit]` |
| Início de re-análise | `{trigger}: Usuário {id} — {N} pendentes, {N} divergentes. Iniciando re-análise...` | `[Audit]` |
| Reset de divergentes | `{N} entradas divergentes resetadas para pendente para re-análise` | `[Audit]` |
| Resultado | `{trigger}: Resultado — {N} reconciliados, {N} divergentes, {N} pendentes` | `[Audit]` |
| Varredura concluída | `Varredura periódica concluída` | `[Audit]` |
| Erro | `Erro na auditoria do usuário {id}: {error}` | `[Audit]` |

### 6.5 Logs de Erro (Exception Handling)

| Cenário | Log |
|---------|-----|
| PDF corrompido | `PDF parse error: {error}` |
| AI error genérico | `AI extraction error: {message}` |
| Salvamento falhou | `Error saving clinic report item: {error}` |
| Import erro | `Import doctor entries error: {error}` |
| Express 500 | `Internal Server Error: {error stack}` |

### 6.6 Acessibilidade dos Logs

| Tipo | Localização | Acesso |
|------|-------------|--------|
| **Logs de desenvolvimento** | Console do workflow "Start application" na Replit IDE | Visível em tempo real no painel do workflow |
| **Logs de produção** | Replit Deployment Logs | Via ferramenta `fetch_deployment_logs` ou painel de deploy |
| **Logs persistentes** | `/tmp/logs/Start_application_*.log` | Arquivo rotacionado automaticamente |
| **Notificações ao usuário** | Tabela `notifications` no PostgreSQL | Visíveis no sino de notificações do app |

### 6.7 O que NÃO é logado atualmente

- AI confidence scores individuais por campo (retornados ao frontend mas não logados no server)
- Nome do arquivo PDF original (o base64 é processado, mas o fileName não é logado no reconciliation route)
- Tempo individual de cada chamada à OpenAI (apenas o tempo total da request via middleware)
- Histórico de auditorias anteriores (apenas logs do console, não persistidos em banco)

---

## Apêndice A: Tabelas do Banco de Dados

### doctor_entries (Lançamentos do Médico)
```sql
id                VARCHAR(36)  PK DEFAULT gen_random_uuid()
doctor_id         VARCHAR(36)  NOT NULL  -- FK → users.id
patient_name      TEXT         NOT NULL
patient_birth_date TEXT                  -- YYYY-MM-DD (opcional)
procedure_date    TIMESTAMP    NOT NULL
procedure_name    TEXT                   -- (opcional)
insurance_provider TEXT        NOT NULL
description       TEXT         NOT NULL
procedure_value   NUMERIC(12,2)          -- (opcional)
entry_method      ENUM(photo|audio|manual) NOT NULL DEFAULT 'manual'
source_url        TEXT                   -- URL no Object Storage
image_hash        VARCHAR(64)            -- SHA-256 deduplicação
status            ENUM(pending|reconciled|divergent) NOT NULL DEFAULT 'pending'
created_at        TIMESTAMP    NOT NULL DEFAULT NOW()
```

### clinic_reports (Relatórios da Clínica)
```sql
id                VARCHAR(36)  PK DEFAULT gen_random_uuid()
doctor_id         VARCHAR(36)  NOT NULL
patient_name      TEXT         NOT NULL
patient_birth_date TEXT
procedure_date    TIMESTAMP    NOT NULL
procedure_name    TEXT
insurance_provider TEXT
reported_value    NUMERIC(12,2) NOT NULL
description       TEXT
source_pdf_url    TEXT
created_at        TIMESTAMP    NOT NULL DEFAULT NOW()
```

### ai_corrections (Aprendizado da IA)
```sql
id                VARCHAR(36)  PK DEFAULT gen_random_uuid()
doctor_id         VARCHAR(36)  NOT NULL
field             TEXT         NOT NULL  -- campo corrigido
original_value    TEXT         NOT NULL  -- valor que a IA extraiu
corrected_value   TEXT         NOT NULL  -- valor que o usuário corrigiu
entry_method      ENUM(photo|audio|manual) NOT NULL
created_at        TIMESTAMP    NOT NULL DEFAULT NOW()
```

### notifications
```sql
id                VARCHAR(36)  PK DEFAULT gen_random_uuid()
doctor_id         VARCHAR(36)  NOT NULL
type              TEXT         NOT NULL  -- 'reconciliation', 'import', etc.
title             TEXT         NOT NULL
message           TEXT         NOT NULL
read              BOOLEAN      NOT NULL DEFAULT false
created_at        TIMESTAMP    NOT NULL DEFAULT NOW()
```

### users
```sql
id                VARCHAR(36)  PK DEFAULT gen_random_uuid()
name              TEXT         NOT NULL
email             TEXT         NOT NULL UNIQUE
password          TEXT         NOT NULL  -- bcrypt hash (12 rounds)
profile_photo_url TEXT
```

---

## Apêndice B: Endpoints da API

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/api/auth/register` | Registro de usuário | Rate limited |
| POST | `/api/auth/login` | Login (retorna JWT) | Rate limited |
| POST | `/api/entries` | Criar lançamento manual | JWT |
| POST | `/api/entries/photo` | Captura por foto (IA) | JWT |
| POST | `/api/entries/photos-batch` | Captura múltiplas fotos | JWT |
| POST | `/api/entries/audio` | Captura por áudio (STT + IA) | JWT |
| POST | `/api/entries/batch` | Criar múltiplos lançamentos | JWT |
| GET | `/api/entries` | Listar lançamentos | JWT |
| PUT | `/api/entries/:id` | Atualizar lançamento | JWT |
| DELETE | `/api/entries/:id` | Deletar lançamento | JWT |
| POST | `/api/reconciliation/upload` | Upload PDF/imagem/CSV para conferência | JWT |
| POST | `/api/reconciliation/run` | Executar reconciliação manual | JWT |
| GET | `/api/reconciliation/template` | Baixar modelo CSV | JWT |
| POST | `/api/import/doctor-entries` | Importação histórica | JWT |
| POST | `/api/import/clinic-reports` | Importação de relatórios | JWT |
| GET | `/api/clinic-reports` | Listar relatórios da clínica | JWT |
| GET | `/api/notifications` | Listar notificações | JWT |
| PUT | `/api/notifications/:id/read` | Marcar como lida | JWT |
| GET | `/api/projections` | Projeções de produção | JWT |

---

## Apêndice C: Fluxo Visual Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    ENTRADA DE DADOS                          │
│                                                              │
│  📷 Foto ──→ OpenAI Vision ──→ JSON ──→ ConfirmEntry        │
│  🎤 Áudio ──→ STT ──→ OpenAI Text ──→ JSON ──→ ConfirmEntry │
│  ✏️  Manual ──→ Formulário ──→ JSON                          │
│                                                              │
│  Todos → doctor_entries (status: "pending")                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  UPLOAD DO RELATÓRIO                         │
│                                                              │
│  📄 PDF  ──→ pdf-parse ──→ texto ──→ OpenAI ──→ JSON        │
│  🖼️ Imagem ──→ OpenAI Vision ──→ JSON                       │
│  📊 CSV  ──→ Parser local ──→ (fallback: OpenAI) ──→ JSON   │
│                                                              │
│  Todos → clinic_reports (dados da clínica)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   RECONCILIAÇÃO                              │
│                                                              │
│  1. OpenAI compara batches de 30 lançamentos                 │
│     (5 campos: nome, data, nascimento, procedimento,         │
│      convênio — SEM valores financeiros)                     │
│                                                              │
│  2. Fallback local: scoreMatch() com Levenshtein             │
│     ≥ 4/5 → reconciled │ ≥ 2/5 → divergent │ < 2 → pending │
│                                                              │
│  3. Atualiza status em doctor_entries                        │
│  4. Cria notificação com resumo                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  AUDITORIA CONTÍNUA                           │
│                                                              │
│  ⏱️ A cada 5 min: varredura de todos os usuários             │
│  📤 2 min pós-upload: re-análise do usuário que subiu        │
│                                                              │
│  → Reseta divergentes para pendente                          │
│  → Re-executa reconciliação                                  │
│  → Envia notificação com resultado                           │
└─────────────────────────────────────────────────────────────┘
```
