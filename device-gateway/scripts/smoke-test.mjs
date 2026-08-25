import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { WebSocket } from "ws"

const gatewayPort = 17792
const webPort = 17793
const serialNumber = "AYUD15044766"
const secret = "smoke-test-secret-with-at-least-32-characters"

let commandDelivered = false
let receivedLog = false

const webServer = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = chunks.length
    ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
    : {}

  if (request.headers.authorization !== `Bearer ${secret}`) {
    response.writeHead(401, { "content-type": "application/json" })
    response.end(JSON.stringify({ success: false }))
    return
  }

  if (request.url === "/api/device/commands") {
    const command = commandDelivered
      ? null
      : { id: 1, payload: { cmd: "adduser", enrollid: 42, backupnum: 50, name: "Test Member" } }
    commandDelivered = true
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ success: true, command }))
    return
  }

  if (request.url === "/api/device/events") {
    if (body.type === "log") {
      receivedLog = true
      if (JSON.stringify(body).includes("base64-photo")) {
        throw new Error("Gateway forwarded image data")
      }
    }
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ success: true, access: 0, message: "ok" }))
    return
  }

  response.writeHead(404).end()
})

function waitForMessage(socket, predicate, timeoutMs = 8_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage)
      reject(new Error("Timed out waiting for Gateway message"))
    }, timeoutMs)

    function onMessage(raw) {
      const payload = JSON.parse(raw.toString("utf8"))
      if (!predicate(payload)) return
      clearTimeout(timeout)
      socket.off("message", onMessage)
      resolve(payload)
    }

    socket.on("message", onMessage)
  })
}

await new Promise((resolve) => webServer.listen(webPort, "127.0.0.1", resolve))

const gateway = spawn(process.execPath, ["dist/index.js"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: String(gatewayPort),
    WEB_APP_URL: `http://127.0.0.1:${webPort}`,
    DEVICE_GATEWAY_SECRET: secret,
    AI26_ALLOWED_SERIALS: serialNumber,
    AI26_ACCESS_CONTROL_ENABLED: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
})

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Gateway did not start")), 5_000)
    gateway.stdout.on("data", (chunk) => {
      if (!chunk.toString().includes("listening")) return
      clearTimeout(timeout)
      resolve()
    })
    gateway.once("exit", (code) => reject(new Error(`Gateway exited with ${code}`)))
  })

  const device = new WebSocket(`ws://127.0.0.1:${gatewayPort}`)
  await new Promise((resolve, reject) => {
    device.once("open", resolve)
    device.once("error", reject)
  })

  const registered = waitForMessage(device, (payload) => payload.ret === "reg")
  device.send(JSON.stringify({ cmd: "reg", sn: serialNumber, devicename: "AI26" }))
  const registrationReply = await registered
  if (registrationReply.result !== true) throw new Error("Device registration failed")

  const command = await waitForMessage(device, (payload) => payload.cmd === "adduser")
  if (command.enrollid !== 42) throw new Error("Wrong command payload")

  const logReply = waitForMessage(device, (payload) => payload.ret === "sendlog")
  device.send(JSON.stringify({
    cmd: "sendlog",
    count: 1,
    logindex: 1,
    image: "base64-photo",
    record: [{ enrollid: 42, time: "2026-08-25 10:00:00" }],
  }))
  await logReply
  if (!receivedLog) throw new Error("Web did not receive check-in event")

  device.close()
  console.log("Gateway smoke test passed")
} finally {
  gateway.kill()
  await new Promise((resolve) => webServer.close(resolve))
}
