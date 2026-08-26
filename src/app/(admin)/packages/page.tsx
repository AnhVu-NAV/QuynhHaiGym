import { getPackages } from "@/actions/package-actions"
import { PackageDialog } from "@/components/packages/package-dialog"
import { DeletePackageButton } from "@/components/packages/delete-package-button"
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

export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 20
  const status = typeof awaitedParams.status === 'string' ? awaitedParams.status : "all"

  const { data: packages, totalPages, totalItems } = await getPackages(q, page, limit, status)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gói tập</h2>
          <p className="text-muted-foreground mt-1">Quản lý các gói thẻ hội viên và bảng giá.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="min-w-48 flex-1"><SearchInput placeholder="Tìm tên gói tập..." /></div>
          <QueryFilter param="status" label="Trạng thái gói" options={[{ value: "all", label: "Tất cả gói" }, { value: "active", label: "Đang mở bán" }, { value: "inactive", label: "Đã ẩn" }]} />
          <PackageDialog mode="create" />
        </div>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <CardTitle>Danh sách Gói tập</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden">
          {/* Mobile View */}
          <div className="grid gap-3 p-4 md:hidden">
            {packages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg">
                Chưa có gói tập nào.
              </div>
            ) : (
              packages.map((pkg) => (
                <Card key={pkg.id} className="p-4 shadow-sm border-slate-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold text-slate-800 text-lg">{pkg.name}</div>
                    {pkg.isActive ? (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-semibold">Đang mở bán</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[11px] font-semibold">Đã ẩn</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 my-2">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(pkg.price)}
                  </div>
                  <div className="text-sm text-slate-600">
                    Thời hạn: <span className="font-medium">{pkg.durationMonths} Tháng</span>
                  </div>
                  <div className="mt-4 pt-3 border-t flex items-center justify-end gap-2">
                    <PackageDialog mode="edit" packageData={pkg} />
                    <DeletePackageButton id={pkg.id} />
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="min-w-[500px] sm:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Tên gói</TableHead>
                  <TableHead className="whitespace-nowrap">Giá (VNĐ)</TableHead>
                  <TableHead className="whitespace-nowrap">Thời hạn</TableHead>
                  <TableHead className="whitespace-nowrap">Trạng thái</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Chưa có gói tập nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  packages.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-medium whitespace-nowrap">{pkg.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(pkg.price)}</TableCell>
                      <TableCell className="whitespace-nowrap">{pkg.durationMonths} Tháng</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {pkg.isActive ? (
                          <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-semibold">Đang mở bán</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-semibold">Đã ẩn</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap space-x-2">
                        <PackageDialog mode="edit" packageData={pkg} />
                        <DeletePackageButton id={pkg.id} />
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
    </div>
  )
}
