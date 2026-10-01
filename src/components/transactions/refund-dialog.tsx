"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { refundMembershipTransaction } from "@/actions/transaction-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" })

export function RefundDialog({
  transactionId,
  memberName,
  amount,
  paymentMethod,
  triggerLabel = "Hoàn tiền",
  triggerClassName = "",
}: {
  transactionId: number
  memberName: string
  amount: number
  paymentMethod: string | null
  triggerLabel?: string
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    try {
      const result = await refundMembershipTransaction({
        transactionId,
        reason: String(form.get("reason") || ""),
        paymentMethod: String(form.get("paymentMethod")) as "cash" | "transfer",
      })
      if (!result.success) return toast.error(result.error)
      toast.success("Đã hủy gói và ghi nhận hoàn tiền")
      setOpen(false)
    } catch {
      toast.error("Không thể hoàn tiền. Dữ liệu chưa bị thay đổi.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className={`h-8 border-rose-200 text-rose-700 hover:bg-rose-50 ${triggerClassName}`}><RotateCcw className="h-3.5 w-3.5" />{triggerLabel}</Button>} />
      <DialogContent className="w-[calc(100%-1rem)] p-4 sm:max-w-md sm:p-6">
        <DialogHeader><DialogTitle>Hủy gia hạn & hoàn tiền</DialogTitle></DialogHeader>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          Gói của <strong>{memberName}</strong> sẽ bị hủy. Hệ thống ghi một khoản chi <strong>{money.format(amount)}</strong>; giao dịch gốc vẫn được giữ để đối soát.
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`refund-reason-${transactionId}`}>Lý do hoàn tiền</Label><textarea id={`refund-reason-${transactionId}`} name="reason" minLength={3} maxLength={500} required rows={3} placeholder="Ví dụ: Khách đổi ý ngay sau khi đăng ký" className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm" /></div>
          <div className="space-y-2"><Label htmlFor={`refund-method-${transactionId}`}>Hoàn bằng</Label><select id={`refund-method-${transactionId}`} name="paymentMethod" defaultValue={paymentMethod || "cash"} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="cash">Tiền mặt</option><option value="transfer">Chuyển khoản</option></select></div>
          <Button type="submit" disabled={pending} className="w-full bg-rose-600 text-white hover:bg-rose-700">{pending ? "Đang xử lý..." : "Xác nhận hủy và hoàn tiền"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
