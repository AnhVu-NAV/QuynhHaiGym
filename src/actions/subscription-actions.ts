"use server"

import { db } from "@/db"
import { subscriptions, transactions, membershipPackages, members } from "@/db/schema"
import { eq, and, gte, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { logAction } from "./audit-actions"

export async function registerSubscription(data: {
  memberId: number
  packageId: number
  startDate: Date
  paymentMethod: string
}) {
  // 1. Get package details
  const pkg = await db.query.membershipPackages.findFirst({
    where: eq(membershipPackages.id, data.packageId)
  })

  if (!pkg) throw new Error("Gói tập không tồn tại")

  // Find current active subscription to stack dates
  const currentSubs = await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.memberId, data.memberId),
      gte(subscriptions.endDate, new Date())
    ),
    orderBy: [desc(subscriptions.endDate)]
  });
  const currentSub = currentSubs[0];

  const actualStartDate = currentSub ? new Date(currentSub.endDate) : new Date(data.startDate);

  // 2. Calculate end date
  const endDate = new Date(actualStartDate)
  endDate.setMonth(endDate.getMonth() + pkg.durationMonths)

  // 3. Create Subscription
  const [newSub] = await db.insert(subscriptions).values({
    memberId: data.memberId,
    packageId: data.packageId,
    startDate: actualStartDate,
    endDate: endDate,
    status: "active"
  }).returning({ id: subscriptions.id })
  
  await logAction("CREATE", "SUBSCRIPTION", newSub.id, { memberId: data.memberId, package: pkg.name })

  // 4. Create Transaction for revenue tracking
  const [newTx] = await db.insert(transactions).values({
    memberId: data.memberId,
    amount: pkg.price,
    type: "registration",
    paymentMethod: data.paymentMethod,
    description: `Đăng ký gói: ${pkg.name}`,
    transactionDate: new Date()
  }).returning({ id: transactions.id })
  
  await logAction("CREATE", "TRANSACTION", newTx.id, { amount: pkg.price, method: data.paymentMethod })

  // 5. Update member status to active if they were expired/inactive
  await db.update(members)
    .set({ status: "active" })
    .where(eq(members.id, data.memberId))

  revalidatePath("/members")
  return { success: true }
}
