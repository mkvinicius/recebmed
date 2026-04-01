import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Brain, ArrowLeft, Copy, DollarSign, AlertTriangle, Search,
  CheckCircle2, Loader2, ChevronDown, ChevronUp, Shield
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Finding {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  entryIds: string[];
  resolved: boolean;
  scanTimestamp: string;
}

interface Summary {
  [key: string]: { total: number; unresolved: number };
}

const categoryConfig: Record<string, { icon: typeof Brain; color: string; bgColor: string; borderColor: string }> = {
  duplicate: { icon: Copy, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/30", borderColor: "border-orange-200 dark:border-orange-800" },
  value_outlier: { icon: DollarSign, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/30", borderColor: "border-red-200 dark:border-red-800" },
  missing_data: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/30", borderColor: "border-amber-200 dark:border-amber-800" },
  suspicious_pattern: { icon: Search, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950/30", borderColor: "border-purple-200 dark:border-purple-800" },
};

export default function AuditReports() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary>({});
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    fetchSummary(token);
  }, [setLocation]);

  const fetchSummary = async (token?: string) => {
    const t2 = token || getToken();
    if (!t2) return;
    try {
      const res = await fetch("/api/audit-findings/summary", { headers: { Authorization: `Bearer ${t2}` } });
      if (res.ok) setSummary(await res.json());
      else toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } catch {
      toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const fetchFindings = async (category: string) => {
    const token = getToken();
    if (!token) return;
    setSelectedCategory(category);
    setLoading(true);
    try {
      const res = await fetch(`/api/audit-findings?category=${category}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setFindings(await res.json());
      else toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } catch {
      toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleResolve = async (id: string) => {
    const token = getToken();
    if (!token) return;
    setResolvingId(id);
    try {
      const res = await fetch(`/api/audit-findings/${id}/resolve`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setFindings(prev => prev.map(f => f.id === id ? { ...f, resolved: true } : f));
        toast({ title: t("common.success"), description: t("auditReports.findingResolved") });
        fetchSummary();
      }
    } catch {} finally { setResolvingId(null); }
  };

  const goBack = () => {
    if (selectedCategory) {
      setSelectedCategory(null);
      setFindings([]);
    } else {
      setLocation("/settings");
    }
  };

  const categories = ["duplicate", "value_outlier", "missing_data", "suspicious_pattern"];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col" style={{ minHeight: "calc(100vh - 120px)" }}>
      <div className="min-h-[8rem] md:min-h-[10.5rem] flex flex-col justify-end pb-6 text-white">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-xl transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("auditReports.title")}</h2>
            <p className="text-sm opacity-90">{t("auditReports.subtitle")}</p>
          </div>
        </div>
      </div>

      {!selectedCategory ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-8">
          {categories.map(cat => {
            const config = categoryConfig[cat];
            const data = summary[cat] || { total: 0, unresolved: 0 };
            const Icon = config.icon;
            return (
              <button
                key={cat}
                onClick={() => fetchFindings(cat)}
                className={`${config.bgColor} border ${config.borderColor} rounded-2xl p-5 text-left hover:shadow-lg transition-all group`}
                data-testid={`card-category-${cat}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl ${config.bgColor} border ${config.borderColor}`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <h3 className={`font-bold text-base ${config.color}`}>{t(`auditReports.category_${cat}`)}</h3>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{data.total}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t("auditReports.totalFindings")}</p>
                  </div>
                  {data.unresolved > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-bold">
                      <AlertTriangle className="w-3 h-3" />
                      {data.unresolved} {t("auditReports.pending")}
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {loading && (
            <div className="col-span-full flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#8855f6]" />
            </div>
          )}

          {!loading && Object.values(summary).every(s => s.total === 0) && (
            <div className="col-span-full text-center py-12">
              <Shield className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{t("auditReports.allClear")}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("auditReports.allClearDesc")}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="pb-8">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {t(`auditReports.category_${selectedCategory}`)}
            </h3>
            <span className="text-sm text-slate-500 dark:text-slate-400">({findings.length})</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#8855f6]" />
            </div>
          ) : findings.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("auditReports.noneInCategory")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map(f => {
                const config = categoryConfig[f.category] || categoryConfig.suspicious_pattern;
                const isExpanded = expandedId === f.id;
                const Icon = config.icon;
                return (
                  <div
                    key={f.id}
                    className={`bg-white dark:bg-slate-900 rounded-xl border ${f.resolved ? "border-green-200 dark:border-green-800 opacity-60" : "border-slate-200 dark:border-slate-700"} shadow-sm overflow-hidden`}
                    data-testid={`finding-${f.id}`}
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : f.id)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      data-testid={`button-expand-${f.id}`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{f.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(f.scanTimestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {f.resolved && <span className="ml-2 text-green-600 dark:text-green-400 font-semibold">✓ {t("auditReports.resolved")}</span>}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${f.severity === "high" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : f.severity === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                        {f.severity === "high" ? t("auditReports.severityHigh") : f.severity === "medium" ? t("auditReports.severityMedium") : t("auditReports.severityLow")}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-3 leading-relaxed whitespace-pre-wrap">{f.description}</p>
                        {f.entryIds.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t("auditReports.affectedEntries")}:</p>
                            <div className="flex flex-wrap gap-1">
                              {f.entryIds.map(eid => (
                                <button
                                  key={eid}
                                  onClick={() => setLocation(`/entry/${eid}`)}
                                  className="text-xs px-2 py-1 rounded-md bg-[#8855f6]/10 text-[#8855f6] hover:bg-[#8855f6]/20 transition-colors font-mono"
                                  data-testid={`link-entry-${eid}`}
                                >
                                  {eid.slice(0, 8)}...
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {!f.resolved && (
                          <button
                            onClick={() => handleResolve(f.id)}
                            disabled={resolvingId === f.id}
                            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                            data-testid={`button-resolve-${f.id}`}
                          >
                            {resolvingId === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {t("auditReports.markResolved")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
