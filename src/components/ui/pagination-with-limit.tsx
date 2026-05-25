"use client"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

export function PaginationWithLimit({
  totalPages,
  totalItems,
}: {
  totalPages: number
  totalItems: number
}) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const currentPage = Number(searchParams.get("page")) || 1
  const limit = Number(searchParams.get("limit")) || 20

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleLimitChange = (newLimit: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("limit", newLimit)
    params.set("page", "1") // Reset to page 1
    router.push(`${pathname}?${params.toString()}`)
  }

  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-1 border-t mt-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-slate-500">
          Tổng cộng <span className="font-semibold text-slate-900">{totalItems}</span> kết quả
        </p>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-500">Hiển thị:</p>
          <Select value={limit.toString()} onValueChange={handleLimitChange}>
            <SelectTrigger className="h-8 w-[70px] bg-white">
              <SelectValue placeholder={limit.toString()} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-slate-500 font-medium w-[80px] text-center">
            Trang {currentPage} / {Math.max(1, totalPages)}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
