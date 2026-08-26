"use server"

import { db } from "@/db"
import { members, transactions, checkIns, subscriptions } from "@/db/schema"
import { eq, sql, gte, and, desc, inArray, lt, ne } from "drizzle-orm"
import { requireUser } from "@/lib/auth"

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh"

function getVietnamDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ""
  return { year: Number(value("year")), month: Number(value("month")), day: Number(value("day")) }
}

function vietnamBoundary(year: number, month: number, day = 1) {
  const normalized = new Date(Date.UTC(year, month - 1, day))
  return new Date(
    `${normalized.getUTCFullYear()}-${String(normalized.getUTCMonth() + 1).padStart(2, "0")}-${String(normalized.getUTCDate()).padStart(2, "0")}T00:00:00+07:00`
  )
}

export async function getDashboardStats() {
  await requireUser()
  const now = new Date()
  const { year, month, day } = getVietnamDateParts(now)
  const today = vietnamBoundary(year, month, day)
  const yesterday = vietnamBoundary(year, month, day - 1)
  const firstDayOfMonth = vietnamBoundary(year, month)
  const firstChartMonth = vietnamBoundary(year, month - 5)
  const chartMonth = sql<Date>`date_trunc('month', ${transactions.transactionDate} + interval '7 hours')`

  // These independent reads run together. Revenue for all six months is fetched
  // with one grouped query instead of one database round-trip per month.
  const [
    [{ count: totalMembers }],
    [{ count: newMembersThisMonth }],
    [{ count: todayCheckins }],
    [{ count: yesterdayCheckins }],
    [{ total: todayRevenue, count: todayTransactions }],
    recentTransactions,
    monthlyRows,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(members).where(ne(members.status, "deleted")),
    db.select({ count: sql<number>`count(*)::int` }).from(members).where(and(
      ne(members.status, "deleted"),
      gte(members.joinDate, firstDayOfMonth),
    )),
    db.select({ count: sql<number>`count(*)::int` })
      .from(checkIns)
      .where(and(
        gte(checkIns.checkInTime, today),
        inArray(checkIns.memberId, db.select({ id: members.id }).from(members).where(ne(members.status, "deleted"))),
      )),
    db.select({ count: sql<number>`count(*)::int` })
      .from(checkIns)
      .where(and(
        gte(checkIns.checkInTime, yesterday),
        lt(checkIns.checkInTime, today),
        inArray(checkIns.memberId, db.select({ id: members.id }).from(members).where(ne(members.status, "deleted"))),
      )),
    db.select({
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
      .from(transactions)
      .where(gte(transactions.transactionDate, today)),
    db.query.transactions.findMany({
      orderBy: (transaction, { desc: orderDesc }) => [orderDesc(transaction.transactionDate)],
      limit: 5,
      with: { member: true },
    }),
    db.select({
      month: chartMonth,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)::int`,
    })
      .from(transactions)
      .where(gte(transactions.transactionDate, firstChartMonth))
      .groupBy(chartMonth)
      .orderBy(chartMonth),
  ])

  const revenueByMonth = new Map(
    monthlyRows.map((row) => {
      const date = new Date(row.month)
      return [`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`, Number(row.total)] as const
    })
  )
  const chartData = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (5 - index), 1))
    const chartYear = date.getUTCFullYear()
    const chartMonthNumber = date.getUTCMonth() + 1
    return {
      name: `Thg ${chartMonthNumber}`,
      total: revenueByMonth.get(`${chartYear}-${chartMonthNumber}`) || 0,
    }
  })
  const monthlyRevenue = chartData.at(-1)?.total || 0
  const previousMonthRevenue = chartData.at(-2)?.total || 0
  const monthlyRevenueChange = previousMonthRevenue > 0
    ? Math.round(((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 1000) / 10
    : null

  return {
    totalMembers,
    newMembersThisMonth,
    monthlyRevenue,
    monthlyRevenueChange,
    todayRevenue,
    todayTransactions,
    todayCheckins,
    yesterdayCheckins,
    recentTransactions,
    chartData
  }
}

export async function getExpiringMembers() {
  await requireUser()
  const now = new Date()
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  // Load future active subscriptions so stacked renewals are considered. The
  // member is only warned when their furthest paid-through date is within 7 days.
  const expiringSubs = await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.status, "active"),
      gte(subscriptions.endDate, now),
      inArray(subscriptions.memberId, db.select({ id: members.id }).from(members).where(ne(members.status, "deleted")))
    ),
    orderBy: [desc(subscriptions.endDate)],
    with: {
      member: true,
      package: true
    }
  })

  // To avoid duplicate members (if they have multiple expiring subs), we can filter
  const uniqueMembers = new Map()
  expiringSubs.forEach(sub => {
    if (!uniqueMembers.has(sub.memberId)) {
      uniqueMembers.set(sub.memberId, sub)
    }
  })

  return Array.from(uniqueMembers.values()).filter(
    (sub) => new Date(sub.endDate) <= sevenDaysFromNow
  )
}

export async function getRepeatedExpiredScanMembers() {
  await requireUser()
  type RepeatedExpiredRow = {
    member_id: number
    full_name: string
    phone_number: string
    invalid_attempts: number
    last_attempt_at: Date | string
    expired_at: Date | string
  }

  // Aggregate inside PostgreSQL so Vercel never downloads thousands of logs or
  // every subscription merely to show this small dashboard alert.
  const result = await db.execute<RepeatedExpiredRow>(sql`
    with latest_subscription as (
      select member_id, max(end_date) as expired_at
      from subscriptions
      where status <> 'cancelled'
      group by member_id
    )
    select
      m.id as member_id,
      m.full_name,
      m.phone_number,
      count(f.id)::int as invalid_attempts,
      max(f.attempted_at) as last_attempt_at,
      latest.expired_at
    from failed_check_ins f
    join members m on m.id = f.member_id and m.status <> 'deleted'
    join latest_subscription latest on latest.member_id = f.member_id
    where f.source = 'ai26'
      and f.reason = 'subscription_expired'
      and latest.expired_at < now()
      and f.attempted_at > latest.expired_at
    group by m.id, m.full_name, m.phone_number, latest.expired_at
    having count(f.id) > 1
    order by max(f.attempted_at) desc
    limit 50
  `)

  return result.rows.map((row) => ({
    member: {
      id: Number(row.member_id),
      fullName: row.full_name,
      phoneNumber: row.phone_number,
    },
    invalidAttempts: Number(row.invalid_attempts),
    lastAttemptAt: new Date(row.last_attempt_at),
    expiredAt: new Date(row.expired_at),
  }))
}
