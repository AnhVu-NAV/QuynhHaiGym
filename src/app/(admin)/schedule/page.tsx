import Link from "next/link"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { getPTCalendarSessions } from "@/actions/schedule-actions"
import { getTrainers } from "@/actions/trainer-actions"
import { getMembers } from "@/actions/member-actions"
import { ScheduleDialog } from "@/components/schedule/schedule-dialog"
import { WeekCalendar } from "@/components/schedule/week-calendar"
import { Button } from "@/components/ui/button"
import { QueryFilter } from "@/components/ui/query-filter"
import { SearchInput } from "@/components/ui/search-input"

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

function mondayOf(value?: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? new Date(`${value}T12:00:00+07:00`) : new Date()
  const shortDay = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" }).format(date)
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(shortDay)
  date.setDate(date.getDate() - ((weekday + 6) % 7))
  return new Date(`${dateKey(date)}T00:00:00+07:00`)
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const q = typeof params.q === "string" ? params.q : ""
  const trainerFilter = typeof params.trainer === "string" ? params.trainer : "all"
  const status = typeof params.status === "string" ? params.status : "all"
  const week = typeof params.week === "string" ? params.week : undefined
  const weekStart = mondayOf(week)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const { data: trainers } = await getTrainers(undefined, 1, 1000, true, "active")
  const { data: allMembers } = await getMembers(undefined, 1, 1000)
  const activeMembers = allMembers.filter((member) => member.status === "active")
  const parsedTrainerId = trainerFilter !== "all" ? Number(trainerFilter) : undefined
  const sessions = await getPTCalendarSessions({ from: weekStart, to: weekEnd, q, trainerId: parsedTrainerId, status })

  const previousWeek = new Date(weekStart)
  previousWeek.setDate(previousWeek.getDate() - 7)
  const nextWeek = new Date(weekStart)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const makeHref = (target?: Date) => {
    const query = new URLSearchParams()
    if (q) query.set("q", q)
    if (trainerFilter !== "all") query.set("trainer", trainerFilter)
    if (status !== "all") query.set("status", status)
    if (target) query.set("week", dateKey(target))
    return `/schedule${query.size ? `?${query}` : ""}`
  }
  const weekLabel = `${weekStart.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" })} – ${new Date(weekEnd.getTime() - 1).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" })}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <div className="flex items-center gap-3"><span className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-700"><CalendarDays className="h-6 w-6" /></span><div><h2 className="text-3xl font-bold tracking-tight text-slate-900">Lịch tập PT</h2><p className="mt-1 text-muted-foreground">Xem tải của từng PT và đặt lịch lặp theo tuần.</p></div></div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
          <div className="min-w-56 flex-1"><SearchInput placeholder="Tìm hội viên hoặc PT..." /></div>
          <QueryFilter param="trainer" label="Lọc PT" options={[{ value: "all", label: "Tất cả PT" }, ...trainers.map((trainer) => ({ value: String(trainer.id), label: trainer.fullName }))]} />
          <QueryFilter param="status" label="Trạng thái" options={[{ value: "all", label: "Mọi trạng thái" }, { value: "scheduled", label: "Sắp diễn ra" }, { value: "completed", label: "Đã hoàn thành" }, { value: "cancelled", label: "Đã hủy" }]} />
          <ScheduleDialog trainers={trainers} members={activeMembers} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="rounded-xl" render={<Link href={makeHref(previousWeek)} aria-label="Tuần trước"><ChevronLeft className="h-4 w-4" /></Link>} />
          <Button variant="outline" className="rounded-xl" render={<Link href={makeHref()}>Hôm nay</Link>} />
          <Button variant="outline" size="icon" className="rounded-xl" render={<Link href={makeHref(nextWeek)} aria-label="Tuần sau"><ChevronRight className="h-4 w-4" /></Link>} />
          <strong className="ml-3 text-sm text-slate-800 sm:text-base">{weekLabel}</strong>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500"><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-200" /> Lịch đang hoạt động</span><span>Con số trên lịch = số người / sức chứa PT</span></div>
      </div>

      {sessions.length ? <WeekCalendar weekStart={dateKey(weekStart)} sessions={sessions} /> : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><CalendarDays className="mx-auto h-10 w-10 text-slate-300" /><h3 className="mt-3 font-semibold text-slate-800">Tuần này chưa có lịch tập</h3><p className="mt-1 text-sm text-slate-500">Bấm “Đặt lịch PT” để tạo một hoặc nhiều buổi.</p></div>
      )}
    </div>
  )
}
