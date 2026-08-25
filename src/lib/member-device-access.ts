import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import {
  deviceCommands,
  deviceMemberMappings,
} from "@/db/schema"

export async function queueMemberDeviceAccess(memberId: number, enabled: boolean) {
  const mappings = await db.query.deviceMemberMappings.findMany({
    where: eq(deviceMemberMappings.memberId, memberId),
    with: { device: true },
  })

  let queued = 0
  for (const mapping of mappings) {
    if (!mapping.device.isActive || mapping.faceStatus !== "registered") continue
    if (mapping.accessEnabled === enabled) continue

    const existing = await db.query.deviceCommands.findFirst({
      where: and(
        eq(deviceCommands.deviceId, mapping.deviceId),
        eq(deviceCommands.memberId, memberId),
        eq(deviceCommands.command, "enableuser"),
        inArray(deviceCommands.status, ["pending", "sent"])
      ),
    })
    const existingFlag = Number(existing?.payload?.enflag)
    if (existing && existingFlag === (enabled ? 1 : 0)) continue

    if (existing?.status === "pending") {
      await db.update(deviceCommands).set({
        status: "cancelled",
        completedAt: new Date(),
        error: "Được thay thế bởi trạng thái quyền mới hơn",
      }).where(eq(deviceCommands.id, existing.id))
    }

    await db.insert(deviceCommands).values({
      deviceId: mapping.deviceId,
      memberId,
      command: "enableuser",
      payload: {
        cmd: "enableuser",
        enrollid: mapping.enrollId,
        enflag: enabled ? 1 : 0,
      },
      status: "pending",
    })
    queued += 1
  }

  return queued
}
