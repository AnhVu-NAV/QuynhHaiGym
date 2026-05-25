"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createPackage, updatePackage } from "@/actions/package-actions"
import { toast } from "sonner"
import { Pencil, Plus } from "lucide-react"

const formSchema = z.object({
  name: z.string().min(2, { message: "Tên gói phải có ít nhất 2 ký tự" }),
  price: z.coerce.number().min(0, { message: "Giá không hợp lệ" }),
  durationMonths: z.coerce.number().min(1, { message: "Thời gian tối thiểu là 1 tháng" }),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
})

type PackageDialogProps = {
  mode: "create" | "edit"
  packageData?: {
    id: number
    name: string
    price: number
    durationMonths: number
    description: string | null
    isActive: boolean
  }
}

export function PackageDialog({ mode, packageData }: PackageDialogProps) {
  const [open, setOpen] = useState(false)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: packageData?.name || "",
      price: packageData?.price || 0,
      durationMonths: packageData?.durationMonths || 1,
      description: packageData?.description || "",
      isActive: packageData?.isActive ?? true,
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (mode === "create") {
        await createPackage(values)
        toast.success("Đã thêm gói tập thành công!")
      } else if (packageData) {
        await updatePackage(packageData.id, values)
        toast.success("Đã cập nhật gói tập!")
      }
      setOpen(false)
      reset()
    } catch (error) {
      toast.error("Đã có lỗi xảy ra. Vui lòng thử lại.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          mode === "create" ? (
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Thêm gói tập
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-8 px-2">
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Thêm gói tập mới" : "Chỉnh sửa gói tập"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên gói tập</Label>
            <Input id="name" placeholder="VD: Gói 12 Tháng..." {...register("name")} />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Giá (VNĐ)</Label>
              <Input id="price" type="number" {...register("price")} />
              {errors.price && <p className="text-sm text-red-500">{errors.price.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMonths">Thời hạn (Tháng)</Label>
              <Input id="durationMonths" type="number" {...register("durationMonths")} />
              {errors.durationMonths && <p className="text-sm text-red-500">{errors.durationMonths.message}</p>}
            </div>
          </div>
          
          <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
            <input
              type="checkbox"
              id="isActive"
              {...register("isActive")}
              className="mt-1"
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="isActive">Cho phép đăng ký</Label>
              <p className="text-sm text-muted-foreground">
                Hiển thị gói này cho hội viên đăng ký mới.
              </p>
            </div>
          </div>

          <Button type="submit" className="w-full">
            {mode === "create" ? "Tạo gói tập" : "Lưu thay đổi"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
