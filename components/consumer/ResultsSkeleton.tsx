const CANTIDAD_ESQUELETOS = 6;

export default function ResultsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: CANTIDAD_ESQUELETOS }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card"
        >
          <div className="aspect-[4/3] w-full motion-safe:animate-pulse bg-line/50" />
          <div className="flex flex-col gap-2 p-3">
            <div className="h-4 w-3/4 motion-safe:animate-pulse rounded bg-line/60" />
            <div className="h-3 w-1/2 motion-safe:animate-pulse rounded bg-line/50" />
            <div className="h-3 w-2/3 motion-safe:animate-pulse rounded bg-line/40" />
          </div>
        </div>
      ))}
    </div>
  );
}
