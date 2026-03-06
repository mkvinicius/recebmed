import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Stethoscope, DollarSign, CheckCircle2, Clock,
  AlertTriangle, TrendingUp, PieChart as PieChartIcon, BarChart3, Loader2, FileUp
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

type PeriodFilter = "month" | "3months" | "6months" | "year";

const PIE_COLORS = ["#8855f6", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899"];

function getFilterDate(period: PeriodFilter): Date {
  const now = new Date();
  switch (period) {
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "3months":
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    case "6months":
      return new Date(now.getFullYear(), now.getMonth() - 5, 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
  }
}

export default function Reports() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("6months");

  const locale = getLocale();
  const currency = getCurrencyCode();

  const formatCurrency = (value: number): string => {
    return value.toLocaleString(locale, { style: "currency", currency });
  };

  const getMonthLabel = (date: Date): string => {
    return date.toLocaleDateString(locale, { month: "short", year: "2-digit" });
  };

  const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
    { value: "month", label: t("reports.thisMonth") },
    { value: "3months", label: t("reports.last3Months") },
    { value: "6months", label: t("reports.last6Months") },
    { value: "year", label: t("reports.thisYear") },
  ];

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
    const cutoff = getFilterDate(period);
    return entries.filter(e => {
      const d = new Date(e.procedureDate || e.createdAt);
      return d >= cutoff;
    });
  }, [entries, period]);

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

  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    const cutoff = getFilterDate(period);
    const now = new Date();
    const cur = new Date(cutoff.getFullYear(), cutoff.getMonth(), 1);
    while (cur <= now) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      months[key] = 0;
      cur.setMonth(cur.getMonth() + 1);
    }
    filteredEntries.forEach(e => {
      const d = new Date(e.procedureDate || e.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in months) {
        months[key] += e.procedureValue ? parseFloat(e.procedureValue) : 0;
      }
    });
    return Object.entries(months).map(([key, value]) => {
      const [y, m] = key.split("-").map(Number);
      return { name: getMonthLabel(new Date(y, m - 1, 1)), value };
    });
  }, [filteredEntries, period]);

  const insuranceData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredEntries.forEach(e => {
      const provider = e.insuranceProvider || t("reports.noInsurance");
      map[provider] = (map[provider] || 0) + (e.procedureValue ? parseFloat(e.procedureValue) : 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEntries, t]);

  const topInsurers = useMemo(() => insuranceData.slice(0, 10), [insuranceData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-[#8855f6] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-2 pb-8 text-white">
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
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  period === opt.value
                    ? "bg-[#8855f6] text-white shadow-lg shadow-[#8855f6]/30"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
                data-testid={`filter-period-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)]" data-testid="card-total-value">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-[#8855f6]/10 text-[#8855f6] rounded-xl"><DollarSign className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t("reports.totalBilled")}</span>
            </div>
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100" data-testid="value-total">{formatCurrency(totalValue)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{filteredEntries.length} {t("common.entries")}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)]" data-testid="card-reconciled-value">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 rounded-xl"><CheckCircle2 className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t("reports.reconciledLabel")}</span>
            </div>
            <p className="text-xl font-extrabold text-green-600" data-testid="value-reconciled">{formatCurrency(reconciledValue)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{filteredEntries.filter(e => e.status === "reconciled").length} {t("common.entries")}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)]" data-testid="card-pending-value">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-xl"><Clock className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t("reports.pendingLabel")}</span>
            </div>
            <p className="text-xl font-extrabold text-amber-600" data-testid="value-pending">{formatCurrency(pendingValue)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{filteredEntries.filter(e => e.status === "pending").length} {t("common.entries")}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)]" data-testid="card-divergent-value">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-xl"><AlertTriangle className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">{t("reports.divergentLabel")}</span>
            </div>
            <p className="text-xl font-extrabold text-red-600" data-testid="value-divergent">{formatCurrency(divergentValue)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{filteredEntries.filter(e => e.status === "divergent").length} {t("common.entries")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.12),0_1px_4px_-1px_rgba(0,0,0,0.06)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),0_1px_4px_-1px_rgba(0,0,0,0.2)]" data-testid="chart-monthly">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[#8855f6]" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{t("reports.monthlyRevenue")}</h3>
            </div>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:[&>line]:stroke-slate-700" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} tickFormatter={(v) => new Intl.NumberFormat(locale, { style: "currency", currency, notation: "compact", maximumFractionDigits: 0 }).format(v)} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), t("reports.revenue")]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }}
                  />
                  <Bar dataKey="value" fill="#8855f6" radius={[6, 6, 0, 0]} />
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
            {insuranceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={insuranceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: "#94a3b8" }}
                  >
                    {insuranceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), t("common.value")]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }}
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
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("reports.insurerColumn")}</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("reports.totalValueColumn")}</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("reports.entriesColumn")}</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("reports.percentColumn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {topInsurers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                      {t("reports.noDataForPeriod")}
                    </td>
                  </tr>
                ) : (
                  topInsurers.map((ins, i) => {
                    const count = filteredEntries.filter(e => (e.insuranceProvider || t("reports.noInsurance")) === ins.name).length;
                    const pct = totalValue > 0 ? ((ins.value / totalValue) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={ins.name} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" data-testid={`row-insurer-${i}`}>
                        <td className="px-6 py-4 text-sm font-bold text-slate-400 dark:text-slate-500">{i + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{ins.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-slate-200 text-sm">{formatCurrency(ins.value)}</td>
                        <td className="px-6 py-4 text-right text-sm text-slate-500 dark:text-slate-400">{count}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-bold text-[#8855f6] bg-[#8855f6]/10 px-2.5 py-1 rounded-full">{pct}%</span>
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