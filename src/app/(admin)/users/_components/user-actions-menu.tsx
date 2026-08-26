"use client"

import { useState } from "react"
import { MoreHorizontal, ShieldAlert, ShieldCheck, Lock, Unlock, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { resetUserPassword, toggleUserLock, updateUserRole } from "@/actions/user-actions"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ManagedUser = {
  id: string
  role: string
  isLocked: boolean
}

export function UserActionsMenu({ user }: { user: ManagedUser }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [password, setPassword] = useState("")
  const isLocked = user.isLocked || false

  async function handleToggleLock() {
    setIsUpdating(true)
    const res = await toggleUserLock(user.id, isLocked)
    if (res.error) toast.error(res.error)
    else toast.success(isLocked ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản")
    setIsUpdating(false)
  }

  async function handleRoleChange() {
    setIsUpdating(true)
    const newRole = user.role === "admin" ? "staff" : "admin"
    const res = await updateUserRole(user.id, newRole)
    if (res.error) toast.error(res.error)
    else toast.success(`Đã cập nhật quyền thành ${newRole === "admin" ? "Quản trị viên" : "Nhân viên"}`)
    setIsUpdating(false)
  }

  async function handlePasswordReset(event: React.FormEvent) {
    event.preventDefault()
    setIsUpdating(true)
    const result = await resetUserPassword(user.id, password)
    setIsUpdating(false)
    if (result.error) return toast.error(result.error)
    toast.success("Đã đổi mật khẩu và đăng xuất mọi phiên của tài khoản này")
    setPassword("")
    setResetOpen(false)
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" disabled={isUpdating} />}>
        <span className="sr-only">Mở menu</span>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleRoleChange} className="cursor-pointer">
          {user.role === "admin" ? (
            <><ShieldAlert className="w-4 h-4 mr-2" /> Giáng cấp xuống Nhân viên</>
          ) : (
            <><ShieldCheck className="w-4 h-4 mr-2" /> Thăng cấp lên Quản trị</>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleToggleLock} className="cursor-pointer text-red-600 focus:text-red-600">
          {isLocked ? (
            <><Unlock className="w-4 h-4 mr-2" /> Mở khóa đăng nhập</>
          ) : (
            <><Lock className="w-4 h-4 mr-2" /> Khóa tài khoản</>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setResetOpen(true)} className="cursor-pointer">
          <KeyRound className="mr-2 h-4 w-4" /> Đặt lại mật khẩu
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={resetOpen} onOpenChange={setResetOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Đặt lại mật khẩu</DialogTitle></DialogHeader>
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`reset-password-${user.id}`}>Mật khẩu mới</Label><Input id={`reset-password-${user.id}`} type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={256} autoComplete="new-password" required /><p className="text-xs text-muted-foreground">Ít nhất 12 ký tự, có chữ và số.</p></div>
          <Button type="submit" className="w-full" disabled={isUpdating}>{isUpdating ? "Đang đổi..." : "Đổi mật khẩu"}</Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
