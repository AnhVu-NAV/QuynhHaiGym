"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { or, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema"
import { hashPassword, verifyPassword } from "@/lib/password"
import { requireUser } from "@/lib/auth"
import { clearRateLimit, consumeRateLimit, getRequestIp } from "@/lib/rate-limit"
import {
  createSessionToken,
  getSessionDurationSeconds,
  SESSION_COOKIE,
} from "@/lib/session-token"

export type LoginState = { error?: string } | undefined

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")

  if (!identifier || !password || identifier.length > 255 || password.length > 256) {
    return { error: "Vui lòng kiểm tra lại tài khoản và mật khẩu." }
  }

  const requestIp = await getRequestIp()
  const ipLimit = await consumeRateLimit("login-ip", requestIp, { limit: 30, windowSeconds: 15 * 60 })
  if (!ipLimit.allowed) {
    return { error: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ 15 phút rồi thử lại." }
  }
  const accountLimit = await consumeRateLimit("login-account", identifier, { limit: 10, windowSeconds: 15 * 60 })
  if (!accountLimit.allowed) {
    return { error: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ 15 phút rồi thử lại." }
  }

  const user = await db.query.users.findFirst({
    where: or(eq(users.email, identifier), eq(users.username, identifier)),
  })

  if (!user || user.isLocked) return { error: "Tài khoản hoặc mật khẩu không đúng." }

  const passwordValid = user.passwordHash
    ? await verifyPassword(password, user.passwordHash)
    : false

  if (!passwordValid) return { error: "Tài khoản hoặc mật khẩu không đúng." }

  await Promise.all([
    clearRateLimit("login-account", identifier),
    clearRateLimit("login-ip", requestIp),
  ])

  const sessionDurationSeconds = getSessionDurationSeconds(user.role)
  const expiresAt = Date.now() + sessionDurationSeconds * 1000
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET phải có ít nhất 32 ký tự")

  const token = await createSessionToken({ userId: user.id, sessionVersion: user.sessionVersion, expiresAt }, secret)
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionDurationSeconds,
    priority: "high",
  })
  redirect("/")
}

export async function logout() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/sign-in")
}

export async function refreshSession() {
  const user = await requireUser()
  const durationSeconds = getSessionDurationSeconds(user.role)
  const expiresAt = Date.now() + durationSeconds * 1000
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET phải có ít nhất 32 ký tự")

  const token = await createSessionToken({
    userId: user.id,
    sessionVersion: user.sessionVersion,
    expiresAt,
  }, secret)
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: durationSeconds,
    priority: "high",
  })
  return { success: true, expiresAt }
}

export async function changeOwnPassword(formData: FormData) {
  const user = await requireUser()
  const currentPassword = String(formData.get("currentPassword") ?? "")
  const newPassword = String(formData.get("newPassword") ?? "")
  const confirmation = String(formData.get("confirmation") ?? "")

  if (!user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return { error: "Mật khẩu hiện tại không đúng." }
  }
  if (newPassword.length < 12 || newPassword.length > 256 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return { error: "Mật khẩu mới cần ít nhất 12 ký tự, gồm cả chữ và số." }
  }
  if (newPassword !== confirmation) return { error: "Hai mật khẩu mới không khớp." }
  if (await verifyPassword(newPassword, user.passwordHash)) return { error: "Mật khẩu mới phải khác mật khẩu hiện tại." }

  await db.update(users).set({
    passwordHash: await hashPassword(newPassword),
    sessionVersion: sql`${users.sessionVersion} + 1`,
  }).where(eq(users.id, user.id))
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/sign-in?passwordChanged=1")
}
