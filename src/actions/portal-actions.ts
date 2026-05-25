"use server"

import { db } from "@/db"
import { members, subscriptions, ptSessions } from "@/db/schema"
import { eq, desc, and, gte } from "drizzle-orm"

export async function getMemberPortalData(phoneNumber: string) {
  const member = await db.query.members.findFirst({
    where: eq(members.phoneNumber, phoneNumber)
  })

  if (!member) return null

  // Get active subscription
  const subs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.memberId, member.id),
    with: { package: true },
    orderBy: [desc(subscriptions.endDate)]
  })

  const activeSub = subs.find(s => new Date(s.endDate).getTime() > new Date().getTime())

  // Get upcoming PT sessions
  const today = new Date()
  const ptSess = await db.query.ptSessions.findMany({
    where: and(
      eq(ptSessions.memberId, member.id),
      eq(ptSessions.status, "scheduled"),
      gte(ptSessions.startTime, today)
    ),
    with: { trainer: true },
    orderBy: [ptSessions.startTime],
    limit: 5
  })

  return {
    member,
    activeSub,
    ptSessions: ptSess
  }
}
