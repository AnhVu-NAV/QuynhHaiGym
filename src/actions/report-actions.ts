"use server"

import { db } from "@/db"
import { members, subscriptions } from "@/db/schema"
import { eq, and, gte, lte, ilike, inArray, ne, or, sql } from "drizzle-orm"

export async function getExpiringMembers(q?: string, page: number = 1, limit: number = 20) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  // Find active subscriptions ending in the next 7 days
  const searchClause = q ? inArray(subscriptions.memberId, db.select({ id: members.id }).from(members).where(
    or(ilike(members.fullName, `%${q}%`), ilike(members.phoneNumber, `%${q}%`))
  )) : undefined
  const whereClause = and(
      eq(subscriptions.status, 'active'),
      gte(subscriptions.endDate, today),
      lte(subscriptions.endDate, nextWeek),
      inArray(subscriptions.memberId, db.select({ id: members.id }).from(members).where(ne(members.status, "deleted"))),
      searchClause,
    )
  const [subs, [{ count }]] = await Promise.all([
    db.query.subscriptions.findMany({
      where: whereClause,
      with: { member: true, package: true },
      orderBy: [subscriptions.endDate],
      limit,
      offset: (page - 1) * limit,
    }),
    db.select({ count: sql<number>`count(*)` }).from(subscriptions).where(whereClause),
  ])
  return {
    data: subs,
    totalPages: Math.ceil(Number(count) / limit),
    totalItems: Number(count),
  }
}

export async function getExportData() {
  const membersData = await db.query.members.findMany({
    where: ne(members.status, "deleted"),
    with: {
      subscriptions: {
        with: { package: true }
      }
    }
  })

  // Format into a flat array of objects for CSV
  const data = membersData.map(m => {
    const activeSub = m.subscriptions.find(s => s.status === 'active' && new Date(s.endDate) >= new Date())
    return {
      "Họ và tên": m.fullName,
      "Số điện thoại": m.phoneNumber,
      "Giới tính": m.gender === 'male' ? 'Nam' : m.gender === 'female' ? 'Nữ' : 'Khác',
      "Trạng thái": m.status === 'active' ? 'Hoạt động' : 'Hết hạn',
      "Gói đang tập": activeSub ? activeSub.package.name : 'Không có',
      "Ngày hết hạn": activeSub ? new Date(activeSub.endDate).toLocaleDateString('vi-VN') : '',
      "Ngày gia nhập": new Date(m.joinDate).toLocaleDateString('vi-VN')
    }
  })

  return data
}
