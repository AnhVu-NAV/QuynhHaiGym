"use client"
import { Search } from "lucide-react"
import { Input } from "./input"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

const DEFAULT_RESET_PAGE_PARAMS = ["page"]

export function SearchInput({
  placeholder = "Tìm kiếm...",
  resetPageParams = DEFAULT_RESET_PAGE_PARAMS,
}: {
  placeholder?: string
  resetPageParams?: string[]
}) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const initialSearch = searchParams.get("q") || ""
  const [searchTerm, setSearchTerm] = useState(initialSearch)

  useEffect(() => {
    const currentQ = searchParams.get("q") || ""
    if (searchTerm === currentQ) return; // Tránh loop vô tận

    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (searchTerm) {
        params.set("q", searchTerm)
      } else {
        params.delete("q")
      }
      
      resetPageParams.forEach((param) => params.set(param, "1"))
      
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, 400) // 400ms debounce

    return () => clearTimeout(delayDebounceFn)
  }, [pathname, resetPageParams, router, searchParams, searchTerm])

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        className="pl-8 bg-white h-9"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>
  )
}
