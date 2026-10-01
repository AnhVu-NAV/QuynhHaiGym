import { getAuditLogs } from "@/actions/audit-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"
import { requireAdmin } from "@/lib/auth"
import { formatVietnamDateTime } from "@/lib/vietnam-time"
import { QueryFilter } from "@/components/ui/query-filter"
import { DateRangeFilter } from "@/components/ui/date-range-filter"

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await requireAdmin()
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 10
  const filters = {
    period: typeof awaitedParams.period === "string" ? awaitedParams.period : "30d",
    from: typeof awaitedParams.from === "string" ? awaitedParams.from : undefined,
    to: typeof awaitedParams.to === "string" ? awaitedParams.to : undefined,
    action: typeof awaitedParams.action === "string" ? awaitedParams.action : "all",
    entity: typeof awaitedParams.entity === "string" ? awaitedParams.entity : "all",
  }

  const { data: logs, totalPages, totalItems } = await getAuditLogs(q, page, limit, filters)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Nhật ký hệ thống</h2>
          <p className="text-muted-foreground mt-1">Theo dõi lịch sử thao tác của nhân viên trong 12 tháng gần nhất.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SearchInput placeholder="Tìm theo thao tác, dữ liệu..." />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <QueryFilter param="period" label="Thời gian" defaultValue="30d" options={[{ value: "all", label: "Mọi thời gian" }, { value: "today", label: "Hôm nay" }, { value: "7d", label: "7 ngày" }, { value: "30d", label: "30 ngày" }, { value: "this_month", label: "Tháng này" }, { value: "last_month", label: "Tháng trước" }]} />
        <QueryFilter param="action" label="Hành động" options={[{ value: "all", label: "Mọi hành động" }, { value: "CREATE", label: "Tạo mới" }, { value: "UPDATE", label: "Cập nhật" }, { value: "DELETE", label: "Xóa / hủy" }]} />
        <QueryFilter param="entity" label="Phân hệ" options={[{ value: "all", label: "Mọi phân hệ" }, { value: "MEMBER", label: "Hội viên" }, { value: "SUBSCRIPTION", label: "Gói đã đăng ký" }, { value: "TRANSACTION", label: "Thu chi" }, { value: "DEVICE", label: "Máy AI26" }, { value: "USER", label: "Nhân viên" }]} />
        <div className="sm:col-span-2 xl:col-span-3"><DateRangeFilter /></div>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <CardTitle>Danh sách Nhật ký</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden">
          <div className="grid gap-3 p-3 md:hidden">
            {logs.length === 0 ? <div className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-500">Không tìm thấy nhật ký.</div> : logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2"><Badge variant={log.action === 'CREATE' ? 'default' : log.action === 'DELETE' ? 'destructive' : 'secondary'}>{log.action}</Badge><span className="text-xs text-slate-500">{formatVietnamDateTime(log.createdAt)}</span></div>
                <p className="mt-3 font-semibold text-slate-800">{log.entityType} #{log.entityId}</p>
                <p className="mt-1 text-xs text-slate-500">{log.user?.fullName || log.user?.email || log.user?.username || log.userId}</p>
                {log.details && <p className="mt-2 line-clamp-3 break-all text-xs text-slate-500">{log.details}</p>}
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[800px] sm:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Thời gian</TableHead>
                  <TableHead className="whitespace-nowrap">Nhân viên</TableHead>
                  <TableHead className="whitespace-nowrap">Hành động</TableHead>
                  <TableHead className="whitespace-nowrap">Phân hệ</TableHead>
                  <TableHead className="whitespace-nowrap">Mã dữ liệu</TableHead>
                  <TableHead>Chi tiết (JSON)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      Không tìm thấy lịch sử nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatVietnamDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-slate-700">
                        <span title={log.userId}>{log.user?.fullName || log.user?.email || log.user?.username || log.userId}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={log.action === 'CREATE' ? 'default' : log.action === 'DELETE' ? 'destructive' : 'secondary'}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold">
                        {log.entityType}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-slate-500">
                        #{log.entityId}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-xs truncate" title={log.details || ""}>
                        {log.details || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationWithLimit totalPages={totalPages} totalItems={totalItems} defaultLimit={10} />
        </CardContent>
      </Card>
    </div>
  )
}
