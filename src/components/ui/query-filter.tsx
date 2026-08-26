"use client"

import { Filter } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type QueryFilterProps = {
  param: string
  label: string
  options: Array<{ value: string; label: string }>
  resetPageParams?: string[]
}

export function QueryFilter({ param, label, options, resetPageParams = ["page"] }: QueryFilterProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const value = searchParams.get(param) || "all"

  return (
    <label className="relative flex min-w-40 items-center">
      <span className="sr-only">{label}</span>
      <Filter className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
      <select
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString())
          if (event.target.value === "all") params.delete(param)
          else params.set(param, event.target.value)
          resetPageParams.forEach((pageParam) => params.set(pageParam, "1"))
          router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }}
        className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}
