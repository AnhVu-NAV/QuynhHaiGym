"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { or, eq } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema"
import { verifyPassword } from "@/lib/password"
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
} from "@/lib/session-token"

export type LoginState = { error?: string } | undefined

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!identifier || !password) return { error: "Vui lòng nhập tài khoản và mật khẩu." }

  const user = await db.query.users.findFirst({
    where: or(eq(users.email, identifier), eq(users.username, identifier)),
  })

  if (!user || user.isLocked) {
    return { error: user?.isLocked ? "Tài khoản đã bị khóa." : "Tài khoản hoặc mật khẩu không đúng." }
  }

  const passwordValid = user.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : false

  if (!passwordValid) return { error: "Tài khoản hoặc mật khẩu không đúng." }

  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1000
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET phải có ít nhất 32 ký tự")

  const token = await createSessionToken({ userId: user.id, expiresAt }, secret)
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
    priority: "high",
  })
  redirect("/")
}

export async function logout() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/sign-in")
}
