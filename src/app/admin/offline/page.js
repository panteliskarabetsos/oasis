export const dynamic = "force-static";
export default function AdminOffline() {
  return (
    <div className="mx-auto w-full max-w-md text-center py-10">
      <h1 className="text-xl font-semibold text-[#3f382f]">You’re offline</h1>
      <p className="mt-2 text-sm text-[#7a6a58]">
        Some features require a connection. You can still browse cached screens.
      </p>
      <a
        href="/admin"
        className="mt-4 inline-flex items-center rounded-lg bg-[#3f382f] px-4 py-2 text-sm text-white"
      >
        Try again
      </a>
    </div>
  );
}
