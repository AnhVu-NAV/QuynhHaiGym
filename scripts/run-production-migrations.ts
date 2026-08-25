import { readFile } from "node:fs/promises"
import path from "node:path"
import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env" })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is missing")

  const sql = neon(databaseUrl)
  const migrationFiles = [
    "0001_local_auth.sql",
    "0002_ai26_integration.sql",
    "0003_ai26_access_sync.sql",
    "0004_failed_check_ins.sql",
    "0005_staff_calendar.sql",
    "0006_ai26_log_capacity.sql",
    "0007_ai26_fast_checkin.sql",
    "0008_performance_indexes.sql",
  ]

  for (const fileName of migrationFiles) {
    const filePath = path.join(process.cwd(), "supabase", "migrations", fileName)
    const source = await readFile(filePath, "utf8")
    const statements = source
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)

    for (const statement of statements) {
      await sql.query(statement)
    }
    console.log(`Applied ${fileName}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
