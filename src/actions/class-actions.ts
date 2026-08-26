"use server"

import { db } from "@/db"
import { classes, classSessions } from "@/db/schema"
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

  type BookingRow = {
    session_valid: boolean
    member_valid: boolean
    duplicate_booking: boolean
    class_full: boolean
    inserted: boolean
  }
  // A single SQL statement is one Neon HTTP transaction. The advisory lock
  // serializes capacity checks for this class session across Vercel instances.
  const bookingResult = await db.execute<BookingRow>(sql`
    with booking_lock as materialized (
      select pg_advisory_xact_lock(10, ${sessionId})
    ), session_info as materialized (
      select c.capacity
      from class_sessions cs
      join classes c on c.id = cs.class_id
      cross join booking_lock
      where cs.id = ${sessionId}
        and cs.status = 'scheduled'
        and c.is_active = true
    ), valid_member as materialized (
      select m.id
      from members m
      cross join booking_lock
      where m.id = ${memberId}
        and m.status = 'active'
        and exists (
          select 1 from subscriptions s
          where s.member_id = m.id
            and s.status = 'active'
            and s.start_date <= now()
            and s.end_date >= now()
        )
    ), existing_booking as materialized (
      select 1
      from class_bookings cb
      cross join booking_lock
      where cb.session_id = ${sessionId}
        and cb.member_id = ${memberId}
        and cb.status = 'booked'
    ), booking_count as materialized (
      select count(*)::int as count
      from class_bookings cb
      cross join booking_lock
      where cb.session_id = ${sessionId} and cb.status = 'booked'
    ), upserted as (
      insert into class_bookings (session_id, member_id, status)
      select ${sessionId}, ${memberId}, 'booked'
      where exists (select 1 from session_info)
        and exists (select 1 from valid_member)
        and not exists (select 1 from existing_booking)
        and (select count from booking_count) < (select capacity from session_info)
      on conflict (session_id, member_id) do update
        set status = 'booked', booked_at = now()
      returning id
    )
    select
      exists (select 1 from session_info) as session_valid,
      exists (select 1 from valid_member) as member_valid,
      exists (select 1 from existing_booking) as duplicate_booking,
      coalesce(
        (select count from booking_count) >= (select capacity from session_info),
        false
      ) as class_full,
      exists (select 1 from upserted) as inserted
  `)
  const row = bookingResult.rows[0]
  const result = !row?.session_valid
    ? { error: "Lớp học không còn nhận đăng ký." }
    : !row.member_valid
      ? { error: "Hội viên không có gói tập còn hiệu lực." }
      : row.duplicate_booking
        ? { success: true, duplicate: true }
        : row.class_full
          ? { error: "Lớp học đã đủ số người." }
          : row.inserted
            ? { success: true }
            : { error: "Không thể đăng ký lớp học. Vui lòng thử lại." }
  revalidatePath("/classes")
  if (result.success) await logAction("CREATE", "SESSION", sessionId, { memberId, booking: true })
  return result
}
