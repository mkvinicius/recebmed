import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Camera, Mic, PenLine, Loader2, Sparkles } from "lucide-react";
import { getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { convertBlobToWavBase64 } from "@/lib/audioUtils";

export default function Capture() {
  const [, setLocation] = useLocation();
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

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

  const cards = [
    {
      id: "photo",
      icon: Camera,
      title: "Foto",
      description: "Tire uma foto do recibo ou documento e a IA extrai os dados automaticamente",
      gradient: "from-[#8855f6] to-[#6633cc]",
      processing: processingPhoto,
      onClick: () => fileInputRef.current?.click(),
    },
    {
      id: "audio",
      icon: Mic,
      title: isRecording ? "Parar Gravação" : "Áudio",
      description: isRecording ? "Gravando... Clique para parar e processar" : "Dite os dados do procedimento e a IA transcreve e extrai tudo",
      gradient: isRecording ? "from-red-500 to-red-600" : "from-[#6633cc] to-[#4422aa]",
      processing: processingAudio,
      onClick: handleAudioToggle,
    },
    {
      id: "manual",
      icon: PenLine,
      title: "Manual",
      description: "Preencha os dados manualmente no formulário",
      gradient: "from-slate-600 to-slate-700",
      processing: false,
      onClick: () => setLocation("/confirm-entry?method=manual"),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f6f5f8] text-slate-900">
      <div className="max-w-lg mx-auto px-4 sm:px-6 pt-6">
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2" data-testid="text-page-title">Novo Lançamento</h2>
        <p className="text-slate-500 text-sm mb-8">Escolha como deseja registrar o procedimento</p>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} data-testid="input-photo-capture" />

        <div className="space-y-4">
          {cards.map(card => (
            <button
              key={card.id}
              onClick={card.onClick}
              disabled={card.processing}
              className={`w-full text-left bg-gradient-to-br ${card.gradient} rounded-2xl p-6 text-white shadow-lg relative overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 ${isRecording && card.id === "audio" ? "animate-pulse" : ""}`}
              data-testid={`card-${card.id}`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
              <div className="flex items-start gap-4 relative z-10">
                <div className="size-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                  {card.processing ? <Loader2 className="w-7 h-7 animate-spin" /> : <card.icon className="w-7 h-7" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">{card.title}</h3>
                    {card.id !== "manual" && <Sparkles className="w-4 h-4 text-white/60" />}
                  </div>
                  <p className="text-sm text-white/80 mt-1 leading-relaxed">{card.description}</p>
                  {card.processing && <p className="text-xs text-white/60 mt-2">Processando com IA...</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
