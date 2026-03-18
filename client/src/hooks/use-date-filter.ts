import { useState, useCallback } from "react";

const STORAGE_KEY = "recebmed_date_filter";

interface DateFilterState {
  dateFrom: string;
  dateTo: string;
  quickFilter: string | null;
}

function loadSaved(): DateFilterState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.dateFrom || parsed.dateTo) return parsed;
    }
  } catch {}
  return { dateFrom: "", dateTo: "", quickFilter: null };
}

function persist(state: DateFilterState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export type QuickFilterKey = "yesterday" | "today" | "week" | "month";

export function getQuickFilterDates(key: QuickFilterKey): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (key === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return { from: toDateStr(yesterday), to: toDateStr(yesterday) };
  }

  if (key === "today") {
    return { from: toDateStr(today), to: toDateStr(today) };
  }

  if (key === "week") {
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toDateStr(monday), to: toDateStr(sunday) };
  }

  if (key === "month") {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: toDateStr(firstDay), to: toDateStr(lastDay) };
  }

  return { from: "", to: "" };
}

export function useDateFilter() {
  const saved = loadSaved();
  const [dateFrom, setDateFromRaw] = useState(saved.dateFrom);
  const [dateTo, setDateToRaw] = useState(saved.dateTo);
  const [quickFilter, setQuickFilterRaw] = useState<string | null>(saved.quickFilter);

  const setDateFrom = useCallback((v: string) => {
    setDateFromRaw(v);
    setQuickFilterRaw(null);
    persist({ dateFrom: v, dateTo: "", quickFilter: null });
    setDateToRaw(prev => {
      persist({ dateFrom: v, dateTo: prev, quickFilter: null });
      return prev;
    });
  }, []);

  const setDateTo = useCallback((v: string) => {
    setDateToRaw(v);
    setQuickFilterRaw(null);
    setDateFromRaw(prev => {
      persist({ dateFrom: prev, dateTo: v, quickFilter: null });
      return prev;
    });
  }, []);

  const applyQuickFilter = useCallback((key: QuickFilterKey) => {
    setQuickFilterRaw(prev => {
      if (prev === key) {
        setDateFromRaw("");
        setDateToRaw("");
        persist({ dateFrom: "", dateTo: "", quickFilter: null });
        return null;
      }
      const { from, to } = getQuickFilterDates(key);
      setDateFromRaw(from);
      setDateToRaw(to);
      persist({ dateFrom: from, dateTo: to, quickFilter: key });
      return key;
    });
  }, []);

  const clearDates = useCallback(() => {
    setDateFromRaw("");
    setDateToRaw("");
    setQuickFilterRaw(null);
    persist({ dateFrom: "", dateTo: "", quickFilter: null });
  }, []);

  return { dateFrom, dateTo, quickFilter, setDateFrom, setDateTo, applyQuickFilter, clearDates };
}
