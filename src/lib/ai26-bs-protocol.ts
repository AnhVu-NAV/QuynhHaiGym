import {
  formatAi26Date,
  type Ai26Json,
  type GatewayEvent,
} from "@/lib/ai26-protocol"

type EventResult = { access?: number; message?: string }
type ClaimedCommand = { id: number; payload: Ai26Json }

export type Ai26BsDependencies = {
  handleEvent: (event: GatewayEvent) => Promise<EventResult>
  claimCommand: (serialNumber: string) => Promise<ClaimedCommand | null>
  remoteAddress?: string
  accessControlEnabled?: boolean
  pollSeconds?: number
  now?: Date
}

function asInteger(value: unknown) {
  const number = Number(value)
  return Number.isInteger(number) ? number : undefined
}

function acknowledgement(
  ret: string,
  payload: Ai26Json,
  cloudtime: string
): Ai26Json {
  const response: Ai26Json = {
    ret,
    result: true,
    cloudtime,
  }

  for (const key of ["count", "logindex", "enrollid", "backupnum"]) {
    const value = asInteger(payload[key])
    if (value !== undefined) response[key] = value
  }

  return response
}

export async function processAi26BsRequest(
  payload: Ai26Json,
  dependencies: Ai26BsDependencies
): Promise<Ai26Json> {
  const serialNumber = String(payload.sn || "").trim().toUpperCase()
  const command = typeof payload.cmd === "string" ? payload.cmd.trim().toLowerCase() : ""
  const responseName = typeof payload.ret === "string" ? payload.ret.trim() : ""
  const cloudtime = formatAi26Date(dependencies.now)

  if (!serialNumber) {
    return { ret: command || responseName || "unknown", result: false, reason: "missing sn" }
  }

  const eventBase = {
    serialNumber,
    remoteAddress: dependencies.remoteAddress,
    payload,
  }

  if (command === "reg") {
    await dependencies.handleEvent({ type: "register", ...eventBase })
    return {
      ret: "reg",
      result: true,
      cloudtime,
      tryseconds: Math.min(300, Math.max(5, dependencies.pollSeconds ?? 10)),
      nosenduser: false,
      nosendlog: false,
      // Check-in photos and face templates must not be uploaded to Neon.
      nosendimage: true,
    }
  }

  if (command === "checklive") {
    await dependencies.handleEvent({ type: "heartbeat", ...eventBase })
    const claimed = await dependencies.claimCommand(serialNumber)
    return claimed
      ? { ...claimed.payload, sn: serialNumber }
      : { ret: "checklive", result: true, cloudtime }
  }

  if (command === "sendlog") {
    const decision = await dependencies.handleEvent({ type: "log", ...eventBase })
    return {
      ...acknowledgement("sendlog", payload, cloudtime),
      mark: true,
      access: dependencies.accessControlEnabled && decision.access === 1 ? 1 : 0,
      message: decision.message || "Đã nhận dữ liệu chấm công",
    }
  }

  if (command === "senduser") {
    const decision = await dependencies.handleEvent({ type: "senduser", ...eventBase })
    return {
      ...acknowledgement("senduser", payload, cloudtime),
      message: decision.message || "Đã nhận dữ liệu người dùng",
    }
  }

  if (responseName) {
    await dependencies.handleEvent({ type: "response", ...eventBase })
    return { ret: responseName, result: true, cloudtime }
  }

  await dependencies.handleEvent({ type: "heartbeat", ...eventBase })
  return {
    ret: command || "unknown",
    result: false,
    reason: "unsupported command",
    cloudtime,
  }
}
