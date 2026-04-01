import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Stethoscope, CheckCircle2, TrendingUp, FileUp, History
} from "lucide-react";
import { getToken, clearAuth } from "@/lib/auth";
import ErrorState from "@/components/ErrorState";
import { ReportSkeleton } from "@/components/EntrySkeleton";

export default function Reports() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);



  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    (async () => {
      setFetchError(false);
      try {
        const res = await fetch("/api/entries", { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
        if (!res.ok) setFetchError(true);
      } catch { setFetchError(true); }
      finally { setLoading(false); }
    })();
  }, [setLocation]);




  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[8rem] md:min-h-[10.5rem] flex flex-col justify-end pb-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold">{t("reports.title")}</h2>
              <p className="text-sm opacity-90">{t("reports.subtitle")}</p>
            </div>
          </div>
        </div>
        <ReportSkeleton />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[8rem] md:min-h-[10.5rem] flex flex-col justify-end pb-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold">{t("reports.title")}</h2>
              <p className="text-sm opacity-90">{t("reports.subtitle")}</p>
            </div>
          </div>
        </div>
        <div className="py-8">
          <ErrorState onRetry={() => { setLoading(true); const token = getToken(); if (token) { (async () => { setFetchError(false); try { const res = await fetch("/api/entries", { headers: { Authorization: `Bearer ${token}` } }); if (res.status === 401) { clearAuth(); setLocation("/login"); return; } const data = await res.json(); if (res.ok) setEntries(data.entries || []); else setFetchError(true); } catch { setFetchError(true); } finally { setLoading(false); } })(); } }} />
        </div>
      </div>
    );
  }



  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[8rem] md:min-h-[10.5rem] flex flex-col justify-end pb-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("reports.title")}</h2>
              <p className="text-sm opacity-90">{t("reports.subtitle")}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => setLocation("/reconciliation")}
            className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border border-slate-100/60 dark:border-slate-700/40 hover:border-[#8855f6]/40 transition-all text-left"
            data-testid="link-reconciliation"
          >
            <div className="size-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{t("reports.reconciliation")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("reports.checkPDFs")}</p>
            </div>
          </button>
          <button
            onClick={() => setLocation("/clinic-reports")}
            className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border border-slate-100/60 dark:border-slate-700/40 hover:border-[#8855f6]/40 transition-all text-left"
            data-testid="link-clinic-reports"
          >
            <div className="size-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{t("reports.clinicReports")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("reports.extractedData")}</p>
            </div>
          </button>
          <button
            onClick={() => setLocation("/import")}
            className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border border-slate-100/60 dark:border-slate-700/40 hover:border-[#8855f6]/40 transition-all text-left"
            data-testid="link-import"
          >
            <div className="size-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{t("reports.retroactiveAudit")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("reports.importHistorical")}</p>
            </div>
          </button>
          <button
            onClick={() => setLocation("/reports/history")}
            className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border border-slate-100/60 dark:border-slate-700/40 hover:border-[#8855f6]/40 transition-all text-left"
            data-testid="link-report-history"
          >
            <div className="size-10 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{t("reportHistory.title")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("reportHistory.subtitle")}</p>
            </div>
          </button>
        </div>

    </div>
  );
}