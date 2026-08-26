"use server"

import { db } from "@/db"
import { trainers } from "@/db/schema"
import { and, eq, ilike, sql, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getTrainers(q?: string, page: number = 1, limit: number = 20, bypassPagination = false, status = "all") {
  const offset = bypassPagination ? undefined : (page - 1) * limit;

  const searchClause = q ? or(
    ilike(trainers.fullName, `%${q}%`),
    ilike(trainers.phoneNumber, `%${q}%`),
    ilike(trainers.email, `%${q}%`),
    ilike(trainers.specialty, `%${q}%`)
  ) : undefined;
  const statusClause = status === "active"
    ? eq(trainers.isActive, true)
    : status === "inactive"
      ? eq(trainers.isActive, false)
      : undefined
  const whereClause = searchClause && statusClause
    ? and(searchClause, statusClause)
    : searchClause || statusClause

  const dataQuery = db.query.trainers.findMany({
    where: whereClause,
    orderBy: (trainers, { desc }) => [desc(trainers.createdAt)],
    limit: bypassPagination ? undefined : limit,
    offset
  })

  if (bypassPagination) {
    const data = await dataQuery
    return { data, totalPages: 1, totalItems: data.length };
  }

  const [data, [{ count }]] = await Promise.all([
    dataQuery,
    db.select({ count: sql<number>`count(*)` }).from(trainers).where(whereClause),
  ])
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}

export async function createTrainer(data: {
  fullName: string
  phoneNumber: string
  specialty?: string
  email?: string
  employmentType?: string
  maxConcurrentClients?: number
  avatarUrl?: string
  isActive?: boolean
}) {
  await db.insert(trainers).values({
    ...data,
    email: data.email || null,
    employmentType: data.employmentType || "full_time",
    maxConcurrentClients: Math.min(20, Math.max(1, data.maxConcurrentClients || 1)),
    isActive: data.isActive ?? true
  })
  revalidatePath("/trainers")
}

export async function updateTrainer(id: number, data: Partial<{
  fullName: string
  phoneNumber: string
  specialty: string
  email: string
  employmentType: string
  maxConcurrentClients: number
  avatarUrl: string
  isActive: boolean
}>) {
  await db.update(trainers).set({
    ...data,
    ...(data.maxConcurrentClients !== undefined ? { maxConcurrentClients: Math.min(20, Math.max(1, data.maxConcurrentClients)) } : {}),
  }).where(eq(trainers.id, id))
  revalidatePath("/trainers")
}

export async function deleteTrainer(id: number) {
  await db.delete(trainers).where(eq(trainers.id, id))
  revalidatePath("/trainers")
}
