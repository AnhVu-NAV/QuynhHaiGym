"use server"

import { auth, clerkClient } from "@clerk/nextjs/server"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// Verify if the current user is an admin
async function requireAdmin() {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId)
  })

  if (!dbUser || dbUser.role !== "admin") {
    // Check fallback for root admin
    const { currentUser } = await import("@clerk/nextjs/server")
    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress || ""
    const allowedEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",") : []
    
    if (!allowedEmails.includes(email)) {
      throw new Error("Forbidden: Requires Admin role")
    }
  }

  return userId
}

import { or, ilike, sql } from "drizzle-orm"

export async function getInternalUsers(q?: string, page: number = 1, limit: number = 20) {
  await requireAdmin()
  const offset = (page - 1) * limit;

  const whereClause = q ? or(
    ilike(users.fullName, `%${q}%`),
    ilike(users.email, `%${q}%`)
  ) : undefined;
  
  const data = await db.query.users.findMany({
    where: whereClause,
    orderBy: (users, { desc }) => [desc(users.createdAt)],
    limit,
    offset
  })

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users).where(whereClause);
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}

export async function createInternalUser(formData: FormData) {
  await requireAdmin()
  
  const email = formData.get("email") as string
  const username = formData.get("username") as string
  const password = formData.get("password") as string
  const fullName = formData.get("fullName") as string
  const role = formData.get("role") as string

  if ((!email && !username) || !password || !fullName || !role) {
    throw new Error("Vui lòng điền đầy đủ thông tin (Email hoặc Username)")
  }

  try {
    // 1. Create user in Clerk
    const client = await clerkClient()
    const clerkParams: any = {
      password: password,
      firstName: fullName.split(" ")[0],
      lastName: fullName.split(" ").slice(1).join(" "),
      skipPasswordChecks: true,
      skipPasswordRequirement: false,
    }
    
    if (email) clerkParams.emailAddress = [email]
    if (username) clerkParams.username = username

    const newClerkUser = await client.users.createUser(clerkParams)

    // 2. Sync to Database
    await db.insert(users).values({
      id: newClerkUser.id,
      email: email || null,
      username: username || null,
      fullName: fullName,
      role: role,
    })

    revalidatePath("/users")
    return { success: true }
  } catch (error: any) {
    console.error("Error creating user:", error)
    return { error: error.errors?.[0]?.message || error.message || "Không thể tạo tài khoản" }
  }
}

export async function toggleUserLock(userId: string, currentlyLocked: boolean) {
  await requireAdmin()
  
  try {
    const client = await clerkClient()
    if (currentlyLocked) {
      await client.users.unbanUser(userId)
    } else {
      await client.users.banUser(userId)
    }
    
    revalidatePath("/users")
    return { success: true }
  } catch (error: any) {
    console.error("Error toggling lock:", error)
    return { error: "Không thể thay đổi trạng thái tài khoản" }
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  await requireAdmin()
  
  try {
    await db.update(users).set({ role: newRole }).where(eq(users.id, userId))
    revalidatePath("/users")
    return { success: true }
  } catch (error: any) {
    console.error("Error updating role:", error)
    return { error: "Không thể cập nhật quyền" }
  }
}
