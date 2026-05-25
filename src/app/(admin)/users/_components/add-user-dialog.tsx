"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserPlus } from "lucide-react"
import { createInternalUser } from "@/actions/user-actions"
import { toast } from "sonner"

export function AddUserDialog() {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(formData: FormData) {
    setIsSubmitting(true)
    const res = await createInternalUser(formData)
    setIsSubmitting(false)
    
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success("Đã tạo tài khoản thành công")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <UserPlus className="w-4 h-4 mr-2" /> Thêm nhân viên
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tạo tài khoản Nội bộ</DialogTitle>
          <DialogDescription>
            Tạo tài khoản cho Quản trị viên hoặc Nhân viên.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4 pt-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Tên đăng nhập (Username) <span className="text-muted-foreground font-normal">(Tuỳ chọn)</span></Label>
              <Input id="username" name="username" placeholder="nguyenvana" />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="email">Email <span className="text-muted-foreground font-normal">(Tuỳ chọn nếu có Username)</span></Label>
              <Input id="email" name="email" type="email" placeholder="admin@gym.com" />
            </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" name="password" type="text" required placeholder="Ít nhất 8 ký tự" minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Họ và tên</Label>
            <Input id="fullName" name="fullName" required placeholder="Nguyễn Văn A" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Phân quyền</Label>
            <select 
              id="role"
              name="role"
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="staff">Nhân viên (Staff)</option>
              <option value="admin">Quản trị viên (Admin)</option>
            </select>
          </div>
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
            {isSubmitting ? "Đang tạo..." : "Xác nhận tạo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
