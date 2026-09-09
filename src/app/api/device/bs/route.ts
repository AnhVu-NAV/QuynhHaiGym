import { z } from "zod"
import { after } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { devices } from "@/db/schema"
import { handleGatewayEvent } from "@/lib/ai26-events"
import { processAi26BsRequest } from "@/lib/ai26-bs-protocol"
import { claimPendingDeviceCommand } from "@/lib/device-commands"
import { consumeRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 2 * 1024 * 1024
const payloadSchema = z.record(z.string(), z.unknown())

function getAllowedIps() {
  return new Set(
    (process.env.AI26_ALLOWED_IPS || "")
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean)
  )
}

function getPollSeconds() {
  const value = Number(process.env.AI26_POLL_SECONDS || 10)
  return Number.isFinite(value) ? value : 10
}

function json(body: Record<string, unknown>, status = 200, extraHeaders?: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  })
}

export async function POST(request: Request) {
  if (process.env.AI26_DIRECT_MODE_ENABLED !== "true") {
    return json({ result: false, reason: "direct mode disabled" }, 404)
  }

  const declaredLength = Number(request.headers.get("content-length") || 0)
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ result: false, reason: "payload too large" }, 413)
  }

  const rawBody = await request.arrayBuffer()
  if (rawBody.byteLength > MAX_BODY_BYTES) {
    return json({ result: false, reason: "payload too large" }, 413)
  }

  let rawPayload: unknown
  try {
    rawPayload = JSON.parse(new TextDecoder().decode(rawBody))
  } catch {
    return json({ result: false, reason: "invalid json" }, 400)
  }

  const parsed = payloadSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return json({ result: false, reason: "invalid payload" }, 400)
  }

  const serialNumber = typeof parsed.data.sn === "string"
    ? parsed.data.sn.trim().toUpperCase()
    : ""
  if (!serialNumber) {
    console.warn("Rejected AI26 request for unapproved serial", serialNumber || "missing")
    return json({ result: false, reason: "device not allowed" }, 403)
  }

  // The web device list is the source of truth. Admins can authorize a new
  // serial or revoke an existing one immediately without changing Vercel env
  // variables or redeploying the application.
  let authorizedDevice: { id: number } | undefined
  try {
    authorizedDevice = await db.query.devices.findFirst({
      where: and(
        eq(devices.serialNumber, serialNumber),
        eq(devices.isActive, true),
      ),
      columns: { id: true },
    })
  } catch (error) {
    console.error("Unable to verify AI26 device authorization", error)
    return json({ result: false, reason: "authorization unavailable" }, 503)
  }
  if (!authorizedDevice) {
    console.warn("Rejected AI26 request for unapproved serial", serialNumber)
    return json({ result: false, reason: "device not allowed" }, 403)
  }

  const remoteAddress = request.headers.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim()
    .slice(0, 100)

  const allowedIps = getAllowedIps()
  if (allowedIps.size && (!remoteAddress || !allowedIps.has(remoteAddress))) {
    return json({ result: false, reason: "source not allowed" }, 403)
  }

  const requestLimit = await consumeRateLimit(
    "ai26-direct",
    `${remoteAddress || "unknown"}:${serialNumber}`,
    { limit: 120, windowSeconds: 60 },
  )
  if (!requestLimit.allowed) {
    return json({ result: false, reason: "too many requests" }, 429, {
      "Retry-After": String(requestLimit.retryAfterSeconds),
    })
  }

  try {
    const startedAt = performance.now()
    const response = await processAi26BsRequest(parsed.data, {
      handleEvent: (event) => handleGatewayEvent(event, (task) => after(task)),
      claimCommand: claimPendingDeviceCommand,
      remoteAddress,
      accessControlEnabled: process.env.AI26_ACCESS_CONTROL_ENABLED === "true",
      pollSeconds: getPollSeconds(),
    })
    const processingMs = Math.round(performance.now() - startedAt)
    if (processingMs >= 1_500) {
      console.warn("Slow AI26 request", {
        command: parsed.data.cmd || parsed.data.ret || "unknown",
        processingMs,
      })
    }
    return json(response, 200, { "Server-Timing": `ai26;dur=${processingMs}` })
  } catch (error) {
    console.error("AI26 direct request failed", error)
    return json({ result: false, access: 0, reason: "server error" }, 500)
  }
}
