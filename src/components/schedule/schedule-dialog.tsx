"use client"

import { useMemo, useState } from "react"
import { CalendarPlus, Repeat2, Users } from "lucide-react"
import { toast } from "sonner"
import { createRecurringPTSessions } from "@/actions/schedule-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ScheduleDialogProps = {
  trainers: { id: number; fullName: string; maxConcurrentClients: number }[]
  members: { id: number; fullName: string; phoneNumber: string }[]
}

const days = [
  { value: 1, label: "T2" }, { value: 2, label: "T3" }, { value: 3, label: "T4" },
  { value: 4, label: "T5" }, { value: 5, label: "T6" }, { value: 6, label: "T7" }, { value: 0, label: "CN" },
]
const fieldClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"

export function ScheduleDialog({ trainers, members }: ScheduleDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [trainerId, setTrainerId] = useState("")
  const [memberId, setMemberId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [repeatUntil, setRepeatUntil] = useState("")
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [startTime, setStartTime] = useState("18:00")
  const [endTime, setEndTime] = useState("19:00")
  const [notes, setNotes] = useState("")
  const selectedTrainer = useMemo(() => trainers.find((trainer) => String(trainer.id) === trainerId), [trainerId, trainers])

  function changeStartDate(value: string) {
    setStartDate(value)
    if (!repeatUntil || repeatUntil < value) setRepeatUntil(value)
    if (value && !weekdays.length) setWeekdays([new Date(`${value}T12:00:00+07:00`).getDay()])
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!trainerId || !memberId || !startDate || !startTime || !endTime) return toast.error("Vui lòng nhập đủ thông tin bắt buộc.")
    if (repeatWeekly && (!repeatUntil || !weekdays.length)) return toast.error("Hãy chọn ngày kết thúc và ít nhất một thứ trong tuần.")
    setSubmitting(true)
    try {
      const result = await createRecurringPTSessions({
        trainerId: Number(trainerId), memberId: Number(memberId), startDate,
        repeatUntil: repeatWeekly ? repeatUntil : startDate,
        repeatWeekly, weekdays, startTime, endTime, notes,
      })
      if ("error" in result) return toast.error(result.error)
      toast.success(`Đã tạo ${result.count} buổi tập.`)
      setOpen(false)
      setMemberId("")
      setNotes("")
    } catch {
      toast.error("Không thể tạo lịch, vui lòng thử lại.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700"><CalendarPlus className="h-4 w-4" /> Đặt lịch PT</Button>} />
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader><DialogTitle className="text-xl">Đặt lịch tập với PT</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Huấn luyện viên *</Label>
              <select value={trainerId} onChange={(event) => setTrainerId(event.target.value)} className={fieldClass}>
                <option value="">Chọn PT</option>
                {trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.fullName}</option>)}
              </select>
              {selectedTrainer && <p className="flex items-center gap-1 text-xs text-emerald-700"><Users className="h-3.5 w-3.5" /> Tối đa {selectedTrainer.maxConcurrentClients} người cùng khung giờ</p>}
            </div>
            <div className="space-y-2">
              <Label>Hội viên *</Label>
              <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className={fieldClass}>
                <option value="">Chọn hội viên</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.fullName} · {member.phoneNumber}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label>Ngày bắt đầu *</Label><Input type="date" value={startDate} onChange={(event) => changeStartDate(event.target.value)} /></div>
            <div className="space-y-2"><Label>Giờ bắt đầu *</Label><Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></div>
            <div className="space-y-2"><Label>Giờ kết thúc *</Label><Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span><span className="flex items-center gap-2 font-semibold text-slate-800"><Repeat2 className="h-4 w-4 text-emerald-600" /> Lặp lại hàng tuần</span><span className="mt-1 block text-xs text-slate-500">Tạo nhiều buổi cùng lúc theo các ngày bạn chọn.</span></span>
              <input type="checkbox" checked={repeatWeekly} onChange={(event) => setRepeatWeekly(event.target.checked)} className="h-5 w-5 accent-emerald-600" />
            </label>
            {repeatWeekly && <div className="mt-4 space-y-4 border-t border-emerald-100 pt-4">
              <div className="space-y-2">
                <Label>Chọn ngày tập mỗi tuần</Label>
                <div className="grid grid-cols-7 gap-2">{days.map((day) => {
                  const active = weekdays.includes(day.value)
                  return <button key={day.value} type="button" onClick={() => setWeekdays(active ? weekdays.filter((value) => value !== day.value) : [...weekdays, day.value])} className={`h-10 rounded-xl text-sm font-semibold transition ${active ? "bg-emerald-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300"}`}>{day.label}</button>
                })}</div>
              </div>
              <div className="max-w-xs space-y-2"><Label>Lặp đến ngày *</Label><Input type="date" min={startDate} value={repeatUntil} onChange={(event) => setRepeatUntil(event.target.value)} /></div>
            </div>}
          </div>

          <div className="space-y-2"><Label>Ghi chú</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ví dụ: thân trên, giảm mỡ..." /></div>
          <Button type="submit" className="h-11 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={submitting}>{submitting ? "Đang kiểm tra và tạo lịch..." : "Xác nhận đặt lịch"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
