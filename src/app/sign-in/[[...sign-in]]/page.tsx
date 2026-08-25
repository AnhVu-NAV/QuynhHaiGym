import { redirect } from "next/navigation"
import { Dumbbell } from "lucide-react"
import { LoginForm } from "@/components/auth/login-form"
import { getCurrentUser } from "@/lib/auth"

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/")

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-2xl border bg-white p-7 shadow-xl sm:p-9">
        <div className="mb-8 text-center">
          <Dumbbell className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
          <h1 className="text-3xl font-bold text-slate-900">Quỳnh Hải Gym</h1>
          <p className="mt-2 text-slate-500">Đăng nhập hệ thống quản trị nội bộ</p>
        </div>
        <LoginForm />
      </section>
    </main>
  )
}
