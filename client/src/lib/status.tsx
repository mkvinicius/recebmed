import { CheckCircle2, AlertCircle, FileText, Clock } from "lucide-react";

export type EntryStatus = "pending" | "reconciled" | "divergent" | "validated";

export function statusColor(s: string): string {
  switch (s) {
    case "reconciled":
    case "validated":
      return "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400";
    case "divergent":
      return "bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400";
    default:
      return "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400";
  }
}

export function statusBadgeStyle(s: string): string {
  switch (s) {
    case "reconciled":
    case "validated":
      return "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800";
    case "divergent":
      return "bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800";
    default:
      return "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800";
  }
}

export function StatusIcon({ status, className = "w-5 h-5" }: { status: string; className?: string }) {
  switch (status) {
    case "reconciled":
    case "validated":
      return <CheckCircle2 className={className} />;
    case "divergent":
      return <AlertCircle className={className} />;
    default:
      return <FileText className={className} />;
  }
}

export function StatusIconDetail({ status, className = "w-5 h-5" }: { status: string; className?: string }) {
  switch (status) {
    case "reconciled":
    case "validated":
      return <CheckCircle2 className={className} />;
    case "divergent":
      return <AlertCircle className={className} />;
    default:
      return <Clock className={className} />;
  }
}
