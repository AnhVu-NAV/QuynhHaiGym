import { LogOut } from "lucide-react"
import { logout } from "@/actions/auth-actions"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="h-4 w-4" />
        Đăng xuất
      </Button>
    </form>
  )
}
