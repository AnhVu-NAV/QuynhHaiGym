"use server"

import { db } from "@/db"
import { inbodyRecords, members } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { logAction } from "./audit-actions"

export async function addInbodyRecord(data: {
  memberId: number
  weight: number
  skeletalMuscle: number
  bodyFat: number
  notes?: string
}) {
  try {
    const [newRecord] = await db.insert(inbodyRecords).values({
      memberId: data.memberId,
      weight: data.weight,
      skeletalMuscle: data.skeletalMuscle,
      bodyFat: data.bodyFat,
      notes: data.notes,
    }).returning()

    await logAction("CREATE", "INBODY_RECORD", newRecord.id.toString(), {
      memberId: data.memberId,
      weight: data.weight,
      bodyFat: data.bodyFat
    })

    revalidatePath(`/members/${data.memberId}`)
    return { success: true, data: newRecord }
  } catch (error) {
    console.error("Error adding inbody record:", error)
    return { success: false, error: "Failed to add inbody record" }
  }
}

export async function getInbodyRecords(memberId: number) {
  try {
    const records = await db.query.inbodyRecords.findMany({
      where: eq(inbodyRecords.memberId, memberId),
      orderBy: [desc(inbodyRecords.recordDate)]
    })
    return { success: true, data: records }
  } catch (error) {
    console.error("Error fetching inbody records:", error)
    return { success: false, error: "Failed to fetch records" }
  }
}

export async function deleteInbodyRecord(id: number, memberId: number) {
  try {
    await db.delete(inbodyRecords).where(eq(inbodyRecords.id, id))
    
    await logAction("DELETE", "INBODY_RECORD", id.toString(), { memberId })
    
    revalidatePath(`/members/${memberId}`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting inbody record:", error)
    return { success: false, error: "Failed to delete record" }
  }
}
