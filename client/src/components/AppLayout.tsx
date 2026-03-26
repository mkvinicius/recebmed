import { useLocation } from "wouter";
import { Home, FileText, Plus, BarChart3, User, ShieldAlert, ArrowRight, Stethoscope } from "lucide-react";
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

  const isActive = (tabPath: string) =>
    location === tabPath
    || (tabPath === "/reports" && (location === "/reconciliation" || location === "/clinic-reports" || location === "/import" || location === "/reports/history"))
    || (tabPath === "/profile" && location === "/settings")
    || (tabPath === "/entries" && location.startsWith("/entry/"));

  return (
    <div className="min-h-screen pb-20 md:pb-0 relative" data-testid="app-layout">
      <div className="hero-gradient h-52 w-full absolute top-0 left-0 z-0 md:hidden" />
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-[220px] z-50 flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-700 shadow-[4px_0_24px_rgba(0,0,0,0.04)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.3)]" data-testid="desktop-sidebar">
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <div className="size-10 bg-gradient-to-br from-[#a478ff] via-[#8855f6] to-[#6b3fd4] rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">RecebMed</h1>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {tabs.map((tab) => {
            const label = t(tab.labelKey);
            const active = isActive(tab.path);
            const isCapture = tab.path === "/capture";
            return (
              <button
                key={tab.path}
                onClick={() => setLocation(tab.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isCapture
                    ? "bg-gradient-to-r from-[#8855f6] to-[#a478ff] text-white shadow-md shadow-[#8855f6]/20 hover:shadow-lg hover:shadow-[#8855f6]/30 mt-2"
                    : active
                      ? "bg-[#8855f6]/10 text-[#8855f6] dark:text-[#a478ff]"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                data-testid={`sidebar-${tab.path.slice(1)}`}
              >
                <tab.icon className={`w-5 h-5 ${isCapture ? "" : active ? "stroke-[2.5]" : ""}`} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-4 mt-auto">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="size-9 bg-gradient-to-br from-white/30 to-white/10 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-600 overflow-hidden flex-shrink-0">
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt={t("common.profile")} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{userInitials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{user?.name || "Dr."}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="md:ml-[220px]">
        <div className="hero-gradient h-52 w-full absolute top-0 left-0 z-0 hidden md:block md:left-[220px] md:w-[calc(100%-220px)]" />

        <div className="relative z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <header className="flex items-center justify-between py-4 md:py-3" data-testid="persistent-header">
              <div className="flex items-center gap-3 text-white md:hidden">
                <div className="size-12 bg-gradient-to-br from-white/30 to-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border-2 border-white/30 shadow-lg overflow-hidden" data-testid="avatar-profile">
                  {profilePhotoUrl ? (
                    <img src={profilePhotoUrl} alt={t("common.profile")} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-white tracking-wide">{userInitials}</span>
                  )}
                </div>
                <h1 className="text-xl font-bold tracking-tight">RecebMed</h1>
              </div>
              <div className="hidden md:block" />
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
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-700 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)] md:hidden" data-testid="tab-bar">
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 pt-1.5 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {tabs.map((tab) => {
            const label = t(tab.labelKey);
            const active = isActive(tab.path);
            const isCapture = tab.path === "/capture";
            return (
              <button
                key={tab.path}
                onClick={() => setLocation(tab.path)}
                className={`flex flex-col items-center gap-0.5 min-w-[56px] py-0.5 transition-all duration-200 ${isCapture ? "" : active ? "text-[#8855f6]" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"}`}
                data-testid={`tab-${label.toLowerCase()}`}
                data-tour={`tab-${tab.path.slice(1)}`}
              >
                {isCapture ? (
                  <div className="size-14 -mt-8 rounded-full flex items-center justify-center text-white bg-gradient-to-b from-[#a478ff] via-[#8855f6] to-[#6b3fd4] shadow-[0_4px_16px_rgba(136,85,246,0.5),0_2px_4px_rgba(136,85,246,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)] ring-[3px] ring-white dark:ring-slate-900 active:scale-95 transition-transform">
                    <tab.icon className="w-7 h-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                  </div>
                ) : (
                  <div className={`p-1.5 rounded-xl transition-all duration-200 ${active ? "bg-[#8855f6]/10 shadow-[0_1px_3px_rgba(136,85,246,0.15)]" : ""}`}>
                    <tab.icon className={`w-5 h-5 transition-all ${active ? "stroke-[2.5] drop-shadow-[0_1px_1px_rgba(136,85,246,0.3)]" : "drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]"}`} />
                  </div>
                )}
                <span className={`text-[10px] font-semibold text-center leading-tight whitespace-pre-line transition-all ${isCapture ? "text-[#8855f6] font-bold mt-0" : active ? "font-bold" : ""}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
