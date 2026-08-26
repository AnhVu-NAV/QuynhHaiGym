"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error("Admin route error", error)
  }, [error])

  return (
    <div className="flex min-h-[420px] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Chưa tải được dữ liệu</h2>
        <p className="mt-2 text-sm text-slate-600">
          Kết nối có thể vừa bị gián đoạn. Dữ liệu của bạn không bị mất; hãy thử tải lại phần này.
        </p>
        {error.digest && <p className="mt-2 text-xs text-slate-400">Mã lỗi: {error.digest}</p>}
        <Button onClick={() => unstable_retry()} className="mt-5 gap-2">
          <RotateCcw className="h-4 w-4" /> Thử lại
        </Button>
      </div>
    </div>
  )
}
