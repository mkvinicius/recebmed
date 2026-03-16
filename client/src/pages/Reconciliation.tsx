import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronUp, Stethoscope, Image, Table, Download, HelpCircle,
  Share2, Mail, MessageCircle, FileDown, ClipboardCheck, CircleDollarSign, Ban
} from "lucide-react";
import { getToken, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getLocale, getCurrencyCode } from "@/lib/i18n";

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
}

interface ReconciliationResults {
  reconciled: EntryResult[];
  divergent: EntryResult[];
  pending: EntryResult[];
}

export default function Reconciliation() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ReconciliationResults | null>(null);
  const [activeTab, setActiveTab] = useState<"verified" | "received" | "divergent" | "pending">("verified");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const locale = getLocale();
  const currency = getCurrencyCode();

  const formatCurrency = (val: string | number | null | undefined) => {
    if (!val) return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return "—";
    return num.toLocaleString(locale, { style: "currency", currency });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  };

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
            body: JSON.stringify({ file: base64, fileType, fileName: file.name }),
          });
          if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
          const data = await res.json();
          if (data.success && data.reconciliation) {
            setResults(data.reconciliation);
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
    if (!token) return;
    try {
      const res = await fetch("/api/reconciliation/results", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {}
  }, []);

  const verifiedCount = (results?.reconciled?.length || 0) + (results?.divergent?.length || 0);
  const tabs = [
    { key: "verified" as const, label: t("reconciliation.verifiedTab"), icon: ClipboardCheck, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30", border: "border-blue-200 dark:border-blue-800", count: verifiedCount },
    { key: "received" as const, label: t("reconciliation.receivedTab"), icon: CircleDollarSign, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/30", border: "border-green-200 dark:border-green-800", count: results?.reconciled?.length || 0 },
    { key: "divergent" as const, label: t("reconciliation.divergentTab"), icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/30", border: "border-amber-200 dark:border-amber-800", count: results?.divergent?.length || 0 },
    { key: "pending" as const, label: t("reconciliation.pendingTab"), icon: Clock, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/30", border: "border-red-200 dark:border-red-800", count: results?.pending?.length || 0 },
  ];

  const activeEntries = results ? (
    activeTab === "verified" ? [...(results.reconciled || []), ...(results.divergent || [])] :
    activeTab === "received" ? results.reconciled || [] :
    activeTab === "divergent" ? results.divergent || [] :
    results.pending || []
  ) : [];

  const generateReportHTML = useCallback(() => {
    if (!results) return "";
    const totalEntries = (results.reconciled?.length || 0) + (results.divergent?.length || 0) + (results.pending?.length || 0);
    const now = new Date();
    const dateStr = now.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const renderSection = (title: string, entries: EntryResult[], color: string) => {
      if (!entries || entries.length === 0) return "";
      const rows = entries.map(e => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${e.patientName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${formatDate(e.procedureDate)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${e.insuranceProvider || "—"}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(e.procedureValue)}</td>
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
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    };

    return `
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>RecebMed — ${t("reconciliation.title")}</title>
      <style>body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#333;max-width:800px;margin:0 auto;}
      @media print{body{padding:10px;}}</style></head><body>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="width:40px;height:40px;background:#8855f6;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px;">R</div>
        <div><h1 style="margin:0;font-size:20px;color:#8855f6;">RecebMed</h1>
        <p style="margin:0;font-size:12px;color:#888;">${t("reconciliation.title")} — ${dateStr}</p></div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        <div style="flex:1;min-width:120px;background:#eff6ff;padding:12px;border-radius:8px;text-align:center;">
          <div style="font-size:22px;font-weight:bold;color:#2563eb;">${(results.reconciled?.length || 0) + (results.divergent?.length || 0)}</div>
          <div style="font-size:11px;color:#2563eb;">${t("reconciliation.verifiedTab")}</div>
        </div>
        <div style="flex:1;min-width:120px;background:#f0fdf4;padding:12px;border-radius:8px;text-align:center;">
          <div style="font-size:22px;font-weight:bold;color:#16a34a;">${results.reconciled?.length || 0}</div>
          <div style="font-size:11px;color:#16a34a;">${t("reconciliation.receivedTab")}</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fffbeb;padding:12px;border-radius:8px;text-align:center;">
          <div style="font-size:22px;font-weight:bold;color:#d97706;">${results.divergent?.length || 0}</div>
          <div style="font-size:11px;color:#d97706;">${t("reconciliation.divergentTab")}</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fef2f2;padding:12px;border-radius:8px;text-align:center;">
          <div style="font-size:22px;font-weight:bold;color:#ef4444;">${results.pending?.length || 0}</div>
          <div style="font-size:11px;color:#ef4444;">${t("reconciliation.pendingTab")}</div>
        </div>
      </div>
      ${renderSection(t("reconciliation.receivedTab"), results.reconciled, "#16a34a")}
      ${renderSection(t("reconciliation.divergentTab"), results.divergent, "#d97706")}
      ${renderSection(t("reconciliation.pendingTab"), results.pending, "#ef4444")}
      <p style="margin-top:30px;text-align:center;font-size:10px;color:#aaa;">${t("reconciliation.generatedBy")}</p>
      </body></html>
    `;
  }, [results, locale, t, formatCurrency, formatDate]);

  const generateTextSummary = useCallback(() => {
    if (!results) return "";
    const lines: string[] = [];
    lines.push(`📊 *RecebMed — ${t("reconciliation.title")}*`);
    lines.push("");
    lines.push(`📋 ${t("reconciliation.verifiedTab")}: ${(results.reconciled?.length || 0) + (results.divergent?.length || 0)}`);
    lines.push(`✅ ${t("reconciliation.receivedTab")}: ${results.reconciled?.length || 0}`);
    lines.push(`⚠️ ${t("reconciliation.divergentTab")}: ${results.divergent?.length || 0}`);
    lines.push(`🔴 ${t("reconciliation.pendingTab")}: ${results.pending?.length || 0}`);
    lines.push("");

    const addSection = (emoji: string, title: string, entries: EntryResult[]) => {
      if (!entries || entries.length === 0) return;
      lines.push(`${emoji} *${title}:*`);
      entries.forEach(e => {
        lines.push(`  • ${e.patientName} — ${formatDate(e.procedureDate)} — ${formatCurrency(e.procedureValue)}`);
      });
      lines.push("");
    };

    addSection("✅", t("reconciliation.receivedTab"), results.reconciled);
    addSection("⚠️", t("reconciliation.divergentTab"), results.divergent);
    addSection("🔴", t("reconciliation.pendingTab"), results.pending);

    lines.push(`📱 ${t("reconciliation.generatedBy")}`);
    return lines.join("\n");
  }, [results, t, formatCurrency, formatDate]);

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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-1 pb-4 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("reconciliation.title")}</h2>
          <p className="text-white/80 mt-1 text-sm">{t("reconciliation.subtitle")}</p>
        </div>

        <div
          className={`bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] border-2 border-dashed p-8 mb-6 text-center transition-all cursor-pointer ${isDragging ? "border-[#8855f6] bg-[#8855f6]/5 dark:bg-[#8855f6]/10 scale-[1.02]" : "border-slate-200 dark:border-slate-700 hover:border-[#8855f6]/40"}`}
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
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-12 h-12 text-[#8855f6] animate-spin" />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200" data-testid="text-processing">{t("reconciliation.processing")}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("reconciliation.processingDesc")}</p>
              {fileName && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{fileName}</p>}
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
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("reconciliation.maxSize", { max: MAX_FILE_SIZE_MB })}</p>
              {fileName && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t("reconciliation.lastFile", { name: fileName })}</p>}
              <Button className="mt-2 bg-[#8855f6] text-white rounded-full px-6 font-bold shadow-lg shadow-[#8855f6]/30 hover:bg-[#7744e0]" data-testid="button-select-file">
                <Upload className="w-4 h-4 mr-2" /> {t("reconciliation.selectFile")}
              </Button>
            </div>
          )}
        </div>

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

        {showTutorial && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-blue-100 dark:border-blue-800 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] p-5 mb-6" data-testid="section-csv-tutorial">
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

            <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 mb-4 overflow-x-auto">
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] p-4 mb-4">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">{t("reconciliation.exportReport")}</p>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border transition-all ${activeTab === tab.key ? `${tab.bg} ${tab.border} shadow-sm` : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"}`}
                  data-testid={`tab-${tab.key}`}
                >
                  <tab.icon className={`w-6 h-6 ${activeTab === tab.key ? tab.color : "text-slate-400 dark:text-slate-500"}`} />
                  <span className={`text-2xl font-extrabold ${activeTab === tab.key ? tab.color : "text-slate-700 dark:text-slate-300"}`} data-testid={`count-${tab.key}`}>{tab.count}</span>
                  <span className={`text-xs font-semibold ${activeTab === tab.key ? tab.color : "text-slate-500 dark:text-slate-400"}`}>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3" data-testid={`list-${activeTab}`}>
              {activeEntries.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] p-8 text-center">
                  <p className="text-slate-400 dark:text-slate-500 text-sm" data-testid="text-empty">{t("reconciliation.noEntriesInCategory")}</p>
                </div>
              ) : (
                activeEntries.map(entry => (
                  <div
                    key={entry.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] border transition-all ${activeTab === "divergent" ? "border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700 cursor-pointer" : "border-slate-100/70 dark:border-slate-700/50"}`}
                    onClick={() => activeTab === "divergent" && setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    data-testid={`entry-card-${entry.id}`}
                  >
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate" data-testid={`text-patient-${entry.id}`}>{entry.patientName}</p>
                          {activeTab === "divergent" && (
                            expandedEntry === entry.id ? <ChevronUp className="w-4 h-4 text-amber-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                          <span data-testid={`text-date-${entry.id}`}>{formatDate(entry.procedureDate)}</span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300" data-testid={`text-value-${entry.id}`}>{formatCurrency(entry.procedureValue)}</span>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${activeTab === "reconciled" ? "bg-green-50 dark:bg-green-900/30 text-green-600" : activeTab === "divergent" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600" : "bg-red-50 dark:bg-red-900/30 text-red-500"}`} data-testid={`badge-status-${entry.id}`}>
                        {activeTab === "reconciled" ? t("common.reconciled") : activeTab === "divergent" ? t("common.divergent") : t("common.pending")}
                      </div>
                    </div>
                    {activeTab === "divergent" && expandedEntry === entry.id && (
                      <div className="px-4 pb-4 border-t border-amber-100 dark:border-amber-800 pt-3" data-testid={`detail-${entry.id}`}>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{t("common.insurance")}</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">{entry.insuranceProvider}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{t("common.value")}</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(entry.procedureValue)}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{t("clinicReports.description")}</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">{entry.description}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-amber-600 font-semibold">⚠ {t("reconciliation.valueDiffers")}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!results && !isProcessing && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] p-8 text-center mb-8">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium" data-testid="text-no-results">{t("reconciliation.sendPDF")}</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{t("reconciliation.resultsAfterProcessing")}</p>
            <button onClick={loadResults} className="mt-4 text-sm text-[#8855f6] font-semibold hover:underline" data-testid="button-load-previous">
              {t("reconciliation.loadPrevious")}
            </button>
          </div>
        )}
    </div>
  );
}