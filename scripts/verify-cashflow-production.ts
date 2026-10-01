import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env" })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is missing")
  const sql = neon(databaseUrl)
  const [summary] = await sql`
    select
      count(*)::int as total,
      count(*) filter (where direction = 'income')::int as income_rows,
      count(*) filter (where direction = 'expense')::int as expense_rows,
      count(*) filter (where type in ('registration', 'renewal') and subscription_id is null)::int as unlinked_membership_rows,
      count(*) filter (where refund_of_transaction_id is not null)::int as refund_rows
    from transactions
  `
  const [invalid] = await sql`
    select count(*)::int as invalid_rows
    from transactions
    where amount <= 0
       or direction not in ('income', 'expense')
       or status not in ('posted', 'voided')
  `
  console.log(JSON.stringify({ ...summary, invalid_rows: invalid.invalid_rows }))
  if (Number(invalid.invalid_rows) !== 0) throw new Error("Cashflow integrity check failed")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
