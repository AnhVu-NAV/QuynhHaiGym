import assert from "node:assert/strict"
import { addCalendarMonthsClamped } from "../src/lib/membership"
import { normalizePagination } from "../src/lib/pagination"
import { createSessionToken, verifySessionToken } from "../src/lib/session-token"

async function main() {
  assert.equal(addCalendarMonthsClamped(new Date(2026, 0, 31), 1).getDate(), 28)
  assert.equal(addCalendarMonthsClamped(new Date(2028, 0, 31), 1).getDate(), 29)
  assert.deepEqual(normalizePagination(-1, 50), { page: 1, limit: 50, offset: 0 })
  assert.deepEqual(normalizePagination(2, 1000), { page: 2, limit: 100, offset: 100 })

  const secret = "a".repeat(32)
  const payload = { userId: "test", sessionVersion: 2, expiresAt: Date.now() + 60_000 }
  const token = await createSessionToken(payload, secret)
  assert.deepEqual(await verifySessionToken(token, secret), payload)
  assert.equal(await verifySessionToken(`${token}tampered`, secret), null)
  assert.equal(await verifySessionToken(token, "b".repeat(32)), null)
  console.log("Security and integrity smoke tests passed")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
