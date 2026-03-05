import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Search, FileText, Clock, CheckCircle2, AlertCircle,
  Camera, Mic, PenLine, Loader2, X, Trash2, Save,
  User, Calendar, Building2, DollarSign
} from "lucide-react";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface DoctorEntry {
  id: string;
  patientName: string;
  procedureDate: string;
  insuranceProvider: string;
  description: string;
  procedureValue: string | null;
  entryMethod: string;
  status: string;
  createdAt: string;
}

const formatCurrency = (val: string | number | null | undefined) => {
  if (!val) return null;
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return null;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  if (d.toDateString() === yesterday.toDateString()) return `Ontem, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

export default function Entries() {
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [insuranceFilter, setInsuranceFilter] = useState("all");
  const [editingEntry, setEditingEntry] = useState<DoctorEntry | null>(null);
  const [editForm, setEditForm] = useState({ patientName: "", procedureDate: "", insuranceProvider: "", description: "", status: "", procedureValue: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [quickStatusEntry, setQuickStatusEntry] = useState<string | null>(null);
  const quickStatusRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    fetchEntries(token);
  }, [setLocation]);

  useEffect(() => {
    if (!quickStatusEntry) return;
    const handler = (e: MouseEvent) => {
      if (quickStatusRef.current && !quickStatusRef.current.contains(e.target as Node)) setQuickStatusEntry(null);
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [quickStatusEntry]);

  const fetchEntries = async (token: string) => {
    try {
      const res = await fetch("/api/entries", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
      const data = await res.json();
      if (res.ok) setEntries(data.entries || []);
    } catch { }
    finally { setLoadingEntries(false); }
  };

  const openEditModal = (entry: DoctorEntry) => {
    setEditingEntry(entry);
    setEditForm({
      patientName: entry.patientName,
      procedureDate: entry.procedureDate ? new Date(entry.procedureDate).toISOString().split("T")[0] : "",
      insuranceProvider: entry.insuranceProvider,
      description: entry.description,
      status: entry.status,
      procedureValue: entry.procedureValue || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    const token = getToken();
    if (!token) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/entries/${editingEntry.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(editForm) });
      const data = await res.json();
      if (res.ok) { setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, ...data.entry } : e)); setEditingEntry(null); toast({ title: "Atualizado!", description: "Lançamento atualizado com sucesso." }); }
      else toast({ title: "Erro", description: data.message, variant: "destructive" });
    } catch { toast({ title: "Erro", description: "Falha ao atualizar.", variant: "destructive" }); }
    finally { setIsSavingEdit(false); }
  };

  const handleDeleteEntry = async () => {
    if (!editingEntry) return;
    if (!window.confirm("Tem certeza que deseja excluir este lançamento?")) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/entries/${editingEntry.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { setEntries(prev => prev.filter(e => e.id !== editingEntry.id)); setEditingEntry(null); toast({ title: "Excluído!", description: "Lançamento removido." }); }
      else toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    } catch { toast({ title: "Erro", description: "Falha ao excluir.", variant: "destructive" }); }
  };

  const handleQuickStatusChange = async (entryId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickStatusEntry(null);
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/entries/${entryId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }) });
      const data = await res.json();
      if (res.ok) { setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...data.entry } : e)); toast({ title: "Status atualizado!", description: `Marcado como ${{ pending: "Pendente", reconciled: "Conferido", divergent: "Divergente" }[newStatus]}.` }); }
      else toast({ title: "Erro", description: data.message || "Falha.", variant: "destructive" });
    } catch { toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" }); }
  };

  const filteredEntries = entries.filter(e => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!e.patientName.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q) && !e.insuranceProvider.toLowerCase().includes(q)) return false;
    }
    if (insuranceFilter !== "all" && e.insuranceProvider !== insuranceFilter) return false;
    if (dateFilter !== "all") {
      const d = new Date(e.procedureDate || e.createdAt);
      const now = new Date();
      if (dateFilter === "today" && d.toDateString() !== now.toDateString()) return false;
      if (dateFilter === "week") { const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7); if (d < weekAgo) return false; }
      if (dateFilter === "month") { const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1); if (d < monthAgo) return false; }
    }
    return true;
  });

  const uniqueInsurances = [...new Set(entries.map(e => e.insuranceProvider).filter(Boolean))];
  const methodIcon = (m: string) => m === "photo" ? <Camera className="w-4 h-4" /> : m === "audio" ? <Mic className="w-4 h-4" /> : <PenLine className="w-4 h-4" />;
  const methodLabel = (m: string) => m === "photo" ? "Foto" : m === "audio" ? "Áudio" : "Manual";
  const statusIcon = (s: string) => s === "reconciled" ? <CheckCircle2 className="w-5 h-5" /> : s === "divergent" ? <AlertCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />;
  const statusColor = (s: string) => s === "reconciled" ? "bg-green-50 dark:bg-green-900/30 text-green-600" : s === "divergent" ? "bg-red-50 dark:bg-red-900/30 text-red-500" : "bg-[#8855f6]/10 text-[#8855f6]";

  const user = getUser();
  const profilePhotoUrl = user?.profilePhotoUrl || null;
  const userInitials = user?.name ? user.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "Dr";

  return (
    <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-slate-100 relative">
      <div className="hero-gradient h-56 w-full absolute top-0 left-0 z-0" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            <div className="size-11 bg-gradient-to-br from-white/30 to-white/10 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/30 shadow-lg overflow-hidden" data-testid="avatar-profile">
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-white tracking-wide">{userInitials}</span>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight">Medfin</h1>
          </div>
        </header>

        <div className="pt-2 pb-8 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">Lançamentos</h2>
          <p className="text-white/80 mt-1 text-sm">Gerencie todos os seus procedimentos</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar paciente, procedimento..." className="pl-10 h-10 rounded-xl border-slate-200 text-sm" data-testid="input-search" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[{ v: "all", l: "Todos" }, { v: "pending", l: "Pendentes" }, { v: "reconciled", l: "Conferidos" }, { v: "divergent", l: "Divergentes" }].map(f => (
                <button key={f.v} onClick={() => setStatusFilter(f.v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === f.v ? "bg-[#8855f6] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`} data-testid={`filter-status-${f.v}`}>{f.l}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {[{ v: "all", l: "Todas as datas" }, { v: "today", l: "Hoje" }, { v: "week", l: "Esta semana" }, { v: "month", l: "Este mês" }].map(f => (
              <button key={f.v} onClick={() => setDateFilter(f.v)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${dateFilter === f.v ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900" : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`} data-testid={`filter-date-${f.v}`}>{f.l}</button>
            ))}
            {uniqueInsurances.length > 1 && (
              <select value={insuranceFilter} onChange={e => setInsuranceFilter(e.target.value)} className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-0 cursor-pointer" data-testid="filter-insurance">
                <option value="all">Todos os convênios</option>
                {uniqueInsurances.map(ins => <option key={ins} value={ins}>{ins}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <span className="font-bold text-slate-800 dark:text-slate-200">Todos os Lançamentos</span>
            <span className="text-[#8855f6] text-sm font-bold" data-testid="text-entry-count">
              {filteredEntries.length === entries.length ? `${entries.length} registros` : `${filteredEntries.length} de ${entries.length}`}
            </span>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {loadingEntries ? (
              <div className="px-6 py-12 flex justify-center"><Loader2 className="w-6 h-6 text-[#8855f6] animate-spin" /></div>
            ) : filteredEntries.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">{entries.length === 0 ? "Nenhum lançamento ainda" : "Nenhum resultado para os filtros"}</p>
              </div>
            ) : (
              filteredEntries.map(entry => (
                <div key={entry.id} onClick={() => openEditModal(entry)} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer active:bg-slate-100 dark:active:bg-slate-700" data-testid={`entry-row-${entry.id}`}>
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`size-10 rounded-full flex items-center justify-center flex-shrink-0 ${statusColor(entry.status)}`}>{statusIcon(entry.status)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{entry.description} - {entry.patientName}</p>
                        {entry.procedureValue && <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full flex-shrink-0" data-testid={`value-${entry.id}`}>{formatCurrency(entry.procedureValue)}</span>}
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                        {formatDate(entry.createdAt)} • {entry.insuranceProvider}
                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">{methodIcon(entry.entryMethod)} {methodLabel(entry.entryMethod)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="relative flex-shrink-0 ml-2" ref={quickStatusEntry === entry.id ? quickStatusRef : undefined}>
                    <button onClick={e => { e.stopPropagation(); setQuickStatusEntry(quickStatusEntry === entry.id ? null : entry.id); }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95 ${entry.status === "reconciled" ? "bg-green-50 dark:bg-green-900/30 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50" : entry.status === "divergent" ? "bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50"}`}
                      data-testid={`quick-status-${entry.id}`}>
                      {entry.status === "reconciled" ? "Conferido" : entry.status === "divergent" ? "Divergente" : "Pendente"}
                    </button>
                    {quickStatusEntry === entry.id && (
                      <div className="absolute right-0 bottom-full mb-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 py-1 z-30 min-w-[160px] animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                        <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alterar status</p>
                        {[
                          { value: "pending", label: "Pendente", icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-600" },
                          { value: "reconciled", label: "Conferido", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-green-600" },
                          { value: "divergent", label: "Divergente", icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-red-500" },
                        ].filter(s => s.value !== entry.status).map(s => (
                          <button key={s.value} onClick={e => handleQuickStatusChange(entry.id, s.value, e)} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${s.color}`} data-testid={`quick-set-${s.value}-${entry.id}`}>
                            {s.icon} {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {editingEntry && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setEditingEntry(null); }}>
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 sm:mx-4 fixed bottom-0 sm:relative sm:bottom-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Editar Lançamento</h3>
              <button onClick={() => setEditingEntry(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" data-testid="button-close-edit"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="px-6 py-6 space-y-5 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><User className="w-3.5 h-3.5 text-[#8855f6]" /> Paciente</Label>
                <Input value={editForm.patientName} onChange={e => setEditForm(f => ({ ...f, patientName: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-200 font-medium" data-testid="edit-patient-name" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><Calendar className="w-3.5 h-3.5 text-[#8855f6]" /> Data</Label>
                <Input type="date" value={editForm.procedureDate} onChange={e => setEditForm(f => ({ ...f, procedureDate: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-200 font-medium" data-testid="edit-procedure-date" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><Building2 className="w-3.5 h-3.5 text-[#8855f6]" /> Convênio</Label>
                <Input value={editForm.insuranceProvider} onChange={e => setEditForm(f => ({ ...f, insuranceProvider: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-200 font-medium" data-testid="edit-insurance" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><FileText className="w-3.5 h-3.5 text-[#8855f6]" /> Procedimento</Label>
                <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-200 font-medium" data-testid="edit-description" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><DollarSign className="w-3.5 h-3.5 text-[#8855f6]" /> Valor (R$)</Label>
                <Input type="number" step="0.01" min="0" value={editForm.procedureValue} onChange={e => setEditForm(f => ({ ...f, procedureValue: e.target.value }))} placeholder="0.00" className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-200 font-medium" data-testid="edit-value" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Status da Conferência</Label>
                <div className="flex gap-2">
                  {[
                    { value: "pending", label: "Pendente", color: "border-amber-300 bg-amber-50 text-amber-700" },
                    { value: "reconciled", label: "Conferido", color: "border-green-300 bg-green-50 text-green-700" },
                    { value: "divergent", label: "Divergente", color: "border-red-300 bg-red-50 text-red-700" },
                  ].map(s => (
                    <button key={s.value} onClick={() => setEditForm(f => ({ ...f, status: s.value }))} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${editForm.status === s.value ? s.color : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400"}`} data-testid={`edit-status-${s.value}`}>{s.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3 border-t border-slate-100 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
              <Button onClick={handleDeleteEntry} variant="outline" className="h-12 px-4 rounded-full font-bold border-2 border-red-200 text-red-500 hover:bg-red-50" data-testid="button-delete-entry"><Trash2 className="w-4 h-4" /></Button>
              <Button onClick={handleSaveEdit} disabled={isSavingEdit} className="flex-1 h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold shadow-lg shadow-[#8855f6]/30 hover:shadow-xl transition-all" data-testid="button-save-edit">
                {isSavingEdit ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="w-4 h-4 mr-2" /> Salvar Alterações</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
