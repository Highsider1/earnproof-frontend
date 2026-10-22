"use client";

/**
 * Loading skeleton for proof history list.
 * Uses fixed-height blocks to prevent layout shift while loading.
 */
export type ProofListSkeletonProps = {
  count?: number;
};

export function ProofListSkeleton({ count = 20 }: ProofListSkeletonProps) {
  return (
    <div className="space-y-2">
      {/* Desktop table header skeleton */}
      <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1.2fr_0.8fr] gap-3 bg-white/5 p-3 rounded-lg">
        <div className="h-4 bg-white/10 rounded animate-pulse" />
        <div className="h-4 bg-white/10 rounded animate-pulse" />
        <div className="h-4 bg-white/10 rounded animate-pulse" />
        <div className="h-4 bg-white/10 rounded animate-pulse" />
        <div className="h-4 bg-white/10 rounded animate-pulse" />
      </div>

      {/* Skeleton rows with fixed height */}
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-white/10 bg-white/[0.04] p-3 sm:p-4"
        >
          {/* Mobile layout */}
          <div className="space-y-2 md:hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-white/10 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-white/10 rounded animate-pulse w-1/2" />
              </div>
              <div className="h-6 bg-white/10 rounded animate-pulse w-20" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
                <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
              </div>
              <div className="space-y-1">
                <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
                <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
              </div>
              <div className="space-y-1">
                <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
                <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
              </div>
            </div>

            <div className="h-3 bg-white/10 rounded animate-pulse w-1/4" />
          </div>

          {/* Desktop layout */}
          <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1.2fr_0.8fr] gap-3 items-center">
            <div className="space-y-1">
              <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
              <div className="h-3 bg-white/10 rounded animate-pulse w-2/3" />
            </div>
            <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
            <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
            <div className="space-y-1">
              <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
              <div className="h-3 bg-white/10 rounded animate-pulse w-2/3" />
            </div>
            <div className="h-6 bg-white/10 rounded animate-pulse w-16 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
