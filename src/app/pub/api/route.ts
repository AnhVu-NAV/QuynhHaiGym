import { POST as handleAi26Post } from "@/app/api/device/bs/route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// AI26 HTTP/HTTPS firmware uses this fixed path after only a domain and port
// are configured on the terminal.
export async function POST(request: Request) {
  return handleAi26Post(request)
}

// Some firmware probes the path with GET before starting its JSON POST loop.
export async function GET() {
  return Response.json(
    { result: true, service: "AI26 HTTP/HTTPS BS" },
    { headers: { "Cache-Control": "no-store" } }
  )
}
