import { v2 as cloudinary } from "cloudinary"
import { getCurrentUser } from "@/lib/auth"

const MAX_BODY_BYTES = 64 * 1024
const ALLOWED_KEYS = new Set([
  "timestamp", "source", "upload_preset", "folder", "public_id", "tags",
  "context", "transformation", "eager", "asset_folder", "display_name",
])

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const declaredLength = Number(request.headers.get("content-length") || 0)
  if (declaredLength > MAX_BODY_BYTES) return Response.json({ error: "Payload too large" }, { status: 413 })
  const raw = await request.arrayBuffer()
  if (raw.byteLength > MAX_BODY_BYTES) return Response.json({ error: "Payload too large" }, { status: 413 })

  let input: unknown
  try { input = JSON.parse(new TextDecoder().decode(raw)) } catch { input = null }
  const params = input && typeof input === "object" && "paramsToSign" in input
    ? (input as { paramsToSign?: unknown }).paramsToSign
    : null
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 })
  }

  const entries = Object.entries(params as Record<string, unknown>)
  if (entries.some(([key]) => !ALLOWED_KEYS.has(key))) {
    return Response.json({ error: "Unsupported upload parameters" }, { status: 400 })
  }
  const uploadParams = params as Record<string, unknown>
  if (uploadParams.folder !== "gym-avatars") {
    return Response.json({ error: "Invalid upload folder" }, { status: 400 })
  }
  if (uploadParams.upload_preset && uploadParams.upload_preset !== "quynh_hai_gym_avatars") {
    return Response.json({ error: "Invalid upload preset" }, { status: 400 })
  }
  const timestamp = Number(uploadParams.timestamp)
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 5 * 60) {
    return Response.json({ error: "Expired upload request" }, { status: 400 })
  }

  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!apiSecret) return Response.json({ error: "Upload service unavailable" }, { status: 503 })
  return Response.json({ signature: cloudinary.utils.api_sign_request(params as Record<string, unknown>, apiSecret) })
}
