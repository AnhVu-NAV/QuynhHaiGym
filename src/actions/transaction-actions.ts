"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm"
import { db } from "@/db"
import { members, transactions } from "@/db/schema"
import { requireAdmin, requireUser } from "@/lib/auth"
import { resolveDateRange } from "@/lib/date-range"
import { normalizePagination } from "@/lib/pagination"
import { queueMemberDeviceAccess } from "@/lib/member-device-access"
import { logAction } from "./audit-actions"

const CASHFLOW_CATEGORIES = ["membership", "refund", "rent", "utilities", "salary", "equipment", "other"] as const
const manualEntrySchema = z.object({
  direction: z.enum(["income", "expense"]),
  category: z.enum(CASHFLOW_CATEGORIES).refine((value) => value !== "membership" && value !== "refund"),
  amount: z.number().int().positive().max(2_000_000_000),
  paymentMethod: z.enum(["cash", "transfer"]),
  description: z.string().trim().min(2).max(500),
  note: z.string().trim().max(1000).optional(),
  transactionDate: z.coerce.date(),
  idempotencyKey: z.string().uuid(),
})

const refundSchema = z.object({
  transactionId: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
  paymentMethod: z.enum(["cash", "transfer"]),
})

export type TransactionFilters = {
  paymentMethod?: string
  direction?: string
  category?: string
  period?: string
  from?: string
  to?: string
}

function buildTransactionWhere(q: string | undefined, filters: TransactionFilters) {
  let searchClause
  if (q) {
    const qNum = Number.parseInt(q, 10)
    const conditions = [
      inArray(
        transactions.memberId,
        db.select({ id: members.id }).from(members).where(
          or(ilike(members.fullName, `%${q}%`), ilike(members.phoneNumber, `%${q}%`))
        )
      ),
      ilike(transactions.description, `%${q}%`),
    ]
    if (!Number.isNaN(qNum)) conditions.push(eq(transactions.id, qNum))
    searchClause = or(...conditions)
  }

  const { start, end } = resolveDateRange(filters.period, filters.from, filters.to)
  return and(
    searchClause,
    filters.paymentMethod === "cash" || filters.paymentMethod === "transfer"
      ? eq(transactions.paymentMethod, filters.paymentMethod)
      : undefined,
    filters.direction === "income" || filters.direction === "expense"
      ? eq(transactions.direction, filters.direction)
      : undefined,
    CASHFLOW_CATEGORIES.includes(filters.category as (typeof CASHFLOW_CATEGORIES)[number])
      ? eq(transactions.category, filters.category!)
      : undefined,
    start ? gte(transactions.transactionDate, start) : undefined,
    end ? lt(transactions.transactionDate, end) : undefined,
    eq(transactions.status, "posted")
  )
}

export async function getTransactions(q?: string, page = 1, limit = 10, filters: TransactionFilters = {}) {
  await requireUser()
  const pagination = normalizePagination(page, limit)
  const whereClause = buildTransactionWhere(q, filters)

  const [data, [{ count }], [summary]] = await Promise.all([
    db.query.transactions.findMany({
      where: whereClause,
      orderBy: [desc(transactions.transactionDate)],
      limit: pagination.limit,
      offset: pagination.offset,
      with: { member: true, subscription: { with: { package: true } }, refunds: true },
    }),
    db.select({ count: sql<number>`count(*)::int` }).from(transactions).where(whereClause),
    db.select({
      income: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amount} else 0 end), 0)::int`,
      expense: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amount} else 0 end), 0)::int`,
      refunds: sql<number>`coalesce(sum(case when ${transactions.category} = 'refund' then ${transactions.amount} else 0 end), 0)::int`,
    }).from(transactions).where(whereClause),
  ])

  return {
    data,
    totalPages: Math.ceil(Number(count) / pagination.limit),
    totalItems: Number(count),
    summary: {
      income: Number(summary?.income || 0),
      expense: Number(summary?.expense || 0),
      refunds: Number(summary?.refunds || 0),
      net: Number(summary?.income || 0) - Number(summary?.expense || 0),
    },
  }
}

export async function createCashflowEntry(input: z.input<typeof manualEntrySchema>) {
  const user = await requireAdmin()
  const parsed = manualEntrySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Thông tin khoản thu/chi không hợp lệ." }
  const data = parsed.data

  const existing = await db.query.transactions.findFirst({ where: eq(transactions.idempotencyKey, data.idempotencyKey) })
  if (existing) return { success: true, duplicate: true }

  try {
    const [created] = await db.insert(transactions).values({
      memberId: null,
      amount: data.amount,
      type: "manual",
      direction: data.direction,
      category: data.category,
      status: "posted",
      paymentMethod: data.paymentMethod,
      description: data.description,
      note: data.note || null,
      transactionDate: data.transactionDate,
      idempotencyKey: data.idempotencyKey,
      createdBy: user.id,
    }).returning({ id: transactions.id })
    if (!created) throw new Error("Không thể tạo bút toán")
    await logAction("CREATE", "TRANSACTION", created.id, { direction: data.direction, category: data.category, amount: data.amount })
  } catch (error) {
    const completed = await db.query.transactions.findFirst({ where: eq(transactions.idempotencyKey, data.idempotencyKey) })
    if (!completed) throw error
  }

  revalidatePath("/transactions")
  revalidatePath("/")
  return { success: true }
}

export async function refundMembershipTransaction(input: z.input<typeof refundSchema>) {
  const user = await requireAdmin()
  const parsed = refundSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Thông tin hoàn tiền không hợp lệ." }
  const data = parsed.data

  const original = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.id, data.transactionId),
      eq(transactions.direction, "income"),
      inArray(transactions.type, ["registration", "renewal"]),
      eq(transactions.status, "posted")
    ),
  })
  if (!original || !original.memberId) return { success: false, error: "Không tìm thấy khoản hội phí cần hoàn." }
  if (!original.subscriptionId) return { success: false, error: "Giao dịch cũ chưa liên kết được với gói tập. Vui lòng kiểm tra lại dữ liệu." }

  type RefundRow = { refund_id: number; member_id: number; subscription_id: number }
  const refunded = await db.execute<RefundRow>(sql`
    with cancelled_subscription as (
      update subscriptions
      set status = 'cancelled', cancelled_at = now(), cancelled_by = ${user.id}, cancellation_reason = ${data.reason}
      where id = ${original.subscriptionId}
        and member_id = ${original.memberId}
        and status <> 'cancelled'
        and not exists (
          select 1 from transactions existing_refund
          where existing_refund.refund_of_transaction_id = ${original.id}
        )
      returning id, member_id
    ), refund_transaction as (
      insert into transactions (
        member_id, subscription_id, amount, type, direction, category, status,
        payment_method, description, note, refund_of_transaction_id, created_by, transaction_date
      )
      select cancelled_subscription.member_id, cancelled_subscription.id, ${original.amount},
        'refund', 'expense', 'refund', 'posted', ${data.paymentMethod},
        ${`Hoàn tiền giao dịch #${original.id}`}, ${data.reason}, ${original.id}, ${user.id}, now()
      from cancelled_subscription
      on conflict (refund_of_transaction_id) where refund_of_transaction_id is not null do nothing
      returning id, member_id, subscription_id
    )
    select id::int as refund_id, member_id::int, subscription_id::int from refund_transaction
  `)
  const row = refunded.rows[0]
  if (!row) return { success: false, error: "Giao dịch này đã được hoàn tiền hoặc gói tập đã bị hủy." }

  await Promise.all([
    logAction("UPDATE", "SUBSCRIPTION", Number(row.subscription_id), { status: "cancelled", reason: data.reason, transactionId: original.id }),
    logAction("CREATE", "TRANSACTION", Number(row.refund_id), { type: "refund", amount: original.amount, originalTransactionId: original.id }),
  ])

  // Recognition stays enabled so the server can reject expired access and keep
  // the failed-scan log. Cancelling the subscription is the authorization gate.
  await queueMemberDeviceAccess(original.memberId, true)

  revalidatePath("/transactions")
  revalidatePath("/members")
  revalidatePath("/reports")
  revalidatePath("/check-ins")
  revalidatePath("/")
  return { success: true }
}
