"use client"

import { ChevronDown, Filter } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

type QueryFilterProps = {
  param: string
  label: string
  options: Array<{ value: string; label: string }>
  resetPageParams?: string[]
  defaultValue?: string
  compact?: boolean
  className?: string
}

export function QueryFilter({ param, label, options, resetPageParams = ["page"], defaultValue = "all", compact = false, className }: QueryFilterProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const value = searchParams.get(param) || defaultValue

  return (
    <label className={cn("relative flex min-w-0 items-center", compact ? "sm:min-w-40" : "min-w-40", className)}>
      <span className="sr-only">{label}</span>
      <Filter className={cn("pointer-events-none absolute h-4 w-4", compact ? "left-2.5 text-slate-400" : "left-3 text-slate-400")} />
      <select
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString())
          if (event.target.value === "all" && defaultValue === "all") params.delete(param)
          else params.set(param, event.target.value)
          resetPageParams.forEach((pageParam) => params.set(pageParam, "1"))
          router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }}
        className={cn(
          "w-full appearance-none border border-slate-200 bg-white font-medium text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100",
          compact ? "h-9 rounded-xl pl-8 pr-8 text-xs sm:text-sm" : "h-9 rounded-lg pl-9 pr-8 text-sm",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
    </label>
  )
}
