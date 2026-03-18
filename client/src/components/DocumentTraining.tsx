import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Brain, Upload, Loader2, Check, X, Trash2, ChevronDown, ChevronUp, FileText, Save, ArrowRight
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  sampleValues: string[];
}

interface AnalysisResult {
  columns: ColumnMapping[];
  sampleRows: Record<string, string>[];
  documentType: string;
}

interface DocumentTemplate {
  id: string;
  name: string;
  mappingJson: string;
  sampleHash: string | null;
  createdAt: string;
}

type Step = "idle" | "uploading" | "analyzing" | "mapping" | "saving";

const TARGET_FIELDS: { value: string; label: string }[] = [
  { value: "patientName", label: "Nome do Paciente" },
  { value: "procedureDate", label: "Data do Procedimento" },
  { value: "insuranceProvider", label: "Convênio" },
  { value: "procedureName", label: "Procedimento" },
  { value: "reportedValue", label: "Valor" },
  { value: "paymentMethod", label: "Forma de Pagamento" },
  { value: "patientBirthDate", label: "Data de Nascimento" },
  { value: "description", label: "Descrição" },
  { value: "ignore", label: "Ignorar" },
];

export default function DocumentTraining() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("idle");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [sampleHash, setSampleHash] = useState<string>("");
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/document-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    let fileType: string;
    if (ext === "pdf") fileType = "pdf";
    else if (ext === "csv") fileType = "csv";
    else {
      toast({ title: t("common.error"), description: t("documentTraining.unsupportedFormat"), variant: "destructive" });
      return;
    }

    setStep("uploading");
    const token = getToken();
    if (!token) return;

    try {
      const base64 = await fileToBase64(file);
      setStep("analyzing");

      const res = await fetch("/api/document-templates/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ file: base64, fileType }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || t("documentTraining.analyzeError"));
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      setSampleHash(data.sampleHash || "");
      setMappings(data.analysis.columns.map((c: ColumnMapping) => ({ ...c })));
      setTemplateName(data.analysis.documentType || file.name.replace(/\.[^.]+$/, ""));
      setStep("mapping");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err?.message || t("documentTraining.analyzeError"), variant: "destructive" });
      setStep("idle");
    }
    e.target.value = "";
  };

  const handleMappingChange = (index: number, targetField: string) => {
    setMappings(prev => prev.map((m, i) => i === index ? { ...m, targetField } : m));
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast({ title: t("common.error"), description: t("documentTraining.nameRequired"), variant: "destructive" });
      return;
    }

    const activeMappings = mappings.filter(m => m.targetField !== "ignore");
    if (activeMappings.length === 0) {
      toast({ title: t("common.error"), description: t("documentTraining.noMappings"), variant: "destructive" });
      return;
    }

    setStep("saving");
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch("/api/document-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: templateName.trim(),
          mappingJson: JSON.stringify(mappings),
          sampleHash,
        }),
      });

      if (!res.ok) throw new Error(t("documentTraining.saveError"));

      toast({ title: t("common.success"), description: t("documentTraining.saved") });
      setStep("idle");
      setAnalysis(null);
      setMappings([]);
      setTemplateName("");
      fetchTemplates();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err?.message || t("documentTraining.saveError"), variant: "destructive" });
      setStep("mapping");
    }
  };

  const handleDelete = async (id: string) => {
    const token = getToken();
    if (!token) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/document-templates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id));
        toast({ title: t("common.success"), description: t("documentTraining.templateDeleted") });
      }
    } catch {}
    setDeletingId(null);
  };

  const handleCancel = () => {
    setStep("idle");
    setAnalysis(null);
    setMappings([]);
    setTemplateName("");
  };

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] p-5" data-testid="card-document-training">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl flex items-center justify-center bg-[#8855f6]/10 text-[#8855f6]">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-slate-800 dark:text-slate-200" data-testid="text-training-title">
                {t("documentTraining.title")}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("documentTraining.subtitle")}</p>
            </div>
          </div>
          {templates.length > 0 && (
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-xs font-semibold text-[#8855f6] hover:text-[#7744e0] flex items-center gap-1"
              data-testid="button-toggle-templates"
            >
              {templates.length} {templates.length === 1 ? t("documentTraining.templateSaved") : t("documentTraining.templatesSaved")}
              {showTemplates ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {step === "idle" && (
          <label
            className="flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#8855f6]/50 hover:bg-[#8855f6]/5 transition-colors cursor-pointer"
            data-testid="input-training-file"
          >
            <Upload className="w-6 h-6 text-slate-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {t("documentTraining.uploadPrompt")}
            </span>
            <span className="text-xs text-slate-400">{t("documentTraining.uploadHint")}</span>
            <input type="file" accept=".pdf,.csv" className="hidden" onChange={handleFileSelect} />
          </label>
        )}

        {(step === "uploading" || step === "analyzing") && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 text-[#8855f6] animate-spin" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {step === "uploading" ? t("documentTraining.uploading") : t("documentTraining.analyzing")}
            </p>
            <p className="text-xs text-slate-400">{t("documentTraining.waitMessage")}</p>
          </div>
        )}

        {step === "mapping" && analysis && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {t("documentTraining.detectedType")}: <span className="text-[#8855f6]">{analysis.documentType}</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {analysis.columns.length} {t("documentTraining.columnsFound")}
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                data-testid="button-cancel-training"
              >
                <X className="w-3.5 h-3.5" /> {t("common.cancel")}
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs font-bold text-slate-500 dark:text-slate-400 px-2">
                <span>{t("documentTraining.sourceColumn")}</span>
                <span></span>
                <span>{t("documentTraining.targetField")}</span>
              </div>
              {mappings.map((mapping, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2"
                  data-testid={`mapping-row-${idx}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {mapping.sourceColumn}
                    </p>
                    {mapping.sampleValues.length > 0 && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {t("documentTraining.samplePrefix")}: {mapping.sampleValues.slice(0, 2).join(", ")}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                  <select
                    value={mapping.targetField}
                    onChange={e => handleMappingChange(idx, e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-2 py-1.5 focus:ring-2 focus:ring-[#8855f6]/30 focus:border-[#8855f6]"
                    data-testid={`select-mapping-${idx}`}
                  >
                    {TARGET_FIELDS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {analysis.sampleRows.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                  {t("documentTraining.preview")}
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800">
                        {Object.keys(analysis.sampleRows[0]).map(col => (
                          <th key={col} className="px-2 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.sampleRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-2 py-1.5 text-slate-500 dark:text-slate-400 whitespace-nowrap max-w-[150px] truncate">
                              {val as string}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder={t("documentTraining.namePlaceholder")}
                className="flex-1 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-[#8855f6]/30 focus:border-[#8855f6]"
                data-testid="input-template-name"
              />
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8855f6] text-white text-sm font-bold hover:bg-[#7744e0] transition-colors"
                data-testid="button-save-template"
              >
                <Save className="w-4 h-4" /> {t("documentTraining.saveTemplate")}
              </button>
            </div>
          </div>
        )}

        {step === "saving" && (
          <div className="flex items-center justify-center gap-3 py-6">
            <Loader2 className="w-5 h-5 text-[#8855f6] animate-spin" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t("common.saving")}</span>
          </div>
        )}
      </div>

      {showTemplates && templates.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden" data-testid="card-saved-templates">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("documentTraining.savedTemplates")}</p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {templates.map(tmpl => {
              let colCount = 0;
              try { colCount = JSON.parse(tmpl.mappingJson).filter((m: any) => m.targetField !== "ignore").length; } catch {}
              return (
                <div key={tmpl.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30" data-testid={`template-row-${tmpl.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-xl bg-[#8855f6]/10 text-[#8855f6] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{tmpl.name}</p>
                      <p className="text-xs text-slate-400">
                        {colCount} {t("documentTraining.mappedFields")} • {new Date(tmpl.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(tmpl.id)}
                    disabled={deletingId === tmpl.id}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    data-testid={`button-delete-template-${tmpl.id}`}
                  >
                    {deletingId === tmpl.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
