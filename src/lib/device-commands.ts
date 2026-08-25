import "server-only"

import { and, asc, eq } from "drizzle-orm"
import { db } from "@/db"
import { deviceCommands, devices } from "@/db/schema"

export async function claimPendingDeviceCommand(serialNumber: string) {
  const normalizedSerial = serialNumber.trim().toUpperCase()
  const device = await db.query.devices.findFirst({
    where: and(
      eq(devices.serialNumber, normalizedSerial),
      eq(devices.isActive, true)
    ),
  })

  if (!device) return null

  const pending = await db.query.deviceCommands.findFirst({
    where: and(
      eq(deviceCommands.deviceId, device.id),
      eq(deviceCommands.status, "pending")
    ),
    orderBy: [asc(deviceCommands.createdAt)],
  })

  if (!pending) return null

  // The status condition is the lock: concurrent polls cannot both claim the
  // same command even if they read the same pending row.
  const [claimed] = await db.update(deviceCommands).set({
    status: "sent",
    sentAt: new Date(),
    error: null,
  }).where(and(
    eq(deviceCommands.id, pending.id),
    eq(deviceCommands.status, "pending")
  )).returning({
    id: deviceCommands.id,
    payload: deviceCommands.payload,
  })

  return claimed || null
}
