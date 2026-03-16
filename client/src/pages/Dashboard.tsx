import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Bell, Clock, CreditCard, AlertTriangle,
  FileText, AlertCircle, Loader2, CheckCircle2, X,
  Camera, Mic, PenLine,
  ChevronRight, Search, CheckCheck
} from "lucide-react";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getLocale, getCurrencyCode } from "@/lib/i18n";
import ProjectionsPanel from "@/components/ProjectionsPanel";
import EditEntryModal from "@/components/EditEntryModal";
import AppTour from "@/components/AppTour";

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

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function Dashboard() {
  const { t } = useTranslation();

  const formatCurrency = (val: string | number | null | undefined) => {
    if (!val) return null;
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return null;
    return num.toLocaleString(getLocale(), { style: "currency", currency: getCurrencyCode() });
  };

  const formatDate = (dateStr: string) => {
    const locale = getLocale();
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return `${t("dashboard.today")}, ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
    if (d.toDateString() === yesterday.toDateString()) return `${t("dashboard.yesterday")}, ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
    return d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
  };
  const [, setLocation] = useLocation();
  const initialUser = getUser();
  const userName = initialUser?.name || "";
  const profilePhotoUrl = initialUser?.profilePhotoUrl || null;
  const userInitials = userName ? userName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "Dr";
  const [entries, setEntries] = useState<DoctorEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [editingEntry, setEditingEntry] = useState<DoctorEntry | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DoctorEntry[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    fetchEntries(token);
    fetchNotifications(token);
  }, [setLocation]);

  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifications]);

  useEffect(() => {
    if (!showSearch) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSearch]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`/api/entries/search?q=${encodeURIComponent(value.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
        const data = await res.json();
        if (res.ok) setSearchResults(data.entries || []);
        else setSearchResults([]);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
  };

  const fetchEntries = async (token: string) => {
    try {
      const res = await fetch("/api/entries", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
      const data = await res.json();
      if (res.ok) setEntries(data.entries || []);
    } catch { }
    finally { setLoadingEntries(false); }
  };

  const fetchNotifications = async (token: string) => {
    try {
      const res = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch { }
  };

  const markAllRead = async () => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch("/api/notifications/read-all", { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { }
  };

  const openEditModal = (entry: DoctorEntry) => {
    setEditingEntry(entry);
  };

  const pendingCount = entries.filter(e => e.status === "pending").length;
  const reconciledCount = entries.filter(e => e.status === "reconciled").length;
  const divergentCount = entries.filter(e => e.status === "divergent").length;
  const recentEntries = entries.slice(0, 5);

  const methodIcon = (m: string) => m === "photo" ? <Camera className="w-4 h-4" /> : m === "audio" ? <Mic className="w-4 h-4" /> : <PenLine className="w-4 h-4" />;
  const statusColor = (s: string) => s === "reconciled" ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400" : s === "divergent" ? "bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400" : "bg-[#8855f6]/10 text-[#8855f6]";
  const statusIcon = (s: string) => s === "reconciled" ? <CheckCircle2 className="w-5 h-5" /> : s === "divergent" ? <AlertCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute right-4 sm:right-6 lg:right-8 top-0 z-[60] py-4">
          <div className="flex items-center gap-3">
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifications(!showNotifications)} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md relative" data-testid="button-notifications">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 size-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="badge-unread">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{t("dashboard.notifications")}</h4>
                    {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-[#8855f6] font-semibold hover:underline" data-testid="button-mark-all-read"><CheckCheck className="w-3.5 h-3.5 inline mr-1" />{t("dashboard.markAllRead")}</button>}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center"><Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" /><p className="text-sm text-slate-400 dark:text-slate-500">{t("dashboard.noNotifications")}</p></div>
                    ) : notifications.slice(0, 15).map(n => (
                      <div key={n.id} className={`px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${n.read ? "" : "bg-[#8855f6]/5"}`} onClick={async () => { if (!n.read) { const token = getToken(); if (!token) return; try { await fetch(`/api/notifications/${n.id}/read`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } }); setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x)); setUnreadCount(prev => Math.max(0, prev - 1)); } catch {} } }}>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{n.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{formatDate(n.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-1 pb-6 text-white">
          <p className="text-white/70 text-sm" data-testid="text-greeting-label">{new Date().getHours() < 12 ? t("dashboard.goodMorning") : new Date().getHours() < 18 ? t("dashboard.goodAfternoon") : t("dashboard.goodEvening")},</p>
          <h2 className="text-2xl font-extrabold mt-0.5" data-testid="text-greeting">Dr. {userName.split(" ").slice(0, 2).join(" ") || "Doutor"}</h2>
          <p className="text-white/60 text-sm mt-1">{t("dashboard.financialSummary")}</p>
        </div>

        <div className="relative z-20 mb-4" ref={searchRef}>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => { handleSearchChange(e.target.value); if (!showSearch) setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              placeholder={t("dashboard.searchPlaceholder")}
              className="w-full pl-11 pr-10 h-12 rounded-2xl bg-white dark:bg-slate-900 border-0 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3)] text-slate-800 dark:text-slate-100 text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#8855f6]/40 transition-all"
              data-testid="input-smart-search"
            />
            {searchLoading && <Loader2 className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-[#8855f6] animate-spin" />}
            {searchQuery && !searchLoading && (
              <button onClick={() => { setSearchQuery(""); setSearchResults([]); setShowSearch(false); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {showSearch && searchQuery.length >= 2 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-80 overflow-y-auto">
              {searchLoading ? (
                <div className="px-6 py-8 text-center"><Loader2 className="w-5 h-5 text-[#8855f6] animate-spin mx-auto mb-2" /><p className="text-xs text-slate-400">{t("dashboard.searching")}</p></div>
              ) : searchResults.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <Search className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t("dashboard.noResultsFor", { query: searchQuery })}</p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("dashboard.resultCount", { count: searchResults.length })}</p>
                  </div>
                  {searchResults.map(entry => (
                    <div
                      key={entry.id}
                      onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); openEditModal(entry); }}
                      className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-b border-slate-50 dark:border-slate-800 last:border-b-0"
                      data-testid={`search-result-${entry.id}`}
                    >
                      <div className={`size-8 rounded-full flex items-center justify-center flex-shrink-0 ${statusColor(entry.status)}`}>{statusIcon(entry.status)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{entry.description} - {entry.patientName}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{entry.insuranceProvider} • {formatDate(entry.createdAt)}</p>
                      </div>
                      {entry.procedureValue && <span className="text-xs font-bold text-green-600 dark:text-green-400 flex-shrink-0">{formatCurrency(entry.procedureValue)}</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="stats-grid">
          <button onClick={() => setLocation("/entries?status=pending")} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] text-left active:scale-[0.97] transition-transform" data-testid="card-pending">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl"><Clock className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">{pendingCount}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{t("dashboard.pendingLabel")}</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white" data-testid="stat-pending">{pendingCount}</p>
          </button>
          <button onClick={() => setLocation("/entries?status=reconciled")} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] text-left active:scale-[0.97] transition-transform" data-testid="card-reconciled">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl"><CreditCard className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">{reconciledCount}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{t("dashboard.reconciledLabel")}</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white" data-testid="stat-reconciled">{reconciledCount}</p>
          </button>
          <button onClick={() => setLocation("/entries?status=divergent")} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] text-left active:scale-[0.97] transition-transform" data-testid="card-divergent">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl"><AlertTriangle className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">{divergentCount}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{t("dashboard.divergentLabel")}</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white" data-testid="stat-divergent">{divergentCount}</p>
          </button>
          <button onClick={() => setLocation("/entries")} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] text-left active:scale-[0.97] transition-transform" data-testid="card-total">
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 bg-[#8855f6]/10 text-[#8855f6] rounded-xl"><FileText className="w-4 h-4" /></span>
              <span className="text-xs font-bold text-[#8855f6] bg-[#8855f6]/10 px-2 py-0.5 rounded-full">{entries.length}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{t("dashboard.totalLabel")}</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white" data-testid="stat-total-value">{entries.length}</p>
          </button>
        </div>

        <ProjectionsPanel />

        <div className="mb-6">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">{t("dashboard.recentEntries")}</h3>
            <button onClick={() => setLocation("/entries")} className="text-xs text-[#8855f6] font-bold flex items-center gap-1 hover:underline" data-testid="link-view-all">
              {t("dashboard.viewAll")} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {loadingEntries ? (
              <div className="card-float px-6 py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[#8855f6] animate-spin" /></div>
            ) : recentEntries.length === 0 ? (
              <div className="card-float px-6 py-10 text-center">
                <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t("dashboard.noEntries")}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t("dashboard.noEntriesHint")}</p>
              </div>
            ) : (
              recentEntries.map(entry => (
                <div key={entry.id} onClick={() => openEditModal(entry)} className="card-float px-4 py-4 flex items-center gap-3.5 cursor-pointer" data-testid={`entry-row-${entry.id}`}>
                  <div className={`size-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${statusColor(entry.status)}`}>{statusIcon(entry.status)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[15px] text-slate-800 dark:text-slate-100 truncate">{entry.description}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">{entry.patientName} • {entry.insuranceProvider}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(entry.createdAt)}</p>
                  </div>
                  {entry.procedureValue && <span className="text-sm font-bold text-green-600 dark:text-green-400 flex-shrink-0">{formatCurrency(entry.procedureValue)}</span>}
                </div>
              ))
            )}
          </div>
        </div>

      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={(updated) => { setEntries(prev => prev.map(e => e.id === updated.id ? updated : e)); setEditingEntry(null); }}
          onDeleted={(id) => { setEntries(prev => prev.filter(e => e.id !== id)); setEditingEntry(null); }}
        />
      )}

      <AppTour />
    </div>
  );
}
