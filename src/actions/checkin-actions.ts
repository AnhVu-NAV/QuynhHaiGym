"use server"

import { db } from "@/db"
import { members, subscriptions, checkIns, failedCheckIns } from "@/db/schema"
import { and, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { consumeRateLimit, getRequestIp } from "@/lib/rate-limit"
import { requireUser } from "@/lib/auth"
import { normalizePagination } from "@/lib/pagination"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh"

type CheckInFilters = {
  source?: "ai26" | "web"
  period?: "today" | "7d" | "30d"
}

function getVietnamDayStart(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ""

  return new Date(`${value("year")}-${value("month")}-${value("day")}T00:00:00+07:00`)
}

function getPeriodStart(period?: CheckInFilters["period"]) {
  if (!period) return undefined

  const start = getVietnamDayStart()
  const daysBack = period === "today" ? 0 : period === "7d" ? 6 : 29
  return new Date(start.getTime() - daysBack * 86_400_000)
}

export async function processCheckIn(rawIdentifier: string) {
  const identifier = rawIdentifier.trim().replace(/^gym:/i, "")
  if (!identifier || identifier.length > 64) {
    return { success: false, message: "Mã check-in không hợp lệ." }
  }

  const requestIp = await getRequestIp()
  const ipLimit = await consumeRateLimit("public-checkin-ip", requestIp, { limit: 60, windowSeconds: 60 })
  if (!ipLimit.allowed) {
    return { success: false, message: "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại." }
  }
  const memberLimit = await consumeRateLimit("public-checkin-member", identifier, { limit: 4, windowSeconds: 60 })
  if (!memberLimit.allowed) {
    return { success: false, message: "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại." }
  }

  // QR cards use an opaque token. Manual phone entry remains available at the
  // kiosk but is tightly rate-limited above.
  const member = await db.query.members.findFirst({
    where: and(
      ne(members.status, "deleted"),
      UUID_PATTERN.test(identifier)
        ? eq(members.publicToken, identifier)
        : eq(members.phoneNumber, identifier),
    )
  })

  if (!member) {
    return { success: false, message: "Không tìm thấy thẻ hội viên hợp lệ." }
  }

  // 2. Check an active subscription that is valid at this moment.
  const now = new Date()
  const activeSub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.memberId, member.id),
      eq(subscriptions.status, "active"),
      lte(subscriptions.startDate, now),
      gte(subscriptions.endDate, now)
    ),
    orderBy: [desc(subscriptions.endDate)]
  })

  if (!activeSub) {
    const message = "Gói tập của hội viên đã hết hạn. Vui lòng gia hạn gói."
    await db.insert(failedCheckIns).values({
      memberId: member.id,
      attemptedAt: now,
      source: "web",
      reason: member.status === "active" ? "subscription_expired" : "member_inactive",
      message,
    })
    revalidatePath("/")
    revalidatePath("/check-ins")
    return { 
      success: false, 
      message,
      member: { fullName: member.fullName },
    }
  }

  // 3. Log Check-in
  const duplicateWindow = new Date(now.getTime() - 30_000)
  const recentCheckIn = await db.query.checkIns.findFirst({
    where: and(eq(checkIns.memberId, member.id), gte(checkIns.checkInTime, duplicateWindow)),
    orderBy: [desc(checkIns.checkInTime)],
  })
  if (recentCheckIn) {
    return {
      success: true,
      message: "Hội viên đã check-in trong vài giây vừa qua.",
      member: { fullName: member.fullName },
    }
  }

  await db.insert(checkIns).values({
    memberId: member.id,
    checkInTime: new Date()
  })

  revalidatePath("/check-ins")
  return { 
    success: true, 
    message: "Check-in thành công!", 
    member: { fullName: member.fullName },
  }
}

export async function getRecentCheckIns(
  q?: string,
  page: number = 1,
  limit: number = 10,
  filters: CheckInFilters = {},
) {
  await requireUser()
  const pagination = normalizePagination(page, limit, 10)
  page = pagination.page
  limit = pagination.limit
  const { offset } = pagination

  const memberClause = and(
    ne(members.status, "deleted"),
    q ? or(ilike(members.fullName, `%${q}%`), ilike(members.phoneNumber, `%${q}%`)) : undefined,
  )
  const periodStart = getPeriodStart(filters.period)
  const whereClause = and(
    inArray(checkIns.memberId, db.select({ id: members.id }).from(members).where(memberClause)),
    filters.source ? eq(checkIns.source, filters.source) : undefined,
    periodStart ? gte(checkIns.checkInTime, periodStart) : undefined,
  )

  const [data, [{ count }]] = await Promise.all([
    db.query.checkIns.findMany({
      where: whereClause,
      orderBy: [desc(checkIns.checkInTime)],
      limit,
      offset,
      with: { member: true, device: true },
    }),
    db.select({ count: sql<number>`count(*)` }).from(checkIns).where(whereClause),
  ])
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}

export async function getMemberCheckIns(memberId: number) {
  await requireUser()
  const data = await db.query.checkIns.findMany({
    where: eq(checkIns.memberId, memberId),
    orderBy: [desc(checkIns.checkInTime)],
    limit: 50,
  })
  return data
}

export async function getRecentFailedCheckIns(
  q?: string,
  page: number = 1,
  limit: number = 10,
  filters: CheckInFilters = {},
) {
  await requireUser()
  const pagination = normalizePagination(page, limit, 10)
  page = pagination.page
  limit = pagination.limit
  const { offset } = pagination
  const visibleMemberIds = db.select({ id: members.id }).from(members).where(ne(members.status, "deleted"))
  const matchingMemberIds = db.select({ id: members.id }).from(members).where(and(
    ne(members.status, "deleted"),
    q ? or(ilike(members.fullName, `%${q}%`), ilike(members.phoneNumber, `%${q}%`)) : undefined,
  ))
  const periodStart = getPeriodStart(filters.period)
  const whereClause = and(
    or(isNull(failedCheckIns.memberId), inArray(failedCheckIns.memberId, visibleMemberIds)),
    q ? or(
      inArray(failedCheckIns.memberId, matchingMemberIds),
      ilike(failedCheckIns.reason, `%${q}%`),
      ilike(failedCheckIns.message, `%${q}%`),
    ) : undefined,
    filters.source ? eq(failedCheckIns.source, filters.source) : undefined,
    periodStart ? gte(failedCheckIns.attemptedAt, periodStart) : undefined,
  )

  const [data, [{ count }]] = await Promise.all([
    db.query.failedCheckIns.findMany({
      where: whereClause,
      orderBy: [desc(failedCheckIns.attemptedAt)],
      limit,
      offset,
      with: { member: true, device: true },
    }),
    db.select({ count: sql<number>`count(*)` }).from(failedCheckIns).where(whereClause),
  ])
  return {
    data,
    totalPages: Math.ceil(Number(count) / limit),
    totalItems: Number(count),
  }
}

export async function getCheckInSummary() {
  await requireUser()
  const today = getVietnamDayStart()
  const visibleMemberIds = db.select({ id: members.id }).from(members).where(ne(members.status, "deleted"))

  const [[valid], [failed]] = await Promise.all([
    db.select({
      total: sql<number>`count(*)::int`,
      uniqueMembers: sql<number>`count(distinct ${checkIns.memberId})::int`,
      ai26: sql<number>`count(*) filter (where ${checkIns.source} = 'ai26')::int`,
    })
      .from(checkIns)
      .where(and(gte(checkIns.checkInTime, today), inArray(checkIns.memberId, visibleMemberIds))),
    db.select({ total: sql<number>`count(*)::int` })
      .from(failedCheckIns)
      .where(and(
        gte(failedCheckIns.attemptedAt, today),
        or(isNull(failedCheckIns.memberId), inArray(failedCheckIns.memberId, visibleMemberIds)),
      )),
  ])

  return {
    validToday: Number(valid.total),
    uniqueMembersToday: Number(valid.uniqueMembers),
    ai26Today: Number(valid.ai26),
    failedToday: Number(failed.total),
  }
}
