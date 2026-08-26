import { getDashboardStats, getExpiringMembers, getRepeatedExpiredScanMembers } from "@/actions/dashboard-actions"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  PhoneCall,
  QrCode,
  ScanFace,
  UserPlus,
  Users,
} from "lucide-react"
import Link from "next/link"

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
})

function formatDateLabel(date: Date) {
  const value = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)

  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default async function DashboardPage() {
  const [stats, expiringMembers, repeatedExpiredScans] = await Promise.all([
    getDashboardStats(),
    getExpiringMembers(),
    getRepeatedExpiredScanMembers(),
  ])

  const now = new Date()
  const todayLabel = formatDateLabel(now)
  const pendingItems = expiringMembers.length + repeatedExpiredScans.length
  const metrics = [
    {
      title: "Doanh thu tháng này",
      value: currencyFormatter.format(stats.monthlyRevenue),
      detail:
        stats.monthlyRevenueChange === null
          ? "Chưa có dữ liệu tháng trước"
          : `${stats.monthlyRevenueChange >= 0 ? "+" : ""}${stats.monthlyRevenueChange}% so với tháng trước`,
      detailClass:
        stats.monthlyRevenueChange === null
          ? "text-slate-500"
          : stats.monthlyRevenueChange >= 0
            ? "text-emerald-700"
            : "text-rose-600",
      icon: CreditCard,
      iconClass: "bg-emerald-100 text-emerald-700",
      accentClass: "from-emerald-500 to-teal-400",
      glowClass: "bg-emerald-100/70",
    },
    {
      title: "Doanh thu hôm nay",
      value: currencyFormatter.format(stats.todayRevenue),
      detail: `${stats.todayTransactions} giao dịch được ghi nhận`,
      detailClass: "text-slate-500",
      icon: Banknote,
      iconClass: "bg-cyan-100 text-cyan-700",
      accentClass: "from-cyan-500 to-sky-400",
      glowClass: "bg-cyan-100/70",
    },
    {
      title: "Check-in hôm nay",
      value: stats.todayCheckins.toLocaleString("vi-VN"),
      detail: `Hôm qua có ${stats.yesterdayCheckins} lượt`,
      detailClass: "text-slate-500",
      icon: QrCode,
      iconClass: "bg-indigo-100 text-indigo-700",
      accentClass: "from-indigo-500 to-violet-400",
      glowClass: "bg-indigo-100/70",
    },
    {
      title: "Tổng số hội viên",
      value: stats.totalMembers.toLocaleString("vi-VN"),
      detail: `+${stats.newMembersThisMonth} hội viên mới trong tháng`,
      detailClass: "text-slate-500",
      icon: Users,
      iconClass: "bg-amber-100 text-amber-700",
      accentClass: "from-amber-500 to-orange-400",
      glowClass: "bg-amber-100/70",
    },
  ]

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-5 pb-6 sm:space-y-6">
      <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 px-5 py-6 text-white shadow-[0_18px_50px_-24px_rgba(5,150,105,0.75)] sm:px-7 sm:py-7 lg:px-8">
        <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-emerald-50 backdrop-blur-sm">
              <CalendarDays className="size-3.5" />
              {todayLabel}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">Tổng quan vận hành</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-50/85 sm:text-base">
              Doanh thu, hội viên và hoạt động check-in quan trọng đều được tổng hợp tại đây.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2.5 sm:w-auto">
            <Button
              className="h-10 border-white/15 bg-white text-emerald-800 shadow-sm hover:bg-emerald-50"
              render={<Link href="/members" />}
            >
              <UserPlus className="size-4" />
              Thêm hội viên
            </Button>
            <Button
              variant="outline"
              className="h-10 border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              render={<Link href="/check-ins" />}
            >
              <QrCode className="size-4" />
              Xem check-in
            </Button>
          </div>
        </div>
      </section>

      <section aria-label="Chỉ số vận hành" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon

          return (
            <Card
              key={metric.title}
              className="group relative min-w-0 gap-4 overflow-hidden border-0 bg-white py-5 shadow-[0_12px_35px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/80 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-24px_rgba(15,23,42,0.5)]"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${metric.accentClass}`} />
              <div className={`pointer-events-none absolute -right-8 -top-8 size-24 rounded-full ${metric.glowClass} blur-2xl`} />
              <CardHeader className="relative flex flex-row items-center justify-between gap-3 px-5">
                <CardTitle className="text-sm font-semibold text-slate-600">{metric.title}</CardTitle>
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${metric.iconClass}`}>
                  <Icon className="size-[18px]" />
                </span>
              </CardHeader>
              <CardContent className="relative px-5">
                <p className="truncate text-[clamp(1.35rem,2vw,1.85rem)] font-bold tracking-tight text-slate-950" title={metric.value}>
                  {metric.value}
                </p>
                <p className={`mt-1.5 text-xs font-medium ${metric.detailClass}`}>{metric.detail}</p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="space-y-3" aria-labelledby="pending-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="pending-heading" className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
              Việc cần xử lý
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Các trường hợp quản lý nên kiểm tra trong ngày.</p>
          </div>
          {pendingItems > 0 && (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
              {pendingItems} trường hợp
            </span>
          )}
        </div>

        {pendingItems === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3.5 text-emerald-900 shadow-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Không có cảnh báo cần xử lý</p>
              <p className="mt-0.5 text-xs text-emerald-700/80">Mọi hoạt động hội viên đang ở trạng thái ổn định.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {expiringMembers.length > 0 && (
              <Card className="min-w-0 gap-0 overflow-hidden border-amber-200/80 bg-white py-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-amber-100 bg-amber-50/65 px-4 py-4 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                      <AlertTriangle className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-base text-slate-950">Hội viên sắp hết hạn</CardTitle>
                      <p className="mt-0.5 text-xs text-slate-500">Còn tối đa 7 ngày sử dụng gói tập</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                    {expiringMembers.length}
                  </span>
                </CardHeader>
                <CardContent className="divide-y divide-slate-100 px-4 sm:px-5">
                  {expiringMembers.slice(0, 4).map((sub) => {
                    const daysLeft = Math.ceil((new Date(sub.endDate).getTime() - now.getTime()) / 86_400_000)

                    return (
                      <div key={sub.id} className="flex items-center gap-3 py-3.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{sub.member.fullName}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {sub.member.phoneNumber} · {sub.package.name}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          Còn {Math.max(0, daysLeft)} ngày
                        </span>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className="shrink-0 border-amber-200 text-amber-700 hover:bg-amber-50"
                          aria-label={`Gọi ${sub.member.fullName}`}
                          render={<a href={`tel:${sub.member.phoneNumber}`} />}
                        >
                          <PhoneCall className="size-4" />
                        </Button>
                      </div>
                    )
                  })}
                  <Link href="/members" className="flex items-center justify-center gap-1 py-3 text-sm font-semibold text-amber-700 hover:text-amber-800">
                    Xem danh sách hội viên <ArrowRight className="size-4" />
                  </Link>
                </CardContent>
              </Card>
            )}

            {repeatedExpiredScans.length > 0 && (
              <Card className="min-w-0 gap-0 overflow-hidden border-rose-200/80 bg-white py-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-rose-100 bg-rose-50/65 px-4 py-4 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
                      <ScanFace className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-base text-slate-950">Quét mặt sau khi hết hạn</CardTitle>
                      <p className="mt-0.5 text-xs text-slate-500">Hội viên có nhiều lần check-in bị từ chối</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
                    {repeatedExpiredScans.length}
                  </span>
                </CardHeader>
                <CardContent className="divide-y divide-slate-100 px-4 sm:px-5">
                  {repeatedExpiredScans.slice(0, 4).map((item) => (
                    <div key={item.member.id} className="flex items-center gap-3 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.member.fullName}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          Lần cuối: {item.lastAttemptAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                        {item.invalidAttempts} lần
                      </span>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className="shrink-0 border-rose-200 text-rose-700 hover:bg-rose-50"
                        aria-label={`Gọi ${item.member.fullName}`}
                        render={<a href={`tel:${item.member.phoneNumber}`} />}
                      >
                        <PhoneCall className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Link href="/check-ins?view=failed#failed-check-ins" className="flex items-center justify-center gap-1 py-3 text-sm font-semibold text-rose-700 hover:text-rose-800">
                    Xem check-in không hợp lệ <ArrowRight className="size-4" />
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,0.8fr)]">
        <Card className="min-w-0 gap-0 overflow-hidden border-0 bg-white py-0 shadow-[0_14px_40px_-26px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/80">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <CardTitle className="text-lg text-slate-950">Doanh thu 6 tháng</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Theo dõi xu hướng thu từ gói tập và dịch vụ.</p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Banknote className="size-5" />
            </span>
          </CardHeader>
          <CardContent className="px-2 pb-4 pt-5 sm:px-4">
            <RevenueChart data={stats.chartData} />
          </CardContent>
        </Card>

        <Card className="min-w-0 gap-0 overflow-hidden border-0 bg-white py-0 shadow-[0_14px_40px_-26px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/80">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-slate-100 px-5 py-5">
            <div>
              <CardTitle className="text-lg text-slate-950">Giao dịch gần đây</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Các khoản thu mới nhất được ghi nhận.</p>
            </div>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
              <Banknote className="size-5" />
            </span>
          </CardHeader>
          <CardContent className="px-5">
            {stats.recentTransactions.length === 0 ? (
              <div className="grid min-h-64 place-items-center py-8 text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                    <Banknote className="size-6" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-700">Chưa có giao dịch</p>
                  <p className="mt-1 text-xs text-slate-500">Giao dịch mới sẽ xuất hiện tại đây.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {stats.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex min-w-0 items-center gap-3 py-4">
                    <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-emerald-50 text-sm font-bold uppercase text-emerald-700 ring-1 ring-emerald-100">
                      {tx.member.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tx.member.avatarUrl} alt="" className="size-10 object-cover" />
                      ) : (
                        tx.member.fullName.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{tx.member.fullName}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{tx.description}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-emerald-700">+{currencyFormatter.format(tx.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
