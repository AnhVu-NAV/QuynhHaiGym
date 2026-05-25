"use server"

import { db } from "@/db"
import { ptSessions } from "@/db/schema"
import { inArray, sql, ilike, or, eq, desc } from "drizzle-orm"
import { members, trainers } from "@/db/schema"
import { revalidatePath } from "next/cache"

export async function getPTSessions(q?: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  let whereClause = undefined;
  if (q) {
    whereClause = or(
      inArray(ptSessions.memberId, db.select({ id: members.id }).from(members).where(ilike(members.fullName, `%${q}%`))),
      inArray(ptSessions.trainerId, db.select({ id: trainers.id }).from(trainers).where(ilike(trainers.fullName, `%${q}%`)))
    );
  }

  const data = await db.query.ptSessions.findMany({
    where: whereClause,
    orderBy: [desc(ptSessions.startTime)],
    limit,
    offset,
    with: {
      trainer: true,
      member: true
    }
  })

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(ptSessions).where(whereClause);
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}

export async function createPTSession(data: {
  trainerId: number
  memberId: number
  startTime: Date
  endTime: Date
  notes?: string
}) {
  await db.insert(ptSessions).values({
    ...data,
    status: "scheduled"
  })
  revalidatePath("/schedule")
}

export async function updatePTSessionStatus(id: number, status: string) {
  await db.update(ptSessions)
    .set({ status })
    .where(eq(ptSessions.id, id))
  revalidatePath("/schedule")
}

export async function deletePTSession(id: number) {
  await db.delete(ptSessions).where(eq(ptSessions.id, id))
  revalidatePath("/schedule")
}
