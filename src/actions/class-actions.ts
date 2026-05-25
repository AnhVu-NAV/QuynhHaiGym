"use server"

import { db } from "@/db"
import { classes, classSessions, classBookings } from "@/db/schema"
import { eq, desc, ilike, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getClasses(q?: string, page: number = 1, limit: number = 20, bypassPagination = false) {
  const offset = bypassPagination ? undefined : (page - 1) * limit;

  const whereClause = q ? ilike(classes.name, `%${q}%`) : undefined;

  const data = await db.query.classes.findMany({
    where: whereClause,
    orderBy: [desc(classes.createdAt)],
    limit: bypassPagination ? undefined : limit,
    offset,
    with: {
      trainer: true,
      sessions: {
        with: {
          bookings: true
        }
      }
    }
  })

  if (bypassPagination) {
    return { data, totalPages: 1, totalItems: data.length };
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(classes).where(whereClause);
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}

export async function createClass(data: {
  name: string
  description?: string
  trainerId?: number
  capacity: number
  isActive?: boolean
}) {
  await db.insert(classes).values({
    ...data,
    isActive: data.isActive ?? true
  })
  revalidatePath("/classes")
}

export async function createClassSession(data: {
  classId: number
  startTime: Date
  endTime: Date
}) {
  await db.insert(classSessions).values({
    ...data,
    status: "scheduled"
  })
  revalidatePath("/classes")
}

export async function bookClassSession(sessionId: number, memberId: number) {
  // We should ideally check capacity here
  await db.insert(classBookings).values({
    sessionId,
    memberId,
    status: "booked"
  })
  revalidatePath("/classes")
}
