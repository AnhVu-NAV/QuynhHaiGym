import "server-only"

import { createHash } from "node:crypto"
import { headers } from "next/headers"
import { sql } from "drizzle-orm"
import { db } from "@/db"

type RateLimitOptions = {
  limit: number
  windowSeconds: number
}

type RateLimitRow = { count: number; expires_at: Date | string }

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export async function getRequestIp() {
  const requestHeaders = await headers()
  return (
    requestHeaders.get("x-vercel-forwarded-for")
    || requestHeaders.get("x-forwarded-for")?.split(",")[0]
    || requestHeaders.get("x-real-ip")
    || "unknown"
  ).trim().slice(0, 100)
}

export async function consumeRateLimit(
  namespace: string,
  discriminator: string,
  { limit, windowSeconds }: RateLimitOptions,
) {
  const key = digest(`${namespace}:${discriminator}`)
  const result = await db.execute<RateLimitRow>(sql`
    insert into rate_limits (key, count, window_started_at, expires_at)
    values (${key}, 1, now(), now() + (${windowSeconds} * interval '1 second'))
    on conflict (key) do update set
      count = case when rate_limits.expires_at <= now() then 1 else rate_limits.count + 1 end,
      window_started_at = case when rate_limits.expires_at <= now() then now() else rate_limits.window_started_at end,
      expires_at = case
        when rate_limits.expires_at <= now() then now() + (${windowSeconds} * interval '1 second')
        else rate_limits.expires_at
      end
    returning count, expires_at
  `)
  const row = result.rows[0]
  return {
    allowed: Boolean(row) && Number(row.count) <= limit,
    remaining: Math.max(0, limit - Number(row?.count || limit)),
    retryAfterSeconds: row
      ? Math.max(1, Math.ceil((new Date(row.expires_at).getTime() - Date.now()) / 1000))
      : windowSeconds,
  }
}

export async function clearRateLimit(namespace: string, discriminator: string) {
  const key = digest(`${namespace}:${discriminator}`)
  await db.execute(sql`delete from rate_limits where key = ${key}`)
}
