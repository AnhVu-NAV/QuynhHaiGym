import { getClasses } from "@/actions/class-actions"
import { getTrainers } from "@/actions/trainer-actions"
import { ClassDialog } from "@/components/classes/class-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"
import { QueryFilter } from "@/components/ui/query-filter"

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 20
  const status = typeof awaitedParams.status === 'string' ? awaitedParams.status : "all"

  const { data: classes, totalPages, totalItems } = await getClasses(q, page, limit, false, status)
  const { data: trainers } = await getTrainers(undefined, 1, 1000, true)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Lớp nhóm</h2>
          <p className="text-muted-foreground mt-1">Quản lý danh mục các Lớp Yoga, Zumba, Aerobic...</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="min-w-48 flex-1"><SearchInput placeholder="Tìm tên lớp học..." /></div>
          <QueryFilter param="status" label="Trạng thái lớp" options={[{ value: "all", label: "Tất cả lớp" }, { value: "active", label: "Đang mở" }, { value: "inactive", label: "Tạm ngưng" }]} />
          <ClassDialog trainers={trainers} />
        </div>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <CardTitle>Danh mục Lớp nhóm</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden">
          {/* Mobile View */}
          <div className="grid gap-3 p-4 md:hidden">
            {classes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg">
                Chưa có lớp nhóm nào.
              </div>
            ) : (
              classes.map((cls) => (
                <Card key={cls.id} className="p-4 shadow-sm border-slate-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-slate-800 text-lg">{cls.name}</div>
                    {cls.isActive ? (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md text-xs font-medium shrink-0">Đang mở</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-xs font-medium shrink-0">Tạm ngưng</span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 line-clamp-2 mb-3">
                    {cls.description}
                  </div>
                  <div className="flex flex-col gap-1 text-sm bg-slate-50 p-3 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">HLV Phụ trách:</span>
                      <span className="font-semibold text-indigo-700">{cls.trainer?.fullName || "Chưa phân công"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Sức chứa tối đa:</span>
                      <span className="font-medium text-slate-800">{cls.capacity} học viên</span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="min-w-[700px] sm:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Tên Lớp</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead>HLV Phụ trách</TableHead>
                  <TableHead>Sức chứa</TableHead>
                  <TableHead className="text-right">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Chưa có lớp nhóm nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  classes.map((cls) => (
                    <TableRow key={cls.id}>
                      <TableCell className="font-bold text-slate-800">{cls.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">{cls.description}</TableCell>
                      <TableCell>{cls.trainer?.fullName || "Chưa phân công"}</TableCell>
                      <TableCell>{cls.capacity} học viên</TableCell>
                      <TableCell className="text-right">
                        {cls.isActive ? (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-medium">Đang mở</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs font-medium">Tạm ngưng</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationWithLimit totalPages={totalPages} totalItems={totalItems} />
        </CardContent>
      </Card>
      
      <div className="text-sm text-slate-500 text-center py-4">
        Tính năng Mở lịch học cho từng lớp và Cho phép Hội viên đăng ký vào suất học đang được hoàn thiện.
      </div>
    </div>
  )
}
