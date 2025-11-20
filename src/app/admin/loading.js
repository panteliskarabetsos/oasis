// src/app/admin/loading.js
export default function Loading() {
  return (
    <div className="pb-16" aria-busy="true" aria-live="polite">
      {/* Sticky header skeleton */}
      <div className="sticky top-0 z-40 border-b border-black/10 bg-white/75 backdrop-blur supports-[backdrop-filter]:bg-white/55 dark:border-white/10 dark:bg-[#0b0b0b]/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="h-9 w-28 animate-pulse rounded-xl bg-neutral-200/80 dark:bg-white/10" />
          <div className="flex items-center gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-9 w-9 animate-pulse rounded-xl bg-neutral-200/80 dark:bg-white/10" />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4">
        {/* Hero skeleton */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#111]">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 via-amber-400 to-pink-400" />
            <div className="grid gap-4 p-5 md:grid-cols-[auto,1fr,auto] md:items-center">
              <div className="h-12 w-12 animate-pulse rounded-2xl bg-neutral-200/80 dark:bg-white/10" />
              <div className="min-w-0 space-y-2">
                <div className="h-5 w-40 animate-pulse rounded bg-neutral-200/80 dark:bg-white/10" />
                <div className="flex flex-wrap gap-2">
                  {[120, 100, 80].map((w, i) => (
                    <div key={i} className="h-5 w-[--w] animate-pulse rounded-full bg-neutral-200/80 dark:bg-white/10" style={{"--w": `${w}px`}} />
                  ))}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="h-8 w-44 animate-pulse rounded bg-neutral-200/80 dark:bg-white/10" />
                <div className="mt-2 h-3 w-28 animate-pulse rounded bg-neutral-200/60 dark:bg-white/10" />
              </div>
            </div>
          </div>
        </div>

        {/* Cards grid skeleton */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#111]">
      <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div className="h-5 w-36 animate-pulse rounded bg-neutral-200/80 dark:bg-white/10" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="h-4 w-40 animate-pulse rounded bg-neutral-200/80 dark:bg-white/10" />
            <div className="h-4 w-28 animate-pulse rounded bg-neutral-200/80 dark:bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
