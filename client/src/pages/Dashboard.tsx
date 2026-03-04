import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Stethoscope, Bell, Settings, Camera, Mic, PenLine,
  Clock, CreditCard, AlertTriangle, FileText, Building2,
  AlertCircle, Loader2, CheckCircle2, X, Trash2, User, Calendar, Save,
  HelpCircle, ChevronRight, ChevronLeft, Sparkles
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
  entryMethod: string;
  status: string;
  createdAt: string;
}

const TUTORIAL_STEPS = [
  {
    target: "action-card",
    title: "Novo Lançamento",
    text: "Aqui você registra seus procedimentos. Use Foto para tirar foto de agendas, Áudio para ditar, ou Manual para digitar.",
    position: "bottom" as const,
  },
  {
    target: "stats-grid",
    title: "Resumo de Status",
    text: "Acompanhe quantos lançamentos estão Pendentes, Conferidos ou Divergentes. Confira com os relatórios das clínicas.",
    position: "bottom" as const,
  },
  {
    target: "entries-list",
    title: "Seus Lançamentos",
    text: "Toque em qualquer lançamento para editar dados ou mudar o status manualmente. Você pode marcar como Conferido, Pendente ou Divergente.",
    position: "top" as const,
  },
  {
    target: "status-badge-area",
    title: "Mudança Rápida de Status",
    text: "Toque no badge de status (Pendente, Conferido, Divergente) para alterar rapidamente sem abrir o editor completo.",
    position: "top" as const,
  },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [userName, setUserName] = useState("");
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DoctorEntry | null>(null);
  const [editForm, setEditForm] = useState({ patientName: "", procedureDate: "", insuranceProvider: "", description: "", status: "" });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [quickStatusEntry, setQuickStatusEntry] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    const user = getUser();
    if (user) setUserName(user.name);
    fetchEntries(token);

    const tutorialDismissed = localStorage.getItem("medfin_tutorial_dismissed");
    if (!tutorialDismissed) {
      setTimeout(() => setShowTutorial(true), 800);
    }
  }, [setLocation]);

  const quickStatusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!quickStatusEntry) return;
    const handler = (e: MouseEvent) => {
      if (quickStatusRef.current && !quickStatusRef.current.contains(e.target as Node)) {
        setQuickStatusEntry(null);
      }
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
    } catch { /* ignore */ }
    finally { setLoadingEntries(false); }
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
          const res = await fetch("/api/entries/photo", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ image: base64 }),
          });
          const data = await res.json();
          if (data.success && data.extractedData) {
            sessionStorage.setItem("medfin_extracted", JSON.stringify(data.extractedData));
            setLocation("/confirm-entry?method=photo");
          } else {
            toast({ title: "Erro", description: "Não foi possível processar a imagem.", variant: "destructive" });
          }
        } catch {
          toast({ title: "Erro", description: "Falha na conexão com o servidor.", variant: "destructive" });
        } finally { setProcessingPhoto(false); }
      };
      reader.readAsDataURL(file);
    } catch { setProcessingPhoto(false); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAudioToggle = async () => {
    if (isRecording) { mediaRecorderRef.current?.stop(); setIsRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
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
          const res = await fetch("/api/entries/audio", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ audio: wavBase64 }),
          });
          const data = await res.json();
          if (data.success && data.extractedData) {
            sessionStorage.setItem("medfin_extracted", JSON.stringify(data.extractedData));
            setLocation("/confirm-entry?method=audio");
          } else {
            toast({ title: "Erro", description: data.message || "Não foi possível processar o áudio.", variant: "destructive" });
          }
        } catch {
          toast({ title: "Erro", description: "Falha ao processar o áudio. Tente novamente.", variant: "destructive" });
        } finally { setProcessingAudio(false); }
      };
      mediaRecorder.start();
      setIsRecording(true);
      toast({ title: "Gravando...", description: "Dite os dados do procedimento. Clique novamente para parar." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível acessar o microfone.", variant: "destructive" });
    }
  };

  const handleManualEntry = () => { setLocation("/confirm-entry?method=manual"); };

  const openEditModal = (entry: DoctorEntry) => {
    setEditingEntry(entry);
    setEditForm({
      patientName: entry.patientName,
      procedureDate: entry.procedureDate ? new Date(entry.procedureDate).toISOString().split("T")[0] : "",
      insuranceProvider: entry.insuranceProvider,
      description: entry.description,
      status: entry.status,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    const token = getToken();
    if (!token) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/entries/${editingEntry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (res.ok) {
        setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, ...data.entry } : e));
        setEditingEntry(null);
        toast({ title: "Atualizado!", description: "Lançamento atualizado com sucesso." });
      } else {
        toast({ title: "Erro", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao atualizar.", variant: "destructive" });
    } finally { setIsSavingEdit(false); }
  };

  const handleDeleteEntry = async () => {
    if (!editingEntry) return;
    if (!window.confirm("Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.")) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/entries/${editingEntry.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.id !== editingEntry.id));
        setEditingEntry(null);
        toast({ title: "Excluído!", description: "Lançamento removido." });
      } else {
        toast({ title: "Erro", description: "Não foi possível excluir o lançamento.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao excluir.", variant: "destructive" });
    }
  };

  const handleQuickStatusChange = async (entryId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickStatusEntry(null);
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/entries/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...data.entry } : e));
        const statusLabels: Record<string, string> = { pending: "Pendente", reconciled: "Conferido", divergent: "Divergente" };
        toast({ title: "Status atualizado!", description: `Marcado como ${statusLabels[newStatus]}.` });
      } else {
        toast({ title: "Erro", description: data.message || "Não foi possível alterar o status.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
    }
  };

  const dismissTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem("medfin_tutorial_dismissed", "true");
  };

  const nextTutorialStep = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(s => s + 1);
    } else {
      dismissTutorial();
    }
  };

  const prevTutorialStep = () => {
    if (tutorialStep > 0) setTutorialStep(s => s - 1);
  };

  const pendingCount = entries.filter((e) => e.status === "pending").length;
  const reconciledCount = entries.filter((e) => e.status === "reconciled").length;
  const divergentCount = entries.filter((e) => e.status === "divergent").length;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    if (d.toDateString() === yesterday.toDateString()) return `Ontem, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const methodIcon = (method: string) => {
    if (method === "photo") return <Camera className="w-4 h-4" />;
    if (method === "audio") return <Mic className="w-4 h-4" />;
    return <PenLine className="w-4 h-4" />;
  };
  const methodLabel = (method: string) => method === "photo" ? "Foto" : method === "audio" ? "Áudio" : "Manual";

  const statusIcon = (status: string) => {
    if (status === "reconciled") return <CheckCircle2 className="w-5 h-5" />;
    if (status === "divergent") return <AlertCircle className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };
  const statusColor = (status: string) => {
    if (status === "reconciled") return "bg-green-50 text-green-600";
    if (status === "divergent") return "bg-red-50 text-red-500";
    return "bg-[#8855f6]/10 text-[#8855f6]";
  };

  const currentTutorialTarget = showTutorial ? TUTORIAL_STEPS[tutorialStep]?.target : null;

  return (
    <div className="min-h-screen bg-[#f6f5f8] text-slate-900 relative">
      <div className="hero-gradient h-72 w-full absolute top-0 left-0 z-0" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            <div className="size-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Medfin</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setTutorialStep(0); setShowTutorial(true); }}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
              data-testid="button-help"
              title="Ver tutorial"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md" data-testid="button-notifications">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md" data-testid="button-settings">
              <Settings className="w-5 h-5" />
            </button>
            <div className="size-10 rounded-full bg-[#8855f6] flex items-center justify-center text-white font-bold text-sm border-2 border-white/50 cursor-pointer"
              data-testid="avatar-user" onClick={handleLogout} title="Sair da conta">
              {initials}
            </div>
          </div>
        </header>

        <div className="pt-4 pb-8 text-white">
          <div className="flex items-center gap-5">
            <div className="size-20 rounded-2xl border-4 border-white/20 bg-[#8855f6] flex items-center justify-center shadow-xl text-white font-extrabold text-2xl">
              {initials}
            </div>
            <div>
              <h2 className="text-3xl font-extrabold" data-testid="text-greeting">
                Olá, {userName.split(" ").slice(0, 2).join(" ") || "Doutor"}
              </h2>
              <div className="flex items-center gap-2 mt-1 opacity-90">
                <span className="size-2 bg-green-400 rounded-full animate-pulse" />
                <p className="text-sm font-medium uppercase tracking-wider">Status: Online • Resumo Financeiro</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Card */}
        <div className={`glass-card rounded-2xl p-8 shadow-2xl mb-8 relative ${currentTutorialTarget === "action-card" ? "ring-2 ring-[#8855f6] ring-offset-2 z-40" : ""}`}
          data-tutorial="action-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-800">Novo Lançamento</h3>
              <p className="text-slate-500 mt-1">Capture recibos e documentos instantaneamente</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} data-testid="input-photo-capture" />
              <Button onClick={() => fileInputRef.current?.click()} disabled={processingPhoto}
                className="flex items-center gap-2 px-5 py-3 h-auto bg-[#8855f6] text-white rounded-full font-bold shadow-lg shadow-[#8855f6]/30 hover:scale-105 transition-transform hover:bg-[#7744e0]"
                data-testid="button-launch-photo">
                {processingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                {processingPhoto ? "Processando..." : "Foto"}
              </Button>
              <Button onClick={handleAudioToggle} disabled={processingAudio}
                className={`flex items-center gap-2 px-5 py-3 h-auto rounded-full font-bold transition-all ${
                  isRecording ? "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 animate-pulse"
                    : "bg-white border-2 border-[#8855f6]/20 text-[#8855f6] hover:bg-[#8855f6]/5"}`}
                data-testid="button-launch-audio">
                {processingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                {processingAudio ? "Processando..." : isRecording ? "Parar" : "Áudio"}
              </Button>
              <Button onClick={handleManualEntry} variant="outline"
                className="flex items-center gap-2 px-5 py-3 h-auto bg-white border-2 border-slate-200 text-slate-600 rounded-full font-bold hover:bg-slate-50 transition-colors"
                data-testid="button-launch-manual">
                <PenLine className="w-5 h-5" /> Manual
              </Button>
            </div>
          </div>
          {currentTutorialTarget === "action-card" && (
            <TutorialBalloon step={TUTORIAL_STEPS[tutorialStep]} stepIndex={tutorialStep} totalSteps={TUTORIAL_STEPS.length}
              onNext={nextTutorialStep} onPrev={prevTutorialStep} onDismiss={dismissTutorial} />
          )}
        </div>

        {/* Stats Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative ${currentTutorialTarget === "stats-grid" ? "ring-2 ring-[#8855f6] ring-offset-2 rounded-2xl z-40" : ""}`}
          data-tutorial="stats-grid">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Clock className="w-5 h-5" /></span>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{pendingCount}</span>
            </div>
            <p className="text-slate-500 text-sm font-semibold">Pendentes</p>
            <p className="text-2xl font-extrabold text-slate-900" data-testid="stat-pending">{pendingCount} lançamentos</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2.5 bg-green-50 text-green-600 rounded-xl"><CreditCard className="w-5 h-5" /></span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">{reconciledCount}</span>
            </div>
            <p className="text-slate-500 text-sm font-semibold">Conferidos</p>
            <p className="text-2xl font-extrabold text-slate-900" data-testid="stat-reconciled">{reconciledCount} lançamentos</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2.5 bg-red-50 text-red-600 rounded-xl"><AlertTriangle className="w-5 h-5" /></span>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">{divergentCount}</span>
            </div>
            <p className="text-slate-500 text-sm font-semibold">Divergentes</p>
            <p className="text-2xl font-extrabold text-slate-900" data-testid="stat-divergent">{divergentCount} lançamentos</p>
          </div>
          {currentTutorialTarget === "stats-grid" && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full z-50">
              <TutorialBalloon step={TUTORIAL_STEPS[tutorialStep]} stepIndex={tutorialStep} totalSteps={TUTORIAL_STEPS.length}
                onNext={nextTutorialStep} onPrev={prevTutorialStep} onDismiss={dismissTutorial} />
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-12 relative ${currentTutorialTarget === "entries-list" || currentTutorialTarget === "status-badge-area" ? "ring-2 ring-[#8855f6] ring-offset-2 z-40" : ""}`}
          data-tutorial="entries-list">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-lg text-slate-800">Lançamentos Recentes</h3>
            <span className="text-[#8855f6] text-sm font-bold">
              {entries.length} {entries.length === 1 ? "registro" : "registros"}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {loadingEntries ? (
              <div className="px-6 py-12 flex justify-center">
                <Loader2 className="w-6 h-6 text-[#8855f6] animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Nenhum lançamento ainda</p>
                <p className="text-sm text-slate-400 mt-1">Use os botões acima para criar seu primeiro lançamento</p>
              </div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id}
                  onClick={() => openEditModal(entry)}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer active:bg-slate-100"
                  data-testid={`entry-row-${entry.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`size-10 rounded-full flex items-center justify-center ${statusColor(entry.status)}`}>
                      {statusIcon(entry.status)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{entry.description} - {entry.patientName}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                        {formatDate(entry.createdAt)} • {entry.insuranceProvider}
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                          {methodIcon(entry.entryMethod)} {methodLabel(entry.entryMethod)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="relative" data-tutorial="status-badge-area" ref={quickStatusEntry === entry.id ? quickStatusRef : undefined}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setQuickStatusEntry(quickStatusEntry === entry.id ? null : entry.id); }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95 ${
                        entry.status === "reconciled" ? "bg-green-50 text-green-600 hover:bg-green-100"
                        : entry.status === "divergent" ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-amber-50 text-amber-600 hover:bg-amber-100"}`}
                      data-testid={`quick-status-${entry.id}`}
                    >
                      {entry.status === "reconciled" ? "Conferido" : entry.status === "divergent" ? "Divergente" : "Pendente"}
                    </button>
                    {quickStatusEntry === entry.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-30 min-w-[160px] animate-in fade-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}>
                        <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alterar status</p>
                        {[
                          { value: "pending", label: "Pendente", icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-600" },
                          { value: "reconciled", label: "Conferido", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-green-600" },
                          { value: "divergent", label: "Divergente", icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-red-500" },
                        ].filter(s => s.value !== entry.status).map((s) => (
                          <button key={s.value}
                            onClick={(e) => handleQuickStatusChange(entry.id, s.value, e)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition-colors ${s.color}`}
                            data-testid={`quick-set-${s.value}-${entry.id}`}
                          >
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
          {(currentTutorialTarget === "entries-list" || currentTutorialTarget === "status-badge-area") && (
            <div className="px-6 pb-4">
              <TutorialBalloon step={TUTORIAL_STEPS[tutorialStep]} stepIndex={tutorialStep} totalSteps={TUTORIAL_STEPS.length}
                onNext={nextTutorialStep} onPrev={prevTutorialStep} onDismiss={dismissTutorial} />
            </div>
          )}
        </div>
      </div>

      {/* Tutorial overlay */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/20 z-30 pointer-events-none" />
      )}

      {/* Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingEntry(null); }}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Editar Lançamento</h3>
              <button onClick={() => setEditingEntry(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors" data-testid="button-close-edit">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                  <User className="w-3.5 h-3.5 text-[#8855f6]" /> Paciente
                </Label>
                <Input value={editForm.patientName} onChange={(e) => setEditForm(f => ({ ...f, patientName: e.target.value }))}
                  className="h-11 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium"
                  data-testid="edit-patient-name" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-[#8855f6]" /> Data
                  </Label>
                  <Input type="date" value={editForm.procedureDate} onChange={(e) => setEditForm(f => ({ ...f, procedureDate: e.target.value }))}
                    className="h-11 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium"
                    data-testid="edit-procedure-date" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                    <Building2 className="w-3.5 h-3.5 text-[#8855f6]" /> Convênio
                  </Label>
                  <Input value={editForm.insuranceProvider} onChange={(e) => setEditForm(f => ({ ...f, insuranceProvider: e.target.value }))}
                    className="h-11 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium"
                    data-testid="edit-insurance" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                  <FileText className="w-3.5 h-3.5 text-[#8855f6]" /> Procedimento
                </Label>
                <Input value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                  className="h-11 rounded-xl bg-white border-slate-200 focus-visible:ring-[#8855f6]/30 text-slate-800 font-medium"
                  data-testid="edit-description" />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-700 text-sm">Status da Conferência</Label>
                <div className="flex gap-2">
                  {[
                    { value: "pending", label: "Pendente", color: "border-amber-300 bg-amber-50 text-amber-700", desc: "Ainda não conferido" },
                    { value: "reconciled", label: "Conferido", color: "border-green-300 bg-green-50 text-green-700", desc: "Bateu com a clínica" },
                    { value: "divergent", label: "Divergente", color: "border-red-300 bg-red-50 text-red-700", desc: "Divergência encontrada" },
                  ].map((s) => (
                    <button key={s.value}
                      onClick={() => setEditForm(f => ({ ...f, status: s.value }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        editForm.status === s.value ? s.color : "border-slate-200 bg-white text-slate-400"}`}
                      data-testid={`edit-status-${s.value}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Você pode alterar o status manualmente a qualquer momento, mesmo sem relatório da clínica.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button onClick={handleDeleteEntry} variant="outline"
                className="h-12 px-4 rounded-full font-bold border-2 border-red-200 text-red-500 hover:bg-red-50"
                data-testid="button-delete-entry">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSavingEdit}
                className="flex-1 h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold shadow-lg shadow-[#8855f6]/30 hover:shadow-xl transition-all"
                data-testid="button-save-edit">
                {isSavingEdit ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                  : <><Save className="w-4 h-4 mr-2" /> Salvar Alterações</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TutorialBalloon({ step, stepIndex, totalSteps, onNext, onPrev, onDismiss }: {
  step: typeof TUTORIAL_STEPS[number];
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="relative z-50 pointer-events-auto mt-3" data-testid="tutorial-balloon">
      <div className="bg-[#8855f6] text-white rounded-2xl p-5 shadow-2xl shadow-[#8855f6]/30 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white/20 rounded-xl flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-bold text-sm">{step.title}</h4>
              <button onClick={onDismiss} className="p-1 hover:bg-white/20 rounded-full transition-colors ml-2 flex-shrink-0" data-testid="tutorial-dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">{step.text}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/20">
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === stepIndex ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button onClick={onPrev} className="p-1.5 hover:bg-white/20 rounded-full transition-colors" data-testid="tutorial-prev">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <button onClick={onNext}
              className="flex items-center gap-1 bg-white text-[#8855f6] px-3.5 py-1.5 rounded-full text-xs font-bold hover:bg-white/90 transition-colors"
              data-testid="tutorial-next">
              {stepIndex === totalSteps - 1 ? "Entendi!" : "Próximo"}
              {stepIndex < totalSteps - 1 && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <button onClick={onDismiss}
          className="w-full text-center text-xs text-white/60 mt-2 hover:text-white/90 transition-colors"
          data-testid="tutorial-never-show">
          Não mostrar novamente
        </button>
      </div>
    </div>
  );
}