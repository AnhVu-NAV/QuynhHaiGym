"use server"

import { db } from "@/db"
import { auditLogs, classBookings, deviceCommands, deviceEvents, deviceMemberMappings, members, membershipPackages, ptSessions, subscriptions, transactions } from "@/db/schema"
import { and, eq, or, ilike, inArray, ne, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { v2 as cloudinary } from 'cloudinary'
import { logAction } from "./audit-actions"
import { queueMemberDeviceAccess } from "@/lib/member-device-access"
import { requireAdmin, requireUser } from "@/lib/auth"
import { normalizePagination } from "@/lib/pagination"
import { z } from "zod"
import { addCalendarMonthsClamped } from "@/lib/membership"

const memberCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  phoneNumber: z.string().trim().regex(/^0\d{8,10}$/),
  gender: z.enum(["male", "female", "other"]).optional(),
  avatarUrl: z.string().url().max(2048).optional().or(z.literal("")),
})

const memberUpdateSchema = memberCreateSchema.extend({
  status: z.enum(["active", "inactive"]),
})

const initialSubscriptionSchema = z.object({
  packageId: z.number().int().positive(),
  startDate: z.coerce.date(),
  paymentMethod: z.enum(["cash", "transfer"]),
  idempotencyKey: z.string().uuid(),
})

export async function getMembers(q?: string, page: number = 1, limit: number = 20, membership = "valid") {
  await requireUser()
  const pagination = normalizePagination(page, limit)
  page = pagination.page
  limit = pagination.limit
  const { offset } = pagination
  
  const searchClause = q
    ? or(
        ilike(members.fullName, `%${q}%`),
        ilike(members.phoneNumber, `%${q}%`)
      )
    : undefined
  // Keep explicit SQL aliases here. Drizzle's relational query builder aliases
  // the outer members table and otherwise rewrites interpolated subscription
  // columns to that outer alias inside this correlated subquery.
  const hasValidSubscription = sql<boolean>`exists (
    select 1
    from subscriptions as valid_subscription
    where valid_subscription.member_id = "members"."id"
      and valid_subscription.start_date <= now()
      and valid_subscription.end_date >= now()
      and valid_subscription.status = 'active'
  )`
  const membershipClause = membership === "expired"
    ? sql<boolean>`not (${hasValidSubscription})`
    : hasValidSubscription
  const baseWhereClause = and(ne(members.status, "deleted"), searchClause)
  const whereClause = and(baseWhereClause, membershipClause)

  const [data, [{ count }], [{ validCount }], [{ expiredCount }]] = await Promise.all([
    db.query.members.findMany({
      where: whereClause,
      orderBy: (member, { desc }) => [desc(member.createdAt)],
      limit,
      offset,
      with: {
        subscriptions: { with: { package: true } },
        deviceMappings: { with: { device: true } },
      },
    }),
    db.select({ count: sql<number>`count(*)` }).from(members).where(whereClause),
    db.select({ validCount: sql<number>`count(*)` }).from(members).where(and(baseWhereClause, hasValidSubscription)),
    db.select({ expiredCount: sql<number>`count(*)` }).from(members).where(and(baseWhereClause, sql<boolean>`not (${hasValidSubscription})`)),
  ])
  const totalPages = Math.ceil(Number(count) / limit)

  return {
    data,
    totalPages,
    totalItems: Number(count),
    counts: { valid: Number(validCount), expired: Number(expiredCount) },
  }
}

export async function createMember(data: {
  fullName: string
  phoneNumber: string
  gender?: string
  avatarUrl?: string
}, initialSubscription?: {
  packageId: number
  startDate: Date
  paymentMethod: string
  idempotencyKey: string
}) {
  await requireUser()
  data = memberCreateSchema.parse(data)
  const subscriptionInput = initialSubscription ? initialSubscriptionSchema.parse(initialSubscription) : null
  if (subscriptionInput) {
    const existing = await db.query.transactions.findFirst({
      where: eq(transactions.idempotencyKey, subscriptionInput.idempotencyKey),
    })
    if (existing) return { success: true, newMemberId: existing.memberId, duplicate: true }
  }
  const pkg = subscriptionInput ? await db.query.membershipPackages.findFirst({
    where: and(eq(membershipPackages.id, subscriptionInput.packageId), eq(membershipPackages.isActive, true)),
  }) : null
  if (subscriptionInput && !pkg) throw new Error("Gói tập không tồn tại hoặc đã ngừng bán")

  let result: { memberId: number; subscriptionId: number | null; transactionId: number | null }
  try {
    result = await db.transaction(async (tx) => {
    const [newMember] = await tx.insert(members).values({
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      gender: data.gender || null,
      avatarUrl: data.avatarUrl || null,
      status: "active",
    }).returning({ id: members.id })

    let subscriptionId: number | null = null
    let transactionId: number | null = null
    if (subscriptionInput && pkg) {
      const endDate = addCalendarMonthsClamped(subscriptionInput.startDate, pkg.durationMonths)
      const [subscription] = await tx.insert(subscriptions).values({
        memberId: newMember.id,
        packageId: pkg.id,
        startDate: subscriptionInput.startDate,
        endDate,
        status: "active",
      }).returning({ id: subscriptions.id })
      const [transaction] = await tx.insert(transactions).values({
        memberId: newMember.id,
        amount: pkg.price,
        type: "registration",
        paymentMethod: subscriptionInput.paymentMethod,
        description: `Đăng ký gói: ${pkg.name}`,
        idempotencyKey: subscriptionInput.idempotencyKey,
      }).returning({ id: transactions.id })
      subscriptionId = subscription.id
      transactionId = transaction.id
    }
      return { memberId: newMember.id, subscriptionId, transactionId }
    })
  } catch (error) {
    if (subscriptionInput) {
      const completed = await db.query.transactions.findFirst({
        where: eq(transactions.idempotencyKey, subscriptionInput.idempotencyKey),
      })
      if (completed) return { success: true, newMemberId: completed.memberId, duplicate: true }
    }
    throw error
  }
  
  await logAction("CREATE", "MEMBER", result.memberId, { fullName: data.fullName, phoneNumber: data.phoneNumber })
  if (result.subscriptionId && pkg) await logAction("CREATE", "SUBSCRIPTION", result.subscriptionId, { memberId: result.memberId, package: pkg.name })
  if (result.transactionId && pkg) await logAction("CREATE", "TRANSACTION", result.transactionId, { amount: pkg.price, method: subscriptionInput?.paymentMethod })
  
  revalidatePath("/members")
  revalidatePath("/")
  revalidatePath("/reports")
  return { success: true, newMemberId: result.memberId }
}

export async function updateMember(id: number, data: {
  fullName: string
  phoneNumber: string
  gender?: string
  status: string
  avatarUrl?: string
}) {
  await requireUser()
  data = memberUpdateSchema.parse(data)
  const [updated] = await db.update(members)
    .set({
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      gender: data.gender || null,
      status: data.status,
      avatarUrl: data.avatarUrl || null,
      updatedAt: new Date()
    })
    .where(and(eq(members.id, id), ne(members.status, "deleted")))
    .returning({ id: members.id })
  if (!updated) return { success: false, error: "Hội viên không tồn tại hoặc đã được xóa ẩn danh." }

  // Keep recognition enabled so inactive/expired attempts still reach server
  // authorization and are visible in the rejected check-in log.
  await queueMemberDeviceAccess(id, true)
    
  await logAction("UPDATE", "MEMBER", id, data)
  
  revalidatePath("/members")
  return { success: true }
}



cloudinary.config({ 
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

function getPublicIdFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url)
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "res.cloudinary.com" || !cloudName) return null
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean)
    if (pathParts[0] !== cloudName) return null
    const pathname = parsedUrl.pathname
    const uploadIndex = pathname.indexOf("/upload/")
    if (uploadIndex < 0) return null
    const afterUpload = pathname.slice(uploadIndex + "/upload/".length)
    const publicId = decodeURIComponent(afterUpload.replace(/^v\d+\//, "")).replace(/\.[^/.]+$/, "")
    return publicId.startsWith("gym-avatars/") ? publicId : null
  } catch {
    return null;
  }
}

function anonymizeAi26Payload(value: unknown, enrollIds: Set<number>): { value: unknown; matched: boolean } {
  if (Array.isArray(value)) {
    let matched = false
    const items = value.map((item) => {
      const result = anonymizeAi26Payload(item, enrollIds)
      matched ||= result.matched
      return result.value
    })
    return { value: items, matched }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const enrollId = Number(record.enrollid)
    if (Number.isInteger(enrollId) && enrollIds.has(enrollId)) {
      return { value: { anonymized: true, enrollid: enrollId }, matched: true }
    }
    let matched = false
    const entries = Object.entries(record).map(([key, child]) => {
      const result = anonymizeAi26Payload(child, enrollIds)
      matched ||= result.matched
      return [key, result.value]
    })
    return { value: Object.fromEntries(entries), matched }
  }
  return { value, matched: false }
}

export async function deleteMember(id: number) {
  await requireAdmin()
  const member = await db.query.members.findFirst({
    where: and(eq(members.id, id), ne(members.status, "deleted")),
    with: { deviceMappings: true },
  });
  if (!member) return { success: false, error: "Hội viên không tồn tại hoặc đã được xóa ẩn danh." }

  if (member?.avatarUrl) {
    try {
      const publicId = getPublicIdFromUrl(member.avatarUrl);
      if (publicId) {
        const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
        if (!["ok", "not found"].includes(result.result)) {
          return { success: false, error: "Không thể xóa ảnh đại diện. Hồ sơ chưa bị thay đổi." }
        }
      }
    } catch (error) {
      console.error("Failed to delete image from Cloudinary", error);
      return { success: false, error: "Không thể xóa ảnh đại diện. Hồ sơ chưa bị thay đổi." }
    }
  }

  const anonymousName = `Hội viên đã xóa #${id}`
  const anonymousPhone = `deleted-${id}`.slice(0, 20)
  const enrollIdsByDevice = new Map<number, Set<number>>()
  for (const mapping of member.deviceMappings) {
    const enrollIds = enrollIdsByDevice.get(mapping.deviceId) || new Set<number>()
    enrollIds.add(mapping.enrollId)
    enrollIdsByDevice.set(mapping.deviceId, enrollIds)
  }
  const deviceIds = [...enrollIdsByDevice.keys()]
  const relatedEvents = deviceIds.length ? await db.query.deviceEvents.findMany({
    where: inArray(deviceEvents.deviceId, deviceIds),
  }) : []
  const anonymizedEvents = relatedEvents.flatMap((event) => {
    const result = anonymizeAi26Payload(event.payload, enrollIdsByDevice.get(event.deviceId) || new Set())
    return result.matched ? [{ id: event.id, payload: result.value as Record<string, unknown> }] : []
  })

  await db.transaction(async (tx) => {
    await tx.update(subscriptions).set({ status: "cancelled" }).where(eq(subscriptions.memberId, id))
    await tx.update(ptSessions).set({ status: "cancelled", notes: null }).where(eq(ptSessions.memberId, id))
    await tx.update(classBookings).set({ status: "cancelled" }).where(eq(classBookings.memberId, id))

    // Remove commands containing the old name, then queue anonymous lock/delete
    // commands so an offline terminal is cleaned on its next connection.
    await tx.delete(deviceCommands).where(eq(deviceCommands.memberId, id))
    if (member.deviceMappings.length) {
      await tx.insert(deviceCommands).values(member.deviceMappings.flatMap((mapping) => [
        {
          deviceId: mapping.deviceId,
          memberId: id,
          command: "enableuser",
          payload: { cmd: "enableuser", enrollid: mapping.enrollId, enflag: 0 },
          status: "pending",
        },
        {
          deviceId: mapping.deviceId,
          memberId: id,
          command: "deleteuser",
          payload: { cmd: "deleteuser", enrollid: mapping.enrollId, backupnum: 13 },
          status: "pending",
        },
      ]))
      await tx.update(deviceMemberMappings).set({
        faceStatus: "pending_delete",
        accessEnabled: false,
        updatedAt: new Date(),
      }).where(eq(deviceMemberMappings.memberId, id))

      for (const event of anonymizedEvents) {
        await tx.update(deviceEvents).set({ payload: event.payload }).where(eq(deviceEvents.id, event.id))
      }
    }

    await tx.update(auditLogs).set({ details: JSON.stringify({ anonymized: true }) }).where(and(
      eq(auditLogs.entityType, "MEMBER"),
      eq(auditLogs.entityId, String(id)),
    ))
    await tx.update(members).set({
      fullName: anonymousName,
      phoneNumber: anonymousPhone,
      gender: null,
      birthDate: null,
      avatarUrl: null,
      status: "deleted",
      updatedAt: new Date(),
    }).where(eq(members.id, id))
  })

  await logAction("DELETE", "MEMBER", id, { anonymized: true })
  
  revalidatePath("/members")
  revalidatePath("/check-ins")
  revalidatePath("/schedule")
  revalidatePath("/reports")
  revalidatePath("/devices")
  revalidatePath("/")
  return { success: true, message: "Đã xóa ẩn danh hội viên và xếp lệnh xóa khuôn mặt AI26." }
}
