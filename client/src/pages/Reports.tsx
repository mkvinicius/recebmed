import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Stethoscope, ArrowLeft, DollarSign, CheckCircle2, Clock,
  AlertTriangle, TrendingUp, PieChart as PieChartIcon, BarChart3, Loader2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { getToken, clearAuth } from "@/lib/auth";

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

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "month", label: "Este mês" },
  { value: "3months", label: "Últimos 3 meses" },
  { value: "6months", label: "Últimos 6 meses" },
  { value: "year", label: "Este ano" },
];

const PIE_COLORS = ["#8855f6", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899"];

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export default function Reports() {
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>("6months");

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
      const provider = e.insuranceProvider || "Sem convênio";
      map[provider] = (map[provider] || 0) + (e.procedureValue ? parseFloat(e.procedureValue) : 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEntries]);

  const topInsurers = useMemo(() => insuranceData.slice(0, 10), [insuranceData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#8855f6] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-slate-100 relative">
      <div className="hero-gradient h-56 w-full absolute top-0 left-0 z-0" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            <div className="size-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Medfin</h1>
          </div>
          <Button
            onClick={() => setLocation("/dashboard")}
            variant="ghost"
            className="text-white hover:bg-white/20 rounded-full font-bold gap-2"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        </header>

        <div className="pt-2 pb-8 text-white">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold" data-testid="text-page-title">Relatórios Financeiros</h2>
              <p className="text-sm opacity-90">Acompanhe seu faturamento e desempenho</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 mb-6">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Período</p>
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700" data-testid="card-total-value">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-[#8855f6]/10 text-[#8855f6] rounded-xl"><DollarSign className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Total Faturado</span>
            </div>
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100" data-testid="value-total">{formatCurrency(totalValue)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{filteredEntries.length} lançamentos</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700" data-testid="card-reconciled-value">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 rounded-xl"><CheckCircle2 className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Conferido</span>
            </div>
            <p className="text-xl font-extrabold text-green-600" data-testid="value-reconciled">{formatCurrency(reconciledValue)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{filteredEntries.filter(e => e.status === "reconciled").length} lançamentos</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700" data-testid="card-pending-value">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-xl"><Clock className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Pendente</span>
            </div>
            <p className="text-xl font-extrabold text-amber-600" data-testid="value-pending">{formatCurrency(pendingValue)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{filteredEntries.filter(e => e.status === "pending").length} lançamentos</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700" data-testid="card-divergent-value">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-xl"><AlertTriangle className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Divergente</span>
            </div>
            <p className="text-xl font-extrabold text-red-600" data-testid="value-divergent">{formatCurrency(divergentValue)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{filteredEntries.filter(e => e.status === "divergent").length} lançamentos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700" data-testid="chart-monthly">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[#8855f6]" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Faturamento por Mês</h3>
            </div>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:[&>line]:stroke-slate-700" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }}
                  />
                  <Bar dataKey="value" fill="#8855f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                Sem dados para o período selecionado
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700" data-testid="chart-insurance">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="w-5 h-5 text-[#8855f6]" />
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Distribuição por Convênio</h3>
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
                    formatter={(value: number) => [formatCurrency(value), "Valor"]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "13px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                Sem dados para o período selecionado
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden mb-12" data-testid="table-top-insurers">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Top Convênios por Valor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Convênio</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Valor Total</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Lançamentos</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">% do Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {topInsurers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                      Sem dados para o período selecionado
                    </td>
                  </tr>
                ) : (
                  topInsurers.map((ins, i) => {
                    const count = filteredEntries.filter(e => (e.insuranceProvider || "Sem convênio") === ins.name).length;
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
    </div>
  );
}