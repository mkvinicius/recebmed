import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { BarChart3, Stethoscope, CheckCircle2, FileUp, History } from "lucide-react";

const tabs = [
  { path: "/reports", labelKey: "reports.tabProduction", icon: BarChart3 },
  { path: "/reconciliation", labelKey: "reports.tabReconciliation", icon: Stethoscope },
  { path: "/clinic-reports", labelKey: "reports.tabClinic", icon: CheckCircle2 },
  { path: "/import", labelKey: "reports.tabImport", icon: FileUp },
  { path: "/reports/history", labelKey: "reports.tabHistory", icon: History },
];

export default function ReportsTabs() {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-1 px-1" data-testid="reports-tabs">
      {tabs.map((tab) => {
        const isActive = location === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => setLocation(tab.path)}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 min-w-[100px] ${
              isActive
                ? "bg-[#8855f6] text-white shadow-md shadow-[#8855f6]/20"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
            }`}
            data-testid={`reports-tab-${tab.path.replace(/\//g, "-").slice(1)}`}
          >
            <tab.icon className="w-4 h-4" />
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
