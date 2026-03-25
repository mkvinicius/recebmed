import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import i18n from "@/lib/i18n"
import { getLocale, getCurrencyCode } from "@/lib/i18n"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type FormatDateStyle = "short" | "medium" | "long" | "relative" | "datetime";

export function formatDate(dateStr: string | null | undefined, style: FormatDateStyle = "medium"): string {
  if (!dateStr) return "—";
  const locale = getLocale();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  if (style === "relative") {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const t = i18n.t.bind(i18n);
    if (d.toDateString() === today.toDateString())
      return `${t("dashboard.today")}, ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
    if (d.toDateString() === yesterday.toDateString())
      return `${t("dashboard.yesterday")}, ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
    return d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
  }

  if (style === "short")
    return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

  if (style === "long")
    return d.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });

  if (style === "datetime")
    return d.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatCurrency(val: string | number | null | undefined, fallback: string | null = null): string | null {
  if (val === null || val === undefined || val === "") return fallback;
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return fallback;
  return num.toLocaleString(getLocale(), { style: "currency", currency: getCurrencyCode() });
}
