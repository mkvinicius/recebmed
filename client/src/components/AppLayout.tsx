import { useLocation } from "wouter";
import { Home, FileText, Plus, BarChart3, User, ShieldAlert, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getUser, getRequiresPasswordUpdate } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();

  const user = getUser();
  const profilePhotoUrl = user?.profilePhotoUrl || null;
  const userInitials = user?.name ? user.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "Dr";
  const showPwWarning = getRequiresPasswordUpdate();

  const tabs = [
    { path: "/dashboard", labelKey: "nav.home", icon: Home },
    { path: "/entries", labelKey: "nav.entries", icon: FileText },
    { path: "/capture", labelKey: "nav.capture", icon: Plus },
    { path: "/reports", labelKey: "nav.reports", icon: BarChart3 },
    { path: "/profile", labelKey: "nav.profile", icon: User },
  ];

  return (
    <div className="min-h-screen pb-20 relative" data-testid="app-layout">
      <div className="hero-gradient h-52 w-full absolute top-0 left-0 z-0" />

      <div className="relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between py-4" data-testid="persistent-header">
            <div className="flex items-center gap-3 text-white">
              <div className="size-12 bg-gradient-to-br from-white/30 to-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border-2 border-white/30 shadow-lg overflow-hidden" data-testid="avatar-profile">
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt={t("common.profile")} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-white tracking-wide">{userInitials}</span>
                )}
              </div>
              <h1 className="text-xl font-bold tracking-tight">RecebMed</h1>
            </div>
            <div id="header-right-slot" />
          </header>
        </div>

        {showPwWarning && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-2">
            <button
              onClick={() => setLocation("/settings")}
              className="w-full bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-xl px-4 py-3 flex items-center gap-3 text-left hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              data-testid="banner-weak-password-global"
            >
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{t("settings.weakPasswordWarning")}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 truncate">{t("settings.weakPasswordBannerHint")}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-500 shrink-0" />
            </button>
          </div>
        )}

        {children}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]" data-testid="tab-bar">
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {tabs.map((tab) => {
            const label = t(tab.labelKey);
            const isActive = location === tab.path
              || (tab.path === "/reports" && (location === "/reconciliation" || location === "/clinic-reports" || location === "/import"))
              || (tab.path === "/profile" && (location === "/settings"))
              || (tab.path === "/entries" && location.startsWith("/entry/"));
            const isCapture = tab.path === "/capture";
            return (
              <button
                key={tab.path}
                onClick={() => setLocation(tab.path)}
                className={`flex flex-col items-center gap-0 min-w-[56px] py-0.5 transition-colors ${isCapture ? "" : isActive ? "text-[#8855f6]" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"}`}
                data-testid={`tab-${label.toLowerCase()}`}
              >
                {isCapture ? (
                  <div className="size-12 -mt-7 bg-[#8855f6] rounded-full flex items-center justify-center shadow-lg shadow-[#8855f6]/30 text-white">
                    <tab.icon className="w-6 h-6" />
                  </div>
                ) : (
                  <tab.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                )}
                <span className={`text-[10px] font-semibold text-center leading-tight whitespace-pre-line ${isCapture ? "text-[#8855f6] mt-0" : ""}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}