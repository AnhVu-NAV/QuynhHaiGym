"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { updateInternalUser } from "@/actions/user-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export type EditableUser = {
  id: string
  email: string | null
  username: string | null
  fullName: string | null
  phoneNumber: string | null
  jobTitle: string | null
  role: string
  isLocked: boolean
}

export function EditUserDialog({
  user,
  isCurrentUser,
  open,
  onOpenChange,
}: {
  user: EditableUser
  isCurrentUser: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(formData: FormData) {
    setIsSubmitting(true)
    try {
      const result = await updateInternalUser(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Đã cập nhật thông tin nhân viên")
      onOpenChange(false)
    } catch {
      toast.error("Không thể cập nhật thông tin. Vui lòng thử lại.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Chỉnh sửa nhân viên</DialogTitle>
          <DialogDescription>Cập nhật đầy đủ thông tin liên hệ, chức danh và quyền đăng nhập.</DialogDescription>
        </DialogHeader>
        <form key={`${user.id}:${user.email}:${user.username}:${user.phoneNumber}:${user.jobTitle}:${user.role}:${user.isLocked}`} action={onSubmit} className="space-y-4 pt-2">
          <input type="hidden" name="userId" value={user.id} />
          <div className="space-y-2">
            <Label htmlFor={`edit-full-name-${user.id}`}>Họ và tên <span className="text-red-500">*</span></Label>
            <Input id={`edit-full-name-${user.id}`} name="fullName" defaultValue={user.fullName || ""} required minLength={2} maxLength={255} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-phone-${user.id}`}>Số điện thoại</Label>
              <Input id={`edit-phone-${user.id}`} name="phoneNumber" defaultValue={user.phoneNumber || ""} inputMode="tel" placeholder="09..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-job-${user.id}`}>Chức danh</Label>
              <Input id={`edit-job-${user.id}`} name="jobTitle" defaultValue={user.jobTitle || ""} maxLength={100} placeholder="Lễ tân, quản lý..." />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-username-${user.id}`}>Tên đăng nhập</Label>
              <Input id={`edit-username-${user.id}`} name="username" defaultValue={user.username || ""} maxLength={255} autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-email-${user.id}`}>Email</Label>
              <Input id={`edit-email-${user.id}`} name="email" type="email" defaultValue={user.email || ""} maxLength={255} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Cần có ít nhất tên đăng nhập hoặc email.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-role-${user.id}`}>Phân quyền</Label>
              <select
                id={`edit-role-${user.id}`}
                name="role"
                defaultValue={user.role}
                disabled={isCurrentUser}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="staff">Nhân viên</option>
                <option value="admin">Quản trị viên</option>
              </select>
              {isCurrentUser && <input type="hidden" name="role" value={user.role} />}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-status-${user.id}`}>Trạng thái tài khoản</Label>
              <select
                id={`edit-status-${user.id}`}
                name="accountStatus"
                defaultValue={user.isLocked ? "locked" : "active"}
                disabled={isCurrentUser}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="active">Đang hoạt động</option>
                <option value="locked">Khóa đăng nhập</option>
              </select>
              {isCurrentUser && <input type="hidden" name="accountStatus" value={user.isLocked ? "locked" : "active"} />}
            </div>
          </div>
          {isCurrentUser && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Bạn có thể sửa thông tin cá nhân, nhưng không thể tự đổi quyền hoặc tự khóa tài khoản.</p>}
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
            {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
