export type Ai26Json = Record<string, unknown>

export type GatewayEventType =
  | "register"
  | "log"
  | "senduser"
  | "response"
  | "disconnect"
  | "heartbeat"

export type GatewayEvent = {
  type: GatewayEventType
  serialNumber: string
  remoteAddress?: string
  payload: Ai26Json
}

export type Ai26Command = Ai26Json & { cmd: string }

const AI26_SENSITIVE_KEYS = new Set([
  "wlan_pwd",
  "webserver_pwd",
  "qrcode_pwd",
  "excel_password",
  "commpassword",
  "cpucard_key",
])

export function formatAi26Date(value = new Date()) {
  // Vercel normally runs in UTC, while this AI26 is installed in Vietnam.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || ""

  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`
}

// Never persist face templates, registration photos, or punch photos in the
// protocol audit table. This also keeps Neon rows small.
export function sanitizeAi26Payload(payload: Ai26Json): Ai26Json {
  const sanitize = (value: unknown, key?: string): unknown => {
    const normalizedKey = key?.toLowerCase()
    if (normalizedKey && AI26_SENSITIVE_KEYS.has(normalizedKey)) {
      return "[removed sensitive value]"
    }
    if (normalizedKey === "image" && typeof value === "string") {
      return `[removed image: ${value.length} chars]`
    }
    if (normalizedKey === "record" && typeof value === "string") {
      return `[removed biometric data: ${value.length} chars]`
    }
    if (Array.isArray(value)) {
      return value.map((item) => sanitize(item))
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([childKey]) => !AI26_SENSITIVE_KEYS.has(childKey.toLowerCase()))
          .map(([childKey, childValue]) => [
            childKey,
            sanitize(childValue, childKey),
          ])
      )
    }
    return value
  }

  return sanitize(payload) as Ai26Json
}
