"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Camera, RefreshCw, Trash2 } from "lucide-react"
import { deleteFaceEnrollment, startFaceEnrollment } from "@/actions/device-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const labels: Record<string, string> = {
  not_registered: "Chưa đăng ký",
  pending: "Đang gửi lệnh",
  scanning: "Đang chờ quét",
  registered: "Đã có khuôn mặt",
  pending_delete: "Đang xóa",
  failed: "Cần thử lại",
}

export function FaceEnrollmentButton({
  memberId,
  deviceId,
  status = "not_registered",
  compact = false,
}: {
  memberId: number
  deviceId?: number
  status?: string
  compact?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const busy = pending || status === "pending" || status === "pending_delete"

  async function enroll() {
    setPending(true)
    try {
      const result = await startFaceEnrollment(memberId, deviceId)
      if (result.success) toast.success(result.message)
      else toast.error(result.message)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không bắt đầu được quét mặt")
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    if (!deviceId || !window.confirm("Xóa khuôn mặt hội viên khỏi AI26?")) return
    setPending(true)
    try {
      const result = await deleteFaceEnrollment(memberId, deviceId)
      if (result.success) toast.success(result.message || "Đã gửi lệnh xóa")
      else toast.error(result.message)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không gửi được lệnh xóa")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={compact ? "flex min-w-0 items-center gap-1.5" : "flex flex-wrap items-center gap-2"}>
      <Badge
        variant={status === "registered" ? "default" : status === "failed" ? "destructive" : "secondary"}
        className={compact ? "min-w-0 max-w-[8.5rem] truncate px-2 text-[10px] min-[360px]:text-xs" : undefined}
      >
        {labels[status] || status}
      </Badge>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={enroll}
        title="Đăng ký hoặc quét lại khuôn mặt"
        className={compact ? "ml-auto h-8 shrink-0 px-2 text-xs min-[360px]:px-3" : undefined}
      >
        {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {status === "registered" ? "Quét lại" : "Quét mặt"}
      </Button>
      {status === "registered" && deviceId && (
        <Button size="icon-sm" variant="ghost" disabled={busy} onClick={remove} title="Xóa khỏi máy" className={compact ? "shrink-0" : undefined}>
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      )}
    </div>
  )
}
