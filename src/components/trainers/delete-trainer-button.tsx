"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { deleteTrainer } from "@/actions/trainer-actions"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"

export function DeleteTrainerButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await deleteTrainer(id)
      toast.success("Đã xóa Huấn luyện viên")
      setOpen(false)
    } catch {
      toast.error("Không thể xóa HLV này do có dữ liệu liên quan (lịch tập, lớp học). Vui lòng chuyển trạng thái sang Không hoạt động thay vì xóa.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
            disabled={isDeleting}
            title="Xóa HLV"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-red-600">Xác nhận xóa HLV</DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xóa Huấn luyện viên này? Thao tác này không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Hủy</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Đang xóa..." : "Xóa HLV"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
