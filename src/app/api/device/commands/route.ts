import { z } from "zod"
import { claimPendingDeviceCommand } from "@/lib/device-commands"
import { isGatewayAuthorized } from "@/lib/device-gateway"

export const runtime = "nodejs"

const pullSchema = z.object({
  serialNumber: z.string().min(1).max(100),
})

export async function POST(request: Request) {
  if (!isGatewayAuthorized(request)) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const parsed = pullSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ success: false, message: "Payload không hợp lệ" }, { status: 400 })
  }

  const claimed = await claimPendingDeviceCommand(parsed.data.serialNumber)

  return Response.json({
    success: true,
    command: claimed || null,
  })
}
