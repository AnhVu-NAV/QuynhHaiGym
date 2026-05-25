"use server"

import { db } from "@/db"
import { membershipPackages } from "@/db/schema"
import { eq, ilike, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getPackages(q?: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  const whereClause = q ? ilike(membershipPackages.name, `%${q}%`) : undefined;

  const data = await db.query.membershipPackages.findMany({
    where: whereClause,
    orderBy: (packages, { desc }) => [desc(packages.createdAt)],
    limit,
    offset
  })

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(membershipPackages).where(whereClause);
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
  const pkg = await db.query.membershipPackages.findFirst({ where: eq(membershipPackages.id, id) })
  await db.delete(membershipPackages).where(eq(membershipPackages.id, id))
  
  await logAction("DELETE", "PACKAGE", id, { name: pkg?.name })
  
  revalidatePath("/packages")
  return { success: true }
}
