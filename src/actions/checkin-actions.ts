"use server"

import { db } from "@/db"
import { members, subscriptions, checkIns, failedCheckIns } from "@/db/schema"
import { and, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function processCheckIn(phoneNumber: string) {
  // 1. Find member by phone
  const member = await db.query.members.findFirst({
    where: eq(members.phoneNumber, phoneNumber)
  })

  if (!member) {
    return { success: false, message: "Không tìm thấy hội viên với số điện thoại này." }
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
      member: member 
    }
  }

  // 3. Log Check-in
  await db.insert(checkIns).values({
    memberId: member.id,
    checkInTime: new Date()
  })

  revalidatePath("/check-ins")
  return { 
    success: true, 
    message: "Check-in thành công!", 
    member: member,
    subscription: activeSub
  }
}

export async function getRecentCheckIns(q?: string, page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;

  const memberClause = and(
    ne(members.status, "deleted"),
    q ? or(ilike(members.fullName, `%${q}%`), ilike(members.phoneNumber, `%${q}%`)) : undefined,
  )
  const whereClause = inArray(checkIns.memberId, db.select({ id: members.id }).from(members).where(memberClause))

  const [data, [{ count }]] = await Promise.all([
    db.query.checkIns.findMany({
      where: whereClause,
      orderBy: [desc(checkIns.checkInTime)],
      limit,
      offset,
      with: { member: true },
    }),
    db.select({ count: sql<number>`count(*)` }).from(checkIns).where(whereClause),
  ])
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}

export async function getMemberCheckIns(memberId: number) {
  const data = await db.query.checkIns.findMany({
    where: eq(checkIns.memberId, memberId),
    orderBy: [desc(checkIns.checkInTime)],
    limit: 50,
  })
  return data
}

export async function getRecentFailedCheckIns(q?: string, page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit
  const visibleMemberIds = db.select({ id: members.id }).from(members).where(ne(members.status, "deleted"))
  const matchingMemberIds = db.select({ id: members.id }).from(members).where(and(
    ne(members.status, "deleted"),
    q ? or(ilike(members.fullName, `%${q}%`), ilike(members.phoneNumber, `%${q}%`)) : undefined,
  ))
  const whereClause = and(
    or(isNull(failedCheckIns.memberId), inArray(failedCheckIns.memberId, visibleMemberIds)),
    q ? or(
      inArray(failedCheckIns.memberId, matchingMemberIds),
      ilike(failedCheckIns.reason, `%${q}%`),
      ilike(failedCheckIns.message, `%${q}%`),
    ) : undefined,
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
