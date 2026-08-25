import { randomBytes, scrypt as nodeScrypt } from "node:crypto"
import { promisify } from "node:util"
import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env" })

const scrypt = promisify(nodeScrypt)

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const key = await scrypt(password, salt, 64) as Buffer
  return `scrypt:${salt}:${key.toString("hex")}`
}

type AdminRow = {
  id: string
  email: string | null
  username: string | null
  full_name: string | null
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const password = process.argv[2]
  if (!databaseUrl) throw new Error("DATABASE_URL is missing")
  if (!password || password.length < 8) {
    throw new Error("Pass the new admin password (minimum 8 characters)")
  }

  const sql = neon(databaseUrl)
  const admins = await sql.query(
    "select id, email, username, full_name from users where role = 'admin' order by created_at"
  ) as AdminRow[]

  let admin = admins.find((row) => row.username?.toLowerCase() === "admin")
  if (!admin && admins.length === 1) admin = admins[0]

  if (!admin && admins.length === 0) {
    const [created] = await sql.query(
      "insert into users (id, username, full_name, role, password_hash, is_locked) values ($1, 'admin', 'Quản trị viên', 'admin', $2, false) returning id, email, username, full_name",
      [`local_admin_${Date.now()}`, await hashPassword(password)]
    ) as AdminRow[]
    admin = created
  } else if (!admin) {
    const choices = admins.map((row) => row.username || row.email || row.id).join(", ")
    throw new Error(`Multiple admins found; set username 'admin' first. Candidates: ${choices}`)
  } else {
    await sql.query(
      "update users set password_hash = $1, is_locked = false where id = $2",
      [await hashPassword(password), admin.id]
    )
  }

  console.log(`Admin ready: ${admin.username || admin.email || admin.id}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
