import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bell, Clock, CreditCard, AlertTriangle,
  FileText, AlertCircle, Loader2, CheckCircle2, X, Trash2, Save,
  User, Calendar, Building2, DollarSign, CheckCheck, Camera, Mic, PenLine,
  ChevronRight, Search
} from "lucide-react";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import ProjectionsPanel from "@/components/ProjectionsPanel";

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

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
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

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [userName, setUserName] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [editingEntry, setEditingEntry] = useState<DoctorEntry | null>(null);
  const [editForm, setEditForm] = useState({ patientName: "", procedureDate: "", insuranceProvider: "", description: "", status: "", procedureValue: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DoctorEntry[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    const user = getUser();
    if (user) {
      setUserName(user.name);
      setProfilePhotoUrl(user.profilePhotoUrl || null);
    }
    fetchEntries(token);
    fetchNotifications(token);
  }, [setLocation]);

  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifications]);

  useEffect(() => {
    if (!showSearch) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSearch]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`/api/entries/search?q=${encodeURIComponent(value.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
        const data = await res.json();
        if (res.ok) setSearchResults(data.entries || []);
        else setSearchResults([]);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
  };

  const fetchEntries = async (token: string) => {
    try {
      const res = await fetch("/api/entries", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
      const data = await res.json();
      if (res.ok) setEntries(data.entries || []);
    } catch { }
    finally { setLoadingEntries(false); }
  };

  const fetchNotifications = async (token: string) => {
    try {
      const res = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch { }
  };

  const markAllRead = async () => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch("/api/notifications/read-all", { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { }
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

  const pendingCount = entries.filter(e => e.status === "pending").length;
  const reconciledCount = entries.filter(e => e.status === "reconciled").length;
  const divergentCount = entries.filter(e => e.status === "divergent").length;
  const totalValue = entries.reduce((sum, e) => sum + (e.procedureValue ? parseFloat(e.procedureValue) : 0), 0);
  const recentEntries = entries.slice(0, 5);

  const methodIcon = (m: string) => m === "photo" ? <Camera className="w-4 h-4" /> : m === "audio" ? <Mic className="w-4 h-4" /> : <PenLine className="w-4 h-4" />;
  const statusColor = (s: string) => s === "reconciled" ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400" : s === "divergent" ? "bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400" : "bg-[#8855f6]/10 text-[#8855f6]";
  const statusIcon = (s: string) => s === "reconciled" ? <CheckCircle2 className="w-5 h-5" /> : s === "divergent" ? <AlertCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />;

  return (
    <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-white relative">
      <div className="hero-gradient h-56 w-full absolute top-0 left-0 z-0" />
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            <div className="size-11 bg-gradient-to-br from-white/30 to-white/10 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/30 shadow-lg overflow-hidden" data-testid="avatar-profile">
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-white tracking-wide">{userName ? userName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "Dr"}</span>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight">Medfin</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifications(!showNotifications)} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md relative" data-testid="button-notifications">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 size-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="badge-unread">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">Notificações</h4>
                    {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-[#8855f6] font-semibold hover:underline" data-testid="button-mark-all-read"><CheckCheck className="w-3.5 h-3.5 inline mr-1" />Marcar todas</button>}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center"><Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" /><p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma notificação</p></div>
                    ) : notifications.slice(0, 15).map(n => (
                      <div key={n.id} className={`px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${n.read ? "" : "bg-[#8855f6]/5"}`} onClick={async () => { if (!n.read) { const token = getToken(); if (!token) return; try { await fetch(`/api/notifications/${n.id}/read`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } }); setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x)); setUnreadCount(prev => Math.max(0, prev - 1)); } catch {} } }}>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{n.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{formatDate(n.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="pt-2 pb-4 text-white">
          <p className="text-white/70 text-sm" data-testid="text-greeting-label">{new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite"},</p>
          <h2 className="text-2xl font-extrabold mt-0.5" data-testid="text-greeting">Dr. {userName.split(" ").slice(0, 2).join(" ") || "Doutor"}</h2>
          <p className="text-white/60 text-sm mt-1">Resumo financeiro do seu consultório</p>
        </div>

        <div className="relative mb-5" ref={searchRef}>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => { handleSearchChange(e.target.value); if (!showSearch) setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              placeholder="Buscar paciente, procedimento, convênio..."
              className="w-full pl-11 pr-10 h-12 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border border-white/50 dark:border-slate-700 shadow-lg text-slate-800 dark:text-slate-100 text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#8855f6]/40 transition-all"
              data-testid="input-smart-search"
            />
            {searchLoading && <Loader2 className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-[#8855f6] animate-spin" />}
            {searchQuery && !searchLoading && (
              <button onClick={() => { setSearchQuery(""); setSearchResults([]); setShowSearch(false); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {showSearch && searchQuery.length >= 2 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-80 overflow-y-auto">
              {searchLoading ? (
                <div className="px-6 py-8 text-center"><Loader2 className="w-5 h-5 text-[#8855f6] animate-spin mx-auto mb-2" /><p className="text-xs text-slate-400">Buscando...</p></div>
              ) : searchResults.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <Search className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Nenhum resultado para "{searchQuery}"</p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}</p>
                  </div>
                  {searchResults.map(entry => (
                    <div
                      key={entry.id}
                      onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); openEditModal(entry); }}
                      className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-b border-slate-50 dark:border-slate-800 last:border-b-0"
                      data-testid={`search-result-${entry.id}`}
                    >
                      <div className={`size-8 rounded-full flex items-center justify-center flex-shrink-0 ${statusColor(entry.status)}`}>{statusIcon(entry.status)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{entry.description} - {entry.patientName}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{entry.insuranceProvider} • {formatDate(entry.createdAt)}</p>
                      </div>
                      {entry.procedureValue && <span className="text-xs font-bold text-green-600 dark:text-green-400 flex-shrink-0">{formatCurrency(entry.procedureValue)}</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="stats-grid">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl"><Clock className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">{pendingCount}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Pendentes</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white" data-testid="stat-pending">{pendingCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl"><CreditCard className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">{reconciledCount}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Conferidos</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white" data-testid="stat-reconciled">{reconciledCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl"><AlertTriangle className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">{divergentCount}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Divergentes</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white" data-testid="stat-divergent">{divergentCount}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-[#8855f6]/10 text-[#8855f6] rounded-xl"><DollarSign className="w-4 h-4" /></span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Total</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white" data-testid="stat-total-value">{formatCurrency(totalValue) || "R$ 0,00"}</p>
          </div>
        </div>

        <ProjectionsPanel />

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] mb-6">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Últimos Lançamentos</h3>
            <button onClick={() => setLocation("/entries")} className="text-xs text-[#8855f6] font-bold flex items-center gap-1 hover:underline" data-testid="link-view-all">
              Ver todos <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {loadingEntries ? (
              <div className="px-6 py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[#8855f6] animate-spin" /></div>
            ) : recentEntries.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Nenhum lançamento ainda</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Use a aba Captura para criar seu primeiro</p>
              </div>
            ) : (
              recentEntries.map(entry => (
                <div key={entry.id} onClick={() => openEditModal(entry)} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer" data-testid={`entry-row-${entry.id}`}>
                  <div className={`size-9 rounded-full flex items-center justify-center flex-shrink-0 ${statusColor(entry.status)}`}>{statusIcon(entry.status)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{entry.description} - {entry.patientName}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDate(entry.createdAt)} • {entry.insuranceProvider}
                    </p>
                  </div>
                  {entry.procedureValue && <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full flex-shrink-0">{formatCurrency(entry.procedureValue)}</span>}
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
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Editar Lançamento</h3>
              <button onClick={() => setEditingEntry(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" data-testid="button-close-edit"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="px-6 py-6 space-y-5 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><User className="w-3.5 h-3.5 text-[#8855f6]" /> Paciente</Label>
                <Input value={editForm.patientName} onChange={e => setEditForm(f => ({ ...f, patientName: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium" data-testid="edit-patient-name" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><Calendar className="w-3.5 h-3.5 text-[#8855f6]" /> Data</Label>
                <Input type="date" value={editForm.procedureDate} onChange={e => setEditForm(f => ({ ...f, procedureDate: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium" data-testid="edit-procedure-date" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><Building2 className="w-3.5 h-3.5 text-[#8855f6]" /> Convênio</Label>
                <Input value={editForm.insuranceProvider} onChange={e => setEditForm(f => ({ ...f, insuranceProvider: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium" data-testid="edit-insurance" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><FileText className="w-3.5 h-3.5 text-[#8855f6]" /> Procedimento</Label>
                <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium" data-testid="edit-description" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><DollarSign className="w-3.5 h-3.5 text-[#8855f6]" /> Valor (R$)</Label>
                <Input type="number" step="0.01" min="0" value={editForm.procedureValue} onChange={e => setEditForm(f => ({ ...f, procedureValue: e.target.value }))} placeholder="0.00" className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium" data-testid="edit-value" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Status da Conferência</Label>
                <div className="flex gap-2">
                  {[
                    { value: "pending", label: "Pendente", color: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
                    { value: "reconciled", label: "Conferido", color: "border-green-300 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/30 dark:text-green-400" },
                    { value: "divergent", label: "Divergente", color: "border-red-300 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-400" },
                  ].map(s => (
                    <button key={s.value} onClick={() => setEditForm(f => ({ ...f, status: s.value }))} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${editForm.status === s.value ? s.color : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`} data-testid={`edit-status-${s.value}`}>{s.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3 border-t border-slate-100 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
              <Button onClick={handleDeleteEntry} variant="outline" className="h-12 px-4 rounded-full font-bold border-2 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30" data-testid="button-delete-entry"><Trash2 className="w-4 h-4" /></Button>
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
