import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Stethoscope, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: t("common.error"), description: t("forgotPassword.minLength"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("common.error"), description: t("forgotPassword.mismatch"), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: t("common.error"), description: data.message || t("forgotPassword.error"), variant: "destructive" });
        return;
      }
      setSuccess(true);
      toast({ title: t("common.success"), description: t("forgotPassword.success") });
    } catch {
      toast({ title: t("common.connectionError"), description: t("common.connectionErrorDesc"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 dark:bg-[#0d0a14]">
      <div className="hero-gradient absolute top-0 left-0 w-full h-72 z-0" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="size-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
            <Stethoscope className="text-white w-6 h-6" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">RecebMed</h1>
        </div>

        <div className="bg-white/80 dark:bg-[#1a1225]/90 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
          {success ? (
            <div className="text-center space-y-4">
              <div className="size-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{t("forgotPassword.resetDone")}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("forgotPassword.resetDoneDesc")}</p>
              <Link href="/login">
                <Button className="w-full h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold shadow-lg shadow-[#8855f6]/30" data-testid="button-back-login">
                  {t("forgotPassword.backToLogin")}
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{t("forgotPassword.title")}</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">{t("forgotPassword.subtitle")}</p>
              </div>

              <form onSubmit={handleReset} className="space-y-5">
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
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="font-semibold text-slate-700 dark:text-slate-300">{t("forgotPassword.newPassword")}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100"
                    data-testid="input-new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="font-semibold text-slate-700 dark:text-slate-300">{t("forgotPassword.confirmPassword")}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-12 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-[#8855f6]/30 text-slate-800 dark:text-slate-100"
                    data-testid="input-confirm-password"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-full bg-[#8855f6] hover:bg-[#7744e0] text-white font-bold text-md shadow-lg shadow-[#8855f6]/30 hover:shadow-xl hover:shadow-[#8855f6]/40 hover:scale-[1.02] transition-all"
                  data-testid="button-reset"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("forgotPassword.resetting")}</> : t("forgotPassword.resetButton")}
                </Button>
              </form>

              <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
                <Link href="/login" className="font-bold text-[#8855f6] hover:underline inline-flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> {t("forgotPassword.backToLogin")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
