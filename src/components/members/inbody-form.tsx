"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { addInbodyRecord } from "@/actions/inbody-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { PlusCircle } from "lucide-react"

const formSchema = z.object({
  weight: z.coerce.number().min(20, "Cân nặng không hợp lệ").max(300, "Cân nặng không hợp lệ"),
  skeletalMuscle: z.coerce.number().min(10, "Giá trị không hợp lệ").max(150, "Giá trị không hợp lệ"),
  bodyFat: z.coerce.number().min(1, "Giá trị không hợp lệ").max(100, "Tỷ lệ mỡ phải <= 100"),
  notes: z.string().optional(),
})

export function InbodyForm({ memberId }: { memberId: number }) {
  const [open, setOpen] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      weight: 0,
      skeletalMuscle: 0,
      bodyFat: 0,
      notes: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const result = await addInbodyRecord({
      memberId,
      ...values,
    })

    if (result.success) {
      toast.success("Đã thêm bản ghi InBody mới")
      setOpen(false)
      form.reset()
    } else {
      toast.error(result.error || "Có lỗi xảy ra")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={<Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" />}
      >
        <PlusCircle className="w-4 h-4 mr-2" /> Thêm chỉ số InBody
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thêm chỉ số InBody mới</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cân nặng (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="Ví dụ: 65.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bodyFat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tỷ lệ mỡ (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="Ví dụ: 15.2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="skeletalMuscle"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Khối lượng cơ xương (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="Ví dụ: 32.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Ghi chú (Tuỳ chọn)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Đo lúc đói, vừa tập xong..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={form.formState.isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
                {form.formState.isSubmitting ? "Đang lưu..." : "Lưu kết quả"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
