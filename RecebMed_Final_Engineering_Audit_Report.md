# RecebMed — Final Engineering Audit Report

**Date:** March 19, 2026  
**Version:** Production  
**Platform:** Replit (NixOS container)

---

## 1. Overall System Architecture & Code Organization

### 1.1 High-Level Overview

RecebMed follows a **monolithic full-stack architecture** with clear separation between frontend (SPA), backend (REST API), and shared types. All components run within a single Node.js process, with the Express backend serving both the API and the compiled frontend assets in production.

```
┌──────────────────────────────────────────────────────────────┐
│                     CLIENT (React SPA)                       │
│  Vite 3.2.11 + React 19 + TailwindCSS v4 + shadcn/ui       │
│  wouter routing · recharts · i18next (pt-BR/en/es/fr)       │
└─────────────────────────┬────────────────────────────────────┘
                          │ REST API (JSON)
┌─────────────────────────▼────────────────────────────────────┐
│                    SERVER (Express 5)                         │
│  JWT Auth · Rate Limiting · Helmet Security                  │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ AI Layer   │ │ Reconciliation│ │ Background Auditor     │ │
│  │ (LLM       │ │ Engine       │ │ (scheduler + mutex)    │ │
│  │ Abstraction)│ │              │ │                        │ │
│  └──────┬─────┘ └──────┬───────┘ └────────┬───────────────┘ │
│         │              │                   │                 │
│  ┌──────▼──────────────▼───────────────────▼───────────────┐ │
│  │              Storage Layer (Drizzle ORM)                │ │
│  └─────────────────────┬───────────────────────────────────┘ │
└─────────────────────────┬────────────────────────────────────┘
                          │
               ┌──────────▼──────────┐
               │   PostgreSQL (Replit)│
               └─────────────────────┘
               ┌─────────────────────┐
               │ Object Storage (GCS)│
               │ (photos/audio/PDFs) │
               └─────────────────────┘
```

### 1.2 Codebase Structure

```
client/src/
  pages/                 Dashboard, Entries, Capture, Reports, ClinicReports,
                         Reconciliation, EntryDetail, Profile, Settings,
                         Login, Register, Import, ReportHistory, ConfirmEntry
  components/
    ui/                  shadcn/ui primitives (Button, Input, Card, etc.)
    AppLayout.tsx        Bottom tab bar (z-50) with 5 tabs
    EditEntryModal.tsx   Shared edit modal (Dashboard + Entries)
    DivergencyModal.tsx  Side-by-side doctor vs. clinic comparison
    AppTour.tsx          3-step guided onboarding tour (z-9999)
    DocumentTraining.tsx Upload sample → AI analysis → column mapping → save template
    ProjectionsPanel.tsx 30/60/90 day production projections
    ObjectUploader.tsx   Uppy-based file upload component
  hooks/
    use-date-filter.ts   Shared date filter with sessionStorage persistence
    use-upload.ts        Presigned URL upload hook
  lib/
    auth.ts              JWT token management + clearAuth
    audioUtils.ts        WAV conversion for iPhone compatibility
    i18n.ts              i18next setup (pt-BR, en, es, fr)
    queryClient.ts       TanStack Query configuration
  locales/               pt-BR.json, en.json, es.json, fr.json

server/
  index.ts               Express entry point (50MB body limit, request logging)
  routes.ts              All API routes + middleware (auth, rate limiting, helmet)
  storage.ts             IStorage interface + Drizzle PostgreSQL implementation
  db.ts                  Database connection pool (ssl in production)
  llm.ts                 LLM abstraction layer (OpenAI + Anthropic providers)
  openai.ts              Image/audio extraction (Claude-preferred for vision)
  reconciliation.ts      PDF/CSV extraction + AI reconciliation engine
  document-validator.ts  Document structure analysis + template prompt builder
  audit.ts               Background auditor scheduler (15min + fixed hours + post-upload)
  replit_integrations/
    object_storage/      GCS presigned URLs, ACL management
    batch/               Anthropic batch processing utilities (p-limit, p-retry)
    chat/                Chat routes/storage (Anthropic integration scaffold)

shared/
  schema.ts              Drizzle schema + Zod validation (source of truth)
  models/chat.ts         Chat data model (conversations + messages)
```

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 19.x |
| Build Tool | Vite | 3.2.11 |
| Bundler | Rollup | 2.80.0 |
| CSS Framework | TailwindCSS | v4 (via @tailwindcss/postcss) |
| UI Components | shadcn/ui | Latest |
| Routing (Client) | wouter | Latest |
| i18n | i18next + react-i18next | Latest |
| Charts | recharts | Latest |
| Backend Framework | Express | 5.x |
| Runtime | Node.js + tsx | Latest |
| ORM | Drizzle ORM | Latest |
| Database | PostgreSQL | Replit-managed |
| Object Storage | Replit Object Storage (GCS) | — |
| AI (Primary) | Anthropic Claude (Sonnet 4-6) | via Replit AI Integrations |
| AI (Secondary) | OpenAI GPT-5-mini (vision/text) | Direct API |
| AI (Audio STT) | OpenAI gpt-4o-mini-transcribe | Direct API |
| Auth | jsonwebtoken + bcryptjs | 12 rounds |
| Security | helmet + express-rate-limit | — |
| File Parsing | pdf-parse, csv-parse | — |

---

## 2. LLM Abstraction Layer & Hybrid AI Strategy

### 2.1 Implementation Details

The LLM abstraction is implemented in `server/llm.ts` using a **Provider Pattern**. Each provider implements the `LLMProvider` interface:

```typescript
export interface LLMProvider {
  name: string;
  chatCompletion(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
  isAvailable(): boolean;
}
```

Two concrete providers are registered:

| Provider | Class | Models | Use Case |
|----------|-------|--------|----------|
| OpenAI | `OpenAIProvider` | gpt-5-mini (default) | General text, audio transcript analysis |
| Anthropic | `AnthropicProvider` | claude-sonnet-4-6 | Complex document parsing (PDFs, images) |

**Dynamic Provider Selection** is handled by three exported functions:

```typescript
// Default provider (env-configurable)
getLLMProvider(providerName?: string): LLMProvider

// Prefers Claude for complex parsing, falls back to OpenAI
getComplexParsingProvider(): LLMProvider

// Convenience wrapper using default provider
llmChatCompletion(options, providerName?): Promise<LLMCompletionResult>
```

The `getComplexParsingProvider()` function is the key routing mechanism:

```typescript
export function getComplexParsingProvider(): LLMProvider {
  if (providers.anthropic.isAvailable()) {
    return providers.anthropic;  // Claude preferred for PDFs/images
  }
  return providers.openai;       // Fallback
}
```

**Input-type routing in `server/openai.ts`:**

| Input Type | STT (Transcription) | Data Extraction | Provider Selection |
|-----------|--------------------|-----------------|--------------------|
| Photo/Image | N/A | `extractDataFromImage()` | `getComplexParsingProvider()` → Claude |
| Audio | OpenAI `gpt-4o-mini-transcribe` | Text analysis post-STT | `getComplexParsingProvider()` → Claude |
| PDF | N/A | `extractPdfData()` | OpenAI (direct) in reconciliation.ts |
| Document Training | N/A | `analyzeDocumentStructure()` | `getComplexParsingProvider()` → Claude |

### 2.2 Configuration

All API keys are managed via **environment variables**:

| Variable | Purpose | Source |
|----------|---------|--------|
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Anthropic Claude API key | Replit AI Integrations (auto-managed) |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Anthropic proxy base URL | Replit AI Integrations (auto-managed) |
| `CLAUDE_API_KEY` | Anthropic fallback (user-provided) | Manual secret |
| `OPENAI_API_KEY` | OpenAI API key | Manual secret |
| `LLM_PROVIDER` | Default provider override | Optional (default: "openai") |

The Anthropic provider **does not cache the client** to avoid stale token issues:

```typescript
private getClient() {
  const Anthropic = require("@anthropic-ai/sdk").default;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined;
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}
```

### 2.3 Fallback Mechanisms

1. **Provider Fallback:** `getComplexParsingProvider()` automatically falls back to OpenAI if Anthropic is unavailable (no API key set).
2. **JSON Response Cleaning:** Both providers' output is cleaned for markdown code fences before parsing:
   ```typescript
   const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
   ```
3. **Error Recovery in Extraction:** Both `extractDataFromImage` and `extractDataFromAudio` return safe defaults (empty array or placeholder entry) if JSON parsing fails.
4. **Model Mapping:** OpenAI model names are transparently mapped to Anthropic equivalents:
   ```typescript
   const modelMap = {
     "gpt-5-mini": "claude-sonnet-4-6",
     "gpt-4o": "claude-sonnet-4-6",
     "complex": "claude-sonnet-4-6",
   };
   ```

---

## 3. Dynamic Document Validator (Training Mode)

### 3.1 Module Design

The Document Training system consists of two main components:

- **Frontend:** `client/src/components/DocumentTraining.tsx` — Multi-step training wizard
- **Backend:** `server/document-validator.ts` — AI analysis engine + template storage
- **API Routes:** Registered in `server/routes.ts` under `/api/document-templates/*`

The `DocumentTraining` component is rendered inside the `ClinicReports` page, appearing as a collapsible card labeled "Treinar IA com Novo Formato de Documento".

### 3.2 Template Storage

Templates are persisted in the `document_templates` table:

```sql
CREATE TABLE document_templates (
  id          VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  mapping_json TEXT NOT NULL,       -- JSON: {"sourceColumn": "targetField", ...}
  sample_hash VARCHAR(64),          -- SHA-256 of sample content
  created_at  TIMESTAMP DEFAULT NOW()
);
```

The `mapping_json` field stores a serialized JSON object mapping source column headers to RecebMed's internal fields:

```json
{
  "Nome do Beneficiário": "patientName",
  "Data Atendimento": "procedureDate",
  "Valor Cobrado": "reportedValue",
  "Convênio": "insuranceProvider",
  "Procedimento": "procedureName",
  "Forma Pagamento": "ignore"
}
```

### 3.3 Parsing Integration — End-to-End Workflow

```
┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ User uploads │───▶│ AI Analysis      │───▶│ Column Mapping   │
│ sample file  │    │ (first 8K chars) │    │ UI (user review) │
└─────────────┘    └──────────────────┘    └──────┬───────────┘
                                                   │ Save
                                           ┌───────▼───────────┐
                                           │ document_templates │
                                           │ table (PostgreSQL) │
                                           └───────┬───────────┘
                                                   │
              ┌────────────────────────────────────▼──────────────┐
              │ Future uploads: buildTemplatePrompt() generates   │
              │ mapping hints → appended to LLM extraction prompt │
              └──────────────────────────────────────────────────┘
```

**Step 1 — Upload & Analysis:**
1. User selects a PDF or CSV sample file
2. File is Base64-encoded and sent to `POST /api/document-templates/analyze`
3. `analyzeDocumentStructure()` in `document-validator.ts`:
   - PDF: Parsed via `pdf-parse` to extract raw text
   - CSV: Read as raw string
   - First 8,000 characters sent to LLM with specialized system prompt
   - AI identifies document type, column mappings, and extracts 5 sample rows
   - SHA-256 hash computed via `computeDocumentHash()`

**Step 2 — Column Mapping (UI):**
1. AI suggestions displayed in `DocumentTraining.tsx`
2. Each source column shown with a dropdown of target fields:
   - `patientName`, `procedureDate`, `reportedValue`, `insuranceProvider`, `procedureName`, `patientBirthDate`, `description`, `ignore`
3. User can accept or modify suggestions

**Step 3 — Template Application:**
When a file is uploaded for reconciliation with a `templateId`:
1. Template retrieved from database
2. `buildTemplatePrompt()` converts JSON mapping to natural language:
   ```
   - Coluna "Nome do Beneficiário" → campo "patientName"
   - Coluna "Data Atendimento" → campo "procedureDate"
   ```
3. This hint is injected into the extraction prompt via `extractPdfDataWithTemplate()`
4. Special rules applied: payment method keywords (PIX/Dinheiro/Cartão) → `insuranceProvider = "Particular"`

### 3.4 Security

- **IDOR Protection:** Template delete and usage routes verify `template.userId === userId` before any operation
- **Template Picker:** Integrated into the Reconciliation upload UI with `selectedTemplateId` state

---

## 4. Active AI (Background Worker) & Reconciliation Engine

### 4.1 Worker Implementation

The background worker is implemented in `server/audit.ts` as an **in-process scheduler** using Node.js timers (no external queue or cron system):

**Three Trigger Mechanisms:**

| Trigger | Mechanism | Timing |
|---------|-----------|--------|
| Periodic Cycle | `setInterval` | Every 15 minutes |
| Fixed Daily Scans | `setTimeout` (BRT-aware) | 13:00 and 22:00 BRT |
| Post-Upload | Debounced `setTimeout` per user | 5 minutes after last upload |

```typescript
const POST_UPLOAD_DELAY_MS = 5 * 60 * 1000;   // 5 minutes
const INTERVAL_MS = 15 * 60 * 1000;            // 15 minutes
const SCHEDULED_HOURS_BRT = [13, 22];           // Daily fixed scans
```

**Post-Upload Debouncing:**
```typescript
export function schedulePostUploadAudit(doctorId: string) {
  if (pendingAudits.has(doctorId)) {
    clearTimeout(pendingAudits.get(doctorId)!);  // Reset timer
  }
  const timer = setTimeout(async () => {
    pendingAudits.delete(doctorId);
    await runUserAudit(doctorId, "post-upload");
  }, POST_UPLOAD_DELAY_MS);
  pendingAudits.set(doctorId, timer);
}
```

### 4.2 Reconciliation Flow

The end-to-end reconciliation process in `server/reconciliation.ts`:

```
┌─────────────────────────────────────────────────────────────────┐
│                    runReconciliation(doctorId)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. GATHER DATA                                                 │
│     ├─ Fetch pending doctor entries (status = "pending")        │
│     ├─ Fetch divergent entries (status = "divergent")           │
│     └─ Fetch unmatched clinic reports (matched = false)         │
│                                                                 │
│  2. AI BATCH MATCHING (aiReconciliationBatch)                   │
│     ├─ Batch size: 30 entries per LLM call                      │
│     ├─ AI prompt emphasizes NAME-based matching                 │
│     ├─ Date tolerance: ±3 days                                  │
│     ├─ Returns: "received" / "divergent" / "pending"            │
│     └─ Includes divergenceReason for mismatches                 │
│                                                                 │
│  3. HEURISTIC FALLBACK (scoreMatch)                             │
│     ├─ Levenshtein distance ≤ 3 for name matching               │
│     ├─ Date within 3-day window                                 │
│     ├─ Score threshold: ≥ 70% of filled fields                  │
│     └─ Fuzzy matching on procedure + insurance                  │
│                                                                 │
│  4. PERSIST RESULTS                                             │
│     ├─ batchUpdateDoctorEntryStatus()                           │
│     ├─ batchMarkClinicReportsMatched()                          │
│     └─ Create notification for doctor                           │
│                                                                 │
│  5. RETURN ReconciliationResult                                 │
│     ├─ reconciled[]    — confirmed matches                      │
│     ├─ divergent[]     — name match, data mismatch              │
│     ├─ pending[]       — no clinic counterpart found            │
│     └─ unmatchedClinic[] — clinic records with no doctor entry   │
└─────────────────────────────────────────────────────────────────┘
```

**AI Reconciliation Prompt (key excerpt):**
```
REGRA PRINCIPAL: O matching é feito pelo NOME DO PACIENTE.
PROCESSO:
1. Para cada lançamento, PROCURE pelo nome na lista da clínica
2. Se encontrar nome similar, valide: data (±1-3 dias), nascimento, procedimento, convênio
3. Status: "received" (match), "divergent" (nome ok, dados divergem), "pending" (não encontrado)
IMPORTANTE: NÃO compare valores financeiros. NUNCA faça match por posição na lista.
```

**Heuristic Scoring (`scoreMatch`):**

| Field | Matching Method | Weight |
|-------|----------------|--------|
| patientName | Levenshtein distance ≤ 3 | Required (gate) |
| procedureDate | Within 3-day window | 1 point |
| patientBirthDate | Exact match | 1 point |
| procedureName | Levenshtein fuzzy | 1 point |
| insuranceProvider | Levenshtein fuzzy | 1 point |

Threshold: `matchedFields / filledFields ≥ 0.70` → reconciled

### 4.3 Concurrency & Mutex

```typescript
let auditRunning = false;  // Simple mutex flag

async function runScheduledAudit(silent = false) {
  if (auditRunning) {
    console.log("[Audit] Varredura em andamento — pulando");
    return;
  }
  auditRunning = true;
  try {
    // ... scan all users
  } finally {
    auditRunning = false;
  }
}
```

**Additional safeguards:**
- Users with pending post-upload audits are skipped during scheduled scans to avoid redundant processing
- The `pendingAudits` Map tracks per-user debounce timers, preventing duplicate post-upload triggers

### 4.4 Error Handling & Logging

Every audit run creates an `audit_logs` record:

```sql
CREATE TABLE audit_logs (
  id              VARCHAR(36) PRIMARY KEY,
  doctor_id       VARCHAR(36) NOT NULL,
  trigger_type    TEXT NOT NULL,        -- "scheduled" | "post-upload"
  started_at      TIMESTAMP NOT NULL,
  ended_at        TIMESTAMP,
  reconciled_count INTEGER DEFAULT 0,
  divergent_after  INTEGER DEFAULT 0,
  error_message   TEXT                  -- Captured on failure
);
```

**Proactive Template Suggestion:**
When unmatched clinic records exceed 30% of total records, the system automatically creates a `template_suggestion` notification recommending the user train a new document template.

---

## 5. Data Integrity & Database Schema

### 5.1 Complete Schema

#### Enums
```sql
CREATE TYPE entry_method AS ENUM ('photo', 'audio', 'manual');
CREATE TYPE entry_status AS ENUM ('pending', 'reconciled', 'divergent', 'validated');
```

#### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | User accounts | id, name, email, password (bcrypt 12), profilePhotoUrl |
| `doctor_entries` | Doctor-submitted procedures | id, doctorId, patientName, patientBirthDate, procedureDate, procedureName, insuranceProvider, description, procedureValue, entryMethod, status, matchedReportId, divergenceReason, sourceUrl, imageHash |
| `clinic_reports` | Clinic-uploaded records | id, doctorId, patientName, patientBirthDate, procedureDate, procedureName, insuranceProvider, reportedValue, description, sourcePdfUrl, matched, matchedEntryId |
| `document_templates` | AI training templates | id, userId, name, mappingJson, sampleHash |
| `ai_corrections` | Learning from user corrections | id, doctorId, field, originalValue, correctedValue, entryMethod |
| `notifications` | System notifications | id, doctorId, type, title, message, read |
| `uploaded_reports` | Upload history | id, userId, fileName, originalFileUrl, extractedRecordCount, uploadDate |
| `audit_logs` | Audit execution history | id, doctorId, triggerType, startedAt, endedAt, reconciledCount, divergentAfter, errorMessage |

### 5.2 Matching Logic — Database Fields

The reconciliation engine matches on **5 primary fields**:

| Field | doctor_entries | clinic_reports | Match Type |
|-------|---------------|----------------|------------|
| Patient Name | `patientName` | `patientName` | Levenshtein ≤ 3 (required) |
| Procedure Date | `procedureDate` | `procedureDate` | ±3 day window |
| Birth Date | `patientBirthDate` | `patientBirthDate` | Exact match |
| Procedure | `procedureName` / `description` | `procedureName` / `description` | Levenshtein fuzzy |
| Insurance | `insuranceProvider` | `insuranceProvider` | Levenshtein fuzzy |

**Note:** Financial values are **never** compared in the matching algorithm — this is by design, as the system's purpose is to detect missing or divergent procedures, not to validate billing amounts.

### 5.3 Divergence Tracking

When a match has data inconsistencies:
- `doctor_entries.status` → set to `"divergent"`
- `doctor_entries.divergenceReason` → free-text description from AI (e.g., "Data de atendimento difere: médico 2026-03-15, clínica 2026-03-17")
- `doctor_entries.matchedReportId` → linked to the clinic report for side-by-side comparison

The `DivergencyModal` component displays both records side-by-side for manual resolution.

### 5.4 Data Consistency Measures

1. **Duplicate Detection:** On entry creation, `imageHash` (SHA-256 of source photo) is checked to prevent duplicate submissions from the same image
2. **Data Normalization (`sanitizeEntry`):**
   - Values: Brazilian format "1.000,00" → "1000.00"
   - Dates: Multiple formats (DD/MM/YYYY, ISO, etc.) → YYYY-MM-DD
   - Insurance: Payment keywords (PIX, Dinheiro, CC, Cartão) → "Particular"
3. **Bidirectional Linking:** Matched entries maintain bidirectional references:
   - `doctor_entries.matchedReportId` → clinic report ID
   - `clinic_reports.matchedEntryId` → doctor entry ID
4. **Atomic Batch Updates:** `batchUpdateDoctorEntryStatus` and `batchMarkClinicReportsMatched` update multiple records in single operations
5. **IDOR Prevention:** All data-modifying endpoints verify resource ownership (`doctorId === userId`)

### 5.5 Schema Changes for New Features

| Table/Change | Feature | Date |
|-------------|---------|------|
| `document_templates` (new table) | Document Training / Template System | Feb 2026 |
| `ai_corrections` (new table) | AI learning from user corrections | Feb 2026 |
| `uploaded_reports` (new table) | Upload history tracking | Feb 2026 |
| `audit_logs` (new table) | Audit execution logging | Mar 2026 |
| `doctor_entries.imageHash` (new column) | Duplicate photo detection | Feb 2026 |
| `doctor_entries.procedureName` (new column) | Granular procedure tracking | Feb 2026 |
| `clinic_reports.patientBirthDate` (new column) | Enhanced matching | Feb 2026 |
| `clinic_reports.procedureName` (new column) | Enhanced matching | Feb 2026 |

---

## 6. Performance & Scalability Considerations

### 6.1 Processing Times (Typical)

| Operation | Input Size | Expected Time | Provider |
|-----------|-----------|---------------|----------|
| Single photo extraction | 1 image | 2-5 seconds | Claude (Anthropic) |
| Batch photo extraction | 50 images (3 concurrent) | 30-90 seconds | Claude (Anthropic) |
| Audio transcription + extraction | ~60s audio | 3-8 seconds | OpenAI STT + Claude |
| PDF extraction (text-based) | 1-10 pages | 3-10 seconds | OpenAI |
| CSV extraction (local parsing) | 100-500 rows | <1 second | Local regex |
| CSV extraction (AI fallback) | Complex headers | 3-5 seconds | OpenAI |
| AI reconciliation batch | 30 entries vs reports | 5-15 seconds | OpenAI |
| Full audit cycle (1 user) | ~100 entries | 15-45 seconds | OpenAI |
| Document template analysis | 1 sample file | 3-8 seconds | Claude (Anthropic) |

### 6.2 Scalability Architecture

**Current Design (Single-Process):**

| Aspect | Implementation | Scaling Path |
|--------|---------------|--------------|
| API Server | Single Express process on port 5000 | Horizontal scaling with load balancer |
| Background Worker | In-process timers (setInterval/setTimeout) | Extract to dedicated worker process or message queue (Bull/BullMQ) |
| Database | PostgreSQL with Drizzle ORM | Connection pooling already in place; read replicas for scaling |
| Object Storage | Replit GCS (presigned URLs) | Already cloud-native, scales independently |
| LLM Calls | Sequential per-user, batched (30/batch) | Increase batch concurrency; p-limit already available in batch utilities |

**Bottleneck Analysis:**

1. **LLM API calls** are the primary bottleneck — each reconciliation batch requires an API round-trip
2. **Mutex lock** on the audit scheduler means only one scan runs at a time (prevents overload but limits throughput)
3. **In-memory timer state** (pendingAudits Map) is lost on process restart — acceptable for current scale

### 6.3 Resource Usage

| Resource | Typical Usage | Notes |
|----------|--------------|-------|
| Memory | ~150-250 MB | Node.js process + Vite dev server in development |
| CPU | Low (idle) / Burst (during LLM calls) | CPU-bound only during Levenshtein calculations |
| Database Connections | Pool managed by Drizzle | Default pool size; SSL in production |
| API Rate Limits | Auth: 10/15min, API: 120/min | Per-IP via express-rate-limit |
| Body Size Limit | 50 MB | Supports large Base64-encoded images/PDFs |

### 6.4 Security Summary

| Measure | Implementation |
|---------|---------------|
| Password Hashing | bcryptjs with 12 rounds |
| Authentication | JWT (Bearer token) |
| Rate Limiting | express-rate-limit (auth: 10/15min, reset: 5/15min, api: 120/min) |
| Security Headers | helmet (CSP disabled for compatibility) |
| IDOR Prevention | Ownership checks on all data-modifying endpoints |
| Input Validation | Zod schemas from drizzle-zod on all POST/PATCH routes |
| SQL Injection | Prevented by Drizzle ORM parameterized queries |
| Secret Management | Environment variables (never exposed in responses) |

---

## Appendix: API Route Map

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | No | User registration |
| POST | `/api/auth/login` | No | User login (returns JWT) |
| GET | `/api/auth/me` | Yes | Current user profile |
| PUT | `/api/auth/profile` | Yes | Update profile |
| PUT | `/api/auth/password` | Yes | Change password |
| POST | `/api/entries/photo` | Yes | Extract data from single photo |
| POST | `/api/entries/photos-batch` | Yes | Batch photo extraction (max 50) |
| POST | `/api/entries/audio` | Yes | Audio transcription + extraction |
| GET | `/api/entries` | Yes | List entries (with filters) |
| POST | `/api/entries` | Yes | Create entry |
| POST | `/api/entries/batch` | Yes | Batch create entries |
| PATCH | `/api/entries/:id` | Yes | Update entry |
| DELETE | `/api/entries/:id` | Yes | Delete entry |
| GET | `/api/clinic-reports` | Yes | List clinic reports |
| DELETE | `/api/clinic-reports/:id` | Yes | Delete clinic report |
| POST | `/api/reconciliation/upload` | Yes | Upload file for reconciliation |
| POST | `/api/reconciliation/re-reconcile` | Yes | Re-run reconciliation |
| GET | `/api/dashboard/stats` | Yes | Dashboard statistics |
| GET | `/api/notifications` | Yes | List notifications |
| PATCH | `/api/notifications/:id/read` | Yes | Mark notification read |
| GET | `/api/document-templates` | Yes | List user templates |
| POST | `/api/document-templates` | Yes | Save new template |
| POST | `/api/document-templates/analyze` | Yes | Analyze document structure |
| DELETE | `/api/document-templates/:id` | Yes | Delete template (IDOR-protected) |
| POST | `/api/import/entries` | Yes | Import historical entries |
| POST | `/api/import/clinic-reports` | Yes | Import historical clinic reports |
| POST | `/api/uploads/request-url` | Yes | Get presigned upload URL |

---

*Report generated automatically from codebase analysis. All code references verified against current production state.*
