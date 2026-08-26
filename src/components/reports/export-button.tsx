"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { getExportData } from "@/actions/report-actions"
import { useState } from "react"
import { toast } from "sonner"

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false)

  async function handleExport() {
    setIsExporting(true)
    try {
      const data = await getExportData()
      
      if (data.length === 0) {
        toast.info("Không có dữ liệu để xuất")
        return
      }

      // Convert to CSV string
      const headers = Object.keys(data[0])
      const csvRows = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(','))
      ]
      
      const csvString = csvRows.join('\n')
      // Add BOM for Excel UTF-8 support
      const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' })
      
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `bao-cao-hoi-vien-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success("Xuất dữ liệu thành công!")
    } catch {
      toast.error("Lỗi khi xuất dữ liệu")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button onClick={handleExport} disabled={isExporting} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
      <Download className="h-4 w-4" /> 
      {isExporting ? "Đang xử lý..." : "Xuất File Excel (CSV)"}
    </Button>
  )
}
