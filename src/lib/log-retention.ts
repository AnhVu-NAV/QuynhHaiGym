import "server-only"

import { and, inArray, lt } from "drizzle-orm"
import { db } from "@/db"
import { auditLogs, deviceCommands, deviceEvents, rateLimits } from "@/db/schema"

export const OPERATIONAL_LOG_RETENTION_DAYS = 7
export const AUDIT_LOG_RETENTION_DAYS = 365

export async function cleanupOperationalLogs() {
  const cutoff = new Date(Date.now() - OPERATIONAL_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const auditCutoff = new Date(Date.now() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)

  // Pending/sent commands are still part of the delivery queue, so retention
  // only removes terminal command records. The next run catches them after
  // they complete or fail.
  const [commands, events, audits, limits] = await Promise.all([
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
      .where(lt(auditLogs.createdAt, auditCutoff))
      .returning({ id: auditLogs.id }),
    db.delete(rateLimits)
      .where(lt(rateLimits.expiresAt, new Date()))
      .returning({ key: rateLimits.key }),
  ])

  return {
    cutoff: cutoff.toISOString(),
    deleted: {
      commands: commands.length,
      events: events.length,
      auditLogs: audits.length,
      rateLimits: limits.length,
    },
  }
}
