import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Stethoscope, CheckCircle2, TrendingUp, PieChart as PieChartIcon, FileUp, Calendar, X, History, Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { getToken, clearAuth } from "@/lib/auth";
import { useDateFilter } from "@/hooks/use-date-filter";
import type { QuickFilterKey } from "@/hooks/use-date-filter";
import { formatCurrency as fmtCurrency } from "@/lib/utils";
import ErrorState from "@/components/ErrorState";

import { ReportSkeleton } from "@/components/EntrySkeleton";

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

const PIE_COLORS = ["#8855f6", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899"];

export default function Reports() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [insuranceFilter, setInsuranceFilter] = useState("all");
  const { dateFrom, dateTo, quickFilter, setDateFrom, setDateTo, applyQuickFilter, clearDates } = useDateFilter();

  const formatCurrency = (value: number): string => {
    return fmtCurrency(value) || "—";
  };


  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    (async () => {
      setFetchError(false);
      try {
        const res = await fetch("/api/entries", { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
        const data = await res.json();
        if (res.ok) setEntries(data.entries || []);
        else setFetchError(true);
      } catch { setFetchError(true); }
      finally { setLoading(false); }
    })();
  }, [setLocation]);

  const uniqueInsurances = useMemo(() =>
    Array.from(new Set(entries.map(e => e.insuranceProvider).filter(Boolean))),
    [entries]
  );

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = (e.patientName || "").toLowerCase().includes(q) ||
          (e.insuranceProvider || "").toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (insuranceFilter !== "all" && e.insuranceProvider !== insuranceFilter) return false;
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
  }, [entries, dateFrom, dateTo, searchQuery, statusFilter, insuranceFilter]);


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


  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[8rem] md:min-h-[10.5rem] flex flex-col justify-end pb-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold">{t("reports.title")}</h2>
              <p className="text-sm opacity-90">{t("reports.subtitle")}</p>
            </div>
          </div>
        </div>
        <ReportSkeleton />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[8rem] md:min-h-[10.5rem] flex flex-col justify-end pb-6 text-white">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold">{t("reports.title")}</h2>
              <p className="text-sm opacity-90">{t("reports.subtitle")}</p>
            </div>
          </div>
        </div>
        <div className="py-8">
          <ErrorState onRetry={() => { setLoading(true); const token = getToken(); if (token) { (async () => { setFetchError(false); try { const res = await fetch("/api/entries", { headers: { Authorization: `Bearer ${token}` } }); if (res.status === 401) { clearAuth(); setLocation("/login"); return; } const data = await res.json(); if (res.ok) setEntries(data.entries || []); else setFetchError(true); } catch { setFetchError(true); } finally { setLoading(false); } })(); } }} />
        </div>
      </div>
    );
  }



  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[8rem] md:min-h-[10.5rem] flex flex-col justify-end pb-6 text-white">
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

        <div className="relative z-20 -mt-6 mb-4">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t("entries.searchPlaceholder")}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 h-12 rounded-2xl bg-white dark:bg-slate-900 border-0 shadow-card text-slate-800 dark:text-slate-100 text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#8855f6]/40 transition-all"
            data-testid="search-input"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" data-testid="clear-search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 p-4 mb-6">
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { key: "all", label: t("common.all") },
              { key: "pending", label: t("common.pending") },
              { key: "reconciled", label: t("common.reconciled") },
              { key: "divergent", label: t("common.divergent") },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${statusFilter === s.key ? "bg-[#8855f6] text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                data-testid={`filter-status-${s.key}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-400">{t("entries.dateFrom")}</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 cursor-pointer w-auto min-w-[120px]"
                data-testid="filter-date-from"
              />
              <span className="text-[11px] font-semibold text-slate-400">{t("entries.dateTo")}</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 cursor-pointer w-auto min-w-[120px]"
                data-testid="filter-date-to"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={clearDates}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  data-testid="button-clear-dates"
                  aria-label={t("common.clearFilter")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {uniqueInsurances.length > 1 && (
              <select value={insuranceFilter} onChange={e => setInsuranceFilter(e.target.value)} className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-0 cursor-pointer" data-testid="filter-insurance" aria-label={t("common.insurance")}>
                <option value="all">{t("entries.allInsurances")}</option>
                {uniqueInsurances.map(ins => <option key={ins} value={ins}>{ins}</option>)}
              </select>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {[
              { key: "yesterday" as QuickFilterKey, label: t("reports.quickYesterday") },
              { key: "today" as QuickFilterKey, label: t("reports.quickToday") },
              { key: "week" as QuickFilterKey, label: t("reports.quickWeek") },
              { key: "month" as QuickFilterKey, label: t("reports.quickThisMonth") },
            ].map(q => (
              <button
                key={q.key}
                onClick={() => applyQuickFilter(q.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${quickFilter === q.key ? "bg-[#8855f6] text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                data-testid={`quick-filter-${q.key}`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => setLocation("/reconciliation")}
            className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border border-slate-100/60 dark:border-slate-700/40 hover:border-[#8855f6]/40 transition-all text-left"
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
            className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border border-slate-100/60 dark:border-slate-700/40 hover:border-[#8855f6]/40 transition-all text-left"
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
            className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border border-slate-100/60 dark:border-slate-700/40 hover:border-[#8855f6]/40 transition-all text-left"
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
          <button
            onClick={() => setLocation("/reports/history")}
            className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-card border border-slate-100/60 dark:border-slate-700/40 hover:border-[#8855f6]/40 transition-all text-left"
            data-testid="link-report-history"
          >
            <div className="size-10 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{t("reportHistory.title")}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("reportHistory.subtitle")}</p>
            </div>
          </button>
        </div>

        <div className="mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-card border border-slate-100/60 dark:border-slate-700/40" data-testid="chart-insurance">
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 overflow-hidden mb-12" data-testid="table-top-insurers">
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