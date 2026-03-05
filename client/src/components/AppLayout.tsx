import { useLocation } from "wouter";
import { Home, FileText, Plus, BarChart3, User } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();

  const tabs = [
    { path: "/dashboard", labelKey: "nav.home", icon: Home },
    { path: "/entries", labelKey: "nav.entries", icon: FileText },
    { path: "/capture", labelKey: "nav.capture", icon: Plus },
    { path: "/reports", labelKey: "nav.reports", icon: BarChart3 },
    { path: "/profile", labelKey: "nav.profile", icon: User },
  ];

  return (
    <div className="min-h-screen pb-20" data-testid="app-layout">
      {children}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]" data-testid="tab-bar">
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
                className={`flex flex-col items-center gap-0.5 min-w-[56px] py-1 transition-colors ${isCapture ? "" : isActive ? "text-[#8855f6]" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"}`}
                data-testid={`tab-${label.toLowerCase()}`}
              >
                {isCapture ? (
                  <div className="size-12 -mt-5 bg-[#8855f6] rounded-full flex items-center justify-center shadow-lg shadow-[#8855f6]/30 text-white">
                    <tab.icon className="w-6 h-6" />
                  </div>
                ) : (
                  <tab.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                )}
                <span className={`text-[10px] font-semibold ${isCapture ? "text-[#8855f6] mt-0.5" : ""}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}