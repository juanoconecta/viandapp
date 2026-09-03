import ConsumerShell from "@/components/consumer/ConsumerShell";
import ResultsSkeleton from "@/components/consumer/ResultsSkeleton";

export default function ExplorarLoading() {
  return (
    <ConsumerShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-line/60" />
        <div className="mt-4 h-[52px] w-full animate-pulse rounded-2xl bg-line/60 sm:max-w-xl" />
        <div className="mt-4 flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded-full bg-line/60" />
          <div className="h-9 w-20 animate-pulse rounded-full bg-line/60" />
          <div className="h-9 w-24 animate-pulse rounded-full bg-line/60" />
        </div>
        <div className="mt-6">
          <ResultsSkeleton />
        </div>
      </div>
    </ConsumerShell>
  );
}
