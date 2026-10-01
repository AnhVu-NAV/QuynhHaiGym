"use client"

import { useState } from "react"
import { CalendarRange, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

export function DateRangeFilter({ resetPageParams = ["page"] }: { resetPageParams?: string[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [from, setFrom] = useState(searchParams.get("from") || "")
  const [to, setTo] = useState(searchParams.get("to") || "")

  function apply() {
    const params = new URLSearchParams(searchParams.toString())
    if (from) params.set("from", from)
    else params.delete("from")
    if (to) params.set("to", to)
    else params.delete("to")
    if (from || to) params.delete("period")
    resetPageParams.forEach((key) => params.set(key, "1"))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function clear() {
    setFrom("")
    setTo("")
    const params = new URLSearchParams(searchParams.toString())
    params.delete("from")
    params.delete("to")
    resetPageParams.forEach((key) => params.set(key, "1"))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-[11px] font-semibold text-slate-500">
        Từ ngày
        <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
      </label>
      <label className="min-w-0 flex-1 text-[11px] font-semibold text-slate-500">
        Đến ngày
        <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="mt-1 h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
      </label>
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={apply} className="h-9 flex-1 sm:flex-none"><CalendarRange className="mr-1.5 h-4 w-4" />Lọc</Button>
        {(from || to || searchParams.get("from") || searchParams.get("to")) && (
          <Button type="button" size="icon" variant="ghost" onClick={clear} className="h-9 w-9 shrink-0" aria-label="Xóa khoảng ngày"><X className="h-4 w-4" /></Button>
        )}
      </div>
    </div>
  )
}
