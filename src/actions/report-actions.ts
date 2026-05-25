"use server"

import { db } from "@/db"
import { members, subscriptions, transactions } from "@/db/schema"
import { eq, desc, and, gte, lte } from "drizzle-orm"

export async function getExpiringMembers() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  // Find active subscriptions ending in the next 7 days
  const subs = await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.status, 'active'),
      gte(subscriptions.endDate, today),
      lte(subscriptions.endDate, nextWeek)
    ),
    with: {
      member: true,
      package: true
    },
    orderBy: [subscriptions.endDate]
  })

  return subs
}

export async function getExportData() {
  const membersData = await db.query.members.findMany({
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
