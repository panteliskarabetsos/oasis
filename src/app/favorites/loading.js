export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f4f1ec] pb-20">
      <section className="relative bg-[#e7e0d5] pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="h-6 w-32 bg-black/5 rounded-full mb-4 animate-pulse" />
          <div className="h-12 w-64 bg-black/5 rounded-lg mb-4 animate-pulse" />
          <div className="h-6 w-96 bg-black/5 rounded-lg animate-pulse" />
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 -mt-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-3xl overflow-hidden border border-[#e4ddd3] h-[500px]"
            >
              <div className="h-64 bg-gray-200 animate-pulse" />
              <div className="p-6 space-y-4">
                <div className="h-8 w-3/4 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
                <div className="mt-12 h-10 w-full bg-gray-100 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
