"use client"

import { useRef, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { createCashflowEntry } from "@/actions/transaction-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { parseVietnamDateInput, vietnamDateKey } from "@/lib/vietnam-time"

const categoryOptions = [
  { value: "rent", label: "Tiền thuê mặt bằng" },
  { value: "utilities", label: "Điện, nước, Internet" },
  { value: "salary", label: "Lương nhân viên / PT" },
  { value: "equipment", label: "Thiết bị, sửa chữa" },
  { value: "other", label: "Khác" },
]

export function CashflowEntryDialog() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [direction, setDirection] = useState<"income" | "expense">("expense")
  const [category, setCategory] = useState("other")
  const idempotencyKey = useRef(crypto.randomUUID())

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amount = Number(String(form.get("amount") || "").replace(/\D/g, ""))
    const dateValue = String(form.get("transactionDate") || "")
    setPending(true)
    try {
      const result = await createCashflowEntry({
        direction,
        category: category as "rent" | "utilities" | "salary" | "equipment" | "other",
        amount,
        paymentMethod: String(form.get("paymentMethod")) as "cash" | "transfer",
        description: String(form.get("description") || ""),
        note: String(form.get("note") || ""),
        transactionDate: parseVietnamDateInput(dateValue),
        idempotencyKey: idempotencyKey.current,
      })
      if (!result.success) return toast.error(result.error)
      toast.success(direction === "income" ? "Đã ghi nhận khoản thu" : "Đã ghi nhận khoản chi")
      idempotencyKey.current = crypto.randomUUID()
      setOpen(false)
    } catch {
      toast.error("Không thể ghi nhận khoản thu/chi. Vui lòng thử lại.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full bg-emerald-700 hover:bg-emerald-800 sm:w-auto"><Plus className="h-4 w-4" />Thêm khoản thu/chi</Button>} />
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        <DialogHeader><DialogTitle>Ghi nhận khoản thu / chi</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => setDirection("income")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${direction === "income" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>Khoản thu</button>
            <button type="button" onClick={() => setDirection("expense")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${direction === "expense" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500"}`}>Khoản chi</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="cashflow-category">Nhóm</Label><select id="cashflow-category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">{categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="cashflow-amount">Số tiền (VNĐ)</Label><input id="cashflow-amount" name="amount" type="number" inputMode="numeric" min="1" max="2000000000" required className="h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm" /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="cashflow-description">Nội dung</Label><input id="cashflow-description" name="description" maxLength={500} required placeholder="Ví dụ: Thanh toán tiền điện tháng 10" className="h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="cashflow-date">Ngày ghi nhận</Label><input id="cashflow-date" name="transactionDate" type="date" defaultValue={vietnamDateKey()} required className="h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm" /></div>
            <div className="space-y-2"><Label htmlFor="cashflow-method">Phương thức</Label><select id="cashflow-method" name="paymentMethod" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option></select></div>
          </div>
          <div className="space-y-2"><Label htmlFor="cashflow-note">Ghi chú (không bắt buộc)</Label><textarea id="cashflow-note" name="note" rows={3} maxLength={1000} className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm" /></div>
          <Button type="submit" disabled={pending} className="w-full bg-emerald-700 hover:bg-emerald-800">{pending ? "Đang lưu..." : "Lưu bút toán"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
