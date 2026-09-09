"use client"

import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
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
import { createMember, updateMember } from "@/actions/member-actions"
import { startFaceEnrollment } from "@/actions/device-actions"
import type { EnrollmentDeviceOption } from "@/components/devices/face-enrollment-button"
import { toast } from "sonner"
import { Pencil, UserPlus, Camera, ArrowLeft, ImagePlus, Trash2, CalendarDays } from "lucide-react"
import { CldUploadWidget } from 'next-cloudinary'

const formSchema = z.object({
  fullName: z.string().min(2, { message: "Họ tên phải có ít nhất 2 ký tự" }),
  phoneNumber: z.string().min(10, { message: "Số điện thoại không hợp lệ" }),
  gender: z.string().optional(),
  status: z.string().default("active"),
  avatarUrl: z.string().optional(),
  packageId: z.string().optional(),
  startDate: z.string().optional(),
  paymentMethod: z.string().optional(),
  enrollFace: z.boolean().default(true),
  deviceId: z.string().optional(),
})

type MemberFormInput = z.input<typeof formSchema>
type MemberFormValues = z.output<typeof formSchema>

type MemberDialogProps = {
  mode: "create" | "edit"
  memberData?: {
    id: number
    fullName: string
    phoneNumber: string
    gender: string | null
    status: string
    avatarUrl?: string | null
  }
  packages?: {
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
  cloudinaryApiKey?: string
  cloudinaryCloudName?: string
  devices?: EnrollmentDeviceOption[]
}

function todayInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function MemberDialog({ mode, memberData, packages, settings, cloudinaryApiKey, cloudinaryCloudName, devices = [] }: MemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"form" | "qr">("form")
  const [pendingData, setPendingData] = useState<MemberFormValues | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string>(memberData?.avatarUrl || "")
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const subscriptionIdempotencyKeyRef = useRef(crypto.randomUUID())

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const firstOnlineDevice = devices.find((device) => device.online)
  const { register, handleSubmit, formState: { errors }, reset, setValue, control } = useForm<MemberFormInput, unknown, MemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: memberData?.fullName || "",
      phoneNumber: memberData?.phoneNumber || "",
      gender: memberData?.gender || "male",
      status: memberData?.status || "active",
      avatarUrl: memberData?.avatarUrl || "",
      packageId: "",
      startDate: todayInputValue(),
      paymentMethod: "cash",
      enrollFace: Boolean(firstOnlineDevice),
      deviceId: firstOnlineDevice ? String(firstOnlineDevice.id) : "",
    },
  })

  const handleUploadSuccess = (result: unknown) => {
    if (
      typeof result === "object"
      && result !== null
      && "event" in result
      && result.event === "success"
      && "info" in result
      && typeof result.info === "object"
      && result.info !== null
      && "secure_url" in result.info
      && typeof result.info.secure_url === "string"
    ) {
      const url = result.info.secure_url
      setAvatarUrl(url);
      setValue("avatarUrl", url);
      toast.success("Tải ảnh lên thành công!");
    }
  }

  async function onFormSubmit(values: MemberFormValues) {
    if (mode === "create" && !values.packageId) {
      toast.error("Hãy chọn gói tập cho hội viên")
      return
    }
    if (mode === "create" && !values.startDate) {
      toast.error("Hãy chọn ngày bắt đầu gói tập")
      return
    }
    if (mode === "create" && values.enrollFace && !values.deviceId) {
      toast.error("Hãy chọn máy AI26 cần quét")
      return
    }
    if (mode === "create" && values.packageId && values.paymentMethod === "transfer" && settings?.bankId) {
      setPendingData(values)
      setStep("qr")
      return
    }
    
    await executeSubmission(values)
  }

  async function executeSubmission(values: MemberFormValues) {
    setIsSubmitting(true)
    try {
      if (mode === "create") {
        const { enrollFace, deviceId, ...memberValues } = values
        if (!values.packageId || !values.startDate) {
          toast.error("Hãy chọn gói tập và ngày bắt đầu")
          return
        }
        const selectedStartDate = new Date(`${values.startDate}T00:00:00`)
        if (Number.isNaN(selectedStartDate.getTime())) {
          toast.error("Ngày bắt đầu không hợp lệ")
          return
        }
        const result = await createMember(
          { ...memberValues, avatarUrl },
          {
            packageId: parseInt(values.packageId),
            paymentMethod: values.paymentMethod || "cash",
            startDate: selectedStartDate,
            idempotencyKey: subscriptionIdempotencyKeyRef.current,
          },
        )
        if (!result.success) {
          toast.error(result.error)
          return
        }

        if (values.packageId && result.newMemberId) {
          toast.success("Đã thêm hội viên và đăng ký gói thành công!")
        } else {
          toast.success("Đã thêm hội viên thành công!")
        }

        if (enrollFace && result.newMemberId) {
          const faceResult = await startFaceEnrollment(result.newMemberId, Number(deviceId))
          if (faceResult.success) toast.success(faceResult.message)
          else toast.warning(faceResult.message)
        }
      } else if (memberData) {
        await updateMember(memberData.id, {
          fullName: values.fullName,
          phoneNumber: values.phoneNumber,
          gender: values.gender,
          status: values.status,
          avatarUrl,
        })
        toast.success("Đã cập nhật hội viên!")
      }
      handleClose()
      subscriptionIdempotencyKeyRef.current = crypto.randomUUID()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleClose() {
    setOpen(false)
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => {
      reset()
      setAvatarUrl(memberData?.avatarUrl || "")
      setStep("form")
      setPendingData(null)
      resetTimerRef.current = null
    }, 300)
  }

  function handleMemberFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    void handleSubmit(onFormSubmit)(event)
  }

  let qrUrl = null
  let selectedPkg = null
  if (step === "qr" && pendingData && pendingData.packageId && packages && settings) {
    selectedPkg = packages.find(p => p.id.toString() === pendingData.packageId)
    if (selectedPkg && settings.bankId && settings.accountNo) {
      qrUrl = `https://img.vietqr.io/image/${settings.bankId}-${settings.accountNo}-compact.png?amount=${selectedPkg.price}&addInfo=${encodeURIComponent(`GYM ${pendingData.fullName} goi ${selectedPkg.name}`)}&accountName=${encodeURIComponent(settings.accountName || "")}`
    }
  }
  const enrollFace = useWatch({ control, name: "enrollFace" })

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if(!val) handleClose()
      else setOpen(true)
    }}>
      <DialogTrigger 
        render={
          mode === "create" ? (
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" /> Thêm hội viên
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-8 px-2">
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {step === "qr" ? "Thanh toán Đăng ký gói" : (mode === "create" ? "Thêm hội viên mới" : "Chỉnh sửa hội viên")}
          </DialogTitle>
        </DialogHeader>
        
        {step === "form" ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 text-center">
                <div className="text-sm font-semibold text-slate-800">Ảnh đại diện</div>
                <div className="text-xs text-muted-foreground">Không bắt buộc — có thể chụp ngay hoặc chọn ảnh có sẵn</div>
              </div>
              <div className="flex flex-col items-center justify-center space-y-3">
              <div className="relative h-24 w-24 rounded-full bg-slate-100 overflow-hidden border-2 border-primary/20 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" width={96} height={96} loading="lazy" decoding="async" className="object-cover w-full h-full" />
                ) : (
                  <Camera className="h-8 w-8 text-slate-400" />
                )}
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-2">
              {cloudinaryApiKey && cloudinaryCloudName ? (
                <CldUploadWidget
                  config={{ cloud: { apiKey: cloudinaryApiKey, cloudName: cloudinaryCloudName } }}
                  uploadPreset="quynh_hai_gym_avatars"
                  signatureEndpoint="/api/cloudinary/sign"
                  onSuccess={handleUploadSuccess}
                  options={{
                    maxFiles: 1,
                    multiple: false,
                    sources: ["camera", "local"],
                    defaultSource: "camera",
                    maxFileSize: 5_000_000,
                    folder: "gym-avatars",
                    clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
                  }}
                >
                  {({ open, isLoading }) => (
                    <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={() => open()}>
                      <ImagePlus className="mr-2 h-4 w-4" /> {isLoading ? "Đang tải camera..." : "Chụp / Chọn ảnh"}
                    </Button>
                  )}
                </CldUploadWidget>
              ) : (
                <Button type="button" variant="outline" size="sm" disabled>Ảnh chưa được cấu hình</Button>
              )}
              {avatarUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => {
                    setAvatarUrl("")
                    setValue("avatarUrl", "")
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Bỏ ảnh
                </Button>
              )}
              </div>
              {!avatarUrl && <p className="text-xs text-muted-foreground">Có thể để trống và thêm ảnh sau.</p>}
              </div>
            </div>

            <form onSubmit={handleMemberFormSubmit} className="space-y-4 pb-1">
              <div className="space-y-2">
                <Label htmlFor="fullName">Họ tên</Label>
                <Input id="fullName" placeholder="Nguyễn Văn A" {...register("fullName")} />
                {errors.fullName && <p className="text-sm text-red-500">{errors.fullName.message}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Số điện thoại</Label>
                <Input id="phoneNumber" placeholder="0912345678" {...register("phoneNumber")} />
                {errors.phoneNumber && <p className="text-sm text-red-500">{errors.phoneNumber.message}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Giới tính</Label>
                  <select 
                    id="gender"
                    {...register("gender")} 
                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                

              </div>

              {mode === "create" && (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <label className={`flex items-start gap-3 ${devices.some((device) => device.online) ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}>
                    <input type="checkbox" className="mt-1 h-4 w-4" disabled={!devices.some((device) => device.online)} {...register("enrollFace")} />
                    <span>
                      <span className="block text-sm font-semibold text-emerald-900">Đăng ký khuôn mặt AI26 sau khi lưu (không bắt buộc)</span>
                      <span className="block text-xs text-emerald-800">Chọn đúng máy mà hội viên đang đứng trước camera.</span>
                    </span>
                  </label>
                  {enrollFace && (
                    <div className="space-y-1.5 border-t border-emerald-200 pt-3">
                      <Label htmlFor="deviceId" className="text-emerald-950">Máy dùng để quét</Label>
                      <select
                        id="deviceId"
                        {...register("deviceId")}
                        className="flex h-10 w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      >
                        <option value="">-- Chọn máy đang trực tuyến --</option>
                        {devices.map((device) => (
                          <option key={device.id} value={device.id} disabled={!device.online}>
                            {device.name} · {device.serialNumber}{device.online ? "" : " · Ngoại tuyến"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {devices.length === 0 && (
                    <p className="text-xs font-medium text-amber-800">Chưa có máy. Hãy thêm máy tại mục Máy nhận diện.</p>
                  )}
                  {devices.length > 0 && !devices.some((device) => device.online) && (
                    <p className="text-xs font-medium text-amber-800">Tất cả máy đang ngoại tuyến nên chưa thể quét mặt.</p>
                  )}
                </div>
              )}

              {mode === "create" && (
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Đăng ký gói tập <span className="text-red-500">*</span></h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">Hội viên mới phải có gói tập trước khi được lưu.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="packageId">Chọn gói tập <span className="text-red-500">*</span></Label>
                    <select 
                      id="packageId"
                      {...register("packageId")}
                      required
                      className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">-- Chọn gói tập --</option>
                      {(packages || []).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} - {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.price)}
                        </option>
                      ))}
                    </select>
                    {(!packages || packages.length === 0) && (
                      <p className="text-sm font-medium text-red-600">Chưa có gói tập đang mở bán. Hãy tạo hoặc mở bán gói tập trước.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">Ngày bắt đầu <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="startDate"
                        type="date"
                        required
                        className="pl-9"
                        {...register("startDate")}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Mặc định là hôm nay; có thể chọn ngày mai hoặc một ngày khác.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Thanh toán</Label>
                    <select 
                      id="paymentMethod"
                      {...register("paymentMethod")}
                      className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="cash">Tiền mặt</option>
                      <option value="transfer">Chuyển khoản (Hiện mã QR)</option>
                    </select>
                  </div>
                </div>
              )}

              <Button type="submit" className="sticky bottom-0 z-20 mt-2 h-11 w-full bg-emerald-600 shadow-[0_-10px_24px_rgba(255,255,255,.96)] hover:bg-emerald-700" disabled={isSubmitting || (mode === "create" && (!packages || packages.length === 0))}>
                {isSubmitting ? "Đang xử lý..." : "Tiếp tục"}
              </Button>
            </form>
          </>
        ) : (
          <div className="space-y-6 py-4">
            {qrUrl ? (
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <img src={qrUrl} alt="VietQR" width={192} height={192} decoding="async" className="w-48 h-48 rounded-lg shadow-sm" />
                <p className="text-xs text-muted-foreground mt-2 text-center">Khách hàng quét mã để thanh toán</p>
                <div className="mt-4 text-center">
                  <p className="text-sm font-medium">Hội viên: <span className="font-bold">{pendingData?.fullName}</span></p>
                  <p className="text-sm font-medium">Gói tập: <span className="font-bold">{selectedPkg?.name}</span></p>
                  <p className="text-emerald-600 font-bold mt-1 text-lg">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedPkg?.price || 0)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm text-center">
                Vui lòng vào mục Cài đặt để thiết lập tài khoản Ngân hàng.
              </div>
            )}
            
            <div className="flex gap-3">
              <Button variant="outline" className="w-1/3" onClick={() => setStep("form")} disabled={isSubmitting}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
              </Button>
              <Button 
                className="w-2/3" 
                onClick={() => pendingData && executeSubmission(pendingData)}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang lưu..." : "Đã nhận tiền & Lưu H.Viên"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
