"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Camera, RefreshCw, Trash2 } from "lucide-react"
import { deleteFaceEnrollment, startFaceEnrollment } from "@/actions/device-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export type EnrollmentDeviceOption = {
  id: number
  name: string
  serialNumber: string
  online: boolean
}

type FaceMapping = {
  deviceId: number
  faceStatus: string
}

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
  devices,
  mappings = [],
  compact = false,
}: {
  memberId: number
  devices: EnrollmentDeviceOption[]
  mappings?: FaceMapping[]
  compact?: boolean
}) {
  const router = useRouter()
  const availableMappings = mappings.filter((mapping) => devices.some((device) => device.id === mapping.deviceId))
  const firstOnlineId = devices.find((device) => device.online)?.id
  const firstMappedOnlineId = availableMappings
    .map((mapping) => mapping.deviceId)
    .find((deviceId) => devices.some((device) => device.id === deviceId && device.online))
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(firstMappedOnlineId || firstOnlineId || devices[0]?.id || null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId)
  const selectedMapping = availableMappings.find((mapping) => mapping.deviceId === selectedDeviceId)
  const registeredCount = availableMappings.filter((mapping) => mapping.faceStatus === "registered").length
  const summaryStatus = useMemo(() => {
    if (registeredCount > 1) return `${registeredCount} máy đã có mặt`
    if (registeredCount === 1) return "Đã có khuôn mặt"
    const activeMapping = availableMappings.find((mapping) => mapping.faceStatus !== "not_registered")
    return activeMapping ? (labels[activeMapping.faceStatus] || activeMapping.faceStatus) : "Chưa đăng ký"
  }, [availableMappings, registeredCount])
  const busy = pending || selectedMapping?.faceStatus === "pending" || selectedMapping?.faceStatus === "pending_delete"

  async function enroll() {
    if (!selectedDeviceId) {
      toast.error("Hãy chọn máy AI26 cần quét")
      return
    }
    setPending(true)
    try {
      const result = await startFaceEnrollment(memberId, selectedDeviceId)
      if (result.success) {
        toast.success(result.message)
        setOpen(false)
      } else {
        toast.error(result.message)
      }
      router.refresh()
    } catch (LiteralError) {
      toast.error(LiteralError instanceof Error ? LiteralError.message : "Không bắt đầu được quét mặt")
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    if (!selectedDeviceId || selectedMapping?.faceStatus !== "registered") return
    setPending(true)
    try {
      const result = await deleteFaceEnrollment(memberId, selectedDeviceId)
      if (result.success) {
        toast.success(result.message || "Đã gửi lệnh xóa")
        setOpen(false)
      } else {
        toast.error(result.message)
      }
      router.refresh()
    } catch (LiteralError) {
      toast.error(LiteralError instanceof Error ? LiteralError.message : "Không gửi được lệnh xóa")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={compact ? "flex min-w-0 items-center gap-1.5" : "flex flex-wrap items-center gap-2"}>
      <Badge
        variant={registeredCount > 0 ? "default" : availableMappings.some((mapping) => mapping.faceStatus === "failed") ? "destructive" : "secondary"}
        className={compact ? "min-w-0 max-w-[8.5rem] truncate px-2 text-[10px] min-[360px]:text-xs" : undefined}
      >
        {summaryStatus}
      </Badge>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="sm" variant="outline" className={compact ? "ml-auto h-8 shrink-0 px-2 text-xs min-[360px]:px-3" : undefined} />}>
          <Camera className="h-4 w-4" /> {registeredCount > 0 ? "Quét lại" : "Quét mặt"}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chọn máy để quét khuôn mặt</DialogTitle>
            <DialogDescription>Chọn đúng máy mà hội viên đang đứng trước camera.</DialogDescription>
          </DialogHeader>

          {devices.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Chưa có máy AI26. Hãy thêm máy trong mục Máy nhận diện trước.
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`face-device-${memberId}`}>Máy nhận diện</Label>
              <select
                id={`face-device-${memberId}`}
                value={selectedDeviceId || ""}
                onChange={(event) => setSelectedDeviceId(Number(event.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {devices.map((device) => {
                  const mapping = availableMappings.find((item) => item.deviceId === device.id)
                  return (
                    <option key={device.id} value={device.id} disabled={!device.online}>
                      {device.name} · {device.serialNumber} · {device.online ? (labels[mapping?.faceStatus || "not_registered"] || mapping?.faceStatus) : "Ngoại tuyến"}
                    </option>
                  )
                })}
              </select>
              {selectedDevice && !selectedDevice.online && (
                <p className="text-xs text-red-600">Máy đang ngoại tuyến nên chưa thể bắt đầu quét.</p>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Đóng</DialogClose>
            {selectedMapping?.faceStatus === "registered" && (
              <Button type="button" variant="outline" className="text-red-600" disabled={busy || !selectedDevice?.online} onClick={remove}>
                <Trash2 className="h-4 w-4" /> Xóa khỏi máy
              </Button>
            )}
            <Button type="button" disabled={busy || !selectedDevice?.online} onClick={enroll}>
              {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {selectedMapping?.faceStatus === "registered" ? "Quét lại trên máy này" : "Bắt đầu quét"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
