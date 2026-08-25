import { cleanupOperationalLogs } from "@/lib/log-retention"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get("authorization")

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await cleanupOperationalLogs()
    return Response.json({ success: true, ...result })
  } catch (error) {
    console.error("Operational log cleanup failed", error)
    return Response.json({ success: false, error: "Cleanup failed" }, { status: 500 })
  }
}
