"use server"

import { and, asc, eq, gte, lte, ne } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { logAction } from "@/actions/audit-actions"
import { db } from "@/db"
import { memberPreservations, members, subscriptions } from "@/db/schema"
import { requireAdmin } from "@/lib/auth"
import { addHolidayPreservationDays } from "@/lib/membership"
import { queueMemberDeviceAccess } from "@/lib/member-device-access"
import { vietnamDateKey } from "@/lib/vietnam-time"

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const preservationSchema = z.object({
  memberId: z.number().int().positive(),
  startDate: dateOnly,
  endDate: dateOnly,
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().uuid(),
})

const DAY_MS = 86_400_000

function dayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS)
}

function databaseErrorCode(error: unknown) {
  let current = error
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current || typeof current !== "object") return ""
    if ("code" in current && typeof current.code === "string") return current.code
    current = "cause" in current ? current.cause : null
  }
  return ""
}

export async function preserveMemberMembership(input: {
  memberId: number
  startDate: string
  endDate: string
  reason: string
  idempotencyKey: string
}) {
  const admin = await requireAdmin()
  const parsed = preservationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Thông tin bảo lưu không hợp lệ." }
  const data = parsed.data

  const duplicate = await db.query.memberPreservations.findFirst({
    where: eq(memberPreservations.idempotencyKey, data.idempotencyKey),
  })
  if (duplicate) return { success: true, creditedDays: duplicate.creditedDays, duplicate: true }

  const firstDay = dayNumber(data.startDate)
  const lastDay = dayNumber(data.endDate)
  const creditedDays = lastDay - firstDay + 1
  if (creditedDays < 1 || creditedDays > 366) {
    return { success: false, error: "Mỗi lần bảo lưu phải từ 1 đến 366 ngày." }
  }
  if (data.startDate < vietnamDateKey()) {
    return { success: false, error: "Ngày bắt đầu bảo lưu không được nằm trong quá khứ." }
  }

  const member = await db.query.members.findFirst({
    where: and(eq(members.id, data.memberId), ne(members.status, "deleted")),
    columns: { id: true, fullName: true },
  })
  if (!member) return { success: false, error: "Không tìm thấy hội viên." }

  const [activeSubscriptions, overlap, holidays] = await Promise.all([
    db.query.subscriptions.findMany({
      where: and(eq(subscriptions.memberId, data.memberId), eq(subscriptions.status, "active")),
      orderBy: [asc(subscriptions.startDate)],
    }),
    db.query.memberPreservations.findFirst({
      where: and(
        eq(memberPreservations.memberId, data.memberId),
        eq(memberPreservations.status, "active"),
        lte(memberPreservations.startDate, data.endDate),
        gte(memberPreservations.endDate, data.startDate),
      ),
    }),
    db.query.gymHolidays.findMany({ columns: { startDate: true, endDate: true } }),
  ])
  if (overlap) {
    return { success: false, error: "Khoảng ngày này bị trùng với một lần bảo lưu đã có." }
  }

  const target = activeSubscriptions.find((subscription) => (
    vietnamDateKey(subscription.startDate) <= data.startDate
    && vietnamDateKey(subscription.endDate) >= data.endDate
  ))
  if (!target) {
    return { success: false, error: "Khoảng bảo lưu phải nằm trọn trong một gói đang còn hiệu lực." }
  }

  const affected = activeSubscriptions.filter((subscription) => (
    subscription.id === target.id
    || new Date(subscription.startDate).getTime() > new Date(target.startDate).getTime()
  ))
  const operations: BatchItem<"pg">[] = [
    db.insert(memberPreservations).values({
      memberId: data.memberId,
      subscriptionId: target.id,
      startDate: data.startDate,
      endDate: data.endDate,
      creditedDays,
      reason: data.reason,
      status: "active",
      createdBy: admin.id,
      idempotencyKey: data.idempotencyKey,
    }),
  ]

  for (const subscription of affected) {
    const isTarget = subscription.id === target.id
    const nextStart = isTarget ? new Date(subscription.startDate) : addDays(new Date(subscription.startDate), creditedDays)
    const nextBaseEnd = addDays(new Date(subscription.baseEndDate), creditedDays)
    const { endDate: nextEnd } = addHolidayPreservationDays(nextStart, nextBaseEnd, holidays)
    operations.push(
      db.update(subscriptions).set({
        startDate: nextStart,
        baseEndDate: nextBaseEnd,
        endDate: nextEnd,
      }).where(eq(subscriptions.id, subscription.id)),
    )
  }

  try {
    await db.batch(operations as [BatchItem<"pg">, ...BatchItem<"pg">[]])
  } catch (error) {
    const completed = await db.query.memberPreservations.findFirst({
      where: eq(memberPreservations.idempotencyKey, data.idempotencyKey),
    })
    if (completed) return { success: true, creditedDays: completed.creditedDays, duplicate: true }
    const code = databaseErrorCode(error)
    if (code === "23505") return { success: false, error: "Yêu cầu bảo lưu này đã được ghi nhận." }
    console.error("Preserve member membership failed", error)
    return { success: false, error: "Không thể bảo lưu lúc này. Dữ liệu chưa bị thay đổi." }
  }

  await logAction("CREATE", "SUBSCRIPTION", target.id, {
    memberId: member.id,
    memberName: member.fullName,
    preservation: { startDate: data.startDate, endDate: data.endDate, creditedDays, reason: data.reason },
  })
  // Keep the face enabled: server authorization is the source of truth and
  // will deny access only during the preservation date range.
  try {
    await queueMemberDeviceAccess(data.memberId, true)
  } catch (error) {
    // The preservation is already safely committed. Recognition remains
    // server-authorized, so a command-queue hiccup must not invite a retry
    // that could credit the membership twice.
    console.error("Unable to refresh AI26 access after preservation", error)
  }

  revalidatePath("/members")
  revalidatePath("/check-ins")
  revalidatePath("/reports")
  revalidatePath("/")
  return { success: true, creditedDays }
}
