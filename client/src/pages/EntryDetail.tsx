import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowLeft, User, Calendar, Building2, FileText, DollarSign, Clock, AlertCircle, Camera, Mic, PenLine, Loader2, Stethoscope, ShieldCheck } from "lucide-react";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import { formatDate, formatCurrency } from "@/lib/utils";
import { statusBadgeStyle, StatusIconDetail } from "@/lib/status";

interface EntryData {
  id: string;
  patientName: string;
  procedureDate: string;
  insuranceProvider: string;
  description: string;
  procedureValue: string | null;
  entryMethod: string;
  sourceUrl: string | null;
  status: string;
  createdAt: string;
}

export default function EntryDetail() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const [entry, setEntry] = useState<EntryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    fetchEntry(token);
  }, [params.id]);

  const fetchEntry = async (token: string) => {
    try {
      const res = await fetch(`/api/entries/${params.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
      const data = await res.json();
      if (res.ok) setEntry(data.entry);
      else setError(data.message || t("entryDetail.fetchError"));
    } catch {
      setError(t("common.serverConnectionFailed"));
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (s: string) => s === "reconciled" ? t("common.reconciled") : s === "divergent" ? t("common.divergent") : t("common.pending");
  const methodIcon = (m: string) => m === "photo" ? <Camera className="w-4 h-4" /> : m === "audio" ? <Mic className="w-4 h-4" /> : <PenLine className="w-4 h-4" />;
  const methodLabel = (m: string) => m === "photo" ? t("entryDetail.photoAI") : m === "audio" ? t("entryDetail.audioAI") : t("common.manual");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-[#8855f6] animate-spin" data-testid="loading-spinner" />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] text-center mt-8">
            <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium" data-testid="text-error">{error || t("entryDetail.notFound")}</p>
          </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="pt-2 pb-8 text-white">
          <h2 className="text-2xl font-extrabold">{t("entryDetail.title")}</h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden mt-4">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`size-10 rounded-full flex items-center justify-center ${statusBadgeStyle(entry.status)}`}>
                <StatusIconDetail status={entry.status} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100" data-testid="text-entry-description">{entry.description}</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500">ID: {entry.id.slice(0, 8)}...</p>
              </div>
            </div>
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${statusBadgeStyle(entry.status)}`} data-testid="text-entry-status">
              {statusLabel(entry.status)}
            </span>
          </div>

          {entry.sourceUrl && (entry.entryMethod === "photo" || entry.entryMethod === "audio") && (
            <div className="mx-6 mt-6 rounded-2xl border-2 border-[#8855f6]/20 bg-gradient-to-br from-[#8855f6]/5 to-transparent dark:from-[#8855f6]/10 overflow-hidden" data-testid="section-evidence">
              <div className="flex items-center gap-2.5 px-5 py-3 bg-[#8855f6]/10 dark:bg-[#8855f6]/20 border-b border-[#8855f6]/10">
                <ShieldCheck className="w-5 h-5 text-[#8855f6]" />
                <div>
                  <h3 className="text-sm font-bold text-[#8855f6]">{t("entryDetail.originalEvidence")}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("entryDetail.evidenceDesc")}</p>
                </div>
              </div>
              <div className="p-4">
                {entry.entryMethod === "audio" ? (
                  <audio controls className="w-full" data-testid="audio-source">
                    <source src={entry.sourceUrl} />
                  </audio>
                ) : (
                  <img
                    src={entry.sourceUrl}
                    alt={t("entryDetail.sourceImage")}
                    className="w-full rounded-xl object-contain max-h-[28rem] shadow-[0_4px_20px_-4px_rgba(136,85,246,0.2)]"
                    data-testid="img-source"
                  />
                )}
              </div>
            </div>
          )}

          <div className="px-6 py-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  <User className="w-4 h-4 text-[#8855f6]" /> {t("common.patient")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-patient-name">{entry.patientName}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  <Calendar className="w-4 h-4 text-[#8855f6]" /> {t("entryDetail.procedureDate")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-procedure-date">{formatDate(entry.procedureDate, "long")}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  <Building2 className="w-4 h-4 text-[#8855f6]" /> {t("common.insurance")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-insurance">{entry.insuranceProvider}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  <DollarSign className="w-4 h-4 text-[#8855f6]" /> {t("entryDetail.value")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-procedure-value">
                  {formatCurrency(entry.procedureValue) || t("entryDetail.notProvided")}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  <FileText className="w-4 h-4 text-[#8855f6]" /> {t("common.procedure")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-description">{entry.description}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  {methodIcon(entry.entryMethod)} {t("entryDetail.entryMethod")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-entry-method">{methodLabel(entry.entryMethod)}</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                <Clock className="w-4 h-4 text-[#8855f6]" /> {t("entryDetail.registeredAt")}
              </div>
              <p className="text-slate-800 dark:text-slate-100 font-medium" data-testid="text-created-at">
                {formatDate(entry.createdAt, "datetime")}
              </p>
            </div>

          </div>
        </div>
    </div>
  );
}
