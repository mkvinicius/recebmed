import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Download, Upload, FileSpreadsheet, FileText, Loader2,
  CheckCircle2, AlertCircle, ChevronDown, Calendar, X, Files
} from "lucide-react";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

const formatCurrency = (val: string | number | null | undefined) => {
  if (!val) return null;
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return null;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export default function Import() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [csvYear, setCsvYear] = useState(currentYear - 1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvDragging, setCsvDragging] = useState(false);
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [csvResult, setCsvResult] = useState<{ count: number; year: number; skipped: number } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [pdfYear, setPdfYear] = useState(currentYear - 1);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [pdfDragging, setPdfDragging] = useState(false);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [pdfResult, setPdfResult] = useState<{ extractedCount: number; reconciled: number; divergent: number; pending: number } | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleCsvUpload = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xls", "xlsx"].includes(ext || "")) {
      toast({ title: "Formato inválido", description: "Envie um arquivo CSV ou Excel (.csv, .xls, .xlsx).", variant: "destructive" });
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
            toast({ title: "Importação concluída!", description: `${data.imported} lançamentos importados.` });
          } else {
            toast({ title: "Erro", description: data.message || "Falha ao importar.", variant: "destructive" });
          }
        } catch {
          toast({ title: "Erro", description: "Falha na conexão com o servidor.", variant: "destructive" });
        } finally {
          setCsvProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setCsvProcessing(false);
      toast({ title: "Erro", description: "Falha ao ler o arquivo.", variant: "destructive" });
    }
  }, [toast, setLocation, csvYear]);

  const handlePdfUpload = useCallback(async (files: File[]) => {
    const validFiles = files.filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (validFiles.length === 0) {
      toast({ title: "Formato inválido", description: "Envie apenas arquivos PDF.", variant: "destructive" });
      return;
    }
    if (validFiles.length > 20) {
      toast({ title: "Limite excedido", description: "Máximo de 20 PDFs por vez.", variant: "destructive" });
      return;
    }
    setPdfFiles(validFiles);
    setPdfProcessing(true);
    setPdfResult(null);
    setPdfProgress({ current: 0, total: validFiles.length });
    const token = getToken();
    if (!token) { clearAuth(); setLocation("/login"); return; }

    try {
      const pdfPromises = validFiles.map(file => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }));
      const base64Pdfs = await Promise.all(pdfPromises);

      const res = await fetch("/api/import/clinic-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pdfs: base64Pdfs.map((b, i) => ({ data: b, name: validFiles[i].name })),
          year: pdfYear,
        }),
      });
      if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
      const data = await res.json();
      if (res.ok) {
        setPdfResult({
          extractedCount: data.extractedCount,
          reconciled: data.reconciliation?.reconciled || 0,
          divergent: data.reconciliation?.divergent || 0,
          pending: data.reconciliation?.pending || 0,
        });
        const errMsg = data.pdfErrors > 0 ? ` (${data.pdfErrors} PDF(s) com erro)` : "";
        toast({ title: "PDFs processados!", description: `${data.extractedCount} registros extraídos de ${validFiles.length} PDF(s).${errMsg}` });
      } else {
        toast({ title: "Erro", description: data.message || "Falha ao processar PDFs.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha na conexão com o servidor.", variant: "destructive" });
    } finally {
      setPdfProcessing(false);
    }
  }, [toast, setLocation, pdfYear]);

  const user = getUser();
  const profileInitials = user?.name ? user.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "Dr";

  return (
    <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-slate-100 relative">
      <div className="hero-gradient h-56 w-full absolute top-0 left-0 z-0" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            <div className="size-11 bg-gradient-to-br from-white/30 to-white/10 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/30 shadow-lg overflow-hidden" data-testid="avatar-profile">
              {user?.profilePhotoUrl ? <img src={user.profilePhotoUrl} alt="Perfil" className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-white tracking-wide">{profileInitials}</span>}
            </div>
            <h1 className="text-xl font-bold tracking-tight">RecebMed</h1>
          </div>
          <button onClick={() => setLocation("/reports")} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm font-semibold transition-colors backdrop-blur-md" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </header>

        <div className="pt-2 pb-6 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">Auditoria Retroativa</h2>
          <p className="text-white/80 mt-1 text-sm">Importe dados históricos para auditar seus recebimentos de anos anteriores</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] border border-slate-100/70 dark:border-slate-700/50 p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 bg-[#8855f6]/10 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-[#8855f6]" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Template de Importação</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Baixe o modelo de planilha e preencha com seus dados</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/template_recebmed.csv"
              download="template_recebmed.csv"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold rounded-xl transition-colors shadow-lg shadow-[#8855f6]/20"
              data-testid="link-download-template"
            >
              <FileSpreadsheet className="w-4 h-4" /> Baixar Template CSV
            </a>
          </div>
          <div className="mt-3 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Colunas do template:</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-mono">data_procedimento (dd/mm/aaaa) | nome_paciente | convenio | descricao_procedimento | valor (opcional)</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] border border-slate-100/70 dark:border-slate-700/50 p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Importar Lançamentos</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Suba sua planilha de lançamentos (CSV ou Excel)</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-4 h-4 text-slate-400" />
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">Ano de referência:</label>
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
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Processando planilha...</p>
                {csvFile && <p className="text-xs text-slate-400">{csvFile.name}</p>}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-400" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Arraste a planilha aqui ou clique para selecionar</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Formatos aceitos: .csv, .xls, .xlsx</p>
              </div>
            )}
          </div>

          {csvResult && (
            <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4" data-testid="csv-result">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <p className="font-bold text-emerald-700 dark:text-emerald-300">Importação concluída!</p>
              </div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                <span className="font-bold">{csvResult.count}</span> lançamentos de <span className="font-bold">{csvResult.year}</span> importados com sucesso.
              </p>
              {csvResult.skipped > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {csvResult.skipped} linha(s) ignorada(s) por dados incompletos.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] border border-slate-100/70 dark:border-slate-700/50 p-5 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Files className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Relatórios das Clínicas (PDFs)</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Suba os PDFs das clínicas para conciliar com os lançamentos</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-4 h-4 text-slate-400" />
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">Ano de referência:</label>
            <div className="relative">
              <select
                value={pdfYear}
                onChange={e => setPdfYear(Number(e.target.value))}
                className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 pr-8 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#8855f6]/40"
                data-testid="select-pdf-year"
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={e => { const files = Array.from(e.target.files || []); if (files.length > 0) handlePdfUpload(files); if (pdfInputRef.current) pdfInputRef.current.value = ""; }}
            data-testid="input-pdf-upload"
          />

          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${pdfDragging ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 scale-[1.01]" : "border-slate-200 dark:border-slate-700 hover:border-blue-400/60"}`}
            onClick={() => !pdfProcessing && pdfInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setPdfDragging(true); }}
            onDragLeave={e => { e.preventDefault(); setPdfDragging(false); }}
            onDrop={e => { e.preventDefault(); setPdfDragging(false); const files = Array.from(e.dataTransfer.files || []); if (files.length > 0) handlePdfUpload(files); }}
            data-testid="dropzone-pdf"
          >
            {pdfProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Processando PDFs...</p>
                <p className="text-xs text-slate-400">{pdfFiles.length} arquivo(s)</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-400" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Arraste os PDFs aqui ou clique para selecionar</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Aceita múltiplos PDFs (até 20 de uma vez)</p>
              </div>
            )}
          </div>

          {pdfFiles.length > 0 && !pdfProcessing && !pdfResult && (
            <div className="mt-3 flex flex-wrap gap-2">
              {pdfFiles.map((f, i) => (
                <span key={i} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">
                  <FileText className="w-3 h-3" /> {f.name}
                </span>
              ))}
            </div>
          )}

          {pdfResult && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4" data-testid="pdf-result">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <p className="font-bold text-blue-700 dark:text-blue-300">Processamento concluído!</p>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                <span className="font-bold">{pdfResult.extractedCount}</span> registros extraídos de {pdfFiles.length} PDF(s).
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-extrabold text-green-600 dark:text-green-400" data-testid="text-reconciled-count">{pdfResult.reconciled}</p>
                  <p className="text-[10px] font-semibold text-green-600/80 dark:text-green-400/80 uppercase tracking-wider">Conciliados</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400" data-testid="text-divergent-count">{pdfResult.divergent}</p>
                  <p className="text-[10px] font-semibold text-amber-600/80 dark:text-amber-400/80 uppercase tracking-wider">Divergentes</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-extrabold text-red-500 dark:text-red-400" data-testid="text-pending-count">{pdfResult.pending}</p>
                  <p className="text-[10px] font-semibold text-red-500/80 dark:text-red-400/80 uppercase tracking-wider">Pendentes</p>
                </div>
              </div>
              <button
                onClick={() => setLocation("/reconciliation")}
                className="mt-3 w-full text-center text-sm text-[#8855f6] font-bold hover:underline"
                data-testid="link-view-reconciliation"
              >
                Ver detalhes na Conciliação
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}