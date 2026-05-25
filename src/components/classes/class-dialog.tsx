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
import { Input } from "@/components/ui/input"
import { createClass } from "@/actions/class-actions"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"

export function ClassDialog({ trainers }: { trainers: any[] }) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [trainerId, setTrainerId] = useState("")
  const [capacity, setCapacity] = useState("20")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !capacity) return toast.error("Vui lòng điền đủ thông tin")

    setIsSubmitting(true)
    try {
      await createClass({
        name,
        description,
        trainerId: trainerId ? parseInt(trainerId) : undefined,
        capacity: parseInt(capacity),
      })
      toast.success("Đã tạo lớp học thành công!")
      setOpen(false)
      setName("")
      setDescription("")
    } catch (error) {
      toast.error("Lỗi khi tạo lớp học")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Thêm Lớp Nhóm
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tạo danh mục Lớp nhóm mới</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Tên lớp học</Label>
            <Input placeholder="VD: Yoga Cơ bản" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Giới hạn học viên (Sức chứa)</Label>
            <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>HLV phụ trách chính (Tùy chọn)</Label>
            <select 
              value={trainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">-- Không cố định HLV --</option>
              {trainers.map(t => (
                <option key={t.id} value={t.id}>{t.fullName}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Mô tả lớp học</Label>
            <Input placeholder="Phù hợp cho người mới..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
            {isSubmitting ? "Đang xử lý..." : "Lưu Lớp Học"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
