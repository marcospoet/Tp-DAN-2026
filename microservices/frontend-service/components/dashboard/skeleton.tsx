export function DashboardSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-border bg-background h-[57px]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
          <div className="w-28 h-3.5 rounded-full bg-secondary animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-secondary animate-pulse" />
          <div className="w-8 h-8 rounded-xl bg-secondary animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full pb-32 flex flex-col gap-4">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 w-full justify-center">
                <div className="w-7 h-7 rounded-lg bg-secondary animate-pulse" />
                <div className="w-14 h-3 rounded-full bg-secondary animate-pulse" />
              </div>
              <div className="w-24 h-5 rounded-full bg-secondary animate-pulse" />
              <div className="w-8 h-2.5 rounded-full bg-secondary animate-pulse" />
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-hidden">
          {[56, 72, 64, 88].map((w, i) => (
            <div
              key={i}
              className="h-7 rounded-full bg-secondary animate-pulse shrink-0"
              style={{ width: w, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>

        {/* Transactions label */}
        <div className="w-32 h-3 rounded-full bg-secondary animate-pulse mt-1" />

        {/* Transaction rows */}
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5"
              style={{ opacity: 1 - i * 0.12 }}
            >
              <div
                className="w-10 h-10 rounded-xl bg-secondary animate-pulse shrink-0"
                style={{ animationDelay: `${i * 60}ms` }}
              />
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div
                  className="h-3.5 rounded-full bg-secondary animate-pulse"
                  style={{ width: `${62 + (i % 3) * 12}%`, animationDelay: `${i * 60}ms` }}
                />
                <div
                  className="h-3 rounded-full bg-secondary animate-pulse w-2/5"
                  style={{ animationDelay: `${i * 60 + 40}ms` }}
                />
              </div>
              <div
                className="h-3.5 w-20 rounded-full bg-secondary animate-pulse shrink-0"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Magic bar placeholder */}
      <div className="fixed bottom-0 left-0 right-0 h-20 border-t border-border bg-background flex items-center px-4 gap-3">
        <div className="flex-1 h-11 rounded-2xl bg-secondary animate-pulse" />
        <div className="w-11 h-11 rounded-2xl bg-secondary animate-pulse shrink-0" />
      </div>
    </div>
  )
}
