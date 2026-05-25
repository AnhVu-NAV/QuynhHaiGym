import { getMembers } from "@/actions/member-actions"
import { getPackages } from "@/actions/package-actions"
import { getGymSettings } from "@/actions/settings-actions"
import { MemberDialog } from "@/components/members/member-dialog"
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
import { DeleteMemberButton } from "@/components/members/delete-member-button"
import Link from "next/link"
import { ExternalLink, CreditCard } from "lucide-react"
import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"
import { Button } from "@/components/ui/button"

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 20

  const { data: members, totalPages, totalItems } = await getMembers(q, page, limit)
  const { data: packages } = await getPackages(undefined, 1, 1000)
  const settings = await getGymSettings()

  const activePackages = packages.filter(p => p.isActive)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Hội viên</h2>
          <p className="text-muted-foreground mt-1">Quản lý thông tin và thẻ hội viên.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SearchInput placeholder="Tìm tên hoặc SĐT..." />
          <MemberDialog mode="create" packages={activePackages} settings={settings || undefined} />
        </div>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <CardTitle>Danh sách Hội viên</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 overflow-hidden">
          {/* Mobile View */}
          <div className="grid gap-4 p-4 md:hidden">
            {members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg">
                Chưa có hội viên nào.
              </div>
            ) : (
              members.map((member) => {
                const latestSub = member.subscriptions?.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
                const isExpired = latestSub ? new Date(latestSub.endDate) < new Date() : true;
                return (
                  <Card key={member.id} className="p-4 shadow-sm border-slate-200">
                    <div className="flex items-start gap-3">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt="avatar" className="w-24 h-24 rounded-full object-cover border-2 border-slate-200 shrink-0" />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-500 border-2 border-slate-200 shrink-0">
                          {member.fullName.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 text-base truncate">{member.fullName}</div>
                        <div className="text-sm text-muted-foreground mt-0.5">{member.phoneNumber} • {member.gender === 'male' ? 'Nam' : member.gender === 'female' ? 'Nữ' : 'Khác'}</div>
                        {latestSub && (
                          <div className="text-sm text-slate-600 mt-1">
                            Gói: <span className="font-medium text-emerald-600">{latestSub.package.name}</span>
                          </div>
                        )}
                        <div className="mt-2">
                          {latestSub ? (
                            isExpired ? (
                              <Badge variant="destructive" className="font-medium text-xs">Đã hết hạn</Badge>
                            ) : (
                              <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-semibold text-xs border-0">
                                Còn hạn đến {new Date(latestSub.endDate).toLocaleDateString('vi-VN')}
                              </Badge>
                            )
                          ) : (
                            <Badge variant="secondary" className="font-medium text-xs">Chưa đăng ký gói</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t flex items-center justify-end gap-2">
                      <Link
                        href={`/my-card/${member.phoneNumber}`}
                        target="_blank"
                        className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors border border-indigo-200 bg-transparent hover:bg-indigo-50 text-indigo-600 h-8 rounded-md px-3 text-xs"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" /> Thẻ Ảo
                      </Link>
                      <MemberDialog mode="edit" memberData={member} packages={activePackages} settings={settings || undefined} />
                      <DeleteMemberButton id={member.id} />
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
                  <TableHead className="whitespace-nowrap">Họ tên</TableHead>
                  <TableHead className="whitespace-nowrap">Số điện thoại</TableHead>
                  <TableHead className="whitespace-nowrap">Giới tính</TableHead>
                  <TableHead className="whitespace-nowrap">Trạng thái thẻ</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Chưa có hội viên nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => {
                    const latestSub = member.subscriptions?.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
                    const isExpired = latestSub ? new Date(latestSub.endDate) < new Date() : true;

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full object-cover border" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 border">
                                {member.fullName.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-800">{member.fullName}</div>
                              {latestSub && (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  Gói: <span className="font-medium text-emerald-600">{latestSub.package.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{member.phoneNumber}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {member.gender === 'male' ? 'Nam' : member.gender === 'female' ? 'Nữ' : 'Khác'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {latestSub ? (
                            isExpired ? (
                              <Badge variant="destructive" className="font-medium text-xs">Đã hết hạn</Badge>
                            ) : (
                              <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-semibold text-xs border-0">
                                Còn hạn đến {new Date(latestSub.endDate).toLocaleDateString('vi-VN')}
                              </Badge>
                            )
                          ) : (
                            <Badge variant="secondary" className="font-medium text-xs">Chưa đăng ký gói</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap space-x-2">
                          <Link
                            href={`/my-card/${member.phoneNumber}`}
                            target="_blank"
                            className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-indigo-200 bg-transparent shadow-sm hover:bg-indigo-50 hover:text-indigo-900 text-indigo-600 h-8 rounded-md px-2 text-xs"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" /> Thẻ Ảo
                          </Link>
                          <MemberDialog mode="edit" memberData={member} packages={activePackages} settings={settings || undefined} />
                          <DeleteMemberButton id={member.id} />
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
