"use server"

import { db } from "@/db"
import { gymSettings } from "@/db/schema"

export async function getGymSettings() {
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
  const settings = await db.query.gymSettings.findFirst()
  if (settings) {
    await db.update(gymSettings)
      .set({ ...data, updatedAt: new Date() })
  } else {
    await db.insert(gymSettings).values(data)
  }
  return { success: true }
}
