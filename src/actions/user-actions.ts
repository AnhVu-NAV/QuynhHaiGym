"use server"

import { randomUUID } from "node:crypto"
import { db } from "@/db"
import { users } from "@/db/schema"
import { and, eq, or, ilike, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { hashPassword } from "@/lib/password"

export async function getInternalUsers(q?: string, page = 1, limit = 20, role = "all", status = "all") {
  await requireAdmin()
  const offset = (page - 1) * limit
  const searchClause = q ? or(
    ilike(users.fullName, `%${q}%`),
    ilike(users.email, `%${q}%`),
    ilike(users.username, `%${q}%`),
    ilike(users.phoneNumber, `%${q}%`),
    ilike(users.jobTitle, `%${q}%`),
  ) : undefined
  const roleClause = role === "admin" || role === "staff" ? eq(users.role, role) : undefined
  const statusClause = status === "active" ? eq(users.isLocked, false) : status === "locked" ? eq(users.isLocked, true) : undefined
  const whereClause = and(searchClause, roleClause, statusClause)

  const [data, [{ count }]] = await Promise.all([
    db.query.users.findMany({
      where: whereClause,
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: sql<number>`count(*)` }).from(users).where(whereClause),
  ])
  return {
    data: data.map(({ passwordHash, ...user }) => {
      void passwordHash
      return user
    }),
    totalPages: Math.ceil(Number(count) / limit),
    totalItems: Number(count),
  }
}

export async function createInternalUser(formData: FormData) {
  await requireAdmin()

  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const username = String(formData.get("username") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const fullName = String(formData.get("fullName") ?? "").trim()
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim()
  const jobTitle = String(formData.get("jobTitle") ?? "").trim()
  const role = String(formData.get("role") ?? "")

  if ((!email && !username) || password.length < 8 || !fullName || !["admin", "staff"].includes(role)) {
    return { error: "Vui lòng nhập đủ thông tin; mật khẩu cần ít nhất 8 ký tự." }
  }

  try {
    await db.insert(users).values({
      id: randomUUID(),
      email: email || null,
      username: username || null,
      passwordHash: await hashPassword(password),
      fullName,
      phoneNumber: phoneNumber || null,
      jobTitle: jobTitle || null,
      role,
    })
    revalidatePath("/users")
    return { success: true }
  } catch (error) {
    console.error("Error creating user:", error)
    return { error: "Email hoặc tên đăng nhập đã được sử dụng." }
  }
}

export async function toggleUserLock(userId: string, currentlyLocked: boolean) {
  const admin = await requireAdmin()
  if (admin.id === userId) return { error: "Bạn không thể tự khóa tài khoản đang đăng nhập." }

  try {
    await db.update(users).set({ isLocked: !currentlyLocked }).where(eq(users.id, userId))
    revalidatePath("/users")
    return { success: true }
  } catch (error) {
    console.error("Error toggling lock:", error)
    return { error: "Không thể thay đổi trạng thái tài khoản." }
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  const admin = await requireAdmin()
  if (!["admin", "staff"].includes(newRole)) return { error: "Quyền không hợp lệ." }
  if (admin.id === userId) return { error: "Bạn không thể tự thay đổi quyền của mình." }

  try {
    await db.update(users).set({ role: newRole }).where(eq(users.id, userId))
    revalidatePath("/users")
    return { success: true }
  } catch (error) {
    console.error("Error updating role:", error)
    return { error: "Không thể cập nhật quyền." }
  }
}
