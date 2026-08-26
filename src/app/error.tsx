"use client"

import { useEffect } from "react"

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error("Application route error", error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-center">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Không tải được trang</h2>
        <p className="mt-2 text-sm text-slate-600">Vui lòng kiểm tra mạng rồi thử lại.</p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-5 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700"
        >
          Thử lại
        </button>
      </div>
    </main>
  )
}
