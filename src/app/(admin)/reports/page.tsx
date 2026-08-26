import { getExpiringMembers } from "@/actions/report-actions"
import { ExportButton } from "@/components/reports/export-button"
import { ZaloButton } from "@/components/reports/zalo-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q : ""
  const page = typeof params.page === "string" ? Number(params.page) : 1
  const limit = typeof params.limit === "string" ? Number(params.limit) : 20
  const { data: expiringSubs, totalPages, totalItems } = await getExpiringMembers(q, page, limit)

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Báo cáo & Chăm sóc</h2>
          <p className="text-muted-foreground mt-1">Danh sách cần gọi điện chăm sóc và Xuất dữ liệu.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto"><div className="min-w-52 flex-1"><SearchInput placeholder="Tìm tên hoặc SĐT..." /></div><ExportButton /></div>
      </div>

      <Card className="shadow-sm border-orange-200">
        <CardHeader className="pb-4 bg-orange-50/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-orange-800">Sắp hết hạn gói tập (trong 7 ngày tới)</CardTitle>
          </div>
          <CardDescription className="text-orange-700/80">
            Danh sách ưu tiên gọi điện chăm sóc để nhắc nhở và tư vấn gia hạn.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hội viên</TableHead>
                <TableHead>Số điện thoại</TableHead>
                <TableHead>Gói đang dùng</TableHead>
                <TableHead>Ngày hết hạn</TableHead>
                <TableHead className="text-right">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expiringSubs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    Tuyệt vời! Không có hội viên nào sắp hết hạn trong tuần tới.
                  </TableCell>
                </TableRow>
              ) : (
                expiringSubs.map((sub) => {
                  const daysLeft = Math.ceil((new Date(sub.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
                  
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium text-slate-800">
                        {sub.member.fullName}
                      </TableCell>
                      <TableCell className="font-medium">{sub.member.phoneNumber}</TableCell>
                      <TableCell>{sub.package.name}</TableCell>
                      <TableCell className="font-bold text-orange-600">
                        {new Date(sub.endDate).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2">
                        <ZaloButton 
                          phoneNumber={sub.member.phoneNumber} 
                          memberName={sub.member.fullName}
                          daysLeft={daysLeft}
                          endDate={new Date(sub.endDate).toLocaleDateString('vi-VN')}
                        />
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">
                          Còn {daysLeft} ngày
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          <PaginationWithLimit totalPages={totalPages} totalItems={totalItems} />
        </CardContent>
      </Card>
      
      <div className="text-sm text-slate-500 text-center py-4">
        (Báo cáo tổng hợp doanh thu nâng cao đang được phát triển trong phiên bản tiếp theo)
      </div>
    </div>
  )
}
