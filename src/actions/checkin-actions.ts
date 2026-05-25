"use server"

import { db } from "@/db"
import { members, subscriptions, checkIns } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function processCheckIn(phoneNumber: string) {
  // 1. Find member by phone
  const member = await db.query.members.findFirst({
    where: eq(members.phoneNumber, phoneNumber)
  })

  if (!member) {
    return { success: false, message: "Không tìm thấy hội viên với số điện thoại này." }
  }

  // 2. Check active subscription
  // In a real app we'd query subscriptions where endDate > now
  const subs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.memberId, member.id),
    orderBy: [desc(subscriptions.endDate)]
  })

  const activeSub = subs.find(s => new Date(s.endDate).getTime() > new Date().getTime())

  if (!activeSub) {
    return { 
      success: false, 
      message: "Gói tập của hội viên đã hết hạn. Vui lòng gia hạn gói.",
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

import { inArray, sql, ilike, or } from "drizzle-orm"

export async function getRecentCheckIns(q?: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  const whereClause = q 
    ? inArray(checkIns.memberId, db.select({ id: members.id }).from(members).where(
        or(ilike(members.fullName, `%${q}%`), ilike(members.phoneNumber, `%${q}%`))
      ))
    : undefined;

  const data = await db.query.checkIns.findMany({
    where: whereClause,
    orderBy: [desc(checkIns.checkInTime)],
    limit,
    offset,
    with: {
      member: true
    }
  })

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(checkIns).where(whereClause);
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
