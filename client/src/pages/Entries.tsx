import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  Search, FileText, Clock, CheckCircle2, AlertCircle,
  Camera, Mic, PenLine, Loader2, X, Calendar
} from "lucide-react";
import { getToken, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useDateFilter } from "@/hooks/use-date-filter";
import type { QuickFilterKey } from "@/hooks/use-date-filter";
import { formatDate, formatCurrency } from "@/lib/utils";
import EditEntryModal from "@/components/EditEntryModal";
import DivergencyModal from "@/components/DivergencyModal";
import ErrorState from "@/components/ErrorState";

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

export default function Entries() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("status") || "all";
  });
  const { dateFrom, dateTo, quickFilter, setDateFrom, setDateTo, applyQuickFilter, clearDates } = useDateFilter();
  const [insuranceFilter, setInsuranceFilter] = useState("all");
  const [editingEntry, setEditingEntry] = useState<DoctorEntry | null>(null);
  const [divergentEntry, setDivergentEntry] = useState<DoctorEntry | null>(null);
  const [quickStatusEntry, setQuickStatusEntry] = useState<string | null>(null);
  const quickStatusRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const statusLabelMap: Record<string, string> = {
    pending: t("common.pending"),
    reconciled: t("common.reconciled"),
    divergent: t("common.divergent"),
  };

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    fetchEntries(token);
  }, [setLocation]);

  useEffect(() => {
    if (!quickStatusEntry) return;
    const handler = (e: MouseEvent) => {
      if (quickStatusRef.current && !quickStatusRef.current.contains(e.target as Node)) setQuickStatusEntry(null);
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [quickStatusEntry]);

  const fetchEntries = async (token: string) => {
    setFetchError(false);
    try {
      const res = await fetch("/api/entries", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
      const data = await res.json();
      if (res.ok) setEntries(data.entries || []);
      else setFetchError(true);
    } catch { setFetchError(true); }
    finally { setLoadingEntries(false); }
  };

  const openEditModal = (entry: DoctorEntry) => {
    if (entry.status === "divergent") {
      setDivergentEntry(entry);
    } else {
      setEditingEntry(entry);
    }
  };

  const handleQuickStatusChange = async (entryId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickStatusEntry(null);
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/entries/${entryId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }) });
      const data = await res.json();
      if (res.ok) { setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...data.entry } : e)); toast({ title: t("entries.statusUpdated"), description: t("entries.markedAs", { status: statusLabelMap[newStatus] }) }); }
      else toast({ title: t("common.error"), description: data.message || t("entries.statusUpdateFailed"), variant: "destructive" });
    } catch { toast({ title: t("common.error"), description: t("entries.statusUpdateFailed"), variant: "destructive" }); }
  };

  const filteredEntries = entries.filter(e => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!e.patientName.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q) && !e.insuranceProvider.toLowerCase().includes(q)) return false;
    }
    if (insuranceFilter !== "all" && e.insuranceProvider !== insuranceFilter) return false;
    if (dateFrom || dateTo) {
      const d = new Date(e.procedureDate || e.createdAt);
      if (dateFrom) {
        const from = new Date(dateFrom + "T00:00:00");
        if (d < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo + "T23:59:59");
        if (d > to) return false;
      }
    }
    return true;
  });

  const uniqueInsurances = Array.from(new Set(entries.map(e => e.insuranceProvider).filter(Boolean)));
  const methodIcon = (m: string) => m === "photo" ? <Camera className="w-4 h-4" /> : m === "audio" ? <Mic className="w-4 h-4" /> : <PenLine className="w-4 h-4" />;
  const methodLabel = (m: string) => m === "photo" ? t("common.photo") : m === "audio" ? t("common.audio") : t("common.manual");
  const statusIcon = (s: string) => s === "reconciled" ? <CheckCircle2 className="w-5 h-5" /> : s === "divergent" ? <AlertCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />;
  const statusColor = (s: string) => s === "reconciled" ? "bg-green-50 dark:bg-green-900/30 text-green-600" : s === "divergent" ? "bg-red-50 dark:bg-red-900/30 text-red-500" : "bg-[#8855f6]/10 text-[#8855f6]";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-1 pb-4 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("entries.title")}</h2>
          <p className="text-white/80 mt-1 text-sm">{t("entries.subtitle")}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t("entries.searchPlaceholder")} className="pl-10 h-10 rounded-xl border-slate-200 text-sm" data-testid="input-search" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[{ v: "all", l: t("common.all") }, { v: "pending", l: t("common.pending") }, { v: "reconciled", l: t("common.reconciled") }, { v: "divergent", l: t("common.divergent") }].map(f => (
                <button key={f.v} onClick={() => setStatusFilter(f.v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === f.v ? "bg-[#8855f6] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`} data-testid={`filter-status-${f.v}`}>{f.l}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-400">{t("entries.dateFrom")}</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 cursor-pointer w-[120px]"
                data-testid="filter-date-from"
              />
              <span className="text-[11px] font-semibold text-slate-400">{t("entries.dateTo")}</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-0 cursor-pointer w-[120px]"
                data-testid="filter-date-to"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={clearDates}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  data-testid="button-clear-dates"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {uniqueInsurances.length > 1 && (
              <select value={insuranceFilter} onChange={e => setInsuranceFilter(e.target.value)} className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-0 cursor-pointer" data-testid="filter-insurance">
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
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${quickFilter === q.key ? "bg-[#8855f6] text-white shadow-md" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                data-testid={`quick-filter-${q.key}`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-3 px-1">
            <span className="font-bold text-slate-800 dark:text-slate-200">{t("entries.allEntries")}</span>
            <span className="text-[#8855f6] text-sm font-bold" data-testid="text-entry-count">
              {filteredEntries.length === entries.length ? t("entries.recordCount", { count: entries.length }) : t("entries.filteredCount", { filtered: filteredEntries.length, total: entries.length })}
            </span>
          </div>
          <div className="space-y-3">
            {loadingEntries ? (
              <div className="card-float px-6 py-12 flex justify-center"><Loader2 className="w-6 h-6 text-[#8855f6] animate-spin" /></div>
            ) : fetchError ? (
              <ErrorState onRetry={() => { const token = getToken(); if (token) { setLoadingEntries(true); fetchEntries(token); } }} />
            ) : filteredEntries.length === 0 ? (
              <div className="card-float px-6 py-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">{entries.length === 0 ? t("entries.noEntries") : t("entries.noFilterResults")}</p>
              </div>
            ) : (
              filteredEntries.map(entry => (
                <div key={entry.id} onClick={() => openEditModal(entry)} className="card-float px-4 py-4 flex items-center justify-between cursor-pointer" data-testid={`entry-row-${entry.id}`}>
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className={`size-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${statusColor(entry.status)}`}>{statusIcon(entry.status)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate text-[15px]">{entry.patientName}</p>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">{entry.description} • {entry.insuranceProvider}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(entry.createdAt, "relative")}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">{methodIcon(entry.entryMethod)} {methodLabel(entry.entryMethod)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-3">
                    {entry.procedureValue && <span className="text-sm font-bold text-green-600 dark:text-green-400" data-testid={`value-${entry.id}`}>{formatCurrency(entry.procedureValue)}</span>}
                    <div className="relative" ref={quickStatusEntry === entry.id ? quickStatusRef : undefined}>
                      <button onClick={e => { e.stopPropagation(); setQuickStatusEntry(quickStatusEntry === entry.id ? null : entry.id); }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-all hover:scale-105 active:scale-95 ${entry.status === "reconciled" ? "bg-green-50 dark:bg-green-900/30 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50" : entry.status === "divergent" ? "bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50"}`}
                        data-testid={`quick-status-${entry.id}`}>
                        {statusLabelMap[entry.status] || t("common.pending")}
                      </button>
                      {quickStatusEntry === entry.id && (
                        <div className="absolute right-0 bottom-full mb-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 py-1 z-30 min-w-[160px] animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                          <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("entries.changeStatus")}</p>
                          {[
                            { value: "pending", label: t("common.pending"), icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-600" },
                            { value: "reconciled", label: t("common.reconciled"), icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-green-600" },
                            { value: "divergent", label: t("common.divergent"), icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-red-500" },
                          ].filter(s => s.value !== entry.status).map(s => (
                            <button key={s.value} onClick={e => handleQuickStatusChange(entry.id, s.value, e)} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${s.color}`} data-testid={`quick-set-${s.value}-${entry.id}`}>
                              {s.icon} {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      {divergentEntry && (
        <DivergencyModal
          entry={divergentEntry}
          onClose={() => setDivergentEntry(null)}
          onResolved={(updated) => { setEntries(prev => prev.map(e => e.id === updated.id ? updated : e)); setDivergentEntry(null); }}
        />
      )}

      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={(updated) => { setEntries(prev => prev.map(e => e.id === updated.id ? updated : e)); setEditingEntry(null); }}
          onDeleted={(id) => { setEntries(prev => prev.filter(e => e.id !== id)); setEditingEntry(null); }}
        />
      )}
    </div>
  );
}
