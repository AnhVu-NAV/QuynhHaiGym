"use client"

import { useRef, useState } from "react"
import { CalendarClock, History, PauseCircle } from "lucide-react"
import { toast } from "sonner"
import { preserveMemberMembership } from "@/actions/preservation-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { formatVietnamDate, vietnamDateKey } from "@/lib/vietnam-time"

type PreservationHistory = {
  id: number
  startDate: string
  endDate: string
  creditedDays: number
  reason: string
  status: string
  createdAt: Date
  creator?: { fullName: string | null; username: string | null } | null
}

function inclusiveDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  return Math.max(0, Math.round((end - start) / 86_400_000) + 1)
}

export function PreservationDialog({
  memberId,
  memberName,
  membershipEndDate,
  history,
  triggerClassName,
}: {
  memberId: number
  memberName: string
  membershipEndDate: Date
  history: PreservationHistory[]
  triggerClassName?: string
}) {
  const today = vietnamDateKey()
  const maxDate = vietnamDateKey(membershipEndDate)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const idempotencyKey = useRef(crypto.randomUUID())
  const days = inclusiveDays(startDate, endDate)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    try {
      const result = await preserveMemberMembership({
        memberId,
        startDate,
        endDate,
        reason: String(form.get("reason") || ""),
        idempotencyKey: idempotencyKey.current,
      })
      if (!result.success) return toast.error(result.error)
      toast.success(`Đã bảo lưu ${result.creditedDays} ngày cho ${memberName}`)
      idempotencyKey.current = crypto.randomUUID()
      setOpen(false)
    } catch {
      toast.error("Không thể bảo lưu. Dữ liệu chưa bị thay đổi.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline" className={cn("h-8 border-sky-200 bg-sky-50/60 text-sky-700 hover:bg-sky-50", triggerClassName)}>
          <PauseCircle className="h-4 w-4" /> Bảo lưu
        </Button>
      } />
      <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        <DialogHeader><DialogTitle>Bảo lưu gói tập</DialogTitle></DialogHeader>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
          <p className="font-semibold">{memberName}</p>
          <p className="mt-1 text-sky-800">Gói hiện tại có hạn đến {formatVietnamDate(membershipEndDate)}. Trong ngày bảo lưu, hội viên sẽ không check-in được; hệ thống tự mở lại sau ngày kết thúc.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`preservation-start-${memberId}`}>Từ ngày</Label>
              <input id={`preservation-start-${memberId}`} type="date" required min={today} max={maxDate} value={startDate} onChange={(event) => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value) }} className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`preservation-end-${memberId}`}>Đến hết ngày</Label>
              <input id={`preservation-end-${memberId}`} type="date" required min={startDate || today} max={maxDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <CalendarClock className="h-4 w-4 text-sky-600" />
            Gói tập và các lần gia hạn sau sẽ được dời thêm <strong>{days} ngày</strong>.
          </div>
          <div className="space-y-2">
            <Label htmlFor={`preservation-reason-${memberId}`}>Lý do bảo lưu</Label>
            <textarea id={`preservation-reason-${memberId}`} name="reason" minLength={3} maxLength={500} required rows={3} placeholder="Ví dụ: Hội viên đi công tác" className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm" />
          </div>
          <Button type="submit" disabled={pending || days < 1} className="w-full bg-sky-600 text-white hover:bg-sky-700">
            {pending ? "Đang bảo lưu..." : `Xác nhận bảo lưu ${days} ngày`}
          </Button>
        </form>

        {history.length > 0 && (
          <section className="border-t pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><History className="h-4 w-4" /> Lịch sử bảo lưu</h3>
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
              {history.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <strong className="text-slate-800">{formatVietnamDate(item.startDate)} – {formatVietnamDate(item.endDate)}</strong>
                    <span className="font-semibold text-sky-700">+{item.creditedDays} ngày</span>
                  </div>
                  <p className="mt-1">{item.reason}</p>
                  <p className="mt-1 text-slate-400">Tạo bởi {item.creator?.fullName || item.creator?.username || "Quản trị viên"}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}
