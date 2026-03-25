import { AlertCircle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  onRetry?: () => void;
  title?: string;
  description?: string;
}

export default function ErrorState({ onRetry, title, description }: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] border border-slate-100/60 dark:border-slate-700/40 dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_4px_12px_-4px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)] p-8 text-center" data-testid="error-state">
      <AlertCircle className="w-12 h-12 text-red-400 dark:text-red-500 mx-auto mb-3" />
      <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1" data-testid="text-error-title">
        {title || t("common.loadError")}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4" data-testid="text-error-desc">
        {description || t("common.loadErrorDesc")}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2" data-testid="button-retry">
          <RefreshCw className="w-4 h-4" />
          {t("common.tryAgain")}
        </Button>
      )}
    </div>
  );
}
