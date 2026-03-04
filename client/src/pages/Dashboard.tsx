import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Stethoscope, Bell, Settings, Camera, Mic, PenLine,
  Clock, CreditCard, AlertTriangle, FileText, Building2,
  AlertCircle, Loader2, CheckCircle2
} from "lucide-react";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

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

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [userName, setUserName] = useState("");
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
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
  }, [setLocation]);

  const fetchEntries = async (token: string) => {
    try {
      const res = await fetch("/api/entries", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        clearAuth();
        setLocation("/login");
        return;
      }
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
        } finally {
          setProcessingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setProcessingPhoto(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAudioToggle = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setProcessingAudio(true);

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          const token = getToken();
          if (!token) return;

          try {
            const res = await fetch("/api/entries/audio", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ audio: base64 }),
            });
            const data = await res.json();
            if (data.success && data.extractedData) {
              sessionStorage.setItem("medfin_extracted", JSON.stringify(data.extractedData));
              setLocation("/confirm-entry?method=audio");
            } else {
              toast({ title: "Erro", description: data.message || "Não foi possível processar o áudio.", variant: "destructive" });
            }
          } catch {
            toast({ title: "Erro", description: "Falha na conexão com o servidor.", variant: "destructive" });
          } finally {
            setProcessingAudio(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast({ title: "Gravando...", description: "Dite os dados do procedimento. Clique novamente para parar." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível acessar o microfone.", variant: "destructive" });
    }
  };

  const handleManualEntry = () => {
    setLocation("/confirm-entry?method=manual");
  };

  const pendingCount = entries.filter((e) => e.status === "pending").length;
  const reconciledCount = entries.filter((e) => e.status === "reconciled").length;
  const divergentCount = entries.filter((e) => e.status === "divergent").length;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    if (d.toDateString() === yesterday.toDateString()) return `Ontem, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const methodIcon = (method: string) => {
    if (method === "photo") return <Camera className="w-4 h-4" />;
    if (method === "audio") return <Mic className="w-4 h-4" />;
    return <PenLine className="w-4 h-4" />;
  };

  const methodLabel = (method: string) => {
    if (method === "photo") return "Foto";
    if (method === "audio") return "Áudio";
    return "Manual";
  };

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
            <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md" data-testid="button-notifications">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md" data-testid="button-settings">
              <Settings className="w-5 h-5" />
            </button>
            <div
              className="size-10 rounded-full bg-[#8855f6] flex items-center justify-center text-white font-bold text-sm border-2 border-white/50 cursor-pointer"
              data-testid="avatar-user"
              onClick={handleLogout}
              title="Sair da conta"
            >
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
        <div className="glass-card rounded-2xl p-8 shadow-2xl mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-800">Novo Lançamento</h3>
              <p className="text-slate-500 mt-1">Capture recibos e documentos instantaneamente</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoCapture}
                data-testid="input-photo-capture"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={processingPhoto}
                className="flex items-center gap-2 px-5 py-3 h-auto bg-[#8855f6] text-white rounded-full font-bold shadow-lg shadow-[#8855f6]/30 hover:scale-105 transition-transform hover:bg-[#7744e0]"
                data-testid="button-launch-photo"
              >
                {processingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                {processingPhoto ? "Processando..." : "Foto"}
              </Button>
              <Button
                onClick={handleAudioToggle}
                disabled={processingAudio}
                className={`flex items-center gap-2 px-5 py-3 h-auto rounded-full font-bold transition-all ${
                  isRecording
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 animate-pulse"
                    : "bg-white border-2 border-[#8855f6]/20 text-[#8855f6] hover:bg-[#8855f6]/5"
                }`}
                data-testid="button-launch-audio"
              >
                {processingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                {processingAudio ? "Processando..." : isRecording ? "Parar" : "Áudio"}
              </Button>
              <Button
                onClick={handleManualEntry}
                variant="outline"
                className="flex items-center gap-2 px-5 py-3 h-auto bg-white border-2 border-slate-200 text-slate-600 rounded-full font-bold hover:bg-slate-50 transition-colors"
                data-testid="button-launch-manual"
              >
                <PenLine className="w-5 h-5" />
                Manual
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{pendingCount}</span>
            </div>
            <p className="text-slate-500 text-sm font-semibold">Pendentes</p>
            <p className="text-2xl font-extrabold text-slate-900" data-testid="stat-pending">{pendingCount} lançamentos</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                <CreditCard className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">{reconciledCount}</span>
            </div>
            <p className="text-slate-500 text-sm font-semibold">Conferidos</p>
            <p className="text-2xl font-extrabold text-slate-900" data-testid="stat-reconciled">{reconciledCount} lançamentos</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">{divergentCount}</span>
            </div>
            <p className="text-slate-500 text-sm font-semibold">Divergentes</p>
            <p className="text-2xl font-extrabold text-slate-900" data-testid="stat-divergent">{divergentCount} lançamentos</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-12">
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
              entries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`size-10 rounded-full flex items-center justify-center ${statusColor(entry.status)}`}>
                      {statusIcon(entry.status)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{entry.description} - {entry.patientName}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        {formatDate(entry.createdAt)} • {entry.insuranceProvider}
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                          {methodIcon(entry.entryMethod)} {methodLabel(entry.entryMethod)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    entry.status === "reconciled" ? "bg-green-50 text-green-600"
                    : entry.status === "divergent" ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-600"
                  }`}>
                    {entry.status === "reconciled" ? "Conferido" : entry.status === "divergent" ? "Divergente" : "Pendente"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}