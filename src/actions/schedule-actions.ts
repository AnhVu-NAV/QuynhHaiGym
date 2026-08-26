"use server"

import { randomUUID } from "node:crypto"
import { db } from "@/db"
import { members, ptSessions, subscriptions, trainers } from "@/db/schema"
import { and, eq, gt, gte, ilike, inArray, lt, lte, ne, or } from "drizzle-orm"
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
  const result = await db.transaction(async (tx) => {
    // Serialize bookings for this trainer/member pair so two receptionists
    // cannot both pass the availability check at the same time.
    await tx.execute(sql`select pg_advisory_xact_lock(20, ${data.trainerId})`)
    await tx.execute(sql`select pg_advisory_xact_lock(21, ${data.memberId})`)

    const existing = await tx.select().from(ptSessions).where(and(
      ne(ptSessions.status, "cancelled"),
      lt(ptSessions.startTime, rangeEnd),
      gt(ptSessions.endTime, rangeStart),
      or(eq(ptSessions.trainerId, data.trainerId), eq(ptSessions.memberId, data.memberId)),
    ))

    for (const occurrence of occurrences) {
      if (existing.some((session) => session.memberId === data.memberId && session.startTime < occurrence.endTime && session.endTime > occurrence.startTime)) {
        return { error: `Hội viên đã có lịch trùng vào ${occurrence.startTime.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.` }
      }
      const trainerLoad = existing.filter((session) =>
        session.trainerId === data.trainerId && session.startTime < occurrence.endTime && session.endTime > occurrence.startTime
      ).length
      if (trainerLoad >= trainer.maxConcurrentClients) {
        return { error: `${trainer.fullName} đã đủ ${trainer.maxConcurrentClients} người trong khung ${occurrence.startTime.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.` }
      }
    }

    await tx.insert(ptSessions).values(occurrences.map((occurrence) => ({
      trainerId: data.trainerId,
      memberId: data.memberId,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
      status: "scheduled",
      notes: data.notes?.trim() || null,
      seriesId,
    })))
    return { success: true, count: occurrences.length }
  })
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
