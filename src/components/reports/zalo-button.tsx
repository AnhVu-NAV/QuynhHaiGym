"use client"

import { MessageCircle } from "lucide-react"

type ZaloButtonProps = {
  phoneNumber: string
  memberName: string
  daysLeft: number
  endDate: string
}

export function ZaloButton({ phoneNumber, memberName, daysLeft, endDate }: ZaloButtonProps) {
  // Định dạng lại sđt Zalo (thay số 0 đầu bằng 84 nếu cần, nhưng zalo.me hỗ trợ cả 09x)
  const formattedPhone = phoneNumber.replace(/[^0-9]/g, '')
  
  const message = `Chào anh/chị ${memberName}, thẻ tập của anh/chị tại Quỳnh Hải Gym sẽ hết hạn vào ngày ${endDate} (còn ${daysLeft} ngày nữa). Anh/chị sắp xếp thời gian qua quầy Lễ tân để gia hạn gói tập nhé. Chúc anh/chị một ngày tốt lành! `

  const handleClick = () => {
    // Thử copy tin nhắn vào clipboard để lễ tân dán (paste) cho nhanh nếu Zalo không hỗ trợ truyền text
    navigator.clipboard.writeText(message)
    
    // Mở link Zalo
    const url = `https://zalo.me/${formattedPhone}`
    window.open(url, '_blank')
  }

  return (
    <button 
      onClick={handleClick}
      className="flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 transition-colors"
      title="Mở chat Zalo (Đã tự động copy sẵn câu chào)"
    >
      <MessageCircle className="h-3 w-3" />
      Nhắn Zalo
    </button>
  )
}
