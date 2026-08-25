"use client"

import { useState } from "react"
import { MoreHorizontal, ShieldAlert, ShieldCheck, Lock, Unlock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toggleUserLock, updateUserRole } from "@/actions/user-actions"
import { toast } from "sonner"

type ManagedUser = {
  id: string
  role: string
  isLocked: boolean
}

export function UserActionsMenu({ user }: { user: ManagedUser }) {
  const [isUpdating, setIsUpdating] = useState(false)
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

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
