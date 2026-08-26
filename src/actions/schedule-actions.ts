"use server"

import { randomUUID } from "node:crypto"
import { db } from "@/db"
import { members, ptSessions, subscriptions, trainers } from "@/db/schema"
import { and, eq, gte, ilike, inArray, lt, lte, ne, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { logAction } from "./audit-actions"

const recurringSessionSchema = z.object({
  trainerId: z.number().int().positive(),
  memberId: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  repeatUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  repeatWeekly: z.boolean(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  notes: z.string().trim().max(1000).optional(),
})

type CalendarFilters = {
  from: Date
  to: Date
  q?: string
  trainerId?: number
  status?: string
}

export async function getPTCalendarSessions({ from, to, q, trainerId, status }: CalendarFilters) {
  await requireUser()
  if (!(from instanceof Date) || !(to instanceof Date) || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw new Error("Khoảng thời gian không hợp lệ")
  }
  if (to.getTime() - from.getTime() > 370 * 86_400_000) throw new Error("Chỉ được xem tối đa 1 năm")
  const conditions = [
    gte(ptSessions.startTime, from),
    lt(ptSessions.startTime, to),
    inArray(ptSessions.memberId, db.select({ id: members.id }).from(members).where(ne(members.status, "deleted"))),
  ]
  if (trainerId) conditions.push(eq(ptSessions.trainerId, trainerId))
  if (status && status !== "all") conditions.push(eq(ptSessions.status, status))
  if (q) {
    conditions.push(or(
      inArray(ptSessions.memberId, db.select({ id: members.id }).from(members).where(ilike(members.fullName, `%${q}%`))),
      inArray(ptSessions.trainerId, db.select({ id: trainers.id }).from(trainers).where(ilike(trainers.fullName, `%${q}%`))),
    )!)
  }

  const data = await db.query.ptSessions.findMany({
    where: and(...conditions),
    orderBy: (table, { asc }) => [asc(table.startTime)],
    with: { trainer: true, member: true },
  })

  const activeSessions = data.filter((session) => session.status !== "cancelled")
  return data.map((session) => ({
    ...session,
    concurrentCount: session.status === "cancelled" ? 0 : activeSessions.filter((other) =>
      other.trainerId === session.trainerId &&
      other.startTime < session.endTime &&
      other.endTime > session.startTime
    ).length,
  }))
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function vietnamDateTime(date: Date, time: string) {
  return new Date(`${dateKey(date)}T${time}:00+07:00`)
}

export async function createRecurringPTSessions(data: {
  trainerId: number
  memberId: number
  startDate: string
  repeatUntil: string
  repeatWeekly: boolean
  weekdays: number[]
  startTime: string
  endTime: string
  notes?: string
}) {
  await requireUser()
  data = recurringSessionSchema.parse(data)
  const trainer = await db.query.trainers.findFirst({ where: eq(trainers.id, data.trainerId) })
  const member = await db.query.members.findFirst({ where: eq(members.id, data.memberId) })
  if (!trainer?.isActive) return { error: "PT này đang ngừng hoạt động." }
  if (!member || member.status !== "active") return { error: "Hội viên không hoạt động hoặc không tồn tại." }

  const now = new Date()
  const validSubscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.memberId, data.memberId),
      eq(subscriptions.status, "active"),
      lte(subscriptions.startDate, now),
      gte(subscriptions.endDate, now),
    ),
  })
  if (!validSubscription) return { error: "Hội viên không có gói tập còn hiệu lực." }

  const startDate = parseLocalDate(data.startDate)
  const repeatUntil = parseLocalDate(data.repeatWeekly ? data.repeatUntil : data.startDate)
  if (!startDate || !repeatUntil || repeatUntil < startDate) return { error: "Khoảng ngày không hợp lệ." }
  if (repeatUntil.getTime() - startDate.getTime() > 366 * 86_400_000) return { error: "Mỗi lần chỉ được tạo lịch tối đa 1 năm." }

  const selectedDays = data.repeatWeekly ? [...new Set(data.weekdays)] : [startDate.getUTCDay()]
  if (!selectedDays.length || selectedDays.some((day) => day < 0 || day > 6)) return { error: "Hãy chọn ít nhất một ngày trong tuần." }

  const occurrences: Array<{ startTime: Date; endTime: Date }> = []
  for (let cursor = new Date(startDate); cursor <= repeatUntil; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (!selectedDays.includes(cursor.getUTCDay())) continue
    const startsAt = vietnamDateTime(cursor, data.startTime)
    const endsAt = vietnamDateTime(cursor, data.endTime)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return { error: "Giờ kết thúc phải sau giờ bắt đầu." }
    }
    occurrences.push({ startTime: startsAt, endTime: endsAt })
  }
  if (!occurrences.length) return { error: "Không có buổi tập nào trong khoảng ngày đã chọn." }

  const rangeStart = occurrences[0].startTime
  const rangeEnd = occurrences.at(-1)!.endTime
  const seriesId = occurrences.length > 1 ? randomUUID() : null
  const proposedValues = sql.join(
    occurrences.map((occurrence) => sql`(${occurrence.startTime}::timestamp, ${occurrence.endTime}::timestamp)`),
    sql`, `,
  )
  type ScheduleResultRow = {
    member_conflict_at: Date | string | null
    trainer_conflict_at: Date | string | null
    inserted_count: number
  }
  // One statement keeps the overlap checks and inserts atomic on Neon HTTP.
  // The two advisory locks serialize concurrent bookings for the PT/member.
  const inserted = await db.execute<ScheduleResultRow>(sql`
    with trainer_lock as materialized (
      select pg_advisory_xact_lock(20, ${data.trainerId})
    ), member_lock as materialized (
      select pg_advisory_xact_lock(21, ${data.memberId})
    ), proposed(start_time, end_time) as materialized (
      values ${proposedValues}
    ), existing as materialized (
      select s.trainer_id, s.member_id, s.start_time, s.end_time
      from pt_sessions s
      cross join trainer_lock
      cross join member_lock
      where s.status <> 'cancelled'
        and s.start_time < ${rangeEnd}
        and s.end_time > ${rangeStart}
        and (s.trainer_id = ${data.trainerId} or s.member_id = ${data.memberId})
    ), member_conflict as materialized (
      select p.start_time
      from proposed p
      where exists (
        select 1 from existing e
        where e.member_id = ${data.memberId}
          and e.start_time < p.end_time
          and e.end_time > p.start_time
      )
      order by p.start_time
      limit 1
    ), trainer_conflict as materialized (
      select p.start_time
      from proposed p
      where (
        select count(*) from existing e
        where e.trainer_id = ${data.trainerId}
          and e.start_time < p.end_time
          and e.end_time > p.start_time
      ) >= ${trainer.maxConcurrentClients}
      order by p.start_time
      limit 1
    ), inserted as (
      insert into pt_sessions (
        trainer_id, member_id, start_time, end_time, status, notes, series_id
      )
      select ${data.trainerId}, ${data.memberId}, p.start_time, p.end_time,
        'scheduled', ${data.notes?.trim() || null}, ${seriesId}
      from proposed p
      where not exists (select 1 from member_conflict)
        and not exists (select 1 from trainer_conflict)
      returning id
    )
    select
      (select start_time from member_conflict) as member_conflict_at,
      (select start_time from trainer_conflict) as trainer_conflict_at,
      (select count(*)::int from inserted) as inserted_count
  `)
  const row = inserted.rows[0]
  const formatConflict = (value: Date | string) => new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  })
  const result = row?.member_conflict_at
    ? { error: `Hội viên đã có lịch trùng vào ${formatConflict(row.member_conflict_at)}.` }
    : row?.trainer_conflict_at
      ? { error: `${trainer.fullName} đã đủ ${trainer.maxConcurrentClients} người trong khung ${formatConflict(row.trainer_conflict_at)}.` }
      : Number(row?.inserted_count || 0) === occurrences.length
        ? { success: true, count: occurrences.length }
        : { error: "Không thể tạo đủ lịch tập. Vui lòng thử lại." }
  revalidatePath("/schedule")
  if (result.success) await logAction("CREATE", "SESSION", seriesId || `${data.trainerId}:${data.memberId}`, { count: result.count })
  return result
}

export async function updatePTSessionStatus(id: number, status: string) {
  await requireUser()
  if (!["scheduled", "completed", "cancelled"].includes(status)) return { error: "Trạng thái không hợp lệ." }
  await db.update(ptSessions).set({ status }).where(eq(ptSessions.id, id))
  await logAction("UPDATE", "SESSION", id, { status })
  revalidatePath("/schedule")
  return { success: true }
}

export async function deletePTSession(id: number) {
  await requireUser()
  await db.delete(ptSessions).where(eq(ptSessions.id, id))
  await logAction("DELETE", "SESSION", id)
  revalidatePath("/schedule")
  return { success: true }
}
