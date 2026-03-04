import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Stethoscope, ArrowLeft, Plus, Trash2, Loader2, FileText, Calendar, DollarSign, User
} from "lucide-react";
import { getToken, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface ClinicReport {
  id: string;
  patientName: string;
  procedureDate: string;
  reportedValue: string;
  description: string | null;
  createdAt: string;
}

export default function ClinicReports() {
  const [, setLocation] = useLocation();
  const [reports, setReports] = useState<ClinicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    patientName: "",
    procedureDate: "",
    reportedValue: "",
    description: "",
  });
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
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    if (!form.patientName || !form.procedureDate || !form.reportedValue) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/clinic-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientName: form.patientName,
          procedureDate: form.procedureDate,
          reportedValue: form.reportedValue,
          description: form.description || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReports(prev => [data.report, ...prev]);
        setForm({ patientName: "", procedureDate: "", reportedValue: "", description: "" });
        setShowForm(false);
        toast({ title: "Sucesso!", description: "Relatório da clínica adicionado." });
      } else {
        toast({ title: "Erro", description: data.message || "Não foi possível salvar.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha na conexão.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este relatório?")) return;
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
        toast({ title: "Excluído!", description: "Relatório removido com sucesso." });
      } else {
        toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha na conexão.", variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "R$ 0,00";
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-[#f6f5f8] text-slate-900 relative">
      <div className="hero-gradient h-48 w-full absolute top-0 left-0 z-0" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            <div className="size-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Medfin</h1>
          </div>
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm font-semibold transition-colors backdrop-blur-md"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </header>

        <div className="pt-2 pb-6 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">Relatórios da Clínica</h2>
          <p className="text-white/80 text-sm mt-1">Gerencie os relatórios recebidos das clínicas e convênios</p>
        </div>

        <div className="glass-card rounded-2xl p-6 shadow-2xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Adicionar Relatório</h3>
            <Button
              onClick={() => setShowForm(!showForm)}
              className={`flex items-center gap-2 px-4 py-2 h-auto rounded-full font-bold transition-all ${
                showForm
                  ? "bg-slate-200 text-slate-600 hover:bg-slate-300"
                  : "bg-[#8855f6] text-white shadow-lg shadow-[#8855f6]/30 hover:bg-[#7744e0]"
              }`}
              data-testid="button-toggle-form"
            >
              <Plus className={`w-4 h-4 transition-transform ${showForm ? "rotate-45" : ""}`} />
              {showForm ? "Cancelar" : "Novo Relatório"}
            </Button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="patientName" className="text-sm font-semibold text-slate-600 mb-1.5 block">
                    Nome do Paciente *
                  </Label>
                  <Input
                    id="patientName"
                    value={form.patientName}
                    onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))}
                    placeholder="Nome completo do paciente"
                    className="rounded-xl border-slate-200"
                    data-testid="input-patient-name"
                  />
                </div>
                <div>
                  <Label htmlFor="procedureDate" className="text-sm font-semibold text-slate-600 mb-1.5 block">
                    Data do Procedimento *
                  </Label>
                  <Input
                    id="procedureDate"
                    type="date"
                    value={form.procedureDate}
                    onChange={e => setForm(f => ({ ...f, procedureDate: e.target.value }))}
                    className="rounded-xl border-slate-200"
                    data-testid="input-procedure-date"
                  />
                </div>
                <div>
                  <Label htmlFor="reportedValue" className="text-sm font-semibold text-slate-600 mb-1.5 block">
                    Valor Reportado (R$) *
                  </Label>
                  <Input
                    id="reportedValue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.reportedValue}
                    onChange={e => setForm(f => ({ ...f, reportedValue: e.target.value }))}
                    placeholder="0,00"
                    className="rounded-xl border-slate-200"
                    data-testid="input-reported-value"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="text-sm font-semibold text-slate-600 mb-1.5 block">
                    Descrição / Notas
                  </Label>
                  <Input
                    id="description"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Observações opcionais"
                    className="rounded-xl border-slate-200"
                    data-testid="input-description"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 h-auto bg-[#8855f6] text-white rounded-full font-bold shadow-lg shadow-[#8855f6]/30 hover:bg-[#7744e0]"
                  data-testid="button-save-report"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? "Salvando..." : "Salvar Relatório"}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-12">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800">Relatórios Cadastrados</h3>
            <span className="text-[#8855f6] text-sm font-bold" data-testid="text-report-count">
              {reports.length} {reports.length === 1 ? "relatório" : "relatórios"}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              <div className="px-6 py-12 flex justify-center">
                <Loader2 className="w-6 h-6 text-[#8855f6] animate-spin" />
              </div>
            ) : reports.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Nenhum relatório cadastrado</p>
                <p className="text-sm text-slate-400 mt-1">Clique em "Novo Relatório" para adicionar</p>
              </div>
            ) : (
              reports.map((report) => (
                <div
                  key={report.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  data-testid={`report-row-${report.id}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="size-10 rounded-full flex items-center justify-center bg-[#8855f6]/10 text-[#8855f6] shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 truncate flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {report.patientName}
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-3 flex-wrap mt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(report.procedureDate)}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-green-600">
                          <DollarSign className="w-3 h-3" />
                          {formatCurrency(report.reportedValue)}
                        </span>
                        {report.description && (
                          <span className="text-slate-400 truncate max-w-[200px]">
                            {report.description}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(report.id)}
                    disabled={deletingId === report.id}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 ml-2"
                    data-testid={`button-delete-report-${report.id}`}
                    title="Excluir relatório"
                  >
                    {deletingId === report.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}