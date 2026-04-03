import { useEffect, useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Trash2, Loader2, FileText, Calendar, ChevronDown, ChevronUp, File, Upload, ArrowLeft, Pencil, Check, X
} from "lucide-react";
import { getToken, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/lib/utils";

interface ClinicReport {
  id: string;
  patientName: string;
  procedureDate: string;
  reportedValue: string;
  description: string | null;
  sourcePdfUrl: string | null;
  createdAt: string;
}

interface UploadedReport {
  id: string;
  fileName: string;
  customName: string | null;
  originalFileUrl: string;
  extractedRecordCount: number;
  uploadDate: string;
}

interface MonthGroup {
  monthKey: string;
  label: string;
  files: FileItem[];
}

interface FileItem {
  uploadedReport: UploadedReport;
  records: ClinicReport[];
  totalValue: number;
}

export default function ClinicReports() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [reports, setReports] = useState<ClinicReport[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    fetchAll(token);
  }, [setLocation]);

  const fetchAll = async (token: string) => {
    try {
      const [reportsRes, filesRes] = await Promise.all([
        fetch("/api/clinic-reports", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/uploaded-reports", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (reportsRes.status === 401 || filesRes.status === 401) { clearAuth(); setLocation("/login"); return; }
      const reportsData = await reportsRes.json();
      const filesData = await filesRes.json();
      if (reportsRes.ok) setReports(reportsData.reports || []);
      if (filesRes.ok) setUploadedFiles(filesData.reports || []);
    } catch {}
    finally { setLoading(false); }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!window.confirm(t("clinicReports.confirmDeleteFile"))) return;
    const token = getToken();
    if (!token) return;
    setDeletingId(fileId);
    try {
      const res = await fetch(`/api/uploaded-reports/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const deleted = uploadedFiles.find(f => f.id === fileId);
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
        if (deleted) {
          setReports(prev => prev.filter(r => r.sourcePdfUrl !== deleted.originalFileUrl));
        }
        toast({ title: t("clinicReports.deleted"), description: t("clinicReports.deletedDesc") });
      } else {
        toast({ title: t("common.error"), description: t("clinicReports.deleteError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("clinicReports.connectionError"), variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  const startEditing = (file: UploadedReport) => {
    setEditingId(file.id);
    setEditName(file.customName || file.fileName);
    setTimeout(() => editInputRef.current?.select(), 50);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveRename = async (fileId: string) => {
    if (!editName.trim()) return;
    const token = getToken();
    if (!token) return;
    setSavingName(true);
    try {
      const res = await fetch(`/api/uploaded-reports/${fileId}/rename`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ customName: editName.trim() }),
      });
      if (res.ok) {
        setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, customName: editName.trim() } : f));
        toast({ title: t("clinicReports.renamed") });
      } else {
        toast({ title: t("common.error"), description: t("clinicReports.connectionError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("clinicReports.connectionError"), variant: "destructive" });
    }
    finally {
      setSavingName(false);
      setEditingId(null);
    }
  };

  const fmtCurrency = (value: string | number) => formatCurrency(value, "—") || "—";
  const fmtDate = (dateStr: string) => formatDate(dateStr, "short");
  const fmtDateShort = (dateStr: string) => formatDate(dateStr, "medium");

  const formatMonthLabel = (dateStr: string) => {
    const date = new Date(dateStr + "-15");
    return date.toLocaleDateString(i18n.language === "pt-BR" ? "pt-BR" : i18n.language, { month: "long", year: "numeric" });
  };

  const monthGroups: MonthGroup[] = useMemo(() => {
    const uploadedUrls = new Set(uploadedFiles.map(uf => uf.originalFileUrl));
    const reportsByUrl = new Map<string, ClinicReport[]>();
    const orphanReports: ClinicReport[] = [];
    reports.forEach(r => {
      const key = r.sourcePdfUrl || "";
      if (!key || !uploadedUrls.has(key)) {
        orphanReports.push(r);
      } else {
        if (!reportsByUrl.has(key)) reportsByUrl.set(key, []);
        reportsByUrl.get(key)!.push(r);
      }
    });

    const fileItems: FileItem[] = uploadedFiles.map(uf => {
      const records = reportsByUrl.get(uf.originalFileUrl) || [];
      const sortedRecords = [...records].sort((a, b) => new Date(b.procedureDate).getTime() - new Date(a.procedureDate).getTime());
      const totalValue = records.reduce((sum, r) => sum + parseFloat(r.reportedValue || "0"), 0);
      return { uploadedReport: uf, records: sortedRecords, totalValue };
    });

    const monthMap = new Map<string, FileItem[]>();
    fileItems.forEach(fi => {
      const d = new Date(fi.uploadedReport.uploadDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(key)) monthMap.set(key, []);
      monthMap.get(key)!.push(fi);
    });

    if (orphanReports.length > 0) {
      const orphanByMonth = new Map<string, ClinicReport[]>();
      orphanReports.forEach(r => {
        const d = new Date(r.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!orphanByMonth.has(key)) orphanByMonth.set(key, []);
        orphanByMonth.get(key)!.push(r);
      });
      orphanByMonth.forEach((records, monthKey) => {
        const sorted = [...records].sort((a, b) => new Date(b.procedureDate).getTime() - new Date(a.procedureDate).getTime());
        const totalValue = sorted.reduce((sum, r) => sum + parseFloat(r.reportedValue || "0"), 0);
        const manualFile: FileItem = {
          uploadedReport: {
            id: `manual-${monthKey}`,
            fileName: t("clinicReports.manualEntries"),
            customName: null,
            originalFileUrl: "",
            extractedRecordCount: sorted.length,
            uploadDate: `${monthKey}-01T00:00:00Z`,
          },
          records: sorted,
          totalValue,
        };
        if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
        monthMap.get(monthKey)!.push(manualFile);
      });
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([monthKey, files]) => ({
        monthKey,
        label: formatMonthLabel(monthKey),
        files: files.sort((a, b) => new Date(b.uploadedReport.uploadDate).getTime() - new Date(a.uploadedReport.uploadDate).getTime()),
      }));
  }, [reports, uploadedFiles, i18n.language, t]);

  const totalFiles = uploadedFiles.length;
  const totalRecords = reports.length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[8rem] md:min-h-[10.5rem] flex flex-col justify-end pb-6 text-white">
          <button onClick={() => setLocation("/reports")} className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-2 transition-colors md:hidden" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
            <span>{t("common.back")}</span>
          </button>
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("clinicReports.title")}</h2>
          <p className="text-white/80 text-sm mt-1">{t("clinicReports.subtitle")}</p>
        </div>

        <div className="h-10" />

        <div className="mb-4 flex items-center justify-between px-3 py-3 bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {totalFiles} {totalFiles === 1 ? t("clinicReports.fileLabel") : t("clinicReports.filesLabel")}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span className="text-sm text-slate-500 dark:text-slate-400" data-testid="text-report-count">
              {totalRecords} {t("clinicReports.totalRecords")}
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

        <div className="mb-12 space-y-6 mt-2">
          {loading ? (
            <div className="card-float px-6 py-12 flex justify-center">
              <Loader2 className="w-6 h-6 text-[#8855f6] animate-spin" />
            </div>
          ) : monthGroups.length === 0 ? (
            <div className="card-float px-6 py-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">{t("clinicReports.noReports")}</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{t("clinicReports.noReportsHint")}</p>
            </div>
          ) : (
            monthGroups.map((month) => (
              <div key={month.monthKey}>
                <div className="flex items-center gap-3 mb-3 px-1">
                  <Calendar className="w-4 h-4 text-[#8855f6]" />
                  <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 capitalize" data-testid={`month-label-${month.monthKey}`}>
                    {month.label}
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {month.files.length} {month.files.length === 1 ? t("clinicReports.fileLabel") : t("clinicReports.filesLabel")}
                  </span>
                </div>

                <div className="space-y-3">
                  {month.files.map((file) => {
                    const uf = file.uploadedReport;
                    const displayName = uf.customName || uf.fileName;
                    const isExpanded = expandedFile === uf.id;
                    const isEditing = editingId === uf.id;
                    const isManual = uf.id.startsWith("manual-");

                    return (
                      <div
                        key={uf.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 overflow-hidden"
                        data-testid={`file-group-${uf.id}`}
                      >
                        <div className="w-full px-5 py-4 flex items-center gap-4 text-left">
                          <div className="size-11 rounded-2xl flex items-center justify-center bg-[#8855f6]/10 text-[#8855f6] shrink-0">
                            <File className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  ref={editInputRef}
                                  value={editName}
                                  onChange={e => setEditName(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") saveRename(uf.id); if (e.key === "Escape") cancelEditing(); }}
                                  className="flex-1 min-w-0 px-2 py-1 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-[#8855f6]/40 rounded-lg outline-none focus:ring-2 focus:ring-[#8855f6]/30"
                                  data-testid={`input-rename-${uf.id}`}
                                />
                                <button onClick={() => saveRename(uf.id)} disabled={savingName} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg" data-testid={`button-save-rename-${uf.id}`}>
                                  {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button onClick={cancelEditing} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg" data-testid={`button-cancel-rename-${uf.id}`}>
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <p className="font-bold text-[15px] text-slate-800 dark:text-slate-200 truncate">
                                  {displayName}
                                </p>
                                {!isManual && (
                                  <button
                                    onClick={e => { e.stopPropagation(); startEditing(uf); }}
                                    className="p-1 text-slate-300 dark:text-slate-600 hover:text-[#8855f6] hover:bg-[#8855f6]/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    data-testid={`button-rename-${uf.id}`}
                                    title={t("clinicReports.rename")}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 dark:text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {fmtDateShort(uf.uploadDate)}
                              </span>
                              <span>{file.records.length} {t("clinicReports.records")}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-bold text-green-600 dark:text-green-400">
                              {fmtCurrency(file.totalValue)}
                            </span>
                            {!isManual && (
                              <button
                                onClick={e => { e.stopPropagation(); handleDeleteFile(uf.id); }}
                                disabled={deletingId === uf.id}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                data-testid={`button-delete-file-${uf.id}`}
                                title={t("common.delete")}
                              >
                                {deletingId === uf.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedFile(isExpanded ? null : uf.id)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
                              data-testid={`button-expand-${uf.id}`}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && file.records.length > 0 && (
                          <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800">
                            {file.records.map((report) => (
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
                                <span className="text-sm font-semibold text-green-600 dark:text-green-400 shrink-0 ml-3">
                                  {fmtCurrency(report.reportedValue)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {isExpanded && file.records.length === 0 && (
                          <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-4 text-center text-sm text-slate-400">
                            {t("clinicReports.noRecordsInFile")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
    </div>
  );
}
