import { getPTSessions } from "@/actions/schedule-actions"
import { getTrainers } from "@/actions/trainer-actions"
import { getMembers } from "@/actions/member-actions"
import { ScheduleDialog } from "@/components/schedule/schedule-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 20

  const { data: sessions, totalPages, totalItems } = await getPTSessions(q, page, limit)
  const { data: trainers } = await getTrainers(undefined, 1, 1000, true)
  
  // For booking, we need all active members
  const { data: allMembers } = await getMembers(undefined, 1, 1000)
  const activeMembers = allMembers.filter(m => m.status === 'active')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Lịch tập PT</h2>
          <p className="text-muted-foreground mt-1">Quản lý lịch tập cá nhân 1 kèm 1 giữa HLV và Hội viên.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SearchInput placeholder="Tìm tên HV hoặc PT..." />
          <ScheduleDialog trainers={trainers} members={activeMembers} />
        </div>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <CardTitle>Danh sách lịch tập</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden">
          {/* Mobile View */}
          <div className="grid gap-3 p-4 md:hidden">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg">
                Chưa có lịch tập nào.
              </div>
            ) : (
              sessions.map((session) => {
                const startDate = new Date(session.startTime)
                const endDate = new Date(session.endTime)
                return (
                  <Card key={session.id} className="p-4 shadow-sm border-slate-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-slate-800 text-lg">
                          {startDate.toLocaleDateString('vi-VN')}
                        </div>
                        <div className="text-sm font-medium text-emerald-600">
                          {startDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} - {endDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                      {session.status === 'scheduled' ? (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0">Sắp diễn ra</span>
                      ) : session.status === 'completed' ? (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0">Hoàn thành</span>
                      ) : (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0">Đã hủy</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Huấn luyện viên:</span>
                        <span className="font-medium text-slate-800">{session.trainer.fullName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hội viên:</span>
                        <span className="font-medium text-slate-800">{session.member.fullName}</span>
                      </div>
                      {session.notes && (
                        <div className="mt-2 pt-2 border-t">
                          <span className="text-xs text-muted-foreground block mb-1">Ghi chú:</span>
                          <p className="text-sm text-slate-600 line-clamp-2">{session.notes}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="min-w-[700px] sm:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày tập</TableHead>
                  <TableHead>Giờ tập</TableHead>
                  <TableHead>Huấn luyện viên</TableHead>
                  <TableHead>Hội viên</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      Chưa có lịch tập nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => {
                    const startDate = new Date(session.startTime)
                    const endDate = new Date(session.endTime)
                    
                    return (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">
                          {startDate.toLocaleDateString('vi-VN')}
                        </TableCell>
                        <TableCell>
                          {startDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})} - 
                          {endDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                        </TableCell>
                        <TableCell>{session.trainer.fullName}</TableCell>
                        <TableCell>{session.member.fullName}</TableCell>
                        <TableCell>
                          {session.status === 'scheduled' ? (
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">Sắp diễn ra</span>
                          ) : session.status === 'completed' ? (
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium">Đã hoàn thành</span>
                          ) : (
                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">Đã hủy</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {session.notes || "-"}
                        </TableCell>
                      </TableRow>
                    )
                  })
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
