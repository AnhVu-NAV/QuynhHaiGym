"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { createPTSession } from "@/actions/schedule-actions"
import { toast } from "sonner"
import { CalendarPlus, Pencil } from "lucide-react"

type ScheduleDialogProps = {
  trainers: { id: number; fullName: string }[]
  members: { id: number; fullName: string; phoneNumber: string }[]
}

export function ScheduleDialog({ trainers, members }: ScheduleDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [trainerId, setTrainerId] = useState("")
  const [memberId, setMemberId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [duration, setDuration] = useState("60") // minutes
  const [notes, setNotes] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!trainerId || !memberId || !date || !time) {
      return toast.error("Vui lòng điền đầy đủ thông tin bắt buộc")
    }

    setIsSubmitting(true)
    try {
      const startDateTime = new Date(`${date}T${time}`)
      const endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60000)

      await createPTSession({
        trainerId: parseInt(trainerId),
        memberId: parseInt(memberId),
        startTime: startDateTime,
        endTime: endDateTime,
        notes
      })
      toast.success("Đã đặt lịch tập thành công!")
      setOpen(false)
      // Reset form
      setTrainerId("")
      setMemberId("")
      setDate("")
      setTime("")
      setNotes("")
    } catch (error) {
      toast.error("Có lỗi xảy ra, vui lòng thử lại.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <Button className="gap-2">
            <CalendarPlus className="h-4 w-4" /> Đặt lịch PT
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Đặt lịch tập cá nhân (1 kèm 1)</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Huấn luyện viên</Label>
            <select 
              value={trainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">-- Chọn HLV --</option>
              {trainers.map(t => (
                <option key={t.id} value={t.id}>{t.fullName}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Hội viên</Label>
            <select 
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">-- Chọn Hội viên --</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.fullName} ({m.phoneNumber})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ngày tập</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Giờ bắt đầu</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Thời lượng (phút)</Label>
            <select 
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="30">30 phút</option>
              <option value="60">60 phút (1 tiếng)</option>
              <option value="90">90 phút</option>
              <option value="120">120 phút (2 tiếng)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Input placeholder="Mục tiêu buổi tập..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
            {isSubmitting ? "Đang xử lý..." : "Xác nhận đặt lịch"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
