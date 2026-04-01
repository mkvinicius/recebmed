import { storage } from "./storage";
import { runReconciliation } from "./reconciliation";
import { aiAnomalyScan, type AIAnomalyResult } from "./llm";

const POST_UPLOAD_DELAY_MS = 5 * 60 * 1000;
const INTERVAL_MS = 60 * 60 * 1000;
const SCHEDULED_HOURS_BRT = [13, 22];

let scheduledTimers: ReturnType<typeof setTimeout>[] = [];
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let auditRunning = false;
const pendingAudits = new Map<string, ReturnType<typeof setTimeout>>();

export function schedulePostUploadAudit(doctorId: string) {
  if (pendingAudits.has(doctorId)) {
    clearTimeout(pendingAudits.get(doctorId)!);
  }

  console.log(`[Audit] Agendando auditoria pós-upload para usuário ${doctorId} em ${POST_UPLOAD_DELAY_MS / 1000}s`);

  const timer = setTimeout(async () => {
    pendingAudits.delete(doctorId);
    await runUserAudit(doctorId, "post-upload");
  }, POST_UPLOAD_DELAY_MS);

  pendingAudits.set(doctorId, timer);
}

async function runUserAudit(doctorId: string, trigger: "scheduled" | "post-upload", aiEnabled = true) {
  const startedAt = new Date();
  try {
    const pending = await storage.getPendingDoctorEntries(doctorId);
    const divergent = await storage.getDivergentDoctorEntries(doctorId);
    const unmatched = await storage.getUnmatchedClinicReports(doctorId);

    if (pending.length === 0 && unmatched.length === 0) {
      await storage.createAuditLog({
        doctorId,
        triggerType: trigger,
        startedAt,
        endedAt: new Date(),
        reconciledCount: 0,
        divergentAfter: divergent.length,
        errorMessage: null,
      });

      if (trigger === "scheduled" && aiEnabled) {
        try {
          await runAIAnomalyScan(doctorId);
        } catch (scanErr) {
          console.warn(`[Audit] AI scan falhou para ${doctorId}:`, scanErr);
        }
      }
      return;
    }

    console.log(`[Audit] ${trigger}: Usuário ${doctorId} — ${pending.length} pendentes, ${divergent.length} divergentes, ${unmatched.length} não conferidos. Iniciando re-análise...`);

    const result = await runReconciliation(doctorId);

    const totalFixed = result.reconciled.length;
    const stillDivergent = result.divergent.length;
    const stillPending = result.pending.length;
    const stillUnmatched = result.unmatchedClinic.length;

    console.log(`[Audit] ${trigger}: Resultado — ${totalFixed} reconciliados, ${stillDivergent} divergentes, ${stillPending} pendentes, ${stillUnmatched} não conferidos`);

    await storage.createAuditLog({
      doctorId,
      triggerType: trigger,
      startedAt,
      endedAt: new Date(),
      reconciledCount: totalFixed,
      divergentAfter: stillDivergent,
      errorMessage: null,
    });

    if (trigger === "scheduled" && aiEnabled) {
      try {
        await runAIAnomalyScan(doctorId);
      } catch (scanErr) {
        console.warn(`[Audit] AI scan falhou para ${doctorId}:`, scanErr);
      }
    }

    if (totalFixed > 0 || (trigger === "post-upload" && (stillDivergent > 0 || stillPending > 0 || stillUnmatched > 0))) {
      let message = "";
      if (totalFixed > 0) {
        message += `${totalFixed} registros foram reconciliados automaticamente. `;
      }
      if (stillDivergent > 0) {
        message += `${stillDivergent} registros com divergência precisam de atenção. `;
      }
      if (stillPending > 0) {
        message += `${stillPending} registros ainda pendentes de conferência. `;
      }
      if (stillUnmatched > 0) {
        message += `${stillUnmatched} registros da clínica aguardam seu aceite.`;
      }

      await storage.createNotification({
        doctorId,
        type: "reconciliation",
        title: "Auditoria automática concluída",
        message: message.trim(),
        read: false,
      });
    }

    const totalRecords = totalFixed + stillDivergent + stillPending + stillUnmatched;
    if (totalRecords > 0 && stillUnmatched / totalRecords > 0.3) {
      await storage.createNotification({
        doctorId,
        type: "template_suggestion",
        title: "Alto número de registros não conferidos",
        message: `${Math.round(stillUnmatched / totalRecords * 100)}% dos registros não possuem correspondência. Considere treinar um novo template de documento na página de Extratos de Produção para melhorar a extração.`,
        read: false,
      });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Audit] Erro na auditoria do usuário ${doctorId}:`, err);
    await storage.createAuditLog({
      doctorId,
      triggerType: trigger,
      startedAt,
      endedAt: new Date(),
      reconciledCount: 0,
      divergentAfter: 0,
      errorMessage: errorMsg,
    }).catch(() => {});
  }
}

async function runScheduledAudit(silent = false) {
  if (auditRunning) {
    if (!silent) console.log("[Audit] Varredura já em andamento, pulando ciclo");
    return;
  }
  auditRunning = true;
  try {
    const userIds = await storage.getActiveUserIds();
    if (userIds.length === 0) return;

    if (!silent) console.log(`[Audit] Varredura iniciada — ${userIds.length} usuários ativos`);

    for (const doctorId of userIds) {
      if (pendingAudits.has(doctorId)) {
        continue;
      }
      const aiEnabled = await storage.isAiAuditEnabled(doctorId);
      await runUserAudit(doctorId, "scheduled", aiEnabled);
    }

    if (!silent) console.log(`[Audit] Varredura concluída`);
  } catch (err) {
    console.error("[Audit] Erro na varredura:", err);
  } finally {
    auditRunning = false;
  }
}

function getBRTNow(): Date {
  const utc = new Date();
  const brt = new Date(utc.getTime() - 3 * 60 * 60 * 1000);
  return brt;
}

function msUntilNextBRTHour(targetHour: number): number {
  const now = new Date();
  const brt = getBRTNow();
  const todayTarget = new Date(brt);
  todayTarget.setHours(targetHour, 0, 0, 0);
  const todayTargetUTC = new Date(todayTarget.getTime() + 3 * 60 * 60 * 1000);

  if (todayTargetUTC.getTime() > now.getTime()) {
    return todayTargetUTC.getTime() - now.getTime();
  }
  const tomorrowTargetUTC = new Date(todayTargetUTC.getTime() + 24 * 60 * 60 * 1000);
  return tomorrowTargetUTC.getTime() - now.getTime();
}

function scheduleNextRun(targetHour: number) {
  const ms = msUntilNextBRTHour(targetHour);
  const hours = Math.round(ms / 1000 / 60 / 60 * 10) / 10;
  console.log(`[Audit] Próxima varredura ${targetHour}:00 BRT em ${hours}h`);

  const timer = setTimeout(async () => {
    await runScheduledAudit();
    scheduleNextRun(targetHour);
  }, ms);

  scheduledTimers.push(timer);
}

export function startAuditScheduler() {
  console.log(`[Audit] Scheduler iniciado — ciclo a cada 1h + horários fixos ${SCHEDULED_HOURS_BRT.join("h e ")}h BRT + 5min pós-upload`);

  for (const hour of SCHEDULED_HOURS_BRT) {
    scheduleNextRun(hour);
  }

  intervalTimer = setInterval(() => runScheduledAudit(true), INTERVAL_MS);

  setTimeout(runScheduledAudit, 30 * 1000);
}

const anomalyScanCooldown = new Map<string, number>();
const ANOMALY_COOLDOWN_MS = 55 * 60 * 1000;

export async function runAIAnomalyScan(doctorId: string): Promise<{ scanned: boolean; anomaliesFound: number; notificationsCreated: number; findingsStored: number; reason?: string }> {
  const lastRun = anomalyScanCooldown.get(doctorId) || 0;
  if (Date.now() - lastRun < ANOMALY_COOLDOWN_MS) {
    console.log(`[AI-Scan] Cooldown ativo para ${doctorId}, ignorando`);
    return { scanned: false, anomaliesFound: 0, notificationsCreated: 0, findingsStored: 0, reason: "cooldown" };
  }

  const allEntries = await storage.getDoctorEntries(doctorId);
  if (allEntries.length < 3) {
    console.log(`[AI-Scan] Poucos lançamentos (${allEntries.length}), ignorando`);
    return { scanned: false, anomaliesFound: 0, notificationsCreated: 0, findingsStored: 0, reason: "insufficient_data" };
  }

  console.log(`[AI-Scan] Iniciando varredura inteligente para ${doctorId}`);

  const doctrine = await storage.getAdminDoctrine();

  const formatted = allEntries.map(e => ({
    id: e.id,
    patientName: e.patientName,
    procedureDate: e.procedureDate instanceof Date ? e.procedureDate.toISOString().split("T")[0] : String(e.procedureDate),
    description: e.description,
    insuranceProvider: e.insuranceProvider,
    procedureValue: e.procedureValue,
    status: e.status,
  }));

  const BATCH_SIZE = 80;
  const OVERLAP = 10;
  const allAnomalies: AIAnomalyResult["anomalies"] = [];
  let successfulBatches = 0;

  for (let i = 0; i < formatted.length; i += (BATCH_SIZE - OVERLAP)) {
    const batch = formatted.slice(i, i + BATCH_SIZE);
    if (batch.length < 2) break;
    try {
      const result = await aiAnomalyScan(batch, doctrine || undefined);
      allAnomalies.push(...result.anomalies);
      successfulBatches++;
    } catch (err) {
      console.error(`[AI-Scan] Erro no lote ${Math.floor(i / (BATCH_SIZE - OVERLAP)) + 1}:`, err);
    }
  }

  if (successfulBatches === 0) {
    console.warn(`[AI-Scan] Nenhum lote processado com sucesso para ${doctorId}`);
    return { scanned: false, anomaliesFound: 0, notificationsCreated: 0, findingsStored: 0, reason: "provider_error" };
  }

  anomalyScanCooldown.set(doctorId, Date.now());

  const seen = new Set<string>();
  const deduped = allAnomalies.filter(a => {
    const key = `${a.type}:${a.entryIds.sort().join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduped.length === 0) {
    console.log(`[AI-Scan] Nenhuma anomalia encontrada para ${doctorId}`);
    return { scanned: true, anomaliesFound: 0, notificationsCreated: 0, findingsStored: 0 };
  }

  console.log(`[AI-Scan] ${deduped.length} anomalia(s) encontrada(s) para ${doctorId}`);

  const validTypes = new Set(["duplicate", "value_outlier", "missing_data", "suspicious_pattern"]);
  const validSeverities = new Set(["high", "medium", "low"]);
  const validated = deduped.filter(a =>
    validTypes.has(a.type) &&
    validSeverities.has(a.severity) &&
    typeof a.description === "string" && a.description.length > 0 &&
    Array.isArray(a.entryIds) && a.entryIds.length > 0
  );

  if (validated.length === 0) {
    console.warn(`[AI-Scan] Todas as anomalias falharam na validação para ${doctorId}`);
    return { scanned: true, anomaliesFound: 0, notificationsCreated: 0, findingsStored: 0 };
  }

  const typeLabels: Record<string, string> = {
    duplicate: "Possível duplicata",
    value_outlier: "Valor atípico",
    missing_data: "Dados incompletos",
    suspicious_pattern: "Padrão suspeito",
  };

  const typeIcons: Record<string, string> = {
    duplicate: "🔄",
    value_outlier: "💰",
    missing_data: "⚠️",
    suspicious_pattern: "🔍",
  };

  const existingFindings = await storage.getAiAuditFindings(doctorId);
  const existingKeys = new Set(
    existingFindings.filter(f => !f.resolved).map(f => `${f.category}:${(f.entryIds || []).sort().join(",")}`)
  );

  const findingsToStore = validated
    .map(a => ({
      doctorId,
      category: a.type,
      severity: a.severity,
      title: typeLabels[a.type] || a.type,
      description: a.description,
      entryIds: a.entryIds,
      resolved: false,
    }))
    .filter(f => !existingKeys.has(`${f.category}:${f.entryIds.sort().join(",")}`));

  let findingsStored = 0;
  if (findingsToStore.length > 0) {
    try {
      const stored = await storage.createAiAuditFindings(findingsToStore);
      findingsStored = stored.length;
      console.log(`[AI-Scan] ${findingsStored} novo(s) achado(s) armazenado(s) para ${doctorId} (${validated.length - findingsToStore.length} já existentes ignorados)`);
    } catch (err) {
      console.error(`[AI-Scan] Erro ao armazenar achados:`, err);
    }
  } else {
    console.log(`[AI-Scan] ${validated.length} achado(s) já existiam como pendentes para ${doctorId}`);
  }

  try {
    await storage.clearOldFindings(doctorId);
  } catch {}

  const highSeverity = validated.filter(a => a.severity === "high");
  const otherAnomalies = validated.filter(a => a.severity !== "high");

  let notificationsCreated = 0;

  if (highSeverity.length > 0) {
    const details = highSeverity.map(a =>
      `${typeIcons[a.type] || "⚠️"} ${typeLabels[a.type] || a.type}: ${a.description} (IDs: ${a.entryIds.join(", ")})`
    ).join("\n");

    await storage.createNotification({
      doctorId,
      type: "ai_anomaly_high",
      title: `🚨 ${highSeverity.length} anomalia(s) crítica(s) detectada(s)`,
      message: `A inteligência artificial identificou problemas que precisam da sua atenção:\n\n${details}\n\nRevise os lançamentos na aba de Lançamentos ou consulte a página de Auditoria Inteligente para detalhes.`,
      read: false,
    });
    notificationsCreated++;
  }

  if (otherAnomalies.length > 0) {
    const details = otherAnomalies.map(a =>
      `${typeIcons[a.type] || "⚠️"} ${typeLabels[a.type] || a.type}: ${a.description}`
    ).join("\n");

    await storage.createNotification({
      doctorId,
      type: "ai_anomaly_info",
      title: `🔎 ${otherAnomalies.length} observação(ões) encontrada(s)`,
      message: `A IA encontrou pontos de atenção nos seus lançamentos:\n\n${details}\n\nConsulte a página de Auditoria Inteligente para ver o relatório completo.`,
      read: false,
    });
    notificationsCreated++;
  }

  return { scanned: true, anomaliesFound: validated.length, notificationsCreated, findingsStored };
}

export function stopAuditScheduler() {
  for (const timer of scheduledTimers) {
    clearTimeout(timer);
  }
  scheduledTimers = [];
  if (intervalTimer) { clearInterval(intervalTimer); intervalTimer = null; }
  for (const timer of pendingAudits.values()) {
    clearTimeout(timer);
  }
  pendingAudits.clear();
  console.log("[Audit] Scheduler parado");
}
