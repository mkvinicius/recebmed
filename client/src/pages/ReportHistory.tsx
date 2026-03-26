import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { FileText, Loader2, Calendar, Hash, ExternalLink, ArrowLeft } from "lucide-react";
import { getToken, clearAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import ReportsTabs from "@/components/ReportsTabs";

interface UploadedReport {
  id: string;
  fileName: string;
  originalFileUrl: string;
  extractedRecordCount: number;
  uploadDate: string;
}

export default function ReportHistory() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [reports, setReports] = useState<UploadedReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    fetch("/api/uploaded-reports", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
        const data = await res.json();
        if (res.ok) setReports(data.reports);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (dateStr: string) => formatDate(dateStr, "datetime");

  const fileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "csv") return "📊";
    if (ext === "pdf") return "📄";
    return "🖼️";
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-4"><ReportsTabs /></div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#8855f6] animate-spin" data-testid="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <div className="pt-2 pb-6 text-white">
        <button onClick={() => setLocation("/reports")} className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-2 transition-colors md:hidden" data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
          <span>{t("common.back")}</span>
        </button>
        <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("reportHistory.title")}</h2>
        <p className="text-white/80 text-sm mt-1">{t("reportHistory.subtitle")}</p>
      </div>
      <div className="mb-4"><ReportsTabs /></div>

      {reports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 shadow-card border border-slate-100/60 dark:border-slate-700/40 text-center">
          <FileText className="w-14 h-14 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-semibold text-lg" data-testid="text-empty">{t("reportHistory.empty")}</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">{t("reportHistory.emptyDesc")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 p-5 flex items-center gap-4"
              data-testid={`card-report-${report.id}`}
            >
              <div className="size-12 rounded-xl bg-[#8855f6]/10 dark:bg-[#8855f6]/20 flex items-center justify-center text-2xl shrink-0">
                {fileIcon(report.fileName)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate" data-testid={`text-filename-${report.id}`}>
                  {report.fileName}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#8855f6]" />
                    {fmtDate(report.uploadDate)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-[#8855f6]" />
                    {t("reportHistory.records", { count: report.extractedRecordCount })}
                  </span>
                </div>
              </div>

              <a
                href={report.originalFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8855f6] hover:bg-[#7744e4] text-white font-semibold text-sm transition-colors"
                data-testid={`link-download-${report.id}`}
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">{t("reportHistory.download")}</span>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
