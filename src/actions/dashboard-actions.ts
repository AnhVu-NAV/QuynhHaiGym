"use server"

import { db } from "@/db"
import { members, transactions, checkIns, subscriptions } from "@/db/schema"
import { eq, sql, gte, and, desc } from "drizzle-orm"

export async function getDashboardStats() {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // 1. Total Members
  const totalMembersRes = await db.select({ count: sql<number>`count(*)` }).from(members)
  const totalMembers = totalMembersRes[0].count

  // 2. Active Members
  const activeMembersRes = await db.select({ count: sql<number>`count(*)` })
    .from(members)
    .where(eq(members.status, 'active'))
  const activeMembers = activeMembersRes[0].count

  // 3. This Month Revenue
  const revenueRes = await db.select({ total: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(gte(transactions.transactionDate, firstDayOfMonth))
  const monthlyRevenue = revenueRes[0].total || 0

  // 4. Today Check-ins
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayCheckinsRes = await db.select({ count: sql<number>`count(*)` })
    .from(checkIns)
    .where(gte(checkIns.checkInTime, today))
  const todayCheckins = todayCheckinsRes[0].count

  // 5. Recent Transactions
  const recentTransactions = await db.query.transactions.findMany({
    orderBy: (transactions, { desc }) => [desc(transactions.transactionDate)],
    limit: 5,
    with: {
      member: true
    }
  })

  // 6. Revenue Chart Data (Last 6 Months Real Data)
  const chartData = []
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    
    const monthRes = await db.select({ total: sql<number>`sum(${transactions.amount})` })
      .from(transactions)
      .where(
        sql`${transactions.transactionDate} >= ${d} AND ${transactions.transactionDate} < ${nextMonth}`
      )
    
    chartData.push({
      name: `Thg ${d.getMonth() + 1}`,
      total: Number(monthRes[0].total) || 0
    })
  }

  return {
    totalMembers,
    activeMembers,
    monthlyRevenue,
    todayCheckins,
    recentTransactions,
    chartData
  }
}

export async function getExpiringMembers() {
  const now = new Date()
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  // Query active subscriptions that are ending within the next 7 days or ended recently
  const expiringSubs = await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.status, "active"),
      sql`${subscriptions.endDate} <= ${sevenDaysFromNow}`
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

  return Array.from(uniqueMembers.values())
}
