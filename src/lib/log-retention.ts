import "server-only"

import { and, inArray, lt } from "drizzle-orm"
import { db } from "@/db"
import { auditLogs, deviceCommands, deviceEvents } from "@/db/schema"

export const OPERATIONAL_LOG_RETENTION_DAYS = 7

export async function cleanupOperationalLogs() {
  const cutoff = new Date(Date.now() - OPERATIONAL_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)

  // Pending/sent commands are still part of the delivery queue, so retention
  // only removes terminal command records. The next run catches them after
  // they complete or fail.
  const [commands, events, audits] = await Promise.all([
    db.delete(deviceCommands)
      .where(and(
        lt(deviceCommands.createdAt, cutoff),
        inArray(deviceCommands.status, ["completed", "failed"]),
      ))
      .returning({ id: deviceCommands.id }),
    db.delete(deviceEvents)
      .where(lt(deviceEvents.createdAt, cutoff))
      .returning({ id: deviceEvents.id }),
    db.delete(auditLogs)
      .where(lt(auditLogs.createdAt, cutoff))
      .returning({ id: auditLogs.id }),
  ])

  return {
    cutoff: cutoff.toISOString(),
    deleted: {
      commands: commands.length,
      events: events.length,
      auditLogs: audits.length,
    },
  }
}
