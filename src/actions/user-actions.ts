"use server"

import { randomUUID } from "node:crypto"
import { db } from "@/db"
import { users } from "@/db/schema"
import { and, eq, or, ilike, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { hashPassword } from "@/lib/password"
import { logAction } from "./audit-actions"
import { normalizePagination } from "@/lib/pagination"

export async function getInternalUsers(q?: string, page = 1, limit = 20, role = "all", status = "all") {
  await requireAdmin()
  const pagination = normalizePagination(page, limit)
  page = pagination.page
  limit = pagination.limit
  const { offset } = pagination
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

  if (
    (!email && !username)
    || email.length > 255
    || username.length > 255
    || fullName.length < 2
    || fullName.length > 255
    || password.length < 12
    || password.length > 256
    || !/[A-Za-z]/.test(password)
    || !/\d/.test(password)
    || !["admin", "staff"].includes(role)
    || (phoneNumber && !/^0\d{8,10}$/.test(phoneNumber))
  ) {
    return { error: "Thông tin chưa hợp lệ; mật khẩu cần ít nhất 12 ký tự, gồm chữ và số." }
  }

  try {
    const [created] = await db.insert(users).values({
      id: randomUUID(),
      email: email || null,
      username: username || null,
      passwordHash: await hashPassword(password),
      fullName,
      phoneNumber: phoneNumber || null,
      jobTitle: jobTitle || null,
      role,
    }).returning({ id: users.id })
    await logAction("CREATE", "USER", created.id, { role, fullName })
    revalidatePath("/users")
    return { success: true }
  } catch (error) {
    console.error("Error creating user:", error)
    return { error: "Email hoặc tên đăng nhập đã được sử dụng." }
  }
}

export async function toggleUserLock(userId: string, currentlyLocked: boolean) {
  void currentlyLocked
  const admin = await requireAdmin()
  if (admin.id === userId) return { error: "Bạn không thể tự khóa tài khoản đang đăng nhập." }

  try {
    const target = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!target) return { error: "Tài khoản không tồn tại." }
    const nextLocked = !target.isLocked
    if (nextLocked && target.role === "admin") {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(
        eq(users.role, "admin"),
        eq(users.isLocked, false),
      ))
      if (Number(count) <= 1) return { error: "Hệ thống phải còn ít nhất một quản trị viên hoạt động." }
    }
    await db.update(users).set({
      isLocked: nextLocked,
      sessionVersion: sql`${users.sessionVersion} + 1`,
    }).where(eq(users.id, userId))
    await logAction("UPDATE", "USER", userId, { isLocked: nextLocked })
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
    const target = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!target) return { error: "Tài khoản không tồn tại." }
    if (target.role === "admin" && newRole === "staff" && !target.isLocked) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(
        eq(users.role, "admin"),
        eq(users.isLocked, false),
      ))
      if (Number(count) <= 1) return { error: "Hệ thống phải còn ít nhất một quản trị viên hoạt động." }
    }
    await db.update(users).set({
      role: newRole,
      sessionVersion: sql`${users.sessionVersion} + 1`,
    }).where(eq(users.id, userId))
    await logAction("UPDATE", "USER", userId, { role: newRole })
    revalidatePath("/users")
    return { success: true }
  } catch (error) {
    console.error("Error updating role:", error)
    return { error: "Không thể cập nhật quyền." }
  }
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const admin = await requireAdmin()
  if (!userId || userId.length > 255) return { error: "Tài khoản không hợp lệ." }
  if (newPassword.length < 12 || newPassword.length > 256 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return { error: "Mật khẩu cần ít nhất 12 ký tự, gồm chữ và số." }
  }

  const [updated] = await db.update(users).set({
    passwordHash: await hashPassword(newPassword),
    sessionVersion: sql`${users.sessionVersion} + 1`,
  }).where(eq(users.id, userId)).returning({ id: users.id })
  if (!updated) return { error: "Tài khoản không tồn tại." }
  await logAction("UPDATE", "USER", userId, { passwordResetBy: admin.id })
  return { success: true }
}
