import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TrendingUp, Loader2 } from "lucide-react";
import { getToken } from "@/lib/auth";
import { getLocale, getCurrencyCode } from "@/lib/i18n";

interface ProjectionsData {
  projections: { days30: number; days60: number; days90: number };
  totals: { reconciled: number; divergent: number; total: number };
  entryCount: number;
}

export default function ProjectionsPanel() {
  const { t } = useTranslation();

  const [data, setData] = useState<ProjectionsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/financials/projections", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] mb-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-[#8855f6] animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { label: t("projections.next30"), value: data.projections.days30, gradient: "from-[#8855f6] to-[#6633cc]" },
    { label: t("projections.next60"), value: data.projections.days60, gradient: "from-[#6633cc] to-[#4422aa]" },
    { label: t("projections.next90"), value: data.projections.days90, gradient: "from-[#4422aa] to-[#331188]" },
  ];

  return (
    <div className="mb-8" data-testid="projections-panel">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-[#8855f6]" />
        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t("projections.title")}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <div
            key={i}
            className={`bg-gradient-to-br ${card.gradient} rounded-2xl p-5 text-white shadow-[0_8px_24px_-4px_rgba(136,85,246,0.4),0_4px_8px_-2px_rgba(0,0,0,0.15)] relative overflow-hidden`}
            data-testid={`projection-card-${i}`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
            <p className="text-sm font-semibold text-white/80 mb-1">{card.label}</p>
            <p className="text-2xl font-extrabold" data-testid={`projection-value-${i}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 mt-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100/60 dark:border-slate-700/40 text-center shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)]">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{t("projections.reconciledTotal")}</p>
          <p className="text-sm font-bold text-green-600" data-testid="projection-total-reconciled">{data.totals.reconciled}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100/60 dark:border-slate-700/40 text-center shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)]">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{t("projections.divergentTotal")}</p>
          <p className="text-sm font-bold text-red-500" data-testid="projection-total-divergent">{data.totals.divergent}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100/60 dark:border-slate-700/40 text-center shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)]">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{t("projections.totalLabel")}</p>
          <p className="text-sm font-bold text-[#8855f6]" data-testid="projection-total">{data.totals.total}</p>
        </div>
      </div>
    </div>
  );
}