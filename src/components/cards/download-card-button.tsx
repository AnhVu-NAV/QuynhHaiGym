"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import * as htmlToImage from "html-to-image"

type DownloadCardButtonProps = {
  targetId: string
  fileName: string
}

export function DownloadCardButton({ targetId, fileName }: DownloadCardButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    const element = document.getElementById(targetId)
    if (!element) return

    setIsDownloading(true)
    try {
      const dataUrl = await htmlToImage.toPng(element, {
        quality: 1,
        pixelRatio: 2,
      })
      
      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `${fileName}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success("Đã tải thẻ xuống thành công!")
    } catch (error) {
      console.error("Lỗi khi tải ảnh:", error)
      toast.error("Có lỗi xảy ra khi tải thẻ xuống.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="absolute top-4 right-4 z-50 p-2.5 bg-white/10 hover:bg-white/20 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 backdrop-blur-md rounded-full text-slate-700 dark:text-white transition-all shadow-sm border border-slate-200/50 dark:border-white/10 focus:outline-none"
      title="Tải ảnh thẻ xuống"
    >
      {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
    </button>
  )
}
