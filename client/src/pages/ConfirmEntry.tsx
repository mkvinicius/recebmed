import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Stethoscope, ArrowLeft, Check, Loader2, User, Calendar,
  Building2, FileText, Camera, Mic, PenLine, Trash2, Plus, DollarSign, Brain
} from "lucide-react";
import { getToken, getUser } from "@/lib/auth";

type ConfidenceLevel = "high" | "medium" | "low";

interface ConfidenceData {
  patientName: ConfidenceLevel;
  procedureDate: ConfidenceLevel;
  insuranceProvider: ConfidenceLevel;
  description: ConfidenceLevel;
  procedureValue: ConfidenceLevel;
}

interface OriginalData {
  patientName: string;
  procedureDate: string;
  insuranceProvider: string;
  description: string;
  procedureValue: string;
}

interface EntryData {
  patientName: string;
  procedureDate: string;
  insuranceProvider: string;
  description: string;
  procedureValue: string;
  confidence?: ConfidenceData;
  _originalData?: OriginalData;
}

const confidenceConfig: Record<ConfidenceLevel, { dotClass: string; text: string; bannerClass: string; bannerText: string }> = {
  high: { dotClass: "bg-green-500", text: "Alta confiança", bannerClass: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800", bannerText: "Alta confiança na extração" },
  medium: { dotClass: "bg-amber-500", text: "Confiança média", bannerClass: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800", bannerText: "Confiança média - revise os campos" },
  low: { dotClass: "bg-red-500", text: "Baixa confiança", bannerClass: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800", bannerText: "Baixa confiança - verifique todos os campos" },
};

function getOverallConfidence(confidence: ConfidenceData): ConfidenceLevel {
  const values: ConfidenceLevel[] = [confidence.patientName, confidence.procedureDate, confidence.insuranceProvider, confidence.description, confidence.procedureValue];
  const numericMap: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1 };
  const avg = values.reduce((sum, v) => sum + numericMap[v], 0) / values.length;
  if (avg >= 2.5) return "high";
  if (avg >= 1.5) return "medium";
  return "low";
}

function ConfidenceIndicator({ level }: { level: ConfidenceLevel }) {
  const config = confidenceConfig[level];
  return (
    <span className="inline-flex items-center gap-1 ml-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${config.dotClass}`} />
      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{config.text}</span>
    </span>
  );
}

function ConfidenceBanner({ confidence }: { confidence: ConfidenceData }) {
  const overall = getOverallConfidence(confidence);
  const config = confidenceConfig[overall];
  return (
    <div className={`mb-4 px-3 py-2 rounded-xl border text-xs font-semibold text-center ${config.bannerClass}`} data-testid="confidence-banner">
      {config.bannerText}
    </div>
  );
}

export default function ConfirmEntry() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [entries, setEntries] = useState<EntryData[]>([]);

  const params = new URLSearchParams(search);
  const entryMethod = params.get("method") || "manual";
  const sourceLabel = entryMethod === "photo" ? "Foto" : entryMethod === "audio" ? "Áudio" : "Manual";
  const SourceIcon = entryMethod === "photo" ? Camera : entryMethod === "audio" ? Mic : PenLine;

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }

    if (entryMethod === "manual") {
      setEntries([{ patientName: "", procedureDate: new Date().toISOString().split("T")[0], insuranceProvider: "", description: "", procedureValue: "" }]);
      return;
    }

    const storedData = sessionStorage.getItem("medfin_extracted");
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        const parseEntry = (d: any): EntryData => {
          const entry: EntryData = {
            patientName: d.patientName || "",
            procedureDate: d.procedureDate || "",
            insuranceProvider: d.insuranceProvider || "",
            description: d.description || "",
            procedureValue: d.procedureValue || "",
            confidence: d.confidence ? {
              patientName: d.confidence.patientName || "medium",
              procedureDate: d.confidence.procedureDate || "medium",
              insuranceProvider: d.confidence.insuranceProvider || "medium",
              description: d.confidence.description || "medium",
              procedureValue: d.confidence.procedureValue || "medium",
            } : undefined,
          };
          entry._originalData = { patientName: entry.patientName, procedureDate: entry.procedureDate, insuranceProvider: entry.insuranceProvider, description: entry.description, procedureValue: entry.procedureValue };
          return entry;
        };
        if (Array.isArray(data)) {
          setEntries(data.map(parseEntry));
        } else {
          setEntries([parseEntry(data)]);
        }
        sessionStorage.removeItem("medfin_extracted");
      } catch {
        setEntries([{ patientName: "", procedureDate: new Date().toISOString().split("T")[0], insuranceProvider: "", description: "", procedureValue: "" }]);
      }
    } else {
      setEntries([{ patientName: "", procedureDate: new Date().toISOString().split("T")[0], insuranceProvider: "", description: "", procedureValue: "" }]);
    }
  }, [setLocation, entryMethod]);

  const updateEntry = (index: number, field: keyof EntryData, value: string) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return;
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const addEntry = () => {
    const lastEntry = entries[entries.length - 1];
    setEntries(prev => [...prev, {
      patientName: "",
      procedureDate: lastEntry?.procedureDate || new Date().toISOString().split("T")[0],
      insuranceProvider: lastEntry?.insuranceProvider || "",
      description: "",
      procedureValue: "",
    }]);
  };

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;

    const validIndices: number[] = [];
    entries.forEach((e, i) => { if (e.patientName && e.procedureDate && e.insuranceProvider && e.description) validIndices.push(i); });
    if (validIndices.length === 0) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos de pelo menos um lançamento.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const isAiMethod = entryMethod !== "manual";
      if (validIndices.length === 1) {
        const idx = validIndices[0];
        const e = entries[idx];
        const body: any = { patientName: e.patientName, procedureDate: e.procedureDate, insuranceProvider: e.insuranceProvider, description: e.description, procedureValue: e.procedureValue, entryMethod };
        if (isAiMethod && e._originalData) body._originalData = e._originalData;
        const res = await fetch("/api/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Erro ao salvar", description: data.message, variant: "destructive" });
          return;
        }
      } else {
        const batchEntries = validIndices.map(idx => {
          const e = entries[idx];
          const item: any = { patientName: e.patientName, procedureDate: e.procedureDate, insuranceProvider: e.insuranceProvider, description: e.description, procedureValue: e.procedureValue };
          if (isAiMethod && e._originalData) item._originalData = e._originalData;
          return item;
        });
        const res = await fetch("/api/entries/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ entries: batchEntries, entryMethod }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Erro ao salvar", description: data.message, variant: "destructive" });
          return;
        }
      }
      toast({
        title: validIndices.length > 1 ? `${validIndices.length} lançamentos salvos!` : "Lançamento salvo!",
        description: "Os dados foram registrados com sucesso.",
      });
      setLocation("/dashboard");
    } catch {
      toast({ title: "Erro de conexão", description: "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const isBatch = entries.length > 1;
  const showConfidence = entryMethod !== "manual";

  return (
    <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-slate-100 relative">
      <div className="hero-gradient h-56 w-full absolute top-0 left-0 z-0" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            {(() => { const u = getUser(); const p = u?.profilePhotoUrl; const i = u?.name ? u.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "Dr"; return (
              <div className="size-11 bg-gradient-to-br from-white/30 to-white/10 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/30 shadow-lg overflow-hidden" data-testid="avatar-profile">
                {p ? <img src={p} alt="Perfil" className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-white tracking-wide">{i}</span>}
              </div>
            ); })()}
            <h1 className="text-xl font-bold tracking-tight">Medfin</h1>
          </div>
        </header>

        <div className="pt-2 pb-8 text-white">
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium mb-4 transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </button>
          <h2 className="text-2xl font-extrabold">
            {entryMethod === "manual" ? "Novo Lançamento Manual" : "Confirmar Lançamentos"}
          </h2>
          <p className="text-white/80 mt-1 text-sm">
            {entryMethod === "manual"
              ? "Preencha os dados do procedimento"
              : isBatch
                ? `${entries.length} registros encontrados — revise e confirme`
                : "Revise os dados extraídos pela IA e confirme"}
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {entries.map((entry, index) => (
            <div key={index} className="glass-card dark:glass-card-dark rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${entryMethod === "manual" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600" : "bg-green-50 dark:bg-green-900/30 text-green-600"}`}>
                    {entryMethod === "manual" ? <PenLine className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      {isBatch ? `Paciente ${index + 1} de ${entries.length}` : entryMethod === "manual" ? "Lançamento Manual" : "Dados extraídos"}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <SourceIcon className="w-3 h-3" /> Via {sourceLabel}
                    </p>
                  </div>
                </div>
                {entries.length > 1 && (
                  <button
                    onClick={() => removeEntry(index)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                    data-testid={`button-remove-entry-${index}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {showConfidence && entry.confidence && (
                <ConfidenceBanner confidence={entry.confidence} />
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                    <User className="w-3.5 h-3.5 text-[#8855f6]" /> Paciente
                    {showConfidence && entry.confidence && <ConfidenceIndicator level={entry.confidence.patientName} />}
                  </Label>
                  <Input value={entry.patientName} onChange={(e) => updateEntry(index, "patientName", e.target.value)}
                    placeholder="Nome completo"
                    className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium"
                    data-testid={`input-patient-name-${index}`} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                      <Calendar className="w-3.5 h-3.5 text-[#8855f6]" /> Data
                      {showConfidence && entry.confidence && <ConfidenceIndicator level={entry.confidence.procedureDate} />}
                    </Label>
                    <Input type="date" value={entry.procedureDate} onChange={(e) => updateEntry(index, "procedureDate", e.target.value)}
                      className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium"
                      data-testid={`input-procedure-date-${index}`} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                      <Building2 className="w-3.5 h-3.5 text-[#8855f6]" /> Convênio
                      {showConfidence && entry.confidence && <ConfidenceIndicator level={entry.confidence.insuranceProvider} />}
                    </Label>
                    <Input value={entry.insuranceProvider} onChange={(e) => updateEntry(index, "insuranceProvider", e.target.value)}
                      placeholder="Ex: Particular"
                      className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium"
                      data-testid={`input-insurance-${index}`} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                      <FileText className="w-3.5 h-3.5 text-[#8855f6]" /> Procedimento
                      {showConfidence && entry.confidence && <ConfidenceIndicator level={entry.confidence.description} />}
                    </Label>
                    <Input value={entry.description} onChange={(e) => updateEntry(index, "description", e.target.value)}
                      placeholder="Ex: Consulta, Retorno, Sleeve"
                      className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium"
                      data-testid={`input-description-${index}`} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                      <DollarSign className="w-3.5 h-3.5 text-[#8855f6]" /> Valor (R$)
                      {showConfidence && entry.confidence && <ConfidenceIndicator level={entry.confidence.procedureValue} />}
                    </Label>
                    <Input type="number" step="0.01" min="0" value={entry.procedureValue} onChange={(e) => updateEntry(index, "procedureValue", e.target.value)}
                      placeholder="0.00"
                      className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium"
                      data-testid={`input-value-${index}`} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <button
            onClick={addEntry}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-[#8855f6] hover:border-[#8855f6]/30 transition-colors font-semibold text-sm"
            data-testid="button-add-entry"
          >
            <Plus className="w-4 h-4" />
            Adicionar mais um lançamento
          </button>
        </div>

        {showConfidence && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-[#8855f6]/5 dark:bg-[#8855f6]/10 border border-[#8855f6]/10 dark:border-[#8855f6]/20" data-testid="learning-indicator">
            <Brain className="w-4 h-4 text-[#8855f6] flex-shrink-0" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Suas correções ensinam a IA — futuras extrações serão mais precisas com base no seu histórico.
            </p>
          </div>
        )}

        <div className="flex gap-4 pb-12">
          <Button variant="outline" onClick={() => setLocation("/dashboard")}
            className="flex-1 h-12 rounded-full font-bold border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            data-testid="button-cancel">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}
            className="flex-1 h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold shadow-lg shadow-[#8855f6]/30 hover:shadow-xl hover:shadow-[#8855f6]/40 hover:scale-[1.02] transition-all"
            data-testid="button-save-entry">
            {isSaving
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
              : entries.length > 1
                ? `Salvar ${entries.length} Lançamentos`
                : "Salvar Lançamento"}
          </Button>
        </div>
      </div>
    </div>
  );
}