"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getMemberCheckIns } from "@/actions/checkin-actions"
import { History, CalendarCheck } from "lucide-react"

type MemberDetailsDialogProps = {
  memberData: {
    id: number
    fullName: string
    phoneNumber: string
    avatarUrl?: string | null
    joinDate: Date
  }
}

export function MemberDetailsDialog({ memberData }: MemberDetailsDialogProps) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setIsLoading(true)
      getMemberCheckIns(memberData.id).then(data => {
        setHistory(data)
        setIsLoading(false)
      })
    }
  }, [open, memberData.id])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <Button variant="outline" size="sm" className="h-8 px-2 text-slate-600 border-slate-200 hover:bg-slate-50" title="Lịch sử tập">
            <History className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Hồ sơ & Lịch sử tập</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
          {memberData.avatarUrl ? (
            <img src={memberData.avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover border-2 border-slate-100" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-500">
              {memberData.fullName.charAt(0)}
            </div>
          )}
          <div>
            <h3 className="font-bold text-lg text-slate-800">{memberData.fullName}</h3>
            <p className="text-sm text-slate-500">{memberData.phoneNumber}</p>
            <p className="text-xs text-slate-400">Tham gia: {new Date(memberData.joinDate).toLocaleDateString('vi-VN')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-600" /> 
            Lịch sử Check-in (50 lần gần nhất)
          </h4>
          
          <div className="max-h-[300px] overflow-y-auto rounded-md border border-slate-100 p-2 bg-slate-50">
            {isLoading ? (
              <p className="text-sm text-center text-slate-400 py-4">Đang tải dữ liệu...</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-center text-slate-400 py-4">Chưa có lịch sử đi tập.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((checkin) => {
                  const d = new Date(checkin.checkInTime)
                  return (
                    <li key={checkin.id} className="flex justify-between items-center bg-white p-2.5 rounded-md border border-slate-100 shadow-sm text-sm">
                      <span className="font-medium text-slate-700">
                        {d.toLocaleDateString('vi-VN')}
                      </span>
                      <span className="text-emerald-600 font-semibold">
                        {d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}
