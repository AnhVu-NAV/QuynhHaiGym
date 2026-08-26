import "server-only"

import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token"

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET phải có ít nhất 32 ký tự")
  }
  return secret
}

export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return verifySessionToken(token, getSessionSecret())
})

export const getCurrentUser = cache(async () => {
  const session = await getSession()
  if (!session) return null

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  })

  return user && !user.isLocked && user.sessionVersion === session.sessionVersion ? user : null
})

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== "admin") throw new Error("Bạn không có quyền quản trị")
  return user
}
