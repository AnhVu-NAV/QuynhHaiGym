export const SESSION_COOKIE = "gym_session"
export const SESSION_DURATION_SECONDS = 60 * 60 * 12

export type SessionPayload = {
  userId: string
  expiresAt: number
}

function toBase64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

export async function createSessionToken(payload: SessionPayload, secret: string) {
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    new TextEncoder().encode(encodedPayload),
  )
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`
}

export async function verifySessionToken(token: string | undefined, secret: string) {
  if (!token) return null
  const [encodedPayload, encodedSignature, extra] = token.split(".")
  if (!encodedPayload || !encodedSignature || extra) return null

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      fromBase64Url(encodedSignature),
      new TextEncoder().encode(encodedPayload),
    )
    if (!valid) return null

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload)),
    ) as SessionPayload

    if (!payload.userId || payload.expiresAt <= Date.now()) return null
    return payload
  } catch {
    return null
  }
}
