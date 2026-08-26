import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { LogoutButton } from "@/components/auth/logout-button"
import { requireUser } from "@/lib/auth"
import { ChangePasswordButton } from "@/components/auth/change-password-button"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  if (user.role !== "admin" && user.role !== "staff") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 bg-slate-50">
        <h1 className="text-2xl font-bold text-red-600">Không có quyền truy cập</h1>
        <p className="text-slate-600">Tài khoản {user.email || user.username} không thuộc hệ thống nhân sự.</p>
        <LogoutButton />
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar role={user.role} />
      <main className="flex h-svh w-full min-w-0 flex-col bg-transparent">
        <header className="sticky top-0 z-30 flex h-16 w-full items-center gap-4 border-b border-white/60 bg-white/80 px-4 shadow-sm backdrop-blur-xl sm:px-6">
          <SidebarTrigger className="rounded-xl border border-slate-200 bg-white" />
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block"><div className="text-sm font-semibold text-slate-800">{user.fullName || user.email || user.username}</div><div className="text-xs text-slate-500">{user.role === "admin" ? "Quản trị viên" : "Nhân viên"}</div></div>
            <ChangePasswordButton />
            <LogoutButton />
          </div>
        </header>
        <div className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </SidebarProvider>
  )
}
