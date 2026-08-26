"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Clock3, UserRound, XCircle } from "lucide-react"
import { toast } from "sonner"
import { updatePTSessionStatus } from "@/actions/schedule-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type CalendarSession = {
  id: number
  startTime: Date
  endTime: Date
  status: string
  notes: string | null
  concurrentCount: number
  trainer: { fullName: string; maxConcurrentClients: number }
  member: { fullName: string }
}

const START_HOUR = 6
const END_HOUR = 23
const HOUR_HEIGHT = 72

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

function timeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date)
  return { hour: Number(parts.find((part) => part.type === "hour")?.value), minute: Number(parts.find((part) => part.type === "minute")?.value) }
}

export function WeekCalendar({ weekStart, sessions }: { weekStart: string; sessions: CalendarSession[] }) {
  const [selected, setSelected] = useState<CalendarSession | null>(null)
  const [updating, setUpdating] = useState(false)
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekStart}T12:00:00+07:00`)
    date.setDate(date.getDate() + index)
    return date
  }), [weekStart])
  const today = dayKey(new Date())
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index)

  async function changeStatus(status: string) {
    if (!selected) return
    setUpdating(true)
    const result = await updatePTSessionStatus(selected.id, status)
    setUpdating(false)
    if (result.error) return toast.error(result.error)
    toast.success(status === "completed" ? "Đã đánh dấu hoàn thành." : status === "cancelled" ? "Đã hủy buổi tập." : "Đã mở lại lịch tập.")
    setSelected(null)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[72px_repeat(7,minmax(128px,1fr))] border-b border-slate-200 bg-slate-50/80">
            <div />
            {days.map((date, index) => {
              const key = dayKey(date)
              return <div key={key} className={`border-l border-slate-200 px-3 py-3 text-center ${key === today ? "bg-emerald-50" : ""}`}>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{index === 6 ? "Chủ nhật" : `Thứ ${index + 2}`}</div>
                <div className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold ${key === today ? "bg-emerald-600 text-white" : "text-slate-800"}`}>{date.getDate()}</div>
              </div>
            })}
          </div>
          <div className="grid grid-cols-[72px_repeat(7,minmax(128px,1fr))]">
            <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
              {hours.map((hour, index) => <div key={hour} className="absolute right-3 -translate-y-2 text-xs font-medium text-slate-400" style={{ top: index * HOUR_HEIGHT }}>{String(hour).padStart(2, "0")}:00</div>)}
            </div>
            {days.map((date) => {
              const key = dayKey(date)
              const daySessions = sessions.filter((session) => dayKey(new Date(session.startTime)) === key)
              return <div key={key} className={`relative border-l border-slate-200 ${key === today ? "bg-emerald-50/30" : ""}`} style={{ height: hours.length * HOUR_HEIGHT }}>
                {hours.map((hour, index) => <div key={hour} className="absolute inset-x-0 border-t border-slate-100" style={{ top: index * HOUR_HEIGHT }} />)}
                {daySessions.map((session) => {
                  const start = timeParts(new Date(session.startTime))
                  const end = timeParts(new Date(session.endTime))
                  const top = Math.max(0, ((start.hour - START_HOUR) * 60 + start.minute) / 60 * HOUR_HEIGHT)
                  const duration = ((end.hour * 60 + end.minute) - (start.hour * 60 + start.minute)) / 60 * HOUR_HEIGHT
                  const cancelled = session.status === "cancelled"
                  return <button type="button" onClick={() => setSelected(session)} key={session.id} title={session.notes || undefined} className={`absolute inset-x-1 z-10 overflow-hidden rounded-xl border px-2 py-1.5 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${cancelled ? "border-slate-200 bg-slate-100 text-slate-500 opacity-70" : "border-emerald-200 bg-emerald-100 text-emerald-950"}`} style={{ top, height: Math.max(42, duration) }}>
                    <div className="truncate font-bold">{session.member.fullName}</div>
                    <div className="mt-0.5 flex items-center gap-1 truncate"><UserRound className="h-3 w-3" />{session.trainer.fullName}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{String(start.hour).padStart(2, "0")}:{String(start.minute).padStart(2, "0")}</span>
                      {!cancelled && <span className="rounded-full bg-white/70 px-1.5 font-semibold">{session.concurrentCount}/{session.trainer.maxConcurrentClients}</span>}
                    </div>
                  </button>
                })}
              </div>
            })}
          </div>
        </div>
      </div>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Chi tiết buổi tập</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4 pt-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-lg font-bold text-slate-900">{selected.member.fullName}</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-600"><UserRound className="h-4 w-4 text-emerald-600" /> PT {selected.trainer.fullName}</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Clock3 className="h-4 w-4 text-emerald-600" /> {new Date(selected.startTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", weekday: "long", day: "2-digit", month: "2-digit" })} – {new Date(selected.endTime).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}</div>
              {selected.notes && <p className="mt-3 border-t pt-3 text-sm text-slate-600">{selected.notes}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {selected.status !== "completed" && <Button disabled={updating} onClick={() => changeStatus("completed")} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-4 w-4" /> Hoàn thành</Button>}
              {selected.status !== "cancelled" && <Button disabled={updating} onClick={() => changeStatus("cancelled")} variant="destructive"><XCircle className="h-4 w-4" /> Hủy buổi</Button>}
              {selected.status !== "scheduled" && <Button disabled={updating} onClick={() => changeStatus("scheduled")} variant="outline" className="col-span-2">Mở lại lịch tập</Button>}
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
