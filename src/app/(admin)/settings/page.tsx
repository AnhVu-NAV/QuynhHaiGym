"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  createGymHoliday,
  deleteGymHoliday,
  getGymHolidays,
  getGymSettings,
  saveGymSettings,
  updateGymHoliday,
} from "@/actions/settings-actions"
import { toast } from "sonner"
import { BadgeCheck, Building2, CalendarDays, Check, Landmark, Lightbulb, Pencil, Plus, QrCode, Save, ShieldCheck, Trash2, X } from "lucide-react"
import { getUpcomingVietnamHolidaySuggestions, type VietnamHolidaySuggestion } from "@/lib/vietnam-holidays"

type GymHoliday = Awaited<ReturnType<typeof getGymHolidays>>[number]

function formatDateOnly(value: string) {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function inclusiveDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.floor((end - start) / 86_400_000) + 1
    : 0
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"holidays" | "payment">("holidays")
  const [isSaving, setIsSaving] = useState(false)
  const [bankId, setBankId] = useState("")
  const [accountNo, setAccountNo] = useState("")
  const [accountName, setAccountName] = useState("")
  const [holidays, setHolidays] = useState<GymHoliday[]>([])
  const [holidayName, setHolidayName] = useState("")
  const [holidayStart, setHolidayStart] = useState("")
  const [holidayEnd, setHolidayEnd] = useState("")
  const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null)
  const [isSavingHoliday, setIsSavingHoliday] = useState(false)
  const [deletingHolidayId, setDeletingHolidayId] = useState<number | null>(null)
  const [holidaySuggestions, setHolidaySuggestions] = useState<VietnamHolidaySuggestion[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [s, holidayRows] = await Promise.all([getGymSettings(), getGymHolidays()])
        if (cancelled) return
        setBankId(s.bankId || "")
        setAccountNo(s.accountNo || "")
        setAccountName(s.accountName || "")
        setHolidays(holidayRows)
        setHolidaySuggestions(getUpcomingVietnamHolidaySuggestions())
      } catch {
        if (!cancelled) toast.error("Không tải được cấu hình. Vui lòng thử lại.")
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    try {
      await saveGymSettings({
        bankId,
        accountNo,
        accountName: accountName.toUpperCase()
      })
      toast.success("Đã lưu cấu hình thành công!")
    } catch {
      toast.error("Lỗi khi lưu cấu hình.")
    } finally {
      setIsSaving(false)
    }
  }

  function resetHolidayForm() {
    setEditingHolidayId(null)
    setHolidayName("")
    setHolidayStart("")
    setHolidayEnd("")
  }

  function editHoliday(holiday: GymHoliday) {
    setEditingHolidayId(holiday.id)
    setHolidayName(holiday.name)
    setHolidayStart(holiday.startDate)
    setHolidayEnd(holiday.endDate)
  }

  function chooseHolidaySuggestion(suggestion: VietnamHolidaySuggestion) {
    setEditingHolidayId(null)
    setHolidayName(suggestion.name)
    setHolidayStart(suggestion.startDate)
    setHolidayEnd(suggestion.endDate)
    requestAnimationFrame(() => {
      document.getElementById("holiday-name")?.scrollIntoView({ behavior: "smooth", block: "center" })
      document.getElementById("holiday-name")?.focus({ preventScroll: true })
    })
  }

  async function refreshHolidays() {
    setHolidays(await getGymHolidays())
  }

  async function handleHolidaySave(e: React.FormEvent) {
    e.preventDefault()
    setIsSavingHoliday(true)
    try {
      const payload = { name: holidayName, startDate: holidayStart, endDate: holidayEnd }
      const result = editingHolidayId
        ? await updateGymHoliday(editingHolidayId, payload)
        : await createGymHoliday(payload)
      if (!result.success || !("adjustedSubscriptions" in result)) {
        toast.error("error" in result ? result.error : "Không thể lưu ngày nghỉ")
        return
      }
      await refreshHolidays()
      resetHolidayForm()
      toast.success(
        `Đã lưu ngày nghỉ và tính lại ${result.adjustedSubscriptions} gói tập.`,
      )
    } catch {
      toast.error("Không thể lưu ngày nghỉ lúc này.")
    } finally {
      setIsSavingHoliday(false)
    }
  }

  async function handleDeleteHoliday(holiday: GymHoliday) {
    if (!window.confirm(`Xóa “${holiday.name}”? Hạn gói đã cộng bù sẽ được tính lại.`)) return
    setDeletingHolidayId(holiday.id)
    try {
      const result = await deleteGymHoliday(holiday.id)
      if (!result.success || !("adjustedSubscriptions" in result)) {
        toast.error("error" in result ? result.error : "Không thể xóa ngày nghỉ")
        return
      }
      if (editingHolidayId === holiday.id) resetHolidayForm()
      await refreshHolidays()
      toast.success(`Đã xóa ngày nghỉ và tính lại ${result.adjustedSubscriptions} gói tập.`)
    } catch {
      toast.error("Không thể xóa ngày nghỉ lúc này.")
    } finally {
      setDeletingHolidayId(null)
    }
  }

  // Danh sách một số ngân hàng phổ biến cho VietQR
  const BANKS = [
    { id: "vcb", name: "Vietcombank" },
    { id: "mbbank", name: "MB Bank" },
    { id: "techcombank", name: "Techcombank" },
    { id: "acb", name: "ACB" },
    { id: "vib", name: "VIB" },
    { id: "tpbank", name: "TPBank" },
    { id: "vietinbank", name: "VietinBank" },
    { id: "bidv", name: "BIDV" },
    { id: "agribank", name: "Agribank" },
    { id: "sacombank", name: "Sacombank" },
    { id: "vpbank", name: "VPBank" },
    { id: "timodigital", name: "Timo" },
  ]
  const paymentReady = Boolean(bankId && accountNo && accountName)

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Cài đặt Hệ thống</h2>
        <p className="text-muted-foreground mt-1">Quản lý các cấu hình chung của phần mềm.</p>
      </div>

      <div
        role="tablist"
        aria-label="Nhóm cài đặt"
        className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:w-fit sm:min-w-[30rem]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "holidays"}
          onClick={() => setActiveTab("holidays")}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${activeTab === "holidays" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
        >
          <CalendarDays className="h-4 w-4" />
          <span className="hidden min-[390px]:inline">Ngày nghỉ &amp; bảo lưu</span>
          <span className="min-[390px]:hidden">Ngày nghỉ</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "payment"}
          onClick={() => setActiveTab("payment")}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${activeTab === "payment" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
        >
          <Building2 className="h-4 w-4" />
          <span className="hidden min-[390px]:inline">Thanh toán VietQR</span>
          <span className="min-[390px]:hidden">VietQR</span>
        </button>
      </div>

      {activeTab === "payment" && <Card role="tabpanel" className="w-full overflow-hidden border-muted shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-white via-emerald-50/50 to-white pb-5">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-700">
              <Landmark className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-xl">Tài khoản nhận thanh toán</CardTitle>
              <CardDescription className="mt-1 max-w-2xl leading-6">
                Thông tin này được dùng để tạo VietQR đúng số tiền khi đăng ký hoặc gia hạn gói tập.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)]">
            <form onSubmit={handleSave} className="grid min-w-0 gap-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 sm:p-5">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bank-id" className="font-semibold text-slate-700">Ngân hàng nhận tiền</Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    id="bank-id"
                    value={bankId}
                    onChange={(e) => setBankId(e.target.value)}
                    className="flex h-11 w-full appearance-none rounded-xl border border-input bg-white pr-10 pl-10 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100"
                    required
                  >
                    <option value="">-- Chọn ngân hàng --</option>
                    {BANKS.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-slate-400">▼</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-no" className="font-semibold text-slate-700">Số tài khoản</Label>
                <Input
                  id="account-no"
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ví dụ: 1903123456789"
                  inputMode="numeric"
                  className="h-11 rounded-xl bg-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-name" className="font-semibold text-slate-700">Tên chủ tài khoản</Label>
                <Input
                  id="account-name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Ví dụ: NGUYEN VAN A"
                  className="h-11 rounded-xl bg-white uppercase"
                  required
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-xs leading-5 text-slate-500">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  Chỉ quản trị viên mới có thể thay đổi thông tin nhận tiền.
                </p>
                <Button type="submit" size="lg" disabled={isSaving} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 sm:w-auto">
                  <Save className="h-4 w-4" /> {isSaving ? "Đang lưu..." : "Lưu thông tin"}
                </Button>
              </div>
            </form>

            <aside className="relative min-h-72 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-5 text-white shadow-lg shadow-emerald-900/10 sm:p-6">
              <div className="absolute -top-16 -right-16 h-44 w-44 rounded-full bg-white/10" />
              <div className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-teal-300/20" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-emerald-50">
                    <QrCode className="h-5 w-5" /> Xem trước VietQR
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                    <BadgeCheck className="h-3.5 w-3.5" /> {paymentReady ? "Sẵn sàng" : "Chưa thiết lập"}
                  </span>
                </div>

                <div className="my-6 rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur-sm">
                  <p className="text-xs font-medium text-emerald-100">Ngân hàng</p>
                  <p className="mt-1 text-lg font-bold tracking-tight">
                    {BANKS.find((bank) => bank.id === bankId)?.name || "Chưa chọn ngân hàng"}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
                    <div className="min-w-0">
                      <p className="text-[11px] text-emerald-100">Số tài khoản</p>
                      <p className="mt-1 truncate font-mono text-sm font-semibold">{accountNo || "Chưa thiết lập"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-emerald-100">Chủ tài khoản</p>
                      <p className="mt-1 truncate text-sm font-semibold uppercase">{accountName || "Chưa thiết lập"}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto space-y-2 text-xs leading-5 text-emerald-50">
                  <p className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> QR tự điền đúng số tiền của gói tập.</p>
                  <p className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Nội dung chuyển khoản có tên hội viên và gói.</p>
                </div>
              </div>
            </aside>
          </div>
        </CardContent>
      </Card>}

      {activeTab === "holidays" && <Card role="tabpanel" className="w-full min-w-0 border-muted shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-600" />
            <CardTitle>Bảo lưu ngày nghỉ của phòng tập</CardTitle>
          </div>
          <CardDescription>
            Khi phòng tập đóng cửa, hệ thống tự cộng bù từng ngày vào hạn gói của hội viên.
            Các khoảng trùng nhau chỉ được tính một lần; sửa hoặc xóa sẽ tự tính lại.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="mb-3 flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h3 className="font-semibold text-amber-950">Gợi ý các dịp lễ sắp tới</h3>
                <p className="mt-0.5 text-xs leading-5 text-amber-800">
                  Lịch tham khảo theo các ngày lễ lớn của Việt Nam. Chọn một dịp rồi chỉnh lại nếu phòng tập nghỉ khác lịch chung.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {holidaySuggestions.map((suggestion) => {
                const alreadyAdded = holidays.some((holiday) => (
                  holiday.startDate === suggestion.startDate && holiday.endDate === suggestion.endDate
                ))
                return (
                  <button
                    key={suggestion.key}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => chooseHolidaySuggestion(suggestion)}
                    className="flex min-h-24 items-start justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-default disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-semibold text-slate-900">{suggestion.name}</span>
                      <span className="mt-1 block text-xs font-medium text-emerald-700">
                        {formatDateOnly(suggestion.startDate)} – {formatDateOnly(suggestion.endDate)}
                      </span>
                      <span className="mt-1 block text-xs leading-4 text-slate-500">{suggestion.note}</span>
                    </span>
                    <span className="mt-0.5 shrink-0 rounded-lg bg-amber-100 p-1.5 text-amber-700">
                      {alreadyAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <form onSubmit={handleHolidaySave} className="rounded-2xl border bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.5fr)_minmax(11rem,.75fr)_minmax(11rem,.75fr)]">
              <div className="space-y-2 md:col-span-2 xl:col-span-1">
                <Label htmlFor="holiday-name">Tên ngày nghỉ</Label>
                <Input
                  id="holiday-name"
                  value={holidayName}
                  onChange={(event) => setHolidayName(event.target.value)}
                  placeholder="Ví dụ: Nghỉ Tết Nguyên Đán"
                  maxLength={255}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="holiday-start">Từ ngày</Label>
                <Input
                  id="holiday-start"
                  type="date"
                  value={holidayStart}
                  onChange={(event) => {
                    setHolidayStart(event.target.value)
                    if (!holidayEnd || holidayEnd < event.target.value) setHolidayEnd(event.target.value)
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="holiday-end">Đến hết ngày</Label>
                <Input
                  id="holiday-end"
                  type="date"
                  min={holidayStart || undefined}
                  value={holidayEnd}
                  onChange={(event) => setHolidayEnd(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {holidayStart && holidayEnd && holidayEnd >= holidayStart
                  ? `Sẽ bảo lưu ${inclusiveDays(holidayStart, holidayEnd)} ngày.`
                  : "Chọn ngày bắt đầu và kết thúc đợt nghỉ."}
              </p>
              <div className="grid grid-cols-1 gap-2 min-[390px]:flex">
                {editingHolidayId && (
                  <Button type="button" variant="outline" onClick={resetHolidayForm} disabled={isSavingHoliday}>
                    <X /> Hủy sửa
                  </Button>
                )}
                <Button type="submit" disabled={isSavingHoliday} className="bg-emerald-600 hover:bg-emerald-700">
                  {editingHolidayId ? <Save /> : <Plus />}
                  {isSavingHoliday ? "Đang tính lại..." : editingHolidayId ? "Lưu thay đổi" : "Thêm ngày nghỉ"}
                </Button>
              </div>
            </div>
          </form>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Các đợt nghỉ đã thiết lập</h3>
              <span className="text-sm text-muted-foreground">{holidays.length} đợt</span>
            </div>
            {holidays.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Chưa có ngày nghỉ. Hạn gói hiện chưa được cộng ngày bảo lưu.
              </div>
            ) : (
              <div className="divide-y rounded-2xl border bg-white">
                {holidays.map((holiday) => (
                  <div key={holiday.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{holiday.name}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatDateOnly(holiday.startDate)} – {formatDateOnly(holiday.endDate)}</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                          +{inclusiveDays(holiday.startDate, holiday.endDate)} ngày
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => editHoliday(holiday)}>
                        <Pencil /> Sửa
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deletingHolidayId === holiday.id}
                        onClick={() => handleDeleteHoliday(holiday)}
                      >
                        <Trash2 /> {deletingHolidayId === holiday.id ? "Đang xóa..." : "Xóa"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>}
    </div>
  )
}
