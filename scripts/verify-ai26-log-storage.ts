import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env" })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is missing")

  const sql = neon(databaseUrl)
  const rows = await sql`
    SELECT
      serial_number,
      log_capacity,
      used_log_count,
      unsynced_log_count,
      log_stats_at,
      last_log_synced_at,
      last_log_cleanup_at
    FROM devices
    WHERE is_active = true
    ORDER BY last_seen_at DESC NULLS LAST
    LIMIT 1
  `
  const cleanupCommands = await sql`
    SELECT status, count(*)::int AS count
    FROM device_commands
    WHERE command = 'cleanlog'
    GROUP BY status
    ORDER BY status
  `

  console.log(JSON.stringify({ device: rows[0] || null, cleanupCommands }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
