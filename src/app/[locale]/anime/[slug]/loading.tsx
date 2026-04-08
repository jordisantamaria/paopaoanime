export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-4 w-16 rounded bg-bg-card-hover" />
      <div className="rounded bg-bg-card border border-border overflow-hidden">
        <div className="sm:hidden aspect-video w-full bg-bg-card-hover" />
        <div className="p-4 sm:p-5">
          <div className="flex gap-4 sm:gap-5">
            <div className="hidden sm:block h-72 w-48 rounded bg-bg-card-hover shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-3/4 rounded bg-bg-card-hover" />
              <div className="h-4 w-1/2 rounded bg-bg-card-hover" />
              <div className="mt-4 space-y-2">
                <div className="h-4 w-full rounded bg-bg-card-hover" />
                <div className="h-4 w-full rounded bg-bg-card-hover" />
                <div className="h-4 w-2/3 rounded bg-bg-card-hover" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
