"use server"

import { db } from "@/db"
import { auditLogs } from "@/db/schema"
import { getCurrentUser, requireAdmin } from "@/lib/auth"
import { and, desc, gte, sql, ilike, or } from "drizzle-orm"
import { normalizePagination } from "@/lib/pagination"

export async function logAction(
  action: "CREATE" | "UPDATE" | "DELETE",
  entityType: "MEMBER" | "PACKAGE" | "SUBSCRIPTION" | "TRANSACTION" | "TRAINER" | "CLASS" | "SESSION" | "USER" | "SETTINGS" | "DEVICE",
  entityId: string | number,
  details?: unknown
) {
  try {
    const user = await getCurrentUser()
    if (!user) return;

    await db.insert(auditLogs).values({
      userId: user.id,
      action,
      entityType,
      entityId: String(entityId),
      details: details ? JSON.stringify(details) : null
    })
  } catch (error) {
    console.error("Failed to log action:", error)
  }
}

export async function getAuditLogs(q?: string, page: number = 1, limit: number = 10) {
  await requireAdmin()
  const pagination = normalizePagination(page, limit, 10)
  page = pagination.page
  limit = pagination.limit
  const { offset } = pagination
  const retentionCutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

  const searchClause = q
    ? or(
      ilike(auditLogs.action, `%${q}%`),
      ilike(auditLogs.entityType, `%${q}%`),
      ilike(auditLogs.details, `%${q}%`)
    )
    : undefined
  const whereClause = and(gte(auditLogs.createdAt, retentionCutoff), searchClause)

  const [data, [{ count }]] = await Promise.all([
    db.query.auditLogs.findMany({
      where: whereClause,
      orderBy: [desc(auditLogs.createdAt)],
      limit,
      offset,
      with: {
        user: {
          columns: {
            id: true,
            fullName: true,
            email: true,
            username: true,
          },
        },
      },
    }),
    db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(whereClause),
  ])
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}
