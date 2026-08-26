"use client"

import { toast } from "sonner"

export function CopyCardButton({ publicToken }: { publicToken: string }) {
  return (
    <button 
      onClick={() => {
        navigator.clipboard.writeText(`${window.location.origin}/my-card/${publicToken}`)
        toast.success("Đã copy link Thẻ tập ảo!")
      }}
      className="h-8 px-2 text-blue-600 hover:bg-blue-50 rounded-md text-xs font-medium border border-blue-200"
      title="Copy Link Thẻ ảo gửi cho khách"
    >
      Copy Thẻ
    </button>
  )
}
