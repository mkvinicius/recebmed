import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Stethoscope, ArrowLeft, Check, Loader2, User, Calendar,
  Building2, FileText, Camera, Mic, PenLine, Trash2, Plus, DollarSign
} from "lucide-react";
import { getToken } from "@/lib/auth";

interface EntryData {
  patientName: string;
  procedureDate: string;
  insuranceProvider: string;
  description: string;
  procedureValue: string;
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
        if (Array.isArray(data)) {
          setEntries(data.map((d: any) => ({
            patientName: d.patientName || "",
            procedureDate: d.procedureDate || "",
            insuranceProvider: d.insuranceProvider || "",
            description: d.description || "",
            procedureValue: d.procedureValue || "",
          })));
        } else {
          setEntries([{
            patientName: data.patientName || "",
            procedureDate: data.procedureDate || "",
            insuranceProvider: data.insuranceProvider || "",
            description: data.description || "",
            procedureValue: data.procedureValue || "",
          }]);
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

    const validEntries = entries.filter(e => e.patientName && e.procedureDate && e.insuranceProvider && e.description);
    if (validEntries.length === 0) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos de pelo menos um lançamento.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      if (validEntries.length === 1) {
        const e = validEntries[0];
        const res = await fetch("/api/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...e, entryMethod }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Erro ao salvar", description: data.message, variant: "destructive" });
          return;
        }
      } else {
        const res = await fetch("/api/entries/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ entries: validEntries, entryMethod }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Erro ao salvar", description: data.message, variant: "destructive" });
          return;
        }
      }
      toast({
        title: validEntries.length > 1 ? `${validEntries.length} lançamentos salvos!` : "Lançamento salvo!",
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

  return (
    <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-slate-100 relative">
      <div className="hero-gradient h-56 w-full absolute top-0 left-0 z-0" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            <div className="size-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
              <Stethoscope className="w-5 h-5" />
            </div>
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

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                    <User className="w-3.5 h-3.5 text-[#8855f6]" /> Paciente
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
                    </Label>
                    <Input type="date" value={entry.procedureDate} onChange={(e) => updateEntry(index, "procedureDate", e.target.value)}
                      className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium"
                      data-testid={`input-procedure-date-${index}`} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                      <Building2 className="w-3.5 h-3.5 text-[#8855f6]" /> Convênio
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
                    </Label>
                    <Input value={entry.description} onChange={(e) => updateEntry(index, "description", e.target.value)}
                      placeholder="Ex: Consulta, Retorno, Sleeve"
                      className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium"
                      data-testid={`input-description-${index}`} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                      <DollarSign className="w-3.5 h-3.5 text-[#8855f6]" /> Valor (R$)
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