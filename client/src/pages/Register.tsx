import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Stethoscope, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { saveAuth } from "@/lib/auth";
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

export default function Register() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const passwordValid = useMemo(() => {
    return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
  }, [password]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) {
      toast({ title: t("common.error"), description: t("forgotPassword.passwordRequirements"), variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: t("register.errorTitle"), description: data.message || t("register.errorDesc"), variant: "destructive" });
        return;
      }
      saveAuth(data.token, data.user);
      toast({ title: t("register.successTitle"), description: t("register.welcomeNew", { name: data.user.name }) });
      setLocation("/dashboard");
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
          <div className="text-center mb-8">
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{t("register.title")}</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">{t("register.subtitle")}</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold text-slate-700 dark:text-slate-300">{t("register.fullName")}</Label>
              <Input
                id="name"
                placeholder={t("register.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                data-testid="input-register-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold text-slate-700 dark:text-slate-300">{t("register.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("register.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                data-testid="input-register-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-semibold text-slate-700 dark:text-slate-300">{t("register.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("register.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100 pr-12"
                  data-testid="input-register-password"
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
              <PasswordStrength password={password} />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !passwordValid}
              className="w-full h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold text-md shadow-lg shadow-[#8855f6]/30 hover:shadow-xl hover:shadow-[#8855f6]/40 hover:scale-[1.02] transition-all disabled:opacity-50"
              data-testid="button-register"
            >
              {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("register.submitting")}</> : t("register.submit")}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
            {t("register.hasAccount")}{" "}
            <Link href="/login" className="font-bold text-[#8855f6] hover:underline">{t("register.login")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}