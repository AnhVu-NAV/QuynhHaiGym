"use client"

import { useState } from "react"
import { KeyRound } from "lucide-react"
import { changeOwnPassword } from "@/actions/auth-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export function ChangePasswordButton() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(formData: FormData) {
    setPending(true)
    const result = await changeOwnPassword(formData)
    setPending(false)
    if (result?.error) toast.error(result.error)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
        <KeyRound className="h-4 w-4" />
        <span className="hidden lg:inline">Đổi mật khẩu</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Đổi mật khẩu đăng nhập</DialogTitle></DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="currentPassword">Mật khẩu hiện tại</Label><Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required /></div>
          <div className="space-y-2"><Label htmlFor="newPassword">Mật khẩu mới</Label><Input id="newPassword" name="newPassword" type="password" minLength={12} maxLength={256} autoComplete="new-password" required /><p className="text-xs text-muted-foreground">Ít nhất 12 ký tự, có chữ và số.</p></div>
          <div className="space-y-2"><Label htmlFor="confirmation">Nhập lại mật khẩu mới</Label><Input id="confirmation" name="confirmation" type="password" minLength={12} maxLength={256} autoComplete="new-password" required /></div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Đang đổi..." : "Đổi mật khẩu và đăng xuất"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
