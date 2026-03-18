# RecebMed — Relatório Técnico de Auditoria Pós-Correções

**Data:** 18 de Março de 2026  
**Versão:** Estado atual da aplicação

---

## 1. Lógica de Reconciliação

### 1.1 Mecanismo de Matching

**Status: Implementado — Matching por NOME do paciente (fuzzy), não por posição.**

A reconciliação utiliza um processo em duas etapas:

| Etapa | Mecanismo | Detalhes |
|:------|:----------|:---------|
| **Etapa A — IA (GPT-5-mini)** | Matching em lotes de 30 registros | O prompt instrui explicitamente: *"O matching é feito pelo NOME DO PACIENTE. NÃO use a posição/índice na lista. NUNCA faça match por posição."* |
| **Etapa B — Fallback local** | Algoritmo de scoring com Levenshtein | Função `scoreMatch()` calcula pontuação ponderada por múltiplos campos |

**Validação anti-alucinação:** Após cada match da IA, o sistema executa uma verificação de distância Levenshtein entre os nomes. Se a distância > 5 caracteres, o match é rejeitado com log: `"AI matched by position? Rejecting"`.

### 1.2 Critérios de Divergência

Os seguintes campos são comparados para determinar status:

| Campo | Tolerância | Comportamento |
|:------|:-----------|:-------------|
| **Nome do paciente** | Levenshtein ≤ 3 (scoring local) / ≤ 5 (validação IA) | Campo obrigatório para qualquer match. Se não bater, é `pending` |
| **Data do procedimento** | Diferença de até 3 dias | Aceito como match válido |
| **Data de nascimento** | Comparação exata (quando disponível) | Conta como campo divergente se diferir |
| **Nome do procedimento** | Levenshtein ≤ 30% do comprimento OU substring | Conta como campo divergente se diferir |
| **Convênio/plano** | Levenshtein ≤ 3 OU substring | Conta como campo divergente se diferir |

**Regra de decisão:** Se o score atingir ≥ 70% dos campos preenchidos → `reconciled`. Se o nome bateu mas campos complementares divergem → `divergent` (com `divergenceReason` detalhado).

### 1.3 Categorias Implementadas

| Categoria | Status | Definição |
|:----------|:-------|:----------|
| **Reconciled (Conferido)** | ✅ Implementado | Nome encontrado + dados complementares batem (score ≥ 70%) |
| **Divergent (Divergente)** | ✅ Implementado | Nome encontrado + algum dado complementar diverge |
| **Pending (Pendente Médico)** | ✅ Implementado | Lançamento do médico sem correspondência na lista da clínica |
| **Unmatched Clinic (Não Conferido)** | ✅ Implementado | Registro da clínica sem lançamento correspondente do médico |
| **Validated (Validado)** | ✅ Implementado | Status atribuído pelo médico após validação manual; preservado pelo audit loop |

### 1.4 Campo Valor

**Status: O campo `value` NÃO é utilizado como critério de divergência.**

O prompt da IA instrui explicitamente: *"IMPORTANTE: NÃO compare valores financeiros"*. A função `scoreMatch()` também não inclui o valor em seu cálculo. Os valores (`entryValue`, `reportValue`) são retornados apenas para exibição, sem influenciar o status.

---

## 2. Atividade de IA e Processamento em Background

### 2.1 Background Worker

**Status: Implementado e ativo.**

O sistema possui um scheduler persistente (`server/audit.ts`) que é iniciado junto com o servidor Express via `startAuditScheduler()`.

### 2.2 Loop de Reconciliação

**Status: Ativo com 4 triggers distintos.**

| Trigger | Frequência | Escopo |
|:--------|:-----------|:-------|
| **Pós-upload (debounce)** | 5 minutos após último upload do usuário | Usuário específico |
| **Intervalo periódico** | A cada 15 minutos (silent mode) | Todos os usuários ativos |
| **Horários fixos BRT** | 13:00 e 22:00 BRT | Todos os usuários ativos |
| **Startup** | 30 segundos após boot do servidor | Todos os usuários ativos |

**Proteções:**
- Mutex (`auditRunning`) impede varreduras sobrepostas
- Map de `pendingAudits` com debounce por usuário (uploads rápidos não geram múltiplas execuções)
- Usuários com audit pós-upload pendente são pulados na varredura global

**Notificações automáticas:** O audit gera notificação ao médico informando: registros reconciliados, divergentes, pendentes e registros da clínica aguardando aceite.

### 2.3 Camada de Abstração LLM

**Status: NÃO implementada.**

O sistema está vinculado diretamente ao SDK da OpenAI (`openai` npm package). Não existe mecanismo de troca de provider (e.g., `LLM_PROVIDER`) ou fallback para Claude/Anthropic.

**Modelos em uso:**
- `gpt-5-mini` — Extração de dados (PDF/imagem/CSV) e reconciliação
- `gpt-4o-mini-transcribe` — Transcrição de áudio (STT)

---

## 3. PDF Parser e Tratamento de Documentos

### 3.1 Tratamento de NOTAFLMED.pdf

| Aspecto | Status | Implementação |
|:--------|:-------|:-------------|
| **Ignorar linhas "Observação:"** | ✅ Implementado | Prompt instrui: *"Ignore linhas que começam com 'Observação:' ou 'Obs:' — NÃO são registros de pacientes"* |
| **Headers e footers** | ✅ Implementado | Prompt instrui: *"Ignore SEMPRE: cabeçalhos, rodapés, totais, subtotais, resumos"* |
| **Mapeamento de Espécie** | ✅ Implementado | Regra explícita no prompt: PIX/Dinheiro/Cartão/Redecard/PACOTE/PX/DN/CC/RE → `"Particular"`. Instrução adicional: *"Em documentos NOTAFLMED ou 'Conta Corrente': a coluna 'Espécie' indica forma de pagamento, NÃO convênio"* |
| **Múltiplas entradas por paciente** | ✅ Implementado | Prompt instrui: *"Se um paciente aparece 2x com valores diferentes → extraia as 2 ocorrências separadas."* Na reconciliação: *"Se o paciente aparece mais de uma vez, use a combinação nome+data para identificar o registro correto."* |

### 3.2 Validação e Sanitização de Dados

O sistema possui funções de sanitização multicamada:

- **`sanitizeEntry()`** — Valida nome do paciente (mín. 2 chars) e data válida antes de aceitar o registro
- **`sanitizeValue()`** — Converte formatos brasileiros (R$ 4.702,00 → 4702.00) e remove caracteres monetários
- **`sanitizeDate()`** — Aceita múltiplos formatos: ISO (YYYY-MM-DD), BR (DD/MM/YYYY), alternativo (DD-MM-YYYY)
- **`parseAIResponse()`** — Fallback para parsing de JSON malformado (extrai objetos individuais se array falhar)

### 3.3 Validador Dinâmico de Documentos

**Status: NÃO implementado como módulo separado.**

Não existe um "Document Validator" dedicado com mapeamento dinâmico de colunas PDF/Excel. A inteligência de interpretação está embutida no prompt da IA (`EXTRACTION_PROMPT`), que cobre formatos comuns:
- Conta Corrente Equipe Médica
- Guias TISS
- Extratos de produção
- Notas fiscais de serviços médicos
- Relatórios de repasse
- Planilhas exportadas de sistemas hospitalares

Para CSV, existe um parser determinístico (`extractCsvData()`) com aliases para colunas comuns, e um fallback via IA (`extractCsvWithAI()`) quando o parser local não reconhece a estrutura.

---

## 4. Atualizações de UI/UX

### 4.1 Página de Extratos de Produção (`ClinicReports`)

**Status: File-centric — implementado.**

- Os registros são agrupados por arquivo de origem (`sourcePdfUrl`)
- Cada grupo é exibido como um "File Card" mostrando: nome do arquivo, data, contagem de registros e valor total
- Clicar em um File Card expande a lista de registros individuais daquele arquivo
- Botão "Upload New File" redireciona para a página de Reconciliação
- Registros manuais são agrupados separadamente sob "Manual Entries"

### 4.2 Página de Conferir Produção (`Reconciliation`)

| Elemento | Status | Detalhes |
|:---------|:-------|:---------|
| **Card "Envie um arquivo"** | Presente (colapsável) | Exibido como dropzone grande quando sem resultados; colapsa automaticamente após processamento (`uploadCollapsed` state) |
| **"Carregar resultados anteriores"** | Automático | Não há botão explícito — os resultados são carregados automaticamente via `useEffect` → `loadResults()` no mount |
| **Modal de divergência** | ✅ Implementado | Clicar em item divergente abre `DivergencyModal` com comparação lado-a-lado (dados do médico vs. dados da clínica) |
| **Seção "Não Conferidos"** | ✅ Implementado | Aba dedicada com explicação, botão "Aceitar Todos" e botões individuais de aceite |
| **Exportação** | ✅ Implementado | PDF, WhatsApp e E-mail — filtrados pela aba ativa |
| **Re-reconciliação** | ✅ Implementado | Botão "Re-conferir Tudo" reseta divergentes/pendentes e re-executa a reconciliação |
| **Aging alerts** | ✅ Implementado | Badge vermelho `"Xd pendente"` em entries pendentes há mais de 7 dias |
| **Abas** | ✅ 6 abas | Total, Conferidos, Recebidos, Divergentes, Pendentes, Não Conferidos |

### 4.3 Consistência Geral da UI

| Aspecto | Status |
|:--------|:-------|
| **Contagens do Dashboard** | ✅ Precisas — calculadas a partir de `/api/entries` (pending, reconciled, divergent) |
| **Nomenclatura** | Consistente: "Lançamentos" para entries, "Conferir Produção" para reconciliação, "Relatórios de Produção" para reports |
| **Títulos das páginas** | Consistentes com navegação bottom tab |
| **Quick filters (data)** | ✅ Padronizados: Ontem / Hoje / Semana / Este mês — compartilhados entre Entries e Reports via hook `useDateFilter` com persistência em `sessionStorage` |
| **i18n** | ✅ 4 idiomas: pt-BR, en, es, fr |

---

## 5. Features Pendentes e Polimento Final

### 5.1 Evidência Original no Modal de Validação Manual

**Status: ✅ Implementado.**

O `DivergencyModal` exibe a evidência original baseada no `entryMethod`:
- **Foto (`"photo"`):** Renderiza `<img>` com a URL da evidência
- **Áudio (`"audio"`):** Renderiza `<audio>` com controles de playback
- A evidência é visível tanto na visualização padrão quanto no sub-modo de "Validação Manual"

### 5.2 Dashboard de Relatórios

**Status: ✅ Conectado ao banco de produção.**

- Os gráficos em `/reports` são alimentados por dados reais de `/api/entries`
- **Gráfico de barras (Produção):** Calculado via `useMemo` com base nas entries filtradas por data
- **Gráfico de pizza (Convênios):** Derivado das entries agrupadas por `insuranceProvider`
- Os filtros de data (incluindo quick filters) afetam os gráficos em tempo real

---

## Resumo Executivo

| Área | Status |
|:-----|:-------|
| Matching por nome (não posição) | ✅ Completo |
| Categorias: Reconciled, Divergent, Pending, Unmatched, Validated | ✅ Completo |
| Valor NÃO usado como critério de divergência | ✅ Correto |
| Background worker (audit loop) | ✅ Ativo (15min + 13h/22h BRT + pós-upload) |
| Abstração LLM (multi-provider) | ❌ Não implementado (OpenAI only) |
| Parser NOTAFLMED (Observação, Espécie, multi-paciente) | ✅ Completo via prompt IA |
| Validador dinâmico de documentos | ❌ Não implementado como módulo separado |
| ClinicReports file-centric | ✅ Completo |
| Reconciliation modal de divergência | ✅ Completo |
| Evidência original no modal | ✅ Completo |
| Charts com dados reais | ✅ Completo |
| Contagens do Dashboard precisas | ✅ Completo |
| Quick filters padronizados (Entries + Reports) | ✅ Completo |
| Aging alerts para pendentes | ✅ Completo |
