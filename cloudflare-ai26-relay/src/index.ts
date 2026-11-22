import { DurableObject } from "cloudflare:workers"

type JsonObject = Record<string, unknown>

type EdgeCommand = {
  id: number
  payload: JsonObject
  queuedAt: number
  sentAt?: number
}

type Env = {
  AI26_DEVICE: DurableObjectNamespace<Ai26Device>
  AI26_EDGE_SECRET: string
  AI26_ALLOWED_SERIALS?: string
  ORIGIN_URL: string
}

const MAX_BODY_BYTES = 2 * 1024 * 1024
const ONLINE_WINDOW_MS = 90_000
const COMMAND_RETRY_MS = 120_000
const MAX_QUEUED_COMMANDS = 50
const MAX_POLLS_PER_MINUTE = 20

function json(body: JsonObject, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  })
}

function normalizeSerial(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().slice(0, 100) : ""
}

function allowedByBootstrap(env: Env, serialNumber: string) {
  return new Set(
    (env.AI26_ALLOWED_SERIALS || "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)
  ).has(serialNumber)
}

function authorized(request: Request, env: Env) {
  const expected = env.AI26_EDGE_SECRET
  const actual = request.headers.get("authorization")
  return Boolean(expected && actual === `Bearer ${expected}`)
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

async function parseJson(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || 0)
  if (declaredLength > MAX_BODY_BYTES) throw new Response("payload too large", { status: 413 })
  const body = await request.arrayBuffer()
  if (body.byteLength > MAX_BODY_BYTES) throw new Response("payload too large", { status: 413 })
  try {
    const value = JSON.parse(new TextDecoder().decode(body))
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid")
    return value as JsonObject
  } catch {
    throw new Response("invalid json", { status: 400 })
  }
}

function deviceStub(env: Env, serialNumber: string) {
  return env.AI26_DEVICE.get(env.AI26_DEVICE.idFromName(serialNumber))
}

async function forwardToOrigin(request: Request, env: Env, payload: JsonObject) {
  const origin = env.ORIGIN_URL.replace(/\/$/, "")
  return fetch(`${origin}/api/device/bs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.AI26_EDGE_SECRET}`,
      "x-ai26-edge-relay": "cloudflare",
      "x-ai26-client-ip": request.headers.get("cf-connecting-ip") || "",
    },
    body: JSON.stringify(payload),
  })
}

export class Ai26Device extends DurableObject<Env> {
  private pollWindowStartedAt = 0
  private pollCount = 0

  private acceptPoll() {
    const now = Date.now()
    if (now - this.pollWindowStartedAt >= 60_000) {
      this.pollWindowStartedAt = now
      this.pollCount = 0
    }
    if (this.pollCount >= MAX_POLLS_PER_MINUTE) return false
    this.pollCount += 1
    return true
  }

  private async isAuthorized(bootstrapAllowed: boolean) {
    const stored = await this.ctx.storage.get<boolean>("authorized")
    return stored ?? bootstrapAllowed
  }

  private async touch() {
    const now = Date.now()
    await this.ctx.storage.put("lastSeenAt", now)
    return now
  }

  private async commands() {
    return (await this.ctx.storage.get<EdgeCommand[]>("commands")) || []
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    const bootstrapAllowed = request.headers.get("x-bootstrap-allowed") === "1"

    if (url.pathname === "/authorize" && request.method === "POST") {
      const body = await request.json<{ active?: boolean }>()
      await this.ctx.storage.put("authorized", body.active === true)
      if (body.active !== true) await this.ctx.storage.deleteAll()
      if (body.active !== true) await this.ctx.storage.put("authorized", false)
      return json({ success: true })
    }

    if (!(await this.isAuthorized(bootstrapAllowed))) {
      return json({ success: false, reason: "device not allowed" }, 403)
    }

    if (url.pathname === "/touch" && request.method === "POST") {
      const lastSeenAt = await this.touch()
      return json({ success: true, lastSeenAt })
    }

    if (url.pathname === "/status" && request.method === "GET") {
      const lastSeenAt = (await this.ctx.storage.get<number>("lastSeenAt")) || null
      const commands = await this.commands()
      return json({
        success: true,
        lastSeenAt,
        online: Boolean(lastSeenAt && Date.now() - lastSeenAt < ONLINE_WINDOW_MS),
        pendingCommands: commands.length,
      })
    }

    if (url.pathname === "/command" && request.method === "POST") {
      const body = await request.json<{ id?: number; payload?: JsonObject }>()
      if (!Number.isInteger(body.id) || !body.payload || typeof body.payload !== "object") {
        return json({ success: false, reason: "invalid command" }, 400)
      }
      const commands = await this.commands()
      if (!commands.some((command) => command.id === body.id)) {
        if (commands.length >= MAX_QUEUED_COMMANDS) {
          return json({ success: false, reason: "command queue full" }, 409)
        }
        commands.push({ id: body.id!, payload: body.payload, queuedAt: Date.now() })
        await this.ctx.storage.put("commands", commands)
      }
      return json({ success: true })
    }

    if (url.pathname === "/poll" && request.method === "POST") {
      if (!this.acceptPoll()) {
        return json({ success: false, reason: "rate limit exceeded" }, 429)
      }
      await this.touch()
      const commands = await this.commands()
      const now = Date.now()
      const command = commands.find((item) => !item.sentAt || now - item.sentAt >= COMMAND_RETRY_MS)
      if (!command) return json({ success: true, command: null })
      command.sentAt = now
      await this.ctx.storage.put("commands", commands)
      return json({ success: true, command: { id: command.id, payload: command.payload } })
    }

    if (url.pathname === "/complete" && request.method === "POST") {
      const body = await request.json<{ command?: string }>()
      const commandName = typeof body.command === "string" ? body.command.trim() : ""
      if (!commandName) return json({ success: false, reason: "missing command" }, 400)
      const commands = await this.commands()
      const index = commands.findIndex((item) => item.sentAt && item.payload.cmd === commandName)
      if (index >= 0) {
        commands.splice(index, 1)
        await this.ctx.storage.put("commands", commands)
      }
      return json({ success: true })
    }

    return json({ success: false, reason: "not found" }, 404)
  }
}

async function controlRequest(request: Request, env: Env, url: URL) {
  if (!authorized(request, env)) return json({ success: false, reason: "unauthorized" }, 401)

  if (url.pathname === "/control/device" && request.method === "POST") {
    const payload = await parseJson(request)
    const serialNumber = normalizeSerial(payload.serialNumber)
    if (!serialNumber) return json({ success: false, reason: "missing serial" }, 400)
    return deviceStub(env, serialNumber).fetch("https://device/authorize", {
      method: "POST",
      body: JSON.stringify({ active: payload.active === true }),
    })
  }

  if (url.pathname === "/control/command" && request.method === "POST") {
    const payload = await parseJson(request)
    const serialNumber = normalizeSerial(payload.serialNumber)
    const id = Number(payload.commandId)
    if (!serialNumber || !Number.isInteger(id) || !payload.command || typeof payload.command !== "object") {
      return json({ success: false, reason: "invalid command" }, 400)
    }
    const stub = deviceStub(env, serialNumber)
    const bootstrap = allowedByBootstrap(env, serialNumber) ? "1" : "0"
    return stub.fetch("https://device/command", {
      method: "POST",
      headers: { "x-bootstrap-allowed": bootstrap },
      body: JSON.stringify({ id, payload: payload.command }),
    })
  }

  if (url.pathname === "/control/status" && request.method === "GET") {
    const serialNumber = normalizeSerial(url.searchParams.get("serialNumber"))
    if (!serialNumber) return json({ success: false, reason: "missing serial" }, 400)
    const bootstrap = allowedByBootstrap(env, serialNumber) ? "1" : "0"
    return deviceStub(env, serialNumber).fetch("https://device/status", {
      headers: { "x-bootstrap-allowed": bootstrap },
    })
  }

  return json({ success: false, reason: "not found" }, 404)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/health") {
      return json({ success: true, service: "Quynh Hai AI26 Edge Relay", mode: "durable-object" })
    }
    if (url.pathname.startsWith("/control/")) return controlRequest(request, env, url)
    if (request.method !== "POST") return json({ success: false, reason: "not found" }, 404)

    let payload: JsonObject
    try {
      payload = await parseJson(request)
    } catch (error) {
      return error instanceof Response ? error : json({ success: false, reason: "invalid request" }, 400)
    }

    const serialNumber = normalizeSerial(payload.sn)
    if (!serialNumber) return json({ result: false, reason: "missing sn" }, 400)
    const stub = deviceStub(env, serialNumber)
    const bootstrap = allowedByBootstrap(env, serialNumber) ? "1" : "0"
    const command = typeof payload.cmd === "string" ? payload.cmd.trim().toLowerCase() : ""
    const responseName = typeof payload.ret === "string" ? payload.ret.trim() : ""

    try {
      if (command === "checklive") {
        const polled = await stub.fetch("https://device/poll", {
          method: "POST",
          headers: { "x-bootstrap-allowed": bootstrap },
        })
        if (!polled.ok) return polled
        const result = await polled.json<{ command?: { payload?: JsonObject } | null }>()
        return result.command?.payload
          ? json({ ...result.command.payload, sn: serialNumber })
          : json({ ret: "checklive", result: true, cloudtime: ai26Time() })
      }

      const touched = await stub.fetch("https://device/touch", {
        method: "POST",
        headers: { "x-bootstrap-allowed": bootstrap },
      })
      if (!touched.ok) return touched

      const originResponse = await forwardToOrigin(request, env, payload)
      if (originResponse.ok && responseName) {
        await stub.fetch("https://device/complete", {
          method: "POST",
          headers: { "x-bootstrap-allowed": bootstrap },
          body: JSON.stringify({ command: responseName }),
        })
      }
      return originResponse
    } catch (error) {
      console.error("AI26 edge relay fallback", error)
      return forwardToOrigin(request, env, payload)
    }
  },
} satisfies ExportedHandler<Env>
