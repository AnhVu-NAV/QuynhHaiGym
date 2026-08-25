"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Clock3, Info, RefreshCw, Trash2, Users } from "lucide-react"
import { requestDeviceLogCleanup, sendDeviceControl } from "@/actions/device-actions"
import { Button } from "@/components/ui/button"

type DeviceControl = "sync_time" | "get_info" | "get_users"
type Control = DeviceControl | "clean_logs"

export function DeviceControls({
  deviceId,
  online,
  canCleanLogs,
  cleanDisabledReason,
}: {
  deviceId: number
  online: boolean
  canCleanLogs: boolean
  cleanDisabledReason: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState<Control | null>(null)

  async function send(control: DeviceControl) {
    setPending(control)
    try {
      const result = await sendDeviceControl(deviceId, control)
      if (result.success) toast.success(result.message)
      else toast.error(result.message)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không gửi được lệnh")
    } finally {
      setPending(null)
    }
  }

  async function cleanLogs() {
    const confirmed = window.confirm(
      "Dọn toàn bộ nhật ký đã đồng bộ khỏi AI26? Dữ liệu check-in trên web không bị xóa."
    )
    if (!confirmed) return

    setPending("clean_logs")
    try {
      const result = await requestDeviceLogCleanup(deviceId)
      if (result.success) toast.success(result.message)
      else toast.error(result.message)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không gửi được lệnh dọn nhật ký")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={!online || pending !== null} onClick={() => send("sync_time")}>
        {pending === "sync_time" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
        Đồng bộ giờ
      </Button>
      <Button size="sm" variant="outline" disabled={!online || pending !== null} onClick={() => send("get_info")}>
        <Info className="h-4 w-4" /> Đọc thông tin
      </Button>
      <Button size="sm" variant="outline" disabled={!online || pending !== null} onClick={() => send("get_users")}>
        <Users className="h-4 w-4" /> Đồng bộ danh sách
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900"
        disabled={!canCleanLogs || pending !== null}
        title={canCleanLogs ? "Chỉ xóa nhật ký trên AI26" : cleanDisabledReason}
        onClick={cleanLogs}
      >
        {pending === "clean_logs"
          ? <RefreshCw className="h-4 w-4 animate-spin" />
          : <Trash2 className="h-4 w-4" />}
        Dọn log trên máy
      </Button>
    </div>
  )
}
