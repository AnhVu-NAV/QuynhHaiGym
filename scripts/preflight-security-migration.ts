import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env" })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is missing")
  const sql = neon(databaseUrl)
  const duplicateBookings = await sql.query(`
    select session_id, member_id, count(*)::int as count
    from class_bookings
    group by session_id, member_id
    having count(*) > 1
    limit 20
  `)
  if (duplicateBookings.length) throw new Error(`Có ${duplicateBookings.length} cặp đặt lớp bị trùng; chưa thể tạo ràng buộc an toàn.`)

  const invalidTransactions = await sql.query(`
    select count(*)::int as count
    from transactions t
    left join members m on m.id = t.member_id
    where m.id is null
  `)
  if (Number(invalidTransactions[0]?.count || 0) > 0) throw new Error("Có giao dịch mồ côi trong cơ sở dữ liệu.")

  const migrated = await sql.query(`
    select
      exists(select 1 from information_schema.columns where table_name = 'members' and column_name = 'public_token') as has_public_token,
      exists(select 1 from information_schema.columns where table_name = 'users' and column_name = 'session_version') as has_session_version,
      exists(select 1 from information_schema.tables where table_name = 'rate_limits') as has_rate_limits
  `)
  const state = migrated[0]
  if (state?.has_public_token) {
    const missingTokens = await sql.query("select count(*)::int as count from members where public_token is null")
    if (Number(missingTokens[0]?.count || 0) > 0) throw new Error("Một số hội viên chưa có public token.")
  }
  console.log("Schema state", state)
  console.log("Security migration preflight passed")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
