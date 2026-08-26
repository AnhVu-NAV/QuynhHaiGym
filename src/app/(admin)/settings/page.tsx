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
import { Building2, CalendarDays, Pencil, Plus, Save, Trash2, X } from "lucide-react"

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

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Cài đặt Hệ thống</h2>
        <p className="text-muted-foreground mt-1">Quản lý các cấu hình chung của phần mềm.</p>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            <CardTitle>Cấu hình Ngân hàng (VietQR)</CardTitle>
          </div>
          <CardDescription>
            Thiết lập thông tin ngân hàng để tự động tạo mã QR Code thanh toán khi bán gói tập.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Ngân hàng nhận tiền</Label>
              <select 
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                required
              >
                <option value="">-- Chọn ngân hàng --</option>
                {BANKS.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Số tài khoản</Label>
              <Input 
                value={accountNo} 
                onChange={(e) => setAccountNo(e.target.value.replace(/\D/g, ''))} 
                placeholder="Ví dụ: 1903123456789"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tên chủ tài khoản</Label>
              <Input 
                value={accountName} 
                onChange={(e) => setAccountName(e.target.value)} 
                placeholder="Ví dụ: NGUYEN VAN A"
                className="uppercase"
                required
              />
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Save className="h-4 w-4" /> {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-muted shadow-sm">
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
          <form onSubmit={handleHolidaySave} className="rounded-2xl border bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_170px_170px]">
              <div className="space-y-2">
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
              <div className="flex gap-2">
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
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateOnly(holiday.startDate)} – {formatDateOnly(holiday.endDate)}
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
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
      </Card>
    </div>
  )
}
