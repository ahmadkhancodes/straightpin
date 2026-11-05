import { Skeleton } from "@/components/ui/states";

/** Skeleton shaped like the overview: header, plan card, usage card, panel. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 pb-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full lg:col-span-2" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
