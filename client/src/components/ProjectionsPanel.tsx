import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getToken } from "@/lib/auth";

interface ProductionData {
  production: { currentMonth: number; previousMonth: number };
  entryCount: number;
}

export default function ProjectionsPanel() {
  const { t } = useTranslation();

  const [data, setData] = useState<ProductionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch("/api/financials/projections", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-card border border-slate-100/60 dark:border-slate-700/40 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { currentMonth, previousMonth } = data.production;

  const diff = previousMonth > 0 ? currentMonth - previousMonth : 0;
  const pctChange = previousMonth > 0 ? Math.round((diff / previousMonth) * 100) : 0;

  return (
    <div className="mb-8" data-testid="production-summary-panel">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-[#8855f6]" />
        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t("projections.title")}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className="bg-gradient-to-br from-[#8855f6] to-[#6633cc] rounded-2xl p-5 text-white shadow-[0_8px_24px_-4px_rgba(136,85,246,0.4),0_4px_8px_-2px_rgba(0,0,0,0.15)] relative overflow-hidden"
          data-testid="production-current-month"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
          <p className="text-sm font-semibold text-white/80 mb-2">{t("projections.currentMonth")}</p>
          <p className="text-4xl font-extrabold" data-testid="production-current-value">{currentMonth}</p>
          <p className="text-xs text-white/60 mt-1">{t("projections.cases")}</p>
        </div>
        <div
          className="bg-gradient-to-br from-[#6633cc] to-[#4422aa] rounded-2xl p-5 text-white shadow-[0_8px_24px_-4px_rgba(136,85,246,0.3),0_4px_8px_-2px_rgba(0,0,0,0.15)] relative overflow-hidden"
          data-testid="production-previous-month"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
          <p className="text-sm font-semibold text-white/80 mb-2">{t("projections.previousMonth")}</p>
          <p className="text-4xl font-extrabold" data-testid="production-previous-value">{previousMonth}</p>
          <p className="text-xs text-white/60 mt-1">{t("projections.cases")}</p>
        </div>
      </div>
      {previousMonth > 0 && (
        <div className="mt-3 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100/60 dark:border-slate-700/40 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] flex items-center justify-center gap-2">
          {diff > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : diff < 0 ? (
            <TrendingDown className="w-4 h-4 text-red-500" />
          ) : (
            <Minus className="w-4 h-4 text-slate-400" />
          )}
          <p className={`text-sm font-bold ${diff > 0 ? "text-green-600 dark:text-green-400" : diff < 0 ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>
            {diff > 0 ? "+" : ""}{diff} {t("projections.cases")} ({diff > 0 ? "+" : ""}{pctChange}%)
          </p>
        </div>
      )}
    </div>
  );
}
