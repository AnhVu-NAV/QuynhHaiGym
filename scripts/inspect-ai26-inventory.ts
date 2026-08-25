import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env" })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is missing")

  const sql = neon(databaseUrl)
  const rows = await sql.query(`
    SELECT
      item->>'enrollid' AS enroll_id,
      item->>'backupnum' AS backup_num
    FROM (
      SELECT payload
      FROM device_events
      WHERE payload->>'ret' = 'getuserlist'
      ORDER BY id DESC
      LIMIT 1
    ) event
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(payload->'record') = 'array' THEN payload->'record'
        ELSE '[]'::jsonb
      END
    ) item
  `)

  console.log(JSON.stringify(rows, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
