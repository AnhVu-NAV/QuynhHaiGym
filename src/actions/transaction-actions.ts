"use server"

import { db } from "@/db"
import { transactions, members } from "@/db/schema"
import { desc, ilike, or, eq, sql, inArray } from "drizzle-orm"

export async function getTransactions(q?: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  let whereClause = undefined;
  if (q) {
    const qNum = parseInt(q);
    const conditions = [
      inArray(transactions.memberId, db.select({ id: members.id }).from(members).where(ilike(members.fullName, `%${q}%`)))
    ];
    if (!isNaN(qNum)) {
      conditions.push(eq(transactions.id, qNum));
    }
    whereClause = or(...conditions);
  }

  const data = await db.query.transactions.findMany({
    where: whereClause,
    orderBy: [desc(transactions.transactionDate)],
    limit,
    offset,
    with: {
      member: true
    }
  })

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(transactions).where(whereClause);
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}
