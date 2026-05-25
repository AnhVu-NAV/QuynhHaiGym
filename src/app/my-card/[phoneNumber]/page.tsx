import { getMemberPortalData } from "@/actions/portal-actions"
import { notFound } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { Dumbbell, Calendar, Clock, User, CheckCircle2, XCircle } from "lucide-react"
import { DownloadCardButton } from "@/components/cards/download-card-button"

export default async function VirtualCardPage({ params }: { params: Promise<{ phoneNumber: string }> }) {
  const resolvedParams = await params
  const decodedPhone = decodeURIComponent(resolvedParams.phoneNumber)
  const data = await getMemberPortalData(decodedPhone)

  if (!data) return notFound()

  const { member, activeSub, ptSessions } = data
  const daysLeft = activeSub 
    ? Math.ceil((new Date(activeSub.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
    : 0

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-start p-4 sm:p-6 font-sans relative overflow-hidden transition-colors duration-300">
      
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-300/40 dark:bg-emerald-600/30 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-300/40 dark:bg-teal-800/30 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-6 mt-6 z-10 relative">
        <DownloadCardButton targetId="virtual-card" fileName={`The_Hoi_Vien_${member.phoneNumber}`} />
        
        {/* Container to capture as Image */}
        <div id="virtual-card" className="flex flex-col items-center space-y-6 p-4 -m-4 bg-transparent">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-3 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="p-3 bg-white/60 dark:bg-white/5 rounded-2xl backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-xl">
              <Dumbbell className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] whitespace-nowrap">Quỳnh Hải Gym</h1>
              <p className="text-xs text-emerald-600 dark:text-emerald-400/80 font-semibold tracking-widest mt-1 whitespace-nowrap">THẺ HỘI VIÊN ĐIỆN TỬ</p>
            </div>
          </div>

          {/* The Card */}
          <div className="relative w-full rounded-[2rem] overflow-hidden bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
            {/* Top Gradient Banner */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600 dark:from-emerald-500 dark:via-teal-600 dark:to-emerald-800 opacity-90"></div>
            
            <div className="relative pt-12 px-6 pb-8 flex flex-col items-center">
              {/* Avatar */}
              <div className="relative w-32 h-32 rounded-full p-1.5 bg-white dark:bg-slate-900 shadow-2xl z-10 mb-4 ring-1 ring-slate-200 dark:ring-white/20">
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt="Avatar" className="w-full h-full object-cover" crossOrigin="anonymous" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                      <User className="h-12 w-12" />
                    </div>
                  )}
                </div>
                {/* Status Dot on Avatar */}
                <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-4 border-white dark:border-slate-900 ${activeSub ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              </div>

              <h2 className="text-2xl font-bold text-slate-800 dark:text-white text-center tracking-tight">{member.fullName}</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 font-mono">{member.phoneNumber}</p>

              {/* QR Code Section */}
              <div className="relative group w-full max-w-[240px]">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-teal-400 dark:from-emerald-500 dark:to-teal-500 rounded-3xl blur opacity-30 dark:opacity-25 group-hover:opacity-60 dark:group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white p-5 rounded-3xl shadow-xl dark:shadow-2xl flex flex-col items-center border border-slate-100 dark:border-0">
                  <div className="relative overflow-hidden rounded-xl w-full flex justify-center">
                    <QRCodeSVG 
                      value={member.phoneNumber} 
                      size={200} 
                      level="H"
                      includeMargin={false}
                      className="rounded-xl w-full h-auto max-w-[180px]"
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2 w-full">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest text-center">Đưa mã để Check-in</p>
                  </div>
                </div>
              </div>

              {/* Status Information */}
              <div className="w-full mt-8 bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 border border-slate-200 dark:border-white/10">
                {activeSub ? (
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-400/10 px-3 py-1 rounded-full whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider">Thẻ đang hoạt động</span>
                    </div>
                    <div className="grid grid-cols-2 w-full gap-4 pt-2">
                      <div className="flex flex-col border-r border-slate-200 dark:border-white/10">
                        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Gói tập</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white mt-0.5">{activeSub.package.name}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Thời gian</span>
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">Còn {daysLeft} ngày</span>
                      </div>
                    </div>
                    <div className="w-full border-t border-slate-200 dark:border-white/10 pt-3 mt-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Có giá trị đến ngày <strong className="text-slate-800 dark:text-white">{new Date(activeSub.endDate).toLocaleDateString('vi-VN')}</strong></p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-400/10 px-3 py-1 rounded-full whitespace-nowrap">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider">Thẻ đã hết hạn</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Vui lòng liên hệ Lễ tân để gia hạn gói tập.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PT Sessions */}
        {ptSessions.length > 0 && (
          <div className="bg-white/70 dark:bg-slate-900/60 rounded-[2rem] backdrop-blur-xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-white/10 p-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Lịch tập PT sắp tới
            </h3>
            <div className="space-y-3">
              {ptSessions.map(sess => (
                <div key={sess.id} className="flex gap-4 items-center bg-slate-50/50 dark:bg-white/5 rounded-2xl p-3 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  <div className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl p-2 flex flex-col items-center min-w-[60px] border border-emerald-200 dark:border-emerald-500/20">
                    <span className="text-[10px] font-bold uppercase">{new Date(sess.startTime).toLocaleDateString('vi-VN', { weekday: 'short' })}</span>
                    <span className="text-lg font-black leading-none my-0.5">{new Date(sess.startTime).getDate()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5 text-sm">
                      <Clock className="h-3.5 w-3.5 text-emerald-600/70 dark:text-emerald-400/70" />
                      {new Date(sess.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - 
                      {new Date(sess.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">HLV: <span className="font-medium text-slate-700 dark:text-slate-200">{sess.trainer.fullName}</span></p>
                    {sess.notes && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">{sess.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
