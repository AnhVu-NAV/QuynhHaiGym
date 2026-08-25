import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { WebSocket, WebSocketServer } from "ws"

type JsonObject = Record<string, unknown>

const port = Number(process.env.PORT || 7792)
const webAppUrl = process.env.WEB_APP_URL?.replace(/\/$/, "")
const gatewaySecret = process.env.DEVICE_GATEWAY_SECRET
const allowedSerials = new Set(
  (process.env.AI26_ALLOWED_SERIALS || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
)
const accessControlEnabled = process.env.AI26_ACCESS_CONTROL_ENABLED === "true"
const configuredPollInterval = Number(process.env.COMMAND_POLL_INTERVAL_MS || 5_000)
const commandPollIntervalMs = Number.isFinite(configuredPollInterval)
  ? Math.max(2_000, configuredPollInterval)
  : 5_000
const allowedCommands = new Set([
  "adduser",
  "deleteuser",
  "enableuser",
  "settime",
  "getdevinfo",
  "getuserlist",
  "cleanlog",
])

if (!webAppUrl) throw new Error("WEB_APP_URL is required")
if (!gatewaySecret || gatewaySecret.length < 32) {
  throw new Error("DEVICE_GATEWAY_SECRET must contain at least 32 characters")
}
if (allowedSerials.size === 0) {
  throw new Error("AI26_ALLOWED_SERIALS must contain at least one device serial")
}
const configuredGatewaySecret = gatewaySecret

const sessions = new Map<string, WebSocket>()
const sessionSerials = new WeakMap<WebSocket, string>()

function sanitizeForWeb(payload: JsonObject): JsonObject {
  const sanitize = (value: unknown, key?: string): unknown => {
    if (key === "image" && typeof value === "string") return "[removed at gateway]"
    if (key === "record" && typeof value === "string") return "[removed at gateway]"
    if (Array.isArray(value)) return value.map((item) => sanitize(item))
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as JsonObject).map(([childKey, childValue]) => [
          childKey,
          sanitize(childValue, childKey),
        ])
      )
    }
    return value
  }
  return sanitize(payload) as JsonObject
}

function sendJson(response: ServerResponse, status: number, body: JsonObject) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(body))
}

async function notifyWeb(options: {
  type: "register" | "log" | "senduser" | "response" | "disconnect" | "heartbeat"
  serialNumber: string
  remoteAddress?: string
  payload: JsonObject
}) {
  const response = await fetch(`${webAppUrl}/api/device/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${configuredGatewaySecret}`,
    },
    body: JSON.stringify({ ...options, payload: sanitizeForWeb(options.payload) }),
    signal: AbortSignal.timeout(8_000),
  })
  const body = await response.json().catch(() => ({})) as JsonObject
  if (!response.ok) {
    throw new Error(typeof body.message === "string" ? body.message : `Web returned ${response.status}`)
  }
  return body
}

function ai26Time() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())
}

function socketSend(socket: WebSocket, payload: JsonObject) {
  if (socket.readyState !== WebSocket.OPEN) return false
  socket.send(JSON.stringify(payload))
  return true
}

async function pullCommand(serialNumber: string) {
  const response = await fetch(`${webAppUrl}/api/device/commands`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${configuredGatewaySecret}`,
    },
    body: JSON.stringify({ serialNumber }),
    signal: AbortSignal.timeout(8_000),
  })
  const body = await response.json().catch(() => ({})) as JsonObject
  if (!response.ok) {
    throw new Error(typeof body.message === "string" ? body.message : `Web returned ${response.status}`)
  }
  return body.command && typeof body.command === "object" && !Array.isArray(body.command)
    ? body.command as JsonObject
    : null
}

let pollingCommands = false
async function pollCommands() {
  if (pollingCommands || sessions.size === 0) return
  pollingCommands = true
  try {
    for (const [serialNumber, socket] of sessions) {
      if (socket.readyState !== WebSocket.OPEN) continue

      // Drain a small batch so multiple actions from the web do not have to
      // wait for separate polling intervals.
      for (let index = 0; index < 10; index += 1) {
        const claimed = await pullCommand(serialNumber)
        if (!claimed) break

        const payload = claimed.payload && typeof claimed.payload === "object"
          && !Array.isArray(claimed.payload)
          ? claimed.payload as JsonObject
          : null
        const commandName = typeof payload?.cmd === "string" ? payload.cmd : ""

        if (!payload || !allowedCommands.has(commandName)) {
          await notifyWeb({
            type: "response",
            serialNumber,
            payload: {
              ret: commandName || "unknown",
              result: false,
              reason: "Gateway rejected command",
            },
          }).catch(() => undefined)
          continue
        }

        if (!socketSend(socket, payload)) break
        console.log(`Command sent to ${serialNumber}: ${commandName}`)
      }
    }
  } catch (error) {
    console.error("Command polling failed", error)
  } finally {
    pollingCommands = false
  }
}

async function handleDeviceMessage(socket: WebSocket, request: IncomingMessage, rawMessage: Buffer) {
  let payload: JsonObject
  try {
    payload = JSON.parse(rawMessage.toString("utf8")) as JsonObject
  } catch {
    return
  }

  const cmd = typeof payload.cmd === "string" ? payload.cmd.trim() : ""
  const ret = typeof payload.ret === "string" ? payload.ret.trim() : ""

  if (cmd === "reg") {
    const serialNumber = typeof payload.sn === "string" ? payload.sn.trim().toUpperCase() : ""
    if (!allowedSerials.has(serialNumber)) {
      socketSend(socket, { ret: "reg", result: false, reason: "Device not allowed" })
      socket.close(1008, "Device not allowed")
      return
    }

    try {
      await notifyWeb({
        type: "register",
        serialNumber,
        remoteAddress: request.socket.remoteAddress,
        payload,
      })
    } catch (error) {
      console.error("Registration callback failed", error)
      socketSend(socket, { ret: "reg", result: false, reason: "Server unavailable" })
      return
    }

    const previous = sessions.get(serialNumber)
    if (previous && previous !== socket) previous.close(1000, "Replaced by new connection")
    sessions.set(serialNumber, socket)
    sessionSerials.set(socket, serialNumber)
    socketSend(socket, {
      ret: "reg",
      result: true,
      cloudtime: ai26Time(),
      nosenduser: false,
    })
    console.log(`AI26 online: ${serialNumber}`)
    return
  }

  const serialNumber = sessionSerials.get(socket)
  if (!serialNumber) {
    socket.close(1008, "Register first")
    return
  }

  if (cmd === "sendlog") {
    try {
      const decision = await notifyWeb({ type: "log", serialNumber, payload })
      socketSend(socket, {
        ret: "sendlog",
        result: true,
        count: payload.count,
        logindex: payload.logindex,
        cloudtime: ai26Time(),
        access: accessControlEnabled && decision.access === 1 ? 1 : 0,
        message: typeof decision.message === "string" ? decision.message : undefined,
      })
    } catch (error) {
      console.error("Check-in processing failed", error)
      socketSend(socket, { ret: "sendlog", result: false, access: 0, reason: "Server unavailable" })
    }
    return
  }

  if (cmd === "senduser") {
    try {
      await notifyWeb({ type: "senduser", serialNumber, payload })
      socketSend(socket, {
        ret: "senduser",
        result: true,
        enrollid: payload.enrollid,
        backupnum: payload.backupnum,
        cloudtime: ai26Time(),
      })
    } catch (error) {
      console.error("User sync failed", error)
      socketSend(socket, { ret: "senduser", result: false, reason: "Server unavailable" })
    }
    return
  }

  if (ret) {
    await notifyWeb({ type: "response", serialNumber, payload }).catch((error) => {
      console.error("Command response callback failed", error)
    })
    return
  }

  await notifyWeb({ type: "heartbeat", serialNumber, payload }).catch(() => undefined)
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      success: true,
      onlineDevices: sessions.size,
      serialNumbers: [...sessions.keys()],
      accessControlEnabled,
      commandPollIntervalMs,
    })
    return
  }

  sendJson(response, 404, { success: false, message: "Not found" })
})

const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 2_048_000 })
server.on("upgrade", (request, socket, head) => {
  websocketServer.handleUpgrade(request, socket, head, (websocket) => {
    websocketServer.emit("connection", websocket, request)
  })
})

websocketServer.on("connection", (socket, request) => {
  socket.on("message", (data) => {
    void handleDeviceMessage(socket, request, Buffer.from(data as ArrayBuffer))
  })
  socket.on("close", () => {
    const serialNumber = sessionSerials.get(socket)
    if (!serialNumber || sessions.get(serialNumber) !== socket) return
    sessions.delete(serialNumber)
    void notifyWeb({ type: "disconnect", serialNumber, payload: {} }).catch(() => undefined)
    console.log(`AI26 offline: ${serialNumber}`)
  })
  socket.on("error", (error) => console.error("AI26 WebSocket error", error))
})

server.listen(port, "0.0.0.0", () => {
  console.log(`AI26 Device Gateway listening on port ${port}`)
})

setInterval(() => {
  for (const serialNumber of sessions.keys()) {
    void notifyWeb({ type: "heartbeat", serialNumber, payload: {} }).catch(() => undefined)
  }
}, 30_000).unref()

setInterval(() => {
  void pollCommands()
}, commandPollIntervalMs).unref()
