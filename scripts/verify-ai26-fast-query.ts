import { neon } from "@neondatabase/serverless"
import { PgDialect } from "drizzle-orm/pg-core"
import dotenv from "dotenv"
import { buildAi26FastLogQuery } from "../src/lib/ai26-fast-log-query"

dotenv.config({ path: ".env" })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is missing")

  const now = new Date()
  const statement = buildAi26FastLogQuery({
    serialNumber: "AI26_EXPLAIN_ONLY",
    remoteAddress: null,
    now,
    checkInAt: now,
    enrollId: 1,
    eventKey: "explain-only",
    sanitizedRecord: "{}",
    verificationMode: 15,
    temperature: null,
  })
  const compiled = new PgDialect().sqlToQuery(statement)
  const client = neon(databaseUrl)

  // EXPLAIN plans every CTE and validates tables, columns, constraints and
  // parameter types without executing any INSERT or UPDATE.
  await client.query(`EXPLAIN ${compiled.sql}`, compiled.params)
  console.log("AI26 fast check-in SQL plan passed without changing production data")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
