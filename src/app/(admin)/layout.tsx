import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { UserButton } from "@clerk/nextjs"
import { currentUser } from "@clerk/nextjs/server"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await currentUser()
  const userEmail = user?.emailAddresses[0]?.emailAddress || ""
  
  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Vui lòng đăng nhập</h1>
      </div>
    )
  }

  // Find user in DB
  let role = "none"
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id)
  })

  if (dbUser) {
    role = dbUser.role
  } else {
    // Fallback: Check if they are the root admin based on ENV
    const allowedEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",") : []
    if (allowedEmails.includes(userEmail)) {
      role = "admin"
    }
  }

  if (role !== "admin" && role !== "staff") {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 space-y-4">
        <h1 className="text-2xl font-bold text-red-600">Không có quyền truy cập</h1>
        <p className="text-slate-600">Tài khoản {userEmail} không thuộc hệ thống nhân sự.</p>
        <UserButton />
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <main className="w-full h-full flex flex-col bg-background min-w-0">
        <header className="flex h-16 items-center px-6 border-b bg-card gap-4 w-full">
          <SidebarTrigger />
          <div className="ml-auto flex items-center space-x-4">
            <UserButton />
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6 overflow-auto min-w-0">
          {children}
        </div>
      </main>
    </SidebarProvider>
  )
}
