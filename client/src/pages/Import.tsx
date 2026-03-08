import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Download, Upload, FileSpreadsheet, Loader2,
  CheckCircle2, AlertCircle, ChevronDown, Calendar
} from "lucide-react";
import { getToken, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getLocale, getCurrencyCode } from "@/lib/i18n";

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

export default function Import() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const locale = getLocale();
  const currency = getCurrencyCode();

  const formatCurrency = (val: string | number | null | undefined) => {
    if (!val) return null;
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return null;
    return num.toLocaleString(locale, { style: "currency", currency });
  };

  const [csvYear, setCsvYear] = useState(currentYear - 1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvDragging, setCsvDragging] = useState(false);
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [csvResult, setCsvResult] = useState<{ count: number; year: number; skipped: number } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleCsvUpload = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xls", "xlsx"].includes(ext || "")) {
      toast({ title: t("import.invalidFormat"), description: t("import.invalidFormatDesc"), variant: "destructive" });
      return;
    }
    setCsvFile(file);
    setCsvProcessing(true);
    setCsvResult(null);
    const token = getToken();
    if (!token) { clearAuth(); setLocation("/login"); return; }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const res = await fetch("/api/import/doctor-entries", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ file: base64, fileName: file.name, year: csvYear }),
          });
          if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
          const data = await res.json();
          if (res.ok) {
            setCsvResult({ count: data.imported, year: data.year, skipped: data.skipped || 0 });
            toast({ title: t("import.importCompleted"), description: t("import.importedCount", { count: data.imported }) });
          } else {
            toast({ title: t("common.error"), description: data.message || t("import.importError"), variant: "destructive" });
          }
        } catch {
          toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
        } finally {
          setCsvProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setCsvProcessing(false);
      toast({ title: t("common.error"), description: t("import.readError"), variant: "destructive" });
    }
  }, [toast, setLocation, csvYear, t]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-1 pb-4 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("import.title")}</h2>
          <p className="text-white/80 mt-1 text-sm">{t("import.subtitle")}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] border border-slate-100/70 dark:border-slate-700/50 p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 bg-[#8855f6]/10 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-[#8855f6]" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{t("import.templateTitle")}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("import.templateDesc")}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/template_recebmed.csv"
              download="template_recebmed.csv"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold rounded-xl transition-colors shadow-lg shadow-[#8855f6]/20"
              data-testid="link-download-template"
            >
              <FileSpreadsheet className="w-4 h-4" /> {t("import.downloadTemplate")}
            </a>
          </div>
          <div className="mt-3 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t("import.templateColumns")}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-mono">{t("import.templateColumnsList")}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] border border-slate-100/70 dark:border-slate-700/50 p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{t("import.importEntries")}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("import.importEntriesDesc")}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-4 h-4 text-slate-400" />
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t("import.referenceYear")}</label>
            <div className="relative">
              <select
                value={csvYear}
                onChange={e => setCsvYear(Number(e.target.value))}
                className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 pr-8 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#8855f6]/40"
                data-testid="select-csv-year"
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f); if (csvInputRef.current) csvInputRef.current.value = ""; }}
            data-testid="input-csv-upload"
          />

          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${csvDragging ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 scale-[1.01]" : "border-slate-200 dark:border-slate-700 hover:border-emerald-400/60"}`}
            onClick={() => !csvProcessing && csvInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setCsvDragging(true); }}
            onDragLeave={e => { e.preventDefault(); setCsvDragging(false); }}
            onDrop={e => { e.preventDefault(); setCsvDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleCsvUpload(f); }}
            data-testid="dropzone-csv"
          >
            {csvProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("import.processingSpreadsheet")}</p>
                {csvFile && <p className="text-xs text-slate-400">{csvFile.name}</p>}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-400" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t("import.dragCsvOrClick")}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{t("import.acceptedFormats")}</p>
              </div>
            )}
          </div>

          {csvResult && (
            <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4" data-testid="csv-result">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <p className="font-bold text-emerald-700 dark:text-emerald-300">{t("import.importCompleted")}</p>
              </div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {t("import.importedResult", { count: csvResult.count, year: csvResult.year })}
              </p>
              {csvResult.skipped > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {t("import.skippedRows", { count: csvResult.skipped })}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="text-center px-4 py-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/40 mb-8">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            <AlertCircle className="w-4 h-4 inline-block mr-1.5 -mt-0.5 text-slate-400" />
            {t("import.pdfHint")}
          </p>
        </div>
    </div>
  );
}