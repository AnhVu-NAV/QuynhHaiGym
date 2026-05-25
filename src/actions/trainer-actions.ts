"use server"

import { db } from "@/db"
import { trainers } from "@/db/schema"
import { eq, ilike, sql, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getTrainers(q?: string, page: number = 1, limit: number = 20, bypassPagination = false) {
  const offset = bypassPagination ? undefined : (page - 1) * limit;

  const whereClause = q ? or(
    ilike(trainers.fullName, `%${q}%`),
    ilike(trainers.phoneNumber, `%${q}%`)
  ) : undefined;

  const data = await db.query.trainers.findMany({
    where: whereClause,
    orderBy: (trainers, { desc }) => [desc(trainers.createdAt)],
    limit: bypassPagination ? undefined : limit,
    offset
  })

  if (bypassPagination) {
    return { data, totalPages: 1, totalItems: data.length };
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(trainers).where(whereClause);
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}

export async function createTrainer(data: {
  fullName: string
  phoneNumber: string
  specialty?: string
  avatarUrl?: string
  isActive?: boolean
}) {
  await db.insert(trainers).values({
    ...data,
    isActive: data.isActive ?? true
  })
  revalidatePath("/trainers")
}

export async function updateTrainer(id: number, data: Partial<{
  fullName: string
  phoneNumber: string
  specialty: string
  avatarUrl: string
  isActive: boolean
}>) {
  await db.update(trainers).set(data).where(eq(trainers.id, id))
  revalidatePath("/trainers")
}

export async function deleteTrainer(id: number) {
  await db.delete(trainers).where(eq(trainers.id, id))
  revalidatePath("/trainers")
}
