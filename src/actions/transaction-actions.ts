"use server"

import { db } from "@/db"
import { transactions, members } from "@/db/schema"
import { and, desc, ilike, or, eq, sql, inArray } from "drizzle-orm"

export async function getTransactions(q?: string, page: number = 1, limit: number = 20, paymentMethod = "all") {
  const offset = (page - 1) * limit;

  let searchClause = undefined;
  if (q) {
    const qNum = parseInt(q);
    const conditions = [
      inArray(transactions.memberId, db.select({ id: members.id }).from(members).where(ilike(members.fullName, `%${q}%`)))
    ];
    if (!isNaN(qNum)) {
      conditions.push(eq(transactions.id, qNum));
    }
    searchClause = or(...conditions);
  }
  const paymentClause = paymentMethod === "cash" || paymentMethod === "transfer" ? eq(transactions.paymentMethod, paymentMethod) : undefined;
  const whereClause = and(searchClause, paymentClause);

  const [data, [{ count }]] = await Promise.all([
    db.query.transactions.findMany({
      where: whereClause,
      orderBy: [desc(transactions.transactionDate)],
      limit,
      offset,
      with: { member: true },
    }),
    db.select({ count: sql<number>`count(*)` }).from(transactions).where(whereClause),
  ])
  const totalPages = Math.ceil(Number(count) / limit);

  return { data, totalPages, totalItems: Number(count) }
}
