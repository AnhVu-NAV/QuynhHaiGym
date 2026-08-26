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
import { registerSubscription } from "@/actions/subscription-actions"
import { toast } from "sonner"
import { CalendarDays, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

function todayInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

type SubscriptionDialogProps = {
  memberId: number
  memberName: string
  packages: {
    id: number
    name: string
    price: number
    durationMonths: number
  }[]
  settings?: {
    bankId: string | null
    accountNo: string | null
    accountName: string | null
  }
  activeSub?: {
    endDate: Date
    package?: { name: string } | null
  }
  triggerClassName?: string
}

export function SubscriptionDialog({ memberId, memberName, packages, settings, activeSub, triggerClassName }: SubscriptionDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedPackage, setSelectedPackage] = useState<string>(packages[0]?.id.toString() || "")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [startDate, setStartDate] = useState(todayInputValue)

  const pkg = packages.find(p => p.id.toString() === selectedPackage)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPackage) return toast.error("Vui lòng chọn gói tập")
    if (!startDate) return toast.error("Vui lòng chọn ngày bắt đầu")

    const selectedStartDate = new Date(`${startDate}T00:00:00`)
    if (Number.isNaN(selectedStartDate.getTime())) {
      return toast.error("Ngày bắt đầu không hợp lệ")
    }

    setIsSubmitting(true)
    try {
      await registerSubscription({
        memberId,
        packageId: parseInt(selectedPackage),
        startDate: selectedStartDate,
        paymentMethod
      })
      toast.success("Gia hạn gói tập thành công!")
      setOpen(false)
      setStartDate(todayInputValue())
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const qrUrl = (settings?.bankId && settings?.accountNo && pkg && paymentMethod === 'transfer') 
    ? `https://img.vietqr.io/image/${settings.bankId}-${settings.accountNo}-compact.png?amount=${pkg.price}&addInfo=${encodeURIComponent(`GYM ${memberName} goi ${pkg.name}`)}&accountName=${encodeURIComponent(settings.accountName || "")}` 
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 px-3 text-emerald-700 font-medium border-emerald-200 hover:bg-emerald-50 bg-emerald-50/50", triggerClassName)}
          >
            <CreditCard className="h-4 w-4 mr-2" /> Gia hạn
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gia hạn / Đăng ký gói mới</DialogTitle>
        </DialogHeader>
        
        {activeSub && (
          <div className="bg-emerald-50 text-emerald-800 p-3 rounded-md text-sm border border-emerald-200">
            <strong>Lưu ý:</strong> Hội viên đang sử dụng gói <strong>{activeSub.package?.name}</strong> (còn hạn đến {new Date(activeSub.endDate).toLocaleDateString('vi-VN')}). 
            <br/>Gói mới sẽ tự động được <strong>cộng dồn ngày</strong>.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="package">Chọn gói tập</Label>
            <select 
              id="package"
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
              className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {packages.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} - {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.price)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`renewal-start-${memberId}`}>Ngày bắt đầu gia hạn</Label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id={`renewal-start-${memberId}`}
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Thẻ hết hạn: bắt đầu đúng ngày đã chọn. Thẻ còn hạn: tự nối sau ngày hết hạn hiện tại để không mất ngày.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Phương thức thanh toán</Label>
            <select 
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="cash">Tiền mặt</option>
              <option value="transfer">Chuyển khoản (Mã QR)</option>
            </select>
          </div>

          {qrUrl && (
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <img src={qrUrl} alt="VietQR" className="w-48 h-48 rounded-lg shadow-sm" />
              <p className="text-xs text-muted-foreground mt-2 text-center">Khách hàng mở App Ngân hàng để quét mã này</p>
            </div>
          )}

          {!qrUrl && paymentMethod === 'transfer' && (
            <div className="p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
              Bạn chưa cấu hình Thông tin Ngân hàng. Vui lòng vào mục Cài đặt để thiết lập mã QR.
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting || packages.length === 0}>
            {isSubmitting ? "Đang xử lý..." : "Xác nhận & Thu tiền"}
          </Button>
          {packages.length === 0 && (
            <p className="text-sm text-red-500 text-center">Chưa có gói tập nào đang mở bán.</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
