"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { deletePackage } from "@/actions/package-actions"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"

export function DeletePackageButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await deletePackage(id)
      toast.success("Đã xóa gói tập")
      setOpen(false)
    } catch {
      toast.error("Không thể xóa gói tập này (có thể đã có người đăng ký)")
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
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-red-600">Xác nhận xóa gói tập</DialogTitle>
          <DialogDescription>
            Bạn có chắc chắn muốn xóa gói tập này không? Hành động này không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Hủy</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Đang xóa..." : "Xóa Gói Tập"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
