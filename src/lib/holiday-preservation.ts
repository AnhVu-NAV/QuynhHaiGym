import "server-only"

import { db } from "@/db"
import { subscriptions } from "@/db/schema"
import { addHolidayPreservationDays } from "@/lib/membership"
import { eq, ne } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"

export async function getHolidayAdjustedEndDate(startDate: Date, baseEndDate: Date) {
  const holidays = await db.query.gymHolidays.findMany({
    columns: { startDate: true, endDate: true },
  })
  return addHolidayPreservationDays(startDate, baseEndDate, holidays)
}

export async function recalculateHolidayPreservation() {
  const [holidays, eligibleSubscriptions] = await Promise.all([
    db.query.gymHolidays.findMany({
      columns: { startDate: true, endDate: true },
    }),
    db.query.subscriptions.findMany({
      where: ne(subscriptions.status, "cancelled"),
      columns: { id: true, startDate: true, baseEndDate: true, endDate: true },
    }),
  ])

  const updates: BatchItem<"pg">[] = []
  for (const subscription of eligibleSubscriptions) {
    const adjusted = addHolidayPreservationDays(
      new Date(subscription.startDate),
      new Date(subscription.baseEndDate),
      holidays,
    )
    if (adjusted.endDate.getTime() !== new Date(subscription.endDate).getTime()) {
      updates.push(
        db.update(subscriptions)
          .set({ endDate: adjusted.endDate })
          .where(eq(subscriptions.id, subscription.id)),
      )
    }
  }

  // Keep each Neon HTTP transaction comfortably below request-size limits.
  for (let offset = 0; offset < updates.length; offset += 100) {
    const chunk = updates.slice(offset, offset + 100)
    if (chunk.length) {
      await db.batch(chunk as [BatchItem<"pg">, ...BatchItem<"pg">[]])
    }
  }

  return { adjustedSubscriptions: updates.length }
}
