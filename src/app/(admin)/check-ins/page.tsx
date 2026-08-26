import {
  getCheckInSummary,
  getRecentCheckIns,
  getRecentFailedCheckIns,
} from "@/actions/checkin-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PaginationWithLimit } from "@/components/ui/pagination-with-limit"
import { QueryFilter } from "@/components/ui/query-filter"
import { SearchInput } from "@/components/ui/search-input"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MonitorSmartphone,
  QrCode,
  ScanFace,
  ShieldAlert,
  UserRoundCheck,
  Users,
} from "lucide-react"
import Link from "next/link"

const CHECK_IN_PAGE_PARAMS = ["page", "failedPage"]
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh"

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VIETNAM_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
})

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VIETNAM_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const reasonLabel: Record<string, string> = {
  subscription_expired: "Gói tập đã hết hạn",
  member_inactive: "Hội viên đang bị khóa",
  unmapped_face: "Khuôn mặt chưa liên kết",
  missing_enroll_id: "Máy không gửi mã hội viên",
}

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : ""
}

function sourceLabel(source: string, deviceName?: string | null) {
  if (source === "ai26") return deviceName || "Máy AI26"
  return "Màn hình web"
}

export default async function AdminCheckInsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const q = getStringParam(params.q)
  const page = Number(getStringParam(params.page)) || 1
  const limit = Number(getStringParam(params.limit)) || 10
  const failedPage = Number(getStringParam(params.failedPage)) || 1
  const failedLimit = Number(getStringParam(params.failedLimit)) || 10
  const view = getStringParam(params.view) === "failed" ? "failed" : "valid"
  const sourceParam = getStringParam(params.source)
  const periodParam = getStringParam(params.period)
  const source: "ai26" | "web" | undefined = sourceParam === "ai26" || sourceParam === "web" ? sourceParam : undefined
  const period: "today" | "7d" | "30d" | undefined = periodParam === "today" || periodParam === "7d" || periodParam === "30d" ? periodParam : undefined
  const filters = { source, period }

  const [
    { data: checkIns, totalPages, totalItems },
    { data: failedCheckIns, totalPages: failedTotalPages, totalItems: failedTotalItems },
    summary,
  ] = await Promise.all([
    getRecentCheckIns(q, page, limit, filters),
    getRecentFailedCheckIns(q, failedPage, failedLimit, filters),
    getCheckInSummary(),
  ])

  const tabParams = new URLSearchParams()
  if (q) tabParams.set("q", q)
  if (source) tabParams.set("source", source)
  if (period) tabParams.set("period", period)
  const validParams = new URLSearchParams(tabParams)
  const failedParams = new URLSearchParams(tabParams)
  failedParams.set("view", "failed")
  const validHref = validParams.size ? `/check-ins?${validParams.toString()}` : "/check-ins"
  const failedHref = `/check-ins?${failedParams.toString()}#failed-check-ins`

  const metrics = [
    {
      title: "Check-in hợp lệ hôm nay",
      value: summary.validToday,
      detail: `${summary.uniqueMembersToday} hội viên đã đến`,
      icon: CheckCircle2,
      iconClass: "bg-emerald-100 text-emerald-700",
      accentClass: "from-emerald-500 to-teal-400",
    },
    {
      title: "Từ máy AI26 hôm nay",
      value: summary.ai26Today,
      detail: "Nhận diện khuôn mặt thành công",
      icon: ScanFace,
      iconClass: "bg-cyan-100 text-cyan-700",
      accentClass: "from-cyan-500 to-sky-400",
    },
    {
      title: "Hội viên đã đến hôm nay",
      value: summary.uniqueMembersToday,
      detail: "Không tính lượt quét trùng",
      icon: UserRoundCheck,
      iconClass: "bg-indigo-100 text-indigo-700",
      accentClass: "from-indigo-500 to-violet-400",
    },
    {
      title: "Bị từ chối hôm nay",
      value: summary.failedToday,
      detail: summary.failedToday > 0 ? "Cần kiểm tra nguyên nhân" : "Không có trường hợp bất thường",
      icon: ShieldAlert,
      iconClass: summary.failedToday > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600",
      accentClass: summary.failedToday > 0 ? "from-rose-500 to-orange-400" : "from-slate-400 to-slate-300",
    },
  ]

  return (
    <div className="w-full space-y-5 pb-6 sm:space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
            <QrCode className="size-6" />
          </span>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Lịch sử Check-in</h1>
              <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 lg:inline-flex">
                Theo thời gian thực
              </span>
            </div>
            <p className="text-sm leading-6 text-slate-500 sm:text-base">
              Theo dõi lượt vào phòng tập, nguồn xác thực và các trường hợp bị từ chối.
            </p>
          </div>
        </div>
        <Button
          className="h-10 w-full bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 sm:w-auto"
          render={<Link href="/check-in" target="_blank" />}
        >
          <MonitorSmartphone className="size-4" />
          Mở màn hình Check-in
          <ExternalLink className="size-3.5 opacity-60" />
        </Button>
      </section>

      <section aria-label="Tình hình check-in hôm nay" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <Card key={metric.title} className="relative min-w-0 gap-3 overflow-hidden border-0 bg-white py-4 shadow-[0_12px_34px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/80">
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${metric.accentClass}`} />
              <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 pt-1 sm:px-5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{metric.title}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{metric.value.toLocaleString("vi-VN")}</p>
                </div>
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${metric.iconClass}`}>
                  <Icon className="size-[18px]" />
                </span>
              </CardHeader>
              <CardContent className="px-4 sm:px-5">
                <p className="text-xs text-slate-500">{metric.detail}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <Card className="gap-0 overflow-hidden border-0 bg-white py-0 shadow-sm ring-1 ring-slate-200/80">
        <div className="grid gap-3 p-4 lg:grid-cols-[minmax(18rem,1fr)_auto_auto] lg:items-center sm:p-5">
          <SearchInput placeholder="Tìm tên hoặc số điện thoại..." resetPageParams={CHECK_IN_PAGE_PARAMS} />
          <QueryFilter
            param="period"
            label="Khoảng thời gian"
            resetPageParams={CHECK_IN_PAGE_PARAMS}
            options={[
              { value: "all", label: "Tất cả thời gian" },
              { value: "today", label: "Hôm nay" },
              { value: "7d", label: "7 ngày gần đây" },
              { value: "30d", label: "30 ngày gần đây" },
            ]}
          />
          <QueryFilter
            param="source"
            label="Nguồn check-in"
            resetPageParams={CHECK_IN_PAGE_PARAMS}
            options={[
              { value: "all", label: "Tất cả nguồn" },
              { value: "ai26", label: "Máy AI26" },
              { value: "web", label: "Màn hình web" },
            ]}
          />
        </div>

        <nav aria-label="Loại lịch sử check-in" className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/70 p-1.5 sm:flex sm:gap-1 sm:px-5">
          <Link
            href={validHref}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${view === "valid" ? "bg-white text-emerald-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/70 hover:text-slate-800"}`}
          >
            <CheckCircle2 className="size-4" />
            Hợp lệ
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${view === "valid" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
              {totalItems}
            </span>
          </Link>
          <Link
            id="failed-check-ins"
            href={failedHref}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${view === "failed" ? "bg-white text-rose-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/70 hover:text-slate-800"}`}
          >
            <AlertTriangle className="size-4" />
            Bị từ chối
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${view === "failed" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-600"}`}>
              {failedTotalItems}
            </span>
          </Link>
        </nav>
      </Card>

      {view === "valid" ? (
        <Card className="gap-0 overflow-hidden border-0 bg-white py-0 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.5)] ring-1 ring-slate-200/80">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <CardTitle className="text-lg text-slate-950">Lượt check-in hợp lệ</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Các hội viên đã được xác thực và cho phép vào tập.</p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Users className="size-5" />
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {checkIns.length === 0 ? (
              <div className="grid min-h-64 place-items-center px-5 py-10 text-center">
                <div>
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                    <QrCode className="size-7" />
                  </span>
                  <p className="mt-4 font-semibold text-slate-800">Không tìm thấy lượt check-in</p>
                  <p className="mt-1 text-sm text-slate-500">Thử thay đổi từ khóa hoặc bộ lọc đang chọn.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 p-4 md:hidden">
                  {checkIns.map((checkIn) => (
                    <article key={checkIn.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-emerald-50 text-sm font-bold uppercase text-emerald-700 ring-1 ring-emerald-100">
                            {checkIn.member.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={checkIn.member.avatarUrl} alt="" className="size-11 object-cover" />
                            ) : checkIn.member.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{checkIn.member.fullName}</p>
                            <p className="mt-0.5 text-sm text-slate-500">{checkIn.member.phoneNumber}</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Hợp lệ</span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Clock3 className="size-4 text-slate-400" />
                          <span><strong className="text-slate-800">{timeFormatter.format(checkIn.checkInTime)}</strong> · {dateFormatter.format(checkIn.checkInTime)}</span>
                        </div>
                        <div className="flex items-center justify-end gap-2 text-slate-600">
                          <MonitorSmartphone className="size-4 text-slate-400" />
                          <span className="truncate">{sourceLabel(checkIn.source, checkIn.device?.name)}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-6 py-3.5">Thời gian</th>
                        <th className="px-6 py-3.5">Hội viên</th>
                        <th className="px-6 py-3.5">Nguồn xác thực</th>
                        <th className="px-6 py-3.5 text-right">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {checkIns.map((checkIn) => (
                        <tr key={checkIn.id} className="transition hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-6 py-4">
                            <p className="font-bold text-slate-900">{timeFormatter.format(checkIn.checkInTime)}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{dateFormatter.format(checkIn.checkInTime)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-emerald-50 text-sm font-bold uppercase text-emerald-700 ring-1 ring-emerald-100">
                                {checkIn.member.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={checkIn.member.avatarUrl} alt="" className="size-10 object-cover" />
                                ) : checkIn.member.fullName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{checkIn.member.fullName}</p>
                                <p className="mt-0.5 text-xs text-slate-500">{checkIn.member.phoneNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`grid size-8 place-items-center rounded-lg ${checkIn.source === "ai26" ? "bg-cyan-50 text-cyan-700" : "bg-indigo-50 text-indigo-700"}`}>
                                {checkIn.source === "ai26" ? <ScanFace className="size-4" /> : <MonitorSmartphone className="size-4" />}
                              </span>
                              <div>
                                <p className="font-medium text-slate-800">{sourceLabel(checkIn.source, checkIn.device?.name)}</p>
                                <p className="text-xs text-slate-500">{checkIn.source === "ai26" ? "Nhận diện khuôn mặt" : "Quét thẻ hoặc nhập mã"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="size-3.5" /> Hợp lệ
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 pb-1 sm:px-6">
                  <PaginationWithLimit totalPages={totalPages} totalItems={totalItems} defaultLimit={10} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="scroll-mt-6 gap-0 overflow-hidden border-0 bg-white py-0 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.5)] ring-1 ring-rose-200/80">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-rose-100 bg-rose-50/50 px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <CardTitle className="text-lg text-rose-950">Check-in bị từ chối</CardTitle>
              <p className="mt-1 text-sm text-rose-700/70">Kiểm tra hội viên hết hạn, bị khóa hoặc chưa liên kết khuôn mặt.</p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
              <AlertTriangle className="size-5" />
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {failedCheckIns.length === 0 ? (
              <div className="grid min-h-64 place-items-center px-5 py-10 text-center">
                <div>
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="size-7" />
                  </span>
                  <p className="mt-4 font-semibold text-slate-800">Không có lượt check-in bị từ chối</p>
                  <p className="mt-1 text-sm text-slate-500">Không phát hiện trường hợp bất thường với bộ lọc hiện tại.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 p-4 md:hidden">
                  {failedCheckIns.map((attempt) => (
                    <article key={attempt.id} className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {attempt.member?.fullName || `Mã máy #${attempt.enrollId ?? "không rõ"}`}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500">{attempt.member?.phoneNumber || "Chưa xác định hội viên"}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">Từ chối</span>
                      </div>
                      <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-800">
                        {reasonLabel[attempt.reason] || attempt.message || "Không hợp lệ"}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5"><Clock3 className="size-4" /> {timeFormatter.format(attempt.attemptedAt)} · {dateFormatter.format(attempt.attemptedAt)}</span>
                        <span className="flex items-center gap-1.5"><MonitorSmartphone className="size-4" /> {sourceLabel(attempt.source, attempt.device?.name)}</span>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-rose-50/40 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-6 py-3.5">Thời gian</th>
                        <th className="px-6 py-3.5">Hội viên</th>
                        <th className="px-6 py-3.5">Nguồn</th>
                        <th className="px-6 py-3.5">Lý do từ chối</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {failedCheckIns.map((attempt) => (
                        <tr key={attempt.id} className="transition hover:bg-rose-50/30">
                          <td className="whitespace-nowrap px-6 py-4">
                            <p className="font-bold text-slate-900">{timeFormatter.format(attempt.attemptedAt)}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{dateFormatter.format(attempt.attemptedAt)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900">{attempt.member?.fullName || `Mã máy #${attempt.enrollId ?? "không rõ"}`}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{attempt.member?.phoneNumber || "Chưa xác định hội viên"}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {attempt.source === "ai26" ? <ScanFace className="size-4 text-cyan-700" /> : <MonitorSmartphone className="size-4 text-indigo-700" />}
                              <span className="font-medium text-slate-700">{sourceLabel(attempt.source, attempt.device?.name)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex rounded-full bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700">
                              {reasonLabel[attempt.reason] || attempt.message || "Không hợp lệ"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 pb-1 sm:px-6">
                  <PaginationWithLimit
                    totalPages={failedTotalPages}
                    totalItems={failedTotalItems}
                    pageParam="failedPage"
                    limitParam="failedLimit"
                    defaultLimit={10}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
