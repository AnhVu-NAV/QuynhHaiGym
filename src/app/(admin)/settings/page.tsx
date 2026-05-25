"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { saveGymSettings, getGymSettings } from "@/actions/settings-actions"
import { toast } from "sonner"
import { Building2, Save } from "lucide-react"

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false)
  const [bankId, setBankId] = useState("")
  const [accountNo, setAccountNo] = useState("")
  const [accountName, setAccountName] = useState("")

  useEffect(() => {
    async function load() {
      const s = await getGymSettings()
      setBankId(s.bankId || "")
      setAccountNo(s.accountNo || "")
      setAccountName(s.accountName || "")
    }
    load()
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
    } catch (error) {
      toast.error("Lỗi khi lưu cấu hình.")
    } finally {
      setIsSaving(false)
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
    <div className="space-y-6 max-w-2xl">
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
    </div>
  )
}
