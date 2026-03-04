import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Stethoscope, Bell, Settings, Camera, Mic, PenLine,
  Clock, CreditCard, AlertTriangle, FileText, Building2,
  AlertCircle, Loader2, CheckCircle2, X, Trash2, User, Calendar, Save,
  HelpCircle, ChevronRight, ChevronLeft, Sparkles, Search, BarChart3,
  DollarSign, ClipboardList, CheckCheck
} from "lucide-react";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { convertBlobToWavBase64 } from "@/lib/audioUtils";

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

const TUTORIAL_STEPS = [
  { target: "action-card", title: "Novo Lançamento", text: "Registre seus procedimentos por Foto (IA extrai os dados), Áudio (dite e a IA transcreve) ou Manual." },
  { target: "stats-grid", title: "Resumo de Status", text: "Veja quantos lançamentos estão Pendentes, Conferidos ou Divergentes. Compare com os relatórios das clínicas." },
  { target: "nav-links", title: "Navegação", text: "Acesse Relatórios da Clínica, Relatórios Financeiros e Configurações por aqui." },
  { target: "entries-list", title: "Seus Lançamentos", text: "Toque em qualquer lançamento para editar. Toque no badge de status para alterá-lo rapidamente." },
];

const formatCurrency = (val: string | number | null | undefined) => {
  if (!val) return null;
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return null;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [userName, setUserName] = useState("");
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DoctorEntry | null>(null);
  const [editForm, setEditForm] = useState({ patientName: "", procedureDate: "", insuranceProvider: "", description: "", status: "", procedureValue: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [quickStatusEntry, setQuickStatusEntry] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [insuranceFilter, setInsuranceFilter] = useState("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    const user = getUser();
    if (user) setUserName(user.name);
    fetchEntries(token);
    fetchNotifications(token);
    const tutorialDismissed = localStorage.getItem("medfin_tutorial_dismissed");
    if (!tutorialDismissed) setTimeout(() => setShowTutorial(true), 800);
  }, [setLocation]);

  const quickStatusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!quickStatusEntry) return;
    const handler = (e: MouseEvent) => {
      if (quickStatusRef.current && !quickStatusRef.current.contains(e.target as Node)) setQuickStatusEntry(null);
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [quickStatusEntry]);

  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifications]);

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

  const handleLogout = () => { clearAuth(); setLocation("/login"); };
  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "DR";

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingPhoto(true);
    const token = getToken();
    if (!token) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await fetch("/api/entries/photo", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ image: base64 }) });
          const data = await res.json();
          if (data.success && data.extractedData) { sessionStorage.setItem("medfin_extracted", JSON.stringify(data.extractedData)); setLocation("/confirm-entry?method=photo"); }
          else toast({ title: "Erro", description: "Não foi possível processar a imagem.", variant: "destructive" });
        } catch { toast({ title: "Erro", description: "Falha na conexão com o servidor.", variant: "destructive" }); }
        finally { setProcessingPhoto(false); }
      };
      reader.readAsDataURL(file);
    } catch { setProcessingPhoto(false); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAudioToggle = async () => {
    if (isRecording) { mediaRecorderRef.current?.stop(); setIsRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setProcessingAudio(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const token = getToken();
        if (!token) { setProcessingAudio(false); return; }
        try {
          const wavBase64 = await convertBlobToWavBase64(audioBlob);
          const res = await fetch("/api/entries/audio", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ audio: wavBase64 }) });
          const data = await res.json();
          if (data.success && data.extractedData) { sessionStorage.setItem("medfin_extracted", JSON.stringify(data.extractedData)); setLocation("/confirm-entry?method=audio"); }
          else toast({ title: "Erro", description: data.message || "Não foi possível processar o áudio.", variant: "destructive" });
        } catch { toast({ title: "Erro", description: "Falha ao processar o áudio.", variant: "destructive" }); }
        finally { setProcessingAudio(false); }
      };
      mediaRecorder.start();
      setIsRecording(true);
      toast({ title: "Gravando...", description: "Dite os dados do procedimento. Clique novamente para parar." });
    } catch { toast({ title: "Erro", description: "Não foi possível acessar o microfone.", variant: "destructive" }); }
  };

  const handleManualEntry = () => setLocation("/confirm-entry?method=manual");

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

  const dismissTutorial = () => { setShowTutorial(false); localStorage.setItem("medfin_tutorial_dismissed", "true"); };
  const nextTutorialStep = () => { if (tutorialStep < TUTORIAL_STEPS.length - 1) setTutorialStep(s => s + 1); else dismissTutorial(); };
  const prevTutorialStep = () => { if (tutorialStep > 0) setTutorialStep(s => s - 1); };

  // Filtering
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

  const pendingCount = entries.filter(e => e.status === "pending").length;
  const reconciledCount = entries.filter(e => e.status === "reconciled").length;
  const divergentCount = entries.filter(e => e.status === "divergent").length;
  const totalValue = entries.reduce((sum, e) => sum + (e.procedureValue ? parseFloat(e.procedureValue) : 0), 0);
  const uniqueInsurances = [...new Set(entries.map(e => e.insuranceProvider).filter(Boolean))];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    if (d.toDateString() === yesterday.toDateString()) return `Ontem, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const methodIcon = (m: string) => m === "photo" ? <Camera className="w-4 h-4" /> : m === "audio" ? <Mic className="w-4 h-4" /> : <PenLine className="w-4 h-4" />;
  const methodLabel = (m: string) => m === "photo" ? "Foto" : m === "audio" ? "Áudio" : "Manual";
  const statusIcon = (s: string) => s === "reconciled" ? <CheckCircle2 className="w-5 h-5" /> : s === "divergent" ? <AlertCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />;
  const statusColor = (s: string) => s === "reconciled" ? "bg-green-50 text-green-600" : s === "divergent" ? "bg-red-50 text-red-500" : "bg-[#8855f6]/10 text-[#8855f6]";
  const currentTutorialTarget = showTutorial ? TUTORIAL_STEPS[tutorialStep]?.target : null;

  return (
    <div className="min-h-screen bg-[#f6f5f8] text-slate-900 relative">
      <div className="hero-gradient h-72 w-full absolute top-0 left-0 z-0" />
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            <div className="size-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md"><Stethoscope className="w-5 h-5" /></div>
            <h1 className="text-xl font-bold tracking-tight">Medfin</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setTutorialStep(0); setShowTutorial(true); }} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md" data-testid="button-help" title="Ver tutorial">
              <HelpCircle className="w-5 h-5" />
            </button>
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifications(!showNotifications)} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md relative" data-testid="button-notifications">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 size-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="badge-unread">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                    <h4 className="font-bold text-sm text-slate-800">Notificações</h4>
                    {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-[#8855f6] font-semibold hover:underline" data-testid="button-mark-all-read"><CheckCheck className="w-3.5 h-3.5 inline mr-1" />Marcar todas</button>}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center"><Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-400">Nenhuma notificação</p></div>
                    ) : notifications.slice(0, 15).map(n => (
                      <div key={n.id} className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${n.read ? "" : "bg-[#8855f6]/5"}`} onClick={async () => { if (!n.read) { const token = getToken(); if (!token) return; try { await fetch(`/api/notifications/${n.id}/read`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } }); setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x)); setUnreadCount(prev => Math.max(0, prev - 1)); } catch {} } }}>
                        <p className="text-sm font-semibold text-slate-700">{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{formatDate(n.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setLocation("/settings")} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md" data-testid="button-settings">
              <Settings className="w-5 h-5" />
            </button>
            <div className="size-10 rounded-full bg-[#8855f6] flex items-center justify-center text-white font-bold text-sm border-2 border-white/50 cursor-pointer" data-testid="avatar-user" onClick={handleLogout} title="Sair da conta">
              {initials}
            </div>
          </div>
        </header>

        {/* Greeting */}
        <div className="pt-4 pb-8 text-white">
          <div className="flex items-center gap-5">
            <div className="size-20 rounded-2xl border-4 border-white/20 bg-[#8855f6] flex items-center justify-center shadow-xl text-white font-extrabold text-2xl">{initials}</div>
            <div>
              <h2 className="text-3xl font-extrabold" data-testid="text-greeting">Olá, {userName.split(" ").slice(0, 2).join(" ") || "Doutor"}</h2>
              <div className="flex items-center gap-2 mt-1 opacity-90">
                <span className="size-2 bg-green-400 rounded-full animate-pulse" />
                <p className="text-sm font-medium uppercase tracking-wider">Status: Online • Resumo Financeiro</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Card */}
        <div className={`glass-card rounded-2xl p-8 shadow-2xl mb-8 relative ${currentTutorialTarget === "action-card" ? "ring-2 ring-[#8855f6] ring-offset-2 z-40" : ""}`} data-tutorial="action-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-800">Novo Lançamento</h3>
              <p className="text-slate-500 mt-1">Capture recibos e documentos instantaneamente</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} data-testid="input-photo-capture" />
              <Button onClick={() => fileInputRef.current?.click()} disabled={processingPhoto} className="flex items-center gap-2 px-5 py-3 h-auto bg-[#8855f6] text-white rounded-full font-bold shadow-lg shadow-[#8855f6]/30 hover:scale-105 transition-transform hover:bg-[#7744e0]" data-testid="button-launch-photo">
                {processingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />} {processingPhoto ? "Processando..." : "Foto"}
              </Button>
              <Button onClick={handleAudioToggle} disabled={processingAudio} className={`flex items-center gap-2 px-5 py-3 h-auto rounded-full font-bold transition-all ${isRecording ? "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 animate-pulse" : "bg-white border-2 border-[#8855f6]/20 text-[#8855f6] hover:bg-[#8855f6]/5"}`} data-testid="button-launch-audio">
                {processingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />} {processingAudio ? "Processando..." : isRecording ? "Parar" : "Áudio"}
              </Button>
              <Button onClick={handleManualEntry} variant="outline" className="flex items-center gap-2 px-5 py-3 h-auto bg-white border-2 border-slate-200 text-slate-600 rounded-full font-bold hover:bg-slate-50 transition-colors" data-testid="button-launch-manual">
                <PenLine className="w-5 h-5" /> Manual
              </Button>
            </div>
          </div>
          {currentTutorialTarget === "action-card" && <TutorialBalloon step={TUTORIAL_STEPS[tutorialStep]} stepIndex={tutorialStep} totalSteps={TUTORIAL_STEPS.length} onNext={nextTutorialStep} onPrev={prevTutorialStep} onDismiss={dismissTutorial} />}
        </div>

        {/* Navigation Links */}
        <div className={`flex flex-wrap gap-3 mb-8 relative ${currentTutorialTarget === "nav-links" ? "ring-2 ring-[#8855f6] ring-offset-2 rounded-2xl z-40 p-2" : ""}`} data-tutorial="nav-links">
          <button onClick={() => setLocation("/clinic-reports")} className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors" data-testid="nav-clinic-reports">
            <ClipboardList className="w-4 h-4 text-[#8855f6]" /> Relatórios da Clínica
          </button>
          <button onClick={() => setLocation("/reports")} className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors" data-testid="nav-reports">
            <BarChart3 className="w-4 h-4 text-[#8855f6]" /> Relatórios Financeiros
          </button>
          <button onClick={() => setLocation("/settings")} className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors" data-testid="nav-settings">
            <Settings className="w-4 h-4 text-[#8855f6]" /> Configurações
          </button>
          {currentTutorialTarget === "nav-links" && <div className="w-full"><TutorialBalloon step={TUTORIAL_STEPS[tutorialStep]} stepIndex={tutorialStep} totalSteps={TUTORIAL_STEPS.length} onNext={nextTutorialStep} onPrev={prevTutorialStep} onDismiss={dismissTutorial} /></div>}
        </div>

        {/* Stats Grid */}
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 relative ${currentTutorialTarget === "stats-grid" ? "ring-2 ring-[#8855f6] ring-offset-2 rounded-2xl z-40" : ""}`} data-tutorial="stats-grid">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Clock className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{pendingCount}</span>
            </div>
            <p className="text-slate-500 text-xs font-semibold">Pendentes</p>
            <p className="text-xl font-extrabold text-slate-900" data-testid="stat-pending">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-green-50 text-green-600 rounded-xl"><CreditCard className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{reconciledCount}</span>
            </div>
            <p className="text-slate-500 text-xs font-semibold">Conferidos</p>
            <p className="text-xl font-extrabold text-slate-900" data-testid="stat-reconciled">{reconciledCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-red-50 text-red-600 rounded-xl"><AlertTriangle className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{divergentCount}</span>
            </div>
            <p className="text-slate-500 text-xs font-semibold">Divergentes</p>
            <p className="text-xl font-extrabold text-slate-900" data-testid="stat-divergent">{divergentCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-[#8855f6]/10 text-[#8855f6] rounded-xl"><DollarSign className="w-4 h-4" /></span>
            </div>
            <p className="text-slate-500 text-xs font-semibold">Total Registrado</p>
            <p className="text-xl font-extrabold text-slate-900" data-testid="stat-total-value">{formatCurrency(totalValue) || "R$ 0,00"}</p>
          </div>
          {currentTutorialTarget === "stats-grid" && <div className="col-span-full"><TutorialBalloon step={TUTORIAL_STEPS[tutorialStep]} stepIndex={tutorialStep} totalSteps={TUTORIAL_STEPS.length} onNext={nextTutorialStep} onPrev={prevTutorialStep} onDismiss={dismissTutorial} /></div>}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar paciente, procedimento..." className="pl-10 h-10 rounded-xl border-slate-200 text-sm" data-testid="input-search" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[{ v: "all", l: "Todos" }, { v: "pending", l: "Pendentes" }, { v: "reconciled", l: "Conferidos" }, { v: "divergent", l: "Divergentes" }].map(f => (
                <button key={f.v} onClick={() => setStatusFilter(f.v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === f.v ? "bg-[#8855f6] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`} data-testid={`filter-status-${f.v}`}>{f.l}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {[{ v: "all", l: "Todas as datas" }, { v: "today", l: "Hoje" }, { v: "week", l: "Esta semana" }, { v: "month", l: "Este mês" }].map(f => (
              <button key={f.v} onClick={() => setDateFilter(f.v)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${dateFilter === f.v ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`} data-testid={`filter-date-${f.v}`}>{f.l}</button>
            ))}
            {uniqueInsurances.length > 1 && (
              <select value={insuranceFilter} onChange={e => setInsuranceFilter(e.target.value)} className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-600 border-0 cursor-pointer" data-testid="filter-insurance">
                <option value="all">Todos os convênios</option>
                {uniqueInsurances.map(ins => <option key={ins} value={ins}>{ins}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Entries List */}
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-12 relative ${currentTutorialTarget === "entries-list" ? "ring-2 ring-[#8855f6] ring-offset-2 z-40" : ""}`} data-tutorial="entries-list">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800">Lançamentos</h3>
            <span className="text-[#8855f6] text-sm font-bold" data-testid="text-entry-count">
              {filteredEntries.length === entries.length ? `${entries.length} registros` : `${filteredEntries.length} de ${entries.length} registros`}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {loadingEntries ? (
              <div className="px-6 py-12 flex justify-center"><Loader2 className="w-6 h-6 text-[#8855f6] animate-spin" /></div>
            ) : filteredEntries.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">{entries.length === 0 ? "Nenhum lançamento ainda" : "Nenhum resultado para os filtros"}</p>
                <p className="text-sm text-slate-400 mt-1">{entries.length === 0 ? "Use os botões acima para criar seu primeiro lançamento" : "Tente alterar os filtros de busca"}</p>
              </div>
            ) : (
              filteredEntries.map(entry => (
                <div key={entry.id} onClick={() => openEditModal(entry)} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer active:bg-slate-100" data-testid={`entry-row-${entry.id}`}>
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`size-10 rounded-full flex items-center justify-center flex-shrink-0 ${statusColor(entry.status)}`}>{statusIcon(entry.status)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800 truncate">{entry.description} - {entry.patientName}</p>
                        {entry.procedureValue && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0" data-testid={`value-${entry.id}`}>{formatCurrency(entry.procedureValue)}</span>}
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                        {formatDate(entry.createdAt)} • {entry.insuranceProvider}
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{methodIcon(entry.entryMethod)} {methodLabel(entry.entryMethod)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="relative flex-shrink-0 ml-2" ref={quickStatusEntry === entry.id ? quickStatusRef : undefined}>
                    <button onClick={e => { e.stopPropagation(); setQuickStatusEntry(quickStatusEntry === entry.id ? null : entry.id); }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95 ${entry.status === "reconciled" ? "bg-green-50 text-green-600 hover:bg-green-100" : entry.status === "divergent" ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-amber-50 text-amber-600 hover:bg-amber-100"}`}
                      data-testid={`quick-status-${entry.id}`}>
                      {entry.status === "reconciled" ? "Conferido" : entry.status === "divergent" ? "Divergente" : "Pendente"}
                    </button>
                    {quickStatusEntry === entry.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 min-w-[160px] animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                        <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alterar status</p>
                        {[
                          { value: "pending", label: "Pendente", icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-600" },
                          { value: "reconciled", label: "Conferido", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-green-600" },
                          { value: "divergent", label: "Divergente", icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-red-500" },
                        ].filter(s => s.value !== entry.status).map(s => (
                          <button key={s.value} onClick={e => handleQuickStatusChange(entry.id, s.value, e)} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition-colors ${s.color}`} data-testid={`quick-set-${s.value}-${entry.id}`}>
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
          {currentTutorialTarget === "entries-list" && <div className="px-6 pb-4"><TutorialBalloon step={TUTORIAL_STEPS[tutorialStep]} stepIndex={tutorialStep} totalSteps={TUTORIAL_STEPS.length} onNext={nextTutorialStep} onPrev={prevTutorialStep} onDismiss={dismissTutorial} /></div>}
        </div>
      </div>

      {showTutorial && <div className="fixed inset-0 bg-black/20 z-30 pointer-events-none" />}

      {/* Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setEditingEntry(null); }}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Editar Lançamento</h3>
              <button onClick={() => setEditingEntry(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors" data-testid="button-close-edit"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="px-6 py-6 space-y-5">
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 flex items-center gap-2 text-sm"><User className="w-3.5 h-3.5 text-[#8855f6]" /> Paciente</Label>
                <Input value={editForm.patientName} onChange={e => setEditForm(f => ({ ...f, patientName: e.target.value }))} className="h-11 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium" data-testid="edit-patient-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700 flex items-center gap-2 text-sm"><Calendar className="w-3.5 h-3.5 text-[#8855f6]" /> Data</Label>
                  <Input type="date" value={editForm.procedureDate} onChange={e => setEditForm(f => ({ ...f, procedureDate: e.target.value }))} className="h-11 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium" data-testid="edit-procedure-date" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700 flex items-center gap-2 text-sm"><Building2 className="w-3.5 h-3.5 text-[#8855f6]" /> Convênio</Label>
                  <Input value={editForm.insuranceProvider} onChange={e => setEditForm(f => ({ ...f, insuranceProvider: e.target.value }))} className="h-11 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium" data-testid="edit-insurance" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700 flex items-center gap-2 text-sm"><FileText className="w-3.5 h-3.5 text-[#8855f6]" /> Procedimento</Label>
                  <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="h-11 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium" data-testid="edit-description" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700 flex items-center gap-2 text-sm"><DollarSign className="w-3.5 h-3.5 text-[#8855f6]" /> Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={editForm.procedureValue} onChange={e => setEditForm(f => ({ ...f, procedureValue: e.target.value }))} placeholder="0.00" className="h-11 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium" data-testid="edit-value" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-sm">Status da Conferência</Label>
                <div className="flex gap-2">
                  {[
                    { value: "pending", label: "Pendente", color: "border-amber-300 bg-amber-50 text-amber-700" },
                    { value: "reconciled", label: "Conferido", color: "border-green-300 bg-green-50 text-green-700" },
                    { value: "divergent", label: "Divergente", color: "border-red-300 bg-red-50 text-red-700" },
                  ].map(s => (
                    <button key={s.value} onClick={() => setEditForm(f => ({ ...f, status: s.value }))} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${editForm.status === s.value ? s.color : "border-slate-200 bg-white text-slate-400"}`} data-testid={`edit-status-${s.value}`}>{s.label}</button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">Altere o status manualmente a qualquer momento.</p>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
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

function TutorialBalloon({ step, stepIndex, totalSteps, onNext, onPrev, onDismiss }: { step: typeof TUTORIAL_STEPS[number]; stepIndex: number; totalSteps: number; onNext: () => void; onPrev: () => void; onDismiss: () => void; }) {
  return (
    <div className="relative z-50 pointer-events-auto mt-3" data-testid="tutorial-balloon">
      <div className="bg-[#8855f6] text-white rounded-2xl p-5 shadow-2xl shadow-[#8855f6]/30 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white/20 rounded-xl flex-shrink-0"><Sparkles className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-bold text-sm">{step.title}</h4>
              <button onClick={onDismiss} className="p-1 hover:bg-white/20 rounded-full transition-colors ml-2 flex-shrink-0" data-testid="tutorial-dismiss"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">{step.text}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/20">
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => <div key={i} className={`h-1.5 rounded-full transition-all ${i === stepIndex ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />)}
          </div>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && <button onClick={onPrev} className="p-1.5 hover:bg-white/20 rounded-full transition-colors" data-testid="tutorial-prev"><ChevronLeft className="w-4 h-4" /></button>}
            <button onClick={onNext} className="flex items-center gap-1 bg-white text-[#8855f6] px-3.5 py-1.5 rounded-full text-xs font-bold hover:bg-white/90 transition-colors" data-testid="tutorial-next">
              {stepIndex === totalSteps - 1 ? "Entendi!" : "Próximo"} {stepIndex < totalSteps - 1 && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <button onClick={onDismiss} className="w-full text-center text-xs text-white/60 mt-2 hover:text-white/90 transition-colors" data-testid="tutorial-never-show">Não mostrar novamente</button>
      </div>
    </div>
  );
}