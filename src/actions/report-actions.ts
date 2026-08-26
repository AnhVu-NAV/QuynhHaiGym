"use server"

import { db } from "@/db"
import { members, subscriptions } from "@/db/schema"
import { eq, and, gte, lte, ilike, inArray, ne, or, sql } from "drizzle-orm"
import { requireUser } from "@/lib/auth"
import { normalizePagination } from "@/lib/pagination"

export async function getExpiringMembers(q?: string, page: number = 1, limit: number = 20) {
  await requireUser()
  const pagination = normalizePagination(page, limit)
  page = pagination.page
  limit = pagination.limit
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
      offset: pagination.offset,
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
  await requireUser()
  const membersData = await db.query.members.findMany({
    where: ne(members.status, "deleted"),
    with: {
      subscriptions: {
        with: { package: true }
      }
    }
  })

  // Format into a flat array of objects for CSV
  const now = new Date()
  const data = membersData.map(m => {
    const activeSub = m.subscriptions.find(s => (
      s.status === 'active'
      && new Date(s.startDate) <= now
      && new Date(s.endDate) >= now
    ))
    return {
      "Họ và tên": m.fullName,
      "Số điện thoại": m.phoneNumber,
      "Giới tính": m.gender === 'male' ? 'Nam' : m.gender === 'female' ? 'Nữ' : 'Khác',
      "Trạng thái": activeSub ? 'Còn hạn' : 'Hết hạn',
      "Gói đang tập": activeSub ? activeSub.package.name : 'Không có',
      "Ngày hết hạn": activeSub ? new Date(activeSub.endDate).toLocaleDateString('vi-VN') : '',
      "Ngày gia nhập": new Date(m.joinDate).toLocaleDateString('vi-VN')
    }
  })

  return data
}
