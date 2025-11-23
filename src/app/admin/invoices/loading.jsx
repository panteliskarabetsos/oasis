export default function Loading() {
  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-40 rounded bg-neutral-200/80" />
        <div className="h-24 rounded-2xl border border-[#e8e5df] bg-white" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="h-20 rounded-2xl border border-[#e8e5df] bg-white" />
          <div className="h-20 rounded-2xl border border-[#e8e5df] bg-white" />
          <div className="h-20 rounded-2xl border border-[#e8e5df] bg-white" />
          <div className="h-20 rounded-2xl border border-[#e8e5df] bg-white" />
        </div>
        <div className="h-[50vh] rounded-2xl border border-[#e8e5df] bg-white" />
      </div>
    </div>
  );
}
