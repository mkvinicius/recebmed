import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  X, Loader2, AlertTriangle, CheckCircle2,
  User, Calendar, Building2, FileText, DollarSign,
  ArrowLeft, Save, Camera, Mic
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

interface DoctorEntry {
  id: string;
  patientName: string;
  procedureDate: string;
  insuranceProvider: string;
  description: string;
  procedureValue: string | null;
  entryMethod: string;
  status: string;
  createdAt: string;
  matchedReportId?: string | null;
  divergenceReason?: string | null;
  sourceUrl?: string | null;
}

interface ClinicReport {
  id: string;
  patientName: string;
  procedureDate: string;
  insuranceProvider: string | null;
  description: string | null;
  reportedValue: string;
}

interface DivergencyModalProps {
  entry: DoctorEntry;
  onClose: () => void;
  onResolved: (updatedEntry: DoctorEntry) => void;
}

export default function DivergencyModal({ entry, onClose, onResolved }: DivergencyModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clinicReport, setClinicReport] = useState<ClinicReport | null>(null);
  const [divergenceReason, setDivergenceReason] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    patientName: entry.patientName,
    procedureDate: entry.procedureDate ? new Date(entry.procedureDate).toISOString().split("T")[0] : "",
    insuranceProvider: entry.insuranceProvider,
    description: entry.description,
    procedureValue: entry.procedureValue || "",
  });

  useEffect(() => {
    const fetchDivergence = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`/api/entries/${entry.id}/divergence`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setClinicReport(data.clinicReport);
          setDivergenceReason(data.divergenceReason);
        }
      } catch {}
      finally { setLoading(false); }
    };
    fetchDivergence();
  }, [entry.id]);

  const fmtDate = (dateStr: string | null | undefined) => formatDate(dateStr);

  const saveEntry = async (data: Record<string, any>) => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, status: "reconciled" }),
      });
      const result = await res.json();
      if (res.ok) {
        onResolved({ ...entry, ...result.entry });
        toast({ title: t("common.success"), description: t("dashboard.updatedDesc") });
      } else {
        toast({ title: t("common.error"), description: result.message, variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("dashboard.updateFailed"), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const acceptDoctor = () => {
    saveEntry({
      patientName: entry.patientName,
      procedureDate: entry.procedureDate ? new Date(entry.procedureDate).toISOString().split("T")[0] : "",
      insuranceProvider: entry.insuranceProvider,
      description: entry.description,
      procedureValue: entry.procedureValue || "",
    });
  };

  const acceptClinic = () => {
    if (!clinicReport) return;
    saveEntry({
      patientName: clinicReport.patientName,
      procedureDate: clinicReport.procedureDate ? new Date(clinicReport.procedureDate).toISOString().split("T")[0] : "",
      insuranceProvider: clinicReport.insuranceProvider || entry.insuranceProvider,
      description: clinicReport.description || entry.description,
      procedureValue: clinicReport.reportedValue || "",
    });
  };

  const confirmManual = () => {
    saveEntry(manualForm);
  };

  const differs = (doctorVal: string | null | undefined, clinicVal: string | null | undefined): boolean => {
    const a = (doctorVal || "").toString().toLowerCase().trim();
    const b = (clinicVal || "").toString().toLowerCase().trim();
    if (!a && !b) return false;
    return a !== b;
  };

  const diffClass = (isDiff: boolean) =>
    isDiff ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "border-slate-100 dark:border-slate-700/50";

  const diffBadge = (isDiff: boolean) =>
    isDiff ? (
      <span className="text-[10px] font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full ml-auto flex-shrink-0">
        {t("divergency.fieldDiffers")}
      </span>
    ) : null;

  if (showManual) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowManual(false); }} data-testid="modal-manual-validation">
        <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col animate-in slide-in-from-bottom duration-300 sm:mx-4">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowManual(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" data-testid="button-back-to-divergency" aria-label={t("common.goBack")}>
                <ArrowLeft className="w-4 h-4 text-slate-500" />
              </button>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t("divergency.manualTitle")}</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" data-testid="button-close-manual" aria-label={t("common.close")}>
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("divergency.manualDesc")}</p>
            <div className="space-y-1.5">
              <label htmlFor="manual-patient-name" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><User className="w-3.5 h-3.5 text-[#8855f6]" /> {t("common.patient")}</label>
              <input id="manual-patient-name" value={manualForm.patientName} onChange={e => setManualForm(f => ({ ...f, patientName: e.target.value }))} className="w-full h-11 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8855f6]/30" data-testid="manual-patient-name" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="manual-procedure-date" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><Calendar className="w-3.5 h-3.5 text-[#8855f6]" /> {t("common.date")}</label>
              <input id="manual-procedure-date" type="date" value={manualForm.procedureDate} onChange={e => setManualForm(f => ({ ...f, procedureDate: e.target.value }))} className="w-full h-11 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8855f6]/30" data-testid="manual-procedure-date" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="manual-insurance" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><Building2 className="w-3.5 h-3.5 text-[#8855f6]" /> {t("common.insurance")}</label>
              <input id="manual-insurance" value={manualForm.insuranceProvider} onChange={e => setManualForm(f => ({ ...f, insuranceProvider: e.target.value }))} className="w-full h-11 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8855f6]/30" data-testid="manual-insurance" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="manual-description" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><FileText className="w-3.5 h-3.5 text-[#8855f6]" /> {t("common.procedure")}</label>
              <input id="manual-description" value={manualForm.description} onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))} className="w-full h-11 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8855f6]/30" data-testid="manual-description" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="manual-value" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><DollarSign className="w-3.5 h-3.5 text-[#8855f6]" /> {t("common.value")}</label>
              <input id="manual-value" type="number" step="0.01" min="0" value={manualForm.procedureValue} onChange={e => setManualForm(f => ({ ...f, procedureValue: e.target.value }))} placeholder="0.00" className="w-full h-11 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8855f6]/30" data-testid="manual-value" />
            </div>
            {entry.sourceUrl && (entry.entryMethod === "photo" || entry.entryMethod === "audio") && (
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                  {entry.entryMethod === "photo" ? <Camera className="w-3.5 h-3.5 text-[#8855f6]" /> : <Mic className="w-3.5 h-3.5 text-[#8855f6]" />}
                  {t("entryDetail.originalEvidence")}
                </label>
                {entry.entryMethod === "audio" ? (
                  <audio controls className="w-full" data-testid="manual-evidence-audio">
                    <source src={entry.sourceUrl} />
                  </audio>
                ) : (
                  <img
                    src={entry.sourceUrl}
                    alt={t("entryDetail.originalEvidence")}
                    className="w-full max-h-48 object-contain rounded-xl border border-slate-200 dark:border-slate-700"
                    data-testid="manual-evidence-image"
                  />
                )}
              </div>
            )}
          </div>
          <div className="px-6 pt-3 pb-24 sm:pb-4 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
            <button onClick={confirmManual} disabled={saving} className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50" data-testid="button-confirm-manual">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> {t("divergency.confirmManual")}</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }} data-testid="modal-divergency">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[85dvh] sm:max-h-[90dvh] flex flex-col animate-in slide-in-from-bottom duration-300 sm:mx-4">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5 text-red-500 dark:text-red-400" />
            </div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t("divergency.title")}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" data-testid="button-close-divergency" aria-label={t("common.close")}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="space-y-4 py-4">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
              </div>
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mt-4" />
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
              </div>
            </div>
          ) : (
            <>
              {divergenceReason && (
                <div className="mb-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">{t("divergency.reason")}</p>
                  <p className="text-sm text-amber-600 dark:text-amber-300">{divergenceReason}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold text-[#8855f6] uppercase tracking-wider mb-3">{t("divergency.doctorData")}</h4>
                  <div className="space-y-2">
                    {[
                      { icon: <User className="w-3.5 h-3.5" />, label: t("common.patient"), value: entry.patientName, clinicValue: clinicReport?.patientName },
                      { icon: <Calendar className="w-3.5 h-3.5" />, label: t("common.date"), value: fmtDate(entry.procedureDate), clinicValue: clinicReport ? fmtDate(clinicReport.procedureDate) : undefined },
                      { icon: <Building2 className="w-3.5 h-3.5" />, label: t("common.insurance"), value: entry.insuranceProvider, clinicValue: clinicReport?.insuranceProvider },
                      { icon: <FileText className="w-3.5 h-3.5" />, label: t("common.procedure"), value: entry.description, clinicValue: clinicReport?.description },
                      { icon: <DollarSign className="w-3.5 h-3.5" />, label: t("common.value"), value: entry.procedureValue || "—", clinicValue: clinicReport?.reportedValue },
                    ].map((field, i) => {
                      const isDiff = clinicReport ? differs(field.value, field.clinicValue) : false;
                      return (
                        <div key={i} className={`px-3 py-2.5 rounded-xl border ${diffClass(isDiff)}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[#8855f6]">{field.icon}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</span>
                            {diffBadge(isDiff)}
                          </div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" data-testid={`doctor-field-${i}`}>{field.value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{t("divergency.clinicData")}</h4>
                  {clinicReport ? (
                    <div className="space-y-2">
                      {[
                        { icon: <User className="w-3.5 h-3.5" />, label: t("common.patient"), value: clinicReport.patientName, doctorValue: entry.patientName },
                        { icon: <Calendar className="w-3.5 h-3.5" />, label: t("common.date"), value: fmtDate(clinicReport.procedureDate), doctorValue: fmtDate(entry.procedureDate) },
                        { icon: <Building2 className="w-3.5 h-3.5" />, label: t("common.insurance"), value: clinicReport.insuranceProvider || "—", doctorValue: entry.insuranceProvider },
                        { icon: <FileText className="w-3.5 h-3.5" />, label: t("common.procedure"), value: clinicReport.description || "—", doctorValue: entry.description },
                        { icon: <DollarSign className="w-3.5 h-3.5" />, label: t("common.value"), value: clinicReport.reportedValue || "—", doctorValue: entry.procedureValue || "—" },
                      ].map((field, i) => {
                        const isDiff = differs(field.value, field.doctorValue);
                        return (
                          <div key={i} className={`px-3 py-2.5 rounded-xl border ${diffClass(isDiff)}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-slate-400">{field.icon}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{field.label}</span>
                              {diffBadge(isDiff)}
                            </div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" data-testid={`clinic-field-${i}`}>{field.value}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-slate-400 dark:text-slate-500">{t("divergency.noClinicData")}</p>
                    </div>
                  )}
                </div>
              </div>

              {entry.sourceUrl && (entry.entryMethod === "photo" || entry.entryMethod === "audio") && (
                <div className="mt-4 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    {entry.entryMethod === "photo" ? <Camera className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {t("entryDetail.originalEvidence")}
                  </p>
                  {entry.entryMethod === "audio" ? (
                    <audio controls className="w-full" data-testid="divergency-evidence-audio">
                      <source src={entry.sourceUrl} />
                    </audio>
                  ) : (
                    <img
                      src={entry.sourceUrl}
                      alt={t("entryDetail.originalEvidence")}
                      className="w-full max-h-40 object-contain rounded-lg"
                      data-testid="divergency-evidence-image"
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 pt-3 pb-24 sm:pb-4 border-t border-slate-100 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-900 sm:rounded-b-2xl">
          <div className="flex flex-col gap-2">
            <button onClick={acceptDoctor} disabled={saving || loading} className="w-full h-11 bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50" data-testid="button-accept-doctor">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> {t("divergency.acceptDoctor")}</>}
            </button>
            <button onClick={acceptClinic} disabled={saving || loading || !clinicReport} className="w-full h-11 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50" data-testid="button-accept-clinic">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> {t("divergency.acceptClinic")}</>}
            </button>
            <button onClick={() => setShowManual(true)} disabled={loading} className="w-full h-11 border-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 active:scale-[0.97] disabled:opacity-50" data-testid="button-manual-validation">
              <Save className="w-4 h-4" /> {t("divergency.manualValidation")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
