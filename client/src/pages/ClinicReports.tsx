import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Stethoscope, Plus, Trash2, Loader2, FileText, Calendar, DollarSign, User
} from "lucide-react";
import { getToken, clearAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getLocale, getCurrencyCode } from "@/lib/i18n";

interface ClinicReport {
  id: string;
  patientName: string;
  procedureDate: string;
  reportedValue: string;
  description: string | null;
  createdAt: string;
}

export default function ClinicReports() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [reports, setReports] = useState<ClinicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    patientName: "",
    procedureDate: "",
    reportedValue: "",
    description: "",
  });
  const { toast } = useToast();

  const locale = getLocale();
  const currency = getCurrencyCode();

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    fetchReports(token);
  }, [setLocation]);

  const fetchReports = async (token: string) => {
    try {
      const res = await fetch("/api/clinic-reports", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { clearAuth(); setLocation("/login"); return; }
      const data = await res.json();
      if (res.ok) setReports(data.reports || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    if (!form.patientName || !form.procedureDate || !form.reportedValue) {
      toast({ title: t("common.error"), description: t("clinicReports.requiredFields"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/clinic-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientName: form.patientName,
          procedureDate: form.procedureDate,
          reportedValue: form.reportedValue,
          description: form.description || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReports(prev => [data.report, ...prev]);
        setForm({ patientName: "", procedureDate: "", reportedValue: "", description: "" });
        setShowForm(false);
        toast({ title: t("common.success"), description: t("clinicReports.saved") });
      } else {
        toast({ title: t("common.error"), description: data.message || t("clinicReports.saveError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("clinicReports.connectionError"), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("clinicReports.confirmDelete"))) return;
    const token = getToken();
    if (!token) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/clinic-reports/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== id));
        toast({ title: t("clinicReports.deleted"), description: t("clinicReports.deletedDesc") });
      } else {
        toast({ title: t("common.error"), description: t("clinicReports.deleteError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("clinicReports.connectionError"), variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return (0).toLocaleString(locale, { style: "currency", currency });
    return num.toLocaleString(locale, { style: "currency", currency });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-2 pb-6 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-page-title">{t("clinicReports.title")}</h2>
          <p className="text-white/80 text-sm mt-1">{t("clinicReports.subtitle")}</p>
        </div>

        <div className="glass-card dark:glass-card-dark rounded-2xl p-6 shadow-2xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t("clinicReports.addReport")}</h3>
            <Button
              onClick={() => setShowForm(!showForm)}
              className={`flex items-center gap-2 px-4 py-2 h-auto rounded-full font-bold transition-all ${
                showForm
                  ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                  : "bg-[#8855f6] text-white shadow-lg shadow-[#8855f6]/30 hover:bg-[#7744e0]"
              }`}
              data-testid="button-toggle-form"
            >
              <Plus className={`w-4 h-4 transition-transform ${showForm ? "rotate-45" : ""}`} />
              {showForm ? t("clinicReports.cancelAdd") : t("clinicReports.newReport")}
            </Button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 dark:border-slate-700 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="patientName" className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                    {t("clinicReports.patientName")}
                  </Label>
                  <Input
                    id="patientName"
                    value={form.patientName}
                    onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))}
                    placeholder={t("clinicReports.patientPlaceholder")}
                    className="rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    data-testid="input-patient-name"
                  />
                </div>
                <div>
                  <Label htmlFor="procedureDate" className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                    {t("clinicReports.procedureDate")}
                  </Label>
                  <Input
                    id="procedureDate"
                    type="date"
                    value={form.procedureDate}
                    onChange={e => setForm(f => ({ ...f, procedureDate: e.target.value }))}
                    className="rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    data-testid="input-procedure-date"
                  />
                </div>
                <div>
                  <Label htmlFor="reportedValue" className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                    {t("clinicReports.reportedValue")}
                  </Label>
                  <Input
                    id="reportedValue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.reportedValue}
                    onChange={e => setForm(f => ({ ...f, reportedValue: e.target.value }))}
                    placeholder="0,00"
                    className="rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    data-testid="input-reported-value"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                    {t("clinicReports.description")}
                  </Label>
                  <Input
                    id="description"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder={t("clinicReports.descriptionPlaceholder")}
                    className="rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    data-testid="input-description"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 h-auto bg-[#8855f6] text-white rounded-full font-bold shadow-lg shadow-[#8855f6]/30 hover:bg-[#7744e0]"
                  data-testid="button-save-report"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? t("clinicReports.savingReport") : t("clinicReports.saveReport")}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="mb-12">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t("clinicReports.registeredReports")}</h3>
            <span className="text-[#8855f6] text-sm font-bold" data-testid="text-report-count">
              {reports.length === 1 ? t("clinicReports.reportCount", { count: reports.length }) : t("clinicReports.reportCountPlural", { count: reports.length })}
            </span>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="card-float px-6 py-12 flex justify-center">
                <Loader2 className="w-6 h-6 text-[#8855f6] animate-spin" />
              </div>
            ) : reports.length === 0 ? (
              <div className="card-float px-6 py-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">{t("clinicReports.noReports")}</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{t("clinicReports.noReportsHint")}</p>
              </div>
            ) : (
              reports.map((report) => (
                <div
                  key={report.id}
                  className="card-float px-4 py-4 flex items-center justify-between"
                  data-testid={`report-row-${report.id}`}
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="size-11 rounded-2xl flex items-center justify-center bg-[#8855f6]/10 text-[#8855f6] shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[15px] text-slate-800 dark:text-slate-200 truncate">
                        {report.patientName}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {report.description || t("clinicReports.noDescription")}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {formatDate(report.procedureDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(report.reportedValue)}
                    </span>
                    <button
                      onClick={() => handleDelete(report.id)}
                      disabled={deletingId === report.id}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      data-testid={`button-delete-report-${report.id}`}
                      title={t("common.delete")}
                    >
                      {deletingId === report.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
    </div>
  );
}