import { getDashboardStats, getExpiringMembers, getRepeatedExpiredScanMembers } from "@/actions/dashboard-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { Users, CreditCard, Activity, QrCode, AlertTriangle, PhoneCall, ScanFace } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function DashboardPage() {
  const [stats, expiringMembers, repeatedExpiredScans] = await Promise.all([
    getDashboardStats(),
    getExpiringMembers(),
    getRepeatedExpiredScanMembers(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Tổng quan</h2>
        <p className="text-muted-foreground mt-1">Theo dõi hoạt động kinh doanh và hội viên phòng tập hôm nay.</p>
      </div>

      {/* Cảnh báo hội viên sắp hết hạn */}
      {expiringMembers.length > 0 && (
        <Card className="border-amber-200 shadow-sm bg-amber-50/50">
          <CardHeader className="pb-3 border-b border-amber-100">
            <CardTitle className="text-amber-700 flex items-center text-lg">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Sắp hết hạn: {expiringMembers.length} hội viên còn tối đa 7 ngày
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {expiringMembers.slice(0, 6).map((sub) => {
                const daysLeft = Math.ceil((new Date(sub.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
                return (
                  <div key={sub.id} className="bg-white border border-amber-100 rounded-md p-3 flex justify-between items-center shadow-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate">{sub.member.fullName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{sub.member.phoneNumber} • {sub.package.name}</p>
                      <p className="text-xs font-medium mt-1 text-amber-600">
                        Còn lại {Math.max(0, daysLeft)} ngày
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="ml-3 shrink-0 h-8 border-amber-200 text-amber-700 hover:bg-amber-50" render={<a href={`tel:${sub.member.phoneNumber}`} />}>
                      <PhoneCall className="w-3.5 h-3.5 mr-1.5" /> Gọi
                    </Button>
                  </div>
                )
              })}
            </div>
            {expiringMembers.length > 6 && (
              <div className="mt-4 text-center">
                <Link href="/members" className="text-sm text-amber-700 font-medium hover:underline">
                  Xem tất cả danh sách ở trang Hội viên →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hội viên hết hạn vẫn tiếp tục quét mặt */}
      {repeatedExpiredScans.length > 0 && (
        <Card className="border-red-200 shadow-sm bg-red-50/50">
          <CardHeader className="pb-3 border-b border-red-100">
            <CardTitle className="text-red-700 flex items-center text-lg">
              <ScanFace className="w-5 h-5 mr-2" />
              Đã hết hạn nhưng vẫn quét mặt: {repeatedExpiredScans.length} hội viên
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {repeatedExpiredScans.slice(0, 6).map((item) => (
                <div key={item.member.id} className="bg-white border border-red-100 rounded-md p-3 flex justify-between items-center shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 truncate">{item.member.fullName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.member.phoneNumber}</p>
                    <p className="text-xs font-semibold text-red-600 mt-1">
                      {item.invalidAttempts} lần quét bị từ chối
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Lần cuối: {item.lastAttemptAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="ml-3 shrink-0 h-8 border-red-200 text-red-700 hover:bg-red-50" render={<a href={`tel:${item.member.phoneNumber}`} />}>
                    <PhoneCall className="w-3.5 h-3.5 mr-1.5" /> Gọi
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link href="/check-ins#failed-check-ins" className="text-sm text-red-600 font-medium hover:underline">
                Xem log check-in không hợp lệ →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Tổng doanh thu tháng</CardTitle>
            <CreditCard className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.monthlyRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">+20.1% so với tháng trước</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Hội viên đang hoạt động</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">
              {stats.activeMembers} <span className="text-sm font-normal text-slate-500">/ {stats.totalMembers}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Đã bao gồm hội viên mới</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Lượt Check-in hôm nay</CardTitle>
            <QrCode className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">+{stats.todayCheckins}</div>
            <p className="text-xs text-muted-foreground mt-1">Hội viên đã tới tập</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Tổng số Hội viên</CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">Tổng cộng từ trước tới nay</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm border-muted">
          <CardHeader>
            <CardTitle>Biểu đồ doanh thu</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <RevenueChart data={stats.chartData} />
          </CardContent>
        </Card>
        
        <Card className="col-span-3 shadow-sm border-muted">
          <CardHeader>
            <CardTitle>Giao dịch gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {stats.recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Chưa có giao dịch nào.</p>
              ) : (
                stats.recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold border">
                      {tx.member.avatarUrl ? (
                        <img src={tx.member.avatarUrl} alt="avt" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        tx.member.fullName.charAt(0)
                      )}
                    </div>
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">{tx.member.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {tx.description}
                      </p>
                    </div>
                    <div className="ml-auto font-medium text-emerald-600">
                      +{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tx.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
