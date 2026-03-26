# Auditoria Completa — RecebMed
**Data:** 26/03/2026
**Versão:** Pós-Sprint 3 + Fix PDF

---

## 1. RESUMO EXECUTIVO

O RecebMed é uma plataforma robusta com cobertura funcional abrangente. A auditoria identificou **43 itens** classificados por severidade:

| Severidade | Quantidade | Descrição |
|:---|:---:|:---|
| CRITICO | 3 | Bugs que impedem funcionalidade |
| ALTO | 9 | Problemas de UX/segurança que afetam a experiência |
| MEDIO | 16 | Melhorias de design system e consistência |
| BAIXO | 15 | Polish e acessibilidade |

---

## 2. BUGS CRITICOS

### C01 — PDF parse quebrado em produção (CORRIGIDO)
- **Status:** CORRIGIDO nesta sessão
- **Arquivo:** `server/pdf-util.ts` (novo), `server/document-validator.ts`, `server/reconciliation.ts`
- **Causa:** `pdf-parse` v2 mudou API de função para classe; build de produção minificava nome

### C02 — Fallback "Doutor" / "Dr" hardcoded em vários locais
- **Arquivos:** `Dashboard.tsx:214`, `Capture.tsx:48`, `AppLayout.tsx:12`
- **Problema:** Se o nome do usuário estiver vazio, exibe "Doutor" ou "Dr" em português independente do idioma
- **Impacto:** Quebraria a experiência para usuários em en/es/fr

### C03 — Chaves i18n referenciadas no código mas ausentes nos JSONs
- **Chaves:** `button`, `dateFrom`, `dateTo`, `insuranceProvider`, `method`, `search`, `status`
- **Impacto:** Usuário vê a chave crua (ex: "entries.dateFrom") em vez do texto traduzido

---

## 3. PROBLEMAS DE SEGURANCA

### S01 — JWT_SECRET com fallback randomBytes [ALTO]
- **Arquivo:** `server/routes.ts:25`
- **Problema:** Se `JWT_SECRET` não estiver definida, gera um segredo aleatório a cada restart, invalidando todos os tokens
- **Recomendacao:** Garantir env var persistente; falhar na inicialização se ausente

### S02 — Batch de fotos sem limite de payload [ALTO]
- **Arquivo:** `server/routes.ts` — `/api/entries/photos-batch`
- **Problema:** Aceita até 50 imagens base64 em uma request. Sem limite individual de tamanho, pode causar OOM
- **Recomendacao:** Limitar payload individual + total

### S03 — Object Storage com autenticação opcional [MEDIO]
- **Arquivo:** `server/replit_integrations/object_storage/routes.ts`
- **Problema:** Rota `/objects/{*objectPath}` usa `optionalAuthMiddleware`; documentos médicos podem ser acessados sem token válido
- **Recomendacao:** Exigir autenticação + verificar ownership do arquivo

---

## 4. UX / USABILIDADE — FRICÇÃO

### U01 — Notification dropdown transborda em telas < 360px [ALTO]
- **Arquivo:** `Dashboard.tsx:190`
- **Problema:** `w-80` (320px) fixo; em iPhone SE a notificação corta
- **Fix:** Usar `w-[calc(100vw-2rem)]` com max-w-80 no mobile

### U02 — DateInputs com largura fixa (120px) apertada em mobile [MEDIO]
- **Arquivo:** `Entries.tsx:175,183`
- **Problema:** `w-[120px]` muito pequeno para datas; texto cortado em pt-BR
- **Fix:** Usar `w-auto min-w-[120px]`

### U03 — Modal de edição pode cortar conteúdo com teclado aberto [MEDIO]
- **Arquivo:** `EditEntryModal.tsx`, `DivergencyModal.tsx`
- **Problema:** `max-h-[85vh]` não considera teclado virtual; conteúdo some
- **Fix:** Usar `max-h-[85dvh]` (viewport dinâmico) ou ajustar com `visualViewport`

### U04 — Busca no Dashboard abre modal em vez de navegar para detalhe [MEDIO]
- **Arquivo:** `Dashboard.tsx:253`
- **Problema:** Clicar em resultado de busca abre `EditEntryModal` em vez de ir para `/entry/:id`; usuário espera navegação
- **Sugestão:** Oferecer ambas as opções ou ir para detalhe diretamente

### U05 — Status change não reverte visualmente em caso de erro [MEDIO]
- **Arquivo:** `Entries.tsx:127`
- **Problema:** Se a requisição PATCH falhar, o botão de status já mudou visualmente mas o dado não salvou
- **Fix:** Implementar optimistic update com rollback

### U06 — ProjectionsPanel usa spinner em vez de skeleton [BAIXO]
- **Arquivo:** `ProjectionsPanel.tsx:32`
- **Problema:** Causa layout shift ao carregar
- **Fix:** Substituir por skeleton card

### U07 — DivergencyModal usa spinner em vez de skeleton [BAIXO]
- **Arquivo:** `DivergencyModal.tsx:228`
- **Problema:** Conteúdo do modal pula quando carrega
- **Fix:** Skeleton de comparação

---

## 5. DESIGN SYSTEM — CONSISTÊNCIA

### D01 — Cor primária hardcoded #8855f6 em 50+ locais [ALTO]
- **Arquivos:** Dashboard, Reports, Entries, AppLayout, Capture, etc
- **Problema:** Deveria usar `var(--primary)` ou classe Tailwind `text-primary`; impede tematização
- **Impacto:** Mudar a cor da marca exige editar 50+ arquivos

### D02 — Sombras complexas repetidas sem token [ALTO]
- **Exemplo:** `shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)]`
- **Arquivos:** Reports, Dashboard, ClinicReports, Reconciliation, ReportHistory, Import
- **Fix:** Criar classe `.shadow-card` no index.css

### D03 — Mix de slate palette + HSL variables [MEDIO]
- **Problema:** Usa `bg-slate-50` inline E `hsl(var(--muted))` via tokens; mudar tema não afeta tudo
- **Fix:** Padronizar uma abordagem

### D04 — glass-card vs glass-card-dark separados [MEDIO]
- **Arquivo:** `index.css`
- **Problema:** Deveria ser uma classe só com `dark:` variant
- **Fix:** Unificar com seletor `:is(.dark)`

### D05 — Rounded inconsistente (xl vs 2xl vs 3xl) [BAIXO]
- **Problema:** Cards usam `rounded-2xl`, botões `rounded-xl`, modais `rounded-t-3xl`
- **Fix:** Padronizar escala de border-radius

### D06 — Tamanho de fonte inconsistente para labels [BAIXO]
- **Problema:** Labels usam mix de `text-xs`, `text-[10px]`, `text-[11px]`, `text-sm`
- **Fix:** Definir escala tipográfica consistente

---

## 6. ACESSIBILIDADE (A11Y)

### A01 — Botões de ícone sem aria-label [ALTO]
- **Locais encontrados:**
  - Dashboard: botão limpar busca (X)
  - Entries: botão limpar datas (X)
  - Capture: fechar aviso duplicata
  - EditEntryModal: botão deletar, botão fechar
  - DivergencyModal: botão voltar, botão fechar
  - Login/Register: toggle visibilidade de senha
- **Fix:** Adicionar `aria-label` descritivo em todos

### A02 — Contraste insuficiente em texto claro [MEDIO]
- **Locais:**
  - `text-white/70` sobre gradiente (Dashboard saudação)
  - `text-slate-400` sobre fundo branco (datas no Entries, labels)
  - `text-slate-300` em estados vazios
- **Fix:** Garantir ratio mínimo 4.5:1 (WCAG AA)

### A03 — PatientNameInput sem atributos ARIA de autocomplete [MEDIO]
- **Arquivo:** `ConfirmEntry.tsx:96-115`
- **Problema:** Falta `aria-expanded`, `aria-haspopup="listbox"`, `aria-autocomplete="list"`
- **Fix:** Adicionar atributos WAI-ARIA combobox

### A04 — Labels de formulário sem htmlFor no DivergencyModal [BAIXO]
- **Arquivo:** `DivergencyModal.tsx:161,165`
- **Problema:** Labels não vinculadas aos inputs via htmlFor

### A05 — Select de idioma/tema sem labels explícitas [BAIXO]
- **Arquivo:** `Profile.tsx`
- **Problema:** Selects de idioma e tema usam texto visual mas faltam labels associadas

---

## 7. i18n — INTERNACIONALIZAÇÃO

### I01 — ~100 chaves não utilizadas nos JSONs de locale [MEDIO]
- **Impacto:** Bundle maior desnecessariamente
- **Ação:** Limpar chaves órfãs

### I02 — Strings em português hardcoded [MEDIO]
- `"Doutor"` — Dashboard.tsx:214, AppLayout.tsx:12
- `"SUS"` — Reports.tsx (termo médico, pode manter mas documentar)
- `"WhatsApp"`, `"E-mail"` — Reconciliation.tsx (nomes de marca, aceitável)

### I03 — Strings em inglês hardcoded nos componentes UI [BAIXO]
- `"Sidebar"`, `"Previous"`, `"Next"`, `"Close"` — sidebar.tsx, pagination.tsx, dialog.tsx, carousel.tsx
- **Nota:** São componentes shadcn/ui; corrigir se usados visualmente

### I04 — Chaves referenciadas ausentes nos JSONs [MEDIO]
- Chaves: `button`, `dateFrom`, `dateTo`, `insuranceProvider`, `method`, `search`, `status`
- **Fix:** Adicionar aos 4 locales

---

## 8. PERFORMANCE

### P01 — Reports.tsx carrega TODAS as entries de uma vez [ALTO]
- **Arquivo:** `Reports.tsx:76`
- **Problema:** `GET /api/entries` sem paginação; para usuários com 300+ entries, response grande e processamento pesado no cliente
- **Fix:** Usar endpoint paginado ou criar endpoint de analytics separado

### P02 — Entries paginada mas Reports não [MEDIO]
- **Problema:** Inconsistência — Entries usa paginação server-side, Reports carrega tudo
- **Fix:** Criar `/api/reports/analytics` que retorna dados já processados

### P03 — Reconciliation sem progress real [BAIXO]
- **Problema:** O upload mostra "Processando..." mas sem barra de progresso percentual
- **Fix:** Implementar SSE ou polling para mostrar progresso

---

## 9. LAYOUT RESPONSIVO

### L01 — Sidebar desktop funcional [OK]
- Sprint 3 implementou sidebar corretamente (≥768px)
- Tab bar escondida no desktop
- Gradiente ajustado para sidebar offset

### L02 — ReportsTabs implementados [OK]
- Sub-tabs visíveis em todas as páginas de relatório
- Botão "voltar" escondido no desktop (md:hidden)

### L03 — Skeletons implementados [OK]
- Entries, Dashboard, EntryDetail, Reports usam skeletons
- ProjectionsPanel e DivergencyModal ainda usam spinner

### L04 — Cards de summary poderiam usar grid responsivo [BAIXO]
- Dashboard: cards de KPI em `grid-cols-2` poderia ser `grid-cols-4` no desktop
- Reports: cards de navegação em `grid-cols-2 sm:grid-cols-4` já responsivo

---

## 10. UPLOAD / DOWNLOAD

### T01 — Upload de fotos funcional (base64) [OK]
- Conversão client-side, envio via JSON body
- Limite 50MB no Express body parser
- Batch até 50 fotos

### T02 — Upload de PDF/CSV para reconciliação [OK, com fix]
- PDF parse corrigido para v2
- Limite 20MB por arquivo
- Tipos validados no frontend

### T03 — Download de template CSV [OK]
- Endpoint sem autenticação (público)
- Gera CSV em memória

### T04 — Object Storage (fotos/áudio) [OK]
- Upload via presigned URLs (GCS)
- Download via proxy route

---

## 11. PLANO DE AÇÃO RECOMENDADO

### Sprint 4 — Críticos + Alto Impacto (PRIORIDADE)
1. **C02** — Traduzir fallback "Doutor"/"Dr" via i18n
2. **C03** — Adicionar chaves i18n ausentes
3. **A01** — aria-labels em todos os botões de ícone
4. **D01** — Substituir #8855f6 por variável CSS (pode ser gradual)
5. **D02** — Criar .shadow-card e .shadow-card-dark
6. **U01** — Fix notification dropdown overflow
7. **P01** — Endpoint de analytics server-side para Reports
8. **S01** — Falhar se JWT_SECRET não definido

### Sprint 5 — Médio Impacto
9. **U02** — DateInputs responsivos
10. **U03** — Modal max-h com dvh
11. **U05** — Optimistic update com rollback
12. **A02** — Contraste WCAG AA
13. **A03** — ARIA combobox no PatientNameInput
14. **D03** — Padronizar slate vs HSL
15. **I01** — Limpar chaves i18n não usadas
16. **I04** — Adicionar chaves referenciadas ausentes

### Sprint 6 — Polish
17. **D04-D06** — Unificar glass-card, border-radius, font scale
18. **U06-U07** — Skeleton em ProjectionsPanel e DivergencyModal
19. **A04-A05** — Labels e htmlFor
20. **P02-P03** — Analytics endpoint + progress bar
21. **I02-I03** — Hardcoded strings restantes

---

## 12. PONTOS POSITIVOS

- Excelente cobertura de `data-testid` na maioria dos elementos
- Sistema de i18n bem implementado com 4 idiomas sincronizados
- Validação de senha com feedback visual em tempo real
- Fluxo de captura por foto/áudio/manual completo e funcional
- Reconciliação AI-powered com templates treináveis
- Dark mode com boa cobertura
- Skeleton screens implementados nas páginas principais
- Sidebar desktop + tab bar mobile implementados
- Sub-tabs de navegação nos relatórios
- Auditoria automática em background (scheduler)
- Error boundaries e toasts consistentes
- Date filter com quick filters e persistência em sessionStorage
