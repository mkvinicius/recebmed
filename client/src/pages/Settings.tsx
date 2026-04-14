import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Stethoscope, User, Lock, Loader2, Eye, EyeOff, Save, ShieldAlert, CheckCircle2, ArrowLeft, Brain,
  BookOpen, ChevronRight, RotateCcw, AlertTriangle,
} from "lucide-react";
import { getToken, getUser, saveAuth, updateUserData, clearAuth, getRequiresPasswordUpdate, setRequiresPasswordUpdate, type UserData } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function Settings() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [requiresPwUpdate, setRequiresPwUpdate] = useState(getRequiresPasswordUpdate());
  const [aiAuditEnabled, setAiAuditEnabled] = useState(true);
  const [aiAuditLoading, setAiAuditLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [doctrine, setDoctrine] = useState("");
  const [doctrineOriginal, setDoctrineOriginal] = useState("");
  const [savingDoctrine, setSavingDoctrine] = useState(false);
  const [fullResetConfirm, setFullResetConfirm] = useState("");
  const [isFullResetting, setIsFullResetting] = useState(false);
  const [fullResetResult, setFullResetResult] = useState<{ entriesReset: number; reportsReset: number; reconciled: number; divergent: number; pending: number } | null>(null);

  const passwordChecks = [
    { ok: newPassword.length >= 8, label: t("forgotPassword.rule8chars") },
    { ok: /[A-Z]/.test(newPassword), label: t("forgotPassword.ruleUppercase") },
    { ok: /[a-z]/.test(newPassword), label: t("forgotPassword.ruleLowercase") },
    { ok: /[0-9]/.test(newPassword), label: t("forgotPassword.ruleNumber") },
  ];

  useEffect(() => {
    const token = getToken();
    if (!token) { setLocation("/login"); return; }
    const user = getUser();
    if (user) setName(user.name);
    (async () => {
      try {
        const [auditRes, adminRes] = await Promise.all([
          fetch("/api/auth/ai-audit", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/auth/is-admin", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (auditRes.ok) {
          const data = await auditRes.json();
          setAiAuditEnabled(data.aiAuditEnabled);
        }
        if (adminRes.ok) {
          const data = await adminRes.json();
          setIsAdmin(data.isAdmin);
          if (data.isAdmin) {
            try {
              const docRes = await fetch("/api/auth/platform-doctrine", { headers: { Authorization: `Bearer ${token}` } });
              if (docRes.ok) {
                const docData = await docRes.json();
                setDoctrine(docData.doctrine || "");
                setDoctrineOriginal(docData.doctrine || "");
              }
            } catch {}
          }
        }
      } catch {}
    })();
  }, [setLocation]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast({ title: t("common.error"), description: t("settings.nameRequired"), variant: "destructive" });
      return;
    }
    const token = getToken();
    if (!token) return;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        updateUserData(data.user);
        toast({ title: t("common.success"), description: t("settings.profileUpdated") });
      } else {
        toast({ title: t("common.error"), description: data.message || t("settings.profileUpdateError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleAiAudit = async () => {
    const token = getToken();
    if (!token) return;
    setAiAuditLoading(true);
    try {
      const res = await fetch("/api/auth/ai-audit", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !aiAuditEnabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiAuditEnabled(data.aiAuditEnabled);
        toast({ title: t("common.success"), description: data.aiAuditEnabled ? t("settings.aiAuditActivated") : t("settings.aiAuditDeactivated") });
      } else {
        toast({ title: t("common.error"), description: t("settings.aiAuditError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } finally {
      setAiAuditLoading(false);
    }
  };

  const handleSaveDoctrine = async () => {
    const token = getToken();
    if (!token) return;
    setSavingDoctrine(true);
    try {
      const res = await fetch("/api/auth/platform-doctrine", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ doctrine }),
      });
      if (res.ok) {
        const data = await res.json();
        setDoctrineOriginal(data.doctrine || "");
        toast({ title: t("common.success"), description: t("settings.doctrineSaved") });
      } else {
        toast({ title: t("common.error"), description: t("settings.doctrineError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } finally {
      setSavingDoctrine(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: t("common.error"), description: t("settings.fillAllPassword"), variant: "destructive" });
      return;
    }
    const pwValid = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword);
    if (!pwValid) {
      toast({ title: t("common.error"), description: t("forgotPassword.passwordRequirements"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("common.error"), description: t("settings.passwordMismatch"), variant: "destructive" });
      return;
    }
    const token = getToken();
    if (!token) return;
    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setRequiresPasswordUpdate(false);
        setRequiresPwUpdate(false);
        toast({ title: t("common.success"), description: t("settings.passwordChanged") });
      } else {
        toast({ title: t("common.error"), description: data.message || t("settings.passwordChangeError"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("common.error"), description: t("common.serverConnectionFailed"), variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleFullReset = async () => {
    const token = getToken();
    if (!token) return;
    setIsFullResetting(true);
    setFullResetResult(null);
    try {
      const res = await fetch("/api/reconciliation/full-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: fullResetConfirm }),
      });
      const data = await res.json();
      if (res.ok) {
        setFullResetConfirm("");
        setFullResetResult({
          entriesReset: data.entriesReset,
          reportsReset: data.reportsReset,
          reconciled: data.reconciliation?.reconciled?.length ?? 0,
          divergent: data.reconciliation?.divergent?.length ?? 0,
          pending: data.reconciliation?.pending?.length ?? 0,
        });
        toast({ title: "Reset concluído", description: `${data.entriesReset} lançamentos reprocessados com a nova lógica.` });
      } else {
        toast({ title: "Erro", description: data.message || "Falha ao realizar reset", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro", description: "Falha na conexão com o servidor", variant: "destructive" });
    } finally {
      setIsFullResetting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-1 pb-4 text-white">
          <button onClick={() => setLocation("/profile")} className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-2 transition-colors" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
            <span>{t("common.back")}</span>
          </button>
          <h2 className="text-2xl font-extrabold" data-testid="text-settings-title">{t("settings.title")}</h2>
          <p className="text-white/80 text-sm mt-1">{t("settings.subtitle")}</p>
        </div>

        {requiresPwUpdate && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-4 flex items-start gap-3" data-testid="banner-weak-password">
            <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 dark:text-red-300 text-sm">{t("settings.weakPasswordWarning")}</h3>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t("settings.weakPasswordWarningDesc")}</p>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-full bg-[#8855f6]/10 flex items-center justify-center">
              <User className="w-5 h-5 text-[#8855f6]" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100" data-testid="text-profile-section">{t("settings.profileSection")}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("settings.profileSectionDesc")}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("settings.fullName")}</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("settings.fullNamePlaceholder")}
                className="mt-1.5 rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:border-[#8855f6] focus:ring-[#8855f6]"
                data-testid="input-profile-name"
              />
            </div>
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="flex items-center gap-2 bg-[#8855f6] hover:bg-[#7744e0] text-white rounded-full px-6 font-bold shadow-lg shadow-[#8855f6]/20"
              data-testid="button-save-profile"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingProfile ? t("settings.savingProfile") : t("settings.saveProfile")}
            </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-full bg-[#8855f6]/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-[#8855f6]" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100" data-testid="text-ai-audit-section">{t("settings.aiAuditSection")}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("settings.aiAuditSectionDesc")}</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
            <div className="flex-1 min-w-0 mr-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200" data-testid="text-ai-audit-status">
                {aiAuditEnabled ? t("settings.aiAuditEnabled") : t("settings.aiAuditDisabled")}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">{t("settings.aiAuditToggleDesc")}</p>
            </div>
            <button
              onClick={handleToggleAiAudit}
              disabled={aiAuditLoading}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${aiAuditEnabled ? "bg-[#8855f6]" : "bg-slate-300 dark:bg-slate-600"}`}
              data-testid="toggle-ai-audit"
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${aiAuditEnabled ? "translate-x-5" : "translate-x-0"}`}>
                {aiAuditLoading && <Loader2 className="w-4 h-4 text-[#8855f6] animate-spin absolute top-1 left-1" />}
              </span>
            </button>
          </div>

          <button
            onClick={() => setLocation("/audit-reports")}
            className="w-full mt-4 flex items-center justify-between p-4 rounded-xl bg-[#8855f6]/5 dark:bg-[#8855f6]/10 border border-[#8855f6]/20 hover:bg-[#8855f6]/10 dark:hover:bg-[#8855f6]/20 transition-colors group"
            data-testid="button-view-audit-reports"
          >
            <div className="flex items-center gap-3">
              <Brain className="w-4 h-4 text-[#8855f6]" />
              <span className="text-sm font-semibold text-[#8855f6]">{t("settings.viewAuditReports")}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8855f6] group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {isAdmin && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100" data-testid="text-doctrine-section">{t("settings.doctrineSection")}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("settings.doctrineSectionDesc")}</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 leading-relaxed">{t("settings.doctrineHelp")}</p>

            <textarea
              value={doctrine}
              onChange={(e) => setDoctrine(e.target.value)}
              rows={8}
              placeholder={t("settings.doctrinePlaceholder")}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#8855f6]/50 resize-y"
              data-testid="textarea-doctrine"
            />

            <div className="flex justify-end mt-3">
              <Button
                onClick={handleSaveDoctrine}
                disabled={savingDoctrine || doctrine === doctrineOriginal}
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-2"
                data-testid="button-save-doctrine"
              >
                {savingDoctrine ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingDoctrine ? t("settings.savingDoctrine") : t("settings.saveDoctrine")}
              </Button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-red-200/60 dark:border-red-800/40 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Reprocessar conferência completa</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Zona de risco — use somente quando necessário</p>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-800 dark:text-red-300 font-semibold mb-1">O que esta ação faz:</p>
            <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
              <li>Volta <strong>todos</strong> os lançamentos (incluindo já conferidos) para "Pendente"</li>
              <li>Desmarca todos os relatórios da clínica como não conferidos</li>
              <li>Roda a reconciliação do zero com a lógica atualizada</li>
              <li>Lançamentos "Validado" pelo médico <strong>não são tocados</strong></li>
            </ul>
            <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">Use após atualização do sistema para corrigir conferências incorretas feitas pela lógica antiga.</p>
          </div>

          {fullResetResult && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">Reset concluído com sucesso</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-400">
                <span>Lançamentos reprocessados: <strong>{fullResetResult.entriesReset}</strong></span>
                <span>Relatórios liberados: <strong>{fullResetResult.reportsReset}</strong></span>
                <span>Conferidos: <strong>{fullResetResult.reconciled}</strong></span>
                <span>Divergentes: <strong>{fullResetResult.divergent}</strong></span>
                <span>Pendentes: <strong>{fullResetResult.pending}</strong></span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Digite <span className="font-mono text-red-600 dark:text-red-400">CONFIRMAR</span> para habilitar o botão
              </Label>
              <Input
                type="text"
                value={fullResetConfirm}
                onChange={(e) => { setFullResetConfirm(e.target.value); setFullResetResult(null); }}
                placeholder="CONFIRMAR"
                className="mt-1.5 rounded-xl border-red-200 dark:border-red-700 dark:bg-slate-800 dark:text-slate-100 focus:border-red-500 focus:ring-red-500 font-mono"
                data-testid="input-full-reset-confirm"
              />
            </div>
            <Button
              onClick={handleFullReset}
              disabled={fullResetConfirm !== "CONFIRMAR" || isFullResetting}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-full px-6 font-bold shadow-lg shadow-red-600/20"
              data-testid="button-full-reset"
            >
              {isFullResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              {isFullResetting ? "Reprocessando..." : "Reprocessar tudo agora"}
            </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100/60 dark:border-slate-700/40 p-6 mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-full bg-[#8855f6]/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#8855f6]" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100" data-testid="text-password-section">{t("settings.changePassword")}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("settings.changePasswordDesc")}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="currentPassword" className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("settings.currentPassword")}</Label>
              <div className="relative mt-1.5">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t("settings.currentPasswordPlaceholder")}
                  className="rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:border-[#8855f6] focus:ring-[#8855f6] pr-10"
                  data-testid="input-current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  data-testid="button-toggle-current-password"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="newPassword" className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("settings.newPassword")}</Label>
              <div className="relative mt-1.5">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("settings.newPasswordPlaceholder")}
                  className="rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:border-[#8855f6] focus:ring-[#8855f6] pr-10"
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  data-testid="button-toggle-new-password"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword && (
                <ul className="mt-2 space-y-1">
                  {passwordChecks.map((c, i) => (
                    <li key={i} className={`text-xs flex items-center gap-1.5 ${c.ok ? "text-green-600" : "text-slate-400 dark:text-slate-500"}`}>
                      {c.ok ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
                      {c.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("settings.confirmPassword")}</Label>
              <div className="relative mt-1.5">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("settings.confirmPasswordPlaceholder")}
                  className="rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 focus:border-[#8855f6] focus:ring-[#8855f6] pr-10"
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  data-testid="button-toggle-confirm-password"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={savingPassword}
              className="flex items-center gap-2 bg-[#8855f6] hover:bg-[#7744e0] text-white rounded-full px-6 font-bold shadow-lg shadow-[#8855f6]/20"
              data-testid="button-save-password"
            >
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {savingPassword ? t("settings.changingPassword") : t("settings.changePassword")}
            </Button>
          </div>
        </div>
    </div>
  );
}
