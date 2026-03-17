import { storage } from "./storage";
import { runReconciliation } from "./reconciliation";

const POST_UPLOAD_DELAY_MS = 5 * 60 * 1000;
const SCHEDULED_HOURS_BRT = [13, 22];

let scheduledTimers: ReturnType<typeof setTimeout>[] = [];
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

    if (pending.length === 0 && divergent.length === 0) {
      await storage.createAuditLog({
        doctorId,
        triggerType: trigger,
        startedAt,
        endedAt: new Date(),
        reconciledCount: 0,
        divergentAfter: 0,
        errorMessage: null,
      });
      return;
    }

    console.log(`[Audit] ${trigger}: Usuário ${doctorId} — ${pending.length} pendentes, ${divergent.length} divergentes. Iniciando re-análise...`);

    if (divergent.length > 0) {
      const resets: Array<{ id: string; status: string; matchedReportId?: string | null; divergenceReason?: string | null }> = divergent.map(e => ({
        id: e.id,
        status: "pending",
        matchedReportId: null,
        divergenceReason: null,
      }));
      await storage.batchUpdateDoctorEntryStatus(resets);
      console.log(`[Audit] ${divergent.length} entradas divergentes resetadas para pendente para re-análise`);
    }

    const result = await runReconciliation(doctorId);

    const totalFixed = result.reconciled.length;
    const stillDivergent = result.divergent.length;
    const stillPending = result.pending.length;

    console.log(`[Audit] ${trigger}: Resultado — ${totalFixed} reconciliados, ${stillDivergent} divergentes, ${stillPending} pendentes`);

    await storage.createAuditLog({
      doctorId,
      triggerType: trigger,
      startedAt,
      endedAt: new Date(),
      reconciledCount: totalFixed,
      divergentAfter: stillDivergent,
      errorMessage: null,
    });

    if (totalFixed > 0 || (trigger === "post-upload" && (stillDivergent > 0 || stillPending > 0))) {
      let message = "";
      if (totalFixed > 0) {
        message += `${totalFixed} registros foram reconciliados automaticamente. `;
      }
      if (stillDivergent > 0) {
        message += `${stillDivergent} registros com divergência precisam de atenção. `;
      }
      if (stillPending > 0) {
        message += `${stillPending} registros ainda pendentes de conferência.`;
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

async function runScheduledAudit() {
  try {
    const userIds = await storage.getActiveUserIds();
    if (userIds.length === 0) return;

    console.log(`[Audit] Varredura agendada iniciada — ${userIds.length} usuários ativos`);

    for (const doctorId of userIds) {
      if (pendingAudits.has(doctorId)) {
        console.log(`[Audit] Pulando usuário ${doctorId} — auditoria pós-upload já agendada`);
        continue;
      }
      await runUserAudit(doctorId, "scheduled");
    }

    console.log(`[Audit] Varredura agendada concluída`);
  } catch (err) {
    console.error("[Audit] Erro na varredura agendada:", err);
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
  console.log(`[Audit] Scheduler iniciado — varreduras diárias às ${SCHEDULED_HOURS_BRT.join("h e ")}h BRT + 5min pós-upload`);

  for (const hour of SCHEDULED_HOURS_BRT) {
    scheduleNextRun(hour);
  }

  setTimeout(runScheduledAudit, 30 * 1000);
}

export function stopAuditScheduler() {
  for (const timer of scheduledTimers) {
    clearTimeout(timer);
  }
  scheduledTimers = [];
  for (const timer of pendingAudits.values()) {
    clearTimeout(timer);
  }
  pendingAudits.clear();
  console.log("[Audit] Scheduler parado");
}
