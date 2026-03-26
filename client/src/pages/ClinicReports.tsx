import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Trash2, Loader2, FileText, Calendar, ChevronDown, ChevronUp, File, Upload, ArrowLeft
} from "lucide-react";
import { getToken, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/lib/utils";
import DocumentTraining from "@/components/DocumentTraining";
import ReportsTabs from "@/components/ReportsTabs";

interface ClinicReport {
  id: string;
  patientName: string;
  procedureDate: string;
  reportedValue: string;
  description: string | null;
  sourcePdfUrl: string | null;
  createdAt: string;
}

interface FileGroup {
  sourceKey: string;
  label: string;
  date: string;
  records: ClinicReport[];
  totalValue: number;
}

export default function ClinicReports() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [reports, setReports] = useState<ClinicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const { toast } = useToast();


  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    fetchReports(token);
  }, [setLocation]);

  const fetchReports = async (token: string) => {
    try {
      const res = await fetch("/api/clinic-reports", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
      const data = await res.json();
      if (res.ok) setReports(data.reports || []);
    } catch {}
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("clinicReports.confirmDelete"))) return;
    const token = getToken();
    if (!token) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/clinic-reports/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== id));
        toast({ title: t("clinicReports.deleted"), description: t("clinicReports.deletedDesc") });
      } else {
        toast({ title: t("common.error"), description: t("clinicReports.deleteError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("clinicReports.connectionError"), variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  const fmtCurrency = (value: string | number) => formatCurrency(value, "—") || "—";

  const fmtDate = (dateStr: string) => formatDate(dateStr, "short");

  const fmtDateShort = (dateStr: string) => formatDate(dateStr, "medium");

  const fileGroups: FileGroup[] = useMemo(() => {
    const groups = new Map<string, ClinicReport[]>();

    reports.forEach(r => {
      const key = r.sourcePdfUrl || `manual_${r.createdAt.split("T")[0]}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });

    return Array.from(groups.entries()).map(([sourceKey, records]) => {
      const isManual = sourceKey.startsWith("manual_");
      const sortedRecords = [...records].sort((a, b) => new Date(b.procedureDate).getTime() - new Date(a.procedureDate).getTime());
      const oldestDate = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1].createdAt : new Date().toISOString();
      const totalValue = records.reduce((sum, r) => sum + parseFloat(r.reportedValue || "0"), 0);

      let label: string;
      if (isManual) {
        label = t("clinicReports.manualEntries");
      } else {
        const urlParts = sourceKey.split("/");
        const fileName = urlParts[urlParts.length - 1] || sourceKey;
        label = decodeURIComponent(fileName.replace(/^\d+_/, ""));
      }

      return { sourceKey, label, date: oldestDate, records: sortedRecords, totalValue };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reports, t]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-1 pb-4 text-white">
          <button onClick={() => setLocation("/reports")} className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-2 transition-colors md:hidden" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
            <span>{t("common.back")}</span>
          </button>
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("clinicReports.title")}</h2>
          <p className="text-white/80 text-sm mt-1">{t("clinicReports.subtitle")}</p>
        </div>
        <div className="mb-4"><ReportsTabs /></div>

        <div className="mb-4 flex items-center justify-between px-3 py-3 bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {fileGroups.length} {fileGroups.length === 1 ? t("clinicReports.fileLabel") : t("clinicReports.filesLabel")}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span className="text-sm text-slate-500 dark:text-slate-400" data-testid="text-report-count">
              {reports.length} {t("clinicReports.totalRecords")}
            </span>
          </div>
          <button
            onClick={() => setLocation("/reconciliation")}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#8855f6]/10 text-[#8855f6] text-xs font-semibold hover:bg-[#8855f6]/20 transition-colors"
            data-testid="button-upload-new"
          >
            <Upload className="w-3.5 h-3.5" /> {t("reconciliation.uploadNewFile")}
          </button>
        </div>

        <DocumentTraining />

        <div className="mb-12 space-y-3">
          {loading ? (
            <div className="card-float px-6 py-12 flex justify-center">
              <Loader2 className="w-6 h-6 text-[#8855f6] animate-spin" />
            </div>
          ) : fileGroups.length === 0 ? (
            <div className="card-float px-6 py-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">{t("clinicReports.noReports")}</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{t("clinicReports.noReportsHint")}</p>
            </div>
          ) : (
            fileGroups.map((group) => (
              <div
                key={group.sourceKey}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 overflow-hidden"
                data-testid={`file-group-${group.sourceKey.slice(0, 8)}`}
              >
                <button
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                  onClick={() => setExpandedFile(expandedFile === group.sourceKey ? null : group.sourceKey)}
                  data-testid={`button-expand-${group.sourceKey.slice(0, 8)}`}
                >
                  <div className="size-11 rounded-2xl flex items-center justify-center bg-[#8855f6]/10 text-[#8855f6] shrink-0">
                    <File className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] text-slate-800 dark:text-slate-200 truncate">
                      {group.label}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 dark:text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {fmtDateShort(group.date)}
                      </span>
                      <span>{group.records.length} {t("clinicReports.records")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      {fmtCurrency(group.totalValue)}
                    </span>
                    {expandedFile === group.sourceKey
                      ? <ChevronUp className="w-4 h-4 text-slate-400" />
                      : <ChevronDown className="w-4 h-4 text-slate-400" />
                    }
                  </div>
                </button>

                {expandedFile === group.sourceKey && (
                  <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800">
                    {group.records.map((report) => (
                      <div
                        key={report.id}
                        className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        data-testid={`report-row-${report.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate">
                            {report.patientName}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                            <span>{fmtDate(report.procedureDate)}</span>
                            {report.description && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="truncate">{report.description}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                            {fmtCurrency(report.reportedValue)}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                            disabled={deletingId === report.id}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            data-testid={`button-delete-report-${report.id}`}
                            title={t("common.delete")}
                          >
                            {deletingId === report.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
    </div>
  );
}
