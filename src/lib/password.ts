import "server-only"

import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(nodeScrypt)
const KEY_LENGTH = 64

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  return `scrypt:${salt}:${derivedKey.toString("hex")}`
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, keyHex] = storedHash.split(":")
  if (algorithm !== "scrypt" || !salt || !keyHex) return false

  const storedKey = Buffer.from(keyHex, "hex")
  const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey)
}
