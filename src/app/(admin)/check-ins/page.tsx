import { getRecentCheckIns, getRecentFailedCheckIns } from "@/actions/checkin-actions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, ExternalLink } from "lucide-react"
import Link from "next/link"

import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"

export default async function AdminCheckInsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 10
  const failedPage = typeof awaitedParams.failedPage === 'string' ? Number(awaitedParams.failedPage) : 1
  const failedLimit = typeof awaitedParams.failedLimit === 'string' ? Number(awaitedParams.failedLimit) : 10

  const [{ data: checkIns, totalPages, totalItems }, { data: failedCheckIns, totalPages: failedTotalPages, totalItems: failedTotalItems }] = await Promise.all([
    getRecentCheckIns(q, page, limit),
    getRecentFailedCheckIns(q, failedPage, failedLimit),
  ])

  const reasonLabel: Record<string, string> = {
    subscription_expired: "Gói tập đã hết hạn",
    member_inactive: "Hội viên đang bị khóa",
    unmapped_face: "Khuôn mặt chưa liên kết",
    missing_enroll_id: "Máy không gửi mã hội viên",
  }

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
          <PaginationWithLimit totalPages={totalPages} totalItems={totalItems} defaultLimit={10} />
        </CardContent>
      </Card>

      <Card id="failed-check-ins" className="shadow-sm border-red-200 scroll-mt-6">
        <CardHeader className="pb-4 bg-red-50/60 rounded-t-xl border-b border-red-100">
          <CardTitle className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            Check-in không hợp lệ gần đây
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden">
          <div className="grid gap-3 p-4 md:hidden">
            {failedCheckIns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg">
                Chưa có lượt check-in bị từ chối.
              </div>
            ) : failedCheckIns.map((attempt) => (
              <Card key={attempt.id} className="p-4 shadow-sm border-red-100">
                <div className="flex justify-between items-start gap-3">
                  <span className="text-xs text-slate-500 font-medium">
                    {new Date(attempt.attemptedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                  </span>
                  <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase">Bị từ chối</span>
                </div>
                <div className="font-semibold text-slate-800 mt-3">
                  {attempt.member?.fullName || `Mã máy #${attempt.enrollId ?? "không rõ"}`}
                </div>
                {attempt.member?.phoneNumber && (
                  <div className="text-sm text-muted-foreground mt-0.5">{attempt.member.phoneNumber}</div>
                )}
                <div className="text-sm font-medium text-red-700 mt-2">
                  {reasonLabel[attempt.reason] || attempt.message || "Không hợp lệ"}
                </div>
              </Card>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <Table className="min-w-[720px] sm:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Hội viên</TableHead>
                  <TableHead>Số điện thoại</TableHead>
                  <TableHead>Nguồn</TableHead>
                  <TableHead>Lý do từ chối</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedCheckIns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Chưa có lượt check-in bị từ chối.
                    </TableCell>
                  </TableRow>
                ) : failedCheckIns.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {new Date(attempt.attemptedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {attempt.member?.fullName || `Mã máy #${attempt.enrollId ?? "không rõ"}`}
                    </TableCell>
                    <TableCell>{attempt.member?.phoneNumber || "—"}</TableCell>
                    <TableCell>{attempt.source === "ai26" ? "Máy AI26" : "Web"}</TableCell>
                    <TableCell>
                      <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                        {reasonLabel[attempt.reason] || attempt.message || "Không hợp lệ"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationWithLimit totalPages={failedTotalPages} totalItems={failedTotalItems} pageParam="failedPage" limitParam="failedLimit" defaultLimit={10} />
        </CardContent>
      </Card>
    </div>
  )
}
