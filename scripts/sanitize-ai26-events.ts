import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env" })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is missing")

  const sql = neon(databaseUrl)
  const result = await sql.query(`
    UPDATE device_events
    SET payload = payload - ARRAY[
      'wlan_pwd',
      'webserver_pwd',
      'qrcode_pwd',
      'excel_password',
      'commpassword',
      'cpucard_key'
    ]::text[]
    WHERE payload ?| ARRAY[
      'wlan_pwd',
      'webserver_pwd',
      'qrcode_pwd',
      'excel_password',
      'commpassword',
      'cpucard_key'
    ]::text[]
    RETURNING id
  `)

  console.log(`Sanitized event rows: ${result.length}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
