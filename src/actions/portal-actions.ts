"use server"

import { db } from "@/db"
import { members, subscriptions, ptSessions } from "@/db/schema"
import { eq, desc, and, gte, lte } from "drizzle-orm"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function getMemberPortalData(publicToken: string) {
  if (!UUID_PATTERN.test(publicToken)) return null
  const member = await db.query.members.findFirst({
    where: and(eq(members.publicToken, publicToken), eq(members.status, "active"))
  })

  if (!member) return null

  // Get active subscription
  const subs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.memberId, member.id),
    with: { package: true },
    orderBy: [desc(subscriptions.endDate)]
  })

  const now = new Date()
  const activeSub = subs.find((subscription) => (
    subscription.status === "active"
    && new Date(subscription.startDate) <= now
    && new Date(subscription.endDate) >= now
  ))

  // Get upcoming PT sessions
  const ptSess = await db.query.ptSessions.findMany({
    where: and(
      eq(ptSessions.memberId, member.id),
      eq(ptSessions.status, "scheduled"),
      gte(ptSessions.startTime, now),
      lte(ptSessions.startTime, new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000))
    ),
    with: { trainer: true },
    orderBy: [ptSessions.startTime],
    limit: 5
  })

  return {
    member: {
      fullName: member.fullName,
      maskedPhone: member.phoneNumber.replace(/.(?=.{3})/g, "•"),
      avatarUrl: member.avatarUrl,
      publicToken: member.publicToken,
    },
    activeSub: activeSub ? {
      endDate: activeSub.endDate,
      package: { name: activeSub.package.name },
    } : null,
    ptSessions: ptSess.map((session) => ({
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      notes: session.notes,
      trainer: { fullName: session.trainer.fullName },
    })),
  }
}
