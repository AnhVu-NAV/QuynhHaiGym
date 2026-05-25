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
import { createTrainer, updateTrainer } from "@/actions/trainer-actions"
import { toast } from "sonner"
import { Pencil, Plus, Camera, UserPlus } from "lucide-react"
import { CldUploadWidget } from 'next-cloudinary';

const formSchema = z.object({
  fullName: z.string().min(2, { message: "Họ tên phải có ít nhất 2 ký tự" }),
  phoneNumber: z.string().min(10, { message: "Số điện thoại không hợp lệ" }),
  specialty: z.string().optional(),
  isActive: z.boolean().default(true),
  avatarUrl: z.string().optional(),
})

type TrainerDialogProps = {
  mode: "create" | "edit"
  trainerData?: {
    id: number
    fullName: string
    phoneNumber: string
    specialty: string | null
    isActive: boolean
    avatarUrl?: string | null
  }
}

export function TrainerDialog({ mode, trainerData }: TrainerDialogProps) {
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string>(trainerData?.avatarUrl || "")

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      fullName: trainerData?.fullName || "",
      phoneNumber: trainerData?.phoneNumber || "",
      specialty: trainerData?.specialty || "",
      isActive: trainerData?.isActive ?? true,
      avatarUrl: trainerData?.avatarUrl || "",
    },
  })

  const handleUploadSuccess = (result: any) => {
    if (result.event === "success") {
      const url = result.info.secure_url;
      setAvatarUrl(url);
      setValue("avatarUrl", url);
      toast.success("Tải ảnh lên thành công!");
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (mode === "create") {
        await createTrainer({ ...values, avatarUrl })
        toast.success("Đã thêm Huấn luyện viên thành công!")
      } else if (trainerData) {
        await updateTrainer(trainerData.id, { ...values, avatarUrl })
        toast.success("Đã cập nhật thông tin HLV!")
      }
      setOpen(false)
      reset()
      setAvatarUrl("")
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
              <UserPlus className="h-4 w-4" /> Thêm PT
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
          <DialogTitle>{mode === "create" ? "Thêm Huấn luyện viên mới" : "Chỉnh sửa thông tin"}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center space-y-4 mb-4">
          <div className="relative h-24 w-24 rounded-full bg-slate-100 overflow-hidden border-2 border-primary/20 flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="object-cover w-full h-full" />
            ) : (
              <Camera className="h-8 w-8 text-slate-400" />
            )}
          </div>
          
          <CldUploadWidget 
            uploadPreset="quynh_hai_gym_avatars" 
            onSuccess={handleUploadSuccess}
            options={{
              maxFiles: 1,
              clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
            }}
          >
            {({ open }) => {
              return (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => open()}
                >
                  Chụp / Chọn ảnh
                </Button>
              );
            }}
          </CldUploadWidget>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Họ tên</Label>
            <Input id="fullName" placeholder="Nguyễn Văn PT" {...register("fullName")} />
            {errors.fullName && <p className="text-sm text-red-500">{errors.fullName.message}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Số điện thoại</Label>
            <Input id="phoneNumber" placeholder="0912345678" {...register("phoneNumber")} />
            {errors.phoneNumber && <p className="text-sm text-red-500">{errors.phoneNumber.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialty">Chuyên môn (Thế mạnh)</Label>
            <Input id="specialty" placeholder="Giảm mỡ, Tăng cơ, Yoga..." {...register("specialty")} />
          </div>
          
          {mode === "edit" && (
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="isActive"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...register("isActive")}
              />
              <Label htmlFor="isActive" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Đang làm việc tại phòng tập
              </Label>
            </div>
          )}

          <Button type="submit" className="w-full mt-4">
            {mode === "create" ? "Lưu thông tin" : "Cập nhật"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
