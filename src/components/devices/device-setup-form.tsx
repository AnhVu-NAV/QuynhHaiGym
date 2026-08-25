"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { saveDevice } from "@/actions/device-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DeviceSetupForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function submit(formData: FormData) {
    setPending(true)
    try {
      await saveDevice({
        name: String(formData.get("name") || ""),
        serialNumber: String(formData.get("serialNumber") || ""),
      })
      toast.success("Đã lưu máy AI26")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được thiết bị")
    } finally {
      setPending(false)
    }
  }

  return (
    <form action={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-2">
        <Label htmlFor="device-name">Tên máy</Label>
        <Input id="device-name" name="name" placeholder="Máy cửa chính" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="device-serial">Serial AI26</Label>
        <Input
          id="device-serial"
          name="serialNumber"
          defaultValue="AYUD15044766"
          autoCapitalize="characters"
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Đang lưu..." : "Lưu thiết bị"}
      </Button>
    </form>
  )
}

