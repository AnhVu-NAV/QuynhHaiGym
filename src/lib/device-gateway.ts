import "server-only"

import { timingSafeEqual } from "node:crypto"

export function isGatewayAuthorized(request: Request) {
  const expected = process.env.DEVICE_GATEWAY_SECRET
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!expected || !supplied) return false

  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer)
}
