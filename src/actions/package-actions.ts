"use server"

import { db } from "@/db"
import { membershipPackages, subscriptions } from "@/db/schema"
import { and, eq, ilike, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin, requireUser } from "@/lib/auth"
import { normalizePagination } from "@/lib/pagination"
import { z } from "zod"

const packageSchema = z.object({
  name: z.string().trim().min(2).max(255),
  price: z.number().int().min(0).max(1_000_000_000),
  durationMonths: z.number().int().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean(),
})

export async function getPackages(q?: string, page: number = 1, limit: number = 20, status = "all") {
  await requireUser()
  const pagination = normalizePagination(page, limit)
  page = pagination.page
  limit = pagination.limit
  const { offset } = pagination

  const searchClause = q ? ilike(membershipPackages.name, `%${q}%`) : undefined;
  const statusClause = status === "active" ? eq(membershipPackages.isActive, true) : status === "inactive" ? eq(membershipPackages.isActive, false) : undefined;
  const whereClause = and(searchClause, statusClause);

  const [data, [{ count }]] = await Promise.all([
    db.query.membershipPackages.findMany({
      where: whereClause,
      orderBy: (packages, { desc }) => [desc(packages.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: sql<number>`count(*)` }).from(membershipPackages).where(whereClause),
  ])
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}

import { logAction } from "./audit-actions"

export async function createPackage(data: {
  name: string
  price: number
  durationMonths: number
  description?: string
  isActive: boolean
}) {
  await requireUser()
  data = packageSchema.parse(data)
  const [newPkg] = await db.insert(membershipPackages).values({
    name: data.name,
    price: data.price,
    durationMonths: data.durationMonths,
    description: data.description || null,
    isActive: data.isActive,
  }).returning({ id: membershipPackages.id })
  
  await logAction("CREATE", "PACKAGE", newPkg.id, { name: data.name, price: data.price })
  
  revalidatePath("/packages")
  return { success: true }
}

export async function updatePackage(id: number, data: {
  name: string
  price: number
  durationMonths: number
  description?: string
  isActive: boolean
}) {
  await requireUser()
  data = packageSchema.parse(data)
  await db.update(membershipPackages)
    .set({
      name: data.name,
      price: data.price,
      durationMonths: data.durationMonths,
      description: data.description || null,
      isActive: data.isActive,
    })
    .where(eq(membershipPackages.id, id))
    
  await logAction("UPDATE", "PACKAGE", id, data)
    
  revalidatePath("/packages")
  return { success: true }
}

export async function deletePackage(id: number) {
  await requireAdmin()
  z.number().int().positive().parse(id)
  const pkg = await db.query.membershipPackages.findFirst({ where: eq(membershipPackages.id, id) })
  const used = await db.query.subscriptions.findFirst({ where: eq(subscriptions.packageId, id) })
  if (used) {
    await db.update(membershipPackages).set({ isActive: false }).where(eq(membershipPackages.id, id))
    await logAction("UPDATE", "PACKAGE", id, { archived: true, name: pkg?.name })
    revalidatePath("/packages")
    return { success: true, archived: true, message: "Gói đã có lịch sử giao dịch nên được ngừng bán thay vì xóa." }
  }
  await db.delete(membershipPackages).where(eq(membershipPackages.id, id))
  
  await logAction("DELETE", "PACKAGE", id, { name: pkg?.name })
  
  revalidatePath("/packages")
  return { success: true }
}
