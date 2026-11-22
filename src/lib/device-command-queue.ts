import "server-only"

import { inArray } from "drizzle-orm"
import { db } from "@/db"
import { deviceCommands, devices } from "@/db/schema"
import { enqueueAi26EdgeCommand, isAi26EdgeConfigured } from "@/lib/ai26-edge"
import type { Ai26Command } from "@/lib/ai26-protocol"

type DeviceIdentity = Pick<typeof devices.$inferSelect, "id" | "serialNumber">

export async function queueDeviceCommand(options: {
  device: DeviceIdentity
  command: Ai26Command
  memberId?: number
}) {
  const [created] = await db.insert(deviceCommands).values({
    deviceId: options.device.id,
    memberId: options.memberId,
    command: options.command.cmd,
    payload: options.command,
    status: "pending",
  }).returning()

  if (!created || !isAi26EdgeConfigured()) return { command: created, edgeQueued: false }

  const edgeQueued = await enqueueAi26EdgeCommand({
    serialNumber: options.device.serialNumber,
    commandId: created.id,
    command: options.command,
  })
  return { command: created, edgeQueued }
}

export async function dispatchPendingDeviceCommands(deviceIds: number[]) {
  if (!deviceIds.length || !isAi26EdgeConfigured()) return 0
  const deviceList = await db.query.devices.findMany({
    where: inArray(devices.id, deviceIds),
  })
  const selected = new Map(
    deviceList.filter((device) => deviceIds.includes(device.id)).map((device) => [device.id, device])
  )
  const pending = await db.query.deviceCommands.findMany({
    where: (command, { and, eq, inArray }) => and(
      inArray(command.deviceId, deviceIds),
      eq(command.status, "pending")
    ),
  })

  let dispatched = 0
  for (const command of pending) {
    const device = selected.get(command.deviceId)
    if (!device) continue
    const edgeQueued = await enqueueAi26EdgeCommand({
      serialNumber: device.serialNumber,
      commandId: command.id,
      command: command.payload as Ai26Command,
    })
    if (!edgeQueued) continue
    dispatched += 1
  }
  return dispatched
}
