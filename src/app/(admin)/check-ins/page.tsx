import { getRecentCheckIns } from "@/actions/checkin-actions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink } from "lucide-react"
import Link from "next/link"

import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"

export default async function AdminCheckInsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 20

  const { data: checkIns, totalPages, totalItems } = await getRecentCheckIns(q, page, limit)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Lịch sử Check-in</h2>
          <p className="text-muted-foreground mt-1">Theo dõi lượt ra vào của hội viên trong phòng tập.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SearchInput placeholder="Tìm tên hoặc SĐT..." />
          <Link 
            href="/check-in" 
            target="_blank"
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:bg-primary/90 transition-colors h-9 whitespace-nowrap shrink-0"
          >
            Mở Màn Hình Check-in <ExternalLink className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <CardTitle>Danh sách Check-in</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden">
          {/* Mobile View */}
          <div className="grid gap-3 p-4 md:hidden">
            {checkIns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg">
                Chưa có lịch sử check-in.
              </div>
            ) : (
              checkIns.map((ci) => (
                <Card key={ci.id} className="p-4 shadow-sm border-slate-200">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-slate-500 font-medium">{new Date(ci.checkInTime).toLocaleString('vi-VN')}</span>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase">Hợp lệ</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {ci.member.avatarUrl ? (
                      <img src={ci.member.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full object-cover border shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 border shrink-0">
                        {ci.member.fullName.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-base truncate">{ci.member.fullName}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{ci.member.phoneNumber}</div>
                    </div>
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
                  <TableHead className="whitespace-nowrap">Thời gian</TableHead>
                  <TableHead className="whitespace-nowrap">Hội viên</TableHead>
                  <TableHead className="whitespace-nowrap">Số điện thoại</TableHead>
                  <TableHead className="whitespace-nowrap">Trạng thái thẻ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkIns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                      Chưa có lịch sử check-in.
                    </TableCell>
                  </TableRow>
                ) : (
                  checkIns.map((ci) => (
                    <TableRow key={ci.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {new Date(ci.checkInTime).toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {ci.member.avatarUrl ? (
                            <img src={ci.member.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover border shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                              {ci.member.fullName.charAt(0)}
                            </div>
                          )}
                          {ci.member.fullName}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{ci.member.phoneNumber}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-semibold">Hợp lệ</span>
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
