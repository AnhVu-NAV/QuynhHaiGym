import "server-only"

import type { Ai26Json } from "@/lib/ai26-protocol"

const EDGE_TIMEOUT_MS = 4_000

type EdgeStatus = {
  online: boolean
  lastSeenAt: Date | null
  pendingCommands: number
}

function config() {
  const url = process.env.AI26_EDGE_URL?.trim().replace(/\/$/, "")
  const secret = process.env.AI26_EDGE_SECRET?.trim()
  return url && secret ? { url, secret } : null
}

async function edgeFetch(path: string, init: RequestInit = {}) {
  const edge = config()
  if (!edge) return null
  try {
    return await fetch(`${edge.url}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...init.headers,
        authorization: `Bearer ${edge.secret}`,
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(EDGE_TIMEOUT_MS),
    })
  } catch (error) {
    console.error("AI26 edge request failed", error)
    return null
  }
}

export function isAi26EdgeConfigured() {
  return config() !== null
}

export async function setAi26EdgeDeviceAccess(serialNumber: string, active: boolean) {
  const response = await edgeFetch("/control/device", {
    method: "POST",
    body: JSON.stringify({ serialNumber, active }),
  })
  return response?.ok === true
}

export async function enqueueAi26EdgeCommand(options: {
  serialNumber: string
  commandId: number
  command: Ai26Json
}) {
  const response = await edgeFetch("/control/command", {
    method: "POST",
    body: JSON.stringify(options),
  })
  return response?.ok === true
}

export async function getAi26EdgeDeviceStatus(serialNumber: string): Promise<EdgeStatus | null> {
  const response = await edgeFetch(`/control/status?serialNumber=${encodeURIComponent(serialNumber)}`)
  if (!response?.ok) return null
  const body = await response.json().catch(() => null) as {
    online?: unknown
    lastSeenAt?: unknown
    pendingCommands?: unknown
  } | null
  if (!body || typeof body.online !== "boolean") return null
  const lastSeenMs = typeof body.lastSeenAt === "number" ? body.lastSeenAt : null
  return {
    online: body.online,
    lastSeenAt: lastSeenMs ? new Date(lastSeenMs) : null,
    pendingCommands: Number(body.pendingCommands || 0),
  }
}
