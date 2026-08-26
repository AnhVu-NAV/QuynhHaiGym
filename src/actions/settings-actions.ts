"use server"

import { db } from "@/db"
import { gymHolidays, gymSettings } from "@/db/schema"
import { requireAdmin, requireUser } from "@/lib/auth"
import { desc, eq } from "drizzle-orm"
import { z } from "zod"
import { logAction } from "./audit-actions"
import { recalculateHolidayPreservation } from "@/lib/holiday-preservation"
import { revalidatePath } from "next/cache"

const settingsSchema = z.object({
  bankId: z.string().trim().min(2).max(50),
  accountNo: z.string().trim().regex(/^\d{4,30}$/),
  accountName: z.string().trim().min(2).max(255),
})

const holidaySchema = z.object({
  name: z.string().trim().min(2).max(255),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).superRefine((value, context) => {
  const start = Date.parse(`${value.startDate}T00:00:00Z`)
  const end = Date.parse(`${value.endDate}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    context.addIssue({ code: "custom", message: "Ngày kết thúc phải từ ngày bắt đầu trở đi" })
  } else if ((end - start) / 86_400_000 > 62) {
    context.addIssue({ code: "custom", message: "Một đợt nghỉ không được dài quá 63 ngày" })
  }
})

function revalidateHolidayViews() {
  revalidatePath("/settings")
  revalidatePath("/members")
  revalidatePath("/check-ins")
  revalidatePath("/reports")
  revalidatePath("/")
}

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

export async function getGymHolidays() {
  await requireUser()
  return db.query.gymHolidays.findMany({
    orderBy: [desc(gymHolidays.startDate), desc(gymHolidays.id)],
  })
}

export async function createGymHoliday(data: {
  name: string
  startDate: string
  endDate: string
}) {
  await requireAdmin()
  const parsed = holidaySchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Thông tin ngày nghỉ không hợp lệ" }
  }

  const [holiday] = await db.insert(gymHolidays).values(parsed.data).returning()
  const result = await recalculateHolidayPreservation()
  await logAction("CREATE", "HOLIDAY", holiday.id, {
    name: holiday.name,
    startDate: holiday.startDate,
    endDate: holiday.endDate,
    adjustedSubscriptions: result.adjustedSubscriptions,
  })
  revalidateHolidayViews()
  return { success: true, ...result }
}

export async function updateGymHoliday(id: number, data: {
  name: string
  startDate: string
  endDate: string
}) {
  await requireAdmin()
  if (!Number.isInteger(id) || id <= 0) return { success: false, error: "Ngày nghỉ không hợp lệ" }
  const parsed = holidaySchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Thông tin ngày nghỉ không hợp lệ" }
  }

  const [holiday] = await db.update(gymHolidays)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(gymHolidays.id, id))
    .returning()
  if (!holiday) return { success: false, error: "Ngày nghỉ không còn tồn tại" }

  const result = await recalculateHolidayPreservation()
  await logAction("UPDATE", "HOLIDAY", holiday.id, {
    name: holiday.name,
    startDate: holiday.startDate,
    endDate: holiday.endDate,
    adjustedSubscriptions: result.adjustedSubscriptions,
  })
  revalidateHolidayViews()
  return { success: true, ...result }
}

export async function deleteGymHoliday(id: number) {
  await requireAdmin()
  if (!Number.isInteger(id) || id <= 0) return { success: false, error: "Ngày nghỉ không hợp lệ" }
  const [holiday] = await db.delete(gymHolidays)
    .where(eq(gymHolidays.id, id))
    .returning()
  if (!holiday) return { success: false, error: "Ngày nghỉ không còn tồn tại" }

  const result = await recalculateHolidayPreservation()
  await logAction("DELETE", "HOLIDAY", holiday.id, {
    name: holiday.name,
    startDate: holiday.startDate,
    endDate: holiday.endDate,
    adjustedSubscriptions: result.adjustedSubscriptions,
  })
  revalidateHolidayViews()
  return { success: true, ...result }
}
