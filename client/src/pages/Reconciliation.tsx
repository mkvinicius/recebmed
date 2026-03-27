import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronUp, Stethoscope, Image, Table, Download, HelpCircle,
  Share2, Mail, MessageCircle, FileDown, ClipboardCheck, CircleDollarSign, Ban,
  UserPlus, CheckCheck, BarChart3, ArrowLeft, CalendarDays, X
} from "lucide-react";
import { getToken, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatCurrency } from "@/lib/utils";
import DivergencyModal from "@/components/DivergencyModal";
import ReportsTabs from "@/components/ReportsTabs";

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "text/csv", "application/vnd.ms-excel",
];
const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.csv";

interface EntryResult {
  id: string;
  patientName: string;
  procedureDate: string;
  procedureValue: string | null;
  description: string;
  insuranceProvider: string;
  status: string;
  entryMethod?: string;
  createdAt?: string;
  matchedReportId?: string | null;
  divergenceReason?: string | null;
  sourceUrl?: string | null;
}

interface UnmatchedClinicReport {
  reportId?: string;
  id?: string;
  patientName: string;
  procedureDate: string;
  reportValue?: string;
  reportedValue?: string;
  insuranceProvider?: string | null;
  procedureName?: string | null;
}

interface ReconciliationResults {
  reconciled: EntryResult[];
  divergent: EntryResult[];
  pending: EntryResult[];
  unmatchedClinic?: UnmatchedClinicReport[];
}

export default function Reconciliation() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ReconciliationResults | null>(null);
  const [activeTab, setActiveTab] = useState<"total" | "verified" | "received" | "divergent" | "pending" | "unmatched">("verified");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [uploadCollapsed, setUploadCollapsed] = useState(false);
  const [divergencyEntry, setDivergencyEntry] = useState<EntryResult | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [isReReconciling, setIsReReconciling] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [exportDateFrom, setExportDateFrom] = useState<string>("");
  const [exportDateTo, setExportDateTo] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const locale = getLocale();


  const getDaysAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  };

  const fmtCurrency = (val: string | number | null | undefined) => formatCurrency(val, "—");

  const fmtDate = (dateStr: string) => formatDate(dateStr, "short");

  const filterByExportDate = useCallback(<T extends { procedureDate: string }>(entries: T[]): T[] => {
    if (!exportDateFrom && !exportDateTo) return entries;
    return entries.filter(e => {
      const d = e.procedureDate?.slice(0, 10);
      if (!d) return true;
      if (exportDateFrom && d < exportDateFrom) return false;
      if (exportDateTo && d > exportDateTo) return false;
      return true;
    });
  }, [exportDateFrom, exportDateTo]);

  const getFileType = (file: File): "pdf" | "image" | "csv" | null => {
    if (file.type === "application/pdf") return "pdf";
    if (file.type.startsWith("image/")) return "image";
    if (file.type === "text/csv" || file.type === "application/vnd.ms-excel" || file.name.endsWith(".csv")) return "csv";
    return null;
  };

  const processFile = useCallback(async (file: File) => {
    const fileType = getFileType(file);
    if (!fileType) {
      toast({ title: t("common.error"), description: t("reconciliation.unsupportedFormat"), variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({ title: t("common.error"), description: t("reconciliation.fileTooLarge", { max: MAX_FILE_SIZE_MB }), variant: "destructive" });
      return;
    }
    setFileName(file.name);
    setIsProcessing(true);
    setResults(null);

    const token = getToken();
    if (!token) { clearAuth(); setLocation("/login"); return; }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await fetch("/api/reconciliation/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ file: base64, fileType, fileName: file.name, ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}) }),
          });
          if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
          const data = await res.json();
          if (data.success && data.reconciliation) {
            setResults(data.reconciliation);
            setUploadCollapsed(true);
            toast({ title: t("reconciliation.completed"), description: t("reconciliation.extractedCount", { count: data.extractedCount }) });
          } else {
            toast({ title: t("common.error"), description: data.message || t("reconciliation.processingError"), variant: "destructive" });
          }
        } catch {
          toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsProcessing(false);
      toast({ title: t("common.error"), description: t("reconciliation.readError"), variant: "destructive" });
    }
  }, [toast, setLocation, t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const loadResults = useCallback(async () => {
    const token = getToken();
    if (!token) { setInitialLoading(false); return; }
    try {
      const res = await fetch("/api/reconciliation/results", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
      if (res.ok) {
        const data = await res.json();
        if (data && (data.reconciled?.length || data.divergent?.length || data.pending?.length)) {
          setResults(data);
          setUploadCollapsed(true);
        }
      }
    } catch {}
    finally { setInitialLoading(false); }
  }, [setLocation]);

  useEffect(() => { loadResults(); }, [loadResults]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/document-templates", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.templates) setTemplates(data.templates); })
      .catch(() => {});
  }, []);

  const verifiedCount = (results?.reconciled?.length || 0) + (results?.divergent?.length || 0);
  const unmatchedCount = results?.unmatchedClinic?.length || 0;
  const totalCount = (results?.reconciled?.length || 0) + (results?.divergent?.length || 0) + (results?.pending?.length || 0);
  const tabs = [
    { key: "total" as const, label: t("reconciliation.totalTab"), icon: BarChart3, color: "text-slate-700 dark:text-slate-200", bg: "bg-slate-100 dark:bg-slate-800", border: "border-slate-300 dark:border-slate-600", count: totalCount },
    { key: "verified" as const, label: t("reconciliation.verifiedTab"), icon: ClipboardCheck, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30", border: "border-blue-200 dark:border-blue-800", count: verifiedCount },
    { key: "received" as const, label: t("reconciliation.receivedTab"), icon: CircleDollarSign, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/30", border: "border-green-200 dark:border-green-800", count: results?.reconciled?.length || 0 },
    { key: "divergent" as const, label: t("reconciliation.divergentTab"), icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/30", border: "border-amber-200 dark:border-amber-800", count: results?.divergent?.length || 0 },
    { key: "pending" as const, label: t("reconciliation.pendingTab"), icon: Clock, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/30", border: "border-red-200 dark:border-red-800", count: results?.pending?.length || 0 },
    ...(unmatchedCount > 0 ? [{ key: "unmatched" as const, label: t("reconciliation.unmatchedTab"), icon: UserPlus, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/30", border: "border-purple-200 dark:border-purple-800", count: unmatchedCount }] : []),
  ];

  const activeEntries = results ? (
    activeTab === "total" ? [...(results.reconciled || []), ...(results.divergent || []), ...(results.pending || [])] :
    activeTab === "verified" ? [...(results.reconciled || []), ...(results.divergent || [])] :
    activeTab === "received" ? results.reconciled || [] :
    activeTab === "divergent" ? results.divergent || [] :
    activeTab === "pending" ? results.pending || [] :
    []
  ) : [];

  const getReportId = (r: UnmatchedClinicReport) => r.reportId || r.id || "";
  const getReportValue = (r: UnmatchedClinicReport) => r.reportValue || r.reportedValue || "0";

  const handleAcceptClinicReport = async (rid: string) => {
    const token = getToken();
    if (!token) return;
    setAcceptingId(rid);
    try {
      const res = await fetch("/api/entries/accept-clinic-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportId: rid }),
      });
      if (res.ok) {
        setResults(prev => prev ? { ...prev, unmatchedClinic: prev.unmatchedClinic?.filter(r => getReportId(r) !== rid) } : prev);
        toast({ title: t("reconciliation.acceptedTitle"), description: t("reconciliation.acceptedDesc") });
      }
    } catch {
      toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } finally { setAcceptingId(null); }
  };

  const handleAcceptAll = async () => {
    const token = getToken();
    if (!token || !results?.unmatchedClinic?.length) return;
    setAcceptingAll(true);
    const ids = results.unmatchedClinic.map(r => getReportId(r));
    try {
      const res = await fetch("/api/entries/accept-clinic-reports-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportIds: ids }),
      });
      if (res.ok) {
        const data = await res.json();
        const acceptedIds = new Set(data.acceptedIds || ids);
        setResults(prev => prev ? { ...prev, unmatchedClinic: prev.unmatchedClinic?.filter(r => !acceptedIds.has(getReportId(r))) } : prev);
        toast({ title: t("reconciliation.allAcceptedTitle"), description: t("reconciliation.allAcceptedDesc", { count: data.accepted }) });
      }
    } catch {
      toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } finally { setAcceptingAll(false); }
  };

  const handleReReconcile = async () => {
    const token = getToken();
    if (!token) return;
    setIsReReconciling(true);
    try {
      const res = await fetch("/api/reconciliation/re-reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
      if (res.ok) {
        const data = await res.json();
        setResults(data.reconciliation);
        toast({ title: t("reconciliation.reReconcileCompleteTitle"), description: t("reconciliation.reReconcileCompleteDesc", { count: data.resetCount }) });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: t("common.error"), description: data.message || t("reconciliation.processingError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } finally { setIsReReconciling(false); }
  };

  const generateReportHTML = useCallback(() => {
    if (!results) return "";
    const now = new Date();
    const dateStr = now.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const renderSection = (title: string, entries: EntryResult[], color: string) => {
      if (!entries || entries.length === 0) return "";
      const isDivergent = entries.some(e => e.status === "divergent");
      const rows = entries.map(e => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${e.patientName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${fmtDate(e.procedureDate)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${e.insuranceProvider || "—"}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmtCurrency(e.procedureValue)}</td>
          ${isDivergent ? `<td style="padding:8px;border-bottom:1px solid #eee;color:#d97706;font-size:11px;">${e.divergenceReason || "—"}</td>` : ""}
        </tr>
      `).join("");
      return `
        <h3 style="color:${color};margin:20px 0 8px;font-size:14px;">${title} (${entries.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f8f9fa;">
            <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">${t("common.patient")}</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">${t("common.date")}</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">${t("common.insurance")}</th>
            <th style="padding:8px;text-align:right;border-bottom:2px solid #dee2e6;">${t("common.value")}</th>
            ${isDivergent ? `<th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">${t("reconciliation.divergenceReason")}</th>` : ""}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    };

    const tabLabelMap: Record<string, string> = {
      total: t("reconciliation.totalTab"),
      verified: t("reconciliation.verifiedTab"),
      received: t("reconciliation.receivedTab"),
      divergent: t("reconciliation.divergentTab"),
      pending: t("reconciliation.pendingTab"),
      unmatched: t("reconciliation.unmatchedTab"),
    };

    const reportTitle = tabLabelMap[activeTab] || t("reconciliation.title");

    const sections = activeTab === "total" ? [
      { title: t("reconciliation.receivedTab"), entries: filterByExportDate(results.reconciled), color: "#16a34a" },
      { title: t("reconciliation.divergentTab"), entries: filterByExportDate(results.divergent), color: "#d97706" },
      { title: t("reconciliation.pendingTab"), entries: filterByExportDate(results.pending), color: "#ef4444" },
    ] : activeTab === "unmatched" ? [
      { title: t("reconciliation.unmatchedTab"), entries: filterByExportDate((results.unmatchedClinic || []).map((r: any) => ({ patientName: r.patientName, procedureDate: r.procedureDate, insuranceProvider: r.insuranceProvider, procedureValue: r.reportValue || r.reportedValue || "0" }))), color: "#9333ea" },
    ] : activeTab === "verified" ? [
      { title: t("reconciliation.receivedTab"), entries: filterByExportDate(results.reconciled), color: "#16a34a" },
      { title: t("reconciliation.divergentTab"), entries: filterByExportDate(results.divergent), color: "#d97706" },
    ] : activeTab === "received" ? [
      { title: t("reconciliation.receivedTab"), entries: filterByExportDate(results.reconciled), color: "#16a34a" },
    ] : activeTab === "divergent" ? [
      { title: t("reconciliation.divergentTab"), entries: filterByExportDate(results.divergent), color: "#d97706" },
    ] : activeTab === "pending" ? [
      { title: t("reconciliation.pendingTab"), entries: filterByExportDate(results.pending), color: "#ef4444" },
    ] : [];

    const sectionCount = sections.reduce((sum, s) => sum + (s.entries?.length || 0), 0);

    const periodLabel = (exportDateFrom || exportDateTo) ? t("reconciliation.exportFiltered", {
      from: exportDateFrom ? fmtDate(exportDateFrom) : "—",
      to: exportDateTo ? fmtDate(exportDateTo) : "—"
    }) : "";

    return `
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>RecebMed — ${reportTitle}</title>
      <style>body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#333;max-width:800px;margin:0 auto;}
      @media print{body{padding:10px;}}</style></head><body>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="width:40px;height:40px;background:#8855f6;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px;">R</div>
        <div><h1 style="margin:0;font-size:20px;color:#8855f6;">RecebMed</h1>
        <p style="margin:0;font-size:12px;color:#888;">${reportTitle} — ${sectionCount} ${t("common.records")} — ${dateStr}</p>
        ${periodLabel ? `<p style="margin:2px 0 0;font-size:11px;color:#8855f6;font-weight:600;">${periodLabel}</p>` : ""}
        </div>
      </div>
      ${sections.map(s => renderSection(s.title, s.entries, s.color)).join("")}
      <p style="margin-top:30px;text-align:center;font-size:10px;color:#aaa;">${t("reconciliation.generatedBy")}</p>
      </body></html>
    `;
  }, [results, locale, t, fmtCurrency, fmtDate, activeTab, filterByExportDate, exportDateFrom, exportDateTo]);

  const generateTextSummary = useCallback(() => {
    if (!results) return "";
    const lines: string[] = [];

    const tabLabelMap: Record<string, string> = {
      total: t("reconciliation.totalTab"),
      verified: t("reconciliation.verifiedTab"),
      received: t("reconciliation.receivedTab"),
      divergent: t("reconciliation.divergentTab"),
      pending: t("reconciliation.pendingTab"),
      unmatched: t("reconciliation.unmatchedTab"),
    };
    const reportTitle = tabLabelMap[activeTab] || t("reconciliation.title");
    lines.push(`📊 *RecebMed — ${reportTitle}*`);
    lines.push("");

    const addSection = (emoji: string, title: string, entries: EntryResult[]) => {
      if (!entries || entries.length === 0) return;
      lines.push(`${emoji} *${title} (${entries.length}):*`);
      entries.forEach(e => {
        let line = `  • ${e.patientName} — ${fmtDate(e.procedureDate)} — ${fmtCurrency(e.procedureValue)}`;
        if (e.status === "divergent" && e.divergenceReason) {
          line += ` ⚠️ ${e.divergenceReason}`;
        }
        lines.push(line);
      });
      lines.push("");
    };

    if (exportDateFrom || exportDateTo) {
      const periodLabel = t("reconciliation.exportFiltered", {
        from: exportDateFrom ? fmtDate(exportDateFrom) : "—",
        to: exportDateTo ? fmtDate(exportDateTo) : "—"
      });
      lines.push(`📅 ${periodLabel}`);
      lines.push("");
    }

    if (activeTab === "total") {
      addSection("✅", t("reconciliation.receivedTab"), filterByExportDate(results.reconciled));
      addSection("⚠️", t("reconciliation.divergentTab"), filterByExportDate(results.divergent));
      addSection("🔴", t("reconciliation.pendingTab"), filterByExportDate(results.pending));
    } else if (activeTab === "unmatched") {
      const unmatchedEntries = filterByExportDate((results.unmatchedClinic || []).map((r: any) => ({ patientName: r.patientName, procedureDate: r.procedureDate, insuranceProvider: r.insuranceProvider, procedureValue: r.reportValue || r.reportedValue || "0" })));
      addSection("🟣", t("reconciliation.unmatchedTab"), unmatchedEntries);
    } else if (activeTab === "verified") {
      addSection("✅", t("reconciliation.receivedTab"), filterByExportDate(results.reconciled));
      addSection("⚠️", t("reconciliation.divergentTab"), filterByExportDate(results.divergent));
    } else if (activeTab === "received") {
      addSection("✅", t("reconciliation.receivedTab"), filterByExportDate(results.reconciled));
    } else if (activeTab === "divergent") {
      addSection("⚠️", t("reconciliation.divergentTab"), filterByExportDate(results.divergent));
    } else if (activeTab === "pending") {
      addSection("🔴", t("reconciliation.pendingTab"), filterByExportDate(results.pending));
    }

    lines.push(`📱 ${t("reconciliation.generatedBy")}`);
    return lines.join("\n");
  }, [results, t, fmtCurrency, fmtDate, activeTab, filterByExportDate, exportDateFrom, exportDateTo]);

  const handleDownloadPDF = useCallback(() => {
    const html = generateReportHTML();
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  }, [generateReportHTML]);

  const handleShareWhatsApp = useCallback(() => {
    const text = generateTextSummary();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }, [generateTextSummary]);

  const handleShareEmail = useCallback(() => {
    const text = generateTextSummary();
    const subject = `RecebMed — ${t("reconciliation.title")}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, "_blank");
  }, [generateTextSummary, t]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[8rem] md:min-h-[10.5rem] flex flex-col justify-end pb-6 text-white">
          <button onClick={() => setLocation("/reports")} className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-2 transition-colors md:hidden" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
            <span>{t("common.back")}</span>
          </button>
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("reconciliation.title")}</h2>
          <p className="text-white/80 mt-1 text-sm">{t("reconciliation.subtitle")}</p>
        </div>
        <div className="relative z-20 -mt-6 mb-4"><ReportsTabs /></div>

        {initialLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 mb-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-[#8855f6] animate-spin" />
              <p className="text-sm text-slate-400">{t("common.loading")}</p>
            </div>
          </div>
        ) : (!uploadCollapsed || !results) ? (
          <div
            className={`bg-white dark:bg-slate-900 rounded-2xl shadow-card border-2 border-dashed p-8 mb-4 text-center transition-all cursor-pointer ${isDragging ? "border-[#8855f6] bg-[#8855f6]/5 dark:bg-[#8855f6]/10 scale-[1.02]" : "border-slate-200 dark:border-slate-700 hover:border-[#8855f6]/40"}`}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="dropzone-pdf"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-file-upload"
            />
            {isProcessing ? (
              <div className="flex flex-col items-center gap-4 w-full max-w-xs mx-auto">
                <Loader2 className="w-12 h-12 text-[#8855f6] animate-spin" />
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200" data-testid="text-processing">{t("reconciliation.processing")}</p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-[#8855f6] rounded-full animate-pulse" style={{ width: "75%", transition: "width 2s ease" }} />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("reconciliation.processingDesc")}</p>
                {fileName && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{fileName}</p>}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="size-16 bg-[#8855f6]/10 rounded-2xl flex items-center justify-center">
                  <Upload className="w-8 h-8 text-[#8855f6]" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200" data-testid="text-upload-prompt">{t("reconciliation.dragOrClick")}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("reconciliation.fileSupport")}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-semibold">
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-semibold">
                    <Image className="w-3.5 h-3.5" /> {t("reconciliation.photo")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 text-xs font-semibold">
                    <Table className="w-3.5 h-3.5" /> CSV
                  </span>
                </div>
                {templates.length > 0 && (
                  <div className="mt-2 w-full max-w-xs" onClick={e => e.stopPropagation()}>
                    <select
                      value={selectedTemplateId}
                      onChange={e => setSelectedTemplateId(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-2 focus:ring-2 focus:ring-[#8855f6]/30 focus:border-[#8855f6]"
                      data-testid="select-template"
                    >
                      <option value="">{t("reconciliation.autoDetect")}</option>
                      {templates.map(tmpl => (
                        <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">{t("reconciliation.maxSize", { max: MAX_FILE_SIZE_MB })}</p>
                {fileName && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t("reconciliation.lastFile", { name: fileName })}</p>}
                <Button className="mt-2 bg-[#8855f6] text-white rounded-full px-6 font-bold shadow-lg shadow-[#8855f6]/30 hover:bg-[#7744e0]" data-testid="button-select-file">
                  <Upload className="w-4 h-4 mr-2" /> {t("reconciliation.selectFile")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#8855f6]/40 p-4 mb-4 text-center transition-all cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="dropzone-pdf-compact"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-file-upload"
            />
            <div className="flex items-center justify-center gap-3">
              <div className="size-10 bg-[#8855f6]/10 rounded-xl flex items-center justify-center">
                <Upload className="w-5 h-5 text-[#8855f6]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("reconciliation.uploadNewFile")}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">PDF, {t("reconciliation.photo")}, CSV</p>
              </div>
            </div>
          </div>
        )}

        {results && ((results.divergent?.length || 0) > 0 || (results.pending?.length || 0) > 0) && (
          <div className="flex justify-center mb-4">
            <button
              onClick={handleReReconcile}
              disabled={isReReconciling}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 text-sm font-semibold hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors border border-amber-200 dark:border-amber-800 shadow-sm disabled:opacity-50"
              data-testid="button-re-reconcile"
            >
              {isReReconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
              {t("reconciliation.reReconcile")}
            </button>
          </div>
        )}

        {(!uploadCollapsed || !results) && (
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <button
              onClick={() => window.open("/api/reconciliation/csv-template", "_blank")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-semibold hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors border border-green-200 dark:border-green-800"
              data-testid="button-download-csv-template"
            >
              <Download className="w-4 h-4" />
              {t("reconciliation.downloadTemplate")}
            </button>
            <button
              onClick={() => setShowTutorial(!showTutorial)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800"
              data-testid="button-toggle-tutorial"
            >
              <HelpCircle className="w-4 h-4" />
              {t("reconciliation.csvTutorialTitle")}
              {showTutorial ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {showTutorial && (!uploadCollapsed || !results) && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-blue-100 dark:border-blue-800 p-5 mb-6" data-testid="section-csv-tutorial">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Table className="w-5 h-5 text-green-600" />
              {t("reconciliation.csvTutorialTitle")}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{t("reconciliation.csvTutorialIntro")}</p>

            <div className="space-y-3 mb-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("reconciliation.csvColumns")}</p>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { col: t("reconciliation.colPatient"), desc: t("reconciliation.colPatientDesc"), required: true },
                  { col: t("reconciliation.colDate"), desc: t("reconciliation.colDateDesc"), required: true },
                  { col: t("reconciliation.colInsurance"), desc: t("reconciliation.colInsuranceDesc"), required: false },
                  { col: t("reconciliation.colProcedure"), desc: t("reconciliation.colProcedureDesc"), required: false },
                  { col: t("reconciliation.colValue"), desc: t("reconciliation.colValueDesc"), required: false },
                ].map((item) => (
                  <div key={item.col} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                    <code className="text-xs font-bold text-[#8855f6] bg-[#8855f6]/10 px-2 py-0.5 rounded whitespace-nowrap">{item.col}</code>
                    <span className="text-xs text-slate-600 dark:text-slate-400 flex-1">{item.desc}</span>
                    {item.required && <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">{t("reconciliation.required")}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-4 mb-4 overflow-x-auto">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t("reconciliation.csvExample")}</p>
              <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre">
{`paciente;data;convenio;procedimento;valor
João Silva;01/03/2026;Unimed;Consulta;250.00
Maria Santos;05/03/2026;Particular;Retorno;180.50
Pedro Oliveira;10/03/2026;SulAmérica;Sleeve;1500.00`}
              </pre>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("reconciliation.csvTips")}</p>
              <ul className="space-y-1.5">
                {[
                  t("reconciliation.csvTip1"),
                  t("reconciliation.csvTip2"),
                  t("reconciliation.csvTip3"),
                  t("reconciliation.csvTip4"),
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {results && (
          <div className="space-y-4 pb-12" data-testid="section-results">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 p-4 mb-4">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">{t("reconciliation.exportReport")}</p>

              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <CalendarDays className="w-3.5 h-3.5 text-[#8855f6]" />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t("reconciliation.exportFrom")}</span>
                <input
                  type="date"
                  value={exportDateFrom}
                  max={exportDateTo || undefined}
                  onChange={(e) => setExportDateFrom(e.target.value)}
                  className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 cursor-pointer w-auto min-w-[120px]"
                  data-testid="input-export-date-from"
                />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t("reconciliation.exportTo")}</span>
                <input
                  type="date"
                  value={exportDateTo}
                  min={exportDateFrom || undefined}
                  onChange={(e) => setExportDateTo(e.target.value)}
                  className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 cursor-pointer w-auto min-w-[120px]"
                  data-testid="input-export-date-to"
                />
                {(exportDateFrom || exportDateTo) && (
                  <button
                    onClick={() => { setExportDateFrom(""); setExportDateTo(""); }}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                    data-testid="button-clear-export-dates"
                    aria-label={t("reconciliation.exportAllPeriod")}
                  >
                    <X className="w-3 h-3" />
                    {t("common.clear")}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleDownloadPDF}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-200 dark:border-red-800"
                  data-testid="button-export-pdf"
                >
                  <FileDown className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">{t("reconciliation.downloadPDF")}</span>
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors border border-green-200 dark:border-green-800"
                  data-testid="button-share-whatsapp"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">WhatsApp</span>
                </button>
                <button
                  onClick={handleShareEmail}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800"
                  data-testid="button-share-email"
                >
                  <Mail className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">E-mail</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all ${activeTab === tab.key ? `${tab.bg} ${tab.border} shadow-sm` : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"}`}
                  data-testid={`tab-${tab.key}`}
                >
                  <tab.icon className={`w-5 h-5 ${activeTab === tab.key ? tab.color : "text-slate-400 dark:text-slate-500"}`} />
                  <span className={`text-xl font-extrabold ${activeTab === tab.key ? tab.color : "text-slate-700 dark:text-slate-300"}`} data-testid={`count-${tab.key}`}>{tab.count}</span>
                  <span className={`text-[10px] font-semibold leading-tight text-center ${activeTab === tab.key ? tab.color : "text-slate-500 dark:text-slate-400"}`}>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3" data-testid={`list-${activeTab}`}>
              {activeTab === "unmatched" ? (
                <>
                  {results?.unmatchedClinic && results.unmatchedClinic.length > 0 && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-200 dark:border-purple-800 mb-3">
                      <div className="flex items-start gap-3">
                        <UserPlus className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">{t("reconciliation.unmatchedExplanation")}</p>
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{t("reconciliation.unmatchedHint")}</p>
                        </div>
                        <button
                          onClick={handleAcceptAll}
                          disabled={acceptingAll}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                          data-testid="button-accept-all"
                        >
                          {acceptingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                          {t("reconciliation.acceptAll")}
                        </button>
                      </div>
                    </div>
                  )}
                  {(results?.unmatchedClinic || []).length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 p-8 text-center">
                      <p className="text-slate-400 text-sm">{t("reconciliation.noUnmatched")}</p>
                    </div>
                  ) : (
                    (results?.unmatchedClinic || []).map(report => {
                      const rid = getReportId(report);
                      return (
                      <div key={rid} className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-purple-200 dark:border-purple-800 p-4" data-testid={`unmatched-card-${rid}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{report.patientName}</p>
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                              <span>{fmtDate(report.procedureDate)}</span>
                              <span className="text-slate-300 dark:text-slate-600">•</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">{fmtCurrency(getReportValue(report))}</span>
                              {report.insuranceProvider && (
                                <>
                                  <span className="text-slate-300 dark:text-slate-600">•</span>
                                  <span>{report.insuranceProvider}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAcceptClinicReport(rid)}
                            disabled={acceptingId === rid}
                            className="ml-3 px-3 py-1.5 rounded-xl bg-[#8855f6] text-white text-xs font-bold hover:bg-[#7744e0] transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                            data-testid={`button-accept-${rid}`}
                          >
                            {acceptingId === rid ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            {t("reconciliation.acceptEntry")}
                          </button>
                        </div>
                      </div>
                      );
                    }))
                  }
                </>
              ) : activeEntries.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 p-8 text-center">
                  <p className="text-slate-400 dark:text-slate-500 text-sm" data-testid="text-empty">{t("reconciliation.noEntriesInCategory")}</p>
                </div>
              ) : (
                activeEntries.map(entry => (
                  <div
                    key={entry.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl shadow-card border transition-all ${(activeTab === "divergent" || activeTab === "verified") ? "hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer" : ""} ${entry.status === "divergent" ? "border-amber-200 dark:border-amber-800" : "border-slate-100/70 dark:border-slate-700/50"}`}
                    onClick={() => {
                      if (entry.status === "divergent") {
                        setDivergencyEntry(entry);
                      } else if (activeTab === "verified") {
                        setExpandedEntry(expandedEntry === entry.id ? null : entry.id);
                      }
                    }}
                    data-testid={`entry-card-${entry.id}`}
                  >
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate" data-testid={`text-patient-${entry.id}`}>{entry.patientName}</p>
                          {(activeTab === "divergent" || (activeTab === "verified" && entry.status === "divergent")) && (
                            expandedEntry === entry.id ? <ChevronUp className="w-4 h-4 text-amber-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          {entry.status === "pending" && entry.createdAt && getDaysAgo(entry.createdAt) >= 7 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 shrink-0 flex items-center gap-1" data-testid={`aging-badge-${entry.id}`}>
                              <Clock className="w-3 h-3" />
                              {t("reconciliation.agingDays", { days: getDaysAgo(entry.createdAt) })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                          <span data-testid={`text-date-${entry.id}`}>{fmtDate(entry.procedureDate)}</span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300" data-testid={`text-value-${entry.id}`}>{fmtCurrency(entry.procedureValue)}</span>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${entry.status === "reconciled" || entry.status === "validated" ? "bg-green-50 dark:bg-green-900/30 text-green-600" : entry.status === "divergent" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600" : "bg-red-50 dark:bg-red-900/30 text-red-500"}`} data-testid={`badge-status-${entry.id}`}>
                        {entry.status === "reconciled" || entry.status === "validated" ? t("reconciliation.receivedTab") : entry.status === "divergent" ? t("reconciliation.divergentTab") : t("reconciliation.pendingTab")}
                      </div>
                    </div>
                    {(activeTab === "divergent" || (activeTab === "verified" && entry.status === "divergent")) && expandedEntry === entry.id && (
                      <div className="px-4 pb-4 border-t border-amber-100 dark:border-amber-800 pt-3" data-testid={`detail-${entry.id}`}>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{t("common.insurance")}</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">{entry.insuranceProvider}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{t("common.procedure")}</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">{entry.description}</p>
                          </div>
                        </div>
                        {entry.divergenceReason && (
                          <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-0.5">{t("reconciliation.divergenceReason")}</p>
                            <p className="text-sm text-amber-600 dark:text-amber-300">{entry.divergenceReason}</p>
                          </div>
                        )}
                        {!entry.divergenceReason && <p className="mt-3 text-xs text-amber-600 font-semibold">{t("reconciliation.dataDiffers")}</p>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!results && !isProcessing && !initialLoading && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 p-8 text-center mb-8">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium" data-testid="text-no-results">{t("reconciliation.sendPDF")}</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{t("reconciliation.resultsAfterProcessing")}</p>
          </div>
        )}

        {initialLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#8855f6] animate-spin" />
          </div>
        )}

        {divergencyEntry && (
          <DivergencyModal
            entry={{
              ...divergencyEntry,
              entryMethod: divergencyEntry.entryMethod || "manual",
              createdAt: divergencyEntry.createdAt || new Date().toISOString(),
            }}
            onClose={() => setDivergencyEntry(null)}
            onResolved={() => {
              setDivergencyEntry(null);
              loadResults();
            }}
          />
        )}
    </div>
  );
}