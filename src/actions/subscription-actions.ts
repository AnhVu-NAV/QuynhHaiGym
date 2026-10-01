"use server"

import { db } from "@/db"
import { subscriptions, transactions, membershipPackages, members } from "@/db/schema"
import { eq, and, gte, desc, ne, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { logAction } from "./audit-actions"
import { queueMemberDeviceAccess } from "@/lib/member-device-access"
import { requireUser } from "@/lib/auth"
import { addCalendarMonthsClamped } from "@/lib/membership"
import { getHolidayAdjustedEndDate } from "@/lib/holiday-preservation"
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
  const user = await requireUser()
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
  const baseEndDate = addCalendarMonthsClamped(actualStartDate, pkg.durationMonths)
  const { endDate } = await getHolidayAdjustedEndDate(actualStartDate, baseEndDate)

  // A single CTE links the payment to the exact subscription atomically. This
  // is required for safe cancellation/refund and makes retries idempotent.
  let result: { subscriptionId: number; transactionId: number }
  try {
    type CreatedRow = { subscription_id: number; transaction_id: number }
    const created = await db.execute<CreatedRow>(sql`
      with new_subscription as (
        insert into subscriptions (member_id, package_id, start_date, base_end_date, end_date, status)
        values (${data.memberId}, ${data.packageId}, ${actualStartDate}, ${baseEndDate}, ${endDate}, 'active')
        returning id, member_id
      ), new_transaction as (
        insert into transactions (
          member_id, subscription_id, amount, type, direction, category, status,
          payment_method, description, transaction_date, idempotency_key, created_by
        )
        select member_id, id, ${pkg.price}, ${previousSub ? "renewal" : "registration"},
          'income', 'membership', 'posted', ${data.paymentMethod},
          ${`${previousSub ? "Gia hạn" : "Đăng ký"} gói: ${pkg.name}`}, now(), ${data.idempotencyKey}, ${user.id}
        from new_subscription
        returning id, subscription_id
      ), updated_member as (
        update members set status = 'active', updated_at = now()
        where id = ${data.memberId}
      )
      select new_subscription.id::int as subscription_id, new_transaction.id::int as transaction_id
      from new_subscription
      join new_transaction on new_transaction.subscription_id = new_subscription.id
    `)
    const row = created.rows[0]
    if (!row) throw new Error("Không thể ghi nhận giao dịch gia hạn")
    result = { subscriptionId: Number(row.subscription_id), transactionId: Number(row.transaction_id) }
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
