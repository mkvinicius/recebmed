# RecebMed — Documento de Contexto Completo

**Última atualização:** Abril 2026
**Finalidade:** Este documento é a fonte de verdade do sistema. Deve ser lido ANTES de qualquer alteração, inclusão ou remoção de funcionalidade para entender o estado atual e evitar quebras.

---

## 1. VISÃO GERAL DO PRODUTO

### O que é o RecebMed?
Plataforma SaaS de **gestão financeira inteligente para profissionais de saúde** no Brasil. Permite que médicos e clínicas façam conferência de seus recebimentos de forma automatizada usando IA.

### Problema que resolve
Médicos fazem procedimentos em hospitais/clínicas mas frequentemente não recebem o valor correto. O RecebMed automatiza a conferência entre o que o médico registrou e o que a clínica/hospital reportou, identificando divergências.

### Público-alvo
- Médicos (qualquer especialidade)
- Clínicas médicas
- Hospitais (gestão financeira)

### Idiomas
4 idiomas suportados: **pt-BR** (principal), en, es, fr
- Detecção automática: localStorage → navegador → HTML tag
- Troca de idioma na tela de Perfil
- Arquivos de tradução: `client/src/locales/` (pt-BR.json, en.json, es.json, fr.json)

---

## 2. REGRAS DE NEGÓCIO

### 2.1 Fluxo Principal (Ciclo de Conferência)

```
MÉDICO FAZ PROCEDIMENTO
         ↓
REGISTRA NO RECEBMED (foto/áudio/manual)
         ↓
CLÍNICA/HOSPITAL ENVIA RELATÓRIO (PDF/CSV/Excel)
         ↓
SISTEMA CONFERE AUTOMATICAMENTE (IA)
         ↓
RESULTADO: Conferido ✅ | Divergente ⚠️ | Pendente ⏳
```

### 2.2 Métodos de Captura de Lançamento

| Método | Como funciona | Custo IA |
|--------|-------------|----------|
| **Foto** | Tira foto de etiqueta → IA extrai dados | R$ 0.002 |
| **Áudio** | Grava áudio → IA transcreve e extrai | R$ 0.0006 |
| **Manual** | Preenche formulário manualmente | R$ 0.00 |

### 2.3 Status de Lançamento

| Status | Significado | Quando acontece |
|--------|------------|----------------|
| `pending` | Aguardando conferência | Lançamento criado, ainda sem relatório da clínica |
| `reconciled` | Conferido OK | IA encontrou correspondência exata no relatório |
| `divergent` | Divergente | IA encontrou correspondência MAS valores/dados diferem |
| `validated` | Validado manualmente | Usuário aceitou manualmente um registro divergente |

**Nota sobre status no código:**
- O enum no banco (`entryStatusEnum`) define: `pending`, `reconciled`, `divergent`, `validated`
- A constante `VALID_ENTRY_STATUSES` no PUT /api/entries/:id permite: `pending`, `reconciled`, `divergent`, `unmatched`
- O status `validated` é setado via rota específica PUT /api/entries/:id/validate (não via edição genérica)

### 2.4 Fluxo de Conciliação (Reconciliation)

1. Médico faz upload do relatório da clínica (PDF/imagem/CSV)
2. Sistema extrai dados do arquivo (localmente ou via IA)
3. Cria registros na tabela `clinic_reports`
4. Motor de conciliação compara `clinic_reports` com `doctor_entries`
5. Matching por 5 campos: nome paciente, data procedimento, data nascimento, procedimento, convênio
6. Usa Levenshtein proporcional para nomes (threshold escala com tamanho do nome)
7. Calcula `matchConfidence` (0-100%) por par
8. Atualiza status dos lançamentos automaticamente

### 2.5 Regras de Valor

- **Formato BR aceito:** R$ 1.250,50 → convertido para 1250.50
- **Valor negativo:** rejeitado, vira 0.00
- **Valor máximo:** R$ 500.000 (acima disso, trunca para 500000.00)
- **Aplicado em:** TODOS os 6 pontos de criação de lançamento

### 2.6 Regras de Data

- **Formato:** YYYY-MM-DD (validação de calendário rigorosa — rejeita 31 de fevereiro)
- **Data mínima:** 01/01/2000
- **Data máxima:** 3 meses no futuro
- **Aplicado em:** criação e edição de lançamentos

### 2.7 Detecção de Duplicatas (3 camadas)

1. **Hash de imagem:** SHA-256 da foto — duplicata exata detectada no momento da captura
2. **Dados normalizados:** mesmo paciente + data + descrição = duplicata (resposta 409)
3. **IA semântica:** Claude analisa entradas similares do mesmo dia/paciente. Entende que mesmo paciente pode ter procedimentos diferentes (não é duplicata). Confiança HIGH necessária para bloquear.

### 2.8 Classificação de Convênio

- Nomes de plano (Unimed, Amil, SulAmérica) → nome do convênio
- Formas de pagamento (PIX, Dinheiro, Cartão, Redecard) → "Particular"
- SUS → "SUS"
- Sem informação → null

### 2.9 Auditoria Automática (Background)

- **Ciclo horário:** roda a cada 1 hora
- **Horários fixos BRT:** 13:00 e 22:00
- **Pós-upload:** 5 minutos após upload de relatório
- **O que faz:** re-concilia entradas pendentes/divergentes + relatórios não conferidos
- **IA Anomaly Scan:** detecta duplicatas, outliers de valor, dados incompletos, padrões suspeitos
- **Scan em lotes:** 80 entradas por vez com overlap de 10
- **Cooldown:** 55 minutos por usuário entre scans

### 2.10 Aprendizado com Correções

Quando o médico corrige dados extraídos pela IA:
1. Correção salva na tabela `ai_corrections`
2. Próxima extração: correções recentes são injetadas no prompt da IA como contexto
3. IA aprende padrões de correção do usuário específico

---

## 3. ARQUITETURA TÉCNICA

### 3.1 Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + Vite + TailwindCSS v4 | Vite 3.2.11, Rollup 2.80.0 |
| Backend | Express (Node.js) + TypeScript | Express ^5.0.1 |
| Banco de Dados | PostgreSQL + Drizzle ORM | — |
| IA Principal | Anthropic Claude Sonnet | Via AI Integrations |
| IA Áudio (STT) | OpenAI gpt-4o-mini-transcribe | Via AI Integrations |
| OCR | Tesseract.js (português) | Local, gratuito |
| Armazenamento | Object Storage (GCS) | — |

### 3.2 Restrições Críticas (NÃO MUDAR)

| Restrição | Motivo |
|-----------|--------|
| Vite 3.2.11 + Rollup 2.80.0 | NÃO atualizar Rollup acima de 2.x — quebra build |
| Express 5 + path-to-regexp v8 | Usar `{*param}` para wildcards; rotas estáticas ANTES de parametrizadas |
| @tailwindcss/postcss v4 | NÃO usar plugin Vite — usar postcss.config.js |
| pdf-parse importação | Usar `import * as pdfParseModule` (sem default export em ESM) |
| HMR | Desabilitado (false) |
| Porta | 5000 (fixa, única porta não bloqueada) |
| Body limit | 50MB (para upload de fotos/PDFs em base64) |

### 3.3 Estrutura de Pastas

```
/
├── client/src/
│   ├── pages/              ← 17 páginas (todas lazy-loaded)
│   ├── components/         ← Componentes reutilizáveis
│   │   ├── ui/             ← shadcn/ui
│   │   ├── AppLayout.tsx   ← Layout: sidebar desktop + tab bar mobile
│   │   ├── EditEntryModal.tsx
│   │   ├── DivergencyModal.tsx
│   │   ├── ProductionOverview.tsx
│   │   ├── ProjectionsPanel.tsx
│   │   ├── DocumentTraining.tsx
│   │   └── AppTour.tsx
│   ├── hooks/              ← Hooks customizados
│   ├── lib/                ← Utilitários (auth, i18n, utils, status)
│   └── locales/            ← Traduções (pt-BR, en, es, fr)
├── server/
│   ├── index.ts            ← Entry point Express
│   ├── routes.ts           ← TODAS as rotas API (~2073 linhas)
│   ├── storage.ts          ← Interface + implementação do banco (~630 linhas)
│   ├── llm.ts              ← Camada de abstração LLM (OpenAI + Anthropic)
│   ├── openai.ts           ← Extração de foto/áudio
│   ├── ocr.ts              ← OCR local Tesseract.js
│   ├── pdf-ocr.ts          ← OCR de PDFs escaneados (pdftoppm + Tesseract)
│   ├── pdf-util.ts         ← Leitura de PDF (wrapper pdf-parse)
│   ├── reconciliation.ts   ← Motor de conciliação (~814 linhas)
│   ├── audit.ts            ← Auditoria automática background (~389 linhas)
│   ├── document-validator.ts ← Análise de estrutura de documentos
│   ├── jwt-secret.ts       ← Módulo JWT_SECRET compartilhado
│   └── replit_integrations/ ← Object storage + Anthropic
├── shared/
│   └── schema.ts           ← Schema do banco (Drizzle) + tipos Zod
└── package.json
```

### 3.4 Páginas do Frontend (17 total)

| Página | Rota | Função |
|--------|------|--------|
| Login | /login | Autenticação |
| Register | /register | Cadastro com validação de senha forte |
| ForgotPassword | /forgot-password | Reset de senha em 2 etapas |
| Dashboard | /dashboard | Home: stats, busca, entradas recentes, notificações |
| Entries | /entries | Lista completa com filtros (status, data, convênio, busca) |
| Capture | /capture | 3 cards: Foto, Áudio, Manual |
| ConfirmEntry | /confirm-entry | Revisão/edição de dados extraídos antes de salvar |
| Reports | /reports | Gráficos de produção (recharts) |
| Profile | /profile | Info do usuário, foto, dark mode, idioma |
| Settings | /settings | Editar nome + trocar senha |
| ClinicReports | /clinic-reports | Relatórios agrupados por mês com rename inline |
| Reconciliation | /reconciliation | Upload + conferência em 4 abas |
| EntryDetail | /entry/:id | Detalhe do lançamento com evidência |
| Import | /import | Importação histórica (CSV/Excel + PDFs) |
| ReportHistory | /reports/history | Histórico de relatórios |
| AuditReports | /audit-reports | Dashboard de achados da auditoria IA |
| NotFound | * | Página 404 |

### 3.5 Navegação

**Mobile (<768px):** Tab bar inferior com 5 abas
- Início (/dashboard)
- Lançamentos (/entries)
- Captura (/capture) — botão elevado central
- Relatórios (/reports)
- Perfil (/profile)

**Desktop (≥768px):** Sidebar fixa esquerda (220px)

**Páginas sem tab bar:** Login, Register, ForgotPassword, ConfirmEntry

---

## 4. BANCO DE DADOS

### 4.1 Tabelas

| Tabela | Finalidade | Campos-chave |
|--------|-----------|--------------|
| `users` | Usuários do sistema | id, name, email, password, profilePhotoUrl, aiAuditEnabled, isAdmin, platformDoctrine |
| `doctor_entries` | Lançamentos do médico | id, doctorId, patientName, patientBirthDate, procedureDate, procedureName, insuranceProvider, description, procedureValue, entryMethod, sourceUrl, imageHash, matchedReportId, divergenceReason, matchConfidence, status |
| `clinic_reports` | Relatórios da clínica/hospital | id, doctorId, patientName, patientBirthDate, procedureDate, procedureName, insuranceProvider, reportedValue, description, sourcePdfUrl, matched, matchedEntryId |
| `notifications` | Notificações do sistema | id, doctorId, type, title, message, read |
| `ai_corrections` | Correções do usuário sobre IA | id, doctorId, field, originalValue, correctedValue, entryMethod |
| `uploaded_reports` | Rastreio de uploads de relatório | id, userId, fileName, customName, originalFileUrl, extractedRecordCount, uploadDate |
| `audit_logs` | Log de cada execução de auditoria | id, doctorId, triggerType, startedAt, endedAt, reconciledCount, divergentAfter, errorMessage |
| `document_templates` | Templates treinados de documentos | id, userId, name, mappingJson, sampleHash |
| `ai_audit_findings` | Achados da auditoria IA | id, doctorId, category, severity, title, description, entryIds, resolved, scanTimestamp |
| `conversations` | Conversas IA (integração) | id, title |
| `messages` | Mensagens das conversas IA | id, conversationId, role, content |

### 4.2 Índices de Performance

- `doctor_entries`: doctorId, status, procedureDate, (doctorId+status), (doctorId+procedureDate), imageHash
- `clinic_reports`: doctorId, matched, (doctorId+matched), procedureDate
- `notifications`: doctorId, (doctorId+read)

### 4.3 Relacionamentos

```
users.id ──→ doctor_entries.doctorId
users.id ──→ clinic_reports.doctorId
users.id ──→ notifications.doctorId
users.id ──→ uploaded_reports.userId
users.id ──→ document_templates.userId
users.id ──→ ai_audit_findings.doctorId

doctor_entries.matchedReportId ──→ clinic_reports.id
clinic_reports.matchedEntryId ──→ doctor_entries.id
```

---

## 5. API — ROTAS COMPLETAS

### 5.1 Autenticação (rate-limited)

| Método | Rota | Função | Rate Limit |
|--------|------|--------|-----------|
| POST | /api/auth/register | Cadastro | 8 req/15min |
| POST | /api/auth/login | Login | 8 req/15min + brute force (5 falhas → 30min bloqueio) |
| GET | /api/auth/me | Dados do usuário logado | — |
| PUT | /api/auth/profile | Atualizar nome | — |
| PUT | /api/auth/password | Trocar senha | — |
| POST | /api/auth/request-reset | Solicitar código de reset | 3 req/1h |
| POST | /api/auth/verify-reset | Verificar código + nova senha | 3 req/1h |
| PUT | /api/auth/profile-photo | Atualizar foto de perfil | — |
| GET | /api/auth/ai-audit | Status da auditoria IA | — |
| PUT | /api/auth/ai-audit | Ativar/desativar auditoria IA | — |
| GET | /api/auth/is-admin | Verificar se é admin | — |
| GET | /api/auth/platform-doctrine | Buscar doutrina (admin) | — |
| PUT | /api/auth/platform-doctrine | Atualizar doutrina (admin) | — |

### 5.2 Lançamentos

| Método | Rota | Função |
|--------|------|--------|
| POST | /api/entries/photo | Processar foto com IA → dados extraídos |
| POST | /api/entries/photos-batch | Processar múltiplas fotos (até 50) |
| POST | /api/entries/audio | Processar áudio com IA → dados extraídos |
| POST | /api/entries | Salvar lançamento |
| POST | /api/entries/batch | Salvar múltiplos lançamentos |
| GET | /api/entries | Listar lançamentos (com paginação/filtros) |
| GET | /api/entries/search?q= | Busca server-side (nome, descrição, convênio) |
| GET | /api/entries/export | Exportar Excel/CSV (com filtros ativos) |
| PUT | /api/entries/:id | Editar lançamento (com ownership check) |
| DELETE | /api/entries/:id | Excluir lançamento (com ownership check) |
| GET | /api/entries/:id | Detalhe do lançamento |
| GET | /api/entries/:id/divergence | Detalhe da divergência + relatório clínica |
| PUT | /api/entries/:id/validate | Validar manualmente |
| POST | /api/entries/accept-clinic-report | Aceitar registro da clínica → criar lançamento |
| POST | /api/entries/accept-clinic-reports-batch | Aceitar múltiplos registros |

### 5.3 Relatórios da Clínica

| Método | Rota | Função |
|--------|------|--------|
| GET | /api/clinic-reports | Listar relatórios |
| POST | /api/clinic-reports | Criar relatório |
| GET | /api/clinic-reports/unmatched | Relatórios não conferidos |
| DELETE | /api/clinic-reports/:id | Excluir relatório |

### 5.4 Conciliação

| Método | Rota | Função |
|--------|------|--------|
| POST | /api/reconciliation/upload-pdf | Upload PDF → extração + conferência |
| POST | /api/reconciliation/upload | Upload PDF/imagem/CSV → extração + conferência |
| GET | /api/reconciliation/results | Resultados agrupados por status |
| POST | /api/reconciliation/re-reconcile | Re-processar todas as conferências |
| GET | /api/reconciliation/csv-template | Download de template CSV para importação |

### 5.5 Importação Histórica

| Método | Rota | Função |
|--------|------|--------|
| POST | /api/import/doctor-entries | Importar CSV/Excel de lançamentos |
| POST | /api/import/clinic-reports | Importar PDFs de relatórios clínicos em lote |

### 5.6 Outros

| Método | Rota | Função |
|--------|------|--------|
| GET | /api/notifications | Listar notificações + contagem não lidas |
| PUT | /api/notifications/:id/read | Marcar como lida (com ownership check) |
| PUT | /api/notifications/read-all | Marcar todas como lidas |
| GET | /api/financials/projections | Projeções 30/60/90 dias |
| GET | /api/dashboard/stats | Estatísticas do dashboard |
| GET | /api/patients/names?q= | Autocomplete de nomes de pacientes |
| GET | /api/ai-corrections/stats | Estatísticas de correções IA |
| POST | /api/ai/anomaly-scan | Executar varredura IA manual |
| GET | /api/audit-findings | Achados da auditoria |
| GET | /api/audit-findings/summary | Resumo por categoria |
| PUT | /api/audit-findings/:id/resolve | Resolver achado |
| GET | /api/uploaded-reports | Listar uploads de relatório |
| PUT | /api/uploaded-reports/:id/rename | Renomear relatório |
| DELETE | /api/uploaded-reports/:id | Excluir relatório (cascata) |
| POST | /api/document-templates | Criar template de documento |
| GET | /api/document-templates | Listar templates |
| DELETE | /api/document-templates/:id | Excluir template |
| POST | /api/document-templates/analyze | Analisar estrutura de documento (IA) |
| GET | /api/reports/analytics | Relatório analítico de produção |
| POST | /api/uploads/request-url | URL pré-assinada para upload |
| GET | /objects/{*objectPath} | Servir arquivos do object storage |
| GET | /health | Health check |

---

## 6. SEGURANÇA

### 6.1 Autenticação
- JWT com expiração de 7 dias
- bcryptjs com 12 rounds
- Senha forte obrigatória: mínimo 8 chars, maiúscula, minúscula, número

### 6.2 Proteções
- **Helmet:** CSP headers completos, HSTS 1 ano com preload
- **X-Frame-Options:** DENY
- **Rate limiting:** 300 req/min por usuário autenticado (via JWT)
- **Brute force:** 5 logins falhos → bloqueio 30min por email
- **XSS:** Filtro em campos de texto (script tags)
- **IDOR:** Ownership check em TODAS as operações de leitura/escrita/delete
- **Export:** Sanitização de células contra injeção de fórmulas (=, +, -, @)
- **Reset senha:** Código 6 dígitos, hash SHA-256, 15min expiração, máx 5 tentativas

### 6.3 Secrets (Variáveis de Ambiente)
- `JWT_SECRET` — gerado automaticamente se não definido (64 bytes hex)
- `OPENAI_API_KEY` — API OpenAI
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — API Claude (via integração)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — API OpenAI (via integração)
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` — Bucket de armazenamento
- `PUBLIC_OBJECT_SEARCH_PATHS` / `PRIVATE_OBJECT_DIR` — Paths do object storage

---

## 7. SISTEMA DE IA

### 7.1 Providers

| Provider | Uso | Env Var |
|----------|-----|---------|
| **Anthropic Claude Sonnet** | Principal: extração de texto/imagem/PDF/CSV, conciliação, duplicatas, auditoria | AI_INTEGRATIONS_ANTHROPIC_API_KEY |
| **OpenAI** | STT (áudio) + fallback quando Claude indisponível | AI_INTEGRATIONS_OPENAI_API_KEY |

**Nota:** `getComplexParsingProvider()` prefere Claude; se indisponível, usa OpenAI como fallback. Áudio sempre usa OpenAI (gpt-4o-mini-transcribe).

### 7.2 Camada de Abstração (llm.ts)
- `LLMProvider` interface com `chatCompletion()` e `isAvailable()`
- `getComplexParsingProvider()` → retorna Claude quando disponível
- `withRetry()` para todas as chamadas

### 7.3 Fluxo de Extração de Foto
1. Compressão client-side (max 2048px, JPEG 82%)
2. Upload base64
3. Tesseract.js tenta OCR (português)
4. Se confiança ≥60% E texto ≥30 chars → envia texto para Claude (mais barato)
5. Senão → envia imagem direto para Claude Vision (mais caro)
6. Claude extrai dados estruturados com confiança por campo

### 7.4 Fluxo de PDF Escaneado
1. `parsePdfText()` tenta extrair texto
2. Se sem texto → PDF é escaneado
3. `ocrPdfPages()`: converte páginas via `pdftoppm` → PNG (300 DPI)
4. Tesseract.js processa cada página
5. Texto combinado enviado para Claude

### 7.5 Custos de IA (Resumo)
- **Excel/CSV/PDF digital:** R$ 0.00 (sem IA)
- **Foto:** R$ 0.002 por foto
- **PDF escaneado:** R$ 0.022 por documento
- **Áudio:** R$ 0.0006 por gravação
- **Total estimado:** R$ 30-45/médico/mês

---

## 8. DESIGN SYSTEM

### 8.1 Visual

| Elemento | Valor |
|----------|-------|
| Fonte | Manrope (400-800 weights) |
| Cor primária | #8855f6 (roxo) |
| Gradiente hero | linear-gradient(135deg, #8855f6 → #64499c) |
| Background light | #f6f5f8 |
| Background dark | #0d0a14 |
| Cards | rounded-2xl, shadow-sm |
| Botões | rounded-full, shadow-lg |
| Tema | next-themes (class attribute, default: light) |

### 8.2 Padrão de Header
```
min-h-[8rem] md:min-h-[10.5rem] flex flex-col justify-end pb-6 text-white
+ <div className="h-10" /> spacer
```

### 8.3 Componentes Reutilizáveis
- `EntrySkeleton` — loading skeleton para listas
- `DashboardCardSkeleton` — loading de cards
- `ErrorState` — estado de erro com botão de retry
- `Empty` — estado vazio reutilizável
- `EditEntryModal` — modal de edição (Dashboard + Entries)
- `DivergencyModal` — comparação lado a lado
- `ProductionOverview` — overview de produção com gráficos
- `ProjectionsPanel` — painel de projeções
- `DocumentTraining` — treinamento de template

---

## 9. PWA (Progressive Web App)

- Manifest: `client/public/manifest.json`
- Service Worker: `client/public/sw.js` — network-first com cache fallback
- Ícones: favicon.png (48x48), apple-touch-icon.png (180x180), icon-512.png (512x512)
- Install button na página de Perfil (Android: prompt nativo; iOS: guia passo a passo)
- Auto-update: skipWaiting + clients.claim

---

## 10. PERFORMANCE

- **GZIP:** middleware `compression` antes das rotas
- **Code Splitting:** React.lazy + Suspense para todas as 17 páginas
- **Compressão de imagem:** Client-side max 2048px, JPEG 82% (~70% redução)
- **OCR local:** Tesseract.js evita chamadas de IA desnecessárias
- **Paginação:** `getDoctorEntriesPaginated()` com offset/limit
- **Índices compostos:** Otimizados para queries mais frequentes

---

## 11. FUNCIONALIDADES DETALHADAS

### 11.1 Dashboard
- Saudação personalizada
- Barra de busca inteligente (debounced, server-side)
- Grid de stats: Pendentes, Conferidos, Divergentes, Total
- Painel de projeções (30/60/90 dias)
- 5 entradas mais recentes com modal de edição
- Sino de notificações com dropdown

### 11.2 Captura
- **Foto:** File picker → base64 → IA → ConfirmEntry
- **Foto batch:** Múltiplas fotos (até 50) → processamento paralelo
- **Áudio:** MediaRecorder → conversão WAV (compatibilidade iPhone) → IA → ConfirmEntry
- **Manual:** Formulário direto → ConfirmEntry

### 11.3 ConfirmEntry
- Revisão de todos os campos extraídos
- Indicadores de confiança por campo (verde/amarelo/vermelho)
- Banner de confiança geral
- Autocomplete de nomes de pacientes (fuzzy, ignora acentos)
- Campo de valor do procedimento
- Salva no banco + armazena correções no `ai_corrections`

### 11.4 Conciliação
- Upload de PDF/imagem/CSV
- Suporte a templates treinados
- Deduplicação intra-arquivo
- 4 abas: Conferidos, Recebidos, Divergentes, Pendentes
- Aceitar/rejeitar registros da clínica individualmente ou em lote
- Re-conciliação (resetar e re-processar)

### 11.5 Relatórios de Produção
- Gráfico de barras empilhadas (Particular/SUS/Convênio)
- Seletor de período (semanal/mensal/anual)
- Gráfico de pizza (distribuição por convênio)
- Cards resumo: Total, Particular, SUS, Convênio
- Tabela dos maiores convênios

### 11.6 Importação Histórica
- Download de template CSV/Excel
- Upload de planilha com seletor de ano
- Upload múltiplo de PDFs para conciliação em lote
- Validação de dados com sanitização

### 11.7 Auditoria IA
- Dashboard com 4 categorias: Duplicatas, Anomalias de Valor, Dados Incompletos, Padrões Suspeitos
- Cards com totais + pendentes
- Drill-down em achados individuais
- Badges de severidade (high/medium/low)
- Ação de resolver
- Botão de scan manual (ícone de cérebro no dashboard)

### 11.8 Exportação
- Formatos: Excel (XLSX) e CSV
- Respeita filtros ativos (status, convênio, período)
- Sanitização contra injeção de fórmulas
- Nomes das colunas em português

---

## 12. DEPENDÊNCIAS PRINCIPAIS

### Backend
- express, compression, helmet, express-rate-limit
- jsonwebtoken, bcryptjs
- drizzle-orm, drizzle-zod, pg
- openai, @anthropic-ai/sdk
- pdf-parse, papaparse, xlsx
- tesseract.js
- @google-cloud/storage

### Frontend
- react, react-dom, wouter
- @tanstack/react-query
- tailwindcss, shadcn/ui (radix)
- recharts
- lucide-react
- i18next, react-i18next
- next-themes
- @uppy/* (uploads)

---

## 13. CHECKLIST ANTES DE ALTERAR

### Antes de mudar QUALQUER coisa:
- [ ] Li este documento context.md
- [ ] Identifiquei quais arquivos serão impactados
- [ ] Verifiquei se a mudança afeta algum dos 6 pontos de sanitizeEntryValue
- [ ] Verifiquei se a mudança afeta rotas que usam validateProcedureDate
- [ ] Verifiquei ownership checks (IDOR)
- [ ] Verifiquei se preciso atualizar traduções (4 idiomas)
- [ ] Verifiquei se preciso atualizar o schema (shared/schema.ts)
- [ ] Verifiquei se preciso atualizar IStorage interface + DatabaseStorage

### Após fazer a mudança:
- [ ] Atualizei este context.md com o que mudou
- [ ] Testei a funcionalidade afetada
- [ ] Não quebrei nenhuma funcionalidade existente

---

## 14. PADRÕES DE CÓDIGO

### Rotas (server/routes.ts)
- SEMPRE usar `authMiddleware` para rotas autenticadas
- SEMPRE verificar ownership (doctorId === userId)
- SEMPRE sanitizar valores com `sanitizeEntryValue()`
- SEMPRE validar datas com `validateProcedureDate()`
- SEMPRE usar `VALID_ENTRY_STATUSES` para whitelist de status
- Rotas estáticas ANTES de parametrizadas (`/api/entries/export` antes de `/api/entries/:id`)

### Storage (server/storage.ts)
- Toda operação CRUD deve estar na interface `IStorage`
- Implementar em `DatabaseStorage`
- Usar tipos do `@shared/schema.ts`
- Usar transações quando necessário

### Frontend
- `data-testid` em TODOS os elementos interativos
- Importar formatDate/formatCurrency de `lib/utils.ts`
- Importar status utilities de `lib/status.tsx`
- Usar hooks de `hooks/` (use-date-filter, use-upload, use-pwa-install)
- Todos os textos via i18n (`useTranslation()`)

---

_Documento de Contexto — RecebMed — Abril 2026_
_Atualizar SEMPRE que houver mudança significativa no sistema_
