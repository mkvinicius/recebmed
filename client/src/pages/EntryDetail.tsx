import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowLeft, User, Calendar, Building2, FileText, DollarSign, Clock, CheckCircle2, AlertCircle, Camera, Mic, PenLine, Loader2, Stethoscope } from "lucide-react";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import { getLocale, getCurrencyCode } from "@/lib/i18n";

interface EntryData {
  id: string;
  patientName: string;
  procedureDate: string;
  insuranceProvider: string;
  description: string;
  procedureValue: string | null;
  entryMethod: string;
  sourceUrl: string | null;
  status: string;
  createdAt: string;
}

const formatCurrency = (val: string | number | null | undefined) => {
  if (!val) return null;
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return null;
  return num.toLocaleString(getLocale(), { style: "currency", currency: getCurrencyCode() });
};

export default function EntryDetail() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const [entry, setEntry] = useState<EntryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const locale = getLocale();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
  };

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    fetchEntry(token);
  }, [params.id]);

  const fetchEntry = async (token: string) => {
    try {
      const res = await fetch(`/api/entries/${params.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
      const data = await res.json();
      if (res.ok) setEntry(data.entry);
      else setError(data.message || t("entryDetail.fetchError"));
    } catch {
      setError(t("common.serverConnectionFailed"));
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = (s: string) => s === "reconciled" ? t("common.reconciled") : s === "divergent" ? t("common.divergent") : t("common.pending");
  const statusStyle = (s: string) => s === "reconciled" ? "bg-green-50 dark:bg-green-900/30 text-green-600 border-green-200 dark:border-green-800" : s === "divergent" ? "bg-red-50 dark:bg-red-900/30 text-red-500 border-red-200 dark:border-red-800" : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 border-amber-200 dark:border-amber-800";
  const statusIcon = (s: string) => s === "reconciled" ? <CheckCircle2 className="w-5 h-5" /> : s === "divergent" ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />;
  const methodIcon = (m: string) => m === "photo" ? <Camera className="w-4 h-4" /> : m === "audio" ? <Mic className="w-4 h-4" /> : <PenLine className="w-4 h-4" />;
  const methodLabel = (m: string) => m === "photo" ? t("entryDetail.photoAI") : m === "audio" ? t("entryDetail.audioAI") : t("common.manual");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#8855f6] animate-spin" data-testid="loading-spinner" />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-slate-100">
        <div className="hero-gradient h-56 w-full absolute top-0 left-0 z-0" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between py-6">
            <div className="flex items-center gap-3 text-white">
              {(() => { const u = getUser(); const p = u?.profilePhotoUrl; const i = u?.name ? u.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "Dr"; return (
                <div className="size-14 bg-gradient-to-br from-white/30 to-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border-2 border-white/30 shadow-lg overflow-hidden" data-testid="avatar-profile">
                  {p ? <img src={p} alt={t("common.profile")} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-white tracking-wide">{i}</span>}
                </div>
              ); })()}
              <h1 className="text-xl font-bold tracking-tight">RecebMed</h1>
            </div>
            <button onClick={() => window.history.back()} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm font-semibold transition-colors backdrop-blur-md" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" /> {t("common.back")}
            </button>
          </header>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)] text-center mt-8">
            <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium" data-testid="text-error">{error || t("entryDetail.notFound")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-slate-100">
      <div className="hero-gradient h-56 w-full absolute top-0 left-0 z-0" />
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            {(() => { const u = getUser(); const p = u?.profilePhotoUrl; const i = u?.name ? u.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "Dr"; return (
              <div className="size-14 bg-gradient-to-br from-white/30 to-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border-2 border-white/30 shadow-lg overflow-hidden" data-testid="avatar-profile">
                {p ? <img src={p} alt={t("common.profile")} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-white tracking-wide">{i}</span>}
              </div>
            ); })()}
            <h1 className="text-xl font-bold tracking-tight">RecebMed</h1>
          </div>
          <button onClick={() => window.history.back()} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm font-semibold transition-colors backdrop-blur-md" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" /> {t("common.back")}
          </button>
        </header>

        <div className="pt-2 pb-8 text-white">
          <h2 className="text-2xl font-extrabold">{t("entryDetail.title")}</h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)] overflow-hidden mt-4">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`size-10 rounded-full flex items-center justify-center ${statusStyle(entry.status)}`}>
                {statusIcon(entry.status)}
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100" data-testid="text-entry-description">{entry.description}</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500">ID: {entry.id.slice(0, 8)}...</p>
              </div>
            </div>
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${statusStyle(entry.status)}`} data-testid="text-entry-status">
              {statusLabel(entry.status)}
            </span>
          </div>

          <div className="px-6 py-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  <User className="w-4 h-4 text-[#8855f6]" /> {t("common.patient")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-patient-name">{entry.patientName}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  <Calendar className="w-4 h-4 text-[#8855f6]" /> {t("entryDetail.procedureDate")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-procedure-date">{formatDate(entry.procedureDate)}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  <Building2 className="w-4 h-4 text-[#8855f6]" /> {t("common.insurance")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-insurance">{entry.insuranceProvider}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  <DollarSign className="w-4 h-4 text-[#8855f6]" /> {t("entryDetail.value")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-procedure-value">
                  {formatCurrency(entry.procedureValue) || t("entryDetail.notProvided")}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  <FileText className="w-4 h-4 text-[#8855f6]" /> {t("common.procedure")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-description">{entry.description}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                  {methodIcon(entry.entryMethod)} {t("entryDetail.entryMethod")}
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg" data-testid="text-entry-method">{methodLabel(entry.entryMethod)}</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold mb-1">
                <Clock className="w-4 h-4 text-[#8855f6]" /> {t("entryDetail.registeredAt")}
              </div>
              <p className="text-slate-800 dark:text-slate-100 font-medium" data-testid="text-created-at">
                {new Date(entry.createdAt).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            {entry.sourceUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-semibold">
                  {entry.entryMethod === "audio" ? (
                    <><Mic className="w-4 h-4 text-[#8855f6]" /> {t("entryDetail.sourceAudio")}</>
                  ) : (
                    <><Camera className="w-4 h-4 text-[#8855f6]" /> {t("entryDetail.sourceImage")}</>
                  )}
                </div>
                <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800 p-2">
                  {entry.entryMethod === "audio" ? (
                    <audio controls className="w-full" data-testid="audio-source">
                      <source src={entry.sourceUrl} />
                    </audio>
                  ) : (
                    <img
                      src={entry.sourceUrl}
                      alt={t("entryDetail.sourceImage")}
                      className="w-full rounded-lg object-contain max-h-96"
                      data-testid="img-source"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
