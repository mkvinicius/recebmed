import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Camera, Mic, PenLine, Loader2, Sparkles, Stethoscope, AlertTriangle, X } from "lucide-react";
import { getToken, getUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { convertBlobToWavBase64 } from "@/lib/audioUtils";
import { useTranslation } from "react-i18next";
import { getLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

const MAX_IMAGE_SIZE_MB = 20;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

interface DuplicateEntry {
  id: string;
  patientName: string;
  procedureDate: string;
  description: string;
  procedureValue: string | null;
  createdAt: string;
}

interface DuplicateWarning {
  type: string;
  existingEntries?: DuplicateEntry[];
  duplicates?: Array<{ imageIndex: number; existingEntries: DuplicateEntry[] }>;
}

export default function Capture() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState("");
  const [processingAudio, setProcessingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const pendingImageRef = useRef<string | null>(null);
  const pendingImagesRef = useRef<string[] | null>(null);

  const user = getUser();
  const profilePhotoUrl = user?.profilePhotoUrl || null;
  const userName = user?.name || "";
  const initials = userName ? userName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "Dr";
  const locale = getLocale();

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const fmtDate = (dateStr: string) => formatDate(dateStr, "short");

  const processPhoto = async (base64: string, skipDuplicateCheck: boolean) => {
    const token = getToken();
    if (!token) return;
    setProcessingPhoto(true);
    setPhotoProgress(t("capture.processingImage"));
    try {
      const res = await fetch("/api/entries/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: base64, skipDuplicateCheck }),
      });
      const data = await res.json();
      if (data.success && data.duplicateWarning) {
        pendingImageRef.current = base64;
        setDuplicateWarning(data.duplicateWarning);
        setProcessingPhoto(false);
        setPhotoProgress("");
        return;
      }
      if (data.success && data.extractedData) {
        const payload = { entries: data.extractedData, sourceUrl: data.sourceUrl || null, imageHash: data.imageHash || null };
        sessionStorage.setItem("recebmed_extracted", JSON.stringify(payload));
        setLocation("/confirm-entry?method=photo");
      } else {
        toast({ title: t("common.error"), description: t("capture.imageError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } finally {
      setProcessingPhoto(false);
      setPhotoProgress("");
    }
  };

  const processBatchPhotos = async (images: string[], skipDuplicateCheck: boolean) => {
    const token = getToken();
    if (!token) return;
    setProcessingPhoto(true);
    setPhotoProgress(t("capture.processingImages", { count: images.length }));
    try {
      const res = await fetch("/api/entries/photos-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ images, skipDuplicateCheck }),
      });
      const data = await res.json();
      if (data.success && data.duplicateWarning) {
        pendingImagesRef.current = images;
        setDuplicateWarning(data.duplicateWarning);
        setProcessingPhoto(false);
        setPhotoProgress("");
        return;
      }
      if (data.success && data.extractedData && data.extractedData.length > 0) {
        const payload = { entries: data.extractedData, sourceUrl: null };
        sessionStorage.setItem("recebmed_extracted", JSON.stringify(payload));
        if (data.skippedDuplicates) {
          toast({ title: t("capture.duplicateBatchTitle"), description: t("capture.duplicateBatchDesc", { count: data.skippedDuplicates }) });
        } else {
          toast({ title: t("capture.recordsFound", { count: data.totalEntries }), description: t("capture.extractedFrom", { count: data.totalImages }) });
        }
        setLocation("/confirm-entry?method=photo");
      } else {
        toast({ title: t("common.error"), description: t("capture.imagesError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } finally {
      setProcessingPhoto(false);
      setPhotoProgress("");
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const oversized = Array.from(files).filter(f => f.size > MAX_IMAGE_SIZE_BYTES);
    if (oversized.length > 0) {
      toast({ title: t("common.error"), description: t("capture.fileTooLarge", { max: MAX_IMAGE_SIZE_MB }), variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (files.length === 1) {
      const base64 = await readFileAsDataURL(files[0]);
      await processPhoto(base64, false);
    } else {
      setProcessingPhoto(true);
      setPhotoProgress(t("capture.readingImages", { count: files.length }));
      const images: string[] = [];
      for (let i = 0; i < files.length; i++) {
        images.push(await readFileAsDataURL(files[i]));
      }
      await processBatchPhotos(images, false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDuplicateContinue = async () => {
    setDuplicateWarning(null);
    if (pendingImageRef.current) {
      const img = pendingImageRef.current;
      pendingImageRef.current = null;
      await processPhoto(img, true);
    } else if (pendingImagesRef.current) {
      const imgs = pendingImagesRef.current;
      pendingImagesRef.current = null;
      await processBatchPhotos(imgs, true);
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateWarning(null);
    pendingImageRef.current = null;
    pendingImagesRef.current = null;
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
          if (data.success && data.extractedData) {
            const payload = { entries: data.extractedData, sourceUrl: data.sourceUrl || null };
            sessionStorage.setItem("recebmed_extracted", JSON.stringify(payload));
            setLocation("/confirm-entry?method=audio");
          }
          else toast({ title: t("common.error"), description: data.message || t("capture.audioError"), variant: "destructive" });
        } catch { toast({ title: t("common.error"), description: t("capture.audioProcessError"), variant: "destructive" }); }
        finally { setProcessingAudio(false); }
      };
      mediaRecorder.start();
      setIsRecording(true);
      toast({ title: t("capture.recordingToast"), description: t("capture.recordingToastDesc") });
    } catch { toast({ title: t("common.error"), description: t("capture.micError"), variant: "destructive" }); }
  };

  const cards = [
    {
      id: "photo",
      icon: Camera,
      title: t("capture.photoTitle"),
      description: t("capture.photoDesc"),
      gradient: "from-[#8855f6] to-[#6633cc]",
      processing: processingPhoto,
      progressText: photoProgress,
      onClick: () => fileInputRef.current?.click(),
    },
    {
      id: "audio",
      icon: Mic,
      title: isRecording ? t("capture.stopRecording") : t("capture.audioTitle"),
      description: isRecording ? t("capture.recordingDesc") : t("capture.audioDesc"),
      gradient: isRecording ? "from-red-500 to-red-600" : "from-[#6633cc] to-[#4422aa]",
      processing: processingAudio,
      onClick: handleAudioToggle,
    },
    {
      id: "manual",
      icon: PenLine,
      title: t("capture.manualTitle"),
      description: t("capture.manualDesc"),
      gradient: "from-slate-600 to-slate-700",
      processing: false,
      onClick: () => setLocation("/confirm-entry?method=manual"),
    },
  ];

  const duplicateEntries = duplicateWarning?.existingEntries || duplicateWarning?.duplicates?.flatMap(d => d.existingEntries) || [];

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6">
        <div className="pt-1 pb-4 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("capture.title")}</h2>
          <p className="text-white/80 mt-1 text-sm">{t("capture.subtitle")}</p>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoCapture} data-testid="input-photo-capture" />

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
                  {card.processing && <p className="text-xs text-white/60 mt-2">{card.progressText || t("capture.processingAI")}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>

      {duplicateWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 relative" data-testid="modal-duplicate-warning">
            <button onClick={handleDuplicateCancel} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" data-testid="button-close-duplicate">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {duplicateWarning.type === "exact_image" || duplicateWarning.type === "exact_image_batch"
                  ? t("capture.duplicateImageTitle")
                  : t("capture.duplicateDataTitle")}
              </h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {duplicateWarning.type === "exact_image" || duplicateWarning.type === "exact_image_batch"
                ? t("capture.duplicateImageDesc")
                : t("capture.duplicateDataDesc")}
            </p>

            {duplicateEntries.length > 0 && (
              <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
                {duplicateEntries.map((entry, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm" data-testid={`duplicate-entry-${i}`}>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{entry.patientName}</p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {entry.description} — {formatDate(entry.procedureDate)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDuplicateCancel}
                className="flex-1 px-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                data-testid="button-duplicate-cancel"
              >
                {t("capture.duplicateCancel")}
              </button>
              <button
                onClick={handleDuplicateContinue}
                className="flex-1 px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-lg transition-colors"
                data-testid="button-duplicate-continue"
              >
                {t("capture.duplicateContinue")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
