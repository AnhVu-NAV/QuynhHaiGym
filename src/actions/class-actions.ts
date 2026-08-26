"use server"

import { db } from "@/db"
import { classes, classSessions, classBookings, members, subscriptions } from "@/db/schema"
import { and, eq, desc, ilike, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth"
import { normalizePagination } from "@/lib/pagination"
import { z } from "zod"
import { logAction } from "./audit-actions"

const classSchema = z.object({
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(2000).optional(),
  trainerId: z.number().int().positive().optional(),
  capacity: z.number().int().min(1).max(500),
  isActive: z.boolean().optional(),
})

const classSessionSchema = z.object({
  classId: z.number().int().positive(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
}).refine((value) => value.endTime > value.startTime, { message: "Giờ kết thúc phải sau giờ bắt đầu" })

export async function getClasses(q?: string, page: number = 1, limit: number = 20, bypassPagination = false, status = "all") {
  await requireUser()
  const pagination = normalizePagination(page, limit)
  page = pagination.page
  limit = pagination.limit
  const offset = bypassPagination ? undefined : pagination.offset

  const searchClause = q ? ilike(classes.name, `%${q}%`) : undefined;
  const statusClause = status === "active" ? eq(classes.isActive, true) : status === "inactive" ? eq(classes.isActive, false) : undefined;
  const whereClause = and(searchClause, statusClause);

  const dataQuery = db.query.classes.findMany({
    where: whereClause,
    orderBy: [desc(classes.createdAt)],
    limit: bypassPagination ? undefined : limit,
    offset,
    with: {
      trainer: true,
      sessions: {
        with: {
          bookings: true
        }
      }
    }
  })

  if (bypassPagination) {
    const data = await dataQuery
    return { data, totalPages: 1, totalItems: data.length };
  }

  const [data, [{ count }]] = await Promise.all([
    dataQuery,
    db.select({ count: sql<number>`count(*)` }).from(classes).where(whereClause),
  ])
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}

export async function createClass(data: {
  name: string
  description?: string
  trainerId?: number
  capacity: number
  isActive?: boolean
}) {
  await requireUser()
  data = classSchema.parse(data)
  const [created] = await db.insert(classes).values({
    ...data,
    isActive: data.isActive ?? true
  }).returning({ id: classes.id })
  await logAction("CREATE", "CLASS", created.id, { name: data.name })
  revalidatePath("/classes")
}

export async function createClassSession(data: {
  classId: number
  startTime: Date
  endTime: Date
}) {
  await requireUser()
  data = classSessionSchema.parse(data)
  const [created] = await db.insert(classSessions).values({
    ...data,
    status: "scheduled"
  }).returning({ id: classSessions.id })
  await logAction("CREATE", "SESSION", created.id, { classId: data.classId })
  revalidatePath("/classes")
}

export async function bookClassSession(sessionId: number, memberId: number) {
  await requireUser()
  z.number().int().positive().parse(sessionId)
  z.number().int().positive().parse(memberId)

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(10, ${sessionId})`)
    const sessionRows = await tx.execute<{ capacity: number; status: string; is_active: boolean }>(sql`
      select c.capacity, cs.status, c.is_active
      from class_sessions cs
      join classes c on c.id = cs.class_id
      where cs.id = ${sessionId}
      for update
    `)
    const session = sessionRows.rows[0]
    if (!session || session.status !== "scheduled" || !session.is_active) {
      return { error: "Lớp học không còn nhận đăng ký." }
    }

    const memberRows = await tx.select({ id: members.id }).from(members).where(and(
      eq(members.id, memberId),
      eq(members.status, "active"),
      sql<boolean>`exists (
        select 1 from ${subscriptions}
        where ${subscriptions.memberId} = ${memberId}
          and ${subscriptions.status} = 'active'
          and ${subscriptions.startDate} <= now()
          and ${subscriptions.endDate} >= now()
      )`,
    )).limit(1)
    if (!memberRows.length) return { error: "Hội viên không có gói tập còn hiệu lực." }

    const existingBooking = await tx.select({ status: classBookings.status }).from(classBookings).where(and(
      eq(classBookings.sessionId, sessionId),
      eq(classBookings.memberId, memberId),
    )).limit(1)
    if (existingBooking[0]?.status === "booked") return { success: true, duplicate: true }

    const bookingCount = await tx.execute<{ count: number }>(sql`
      select count(*)::int as count from class_bookings
      where session_id = ${sessionId} and status = 'booked'
    `)
    if (Number(bookingCount.rows[0]?.count || 0) >= Number(session.capacity)) {
      return { error: "Lớp học đã đủ số người." }
    }

    await tx.insert(classBookings).values({ sessionId, memberId, status: "booked" })
      .onConflictDoUpdate({
        target: [classBookings.sessionId, classBookings.memberId],
        set: { status: "booked", bookedAt: new Date() },
      })
    return { success: true }
  })
  revalidatePath("/classes")
  if (result.success) await logAction("CREATE", "SESSION", sessionId, { memberId, booking: true })
  return result
}
