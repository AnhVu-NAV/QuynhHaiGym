"use server"

import { randomUUID } from "node:crypto"
import { db } from "@/db"
import { members, ptSessions, trainers } from "@/db/schema"
import { and, eq, gt, gte, ilike, inArray, lt, ne, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"

type CalendarFilters = {
  from: Date
  to: Date
  q?: string
  trainerId?: number
  status?: string
}

export async function getPTCalendarSessions({ from, to, q, trainerId, status }: CalendarFilters) {
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
  const trainer = await db.query.trainers.findFirst({ where: eq(trainers.id, data.trainerId) })
  const member = await db.query.members.findFirst({ where: eq(members.id, data.memberId) })
  if (!trainer?.isActive) return { error: "PT này đang ngừng hoạt động." }
  if (!member || member.status !== "active") return { error: "Hội viên không hoạt động hoặc không tồn tại." }

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
  const existing = await db.query.ptSessions.findMany({
    where: and(
      ne(ptSessions.status, "cancelled"),
      lt(ptSessions.startTime, rangeEnd),
      gt(ptSessions.endTime, rangeStart),
      or(eq(ptSessions.trainerId, data.trainerId), eq(ptSessions.memberId, data.memberId)),
    ),
  })

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

  const seriesId = occurrences.length > 1 ? randomUUID() : null
  await db.insert(ptSessions).values(occurrences.map((occurrence) => ({
    trainerId: data.trainerId,
    memberId: data.memberId,
    startTime: occurrence.startTime,
    endTime: occurrence.endTime,
    status: "scheduled",
    notes: data.notes?.trim() || null,
    seriesId,
  })))
  revalidatePath("/schedule")
  return { success: true, count: occurrences.length }
}

export async function updatePTSessionStatus(id: number, status: string) {
  if (!["scheduled", "completed", "cancelled"].includes(status)) return { error: "Trạng thái không hợp lệ." }
  await db.update(ptSessions).set({ status }).where(eq(ptSessions.id, id))
  revalidatePath("/schedule")
  return { success: true }
}

export async function deletePTSession(id: number) {
  await db.delete(ptSessions).where(eq(ptSessions.id, id))
  revalidatePath("/schedule")
  return { success: true }
}
