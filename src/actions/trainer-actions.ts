"use server"

import { db } from "@/db"
import { classes, ptSessions, trainers } from "@/db/schema"
import { and, eq, ilike, sql, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin, requireUser } from "@/lib/auth"
import { normalizePagination } from "@/lib/pagination"
import { z } from "zod"
import { logAction } from "./audit-actions"

const trainerSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  phoneNumber: z.string().trim().regex(/^0\d{8,10}$/),
  specialty: z.string().trim().max(255).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  employmentType: z.enum(["full_time", "part_time", "contractor"]).optional(),
  maxConcurrentClients: z.number().int().min(1).max(20).optional(),
  avatarUrl: z.string().url().max(2048).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
})

export async function getTrainers(q?: string, page: number = 1, limit: number = 20, bypassPagination = false, status = "all") {
  await requireUser()
  const pagination = normalizePagination(page, limit)
  page = pagination.page
  limit = pagination.limit
  const offset = bypassPagination ? undefined : pagination.offset

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
  await requireUser()
  data = trainerSchema.parse(data)
  const [trainer] = await db.insert(trainers).values({
    ...data,
    email: data.email || null,
    employmentType: data.employmentType || "full_time",
    maxConcurrentClients: Math.min(20, Math.max(1, data.maxConcurrentClients || 1)),
    isActive: data.isActive ?? true
  }).returning({ id: trainers.id })
  await logAction("CREATE", "TRAINER", trainer.id, { fullName: data.fullName })
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
  await requireUser()
  data = trainerSchema.partial().parse(data)
  await db.update(trainers).set({
    ...data,
    ...(data.maxConcurrentClients !== undefined ? { maxConcurrentClients: Math.min(20, Math.max(1, data.maxConcurrentClients)) } : {}),
  }).where(eq(trainers.id, id))
  await logAction("UPDATE", "TRAINER", id, { fields: Object.keys(data) })
  revalidatePath("/trainers")
}

export async function deleteTrainer(id: number) {
  await requireAdmin()
  z.number().int().positive().parse(id)
  const trainer = await db.query.trainers.findFirst({ where: eq(trainers.id, id) })
  const [session, assignedClass] = await Promise.all([
    db.query.ptSessions.findFirst({ where: eq(ptSessions.trainerId, id) }),
    db.query.classes.findFirst({ where: eq(classes.trainerId, id) }),
  ])
  if (session || assignedClass) {
    await db.update(trainers).set({ isActive: false }).where(eq(trainers.id, id))
    await logAction("UPDATE", "TRAINER", id, { archived: true, fullName: trainer?.fullName })
    revalidatePath("/trainers")
    return { success: true, archived: true, message: "PT đã có lịch sử nên được ngừng hoạt động thay vì xóa." }
  }
  await db.delete(trainers).where(eq(trainers.id, id))
  await logAction("DELETE", "TRAINER", id, { fullName: trainer?.fullName })
  revalidatePath("/trainers")
}
