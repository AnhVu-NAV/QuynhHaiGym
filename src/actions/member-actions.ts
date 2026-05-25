"use server"

import { db } from "@/db"
import { members } from "@/db/schema"
import { eq, or, ilike, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { v2 as cloudinary } from 'cloudinary'

export async function getMembers(q?: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit
  
  const whereClause = q 
    ? or(
        ilike(members.fullName, `%${q}%`),
        ilike(members.phoneNumber, `%${q}%`)
      )
    : undefined

  const data = await db.query.members.findMany({
    where: whereClause,
    orderBy: (members, { desc }) => [desc(members.createdAt)],
    limit,
    offset,
    with: {
      subscriptions: {
        with: {
          package: true
        }
      }
    }
  })

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(members).where(whereClause)
  const totalPages = Math.ceil(Number(count) / limit)

  return { data, totalPages, totalItems: Number(count) }
}

export async function getMemberById(id: number) {
  const member = await db.query.members.findFirst({
    where: eq(members.id, id),
    with: {
      subscriptions: {
        with: {
          package: true
        }
      },
      ptSessions: {
        with: {
          trainer: true
        }
      },
      inbodyRecords: {
        orderBy: (inbodyRecords, { desc }) => [desc(inbodyRecords.recordDate)]
      }
    }
  })
  
  return member
}

import { logAction } from "./audit-actions"

export async function createMember(data: {
  fullName: string
  phoneNumber: string
  gender?: string
  avatarUrl?: string
}) {
  const [newMember] = await db.insert(members).values({
    fullName: data.fullName,
    phoneNumber: data.phoneNumber,
    gender: data.gender || null,
    avatarUrl: data.avatarUrl || null,
    status: "active",
  }).returning({ id: members.id })
  
  await logAction("CREATE", "MEMBER", newMember.id, { fullName: data.fullName, phoneNumber: data.phoneNumber })
  
  revalidatePath("/members")
  return { success: true, newMemberId: newMember.id }
}

export async function updateMember(id: number, data: {
  fullName: string
  phoneNumber: string
  gender?: string
  status: string
  avatarUrl?: string
}) {
  await db.update(members)
    .set({
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      gender: data.gender || null,
      status: data.status,
      avatarUrl: data.avatarUrl || null,
      updatedAt: new Date()
    })
    .where(eq(members.id, id))
    
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
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    const [publicId] = filename.split('.');
    return publicId;
  } catch (e) {
    return null;
  }
}

export async function deleteMember(id: number) {
  const member = await db.query.members.findFirst({
    where: eq(members.id, id)
  });

  if (member?.avatarUrl) {
    try {
      const publicId = getPublicIdFromUrl(member.avatarUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    } catch (error) {
      console.error("Failed to delete image from Cloudinary", error);
    }
  }

  await db.delete(members).where(eq(members.id, id))
  
  await logAction("DELETE", "MEMBER", id, { name: member?.fullName })
  
  revalidatePath("/members")
  return { success: true }
}
