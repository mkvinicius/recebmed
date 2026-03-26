export function EntrySkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" data-testid="skeleton-entries">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-float px-4 py-4 flex items-center gap-3.5 animate-pulse">
          <div className="size-11 rounded-2xl bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-3/4" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-lg w-1/2" />
            <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg w-1/3" />
          </div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-16 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function DashboardCardSkeleton() {
  return (
    <div className="animate-pulse space-y-4" data-testid="skeleton-dashboard-cards">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-float p-4 space-y-2">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="animate-pulse space-y-4" data-testid="skeleton-reports">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-float p-4 space-y-2">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="card-float p-4 h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4" data-testid="skeleton-detail">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-100/60 dark:border-slate-700/40 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
          </div>
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800" />
              <div className="space-y-1 flex-1">
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
