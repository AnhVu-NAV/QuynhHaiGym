import { z } from "zod"
import { after } from "next/server"
import { handleGatewayEvent } from "@/lib/ai26-events"
import { isGatewayAuthorized } from "@/lib/device-gateway"

export const runtime = "nodejs"
const MAX_BODY_BYTES = 2 * 1024 * 1024

const eventSchema = z.object({
  type: z.enum(["register", "log", "senduser", "response", "disconnect", "heartbeat"]),
  serialNumber: z.string().min(1).max(100),
  remoteAddress: z.string().max(100).optional(),
  payload: z.record(z.string(), z.unknown()),
})

export async function POST(request: Request) {
  if (!isGatewayAuthorized(request)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const declaredLength = Number(request.headers.get("content-length") || 0)
  if (declaredLength > MAX_BODY_BYTES) {
    return Response.json({ success: false, message: "Payload quá lớn" }, { status: 413 })
  }
  const body = await request.arrayBuffer()
  if (body.byteLength > MAX_BODY_BYTES) {
    return Response.json({ success: false, message: "Payload quá lớn" }, { status: 413 })
  }
  const parsed = eventSchema.safeParse(
    (() => { try { return JSON.parse(new TextDecoder().decode(body)) } catch { return null } })()
  )
  if (!parsed.success) {
    return Response.json({ success: false, message: "Payload không hợp lệ" }, { status: 400 })
  }

  try {
    const result = await handleGatewayEvent(parsed.data, (task) => after(task))
    return Response.json({ success: true, ...result })
  } catch (error) {
    console.error("AI26 event processing failed", error)
    return Response.json(
      { success: false, access: 0, message: "Không xử lý được dữ liệu AI26" },
      { status: 500 }
    )
  }
}
