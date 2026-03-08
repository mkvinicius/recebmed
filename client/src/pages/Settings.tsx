import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Stethoscope, User, Lock, Loader2, Eye, EyeOff, Save, ShieldAlert, CheckCircle2,
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

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-1 pb-4 text-white">
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] p-6 mb-6">
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] p-6 mb-12">
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
