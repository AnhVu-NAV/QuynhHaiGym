"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { processCheckIn } from "@/actions/checkin-actions"
import { QrCode, Dumbbell, UserCheck, XCircle, Camera, Keyboard } from "lucide-react"
import { Scanner } from '@yudiel/react-qr-scanner'

export default function PublicCheckInPage() {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [member, setMember] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScanning, setIsScanning] = useState(true)

  async function executeCheckIn(phone: string) {
    if (!phone || phone.length < 9) return

    setIsProcessing(true)
    setStatus("idle")
    
    try {
      const res = await processCheckIn(phone)
      if (res.success) {
        setStatus("success")
        setMessage(res.message)
        setMember(res.member)
        setTimeout(() => {
          setStatus("idle")
          setPhoneNumber("")
          setMember(null)
        }, 3000)
      } else {
        setStatus("error")
        setMessage(res.message)
        setMember(res.member || null)
        setTimeout(() => {
          setStatus("idle")
          setPhoneNumber("")
          setMember(null)
        }, 5000)
      }
    } catch (err) {
      setStatus("error")
      setMessage("Lỗi kết nối máy chủ")
    } finally {
      setIsProcessing(false)
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    executeCheckIn(phoneNumber)
  }

  function handleScan(result: any) {
    if (result && result.length > 0 && !isProcessing) {
      const scannedPhone = result[0].rawValue;
      if (scannedPhone) {
        setPhoneNumber(scannedPhone);
        executeCheckIn(scannedPhone);
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-primary/10 p-6 flex flex-col items-center border-b border-primary/20">
          <Dumbbell className="h-12 w-12 text-primary mb-2" />
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Quỳnh Hải Gym</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Hệ thống Check-in Tự động</p>
        </div>

        <div className="p-8">
          {status === "idle" && !isScanning && (
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="space-y-2 text-center">
                <label className="text-lg font-semibold text-slate-700">Nhập số điện thoại</label>
                <Input 
                  type="tel" 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="text-center text-2xl h-14 tracking-widest font-bold"
                  placeholder="09..."
                  autoFocus
                />
              </div>
              <Button type="submit" size="lg" className="w-full h-14 text-lg rounded-xl" disabled={isProcessing}>
                {isProcessing ? "Đang xử lý..." : "CHECK-IN"}
              </Button>
              
              <Button 
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl mt-4 border-dashed border-2 flex items-center justify-center gap-2"
                onClick={() => setIsScanning(true)}
              >
                <QrCode className="h-5 w-5 text-emerald-600" />
                <span>Quét mã QR Thẻ Ảo</span>
              </Button>
            </form>
          )}

          {status === "idle" && isScanning && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="font-bold text-slate-800">Đưa mã QR vào khung hình</h3>
                <p className="text-sm text-slate-500">Mã QR trên Thẻ Điện tử của Hội viên</p>
              </div>
              
              <div className="rounded-2xl overflow-hidden border-4 border-emerald-500 shadow-inner bg-black">
                <Scanner 
                  onScan={handleScan}
                  components={{
                    onOff: true,
                    torch: true,
                    zoom: true,
                    finder: true,
                  }}
                />
              </div>

              <Button 
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl flex items-center justify-center gap-2"
                onClick={() => setIsScanning(false)}
              >
                <Keyboard className="h-5 w-5 text-slate-600" />
                <span>Chuyển sang Nhập số điện thoại</span>
              </Button>
            </div>
          )}

          {status === "success" && member && (
            <div className="flex flex-col items-center text-center space-y-4 py-8 animate-in fade-in zoom-in duration-300">
              <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2 shadow-inner border border-emerald-200">
                <UserCheck className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Xin chào, {member.fullName}!</h2>
              <p className="text-emerald-600 font-medium bg-emerald-50 px-4 py-2 rounded-full">
                {message}
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center text-center space-y-4 py-8 animate-in fade-in zoom-in duration-300">
              <div className="h-20 w-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2 shadow-inner border border-red-200">
                <XCircle className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">
                {member ? member.fullName : "Không hợp lệ"}
              </h2>
              <p className="text-red-600 font-medium bg-red-50 px-4 py-2 rounded-xl text-sm border border-red-100">
                {message}
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-8 text-slate-400 text-xs">
        &copy; {new Date().getFullYear()} Quỳnh Hải Gym Management System
      </div>
    </div>
  )
}
