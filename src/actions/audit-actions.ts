"use server"

import { db } from "@/db"
import { auditLogs } from "@/db/schema"
import { auth } from "@clerk/nextjs/server"
import { desc, sql, ilike, or } from "drizzle-orm"

export async function logAction(
  action: "CREATE" | "UPDATE" | "DELETE",
  entityType: "MEMBER" | "PACKAGE" | "SUBSCRIPTION" | "TRANSACTION" | "TRAINER" | "CLASS" | "SESSION" | "USER" | "SETTINGS",
  entityId: string | number,
  details?: any
) {
  try {
    const { userId } = await auth()
    if (!userId) return; // Do not log if not authenticated (e.g., automated tasks)

    await db.insert(auditLogs).values({
      userId,
      action,
      entityType,
      entityId: String(entityId),
      details: details ? JSON.stringify(details) : null
    })
  } catch (error) {
    console.error("Failed to log action:", error)
  }
}

export async function getAuditLogs(q?: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  let whereClause = undefined;
  if (q) {
    whereClause = or(
      ilike(auditLogs.action, `%${q}%`),
      ilike(auditLogs.entityType, `%${q}%`),
      ilike(auditLogs.details, `%${q}%`)
    );
  }

  const data = await db.query.auditLogs.findMany({
    where: whereClause,
    orderBy: [desc(auditLogs.createdAt)],
    limit,
    offset,
    with: {
      user: true
    }
  })

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(whereClause);
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}
