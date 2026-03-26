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
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4 pb-0.5" data-testid="reports-tabs">
      {tabs.map((tab) => {
        const isActive = location === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => setLocation(tab.path)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              isActive
                ? "bg-[#8855f6] text-white shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
            data-testid={`reports-tab-${tab.path.replace(/\//g, "-").slice(1)}`}
          >
            <tab.icon className="w-3.5 h-3.5 flex-shrink-0" />
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
