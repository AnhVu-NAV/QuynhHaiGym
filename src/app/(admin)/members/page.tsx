import { getMembers } from "@/actions/member-actions"
import { getPackages } from "@/actions/package-actions"
import { getGymSettings } from "@/actions/settings-actions"
import { getDevices } from "@/actions/device-actions"
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
import { BellRing, CheckCircle2, ExternalLink, History } from "lucide-react"
import { SearchInput } from "@/components/ui/search-input"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"
import { FaceEnrollmentButton } from "@/components/devices/face-enrollment-button"
import { SubscriptionDialog } from "@/components/subscriptions/subscription-dialog"
import { requireUser } from "@/lib/auth"
import { formatVietnamDate } from "@/lib/vietnam-time"
import { QueryFilter } from "@/components/ui/query-filter"
import { RefundDialog } from "@/components/transactions/refund-dialog"

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const currentUser = await requireUser()
  const awaitedParams = await searchParams
  const q = typeof awaitedParams.q === 'string' ? awaitedParams.q : ""
  const page = typeof awaitedParams.page === 'string' ? Number(awaitedParams.page) : 1
  const limit = typeof awaitedParams.limit === 'string' ? Number(awaitedParams.limit) : 20
  const membership = awaitedParams.membership === "expired" || awaitedParams.membership === "expiring"
    ? awaitedParams.membership
    : "valid"
  const expiry = typeof awaitedParams.expiry === "string" ? awaitedParams.expiry : "7"
  const packageId = typeof awaitedParams.package === "string" ? Number(awaitedParams.package) : undefined

  const [memberResult, packageResult, settings, deviceList] = await Promise.all([
    getMembers(q, page, limit, membership, expiry, packageId),
    getPackages(undefined, 1, 1000),
    getGymSettings(),
    getDevices(),
  ])
  const { data: members, totalPages, totalItems, counts } = memberResult
  const { data: packages } = packageResult

  const activePackages = packages.filter(p => p.isActive)
  const enrollmentDevices = deviceList.map((device) => ({
    id: device.id,
    name: device.name,
    serialNumber: device.serialNumber,
    online: device.online,
  }))
  const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY
  const cloudinaryCloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const tabHref = (value: "valid" | "expiring" | "expired") => {
    const params = new URLSearchParams()
    params.set("membership", value)
    if (q) params.set("q", q)
    if (limit !== 20) params.set("limit", String(limit))
    if (packageId) params.set("package", String(packageId))
    if (value === "expiring") params.set("expiry", expiry)
    params.set("page", "1")
    return `/members?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Hội viên</h2>
          <p className="text-muted-foreground mt-1">Quản lý thông tin và thẻ hội viên.</p>
        </div>
        <div className="w-full sm:w-auto">
          <MemberDialog mode="create" packages={activePackages} settings={settings || undefined} devices={enrollmentDevices} cloudinaryApiKey={cloudinaryApiKey} cloudinaryCloudName={cloudinaryCloudName} />
        </div>
      </div>

      <Card className="gap-0 border-muted py-0 shadow-sm">
        <CardHeader className="gap-4 border-b border-slate-200/80 px-3 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">Danh sách hội viên</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">Chọn nhóm để quản lý và gia hạn nhanh.</p>
            </div>
            <div className="w-full lg:w-80"><SearchInput placeholder="Tìm tên hoặc SĐT..." /></div>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:flex sm:w-fit">
            <Link
              href={tabHref("valid")}
              className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:min-w-40 ${membership === "valid" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="truncate">Còn hạn</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${membership === "valid" ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500"}`}>{counts.valid}</span>
            </Link>
            <Link
              href={tabHref("expiring")}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:min-w-40 sm:gap-2 sm:px-3 sm:text-sm ${membership === "expiring" ? "bg-white text-amber-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
            >
              <BellRing className="h-4 w-4 shrink-0" />
              <span className="truncate">Sắp hết hạn</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] sm:text-[11px] ${membership === "expiring" ? "bg-amber-100 text-amber-700" : "bg-white text-slate-500"}`}>{counts.expiring}</span>
            </Link>
            <Link
              href={tabHref("expired")}
              className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:min-w-40 ${membership === "expired" ? "bg-white text-rose-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
            >
              <History className="h-4 w-4 shrink-0" />
              <span className="truncate">Hết hạn</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${membership === "expired" ? "bg-rose-100 text-rose-700" : "bg-white text-slate-500"}`}>{counts.expired}</span>
            </Link>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {membership === "expiring" && (
              <QueryFilter param="expiry" label="Thời gian sắp hết hạn" options={[
                { value: "7", label: "Trong 7 ngày" },
                { value: "15", label: "Trong 15 ngày" },
                { value: "30", label: "Trong 30 ngày" },
                { value: "month", label: "Đến cuối tháng" },
              ]} />
            )}
            <QueryFilter param="package" label="Gói tập" options={[
              { value: "all", label: "Tất cả gói tập" },
              ...packages.map((item) => ({ value: String(item.id), label: item.name })),
            ]} />
          </div>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          {/* Mobile View */}
          <div className="grid gap-3 p-2 min-[360px]:p-3 sm:p-4 md:hidden">
            {members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg">
                {membership === "valid" ? "Chưa có hội viên còn hạn." : membership === "expiring" ? "Không có hội viên sắp hết hạn trong khoảng đã chọn." : "Chưa có hội viên hết hạn."}
              </div>
            ) : (
              members.map((member) => {
                const latestSub = member.subscriptions
                  ?.filter((subscription) => subscription.status !== "cancelled")
                  .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
                const isExpired = latestSub
                  ? latestSub.status !== "active" || new Date(latestSub.startDate) > new Date() || new Date(latestSub.endDate) < new Date()
                  : true;
                const refundableTransaction = latestSub?.transactions.find((transaction) =>
                  transaction.direction === "income"
                  && ["registration", "renewal"].includes(transaction.type)
                  && transaction.refunds.length === 0
                )
                return (
                  <Card key={member.id} className="relative gap-0 overflow-visible border-slate-200 p-3 shadow-sm min-[390px]:p-4">
                    <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 min-[390px]:right-3 min-[390px]:top-3">
                      <MemberDialog mode="edit" memberData={member} packages={activePackages} settings={settings || undefined} devices={enrollmentDevices} cloudinaryApiKey={cloudinaryApiKey} cloudinaryCloudName={cloudinaryCloudName} />
                      {currentUser.role === "admin" && <DeleteMemberButton id={member.id} />}
                    </div>
                    <div className="flex min-w-0 items-start gap-2.5 pr-[4.75rem] min-[390px]:gap-3 min-[390px]:pr-20">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={`Ảnh của ${member.fullName}`} className="h-14 w-14 shrink-0 rounded-full border-2 border-slate-200 object-cover min-[390px]:h-16 min-[390px]:w-16" />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-100 text-lg font-bold text-slate-500 min-[390px]:h-16 min-[390px]:w-16">
                          {member.fullName.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="line-clamp-2 text-sm font-semibold leading-tight text-slate-800 min-[390px]:text-base">{member.fullName}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground min-[390px]:text-sm">{member.phoneNumber} • {member.gender === 'male' ? 'Nam' : member.gender === 'female' ? 'Nữ' : 'Khác'}</div>
                        {latestSub && (
                          <div className="mt-1 truncate text-xs text-slate-600 min-[390px]:text-sm">
                            Gói: <span className="font-medium text-emerald-600">{latestSub.package.name}</span>
                          </div>
                        )}
                        <div className="mt-1.5">
                          {latestSub ? (
                            isExpired ? (
                              <Badge variant="destructive" className="h-5 max-w-full px-2 text-[10px] font-medium min-[390px]:text-xs">Đã hết hạn</Badge>
                            ) : (
                              <Badge variant="default" className="h-5 max-w-full truncate border-0 bg-emerald-100 px-2 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200 min-[390px]:text-xs">
                                Còn hạn đến {formatVietnamDate(latestSub.endDate)}
                              </Badge>
                            )
                          ) : (
                            <Badge variant="secondary" className="h-5 max-w-full truncate px-2 text-[10px] font-medium min-[390px]:text-xs">Chưa đăng ký gói</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 border-t pt-3">
                      <FaceEnrollmentButton
                        memberId={member.id}
                        devices={enrollmentDevices}
                        mappings={member.deviceMappings}
                        compact
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <SubscriptionDialog
                        memberId={member.id}
                        memberName={member.fullName}
                        packages={activePackages}
                        settings={settings || undefined}
                        activeSub={!isExpired && latestSub ? latestSub : undefined}
                        triggerClassName="h-9 w-full justify-center rounded-xl px-2 text-xs"
                      />
                      <Link
                        href={`/my-card/${member.publicToken}`}
                        target="_blank"
                        className="inline-flex h-9 w-full items-center justify-center whitespace-nowrap rounded-xl border border-indigo-200 bg-transparent px-2 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" /> Thẻ Ảo
                      </Link>
                      {currentUser.role === "admin" && refundableTransaction && (
                        <RefundDialog
                          transactionId={refundableTransaction.id}
                          memberName={member.fullName}
                          amount={refundableTransaction.amount}
                          paymentMethod={refundableTransaction.paymentMethod}
                          triggerLabel="Hủy gói & hoàn tiền"
                          triggerClassName="col-span-2 h-9 w-full justify-center rounded-xl text-xs"
                        />
                      )}
                    </div>
                  </Card>
                )
              })
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[900px]">
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-slate-50/80">
                  <TableHead className="h-11 pl-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Hội viên</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gói tập</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Khuôn mặt AI26</TableHead>
                  <TableHead className="pr-5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      {membership === "valid" ? "Chưa có hội viên còn hạn." : membership === "expiring" ? "Không có hội viên sắp hết hạn trong khoảng đã chọn." : "Chưa có hội viên hết hạn."}
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => {
                    const latestSub = member.subscriptions
                      ?.filter((subscription) => subscription.status !== "cancelled")
                      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
                    const isExpired = latestSub
                      ? latestSub.status !== "active" || new Date(latestSub.startDate) > new Date() || new Date(latestSub.endDate) < new Date()
                      : true;
                    const refundableTransaction = latestSub?.transactions.find((transaction) =>
                      transaction.direction === "income"
                      && ["registration", "renewal"].includes(transaction.type)
                      && transaction.refunds.length === 0
                    )

                    return (
                      <TableRow key={member.id} className="hover:bg-emerald-50/30">
                        <TableCell className="py-3 pl-5 font-medium">
                          <div className="flex items-center gap-3">
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt={`Ảnh của ${member.fullName}`} className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover" />
                            ) : (
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-500">
                                {member.fullName.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="max-w-56 truncate font-semibold text-slate-800">{member.fullName}</div>
                              <div className="mt-0.5 text-xs text-slate-500">
                                {member.phoneNumber} <span className="px-1 text-slate-300">•</span> {member.gender === 'male' ? 'Nam' : member.gender === 'female' ? 'Nữ' : 'Khác'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="mb-1.5 text-sm font-medium text-slate-700">{latestSub?.package.name || "Chưa đăng ký gói"}</div>
                          {latestSub ? (
                            isExpired ? (
                              <Badge variant="destructive" className="font-medium text-xs">Hết hạn {formatVietnamDate(latestSub.endDate)}</Badge>
                            ) : (
                              <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-semibold text-xs border-0">
                                Còn hạn đến {formatVietnamDate(latestSub.endDate)}
                              </Badge>
                            )
                          ) : (
                            <Badge variant="secondary" className="font-medium text-xs">Chưa đăng ký gói</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <FaceEnrollmentButton
                            memberId={member.id}
                            devices={enrollmentDevices}
                            mappings={member.deviceMappings}
                            compact
                          />
                        </TableCell>
                        <TableCell className="py-3 pr-5">
                          <div className="flex items-center justify-end gap-1.5">
                            <SubscriptionDialog
                              memberId={member.id}
                              memberName={member.fullName}
                              packages={activePackages}
                              settings={settings || undefined}
                              activeSub={!isExpired && latestSub ? latestSub : undefined}
                            />
                            {currentUser.role === "admin" && refundableTransaction && (
                              <RefundDialog
                                transactionId={refundableTransaction.id}
                                memberName={member.fullName}
                                amount={refundableTransaction.amount}
                                paymentMethod={refundableTransaction.paymentMethod}
                                triggerLabel="Hủy gói"
                              />
                            )}
                            <Link
                              href={`/my-card/${member.publicToken}`}
                              target="_blank"
                              className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-indigo-200 bg-transparent shadow-sm hover:bg-indigo-50 hover:text-indigo-900 text-indigo-600 h-8 rounded-md px-2 text-xs"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" /> Thẻ Ảo
                            </Link>
                            <MemberDialog mode="edit" memberData={member} packages={activePackages} settings={settings || undefined} devices={enrollmentDevices} cloudinaryApiKey={cloudinaryApiKey} cloudinaryCloudName={cloudinaryCloudName} />
                            {currentUser.role === "admin" && <DeleteMemberButton id={member.id} />}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="px-3 sm:px-5"><PaginationWithLimit totalPages={totalPages} totalItems={totalItems} /></div>
        </CardContent>
      </Card>
    </div>
  )
}
