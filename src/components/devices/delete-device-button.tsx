"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deleteDevice } from "@/actions/device-actions"
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

export function DeleteDeviceButton({
  deviceId,
  deviceName,
  serialNumber,
}: {
  deviceId: number
  deviceName: string
  serialNumber: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function removeDevice() {
    setPending(true)
    try {
      const result = await deleteDevice(deviceId)
      if (!result.success) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không xóa được thiết bị")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" />}>
        <Trash2 className="h-4 w-4" /> Gỡ máy
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gỡ {deviceName} khỏi web?</DialogTitle>
          <DialogDescription>
            Serial {serialNumber} sẽ bị thu hồi quyền kết nối và ẩn khỏi danh sách ngay. Lịch sử check-in vẫn được giữ. Có thể thêm lại đúng serial này sau nếu cần.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Hủy</DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={removeDevice}>
            {pending ? "Đang gỡ..." : "Gỡ máy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
