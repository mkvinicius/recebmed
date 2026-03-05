import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Stethoscope, ArrowLeft, User, Lock, Loader2, Eye, EyeOff, Save,
} from "lucide-react";
import { getToken, getUser, saveAuth, clearAuth, type UserData } from "@/lib/auth";
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
        saveAuth(token, data.user);
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
    if (newPassword.length < 6) {
      toast({ title: t("common.error"), description: t("settings.passwordTooShort"), variant: "destructive" });
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
    <div className="min-h-screen bg-[#f6f5f8] dark:bg-[#0d0a14] text-slate-900 dark:text-slate-100 relative">
      <div className="hero-gradient h-56 w-full absolute top-0 left-0 z-0" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3 text-white">
            {(() => { const u = getUser(); const photoUrl = u?.profilePhotoUrl; const ini = u?.name ? u.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "Dr"; return (
              <div className="size-11 bg-gradient-to-br from-white/30 to-white/10 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/30 shadow-lg overflow-hidden" data-testid="avatar-profile">
                {photoUrl ? <img src={photoUrl} alt={t("common.profile")} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-white tracking-wide">{ini}</span>}
              </div>
            ); })()}
            <h1 className="text-xl font-bold tracking-tight">RecebMed</h1>
          </div>
          <button
            onClick={() => setLocation("/profile")}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md text-sm font-semibold"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("common.back")}
          </button>
        </header>

        <div className="pt-2 pb-8 text-white">
          <h2 className="text-2xl font-extrabold" data-testid="text-settings-title">{t("settings.title")}</h2>
          <p className="text-white/80 text-sm mt-1">{t("settings.subtitle")}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] p-6 mb-6">
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)] border border-slate-100/70 dark:border-slate-700/50 dark:shadow-[0_2px_16px_-2px_rgba(0,0,0,0.3)] p-6 mb-12">
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
    </div>
  );
}
