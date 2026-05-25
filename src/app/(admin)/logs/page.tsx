import { getAuditLogs } from "@/actions/audit-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 20

  const { data: logs, totalPages, totalItems } = await getAuditLogs(q, page, limit)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Nhật ký hệ thống</h2>
          <p className="text-muted-foreground mt-1">Theo dõi lịch sử thao tác của tất cả nhân viên trên hệ thống.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SearchInput placeholder="Tìm theo thao tác, dữ liệu..." />
        </div>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <CardTitle>Danh sách Nhật ký</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px] sm:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Thời gian</TableHead>
                  <TableHead className="whitespace-nowrap">Nhân viên (Clerk ID)</TableHead>
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
                        {new Date(log.createdAt).toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-slate-700">
                        {/* Note: In a real app we'd map Clerk ID to Name by querying clerkClient. 
                            For performance, showing ID is standard for audit logs unless joined. */}
                        <span className="truncate w-32 inline-block" title={log.userId}>{log.userId}</span>
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
          <PaginationWithLimit totalPages={totalPages} totalItems={totalItems} />
        </CardContent>
      </Card>
    </div>
  )
}
