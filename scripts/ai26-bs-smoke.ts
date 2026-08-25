import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { processAi26BsRequest } from "../src/lib/ai26-bs-protocol"
import {
  sanitizeAi26Payload,
  type Ai26Json,
  type GatewayEvent,
} from "../src/lib/ai26-protocol"
import { proxy } from "../src/proxy"

async function main() {
  const rewritten = await proxy(new NextRequest("https://gym.example/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cmd: "reg", sn: "AYUD15044766" }),
  }))
  assert.equal(
    new URL(rewritten.headers.get("x-middleware-rewrite") || "").pathname,
    "/api/device/bs"
  )

  const events: GatewayEvent[] = []
  let queuedCommand: { id: number; payload: Ai26Json } | null = null

  const dependencies = {
    now: new Date("2026-08-25T10:20:30.000Z"),
    pollSeconds: 12,
    accessControlEnabled: false,
    handleEvent: async (event: GatewayEvent) => {
      events.push(event)
      return { access: 1, message: "Check-in thành công" }
    },
    claimCommand: async () => {
      const command = queuedCommand
      queuedCommand = null
      return command
    },
  }

  const registration = await processAi26BsRequest(
    { cmd: "reg", sn: "ayud15044766" },
    dependencies
  )
  assert.equal(registration.ret, "reg")
  assert.equal(registration.tryseconds, 12)
  assert.equal(registration.nosendimage, true)
  assert.equal(registration.cloudtime, "2026-08-25 17:20:30")
  assert.equal(events.at(-1)?.type, "register")

  queuedCommand = {
    id: 1,
    payload: { cmd: "adduser", enrollid: 42, backupnum: 50, name: "Hội viên thử" },
  }
  const command = await processAi26BsRequest(
    { cmd: "checklive", sn: "AYUD15044766" },
    dependencies
  )
  assert.equal(command.cmd, "adduser")
  assert.equal(command.sn, "AYUD15044766")

  const logAck = await processAi26BsRequest(
    {
      cmd: "sendlog",
      sn: "AYUD15044766",
      count: 1,
      logindex: 9,
      record: [{ enrollid: 42, time: "2026-08-25 17:20:30" }],
    },
    dependencies
  )
  assert.equal(logAck.ret, "sendlog")
  assert.equal(logAck.access, 0, "door relay must stay disabled by default")
  assert.equal(events.at(-1)?.type, "log")

  const allowedLogAck = await processAi26BsRequest(
    {
      cmd: "sendlog",
      sn: "AYUD15044766",
      count: 1,
      logindex: 10,
      record: [{ enrollid: 42, time: "2026-08-25 17:20:30" }],
    },
    { ...dependencies, accessControlEnabled: true }
  )
  assert.equal(allowedLogAck.access, 1, "approved member should be allowed")

  const userAck = await processAi26BsRequest(
    { cmd: "senduser", sn: "AYUD15044766", enrollid: 42, backupnum: 50 },
    dependencies
  )
  assert.equal(userAck.ret, "senduser")
  assert.equal(userAck.enrollid, 42)
  assert.equal(events.at(-1)?.type, "senduser")

  await processAi26BsRequest(
    { ret: "adduser", result: true, sn: "AYUD15044766" },
    dependencies
  )
  assert.equal(events.at(-1)?.type, "response")

  const sanitized = sanitizeAi26Payload({
    wlan_pwd: "wifi-secret",
    nested: { WEBSERVER_PWD: "admin-secret", image: "base64-photo" },
    record: "biometric-template",
  })
  assert.equal(sanitized.wlan_pwd, undefined)
  assert.deepEqual(sanitized.nested, {
    image: "[removed image: 12 chars]",
  })
  assert.equal(sanitized.record, "[removed biometric data: 18 chars]")

  console.log("AI26 HTTP/HTTPS BS protocol smoke test passed")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
