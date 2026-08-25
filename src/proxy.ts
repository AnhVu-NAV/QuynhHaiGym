import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token"

const PUBLIC_PATHS = [
  "/sign-in",
  "/check-in",
  "/my-card",
  "/pub/api",
  "/api/device/events",
  "/api/device/commands",
  "/api/device/bs",
  // Vercel Cron has no staff session. This route performs its own Bearer
  // CRON_SECRET verification before any cleanup can run.
  "/api/maintenance/cleanup-logs",
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // AI26 HTTP/HTTPS BS firmware posts to the configured domain root and does
  // not offer a path field. Limit the rewrite to JSON POSTs so normal page and
  // Server Action requests keep their existing behavior.
  if (
    request.method === "POST" &&
    pathname === "/" &&
    request.headers.get("content-type")?.toLowerCase().includes("application/json")
  ) {
    return NextResponse.rewrite(new URL("/api/device/bs", request.url))
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  if (isPublic) return NextResponse.next()

  const secret = process.env.SESSION_SECRET
  const session = secret
    ? await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret)
    : null

  if (!session) {
    const signInUrl = new URL("/sign-in", request.url)
    signInUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(signInUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
