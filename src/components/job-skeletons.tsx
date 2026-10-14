export function FilterBarFallback() {
  return (
    <div className="rounded-2xl border bg-card p-4" aria-hidden="true">
      <div className="mb-3 h-4 w-40 rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-14 animate-pulse rounded-lg bg-muted" />
        <div className="h-14 animate-pulse rounded-lg bg-muted" />
        <div className="h-14 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export function JobListSkeleton() {
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">正在更新职位</p>
      <ol className="divide-y overflow-hidden rounded-2xl border bg-card" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="px-4 py-4 sm:px-5">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-6 w-4/5 max-w-md animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-44 animate-pulse rounded bg-muted" />
          </li>
        ))}
      </ol>
    </div>
  );
}
