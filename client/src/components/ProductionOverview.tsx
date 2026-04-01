import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Activity, DollarSign, CheckCircle2, Stethoscope,
  BarChart3, ChevronDown, ChevronUp, X, User
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { getToken, clearAuth } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";
import { formatCurrency as fmtCurrency, formatDate } from "@/lib/utils";

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
  divergenceReason?: string | null;
}

const PRODUCTION_COLORS = { particular: "#8855f6", sus: "#3b82f6", convenio: "#22c55e" };

type PeriodMode = "weekly" | "monthly" | "yearly";

function classifyInsurance(provider: string): "particular" | "sus" | "convenio" {
  const lower = provider.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!lower || lower === "particular" || lower === "privado" || lower === "private") return "particular";
  if (lower === "sus" || lower.includes("sistema unico") || lower.includes("unified health")) return "sus";
  return "convenio";
}

export default function ProductionOverview() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("monthly");
  const [activeFilter, setActiveFilter] = useState<"all" | "particular" | "sus" | "convenio" | null>(null);
  const locale = getLocale();

  const formatCurrency = (value: number): string => fmtCurrency(value) || "—";

  const getMonthLabel = (date: Date): string =>
    date.toLocaleDateString(locale, { month: "short", year: "2-digit" });

  const getWeekLabel = (date: Date): string => {
    const day = date.getDate();
    const month = date.toLocaleDateString(locale, { month: "short" });
    return `${day} ${month}`;
  };

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const res = await fetch("/api/entries", { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
        const data = await res.json();
        if (res.ok) setEntries(data.entries || []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [setLocation]);

  const totalProduction = entries.length;
  const productionByType = useMemo(() => {
    let particular = 0, sus = 0, convenio = 0;
    entries.forEach(e => {
      const cat = classifyInsurance(e.insuranceProvider);
      if (cat === "particular") particular++;
      else if (cat === "sus") sus++;
      else convenio++;
    });
    return { particular, sus, convenio };
  }, [entries]);

  const toggleFilter = (f: "all" | "particular" | "sus" | "convenio") => {
    setActiveFilter(prev => prev === f ? null : f);
  };

  const cardFilteredEntries = useMemo(() => {
    if (!activeFilter) return [];
    if (activeFilter === "all") return entries;
    return entries.filter(e => classifyInsurance(e.insuranceProvider) === activeFilter);
  }, [entries, activeFilter]);

  const now = new Date();
  const productionData = useMemo(() => {
    let startDate: Date;
    if (entries.length > 0) {
      const dates = entries.map(e => new Date(e.procedureDate || e.createdAt).getTime());
      startDate = new Date(Math.min(...dates));
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    }
    const endDate = new Date();

    if (periodMode === "weekly") {
      const buckets: Record<string, { particular: number; sus: number; convenio: number; label: string }> = {};
      const cur = new Date(startDate);
      cur.setDate(cur.getDate() - cur.getDay());
      while (cur <= endDate) {
        const key = cur.toISOString().split("T")[0];
        buckets[key] = { particular: 0, sus: 0, convenio: 0, label: getWeekLabel(cur) };
        cur.setDate(cur.getDate() + 7);
      }
      entries.forEach(e => {
        const d = new Date(e.procedureDate || e.createdAt);
        const weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const key = weekStart.toISOString().split("T")[0];
        const category = classifyInsurance(e.insuranceProvider);
        if (buckets[key]) buckets[key][category]++;
      });
      return Object.values(buckets);
    }

    if (periodMode === "yearly") {
      const buckets: Record<string, { particular: number; sus: number; convenio: number; label: string }> = {};
      const startY = startDate.getFullYear();
      const endY = endDate.getFullYear();
      for (let y = startY; y <= endY; y++) {
        buckets[String(y)] = { particular: 0, sus: 0, convenio: 0, label: String(y) };
      }
      entries.forEach(e => {
        const d = new Date(e.procedureDate || e.createdAt);
        const key = String(d.getFullYear());
        const category = classifyInsurance(e.insuranceProvider);
        if (buckets[key]) buckets[key][category]++;
      });
      return Object.values(buckets);
    }

    const buckets: Record<string, { particular: number; sus: number; convenio: number; label: string }> = {};
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cur <= endDate) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = { particular: 0, sus: 0, convenio: 0, label: getMonthLabel(cur) };
      cur.setMonth(cur.getMonth() + 1);
    }
    entries.forEach(e => {
      const d = new Date(e.procedureDate || e.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const category = classifyInsurance(e.insuranceProvider);
      if (buckets[key]) buckets[key][category]++;
    });
    return Object.values(buckets);
  }, [entries, periodMode]);

  const periodTabs: { key: PeriodMode; label: string }[] = [
    { key: "weekly", label: t("reports.weekly") },
    { key: "monthly", label: t("reports.monthly") },
    { key: "yearly", label: t("reports.yearly") },
  ];

  if (loading) {
    return (
      <div className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-[340px] bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (entries.length === 0) return null;

  return (
    <div className="mb-6" data-testid="production-overview">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <button onClick={() => toggleFilter("all")} className={`bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border text-left active:scale-[0.97] transition-all ${activeFilter === "all" ? "border-[#8855f6] ring-2 ring-[#8855f6]/20" : "border-slate-100/60 dark:border-slate-700/40"}`} data-testid="card-total-production">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 bg-[#8855f6]/10 text-[#8855f6] rounded-xl"><Activity className="w-4 h-4" /></span>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t("reports.totalProduction")}</span>
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100" data-testid="value-total-production">{totalProduction}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("reports.procedures")}</p>
            {activeFilter === "all" ? <ChevronUp className="w-3.5 h-3.5 text-[#8855f6]" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />}
          </div>
        </button>

        <button onClick={() => toggleFilter("particular")} className={`bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border text-left active:scale-[0.97] transition-all ${activeFilter === "particular" ? "border-[#8855f6] ring-2 ring-[#8855f6]/20" : "border-slate-100/60 dark:border-slate-700/40"}`} data-testid="card-particular">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 bg-[#8855f6]/10 text-[#8855f6] rounded-xl"><DollarSign className="w-4 h-4" /></span>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t("reports.particularLabel")}</span>
          </div>
          <p className="text-xl font-extrabold text-[#8855f6]" data-testid="value-particular">{productionByType.particular}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("reports.procedures")}</p>
            {activeFilter === "particular" ? <ChevronUp className="w-3.5 h-3.5 text-[#8855f6]" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />}
          </div>
        </button>

        <button onClick={() => toggleFilter("sus")} className={`bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border text-left active:scale-[0.97] transition-all ${activeFilter === "sus" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-100/60 dark:border-slate-700/40"}`} data-testid="card-sus">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl"><CheckCircle2 className="w-4 h-4" /></span>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">SUS</span>
          </div>
          <p className="text-xl font-extrabold text-blue-600" data-testid="value-sus">{productionByType.sus}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("reports.procedures")}</p>
            {activeFilter === "sus" ? <ChevronUp className="w-3.5 h-3.5 text-blue-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />}
          </div>
        </button>

        <button onClick={() => toggleFilter("convenio")} className={`bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border text-left active:scale-[0.97] transition-all ${activeFilter === "convenio" ? "border-green-500 ring-2 ring-green-500/20" : "border-slate-100/60 dark:border-slate-700/40"}`} data-testid="card-convenio">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 rounded-xl"><Stethoscope className="w-4 h-4" /></span>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t("reports.convenioLabel")}</span>
          </div>
          <p className="text-xl font-extrabold text-green-600" data-testid="value-convenio">{productionByType.convenio}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("reports.procedures")}</p>
            {activeFilter === "convenio" ? <ChevronUp className="w-3.5 h-3.5 text-green-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />}
          </div>
        </button>
      </div>

      {activeFilter && (
        <div className="mb-4 bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 overflow-hidden" data-testid="filtered-entries-list">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {activeFilter === "all" ? t("reports.totalProduction") : activeFilter === "particular" ? t("reports.particularLabel") : activeFilter === "sus" ? "SUS" : t("reports.convenioLabel")}
              <span className="ml-2 text-xs font-semibold text-slate-400 dark:text-slate-500">({cardFilteredEntries.length})</span>
            </p>
            <button onClick={() => setActiveFilter(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400" data-testid="close-filter-list">
              <X className="w-4 h-4" />
            </button>
          </div>
          {cardFilteredEntries.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">{t("dashboard.noEntries")}</div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
              {cardFilteredEntries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => setLocation(`/entry/${entry.id}`)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors"
                  data-testid={`filtered-entry-${entry.id}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#8855f6]/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-[#8855f6]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{entry.patientName}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {entry.description || entry.insuranceProvider} · {formatDate(entry.procedureDate, "short")}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {entry.procedureValue && (
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {formatCurrency(parseFloat(entry.procedureValue))}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-card border border-slate-100/60 dark:border-slate-700/40" data-testid="chart-production">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#8855f6]" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">{t("reports.productionChart")}</h3>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5" data-testid="period-selector">
            {periodTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setPeriodMode(tab.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  periodMode === tab.key
                    ? "bg-[#8855f6] text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
                data-testid={`period-${tab.key}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: PRODUCTION_COLORS.particular }} />
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t("reports.particularLabel")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: PRODUCTION_COLORS.sus }} />
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">SUS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: PRODUCTION_COLORS.convenio }} />
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t("reports.convenioLabel")}</span>
          </div>
        </div>

        {productionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={productionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:[&>line]:stroke-slate-700" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload) return null;
                  const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                  return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-3 shadow-lg text-sm">
                      <p className="font-bold text-slate-800 dark:text-slate-100 mb-1.5">{label}</p>
                      {payload.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                            <span className="text-slate-600 dark:text-slate-300">{p.name}</span>
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-100">{p.value}</span>
                        </div>
                      ))}
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700 flex justify-between font-bold text-slate-800 dark:text-slate-100">
                        <span>Total</span>
                        <span>{total}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="particular" name={t("reports.particularLabel")} stackId="production" fill={PRODUCTION_COLORS.particular} radius={[0, 0, 0, 0]} />
              <Bar dataKey="sus" name="SUS" stackId="production" fill={PRODUCTION_COLORS.sus} radius={[0, 0, 0, 0]} />
              <Bar dataKey="convenio" name={t("reports.convenioLabel")} stackId="production" fill={PRODUCTION_COLORS.convenio} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
            {t("reports.noDataForPeriod")}
          </div>
        )}
      </div>
    </div>
  );
}
