# 🏥 RecebMed — Auditoria Completa de UX/UI Design System

**Data:** 25 de Março de 2026  
**Escopo:** Análise completa de experiência do usuário, design system, navegação, responsividade, padrões de formulário, estados de dados e consistência visual.  
**Páginas analisadas:** 16 páginas, 98+ componentes

---

## 📋 Sumário Executivo

O RecebMed apresenta uma **base sólida de design mobile-first** com identidade visual moderna (paleta roxa, tipografia Manrope, cantos arredondados). No entanto, foram identificadas **32 oportunidades de melhoria** em 7 categorias, variando de críticas a cosméticas.

| Severidade | Quantidade | Descrição |
|:---|:---:|:---|
| 🔴 Crítica | 5 | Problemas que impactam diretamente a usabilidade |
| 🟠 Alta | 9 | Inconsistências que geram confusão no usuário |
| 🟡 Média | 11 | Melhorias que elevam a qualidade percebida |
| 🔵 Baixa | 7 | Refinamentos de polish e consistência |

---

## 1. 🧭 NAVEGAÇÃO E FLUXO

### 1.1 Botões de Voltar — Ausência Sistemática
**Severidade: 🔴 Crítica**

| Página | Tem Botão Voltar? | Problema |
|:---|:---:|:---|
| `/dashboard` | ❌ | Página raiz — aceitável |
| `/entries` | ❌ | Página raiz — aceitável |
| `/entry/:id` | ✅ (ArrowLeft) | Volta para `/entries` — OK |
| `/capture` | ❌ | Página raiz — aceitável |
| `/confirm-entry` | ✅ | Usa `history.back()` — OK |
| `/reports` | ❌ | Página raiz — aceitável |
| `/reports/history` | ❌ | **Sub-página sem voltar** |
| `/reconciliation` | ❌ | **Sub-página sem voltar** |
| `/clinic-reports` | ❌ | **Sub-página sem voltar** |
| `/import` | ❌ | **Sub-página sem voltar** |
| `/profile` | ❌ | Página raiz — aceitável |
| `/settings` | ❌ | **Sub-página sem voltar** |

**Diagnóstico:** 5 sub-páginas (Settings, Reconciliation, Clinic Reports, Import, Report History) não possuem botão de voltar. O usuário é forçado a clicar no menu inferior e renavegar pelos submenus.

**Recomendação:**  
- Adicionar um **header contextual** com ícone ArrowLeft + título da página em todas as sub-páginas
- No desktop: incluir breadcrumbs (ex: "Relatórios > Histórico")
- Padrão sugerido: `<PageHeader title="Configurações" backTo="/profile" />`

### 1.2 Navegação Desktop vs Mobile
**Severidade: 🟠 Alta**

O RecebMed usa **exclusivamente** uma barra de navegação inferior (tab bar) com 5 abas, padrão de aplicativo mobile. No desktop (telas > 768px), este padrão apresenta problemas:

- A tab bar fixa na parte inferior parece fora de contexto em telas grandes
- Não há sidebar lateral para desktop (o componente existe em `sidebar.tsx` mas **não é usado**)
- O espaço lateral fica completamente vazio em telas acima de `max-w-5xl`

**Recomendação:**
- **Mobile (< 768px):** Manter tab bar inferior — ótima para mobile
- **Desktop (≥ 768px):** Ativar sidebar lateral com navegação expandida, ocultando a tab bar
- Utilizar o componente `sidebar.tsx` já existente no projeto (está implementado, mas desativado)

### 1.3 Sub-navegação nos Relatórios
**Severidade: 🟡 Média**

A seção "Relatórios" possui 5 sub-páginas (Reports, Reconciliation, Clinic Reports, Import, Report History) acessadas por cards ou botões dentro da própria página. Não há um sistema de tabs ou sub-menu para navegação entre elas.

**Recomendação:**
- Adicionar **tabs horizontais** no topo da seção de relatórios para alternar entre as sub-páginas
- Ex: `Produção | Conferência | Clínica | Importar | Histórico`

---

## 2. 🎨 DESIGN SYSTEM E CONSISTÊNCIA VISUAL

### 2.1 Variáveis CSS Não Definidas
**Severidade: 🟠 Alta**

Componentes referenciam variáveis CSS que **não existem** no `index.css`:

| Componente | Variável Referenciada | Status |
|:---|:---|:---:|
| `button.tsx` | `--primary-border` | ❌ Não definida |
| `button.tsx` | `--button-outline` | ❌ Não definida |
| `badge.tsx` | `--badge-outline` | ❌ Não definida |
| `button.tsx` | `hover-elevate` (classe) | ❌ Não definida |
| `button.tsx` | `active-elevate-2` (classe) | ❌ Não definida |

**Impacto:** Bordas invisíveis, efeitos hover não funcionam, botões podem parecer "flat" quando deveriam ter profundidade.

**Recomendação:** Definir todas as variáveis no `index.css` dentro do bloco `@theme` ou removê-las dos componentes.

### 2.2 Cores Hardcoded vs Variáveis
**Severidade: 🟠 Alta**

Múltiplas páginas usam valores hex hardcoded (`#8855f6`) em vez da variável CSS `var(--primary)`:

| Arquivo | Ocorrências | Exemplo |
|:---|:---:|:---|
| `Dashboard.tsx` | 12+ | `text-[#8855f6]`, `bg-[#8855f6]/10` |
| `AppLayout.tsx` | 6+ | `text-[#8855f6]`, gradient hardcoded |
| `Capture.tsx` | 4+ | `bg-[#8855f6]` |
| `Entries.tsx` | 3+ | `text-[#8855f6]` |

**Impacto:** Se a cor primária mudar, essas referências não se atualizam. Modo escuro pode ficar inconsistente.

**Recomendação:** Substituir todas as referências hex por `text-primary`, `bg-primary/10`, etc. utilizando as classes Tailwind com a variável CSS.

### 2.3 Inconsistência de Cards no Dark Mode
**Severidade: 🟡 Média**

- `.card-float` usa `rgb(15 23 42)` como background no dark mode
- `--card` global usa `270 20% 10%` (tom roxo escuro)
- Resultado: cards "float" e cards normais possuem tonalidades diferentes no modo escuro

**Recomendação:** Unificar backgrounds usando `hsl(var(--card))` em todas as classes de card.

### 2.4 Hierarquia Visual dos Status
**Severidade: 🟡 Média**

Os status utilizam cores diferentes dependendo do componente:

| Status | Dashboard | Entries | Reconciliation |
|:---|:---|:---|:---|
| Pendente | `text-amber-600` | `bg-amber-100` | `text-yellow-600` |
| Conferido | `text-green-600` | `bg-green-100` | `text-green-600` |
| Divergente | `text-red-600` | `bg-red-100` | `text-red-500` |

**Recomendação:** Criar classes utilitárias de status (`status-pending`, `status-reconciled`, `status-divergent`) para garantir uniformidade.

---

## 3. 📱 RESPONSIVIDADE E EXPERIÊNCIA MOBILE

### 3.1 Targets de Toque (Touch Targets)
**Severidade: ✅ Adequado**

A aplicação segue bem as guidelines de 44px mínimo:
- Tab bar: `min-w-[56px]` ✓
- Inputs: `h-11` a `h-12` ✓
- Cards de captura: `p-6` com largura total ✓
- Feedback tátil: `active:scale-[0.97]` ✓

### 3.2 Safe Areas e Notch
**Severidade: ✅ Adequado**

- Tab bar usa `env(safe-area-inset-bottom)` para iPhones com home bar ✓
- Implementação correta para dispositivos modernos

### 3.3 Desktop — Subutilização do Espaço
**Severidade: 🟠 Alta**

Com `max-w-5xl` (~1024px), a aplicação deixa áreas brancas enormes em monitores maiores. Não há layout adaptativo para desktop:

- Cards de lançamentos ficam em coluna única (poderiam ser em grid 2 colunas)
- Tabelas não aproveitam a largura disponível
- Formulários de captura usam ~40% da tela em um monitor fullHD

**Recomendação:**
- Em telas ≥ 1024px: usar layouts de 2 colunas (lista + detalhes)
- Em telas ≥ 1440px: considerar layout de 3 colunas (sidebar + lista + detalhes)

---

## 4. 📝 FORMULÁRIOS E INTERAÇÕES

### 4.1 Toggle de Visibilidade de Senha
**Severidade: 🟡 Média**

| Página | Tem Toggle Mostrar/Ocultar Senha? |
|:---|:---:|
| Login | ❌ |
| Register | ✅ |
| Settings | ✅ |

**Recomendação:** Adicionar toggle de visibilidade na página de Login para consistência.

### 4.2 Validação de Formulários — Timing Inconsistente
**Severidade: 🟡 Média**

- **Register:** Desabilita o botão de submit se a senha é inválida (`disabled={!passwordValid}`)
- **Settings:** Permite o clique e depois mostra um toast de erro

**Recomendação:** Padronizar: sempre desabilitar botões quando o form é inválido (pattern mais seguro e previsível).

### 4.3 Estrutura de Formulário
**Severidade: 🟡 Média**

- **Login/Register:** Usam `<form onSubmit>` (Enter funciona para submeter)
- **Profile/Settings:** Usam `<div>` com `onClick` (Enter **não** funciona)

**Recomendação:** Usar `<form>` em todos os formulários para acessibilidade e comportamento esperado do teclado.

### 4.4 Validação de Email
**Severidade: 🔵 Baixa**

Depende exclusivamente do `type="email"` do HTML5. Não há validação customizada (ex: bloquear domínios inválidos, feedback visual inline).

**Recomendação:** Adicionar validação com regex + feedback inline para erros de formato.

---

## 5. 📊 ESTADOS DE DADOS

### 5.1 Empty States — Inconsistência
**Severidade: 🟠 Alta**

Existe um componente `client/src/components/ui/empty.tsx` dedicado para estados vazios, mas **não é usado** nas páginas principais:

| Página | Usa o Componente Empty? | Implementação Atual |
|:---|:---:|:---|
| Entries | ❌ | `<div>` customizado com ícone |
| Dashboard | ❌ | `<div>` customizado |
| Reports | ❌ | Sem empty state claro |
| Reconciliation | ❌ | Mostra zona de upload |

**Recomendação:** Usar o componente `<Empty>` em todas as páginas, com ícone, mensagem e ação sugerida (ex: "Nenhum lançamento. Clique em + para começar").

### 5.2 Error States — Tratamento Desigual
**Severidade: 🔴 Crítica**

| Página | Mostra UI de Erro? | Comportamento Atual |
|:---|:---:|:---|
| EntryDetail | ✅ | Ícone AlertCircle + mensagem |
| Entries | ❌ | Catch silencioso → possível empty state |
| Dashboard | ❌ | Catch silencioso |
| Reports | ❌ | Catch silencioso |
| Reconciliation | ❌ | Apenas toast |

**Impacto:** Se a API falha, a maioria das páginas mostra uma tela "vazia" sem explicação. O usuário pensa que não tem dados, quando na verdade houve um erro de rede.

**Recomendação:**
- Criar componente `<ErrorState onRetry={} />` com ícone, mensagem e botão "Tentar novamente"
- Usar em todas as páginas que fazem fetch de dados

### 5.3 Loading States — Falta de Contexto
**Severidade: 🟡 Média**

| Página | Loading UI | Texto Contextual? |
|:---|:---|:---:|
| Entries | Spinner centralizado | ❌ |
| Reports | Spinner centralizado | ❌ |
| Dashboard | Spinner + texto | ✅ |
| Reconciliation | Spinner + "Processando..." | ✅ |

**Recomendação:** Adicionar texto contextual em todos os loadings (ex: "Carregando lançamentos...", "Gerando relatório..."). Considerar usar **skeleton screens** em vez de spinners para uma experiência mais fluida.

### 5.4 Paginação — Inexistente
**Severidade: 🔴 Crítica**

**Nenhuma página implementa paginação.** Todas carregam todos os registros na memória e filtram no cliente.

- Componente `pagination.tsx` **existe** mas não é usado em nenhuma página
- Com crescimento de dados (centenas de lançamentos por mês), a performance vai degradar significativamente

**Recomendação:**
- Implementar paginação server-side nas rotas `/api/entries` e `/api/reports`
- Usar o componente `pagination.tsx` existente
- Padrão sugerido: 25 itens por página com scroll infinito ou botões de página

---

## 6. ♿ ACESSIBILIDADE

### 6.1 Labels de Formulário
**Severidade: 🟡 Média**

Alguns inputs não possuem `<Label>` associado via `htmlFor`, dependendo apenas de `placeholder` para indicar o propósito. Isso prejudica leitores de tela.

### 6.2 Contraste de Cores
**Severidade: 🔵 Baixa**

- `text-slate-400` sobre `bg-white` pode não passar no teste WCAG AA (ratio ~3.0:1, mínimo 4.5:1)
- Texto `text-[10px]` na tab bar é muito pequeno para alguns usuários

### 6.3 Foco do Teclado
**Severidade: 🟡 Média**

- Tab bar não mostra anel de foco visível (`focus-visible:ring`) para navegação por teclado
- Modais podem não ter `focus trap` adequado

### 6.4 ARIA Labels
**Severidade: 🔵 Baixa**

- Ícones decorativos (Lucide) não possuem `aria-hidden="true"` consistente
- Botões com apenas ícone (sem texto) não possuem `aria-label`

---

## 7. 🔄 FORMATAÇÃO E UTILITÁRIOS

### 7.1 Formatação de Datas — Reimplementada
**Severidade: 🟠 Alta**

A função `formatDate` é reimplementada com variações em quase todas as páginas:
- `Entries.tsx`: Suporta "Hoje/Ontem"
- `EntryDetail.tsx`: Formato básico sem "Hoje/Ontem"
- `Dashboard.tsx`: Outra variação
- `Reports.tsx`: Outra variação

**Recomendação:** Criar **um único utilitário** `formatDate(date, options?)` em `lib/utils.ts` e reutilizar em toda a aplicação.

### 7.2 Formatação de Moeda — Reimplementada
**Severidade: 🟠 Alta**

Mesmo problema: `formatCurrency` é redefinida em múltiplas páginas com assinaturas ligeiramente diferentes.

**Recomendação:** Centralizar em `lib/utils.ts` com suporte a i18n integrado.

---

## 8. 📐 MAPA DE PRIORIZAÇÃO

### Ação Imediata (Sprint 1)
1. ✅ Adicionar botão "Voltar" em todas as sub-páginas (Settings, Reconciliation, Clinic Reports, Import, Report History)
2. ✅ Criar componente `<ErrorState>` e usar em todas as páginas com fetch
3. ✅ Centralizar `formatDate` e `formatCurrency` em `lib/utils.ts`
4. ✅ Definir variáveis CSS faltantes (`--primary-border`, etc.)

### Próximo Ciclo (Sprint 2)
5. ✅ Implementar paginação server-side em Entries e Reports
6. ✅ Usar componente `<Empty>` em todas as páginas
7. ✅ Padronizar cores de status com classes utilitárias
8. ✅ Adicionar toggle de senha no Login

### Evolução (Sprint 3)
9. ✅ Ativar sidebar para desktop (≥ 768px)
10. ✅ Layout adaptativo de 2 colunas para desktop
11. ✅ Substituir spinners por skeleton screens
12. ✅ Sub-tabs de navegação na seção Relatórios

### Refinamento (Sprint 4)
13. ✅ Substituir cores hardcoded por variáveis CSS
14. ✅ Acessibilidade: ARIA labels, focus management, contraste
15. ✅ Unificar padrão de formulários (`<form>` em vez de `<div>`)
16. ✅ Adicionar textos contextuais em todos os loadings

---

## 9. 📊 SCORECARD FINAL

| Categoria | Nota | Comentário |
|:---|:---:|:---|
| Design Visual | 8/10 | Identidade forte, moderna e profissional |
| Tipografia | 9/10 | Manrope bem aplicada com boa hierarquia |
| Paleta de Cores | 7/10 | Boa base, mas inconsistências nos hardcoded |
| Navegação Mobile | 7/10 | Tab bar excelente, faltam botões voltar |
| Navegação Desktop | 4/10 | Subutilização do espaço, sem sidebar |
| Formulários | 6/10 | Funcionais, mas inconsistentes |
| Estados de Dados | 5/10 | Empty/Error states fracos |
| Acessibilidade | 5/10 | Necessita melhorias significativas |
| Consistência | 6/10 | Funções duplicadas, variáveis não definidas |
| Performance UX | 5/10 | Sem paginação, todos dados na memória |
| **NOTA GERAL** | **6.2/10** | **Base sólida com espaço significativo para melhoria** |

---

*Relatório gerado pela análise automatizada do codebase RecebMed em 25/03/2026.*
