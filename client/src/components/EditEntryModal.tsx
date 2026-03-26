import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X, Trash2, Save, Loader2,
  User, Calendar, Building2, FileText, DollarSign, ExternalLink
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

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

interface EditEntryModalProps {
  entry: DoctorEntry;
  onClose: () => void;
  onSaved: (updatedEntry: DoctorEntry) => void;
  onDeleted: (id: string) => void;
}

export default function EditEntryModal({ entry, onClose, onSaved, onDeleted }: EditEntryModalProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    patientName: entry.patientName,
    procedureDate: entry.procedureDate ? new Date(entry.procedureDate).toISOString().split("T")[0] : "",
    insuranceProvider: entry.insuranceProvider,
    description: entry.description,
    status: entry.status,
    procedureValue: entry.procedureValue || "",
  });

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved({ ...entry, ...data.entry });
        toast({ title: t("dashboard.updated"), description: t("dashboard.updatedDesc") });
      } else {
        toast({ title: t("common.error"), description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("dashboard.updateFailed"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("dashboard.confirmDelete"))) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onDeleted(entry.id);
        toast({ title: t("dashboard.deleted"), description: t("dashboard.deletedDesc") });
      } else {
        toast({ title: t("common.error"), description: t("dashboard.deleteFailed"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("dashboard.deleteFailedDesc"), variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col animate-in slide-in-from-bottom duration-300 sm:mx-4 fixed bottom-0 sm:relative sm:bottom-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t("dashboard.editEntry")}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onClose(); setLocation(`/entry/${entry.id}`); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8855f6]/10 text-[#8855f6] text-xs font-semibold hover:bg-[#8855f6]/20 transition-colors"
              data-testid="button-view-details"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("common.viewDetails")}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" data-testid="button-close-edit" aria-label={t("common.close")}>
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
        <div className="px-6 py-6 space-y-5 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><User className="w-3.5 h-3.5 text-[#8855f6]" /> {t("common.patient")}</Label>
            <Input value={editForm.patientName} onChange={e => setEditForm(f => ({ ...f, patientName: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium" data-testid="edit-patient-name" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><Calendar className="w-3.5 h-3.5 text-[#8855f6]" /> {t("common.date")}</Label>
            <Input type="date" value={editForm.procedureDate} onChange={e => setEditForm(f => ({ ...f, procedureDate: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium" data-testid="edit-procedure-date" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><Building2 className="w-3.5 h-3.5 text-[#8855f6]" /> {t("common.insurance")}</Label>
            <Input value={editForm.insuranceProvider} onChange={e => setEditForm(f => ({ ...f, insuranceProvider: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium" data-testid="edit-insurance" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><FileText className="w-3.5 h-3.5 text-[#8855f6]" /> {t("common.procedure")}</Label>
            <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium" data-testid="edit-description" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm"><DollarSign className="w-3.5 h-3.5 text-[#8855f6]" /> {t("common.value")}</Label>
            <Input type="number" step="0.01" min="0" value={editForm.procedureValue} onChange={e => setEditForm(f => ({ ...f, procedureValue: e.target.value }))} placeholder="0.00" className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 font-medium" data-testid="edit-value" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{t("common.status")}</Label>
            <div className="flex gap-2">
              {[
                { value: "pending", label: t("common.pending"), color: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
                { value: "reconciled", label: t("common.reconciled"), color: "border-green-300 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/30 dark:text-green-400" },
                { value: "divergent", label: t("common.divergent"), color: "border-red-300 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-400" },
              ].map(s => (
                <button key={s.value} onClick={() => setEditForm(f => ({ ...f, status: s.value }))} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${editForm.status === s.value ? s.color : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`} data-testid={`edit-status-${s.value}`}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 flex gap-3 border-t border-slate-100 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
          <Button onClick={handleDelete} variant="outline" className="h-12 px-4 rounded-full font-bold border-2 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30" data-testid="button-delete-entry" aria-label={t("common.deleteEntry")}><Trash2 className="w-4 h-4" /></Button>
          <Button onClick={handleSave} disabled={isSaving} className="flex-1 h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold shadow-lg shadow-[#8855f6]/30 hover:shadow-xl transition-all" data-testid="button-save-edit">
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("common.saving")}</> : <><Save className="w-4 h-4 mr-2" /> {t("dashboard.saveChanges")}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
