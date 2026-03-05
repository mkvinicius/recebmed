import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Upload, FileText, Loader2, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronUp, Stethoscope
} from "lucide-react";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

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

const formatCurrency = (val: string | number | null | undefined) => {
  if (!val) return "—";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "—";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function Reconciliation() {
  const [, setLocation] = useLocation();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ReconciliationResults | null>(null);
  const [activeTab, setActiveTab] = useState<"reconciled" | "divergent" | "pending">("reconciled");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      toast({ title: "Erro", description: "Por favor, envie um arquivo PDF.", variant: "destructive" });
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
          const res = await fetch("/api/reconciliation/upload-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ pdf: base64 }),
          });
          if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
          const data = await res.json();
          if (data.success && data.reconciliation) {
            setResults(data.reconciliation);
            toast({ title: "Conciliação concluída!", description: `${data.extractedCount} registros extraídos do PDF.` });
          } else {
            toast({ title: "Erro", description: data.message || "Falha ao processar PDF.", variant: "destructive" });
          }
        } catch {
          toast({ title: "Erro", description: "Falha na conexão com o servidor.", variant: "destructive" });
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsProcessing(false);
      toast({ title: "Erro", description: "Falha ao ler o arquivo.", variant: "destructive" });
    }
  }, [toast, setLocation]);

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

  const tabs = [
    { key: "reconciled" as const, label: "Conciliados", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/30", border: "border-green-200 dark:border-green-800", count: results?.reconciled?.length || 0 },
    { key: "divergent" as const, label: "Divergentes", icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/30", border: "border-amber-200 dark:border-amber-800", count: results?.divergent?.length || 0 },
    { key: "pending" as const, label: "Pendentes", icon: Clock, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/30", border: "border-red-200 dark:border-red-800", count: results?.pending?.length || 0 },
  ];

  const activeEntries = results ? results[activeTab] || [] : [];

  return (
    <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-slate-100 relative">
      <div className="hero-gradient h-56 w-full absolute top-0 left-0 z-0" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            {(() => { const u = getUser(); const p = u?.profilePhotoUrl; const i = u?.name ? u.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "Dr"; return (
              <div className="size-11 bg-gradient-to-br from-white/30 to-white/10 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/30 shadow-lg overflow-hidden" data-testid="avatar-profile">
                {p ? <img src={p} alt="Perfil" className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-white tracking-wide">{i}</span>}
              </div>
            ); })()}
            <h1 className="text-xl font-bold tracking-tight">RecebMed</h1>
          </div>
          <button onClick={() => setLocation("/dashboard")} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm font-semibold transition-colors backdrop-blur-md" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </header>

        <div className="pt-2 pb-6 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">Conciliação de Relatórios</h2>
          <p className="text-white/80 mt-1 text-sm">Envie o PDF da clínica para comparar com seus lançamentos</p>
        </div>

        <div
          className={`bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] border-2 border-dashed p-8 mb-6 text-center transition-all cursor-pointer ${isDragging ? "border-[#8855f6] bg-[#8855f6]/5 dark:bg-[#8855f6]/10 scale-[1.02]" : "border-slate-200 dark:border-slate-700 hover:border-[#8855f6]/40"}`}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-testid="dropzone-pdf"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
            data-testid="input-pdf-upload"
          />
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-12 h-12 text-[#8855f6] animate-spin" />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200" data-testid="text-processing">Processando PDF...</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Extraindo dados e conciliando lançamentos</p>
              {fileName && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{fileName}</p>}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="size-16 bg-[#8855f6]/10 rounded-2xl flex items-center justify-center">
                <Upload className="w-8 h-8 text-[#8855f6]" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200" data-testid="text-upload-prompt">Arraste o PDF aqui ou clique para selecionar</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Suporta relatórios de clínicas em formato PDF</p>
              </div>
              {fileName && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Último arquivo: {fileName}</p>}
              <Button className="mt-2 bg-[#8855f6] text-white rounded-full px-6 font-bold shadow-lg shadow-[#8855f6]/30 hover:bg-[#7744e0]" data-testid="button-select-pdf">
                <FileText className="w-4 h-4 mr-2" /> Selecionar PDF
              </Button>
            </div>
          )}
        </div>

        {results && (
          <div className="space-y-4 pb-12" data-testid="section-results">
            <div className="grid grid-cols-3 gap-3 mb-4">
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
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] p-8 text-center">
                  <p className="text-slate-400 dark:text-slate-500 text-sm" data-testid="text-empty">Nenhum lançamento nesta categoria</p>
                </div>
              ) : (
                activeEntries.map(entry => (
                  <div
                    key={entry.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] border transition-all ${activeTab === "divergent" ? "border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700 cursor-pointer" : "border-slate-100/70 dark:border-slate-700/50"}`}
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
                        {activeTab === "reconciled" ? "Conciliado" : activeTab === "divergent" ? "Divergente" : "Pendente"}
                      </div>
                    </div>
                    {activeTab === "divergent" && expandedEntry === entry.id && (
                      <div className="px-4 pb-4 border-t border-amber-100 dark:border-amber-800 pt-3" data-testid={`detail-${entry.id}`}>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Convênio</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">{entry.insuranceProvider}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Valor</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(entry.procedureValue)}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Descrição</p>
                            <p className="font-medium text-slate-700 dark:text-slate-300">{entry.description}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-amber-600 font-semibold">⚠ O valor informado difere do relatório da clínica. Verifique os dados.</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!results && !isProcessing && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] p-8 text-center mb-8">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium" data-testid="text-no-results">Envie um PDF para iniciar a conciliação</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Os resultados serão exibidos aqui após o processamento</p>
            <button onClick={loadResults} className="mt-4 text-sm text-[#8855f6] font-semibold hover:underline" data-testid="button-load-previous">
              Carregar resultados anteriores
            </button>
          </div>
        )}
      </div>
    </div>
  );
}