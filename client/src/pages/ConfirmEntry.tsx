import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Stethoscope, ArrowLeft, Check, Loader2, User, Calendar,
  Building2, FileText, Camera, Mic, PenLine
} from "lucide-react";
import { getToken } from "@/lib/auth";

export default function ConfirmEntry() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [patientName, setPatientName] = useState("");
  const [procedureDate, setProcedureDate] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [description, setDescription] = useState("");

  const params = new URLSearchParams(search);
  const entryMethod = params.get("method") || "manual";
  const sourceLabel = entryMethod === "photo" ? "Foto" : entryMethod === "audio" ? "Áudio" : "Manual";
  const SourceIcon = entryMethod === "photo" ? Camera : entryMethod === "audio" ? Mic : PenLine;

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }

    if (entryMethod === "manual") {
      setProcedureDate(new Date().toISOString().split("T")[0]);
      return;
    }

    const storedData = sessionStorage.getItem("medfin_extracted");
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        setPatientName(data.patientName || "");
        setProcedureDate(data.procedureDate || "");
        setInsuranceProvider(data.insuranceProvider || "");
        setDescription(data.description || "");
        sessionStorage.removeItem("medfin_extracted");
      } catch {
        /* ignore */
      }
    }
  }, [setLocation, entryMethod]);

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;

    if (!patientName || !procedureDate || !insuranceProvider || !description) {
      toast({ title: "Campos obrigatórios", description: "Preencha todos os campos antes de salvar.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientName, procedureDate, insuranceProvider, description, entryMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro ao salvar", description: data.message, variant: "destructive" });
        return;
      }
      toast({ title: "Lançamento salvo!", description: "Os dados foram registrados com sucesso." });
      setLocation("/dashboard");
    } catch {
      toast({ title: "Erro de conexão", description: "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f5f8] text-slate-900 relative">
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
            {entryMethod === "manual" ? "Novo Lançamento Manual" : "Confirmar Lançamento"}
          </h2>
          <p className="text-white/80 mt-1 text-sm">
            {entryMethod === "manual" ? "Preencha os dados do procedimento" : "Revise os dados extraídos pela IA e confirme"}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8 shadow-2xl mb-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-10 h-10 text-[#8855f6] animate-spin" />
              <p className="text-slate-500 font-medium">Processando com IA...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2 pb-4 border-b border-slate-100">
                <div className={`p-2 rounded-xl ${entryMethod === "manual" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"}`}>
                  {entryMethod === "manual" ? <PenLine className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-bold text-slate-800">
                    {entryMethod === "manual" ? "Lançamento Manual" : "Dados extraídos com sucesso"}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <SourceIcon className="w-3 h-3" /> Via {sourceLabel}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#8855f6]" /> Nome do Paciente
                </Label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nome completo do paciente"
                  className="h-12 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium"
                  data-testid="input-patient-name" />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-slate-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#8855f6]" /> Data do Procedimento
                </Label>
                <Input type="date" value={procedureDate} onChange={(e) => setProcedureDate(e.target.value)}
                  className="h-12 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium"
                  data-testid="input-procedure-date" />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-slate-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#8855f6]" /> Convênio
                </Label>
                <Input value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)}
                  placeholder="Ex: Unimed, SUS, Particular"
                  className="h-12 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium"
                  data-testid="input-insurance" />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#8855f6]" /> Procedimento
                </Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Consulta, Retorno, Sleeve"
                  className="h-12 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium"
                  data-testid="input-description" />
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={() => setLocation("/dashboard")}
                  className="flex-1 h-12 rounded-full font-bold border-2 border-slate-200 text-slate-600 hover:bg-slate-50"
                  data-testid="button-cancel">
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving}
                  className="flex-1 h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold shadow-lg shadow-[#8855f6]/30 hover:shadow-xl hover:shadow-[#8855f6]/40 hover:scale-[1.02] transition-all"
                  data-testid="button-save-entry">
                  {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : "Salvar Lançamento"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}