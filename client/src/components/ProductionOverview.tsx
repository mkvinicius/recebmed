import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Activity, DollarSign, CheckCircle2, Stethoscope,
  BarChart3, ChevronDown, ChevronUp, X, User,
  PieChart as PieChartIcon, ChevronLeft, ChevronRight
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
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
const PIE_COLORS = ["#8855f6", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899"];

type PeriodMode = "weekly" | "monthly" | "yearly";

function classifyInsurance(provider: string): "particular" | "sus" | "convenio" {
  const lower = provider.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!lower || lower === "particular" || lower === "privado" || lower === "private") return "particular";
  if (lower === "sus" || lower.includes("sistema unico") || lower.includes("unified health")) return "sus";
  return "convenio";
}

function classifyProcedureType(description: string): string {
  const lower = (description || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (lower.includes("consult")) return "consulta";
  if (lower.includes("exame") || lower.includes("exam") || lower.includes("ultrassom") || lower.includes("ultrassonografia") || lower.includes("raio") || lower.includes("tomografia") || lower.includes("ressonancia") || lower.includes("endoscopia") || lower.includes("colonoscopia")) return "exame";
  if (lower.includes("cirurgi") || lower.includes("surgery") || lower.includes("cirugia")) return "cirurgia";
  if (lower.includes("balao") || lower.includes("balloon") || lower.includes("balon")) return "balao";
  if (lower.includes("procedimento") || lower.includes("procedure") || lower.includes("biopsia") || lower.includes("drenagem") || lower.includes("puncao") || lower.includes("sutura") || lower.includes("curetagem")) return "procedimento";
  return "outros";
}

export default function ProductionOverview() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("monthly");
  const [activeFilter, setActiveFilter] = useState<"all" | "particular" | "sus" | "convenio" | null>(null);
  const [pieSlide, setPieSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);
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

  const insuranceCountData = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => {
      const provider = e.insuranceProvider || t("reports.noInsurance");
      map[provider] = (map[provider] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [entries, t]);

  const procedureTypeData = useMemo(() => {
    const typeLabels: Record<string, string> = {
      consulta: t("reports.typeConsulta"),
      exame: t("reports.typeExame"),
      cirurgia: t("reports.typeCirurgia"),
      balao: t("reports.typeBalao"),
      procedimento: t("reports.typeProcedimento"),
      outros: t("reports.typeOutros"),
    };
    const map: Record<string, number> = {};
    entries.forEach(e => {
      const type = classifyProcedureType(e.description);
      const label = typeLabels[type] || typeLabels.outros;
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [entries, t]);

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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setPieSlide(prev => diff > 0 ? Math.min(prev + 1, 1) : Math.max(prev - 1, 0));
    }
    touchStartX.current = null;
  }, []);

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

  const pieCharts = [
    { key: "insurance", title: t("reports.insuranceDistribution"), data: insuranceCountData },
    { key: "procedureType", title: t("reports.procedureTypeDistribution"), data: procedureTypeData },
  ];

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

      <div
        className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-card border border-slate-100/60 dark:border-slate-700/40 mb-4 overflow-hidden"
        data-testid="pie-charts-carousel"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-[#8855f6]" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">{pieCharts[pieSlide].title}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPieSlide(0)}
              className={`p-1 rounded-lg transition-colors ${pieSlide === 0 ? "text-slate-300 dark:text-slate-600" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              disabled={pieSlide === 0}
              data-testid="pie-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1.5 mx-1">
              {pieCharts.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPieSlide(i)}
                  className={`w-2 h-2 rounded-full transition-all ${pieSlide === i ? "bg-[#8855f6] w-4" : "bg-slate-200 dark:bg-slate-700"}`}
                  data-testid={`pie-dot-${i}`}
                />
              ))}
            </div>
            <button
              onClick={() => setPieSlide(1)}
              className={`p-1 rounded-lg transition-colors ${pieSlide === 1 ? "text-slate-300 dark:text-slate-600" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
              disabled={pieSlide === 1}
              data-testid="pie-next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${pieSlide * 100}%)` }}
          >
            {pieCharts.map(chart => (
              <div key={chart.key} className="w-full flex-shrink-0" data-testid={`pie-${chart.key}`}>
                {chart.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chart.data}
                        cx="50%"
                        cy="45%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {chart.data.map((_, index) => (
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
                        formatter={(value: string) => {
                          const item = chart.data.find(d => d.name === value);
                          const total = chart.data.reduce((s, d) => s + d.value, 0);
                          const pct = item && total > 0 ? ((item.value / total) * 100).toFixed(0) : "0";
                          return `${value} (${pct}%)`;
                        }}
                        wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                    {t("reports.noDataForPeriod")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

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
