"use server"

import { db } from "@/db"
import { classes, classSessions, classBookings } from "@/db/schema"
import { and, eq, desc, ilike, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getClasses(q?: string, page: number = 1, limit: number = 20, bypassPagination = false, status = "all") {
  const offset = bypassPagination ? undefined : (page - 1) * limit;

  const searchClause = q ? ilike(classes.name, `%${q}%`) : undefined;
  const statusClause = status === "active" ? eq(classes.isActive, true) : status === "inactive" ? eq(classes.isActive, false) : undefined;
  const whereClause = and(searchClause, statusClause);

  const dataQuery = db.query.classes.findMany({
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
    const data = await dataQuery
    return { data, totalPages: 1, totalItems: data.length };
  }

  const [data, [{ count }]] = await Promise.all([
    dataQuery,
    db.select({ count: sql<number>`count(*)` }).from(classes).where(whereClause),
  ])
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
