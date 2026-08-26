"use server"

import { db } from "@/db"
import { subscriptions, transactions, membershipPackages, members } from "@/db/schema"
import { eq, and, gte, desc, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { logAction } from "./audit-actions"
import { queueMemberDeviceAccess } from "@/lib/member-device-access"
import { requireUser } from "@/lib/auth"
import { addCalendarMonthsClamped } from "@/lib/membership"
import { z } from "zod"

const subscriptionSchema = z.object({
  memberId: z.number().int().positive(),
  packageId: z.number().int().positive(),
  startDate: z.coerce.date(),
  paymentMethod: z.enum(["cash", "transfer"]),
  idempotencyKey: z.string().uuid(),
})

export async function registerSubscription(data: {
  memberId: number
  packageId: number
  startDate: Date
  paymentMethod: string
  idempotencyKey: string
}) {
  await requireUser()
  const parsed = subscriptionSchema.safeParse(data)
  if (!parsed.success) throw new Error("Thông tin đăng ký gói không hợp lệ")
  data = parsed.data

  const existingTransaction = await db.query.transactions.findFirst({
    where: eq(transactions.idempotencyKey, data.idempotencyKey),
  })
  if (existingTransaction) return { success: true, duplicate: true }

  // 1. Get package details
  const pkg = await db.query.membershipPackages.findFirst({
    where: and(eq(membershipPackages.id, data.packageId), eq(membershipPackages.isActive, true))
  })

  if (!pkg) throw new Error("Gói tập không tồn tại hoặc đã ngừng bán")

  const member = await db.query.members.findFirst({
    where: and(eq(members.id, data.memberId), ne(members.status, "deleted")),
  })
  if (!member) throw new Error("Hội viên không tồn tại hoặc đã ngừng hoạt động")

  const requestedStartDate = new Date(data.startDate)
  if (Number.isNaN(requestedStartDate.getTime())) {
    throw new Error("Ngày bắt đầu không hợp lệ")
  }

  const previousSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.memberId, data.memberId),
    orderBy: [desc(subscriptions.endDate)],
  })

  // Find current active subscription to stack dates
  const currentSubs = await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.memberId, data.memberId),
      eq(subscriptions.status, "active"),
      gte(subscriptions.endDate, new Date())
    ),
    orderBy: [desc(subscriptions.endDate)]
  });
  const currentSub = currentSubs[0];

  // Preserve paid days for a still-active member. For an expired member (or a
  // deliberately later renewal), the selected date is used exactly.
  const currentEndDate = currentSub ? new Date(currentSub.endDate) : null
  const actualStartDate = currentEndDate && requestedStartDate <= currentEndDate
    ? currentEndDate
    : requestedStartDate

  // 2. Calculate end date
  const endDate = addCalendarMonthsClamped(actualStartDate, pkg.durationMonths)

  // Neon HTTP supports atomic batch transactions rather than interactive
  // db.transaction callbacks. The unique idempotency key makes a retry safe.
  let result: { subscriptionId: number; transactionId: number }
  try {
    const [newSubs, newTransactions] = await db.batch([
      db.insert(subscriptions).values({
        memberId: data.memberId,
        packageId: data.packageId,
        startDate: actualStartDate,
        endDate,
        status: "active",
      }).returning({ id: subscriptions.id }),
      db.insert(transactions).values({
        memberId: data.memberId,
        amount: pkg.price,
        type: previousSub ? "renewal" : "registration",
        paymentMethod: data.paymentMethod,
        description: `${previousSub ? "Gia hạn" : "Đăng ký"} gói: ${pkg.name}`,
        transactionDate: new Date(),
        idempotencyKey: data.idempotencyKey,
      }).returning({ id: transactions.id }),
      db.update(members).set({ status: "active" }).where(eq(members.id, data.memberId)),
    ])
    const newSub = newSubs[0]
    const newTransaction = newTransactions[0]
    if (!newSub || !newTransaction) throw new Error("Không thể ghi nhận giao dịch gia hạn")
    result = { subscriptionId: newSub.id, transactionId: newTransaction.id }
  } catch (error) {
    // A simultaneous retry can lose the race after the pre-check above. The
    // database unique key is authoritative, so return the already completed
    // operation instead of charging or extending the member twice.
    const completed = await db.query.transactions.findFirst({
      where: eq(transactions.idempotencyKey, data.idempotencyKey),
    })
    if (completed) return { success: true, duplicate: true }
    throw error
  }

  await Promise.all([
    logAction("CREATE", "SUBSCRIPTION", result.subscriptionId, { memberId: data.memberId, package: pkg.name }),
    logAction("CREATE", "TRANSACTION", result.transactionId, { amount: pkg.price, method: data.paymentMethod }),
  ])

  // Renewal immediately re-enables every enrolled AI26 without asking the
  // member to register their face again.
  await queueMemberDeviceAccess(data.memberId, true)

  revalidatePath("/members")
  revalidatePath("/")
  revalidatePath("/reports")
  revalidatePath("/check-ins")
  return { success: true }
}
