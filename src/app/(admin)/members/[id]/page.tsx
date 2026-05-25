import { getMemberById } from "@/actions/member-actions"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, User, Phone, CheckCircle2, XCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { InbodyChart } from "@/components/members/inbody-chart"
import { InbodyForm } from "@/components/members/inbody-form"

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const id = parseInt(resolvedParams.id)
  if (isNaN(id)) return notFound()

  const member = await getMemberById(id)
  if (!member) return notFound()

  const activeSub = member.subscriptions?.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0]
  const isExpired = activeSub ? new Date(activeSub.endDate) < new Date() : true
  const daysLeft = activeSub && !isExpired
    ? Math.ceil((new Date(activeSub.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/members" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Hồ sơ hội viên</h2>
          <p className="text-muted-foreground mt-1">Quản lý thẻ tập và theo dõi chỉ số InBody.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Member Info */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="Avatar" className="w-32 h-32 rounded-full object-cover border-4 border-slate-100 mb-4" />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 border-4 border-slate-50">
                    <User className="w-12 h-12" />
                  </div>
                )}
                <h3 className="text-2xl font-bold text-slate-800">{member.fullName}</h3>
                <div className="flex items-center gap-1.5 text-slate-500 mt-1">
                  <Phone className="w-4 h-4" />
                  <span>{member.phoneNumber}</span>
                </div>
                <Badge variant="outline" className="mt-2 bg-slate-50">
                  {member.gender === 'male' ? 'Nam' : member.gender === 'female' ? 'Nữ' : 'Khác'}
                </Badge>
              </div>

              <div className="mt-8 border-t pt-6">
                <h4 className="font-semibold text-sm text-slate-800 uppercase tracking-wider mb-4">Trạng thái thẻ tập</h4>
                {activeSub ? (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-xl border ${isExpired ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {isExpired ? <XCircle className="w-5 h-5 text-red-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                        <span className={`font-semibold ${isExpired ? 'text-red-700' : 'text-emerald-700'}`}>
                          {isExpired ? 'Đã hết hạn' : 'Đang hoạt động'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div>
                          <p className="text-xs text-slate-500">Gói tập</p>
                          <p className="font-medium text-slate-800">{activeSub.package.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Thời hạn</p>
                          <p className={`font-medium ${isExpired ? 'text-red-600' : 'text-emerald-600'}`}>
                            {isExpired ? 'Quá hạn' : `Còn ${daysLeft} ngày`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border bg-slate-50 text-center">
                    <p className="text-slate-500 text-sm">Chưa đăng ký gói tập nào</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* PT Sessions */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-500" />
                Lịch sử PT (5 buổi gần nhất)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {member.ptSessions && member.ptSessions.length > 0 ? (
                <div className="space-y-3">
                  {member.ptSessions.slice(0, 5).map(session => (
                    <div key={session.id} className="flex justify-between items-center p-3 rounded-lg border bg-slate-50">
                      <div>
                        <p className="font-medium text-sm">{new Date(session.startTime).toLocaleDateString('vi-VN')}</p>
                        <p className="text-xs text-slate-500 mt-0.5">HLV: {session.trainer.fullName}</p>
                      </div>
                      <Badge variant={session.status === 'completed' ? 'default' : 'secondary'} className={session.status === 'completed' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : ''}>
                        {session.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">Chưa có dữ liệu</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: InBody & Charts */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-emerald-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-emerald-50/50 rounded-t-xl border-b border-emerald-100">
              <CardTitle className="text-xl text-emerald-800">Tiến độ Thể chất (InBody)</CardTitle>
              <InbodyForm memberId={member.id} />
            </CardHeader>
            <CardContent className="pt-6">
              <InbodyChart data={member.inbodyRecords || []} />
              
              {/* Data Table */}
              <div className="mt-8">
                <h4 className="font-semibold text-slate-800 mb-4">Lịch sử đo gần đây</h4>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/50">
                        <th className="h-10 px-4 text-left font-medium text-slate-500">Ngày đo</th>
                        <th className="h-10 px-4 text-right font-medium text-slate-500">Cân nặng (kg)</th>
                        <th className="h-10 px-4 text-right font-medium text-slate-500">Cơ xương (kg)</th>
                        <th className="h-10 px-4 text-right font-medium text-slate-500">Tỷ lệ mỡ (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {member.inbodyRecords && member.inbodyRecords.length > 0 ? (
                        member.inbodyRecords.slice(0, 5).map(record => (
                          <tr key={record.id} className="border-b last:border-0 hover:bg-slate-50/50">
                            <td className="p-4">{new Date(record.recordDate).toLocaleDateString('vi-VN')}</td>
                            <td className="p-4 text-right font-medium text-blue-600">{record.weight}</td>
                            <td className="p-4 text-right font-medium text-emerald-600">{record.skeletalMuscle}</td>
                            <td className="p-4 text-right font-medium text-rose-600">{record.bodyFat}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-500">Chưa có bản ghi nào</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
