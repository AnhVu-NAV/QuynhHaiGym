"use server"

import { db } from "@/db"
import { gymSettings } from "@/db/schema"
import { requireAdmin, requireUser } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { logAction } from "./audit-actions"

const settingsSchema = z.object({
  bankId: z.string().trim().min(2).max(50),
  accountNo: z.string().trim().regex(/^\d{4,30}$/),
  accountName: z.string().trim().min(2).max(255),
})

export async function getGymSettings() {
  await requireUser()
  const settings = await db.query.gymSettings.findFirst()
  return settings || {
    bankId: "",
    accountNo: "",
    accountName: ""
  }
}

export async function saveGymSettings(data: {
  bankId: string
  accountNo: string
  accountName: string
}) {
  await requireAdmin()
  data = settingsSchema.parse(data)
  const settings = await db.query.gymSettings.findFirst()
  if (settings) {
    await db.update(gymSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(gymSettings.id, settings.id))
  } else {
    await db.insert(gymSettings).values(data)
  }
  await logAction("UPDATE", "SETTINGS", settings?.id || "singleton", {
    bankId: data.bankId,
    accountName: data.accountName,
  })
  return { success: true }
}
