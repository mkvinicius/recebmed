import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Stethoscope, ArrowLeft, CheckCircle2, ShieldCheck, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";

function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();
  const checks = useMemo(() => [
    { ok: password.length >= 8, label: t("forgotPassword.rule8chars") },
    { ok: /[A-Z]/.test(password), label: t("forgotPassword.ruleUppercase") },
    { ok: /[a-z]/.test(password), label: t("forgotPassword.ruleLowercase") },
    { ok: /[0-9]/.test(password), label: t("forgotPassword.ruleNumber") },
  ], [password, t]);

  const passed = checks.filter(c => c.ok).length;
  const strength = passed === 0 ? 0 : passed <= 2 ? 1 : passed <= 3 ? 2 : 3;
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
  const labels = [t("forgotPassword.strengthWeak"), t("forgotPassword.strengthWeak"), t("forgotPassword.strengthMedium"), t("forgotPassword.strengthStrong")];

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? colors[strength] : "bg-slate-200 dark:bg-slate-700"}`} />
        ))}
      </div>
      <p className={`text-xs font-semibold ${strength <= 1 ? "text-red-500" : strength === 2 ? "text-yellow-600" : "text-green-600"}`}>
        {labels[strength]}
      </p>
      <ul className="space-y-1">
        {checks.map((c, i) => (
          <li key={i} className={`text-xs flex items-center gap-1.5 ${c.ok ? "text-green-600" : "text-slate-400 dark:text-slate-500"}`}>
            {c.ok ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const passwordValid = useMemo(() => {
    return newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword);
  }, [newPassword]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: t("common.error"), description: data.message, variant: "destructive" });
        return;
      }
      if (data.code) {
        setDevCode(data.code);
      }
      setStep("code");
      toast({ title: t("forgotPassword.codeSent"), description: t("forgotPassword.codeSentDesc") });
    } catch {
      toast({ title: t("common.connectionError"), description: t("common.connectionErrorDesc"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) {
      toast({ title: t("common.error"), description: t("forgotPassword.passwordRequirements"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("common.error"), description: t("forgotPassword.mismatch"), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: t("common.error"), description: data.message, variant: "destructive" });
        return;
      }
      setStep("done");
      toast({ title: t("common.success"), description: t("forgotPassword.success") });
    } catch {
      toast({ title: t("common.connectionError"), description: t("common.connectionErrorDesc"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 dark:bg-[#0d0a14]">
      <div className="hero-gradient absolute top-0 left-0 w-full h-72 z-0 overflow-hidden">
        <img src="/login-bg-doctors.png" alt="" className="absolute inset-0 w-full h-full object-cover object-top opacity-20 mix-blend-luminosity" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#8855f6]/30 via-transparent to-[#8855f6]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="size-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
            <Stethoscope className="text-white w-6 h-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]">RecebMed</h1>
        </div>

        <div className="bg-white/80 dark:bg-[#1a1225]/90 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
          {step === "done" ? (
            <div className="text-center space-y-4">
              <div className="size-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{t("forgotPassword.resetDone")}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("forgotPassword.resetDoneDesc")}</p>
              <Link href="/login">
                <Button className="w-full h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold shadow-lg shadow-[#8855f6]/30" data-testid="button-back-login">
                  {t("forgotPassword.backToLogin")}
                </Button>
              </Link>
            </div>
          ) : step === "email" ? (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{t("forgotPassword.title")}</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">{t("forgotPassword.subtitleStep1")}</p>
              </div>

              <form onSubmit={handleRequestCode} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-semibold text-slate-700 dark:text-slate-300">{t("login.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("login.emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                    data-testid="input-email"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold text-md shadow-lg shadow-[#8855f6]/30 hover:shadow-xl hover:shadow-[#8855f6]/40 hover:scale-[1.02] transition-all"
                  data-testid="button-send-code"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("forgotPassword.sending")}</> : t("forgotPassword.sendCode")}
                </Button>
              </form>

              <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
                <Link href="/login" className="font-bold text-[#8855f6] hover:underline inline-flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> {t("forgotPassword.backToLogin")}
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{t("forgotPassword.verifyTitle")}</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">{t("forgotPassword.subtitleStep2")}</p>
              </div>

              {devCode && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{t("forgotPassword.devModeLabel")}</p>
                    <p className="text-lg font-mono font-bold text-amber-800 dark:text-amber-300 tracking-widest">{devCode}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleVerifyAndReset} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="code" className="font-semibold text-slate-700 dark:text-slate-300">{t("forgotPassword.verificationCode")}</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 text-center text-2xl font-mono tracking-[0.5em]"
                    data-testid="input-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="font-semibold text-slate-700 dark:text-slate-300">{t("forgotPassword.newPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 pr-12"
                      data-testid="input-new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <PasswordStrength password={newPassword} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="font-semibold text-slate-700 dark:text-slate-300">{t("forgotPassword.confirmPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 pr-12"
                      data-testid="input-confirm-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      data-testid="button-toggle-confirm"
                    >
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {t("forgotPassword.mismatch")}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !passwordValid || newPassword !== confirmPassword || code.length < 6}
                  className="w-full h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold text-md shadow-lg shadow-[#8855f6]/30 hover:shadow-xl hover:shadow-[#8855f6]/40 hover:scale-[1.02] transition-all disabled:opacity-50"
                  data-testid="button-reset"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("forgotPassword.resetting")}</> : t("forgotPassword.resetButton")}
                </Button>
              </form>

              <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
                <button onClick={() => { setStep("email"); setDevCode(""); setCode(""); }} className="font-bold text-[#8855f6] hover:underline inline-flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> {t("forgotPassword.resendCode")}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}