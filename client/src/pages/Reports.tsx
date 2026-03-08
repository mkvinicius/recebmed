import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Stethoscope, DollarSign, CheckCircle2, Clock,
  AlertTriangle, TrendingUp, PieChart as PieChartIcon, BarChart3, Loader2, FileUp, Calendar, X, Activity
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { getToken, clearAuth } from "@/lib/auth";
import { getLocale, getCurrencyCode } from "@/lib/i18n";

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

const PIE_COLORS = ["#8855f6", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899"];
const PRODUCTION_COLORS = { particular: "#8855f6", sus: "#3b82f6", convenio: "#22c55e" };

type PeriodMode = "weekly" | "monthly" | "yearly";

function classifyInsurance(provider: string): "particular" | "sus" | "convenio" {
  const lower = provider.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!lower || lower === "particular" || lower === "privado" || lower === "private") return "particular";
  if (lower === "sus" || lower.includes("sistema unico") || lower.includes("unified health")) return "sus";
  return "convenio";
}

export default function Reports() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("monthly");
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0];
  const defaultTo = now.toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  const locale = getLocale();
  const currency = getCurrencyCode();

  const formatCurrency = (value: number): string => {
    return value.toLocaleString(locale, { style: "currency", currency });
  };

  const getMonthLabel = (date: Date): string => {
    return date.toLocaleDateString(locale, { month: "short", year: "2-digit" });
  };

  const getWeekLabel = (date: Date): string => {
    const day = date.getDate();
    const month = date.toLocaleDateString(locale, { month: "short" });
    return `${day} ${month}`;
  };

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    (async () => {
      try {
        const res = await fetch("/api/entries", { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
        const data = await res.json();
        if (res.ok) setEntries(data.entries || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [setLocation]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const d = new Date(e.procedureDate || e.createdAt);
      if (dateFrom) {
        const from = new Date(dateFrom + "T00:00:00");
        if (d < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo + "T23:59:59");
        if (d > to) return false;
      }
      return true;
    });
  }, [entries, dateFrom, dateTo]);

  const totalValue = useMemo(() =>
    filteredEntries.reduce((sum, e) => sum + (e.procedureValue ? parseFloat(e.procedureValue) : 0), 0),
    [filteredEntries]
  );

  const reconciledValue = useMemo(() =>
    filteredEntries.filter(e => e.status === "reconciled").reduce((sum, e) => sum + (e.procedureValue ? parseFloat(e.procedureValue) : 0), 0),
    [filteredEntries]
  );

  const pendingValue = useMemo(() =>
    filteredEntries.filter(e => e.status === "pending").reduce((sum, e) => sum + (e.procedureValue ? parseFloat(e.procedureValue) : 0), 0),
    [filteredEntries]
  );

  const divergentValue = useMemo(() =>
    filteredEntries.filter(e => e.status === "divergent").reduce((sum, e) => sum + (e.procedureValue ? parseFloat(e.procedureValue) : 0), 0),
    [filteredEntries]
  );

  const productionData = useMemo(() => {
    const startDate = dateFrom ? new Date(dateFrom + "T00:00:00") : new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const endDate = dateTo ? new Date(dateTo + "T23:59:59") : new Date();

    if (periodMode === "weekly") {
      const buckets: Record<string, { particular: number; sus: number; convenio: number; label: string }> = {};
      const cur = new Date(startDate);
      cur.setDate(cur.getDate() - cur.getDay());
      while (cur <= endDate) {
        const key = cur.toISOString().split("T")[0];
        buckets[key] = { particular: 0, sus: 0, convenio: 0, label: getWeekLabel(cur) };
        cur.setDate(cur.getDate() + 7);
      }
      filteredEntries.forEach(e => {
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
      filteredEntries.forEach(e => {
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
    filteredEntries.forEach(e => {
      const d = new Date(e.procedureDate || e.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const category = classifyInsurance(e.insuranceProvider);
      if (buckets[key]) buckets[key][category]++;
    });
    return Object.values(buckets);
  }, [filteredEntries, dateFrom, dateTo, periodMode]);

  const insuranceCountData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredEntries.forEach(e => {
      const provider = e.insuranceProvider || t("reports.noInsurance");
      map[provider] = (map[provider] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEntries, t]);

  const topInsurers = useMemo(() => {
    const map: Record<string, { value: number; count: number }> = {};
    filteredEntries.forEach(e => {
      const provider = e.insuranceProvider || t("reports.noInsurance");
      if (!map[provider]) map[provider] = { value: 0, count: 0 };
      map[provider].value += e.procedureValue ? parseFloat(e.procedureValue) : 0;
      map[provider].count++;
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredEntries, t]);

  const totalProduction = filteredEntries.length;
  const productionByType = useMemo(() => {
    let particular = 0, sus = 0, convenio = 0;
    filteredEntries.forEach(e => {
      const cat = classifyInsurance(e.insuranceProvider);
      if (cat === "particular") particular++;
      else if (cat === "sus") sus++;
      else convenio++;
    });
    return { particular, sus, convenio };
  }, [filteredEntries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-[#8855f6] animate-spin" />
      </div>
    );
  }

  const periodTabs: { key: PeriodMode; label: string }[] = [
    { key: "weekly", label: t("reports.weekly") },
    { key: "monthly", label: t("reports.monthly") },
    { key: "yearly", label: t("reports.yearly") },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-1 pb-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("reports.title")}</h2>
              <p className="text-sm opacity-90">{t("reports.subtitle")}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)] p-4 mb-6">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">{t("reports.period")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-400">{t("entries.dateFrom")}</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 cursor-pointer w-[120px]"
                data-testid="filter-date-from"
              />
              <span className="text-[11px] font-semibold text-slate-400">{t("entries.dateTo")}</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 cursor-pointer w-[120px]"
                data-testid="filter-date-to"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  data-testid="button-clear-dates"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <button
            onClick={() => setLocation("/reconciliation")}
            className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)] hover:border-[#8855f6]/40 transition-all text-left"
            data-testid="link-reconciliation"
          >
            <div className="size-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{t("reports.reconciliation")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("reports.checkPDFs")}</p>
            </div>
          </button>
          <button
            onClick={() => setLocation("/clinic-reports")}
            className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)] hover:border-[#8855f6]/40 transition-all text-left"
            data-testid="link-clinic-reports"
          >
            <div className="size-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{t("reports.clinicReports")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("reports.extractedData")}</p>
            </div>
          </button>
          <button
            onClick={() => setLocation("/import")}
            className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)] hover:border-[#8855f6]/40 transition-all text-left"
            data-testid="link-import"
          >
            <div className="size-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{t("reports.retroactiveAudit")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("reports.importHistorical")}</p>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)]" data-testid="card-total-production">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-[#8855f6]/10 text-[#8855f6] rounded-xl"><Activity className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t("reports.totalProduction")}</span>
            </div>
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100" data-testid="value-total-production">{totalProduction}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t("reports.procedures")}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)]" data-testid="card-particular">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-[#8855f6]/10 text-[#8855f6] rounded-xl"><DollarSign className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t("reports.particularLabel")}</span>
            </div>
            <p className="text-xl font-extrabold text-[#8855f6]" data-testid="value-particular">{productionByType.particular}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t("reports.procedures")}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)]" data-testid="card-sus">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl"><CheckCircle2 className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">SUS</span>
            </div>
            <p className="text-xl font-extrabold text-blue-600" data-testid="value-sus">{productionByType.sus}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t("reports.procedures")}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)]" data-testid="card-convenio">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 rounded-xl"><Stethoscope className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t("reports.convenioLabel")}</span>
            </div>
            <p className="text-xl font-extrabold text-green-600" data-testid="value-convenio">{productionByType.convenio}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t("reports.procedures")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)]" data-testid="chart-production">
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

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)]" data-testid="chart-insurance">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="w-5 h-5 text-[#8855f6]" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{t("reports.insuranceDistribution")}</h3>
            </div>
            {insuranceCountData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={insuranceCountData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {insuranceCountData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [value, t("reports.procedures")]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={10}
                    formatter={(value: string, entry: any) => {
                      const item = insuranceCountData.find(d => d.name === value);
                      const pct = item ? ((item.value / insuranceCountData.reduce((s, d) => s + d.value, 0)) * 100).toFixed(0) : "0";
                      return `${value} (${pct}%)`;
                    }}
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                {t("reports.noDataForPeriod")}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)] overflow-hidden mb-12" data-testid="table-top-insurers">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t("reports.topInsurers")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left pl-4 pr-2 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-2 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("reports.insurerColumn")}</th>
                  <th className="text-right px-2 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("reports.entriesColumn")}</th>
                  <th className="text-right px-2 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("reports.totalValueColumn")}</th>
                  <th className="text-right pl-2 pr-4 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("reports.percentColumn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {topInsurers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                      {t("reports.noDataForPeriod")}
                    </td>
                  </tr>
                ) : (
                  topInsurers.map((ins, i) => {
                    const pct = totalProduction > 0 ? ((ins.count / totalProduction) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={ins.name} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" data-testid={`row-insurer-${i}`}>
                        <td className="pl-4 pr-2 py-4 text-sm font-bold text-slate-400 dark:text-slate-500">{i + 1}</td>
                        <td className="px-2 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{ins.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-4 text-right font-bold text-slate-800 dark:text-slate-200 text-sm">{ins.count}</td>
                        <td className="px-2 py-4 text-right text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatCurrency(ins.value)}</td>
                        <td className="pl-2 pr-4 py-4 text-right">
                          <span className="text-xs font-bold text-[#8855f6] bg-[#8855f6]/10 px-2 py-1 rounded-full">{pct}%</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
}