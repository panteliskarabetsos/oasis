// middleware.js
if (
  req.nextUrl.pathname === "/sw.js" ||
  req.nextUrl.pathname === "/admin/offline.html" ||
  req.nextUrl.pathname === "/admin/manifest.webmanifest" ||
  req.nextUrl.pathname.startsWith("/_next/")
) {
  return NextResponse.next();
}
