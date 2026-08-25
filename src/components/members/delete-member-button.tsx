"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { deleteMember } from "@/actions/member-actions"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"

export function DeleteMemberButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const result = await deleteMember(id)
      if (!result.success) {
        toast.error(result.error || "Không thể xóa hội viên")
        return
      }
      toast.success(result.message || "Đã xóa ẩn danh hội viên")
      setOpen(false)
      setConfirmed(false)
    } catch {
      toast.error("Không thể xóa hội viên. Dữ liệu chưa bị thay đổi.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setConfirmed(false) }}>
      <DialogTrigger
        render={
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-red-600">Xác nhận xóa ẩn danh</DialogTitle>
          <DialogDescription>
            Thông tin cá nhân và ảnh sẽ bị xóa; gói/lịch bị hủy và AI26 sẽ xóa khuôn mặt. Giao dịch, check-in được giữ ẩn danh để đối soát.
          </DialogDescription>
        </DialogHeader>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-red-600" />
          <span>Tôi hiểu hội viên sẽ biến mất khỏi hệ thống vận hành.</span>
        </label>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Hủy</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting || !confirmed}>
            {isDeleting ? "Đang xóa ẩn danh..." : "Xóa ẩn danh"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
