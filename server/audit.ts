import { storage } from "./storage";
import { runReconciliation } from "./reconciliation";

const POST_UPLOAD_DELAY_MS = 5 * 60 * 1000;
const INTERVAL_MS = 15 * 60 * 1000;
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

async function runUserAudit(doctorId: string, trigger: "scheduled" | "post-upload") {
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
      await runUserAudit(doctorId, "scheduled");
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
  console.log(`[Audit] Scheduler iniciado — ciclo a cada 15min + horários fixos ${SCHEDULED_HOURS_BRT.join("h e ")}h BRT + 5min pós-upload`);

  for (const hour of SCHEDULED_HOURS_BRT) {
    scheduleNextRun(hour);
  }

  intervalTimer = setInterval(() => runScheduledAudit(true), INTERVAL_MS);

  setTimeout(runScheduledAudit, 30 * 1000);
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
