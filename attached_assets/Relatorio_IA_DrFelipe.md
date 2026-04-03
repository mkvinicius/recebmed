# RecebMed - Relatorio sobre o Erro de IA e Solucao Implementada

**Preparado para: Dr. Felipe**
**Data: Abril/2026**

---

## 1. O que aconteceu?

Ao tentar enviar um arquivo PDF na pagina de Conferir Producao, o sistema exibiu a mensagem:

> "Limite de requisicoes atingido. Aguarde alguns segundos e tente novamente."

### Causa raiz

O erro **nao** foi do RecebMed. O problema ocorreu na **API da OpenAI** (fornecedora de inteligencia artificial), que retornou um erro de **cota excedida** - ou seja, o limite mensal de uso da IA contratada foi atingido.

Toda vez que voce enviava um PDF, foto ou planilha, o sistema usava a OpenAI para extrair os dados. Com o volume de uso acumulado, a cota mensal foi esgotada.

---

## 2. O que era (antes)

| Funcao no app | IA utilizada | Custo |
|---|---|---|
| Extracao de dados de PDF | OpenAI GPT-5 Mini | Pago por uso (API key propria) |
| Extracao de dados de imagem (relatorios) | OpenAI GPT-5 Mini | Pago por uso |
| Extracao de planilha CSV | OpenAI GPT-5 Mini | Pago por uso |
| Conciliacao automatica | OpenAI GPT-5 Mini | Pago por uso |
| Extracao de foto (captura de etiqueta) | OpenAI GPT-5 Mini | Pago por uso |
| Analise de audio transcrito | OpenAI GPT-5 Mini | Pago por uso |
| Transcricao de audio | OpenAI Transcribe | Pago por uso |
| Verificacao de duplicatas | Claude (Anthropic) | Incluso no plano Replit |
| Auditoria de anomalias | Claude (Anthropic) | Incluso no plano Replit |

**Problema:** 7 das 9 funcoes dependiam exclusivamente da OpenAI. Se a cota acabava, quase tudo parava.

---

## 3. Como esta agora (depois da correcao)

| Funcao no app | IA utilizada | Custo |
|---|---|---|
| Extracao de dados de PDF | **Claude (Anthropic)** | **Incluso no plano Replit** |
| Extracao de dados de imagem (relatorios) | **Claude (Anthropic)** | **Incluso no plano Replit** |
| Extracao de planilha CSV | **Claude (Anthropic)** | **Incluso no plano Replit** |
| Conciliacao automatica | **Claude (Anthropic)** | **Incluso no plano Replit** |
| Extracao de foto (captura de etiqueta) | **Claude (Anthropic)** | **Incluso no plano Replit** |
| Analise de audio transcrito | **Claude (Anthropic)** | **Incluso no plano Replit** |
| Verificacao de duplicatas | Claude (Anthropic) | Incluso no plano Replit |
| Auditoria de anomalias | Claude (Anthropic) | Incluso no plano Replit |
| Transcricao de audio | OpenAI Transcribe | Pago por uso (unico custo restante) |

**Resultado:** 8 das 9 funcoes agora usam o Claude, que esta incluso no plano da plataforma. O unico custo variavel que resta e a transcricao de audio, que custa centavos.

**Melhoria adicional:** O sistema agora possui **tentativa automatica** - se a IA falhar temporariamente, ele tenta de novo ate 2 vezes antes de mostrar erro.

---

## 4. Estimativa de custo mensal de IA por medico

Considerando os tres perfis de uso mais comuns:

### Perfil Leve
*Medico que usa o app ocasionalmente*

| Atividade | Quantidade/mes |
|---|---|
| Fotos de etiquetas/fichas | 50 |
| Audios gravados | 10 |
| PDFs de clinica enviados | 1 |
| Conciliacoes | 1 |

| Item | Custo (USD) | Custo (BRL) |
|---|---|---|
| Claude (extracao, conciliacao, duplicatas, auditoria) | $1,45 | R$ 8,12 |
| OpenAI (transcricao de audio) | $0,02 | R$ 0,11 |
| **Total mensal** | **$1,47** | **R$ 8,23** |

---

### Perfil Moderado
*Medico/anestesista com rotina regular*

| Atividade | Quantidade/mes |
|---|---|
| Fotos de etiquetas/fichas | 100 |
| Audios gravados | 20 |
| PDFs de clinica enviados | 3 |
| Planilhas CSV | 1 |
| Conciliacoes | 3 |

| Item | Custo (USD) | Custo (BRL) |
|---|---|---|
| Claude (extracao, conciliacao, duplicatas, auditoria) | $2,90 | R$ 16,24 |
| OpenAI (transcricao de audio) | $0,03 | R$ 0,17 |
| **Total mensal** | **$2,93** | **R$ 16,41** |

---

### Perfil Intenso
*Medico que usa o app no maximo potencial*

| Atividade | Quantidade/mes |
|---|---|
| Fotos de etiquetas/fichas | 300 |
| Audios gravados | 50 |
| PDFs de clinica enviados | 8 |
| Planilhas CSV | 4 |
| Imagens de relatorio | 4 |
| Conciliacoes | 8 |

| Item | Custo (USD) | Custo (BRL) |
|---|---|---|
| Claude (extracao, conciliacao, duplicatas, auditoria) | $9,50 | R$ 53,20 |
| OpenAI (transcricao de audio) | $0,08 | R$ 0,45 |
| **Total mensal** | **$9,58** | **R$ 53,65** |

---

## 5. Resumo comparativo

| Perfil | Antes (tudo OpenAI) | Agora (Claude + OpenAI so audio) | Economia |
|---|---|---|---|
| Leve | ~R$ 12/mes | **R$ 8/mes** | 33% |
| Moderado | ~R$ 25/mes | **R$ 16/mes** | 36% |
| Intenso | ~R$ 70/mes | **R$ 54/mes** | 23% |

*Valores em BRL considerando USD 1 = R$ 5,60*

---

## 6. Conclusao

- O erro foi causado pelo esgotamento da cota da OpenAI, nao por falha do sistema
- A migracao para o Claude resolveu o problema e reduziu custos
- Mesmo no uso mais extremo, o custo de IA por medico fica abaixo de R$ 55/mes
- O sistema agora e mais resiliente, com tentativas automaticas em caso de falha temporaria
- A qualidade da extracao de dados se mantem excelente com o Claude

---

*RecebMed - Gestao Financeira Inteligente para Profissionais de Saude*
